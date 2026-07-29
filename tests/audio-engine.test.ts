import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  AMBIENT_CROSSFADE_SECONDS,
  AudioEngine,
  VOICE_DUCK_GAIN,
} from "../src/audio/engine";
import { ZONE_IR_CROSSFADE_SECONDS } from "../src/audio/graph";
import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  AudioManifestEntry,
  AudioNodeLike,
  AudioParamLike,
  ConvolverNodeLike,
  GainNodeLike,
  ImpulseManifestEntry,
} from "../src/audio/types";

type ParamEvent =
  | { kind: "cancel"; time: number }
  | { kind: "hold"; time: number }
  | { kind: "set"; time: number; value: number }
  | { kind: "linear"; time: number; value: number };

class FakeParam implements AudioParamLike {
  public value = 1;
  public readonly events: ParamEvent[] = [];

  public cancelScheduledValues(time: number): this {
    this.events.push({ kind: "cancel", time });
    return this;
  }

  public cancelAndHoldAtTime(time: number): this {
    this.events.push({ kind: "hold", time });
    return this;
  }

  public setValueAtTime(value: number, time: number): this {
    this.value = value;
    this.events.push({ kind: "set", time, value });
    return this;
  }

  public linearRampToValueAtTime(value: number, time: number): this {
    this.value = value;
    this.events.push({ kind: "linear", time, value });
    return this;
  }
}

class FakeNode implements AudioNodeLike {
  public readonly connections: AudioNodeLike[] = [];
  public disconnectCalls = 0;

  public constructor(public readonly name: string) {}

  public connect(destination: AudioNodeLike): AudioNodeLike {
    this.connections.push(destination);
    return destination;
  }

  public disconnect(): void {
    this.disconnectCalls += 1;
    this.connections.length = 0;
  }
}

class FakeGain extends FakeNode implements GainNodeLike {
  public readonly gain = new FakeParam();
}

class FakeConvolver extends FakeNode implements ConvolverNodeLike {
  public buffer: AudioBufferLike | null = null;
  public normalize = false;
}

class FakeSource extends FakeNode implements AudioBufferSourceNodeLike {
  public buffer: AudioBufferLike | null = null;
  public loop = false;
  public onended: (() => void) | null = null;
  public startAt: number | undefined;
  public readonly stops: Array<number | undefined> = [];
  private errorListener: (() => void) | null = null;

  public start(when?: number): void {
    this.startAt = when;
  }

  public stop(when?: number): void {
    this.stops.push(when);
  }

  public addEventListener(type: "error", listener: () => void): void {
    if (type === "error") this.errorListener = listener;
  }

  public removeEventListener(type: "error", listener: () => void): void {
    if (type === "error" && this.errorListener === listener) {
      this.errorListener = null;
    }
  }

  public emitEnded(): void {
    this.onended?.();
  }

  public emitError(): void {
    this.errorListener?.();
  }
}

class FakeContext implements AudioContextLike {
  public currentTime = 0;
  public state: AudioContextState = "suspended";
  public readonly destination = new FakeNode("destination");
  public readonly gains: FakeGain[] = [];
  public readonly convolvers: FakeConvolver[] = [];
  public readonly sources: FakeSource[] = [];
  public resumeCalls = 0;
  public closeCalls = 0;
  public decodeCalls = 0;

  public createGain(): FakeGain {
    const gain = new FakeGain(`gain-${this.gains.length}`);
    this.gains.push(gain);
    return gain;
  }

  public createConvolver(): FakeConvolver {
    const convolver = new FakeConvolver(`convolver-${this.convolvers.length}`);
    this.convolvers.push(convolver);
    return convolver;
  }

  public createBufferSource(): FakeSource {
    const source = new FakeSource(`source-${this.sources.length}`);
    this.sources.push(source);
    return source;
  }

  public async decodeAudioData(data: ArrayBuffer): Promise<AudioBufferLike> {
    this.decodeCalls += 1;
    const marker = new Uint8Array(data)[0];
    if (marker === 255) throw new Error("bad fixture");
    return { marker, decode: this.decodeCalls };
  }

  public async resume(): Promise<void> {
    this.resumeCalls += 1;
    this.state = "running";
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
    this.state = "closed";
  }
}

const audioManifest: readonly AudioManifestEntry[] = [
  { id: "ambient-a", category: "ambient", loop: true, base64: "AA==", mimeType: "audio/wav" },
  { id: "ambient-b", category: "ambient", loop: true, base64: "AQ==", mimeType: "audio/wav" },
  { id: "hit", category: "oneshot", loop: false, base64: "Ag==", mimeType: "audio/wav" },
  { id: "voice-a", category: "voice", loop: false, base64: "Aw==", mimeType: "audio/wav" },
  { id: "voice-b", category: "voice", loop: false, base64: "BA==", mimeType: "audio/wav" },
  { id: "heartbeat", category: "oneshot", loop: true, base64: "BQ==", mimeType: "audio/wav" },
  { id: "voice-bad", category: "voice", loop: false, base64: "/w==", mimeType: "audio/wav" },
];

const impulseManifest: readonly ImpulseManifestEntry[] = [
  { id: "ir-corridor", zone: "corridor", wet: 0.25, base64: "Bg==", mimeType: "audio/wav" },
  { id: "ir-bathroom", zone: "bathroom", wet: 0.4, base64: "Bw==", mimeType: "audio/wav" },
];

function fixture() {
  const context = new FakeContext();
  const warnings: string[] = [];
  let factoryCalls = 0;
  const engine = new AudioEngine({
    contextFactory: () => {
      factoryCalls += 1;
      return context;
    },
    warn: (message) => warnings.push(message),
    audioManifest,
    impulseManifest,
  });
  return { context, engine, warnings, factoryCalls: () => factoryCalls };
}

function lastLinear(parameter: FakeParam): Extract<ParamEvent, { kind: "linear" }> {
  const event = parameter.events.findLast(
    (candidate): candidate is Extract<ParamEvent, { kind: "linear" }> =>
      candidate.kind === "linear",
  );
  assert.ok(event);
  return event;
}

function lastSet(parameter: FakeParam): Extract<ParamEvent, { kind: "set" }> {
  const event = parameter.events.findLast(
    (candidate): candidate is Extract<ParamEvent, { kind: "set" }> =>
      candidate.kind === "set",
  );
  assert.ok(event);
  return event;
}

test("unlock is lazy, resumes in the gesture stack, preloads, and builds the fixed graph", async () => {
  const { context, engine, factoryCalls } = fixture();
  assert.equal(factoryCalls(), 0);
  assert.equal(engine.getState(), "locked");

  const unlocked = engine.unlock();
  assert.equal(factoryCalls(), 1);
  assert.equal(context.resumeCalls, 1);
  assert.equal(engine.getState(), "loading");
  await unlocked;

  assert.equal(engine.getState(), "ready");
  assert.equal(context.decodeCalls, audioManifest.length + impulseManifest.length);
  assert.equal(context.convolvers.length, 2);
  const [master, ambient, oneshot, voice, ambientDry, oneshotDry, wetA, wetB] = context.gains;
  assert.deepEqual(master.connections, [context.destination]);
  assert.deepEqual(ambient.connections, [ambientDry, ...context.convolvers]);
  assert.deepEqual(oneshot.connections, [oneshotDry, ...context.convolvers]);
  assert.deepEqual(voice.connections, [master]);
  assert.deepEqual(context.convolvers[0].connections, [wetA]);
  assert.deepEqual(context.convolvers[1].connections, [wetB]);
});

test("zone IRs alternate reusable wet slots on exact 600 ms crossfades", async () => {
  const { context, engine } = fixture();
  await engine.unlock();
  context.currentTime = 10;
  engine.setZone("corridor");
  assert.equal(lastLinear(context.gains[6].gain).time, 10 + ZONE_IR_CROSSFADE_SECONDS);
  assert.equal(lastLinear(context.gains[6].gain).value, 0.25);

  context.currentTime = 12;
  engine.setZone("bathroom");
  assert.equal(lastLinear(context.gains[7].gain).time, 12 + ZONE_IR_CROSSFADE_SECONDS);
  assert.equal(lastLinear(context.gains[7].gain).value, 0.4);
  assert.deepEqual(lastLinear(context.gains[6].gain), { kind: "linear", time: 12.6, value: 0 });
});

test("ambient beds crossfade for exactly 1200 ms", async () => {
  const { context, engine } = fixture();
  await engine.unlock();
  context.currentTime = 20;
  engine.ambient("ambient-a");
  const firstSource = context.sources[0];
  const firstBedGain = context.gains[8].gain;
  assert.deepEqual(lastLinear(firstBedGain), { kind: "linear", time: 21.2, value: 1 });

  context.currentTime = 22;
  engine.ambient("ambient-b");
  assert.deepEqual(firstSource.stops, [22 + AMBIENT_CROSSFADE_SECONDS]);
  assert.deepEqual(lastLinear(firstBedGain), { kind: "linear", time: 23.2, value: 0 });
  assert.deepEqual(lastLinear(context.gains[9].gain), { kind: "linear", time: 23.2, value: 1 });
});

test("voice ducking restores on end, error, replacement cancellation, and cleanup", async () => {
  const { context, engine } = fixture();
  await engine.unlock();
  const ambientBus = context.gains[1].gain;

  const ended = engine.say("voice-a");
  assert.equal(lastSet(ambientBus).value, VOICE_DUCK_GAIN);
  context.sources.at(-1)!.emitEnded();
  await ended;
  assert.equal(lastSet(ambientBus).value, 1);

  const errored = engine.say("voice-a");
  context.sources.at(-1)!.emitError();
  await errored;
  assert.equal(lastSet(ambientBus).value, 1);

  const cancelled = engine.say("voice-a");
  const finalVoice = engine.say("voice-b");
  await cancelled;
  assert.equal(lastSet(ambientBus).value, VOICE_DUCK_GAIN);
  engine.dispose();
  await finalVoice;
  assert.equal(lastSet(ambientBus).value, 1);
  assert.equal(context.closeCalls, 1);
});

test("missing and corrupt voice assets warn and resolve", async () => {
  const { engine, warnings } = fixture();
  await engine.unlock();
  warnings.length = 0;
  await engine.say("voice-missing");
  await engine.say("voice-bad");
  assert.ok(warnings.some((warning) => warning.includes("voice-missing") && warning.includes("missing")));
  assert.ok(warnings.some((warning) => warning.includes("voice-bad") && warning.includes("decoded")));
});

test("hidden visibility makes no cuts; visible resumes and fades the bed from zero", async () => {
  const { context, engine } = fixture();
  await engine.unlock();
  engine.ambient("ambient-a");
  const bedGain = context.gains[8].gain;
  const eventCount = bedGain.events.length;
  const resumeCalls = context.resumeCalls;
  engine.handleVisibility("hidden");
  assert.equal(bedGain.events.length, eventCount);
  assert.equal(context.resumeCalls, resumeCalls);

  context.state = "suspended";
  context.currentTime = 30;
  engine.handleVisibility("visible");
  assert.equal(context.resumeCalls, resumeCalls + 1);
  assert.ok(bedGain.events.some((event) => event.kind === "set" && event.time === 30 && event.value === 0));
  assert.deepEqual(lastLinear(bedGain), { kind: "linear", time: 31.2, value: 1 });
});

test("master gain and mute are retained before unlock and sources remain embedded-only", async () => {
  const { context, engine } = fixture();
  engine.setMaster(0.42);
  engine.mute(true);
  await engine.unlock();
  assert.equal(lastSet(context.gains[0].gain).value, 0);
  engine.mute(false);
  assert.equal(lastSet(context.gains[0].gain).value, 0.42);

  const source = readFileSync(new URL("../src/audio/engine.ts", import.meta.url), "utf8")
    + readFileSync(new URL("../src/audio/assetCodec.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|new\s+Audio\s*\(|createObjectURL|https?:\/\//);
});
test("critical heartbeat uses one looping source and stops cleanly", async () => {
  const { context, engine } = fixture();
  await engine.unlock();
  engine.heartbeat(true);
  const heartbeat = context.sources.at(-1);
  assert.ok(heartbeat);
  assert.equal(heartbeat.loop, true);
  assert.equal(heartbeat.startAt, context.currentTime);

  engine.heartbeat(true);
  assert.equal(context.sources.at(-1), heartbeat);
  engine.heartbeat(false);
  assert.equal(heartbeat.stops.length, 1);
  assert.equal(heartbeat.disconnectCalls, 1);
});

test("silence immediately stops every active source and resolves playback", async () => {
  const { context, engine } = fixture();
  await engine.unlock();

  engine.ambient("ambient-a");
  const ambient = context.sources.at(-1)!;
  const oneShotFinished = engine.play("hit");
  const oneShot = context.sources.at(-1)!;
  const voiceFinished = engine.say("voice-a");
  const voice = context.sources.at(-1)!;
  engine.heartbeat(true);
  const heartbeat = context.sources.at(-1)!;

  engine.silence();
  await Promise.all([oneShotFinished, voiceFinished]);

  for (const source of [ambient, oneShot, voice, heartbeat]) {
    assert.equal(source.stops.length, 1);
    assert.equal(source.disconnectCalls, 1);
  }

  engine.silence();
  for (const source of [ambient, oneShot, voice, heartbeat]) {
    assert.equal(source.stops.length, 1);
  }
});

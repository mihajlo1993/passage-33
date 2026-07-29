import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BED_CROSSFADE_SECONDS,
  BED_DEFINITIONS,
  BED_TENSION_RAMP_SECONDS,
  createBed,
  type BedScheduler,
} from "../src/audio/beds";
import {
  AudioEngine,
  VISIBILITY_FADE_SECONDS,
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
  BiquadFilterNodeLike,
  ConvolverNodeLike,
  GainNodeLike,
  ImpulseManifestEntry,
  OscillatorNodeLike,
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
  public readonly connections: Array<AudioNodeLike | AudioParamLike> = [];
  public disconnectCalls = 0;

  public constructor(public readonly name: string) {}
  public connect(destination: AudioNodeLike | AudioParamLike): AudioNodeLike | AudioParamLike {
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

class FakeBuffer implements AudioBufferLike {
  public readonly channels: Float32Array[];
  public constructor(channelCount: number, frameCount: number) {
    this.channels = Array.from({ length: channelCount }, () => new Float32Array(frameCount));
  }
  public getChannelData(channel: number): Float32Array {
    return this.channels[channel];
  }
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
    if (type === "error" && this.errorListener === listener) this.errorListener = null;
  }
  public emitEnded(): void {
    this.onended?.();
  }
  public emitError(): void {
    this.errorListener?.();
  }
}

class FakeOscillator extends FakeNode implements OscillatorNodeLike {
  public type: OscillatorType = "sine";
  public readonly frequency = new FakeParam();
  public readonly detune = new FakeParam();
  public onended: (() => void) | null = null;
  public startAt: number | undefined;
  public stopCalls = 0;
  public start(when?: number): void {
    this.startAt = when;
  }
  public stop(): void {
    this.stopCalls += 1;
  }
}

class FakeFilter extends FakeNode implements BiquadFilterNodeLike {
  public type: BiquadFilterType = "lowpass";
  public readonly frequency = new FakeParam();
  public readonly Q = new FakeParam();
  public readonly gain = new FakeParam();
}

class FakeContext implements AudioContextLike {
  public currentTime = 0;
  public state: AudioContextState = "suspended";
  public readonly sampleRate = 44_100;
  public readonly destination = new FakeNode("destination");
  public readonly nodes: FakeNode[] = [];
  public readonly gains: FakeGain[] = [];
  public readonly convolvers: FakeConvolver[] = [];
  public readonly sources: FakeSource[] = [];
  public readonly oscillators: FakeOscillator[] = [];
  public readonly filters: FakeFilter[] = [];
  public resumeCalls = 0;
  public closeCalls = 0;
  public decodeCalls = 0;

  private register<T extends FakeNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }
  public createGain(): FakeGain {
    const gain = this.register(new FakeGain(`gain-${this.gains.length}`));
    this.gains.push(gain);
    return gain;
  }
  public createConvolver(): FakeConvolver {
    const convolver = this.register(new FakeConvolver(`convolver-${this.convolvers.length}`));
    this.convolvers.push(convolver);
    return convolver;
  }
  public createBufferSource(): FakeSource {
    const source = this.register(new FakeSource(`source-${this.sources.length}`));
    this.sources.push(source);
    return source;
  }
  public createOscillator(): FakeOscillator {
    const oscillator = this.register(new FakeOscillator(`oscillator-${this.oscillators.length}`));
    this.oscillators.push(oscillator);
    return oscillator;
  }
  public createBiquadFilter(): FakeFilter {
    const filter = this.register(new FakeFilter(`filter-${this.filters.length}`));
    this.filters.push(filter);
    return filter;
  }
  public createBuffer(channels: number, frameCount: number): FakeBuffer {
    return new FakeBuffer(channels, frameCount);
  }
  public async decodeAudioData(data: ArrayBuffer): Promise<AudioBufferLike> {
    this.decodeCalls += 1;
    const marker = new Uint8Array(data)[0];
    if (marker === 255) throw new Error("bad fixture");
    return { marker, decode: this.decodeCalls } as AudioBufferLike;
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

class ManualScheduler implements BedScheduler {
  public readonly callbacks = new Map<number, () => void>();
  public readonly cleared: number[] = [];
  private nextId = 1;
  public readonly random = () => 0.5;
  public readonly setTimeout = (callback: () => void): number => {
    const id = this.nextId++;
    this.callbacks.set(id, callback);
    return id;
  };
  public readonly clearTimeout = (handle: unknown): void => {
    const id = Number(handle);
    this.cleared.push(id);
    this.callbacks.delete(id);
  };
}

const audioManifest: readonly AudioManifestEntry[] = [
  { id: "hit", category: "oneshot", loop: false, hex: "02", mimeType: "audio/wav", placeholder: false },
  { id: "voice-a", category: "voice", loop: false, hex: "03", mimeType: "audio/mpeg", placeholder: true },
  { id: "voice-b", category: "voice", loop: false, hex: "04", mimeType: "audio/mpeg", placeholder: false },
  { id: "heartbeat", category: "oneshot", loop: true, hex: "05", mimeType: "audio/wav", placeholder: false },
  { id: "voice-bad", category: "voice", loop: false, hex: "ff", mimeType: "audio/mpeg", placeholder: false },
];

const impulseManifest: readonly ImpulseManifestEntry[] = [
  { id: "ir-corridor", zone: "corridor", wet: 0.25, hex: "06", mimeType: "audio/wav" },
  { id: "ir-bathroom", zone: "bathroom", wet: 0.4, hex: "07", mimeType: "audio/wav" },
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
    (candidate): candidate is Extract<ParamEvent, { kind: "linear" }> => candidate.kind === "linear",
  );
  assert.ok(event);
  return event;
}

function lastSet(parameter: FakeParam): Extract<ParamEvent, { kind: "set" }> {
  const event = parameter.events.findLast(
    (candidate): candidate is Extract<ParamEvent, { kind: "set" }> => candidate.kind === "set",
  );
  assert.ok(event);
  return event;
}

test("each procedural bed has the expected graph, frequencies, complete connections, and teardown", () => {
  const expectedCounts = {
    "ambient-corridor": [14, 6],
    "ambient-bathroom": [8, 2],
    "ambient-kitchen": [17, 6],
    "ambient-balcony": [14, 5],
    "ambient-entry": [13, 5],
    "ambient-living": [13, 5],
    dead: [7, 2],
  } as const;

  for (const id of Object.keys(BED_DEFINITIONS) as Array<keyof typeof BED_DEFINITIONS>) {
    const context = new FakeContext();
    context.state = "running";
    const scheduler = new ManualScheduler();
    const bed = createBed(context, id, context.destination, { scheduler, seed: 99 });
    const snapshot = bed.debugSnapshot();
    assert.deepEqual([snapshot.nodeCount, snapshot.sourceCount], expectedCounts[id], id);
    assert.deepEqual(snapshot.toneFrequencies, BED_DEFINITIONS[id].toneHz, id);
    for (const frequency of BED_DEFINITIONS[id].filterHz) {
      assert.ok(snapshot.filterFrequencies.includes(frequency), `${id} filter ${frequency}`);
    }
    assert.ok(context.nodes.every((node) => node.connections.length > 0), `${id} has no unconnected node`);
    const constructed = [...context.nodes];
    const sources = [...context.sources, ...context.oscillators];
    bed.dispose();
    assert.ok(constructed.every((node) => node.disconnectCalls === 1), `${id} disconnects every node`);
    assert.ok(context.sources.every((source) => source.stops.length === 1), `${id} stops buffers`);
    assert.ok(context.oscillators.every((source) => source.stopCalls === 1), `${id} stops oscillators`);
    assert.equal(bed.debugSnapshot().nodeCount, 0);
    assert.equal(bed.debugSnapshot().disposed, true);
    assert.ok(sources.length > 0);
  }
});

test("bed tension ramps pitch, high partial, and swell rate over exactly four seconds", () => {
  const context = new FakeContext();
  context.state = "running";
  context.currentTime = 7;
  const bed = createBed(context, "ambient-entry", context.destination, {
    scheduler: new ManualScheduler(),
    seed: 100,
  });
  bed.setTension(1);
  assert.equal(bed.debugSnapshot().tension, 1);
  const frequencyTargets = context.oscillators.map(({ frequency }) => lastLinear(frequency).value);
  assert.ok(frequencyTargets.some((value) => Math.abs(value - 2_288) < 0.001));
  assert.ok(frequencyTargets.some((value) => Math.abs(value - 49.92) < 0.001));
  assert.ok(frequencyTargets.some((value) => Math.abs(value - 53.04) < 0.001));
  assert.ok(context.oscillators.every(({ frequency }) => lastLinear(frequency).time === 7 + BED_TENSION_RAMP_SECONDS));
  assert.ok(context.gains.some(({ gain }) =>
    gain.events.some((event) => event.kind === "linear" && event.value === 0.004),
  ));
  bed.dispose();
});

test("unlock remains lazy and preloads only compiled local bytes", async () => {
  const { context, engine, factoryCalls } = fixture();
  assert.equal(factoryCalls(), 0);
  assert.equal(engine.getState(), "locked");
  const unlocked = engine.unlock();
  assert.equal(factoryCalls(), 1);
  assert.equal(context.resumeCalls, 1);
  await unlocked;
  assert.equal(engine.getState(), "ready");
  assert.equal(
    context.decodeCalls,
    audioManifest.filter(({ category }) => category === "oneshot").length + impulseManifest.length,
  );
  assert.equal(context.convolvers.length, 2);
  assert.ok(context.gains[3].connections.includes(context.gains[0]));
  assert.ok(context.gains[3].connections.includes(context.convolvers[0]));
  assert.ok(context.gains[3].connections.includes(context.convolvers[1]));
  engine.dispose();
});

test("zone impulse and live bed switches begin together on exact 600 ms crossfades", async () => {
  const { context, engine } = fixture();
  await engine.unlock();
  context.currentTime = 10;
  const firstGainIndex = context.gains.length;
  engine.setZone("corridor");
  const firstBedOutput = context.gains[firstGainIndex].gain;
  assert.deepEqual(lastLinear(firstBedOutput), { kind: "linear", time: 10 + BED_CROSSFADE_SECONDS, value: 1 });
  assert.equal(lastLinear(context.gains[6].gain).time, 10 + ZONE_IR_CROSSFADE_SECONDS);
  assert.equal(lastLinear(context.gains[6].gain).value, 0.25);

  context.currentTime = 12;
  const secondGainIndex = context.gains.length;
  engine.setZone("bathroom");
  const secondBedOutput = context.gains[secondGainIndex].gain;
  assert.deepEqual(lastLinear(firstBedOutput), { kind: "linear", time: 12.6, value: 0 });
  assert.deepEqual(lastLinear(secondBedOutput), { kind: "linear", time: 12.6, value: 1 });
  assert.equal(lastLinear(context.gains[7].gain).value, 0.4);
  engine.dispose();
});

test("visibility resumes and fades the active bed for 1200 ms", async () => {
  const { context, engine } = fixture();
  await engine.unlock();
  const gainIndex = context.gains.length;
  engine.setZone("corridor");
  const output = context.gains[gainIndex].gain;
  const eventCount = output.events.length;
  engine.handleVisibility("hidden");
  assert.equal(output.events.length, eventCount);
  context.state = "suspended";
  context.currentTime = 30;
  engine.handleVisibility("visible");
  assert.ok(output.events.some((event) => event.kind === "set" && event.time === 30 && event.value === 0));
  assert.deepEqual(lastLinear(output), { kind: "linear", time: 30 + VISIBILITY_FADE_SECONDS, value: 1 });
  engine.dispose();
});

test("voice placeholders warn, duck, restore, replace, and resolve safely", async () => {
  const { context, engine, warnings } = fixture();
  await engine.unlock();
  warnings.length = 0;
  const first = engine.say("voice-a");
  await Promise.resolve();
  assert.ok(warnings.some((warning) => warning.includes("silent placeholder")));
  assert.equal(lastSet(context.gains[1].gain).value, VOICE_DUCK_GAIN);
  const replacement = engine.say("voice-b");
  await Promise.resolve();
  await first;
  assert.equal(lastSet(context.gains[1].gain).value, VOICE_DUCK_GAIN);
  context.sources.at(-1)!.emitEnded();
  await replacement;
  assert.equal(lastSet(context.gains[1].gain).value, 1);

  await engine.say("voice-missing");
  await engine.say("voice-bad");
  assert.ok(warnings.some((warning) => warning.includes("voice-missing") && warning.includes("missing")));
  assert.ok(warnings.some((warning) => warning.includes("voice-bad") && warning.includes("decode")));
  engine.dispose();
});

test("critical heartbeat loops once and master state survives pre-unlock changes", async () => {
  const { context, engine } = fixture();
  engine.setMaster(0.42);
  engine.mute(true);
  await engine.unlock();
  assert.equal(lastSet(context.gains[0].gain).value, 0);
  engine.mute(false);
  assert.equal(lastSet(context.gains[0].gain).value, 0.42);

  engine.heartbeat(true);
  const heartbeat = context.sources.at(-1)!;
  assert.equal(heartbeat.loop, true);
  engine.heartbeat(true);
  assert.equal(context.sources.at(-1), heartbeat);
  engine.heartbeat(false);
  assert.equal(heartbeat.stops.length, 1);
  assert.equal(heartbeat.disconnectCalls, 1);
  engine.dispose();
});

test("runtime sources contain no URL-backed playback path", () => {
  const source = readFileSync(new URL("../src/audio/engine.ts", import.meta.url), "utf8")
    + readFileSync(new URL("../src/audio/assetCodec.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(|new\s+Audio\s*\(|createObjectURL|https?:\/\//);
});

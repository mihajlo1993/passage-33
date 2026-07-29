import assert from "node:assert/strict";
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
  AudioFetchResponseLike,
  AudioFetcher,
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
  public readonly numberOfChannels: number;

  public constructor(
    channelCount: number,
    frameCount: number,
    public readonly duration = frameCount / 44_100,
    public readonly marker = 0,
  ) {
    this.numberOfChannels = channelCount;
    this.channels = Array.from({ length: channelCount }, () => new Float32Array(frameCount));
    if (marker !== 0 && this.channels[0]?.length) this.channels[0][0] = 0.25;
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
    return new FakeBuffer(1, 32, marker === 10 ? Number.NaN : 2, marker);
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

function audio(
  id: string,
  category: "oneshot" | "voice",
  marker: number,
  durationSeconds = 1,
): AudioManifestEntry {
  const extension = category === "voice" ? "mp3" : "wav";
  return {
    id,
    category,
    loop: id === "heartbeat",
    publicPath: `/audio/${category}/${id}.${extension}?marker=${marker}`.replace(`?marker=${marker}`, ""),
    mimeType: category === "voice" ? "audio/mpeg" : "audio/wav",
    durationSeconds,
  };
}

const audioManifest: readonly AudioManifestEntry[] = [
  audio("found", "oneshot", 1),
  audio("refused", "oneshot", 2),
  audio("released", "oneshot", 3),
  audio("dial-tick", "oneshot", 4),
  audio("write", "oneshot", 5),
  audio("stinger-a", "oneshot", 6),
  audio("heartbeat", "oneshot", 7),
  audio("stinger-b", "oneshot", 8),
  audio("voice-placeholder", "voice", 0, 3),
  audio("voice-a", "voice", 9, 8),
  audio("voice-b", "voice", 10, 4),
  audio("voice-bad", "voice", 255, 2),
  audio("voice-fail", "voice", 13, 2),
];

const impulseManifest: readonly ImpulseManifestEntry[] = [
  { id: "ir-corridor", zone: "corridor", wet: 0.25, publicPath: "/audio/ir/corridor.wav", mimeType: "audio/wav" },
  { id: "ir-bathroom", zone: "bathroom", wet: 0.4, publicPath: "/audio/ir/bathroom.wav", mimeType: "audio/wav" },
];

const markers = new Map<string, number>([
  ...audioManifest.map((entry, index) => [entry.publicPath, [1, 2, 3, 4, 5, 6, 7, 8, 0, 9, 10, 255, 13][index]] as const),
  ["/audio/ir/corridor.wav", 11],
  ["/audio/ir/bathroom.wav", 12],
]);

function response(marker: number): AudioFetchResponseLike {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => Uint8Array.of(marker).buffer,
  };
}

function fixture(fetcherOverride?: AudioFetcher) {
  const context = new FakeContext();
  const warnings: string[] = [];
  const fetchCalls: string[] = [];
  let factoryCalls = 0;
  const fetcher: AudioFetcher = async (publicPath) => {
    fetchCalls.push(publicPath);
    if (fetcherOverride) return fetcherOverride(publicPath);
    if (publicPath.endsWith("voice-fail.mp3")) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
    const marker = markers.get(publicPath);
    if (marker === undefined) throw new Error(`No fixture for ${publicPath}`);
    return response(marker);
  };
  const engine = new AudioEngine({
    contextFactory: () => {
      factoryCalls += 1;
      return context;
    },
    fetcher,
    warn: (message) => warnings.push(message),
    audioManifest,
    impulseManifest,
  });
  return { context, engine, warnings, fetchCalls, factoryCalls: () => factoryCalls };
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

async function flush(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
}

test("each procedural bed has the expected graph, frequencies, connections, and teardown", () => {
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
    const bed = createBed(context, id, context.destination, { scheduler: new ManualScheduler(), seed: 99 });
    const snapshot = bed.debugSnapshot();
    assert.deepEqual([snapshot.nodeCount, snapshot.sourceCount], expectedCounts[id], id);
    assert.deepEqual(snapshot.toneFrequencies, BED_DEFINITIONS[id].toneHz, id);
    for (const frequency of BED_DEFINITIONS[id].filterHz) {
      assert.ok(snapshot.filterFrequencies.includes(frequency), `${id} filter ${frequency}`);
    }
    assert.ok(context.nodes.every((node) => node.connections.length > 0), `${id} has no unconnected node`);
    const constructed = [...context.nodes];
    bed.dispose();
    assert.ok(constructed.every((node) => node.disconnectCalls === 1), `${id} disconnects every node`);
    assert.ok(context.sources.every((source) => source.stops.length === 1), `${id} stops buffers`);
    assert.ok(context.oscillators.every((source) => source.stopCalls === 1), `${id} stops oscillators`);
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

test("unlock fetches and decodes only the corridor impulse and Act I one-shots", async () => {
  const { context, engine, fetchCalls, factoryCalls } = fixture();
  assert.equal(factoryCalls(), 0);
  assert.equal(engine.getState(), "locked");
  await engine.unlock();
  assert.equal(factoryCalls(), 1);
  assert.equal(context.resumeCalls, 1);
  assert.equal(engine.getState(), "ready");
  assert.deepEqual(fetchCalls.sort(), [
    "/audio/ir/corridor.wav",
    "/audio/oneshot/dial-tick.wav",
    "/audio/oneshot/found.wav",
    "/audio/oneshot/heartbeat.wav",
    "/audio/oneshot/refused.wav",
    "/audio/oneshot/released.wav",
    "/audio/oneshot/stinger-a.wav",
    "/audio/oneshot/write.wav",
  ]);
  assert.equal(context.decodeCalls, 8);
  engine.dispose();
});

test("concurrent first use shares one fetch/decode promise", async () => {
  const { context, engine, fetchCalls } = fixture();
  await engine.unlock();
  const first = engine.play("stinger-b");
  const second = engine.play("stinger-b");
  await flush();
  assert.equal(fetchCalls.filter((path) => path.endsWith("stinger-b.wav")).length, 1);
  assert.equal(context.decodeCalls, 9);
  const sources = context.sources.filter((source) => (source.buffer as FakeBuffer | null)?.marker === 8);
  assert.equal(sources.length, 2);
  for (const source of sources) source.emitEnded();
  await Promise.all([first, second]);
  engine.dispose();
});

test("zone impulses load on first use while bed and IR use matching 600 ms crossfades", async () => {
  const { context, engine, fetchCalls } = fixture();
  await engine.unlock();
  context.currentTime = 10;
  const firstBedGainIndex = context.gains.length;
  engine.setZone("corridor");
  await flush();
  assert.equal(fetchCalls.filter((path) => path.endsWith("corridor.wav")).length, 1);
  assert.deepEqual(lastLinear(context.gains[firstBedGainIndex].gain), {
    kind: "linear",
    time: 10 + BED_CROSSFADE_SECONDS,
    value: 1,
  });
  assert.equal((context.convolvers[0].buffer as FakeBuffer).marker, 11);
  assert.equal(lastLinear(context.gains[6].gain).time, 10 + ZONE_IR_CROSSFADE_SECONDS);
  assert.equal(lastLinear(context.gains[6].gain).value, 0.25);

  context.currentTime = 12;
  const secondBedGainIndex = context.gains.length;
  engine.setZone("bathroom");
  await flush();
  assert.equal(fetchCalls.filter((path) => path.endsWith("bathroom.wav")).length, 1);
  assert.deepEqual(lastLinear(context.gains[firstBedGainIndex].gain), { kind: "linear", time: 12.6, value: 0 });
  assert.deepEqual(lastLinear(context.gains[secondBedGainIndex].gain), { kind: "linear", time: 12.6, value: 1 });
  assert.equal((context.convolvers[1].buffer as FakeBuffer).marker, 12);
  assert.equal(lastLinear(context.gains[7].gain).value, 0.4);
  engine.dispose();
});

test("voice placeholders, missing files, fetch failures, and decode failures return null without ducking", async () => {
  const { context, engine, warnings } = fixture();
  await engine.unlock();
  warnings.length = 0;
  const initialSourceCount = context.sources.length;
  assert.equal(await engine.startVoice("voice-placeholder"), null);
  assert.equal(await engine.startVoice("voice-missing"), null);
  assert.equal(await engine.startVoice("voice-fail"), null);
  assert.equal(await engine.startVoice("voice-bad"), null);
  assert.equal(context.sources.length, initialSourceCount);
  assert.equal(context.gains[1].gain.value, 1);
  assert.ok(warnings.some((warning) => warning.includes("placeholder")));
  assert.ok(warnings.some((warning) => warning.includes("voice-missing") && warning.includes("missing")));
  assert.ok(warnings.some((warning) => warning.includes("voice-fail") && warning.includes("404")));
  assert.ok(warnings.some((warning) => warning.includes("voice-bad") && warning.includes("bad fixture")));
  engine.dispose();
});

test("startVoice uses decoded duration for its live clock and natural finish", async () => {
  const { context, engine } = fixture();
  await engine.unlock();
  const handle = await engine.startVoice("voice-a");
  assert.ok(handle);
  assert.equal(handle.id, "voice-a");
  assert.equal(handle.durationSeconds, 2);
  assert.equal(handle.positionSeconds(), 0);
  assert.equal(lastSet(context.gains[1].gain).value, VOICE_DUCK_GAIN);
  context.currentTime = 1.5;
  assert.equal(handle.positionSeconds(), 1.5);
  context.sources.at(-1)!.emitEnded();
  await handle.finished;
  assert.equal(handle.positionSeconds(), 2);
  assert.equal(lastSet(context.gains[1].gain).value, 1);
  engine.dispose();
});

test("startVoice falls back to manifest duration when decoded duration is invalid", async () => {
  const { engine } = fixture();
  await engine.unlock();
  const handle = await engine.startVoice("voice-b");
  assert.ok(handle);
  assert.equal(handle.durationSeconds, 4);
  handle.stop();
  await handle.finished;
  engine.dispose();
});

test("a replacement voice finishes the old handle while keeping the bed ducked", async () => {
  const { context, engine } = fixture();
  await engine.unlock();
  context.currentTime = 10;
  const first = await engine.startVoice("voice-a");
  assert.ok(first);
  const firstSource = context.sources.at(-1)!;
  context.currentTime = 11;
  const second = await engine.startVoice("voice-b");
  assert.ok(second);
  await first.finished;
  assert.equal(firstSource.stops.length, 1);
  assert.equal(first.positionSeconds(), 1);
  assert.equal(lastSet(context.gains[1].gain).value, VOICE_DUCK_GAIN);
  second.stop();
  await second.finished;
  assert.equal(lastSet(context.gains[1].gain).value, 1);
  engine.dispose();
});

test("visibility resumes and fades the active bed for 1200 ms", async () => {
  const { context, engine } = fixture();
  await engine.unlock();
  const gainIndex = context.gains.length;
  engine.setZone("corridor");
  await flush();
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

test("heartbeat loops once and master state preserves pre-unlock changes", async () => {
  const { context, engine } = fixture();
  engine.setMaster(0.42);
  engine.mute(true);
  await engine.unlock();
  assert.equal(lastSet(context.gains[0].gain).value, 0);
  engine.mute(false);
  assert.equal(lastSet(context.gains[0].gain).value, 0.42);
  engine.heartbeat(true);
  await flush();
  const heartbeat = context.sources.at(-1)!;
  assert.equal(heartbeat.loop, true);
  engine.heartbeat(true);
  await flush();
  assert.equal(context.sources.at(-1), heartbeat);
  engine.heartbeat(false);
  assert.equal(heartbeat.stops.length, 1);
  assert.equal(heartbeat.disconnectCalls, 1);
  engine.dispose();
});

test("silence immediately stops live beds, one-shots, voice, and heartbeat", async () => {
  const { context, engine } = fixture();
  await engine.unlock();
  engine.ambient("ambient-corridor");
  const oneShotFinished = engine.play("stinger-b");
  await flush();
  const voice = await engine.startVoice("voice-a");
  assert.ok(voice);
  engine.heartbeat(true);
  await flush();
  const sources = [...context.sources];
  const oscillators = [...context.oscillators];
  assert.ok(sources.length > 3);
  engine.silence();
  await Promise.all([oneShotFinished, voice.finished]);
  assert.ok(sources.every((source) => source.stops.length === 1 && source.disconnectCalls === 1));
  assert.ok(oscillators.every((source) => source.stopCalls === 1 && source.disconnectCalls === 1));
  assert.equal(lastSet(context.gains[1].gain).value, 1);
  engine.silence();
  assert.ok(sources.every((source) => source.stops.length === 1));
  engine.dispose();
});

test("silence invalidates a voice load that completes later", async () => {
  const gate = deferred<AudioFetchResponseLike>();
  const fetchCalls: string[] = [];
  const customFetcher: AudioFetcher = async (publicPath) => {
    fetchCalls.push(publicPath);
    if (publicPath.endsWith("voice-a.mp3")) return gate.promise;
    const marker = markers.get(publicPath);
    if (marker === undefined) throw new Error(`No fixture for ${publicPath}`);
    return response(marker);
  };
  const { context, engine } = fixture(customFetcher);
  await engine.unlock();
  const pending = engine.startVoice("voice-a");
  await flush();
  assert.equal(fetchCalls.filter((path) => path.endsWith("voice-a.mp3")).length, 1);
  engine.silence();
  gate.resolve(response(9));
  assert.equal(await pending, null);
  assert.equal(context.sources.some((source) => (source.buffer as FakeBuffer | null)?.marker === 9), false);
  assert.equal(context.gains[1].gain.value, 1);
  engine.dispose();
});

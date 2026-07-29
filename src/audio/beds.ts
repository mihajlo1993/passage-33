import type { ZoneId } from "../types";
import { rampAudioParam } from "./graph";
import type {
  AmbientId,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  BiquadFilterNodeLike,
  GainNodeLike,
  OscillatorNodeLike,
} from "./types";

export const BED_CROSSFADE_SECONDS = 0.6;
export const BED_TENSION_RAMP_SECONDS = 4;
export const TENSION_FREQUENCY_MULTIPLIER = 1.04;
export const TENSION_PARTIAL_HZ = 2_200;

export interface BedDefinition {
  readonly id: AmbientId;
  readonly zone: ZoneId | "dead";
  readonly toneHz: readonly number[];
  readonly filterHz: readonly number[];
  readonly character: string;
}

export const BED_DEFINITIONS: Readonly<Record<AmbientId, BedDefinition>> = {
  "ambient-corridor": {
    id: "ambient-corridor",
    zone: "corridor",
    toneHz: [48, 51, 70],
    filterHz: [150],
    character: "Narrow pressure, a slow beat, low air, and rare creaks.",
  },
  "ambient-bathroom": {
    id: "ambient-bathroom",
    zone: "bathroom",
    toneHz: [],
    filterHz: [400, 900, 1_600],
    character: "Bright tile, low room air, and irregular drips.",
  },
  "ambient-kitchen": {
    id: "ambient-kitchen",
    zone: "kitchen",
    toneHz: [100, 200, 300],
    filterHz: [250],
    character: "A cycling refrigerator with long, reluctant silences.",
  },
  "ambient-balcony": {
    id: "ambient-balcony",
    zone: "balcony",
    toneHz: [],
    filterHz: [200, 800, 80],
    character: "Dry wind and very distant traffic.",
  },
  "ambient-entry": {
    id: "ambient-entry",
    zone: "entry",
    toneHz: [48, 51],
    filterHz: [200],
    character: "Slow interior pressure with no bright energy.",
  },
  "ambient-living": {
    id: "ambient-living",
    zone: "living",
    toneHz: [48, 51],
    filterHz: [160],
    character: "A quieter, roomier form of the entry pressure.",
  },
  dead: {
    id: "dead",
    zone: "dead",
    toneHz: [],
    filterHz: [2_000, 6_000],
    character: "Near-silent tape hiss with faint dropouts.",
  },
};

export interface BedScheduler {
  readonly random: () => number;
  readonly setTimeout: (callback: () => void, delayMs: number) => unknown;
  readonly clearTimeout: (handle: unknown) => void;
}

export interface BedDebugSnapshot {
  readonly id: AmbientId;
  readonly nodeCount: number;
  readonly sourceCount: number;
  readonly toneFrequencies: readonly number[];
  readonly filterFrequencies: readonly number[];
  readonly tension: number;
  readonly disposed: boolean;
}

export interface BedHandle {
  readonly id: AmbientId;
  readonly output: GainNodeLike;
  setTension(value: number): void;
  debugSnapshot(): BedDebugSnapshot;
  dispose(): void;
}

export interface BedFactoryOptions {
  readonly scheduler?: BedScheduler;
  readonly seed?: number;
}

type SourceNode = AudioBufferSourceNodeLike | OscillatorNodeLike;

const BED_SEEDS: Readonly<Record<AmbientId, number>> = {
  "ambient-corridor": 0x4b1d_001,
  "ambient-bathroom": 0x4b1d_002,
  "ambient-kitchen": 0x4b1d_003,
  "ambient-balcony": 0x4b1d_004,
  "ambient-entry": 0x4b1d_005,
  "ambient-living": 0x4b1d_006,
  dead: 0x4b1d_007,
};

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function defaultScheduler(random: () => number): BedScheduler {
  return {
    random,
    setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as number),
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

function safeDisconnect(node: AudioNodeLike): void {
  try {
    node.disconnect();
  } catch {
    // Teardown is deliberately idempotent.
  }
}

function safeStop(source: SourceNode): void {
  try {
    source.stop();
  } catch {
    // A scheduled source can already be stopped when a bed is replaced.
  }
}

export function createBed(
  context: AudioContextLike,
  id: AmbientId,
  destination: AudioNodeLike,
  options: BedFactoryOptions = {},
): BedHandle {
  const deterministicRandom = seededRandom(options.seed ?? BED_SEEDS[id]);
  const scheduler = options.scheduler ?? defaultScheduler(deterministicRandom);
  const nodes = new Set<AudioNodeLike>();
  const sources = new Set<SourceNode>();
  const timers = new Set<unknown>();
  const toneParams: Array<{ readonly base: number; readonly param: AudioParamLike }> = [];
  const swellParams: Array<{ readonly base: number; readonly param: AudioParamLike }> = [];
  const filterFrequencies: number[] = [];
  let partialGain: GainNodeLike | null = null;
  let disposed = false;
  let tension = 0;

  const track = <T extends AudioNodeLike>(node: T): T => {
    nodes.add(node);
    return node;
  };
  const trackSource = <T extends SourceNode>(source: T): T => {
    track(source);
    sources.add(source);
    return source;
  };
  const connect = <T extends AudioNodeLike>(
    node: T,
    target: AudioNodeLike | AudioParamLike,
  ): T => {
    node.connect(target);
    return node;
  };
  const schedule = (callback: () => void, delayMs: number): unknown => {
    let handle: unknown;
    handle = scheduler.setTimeout(() => {
      timers.delete(handle);
      if (!disposed) callback();
    }, Math.max(0, delayMs));
    timers.add(handle);
    return handle;
  };
  const randomBetween = (minimum: number, maximum: number): number =>
    minimum + (maximum - minimum) * scheduler.random();

  const output = track(context.createGain());
  output.gain.value = 1;
  connect(output, destination);

  const oscillator = (
    frequency: number,
    gainValue: number,
    target: AudioNodeLike = output,
    type: OscillatorType = "sine",
    tensionResponsive = true,
  ): { source: OscillatorNodeLike; gain: GainNodeLike } => {
    const source = trackSource(context.createOscillator());
    const gain = track(context.createGain());
    source.type = type;
    source.frequency.value = frequency;
    gain.gain.value = gainValue;
    connect(source, gain);
    connect(gain, target);
    if (tensionResponsive) toneParams.push({ base: frequency, param: source.frequency });
    source.start(context.currentTime);
    return { source, gain };
  };

  const filter = (
    type: BiquadFilterType,
    frequency: number,
    q = 0.7,
  ): BiquadFilterNodeLike => {
    const node = track(context.createBiquadFilter());
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    filterFrequencies.push(frequency);
    return node;
  };

  const noiseSource = (brown: boolean, seedOffset: number): AudioBufferSourceNodeLike => {
    const sampleRate = context.sampleRate ?? 44_100;
    const frameCount = sampleRate * 2;
    const buffer = context.createBuffer(1, frameCount, sampleRate);
    const channel = buffer.getChannelData?.(0);
    if (channel === undefined) throw new Error("Audio buffer does not expose mono samples");
    const random = seededRandom((options.seed ?? BED_SEEDS[id]) + seedOffset);
    let previous = 0;
    for (let index = 0; index < channel.length; index += 1) {
      const white = random() * 2 - 1;
      if (brown) {
        previous = (previous + 0.02 * white) / 1.02;
        channel[index] = previous * 3.2;
      } else {
        channel[index] = white;
      }
    }
    const source = trackSource(context.createBufferSource());
    source.buffer = buffer;
    source.loop = true;
    source.start(context.currentTime);
    return source;
  };

  const noiseBranch = (
    brown: boolean,
    filters: readonly BiquadFilterNodeLike[],
    gainValue: number,
    target: AudioNodeLike = output,
    seedOffset = 1,
  ): { source: AudioBufferSourceNodeLike; gain: GainNodeLike } => {
    const source = noiseSource(brown, seedOffset);
    const gain = track(context.createGain());
    gain.gain.value = gainValue;
    let previous: AudioNodeLike = source;
    for (const filterNode of filters) {
      connect(previous, filterNode);
      previous = filterNode;
    }
    connect(previous, gain);
    connect(gain, target);
    return { source, gain };
  };

  const lfo = (
    frequency: number,
    depth: number,
    target: AudioParamLike,
    tensionResponsive = false,
  ): OscillatorNodeLike => {
    const source = trackSource(context.createOscillator());
    const amount = track(context.createGain());
    source.type = "sine";
    source.frequency.value = frequency;
    amount.gain.value = depth;
    connect(source, amount);
    connect(amount, target);
    if (tensionResponsive) swellParams.push({ base: frequency, param: source.frequency });
    source.start(context.currentTime);
    return source;
  };

  const transientNoise = (
    centerHz: number,
    q: number,
    peak: number,
    durationSeconds: number,
    seedOffset: number,
  ): void => {
    const localNodes = new Set<AudioNodeLike>();
    const source = noiseSource(false, seedOffset);
    const band = filter("bandpass", centerHz, q);
    const gain = track(context.createGain());
    localNodes.add(source);
    localNodes.add(band);
    localNodes.add(gain);
    connect(source, band);
    connect(band, gain);
    connect(gain, output);
    gain.gain.value = 0;
    const now = context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.008);
    gain.gain.linearRampToValueAtTime(0, now + durationSeconds);
    schedule(() => {
      safeStop(source);
      sources.delete(source);
      for (const node of localNodes) {
        safeDisconnect(node);
        nodes.delete(node);
      }
    }, durationSeconds * 1_000 + 40);
  };

  const recur = (
    minimumSeconds: number,
    maximumSeconds: number,
    event: () => void,
  ): void => {
    schedule(() => {
      event();
      recur(minimumSeconds, maximumSeconds, event);
    }, randomBetween(minimumSeconds, maximumSeconds) * 1_000);
  };

  const highPartial = oscillator(TENSION_PARTIAL_HZ, 0, output, "sine");
  partialGain = highPartial.gain;

  switch (id) {
    case "ambient-corridor": {
      oscillator(48, 0.018);
      oscillator(51, 0.015);
      const hum = oscillator(70, 0.012);
      lfo(0.3, 0.004, hum.gain.gain);
      noiseBranch(true, [filter("lowpass", 150)], 0.006, output, 11);
      recur(20, 30, () => transientNoise(randomBetween(80, 130), 1.1, 0.006, 1.4, 101));
      break;
    }
    case "ambient-bathroom": {
      const air = noiseSource(true, 12);
      const low = filter("lowpass", 400);
      const lowGain = track(context.createGain());
      lowGain.gain.value = 0.011;
      connect(air, low);
      connect(low, lowGain);
      connect(lowGain, output);
      const tile = filter("peaking", 900, 2.4);
      tile.gain.value = 5;
      const tileGain = track(context.createGain());
      tileGain.gain.value = 0.003;
      connect(air, tile);
      connect(tile, tileGain);
      connect(tileGain, output);
      // Register the drip's defining frequency even before the first event.
      filterFrequencies.push(1_600);
      recur(4, 7, () => transientNoise(randomBetween(1_480, 1_720), 4.5, 0.026, 0.2, 102));
      break;
    }
    case "ambient-kitchen": {
      const appliance = track(context.createGain());
      appliance.gain.value = 0;
      connect(appliance, output);
      const fundamentals = [
        oscillator(100, 0.02, appliance),
        oscillator(200, 0.008, appliance),
        oscillator(300, 0.0035, appliance),
      ];
      const drift = trackSource(context.createOscillator());
      drift.type = "sine";
      drift.frequency.value = 0.045;
      for (const [index, tone] of fundamentals.entries()) {
        const depth = track(context.createGain());
        depth.gain.value = 0.35 * (index + 1);
        connect(drift, depth);
        connect(depth, tone.source.frequency);
      }
      drift.start(context.currentTime);
      noiseBranch(true, [filter("lowpass", 250)], 0.006, appliance, 13);

      const cycleOn = () => {
        const now = context.currentTime;
        rampAudioParam(appliance.gain, 1, now, 3);
        const holdSeconds = randomBetween(30, 45) / (1 + tension);
        schedule(() => {
          rampAudioParam(appliance.gain, 0.025, context.currentTime, 4);
          const silentSeconds = randomBetween(15, 25) / (1 + tension);
          schedule(cycleOn, (4 + silentSeconds) * 1_000);
        }, holdSeconds * 1_000);
      };
      cycleOn();
      break;
    }
    case "ambient-balcony": {
      const windGain = noiseBranch(
        true,
        [filter("highpass", 200), filter("lowpass", 800)],
        0.012,
        output,
        14,
      ).gain;
      lfo(1 / randomBetween(8, 15), 0.006, windGain.gain, true);
      const trafficGain = noiseBranch(
        true,
        [filter("lowpass", 80)],
        0.004,
        output,
        15,
      ).gain;
      lfo(1 / randomBetween(16, 24), 0.0025, trafficGain.gain, true);
      break;
    }
    case "ambient-entry":
    case "ambient-living": {
      const living = id === "ambient-living";
      const pressure = track(context.createGain());
      pressure.gain.value = living ? 0.78 : 0.9;
      connect(pressure, output);
      oscillator(48, living ? 0.012 : 0.015, pressure);
      oscillator(51, living ? 0.01 : 0.013, pressure);
      noiseBranch(
        true,
        [filter("lowpass", living ? 160 : 200)],
        living ? 0.004 : 0.005,
        pressure,
        living ? 17 : 16,
      );
      const period = living ? randomBetween(30, 40) : randomBetween(20, 25);
      lfo(1 / period, living ? 0.08 : 0.1, pressure.gain, true);
      break;
    }
    case "dead": {
      const hiss = noiseBranch(
        false,
        [filter("highpass", 2_000), filter("lowpass", 6_000)],
        dbToGain(-42),
        output,
        18,
      ).gain;
      recur(12, 25, () => {
        const now = context.currentTime;
        rampAudioParam(hiss.gain, dbToGain(-54), now, 0.08);
        schedule(() => rampAudioParam(hiss.gain, dbToGain(-42), context.currentTime, 0.35), 140);
      });
      break;
    }
  }

  return {
    id,
    output,
    setTension(value: number): void {
      if (disposed) return;
      tension = clamp01(value);
      const now = context.currentTime;
      for (const control of toneParams) {
        rampAudioParam(
          control.param,
          control.base * (1 + tension * (TENSION_FREQUENCY_MULTIPLIER - 1)),
          now,
          BED_TENSION_RAMP_SECONDS,
        );
      }
      for (const control of swellParams) {
        rampAudioParam(
          control.param,
          control.base * (1 + tension),
          now,
          BED_TENSION_RAMP_SECONDS,
        );
      }
      if (partialGain !== null) {
        rampAudioParam(
          partialGain.gain,
          0.004 * tension,
          now,
          BED_TENSION_RAMP_SECONDS,
        );
      }
    },
    debugSnapshot(): BedDebugSnapshot {
      return {
        id,
        nodeCount: nodes.size,
        sourceCount: sources.size,
        toneFrequencies: BED_DEFINITIONS[id].toneHz,
        filterFrequencies: [...filterFrequencies],
        tension,
        disposed,
      };
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const timer of timers) scheduler.clearTimeout(timer);
      timers.clear();
      for (const source of sources) safeStop(source);
      for (const node of nodes) safeDisconnect(node);
      sources.clear();
      nodes.clear();
    },
  };
}

import type { ZoneId } from "../types";

export type AudioCategory = "oneshot" | "voice";
export type AmbientId = `ambient-${ZoneId}` | "dead";
export type OneShotId = string;
export type VoiceId = string;

export interface AudioManifestEntry {
  readonly id: string;
  readonly category: AudioCategory;
  readonly loop: boolean;
  /** Compiled bytes keep playback independent of URLs and the network. */
  readonly hex: string | null;
  readonly mimeType: "audio/wav" | "audio/mpeg";
  readonly placeholder: boolean;
  readonly fileName?: string;
  readonly publicPath?: string;
  readonly pinId?: number;
  readonly durationSeconds?: number;
  readonly purpose?: string;
}

export interface ImpulseManifestEntry {
  readonly id: string;
  readonly zone: ZoneId;
  readonly hex: string;
  readonly mimeType: "audio/wav";
  /** Linear wet gain. Values outside 0..1 are clamped by the engine. */
  readonly wet?: number;
  readonly fileName?: string;
  readonly publicPath?: string;
}

/**
 * Deliberately small Web Audio interfaces keep the runtime injectable in Node
 * tests without introducing a URL-backed or media-element fallback.
 */
export interface AudioParamLike {
  value: number;
  cancelScheduledValues(startTime: number): AudioParamLike;
  cancelAndHoldAtTime?(cancelTime: number): AudioParamLike;
  setValueAtTime(value: number, startTime: number): AudioParamLike;
  linearRampToValueAtTime(value: number, endTime: number): AudioParamLike;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike | AudioParamLike): unknown;
  disconnect(): void;
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export interface AudioBufferLike {
  getChannelData?(channel: number): Float32Array;
}

export interface ConvolverNodeLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  normalize: boolean;
}

export interface AudioBufferSourceNodeLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  loop: boolean;
  onended: (() => void) | null;
  start(when?: number): void;
  stop(when?: number): void;
  addEventListener?(
    type: "error",
    listener: () => void,
    options?: boolean | { readonly once?: boolean },
  ): void;
  removeEventListener?(type: "error", listener: () => void): void;
}

export interface OscillatorNodeLike extends AudioNodeLike {
  type: OscillatorType;
  readonly frequency: AudioParamLike;
  readonly detune: AudioParamLike;
  onended: (() => void) | null;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface BiquadFilterNodeLike extends AudioNodeLike {
  type: BiquadFilterType;
  readonly frequency: AudioParamLike;
  readonly Q: AudioParamLike;
  readonly gain: AudioParamLike;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: AudioNodeLike;
  readonly state: AudioContextState;
  readonly sampleRate?: number;
  createGain(): GainNodeLike;
  createConvolver(): ConvolverNodeLike;
  createBufferSource(): AudioBufferSourceNodeLike;
  createOscillator(): OscillatorNodeLike;
  createBiquadFilter(): BiquadFilterNodeLike;
  createBuffer(channels: number, frameCount: number, sampleRate: number): AudioBufferLike;
  decodeAudioData(audioData: ArrayBuffer): Promise<AudioBufferLike>;
  resume(): Promise<void>;
  close?(): Promise<void>;
}

export type AudioMasterState =
  | "locked"
  | "loading"
  | "ready"
  | "suspended"
  | "error";

export interface AudioEngineOptions {
  readonly contextFactory?: () => AudioContextLike;
  readonly warn?: (message: string) => void;
  /** Optional overrides are intended for deterministic tests and tooling. */
  readonly audioManifest?: readonly AudioManifestEntry[];
  readonly impulseManifest?: readonly ImpulseManifestEntry[];
}

export interface WetSlot {
  readonly convolver: ConvolverNodeLike;
  readonly gain: GainNodeLike;
}

export interface AudioGraph {
  readonly master: GainNodeLike;
  readonly ambientBus: GainNodeLike;
  readonly oneshotBus: GainNodeLike;
  readonly voiceBus: GainNodeLike;
  readonly ambientDry: GainNodeLike;
  readonly oneshotDry: GainNodeLike;
  readonly wetSlots: readonly [WetSlot, WetSlot];
  activeWetSlot: 0 | 1 | null;
}

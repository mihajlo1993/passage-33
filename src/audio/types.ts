import type { ZoneId } from "../types";

export type AudioCategory = "ambient" | "oneshot" | "voice";
export type AmbientId = string;
export type OneShotId = string;
export type VoiceId = string;

export interface AudioManifestEntry {
  readonly id: string;
  readonly category: AudioCategory;
  readonly loop: boolean;
  readonly base64: string;
  readonly mimeType: "audio/wav";
  readonly zone?: ZoneId;
  readonly pinId?: number;
  readonly fileName?: string;
  readonly durationSeconds?: number;
  readonly purpose?: string;
}

export interface ImpulseManifestEntry {
  readonly id: string;
  readonly zone: ZoneId;
  readonly base64: string;
  readonly mimeType: "audio/wav";
  /** Linear wet gain. Values outside 0..1 are clamped by the engine. */
  readonly wet?: number;
}

/**
 * Deliberately small Web Audio interfaces keep the engine injectable in Node
 * tests without hiding any runtime network or media-element fallback.
 */
export interface AudioParamLike {
  value: number;
  cancelScheduledValues(startTime: number): AudioParamLike;
  cancelAndHoldAtTime?(cancelTime: number): AudioParamLike;
  setValueAtTime(value: number, startTime: number): AudioParamLike;
  linearRampToValueAtTime(value: number, endTime: number): AudioParamLike;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown;
  disconnect(): void;
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export type AudioBufferLike = object;

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

export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: AudioNodeLike;
  readonly state: AudioContextState;
  createGain(): GainNodeLike;
  createConvolver(): ConvolverNodeLike;
  createBufferSource(): AudioBufferSourceNodeLike;
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

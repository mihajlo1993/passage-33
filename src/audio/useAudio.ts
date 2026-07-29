"use client";

import { createContext, useContext } from "react";

import type { ZoneId } from "../types";
import type {
  AmbientId,
  OneShotId,
  VoiceId,
  VoicePlaybackHandle,
} from "./types";

export type AudioMasterState =
  | "locked"
  | "loading"
  | "ready"
  | "suspended"
  | "error";

export interface AudioMasterControls {
  unlock: () => Promise<void>;
  set: (level: number) => void;
  mute: (muted: boolean) => void;
  readonly state: AudioMasterState;
}

export interface AudioControls {
  setZone: (zone: ZoneId) => void;
  ambient: (id: AmbientId | null) => void;
  setBedTension: (value: number) => void;
  play: (id: OneShotId) => Promise<void>;
  startVoice: (id: VoiceId) => Promise<VoicePlaybackHandle | null>;
  say: (id: VoiceId) => Promise<void>;
  heartbeat: (enabled: boolean) => void;
  silence: () => void;
  master: AudioMasterControls;
}

const noopAudio: AudioControls = {
  setZone: () => undefined,
  ambient: () => undefined,
  setBedTension: () => undefined,
  play: async () => undefined,
  startVoice: async () => null,
  say: async () => undefined,
  heartbeat: () => undefined,
  silence: () => undefined,
  master: {
    unlock: async () => undefined,
    set: () => undefined,
    mute: () => undefined,
    state: "locked",
  },
};

export const AudioRuntimeContext = createContext<AudioControls>(noopAudio);

export function useAudio(): AudioControls {
  return useContext(AudioRuntimeContext);
}

export type { VoicePlaybackHandle } from "./types";

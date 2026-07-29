"use client";

import { createContext, useContext } from "react";

import type { ZoneId } from "../types";

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
  ambient: (id: string | null) => void;
  play: (id: string) => Promise<void>;
  say: (id: string) => Promise<void>;
  heartbeat: (enabled: boolean) => void;
  silence: () => void;
  master: AudioMasterControls;
}

const noopAudio: AudioControls = {
  setZone: () => undefined,
  ambient: () => undefined,
  play: async () => undefined,
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

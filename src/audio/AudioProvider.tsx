"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { AudioEngine } from "./engine";
import {
  AudioRuntimeContext,
  type AudioControls,
  type AudioMasterState,
} from "./useAudio";

export interface AudioProviderProps {
  children: ReactNode;
}

function bindControls(engine: AudioEngine): AudioControls {
  return {
    setZone: (zone) => engine.setZone(zone),
    ambient: (id) => engine.ambient(id),
    setBedTension: (value) => engine.setBedTension(value),
    play: (id) => engine.play(id),
    startVoice: (id) => engine.startVoice(id),
    say: (id) => engine.say(id),
    heartbeat: (enabled) => engine.heartbeat(enabled),
    silence: () => engine.silence(),
    master: {
      unlock: () => engine.unlock(),
      set: (level) => engine.setMaster(level),
      mute: (muted) => engine.mute(muted),
      get state(): AudioMasterState {
        return engine.getState() as AudioMasterState;
      },
    },
  };
}

export function AudioProvider({ children }: AudioProviderProps) {
  const engineRef = useRef<AudioEngine | null>(null);
  const controlsRef = useRef<AudioControls | null>(null);
  const disposeTimerRef = useRef<number | null>(null);

  if (engineRef.current === null) {
    engineRef.current = new AudioEngine();
    controlsRef.current = bindControls(engineRef.current);
  }

  useEffect(() => {
    const engine = engineRef.current!;
    if (disposeTimerRef.current !== null) {
      window.clearTimeout(disposeTimerRef.current);
      disposeTimerRef.current = null;
    }
    const handleVisibility = () => engine.handleVisibility(document.visibilityState);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      disposeTimerRef.current = window.setTimeout(() => {
        engine.dispose();
        disposeTimerRef.current = null;
      }, 0);
    };
  }, []);

  return (
    <AudioRuntimeContext.Provider value={controlsRef.current!}>
      {children}
    </AudioRuntimeContext.Provider>
  );
}

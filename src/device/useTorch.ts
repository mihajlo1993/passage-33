"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getCameraServerSnapshot,
  getCameraSnapshot,
  subscribeToCamera,
} from "./useCamera";

interface TorchCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
}

interface TorchSettings extends MediaTrackSettings {
  torch?: boolean;
}

interface TorchState {
  track: MediaStreamTrack | null;
  enabled: boolean;
  error: Error | null;
}

export interface TorchController {
  supported: boolean;
  enabled: boolean;
  error: Error | null;
  on: () => Promise<boolean>;
  off: () => Promise<boolean>;
  kill: (ms: number) => Promise<boolean>;
}

function videoTrack(stream: MediaStream | null): MediaStreamTrack | null {
  return stream?.getVideoTracks().find((track) => track.readyState === "live") ?? null;
}

function trackHasTorch(track: MediaStreamTrack | null): track is MediaStreamTrack {
  if (!track || typeof track.getCapabilities !== "function") {
    return false;
  }

  try {
    return (track.getCapabilities() as TorchCapabilities).torch === true;
  } catch {
    return false;
  }
}

async function applyTorch(track: MediaStreamTrack, enabled: boolean): Promise<void> {
  const torchConstraint = { torch: enabled } as MediaTrackConstraintSet;
  await track.applyConstraints({ advanced: [torchConstraint] });
}

function readTorchSetting(track: MediaStreamTrack | null): boolean {
  if (!track) {
    return false;
  }
  try {
    return (track.getSettings() as TorchSettings).torch === true;
  } catch {
    return false;
  }
}

/**
 * Controls the torch on a supplied stream, or on the app's shared camera stream
 * when no argument is supplied. It never requests camera access itself.
 */
export function useTorch(stream?: MediaStream | null): TorchController {
  const sharedCamera = useSyncExternalStore(
    subscribeToCamera,
    getCameraSnapshot,
    getCameraServerSnapshot,
  );
  const selectedStream = stream === undefined ? sharedCamera.stream : stream;
  const track = videoTrack(selectedStream);
  const supported = trackHasTorch(track);

  const [state, setState] = useState<TorchState>({
    track: null,
    enabled: false,
    error: null,
  });
  const enabled = state.track === track ? state.enabled : readTorchSetting(track);
  const error = state.track === track ? state.error : null;
  const desiredRef = useRef<{ track: MediaStreamTrack | null; enabled: boolean }>({
    track: null,
    enabled: false,
  });
  const killTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearKillTimer = useCallback(() => {
    if (killTimerRef.current !== null) {
      clearTimeout(killTimerRef.current);
      killTimerRef.current = null;
    }
  }, []);

  const setTorch = useCallback(async (next: boolean): Promise<boolean> => {
    if (!trackHasTorch(track)) {
      return false;
    }

    try {
      await applyTorch(track, next);
      setState({ track, enabled: next, error: null });
      return true;
    } catch (reason: unknown) {
      const nextError =
        reason instanceof Error ? reason : new Error("Unable to control the torch.");
      setState((current) => ({
        track,
        enabled: current.track === track ? current.enabled : readTorchSetting(track),
        error: nextError,
      }));
      return false;
    }
  }, [setState, track]);

  const on = useCallback(async () => {
    clearKillTimer();
    desiredRef.current = { track, enabled: true };
    return setTorch(true);
  }, [clearKillTimer, setTorch, track]);

  const off = useCallback(async () => {
    clearKillTimer();
    desiredRef.current = { track, enabled: false };
    return setTorch(false);
  }, [clearKillTimer, setTorch, track]);

  const kill = useCallback(
    async (ms: number) => {
      clearKillTimer();
      const activeTrack = track;
      if (!trackHasTorch(activeTrack)) {
        return false;
      }

      const desired = desiredRef.current;
      const shouldRestore =
        desired.track === activeTrack ? desired.enabled : enabled;
      const killed = await setTorch(false);
      if (!killed || !shouldRestore) {
        return killed;
      }

      const delay = Number.isFinite(ms) ? Math.max(0, ms) : 0;
      killTimerRef.current = setTimeout(() => {
        killTimerRef.current = null;
        const latestDesired = desiredRef.current;
        if (latestDesired.track === activeTrack && latestDesired.enabled) {
          void setTorch(true);
        }
      }, delay);
      return true;
    },
    [clearKillTimer, enabled, setTorch, track],
  );

  useEffect(() => {
    clearKillTimer();
    desiredRef.current = { track, enabled: readTorchSetting(track) };
    return () => {
      clearKillTimer();
      const desired = desiredRef.current;
      if (
        desired.track === track &&
        desired.enabled &&
        trackHasTorch(track)
      ) {
        void applyTorch(track, false).catch(() => undefined);
      }
    };
  }, [clearKillTimer, track]);

  return { supported, enabled, error, on, off, kill };
}

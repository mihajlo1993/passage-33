"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

const CONTACT_PATTERN = 400;
const FOUND_PATTERN = [60, 80, 60] as const;
const HEARTBEAT_PATTERN = [90, 700, 90, 1400] as const;
const STUTTER_PATTERN = [30, 50, 30, 120, 30] as const;
const HEARTBEAT_CYCLE_MS = HEARTBEAT_PATTERN.reduce(
  (total, duration) => total + duration,
  0,
);

const heartbeatOwners = new Set<symbol>();
const manualHeartbeatOwner = Symbol("manual-heartbeat");
let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

export interface HapticsController {
  supported: boolean;
  contact: typeof contact;
  found: typeof found;
  heartbeat: (enabled: boolean) => void;
  stutter: typeof stutter;
}

function vibrationApiAvailable(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

function vibrate(pattern: number | readonly number[]): boolean {
  if (!vibrationApiAvailable()) {
    return false;
  }

  try {
    return navigator.vibrate(
      typeof pattern === "number" ? pattern : Array.from(pattern),
    );
  } catch {
    return false;
  }
}

function clearHeartbeatTimer(): void {
  if (heartbeatTimer !== null) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function runHeartbeatCycle(): void {
  if (heartbeatOwners.size === 0) {
    clearHeartbeatTimer();
    return;
  }

  vibrate(HEARTBEAT_PATTERN);
  heartbeatTimer = setTimeout(runHeartbeatCycle, HEARTBEAT_CYCLE_MS);
}

function setHeartbeatOwner(owner: symbol, enabled: boolean): void {
  if (enabled) {
    const wasStopped = heartbeatOwners.size === 0;
    heartbeatOwners.add(owner);
    if (wasStopped && heartbeatOwners.size > 0) {
      runHeartbeatCycle();
    }
    return;
  }

  const removedActiveOwner = heartbeatOwners.delete(owner);
  if (removedActiveOwner && heartbeatOwners.size === 0) {
    clearHeartbeatTimer();
    vibrate(0);
  }
}

/** One long acknowledgement pulse. */
export function contact(): boolean {
  return vibrate(CONTACT_PATTERN);
}

/** A compact double tap used when something is found. */
export function found(): boolean {
  return vibrate(FOUND_PATTERN);
}

/** Starts or stops the repeating critical-health heartbeat. */
export function heartbeat(enabled: boolean): void {
  setHeartbeatOwner(manualHeartbeatOwner, enabled);
}

/** An irregular warning pattern. */
export function stutter(): boolean {
  return vibrate(STUTTER_PATTERN);
}

/**
 * Provides the fixed haptic vocabulary. Pass the game's `critical` boolean to
 * keep the heartbeat running only while health is below 40; it is cancelled on
 * unmount and reference-safe if more than one view happens to request it.
 */
export function useHaptics(heartbeatEnabled = false): HapticsController {
  const ownerRef = useRef<symbol | null>(null);
  if (ownerRef.current === null) {
    ownerRef.current = Symbol("heartbeat-consumer");
  }

  const setHeartbeat = useCallback((enabled: boolean) => {
    setHeartbeatOwner(ownerRef.current as symbol, enabled);
  }, []);

  useEffect(() => {
    const owner = ownerRef.current as symbol;
    setHeartbeatOwner(owner, heartbeatEnabled);
    return () => setHeartbeatOwner(owner, false);
  }, [heartbeatEnabled]);

  return useMemo(
    () => ({
      supported: vibrationApiAvailable(),
      contact,
      found,
      heartbeat: setHeartbeat,
      stutter,
    }),
    [setHeartbeat],
  );
}

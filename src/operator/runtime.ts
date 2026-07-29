import { useSyncExternalStore } from "react";

import type { ZoneId } from "../types";

export type OperatorInitializationState = "not-started" | "ready" | "error";

export interface OperatorRuntimeSnapshot {
  readonly forcedTorch: boolean | null;
  readonly audioMuted: boolean;
  readonly vhsIntensityOverride: number | null;
  readonly skipScareRevision: number;
  readonly resetRevision: number;
  readonly audioInitialization: OperatorInitializationState;
  readonly arInitialization: OperatorInitializationState;
  readonly activePin: number | null;
  readonly activeZone: ZoneId | null;
}

const INITIAL_SNAPSHOT: OperatorRuntimeSnapshot = Object.freeze({
  forcedTorch: null,
  audioMuted: false,
  vhsIntensityOverride: null,
  skipScareRevision: 0,
  resetRevision: 0,
  audioInitialization: "not-started",
  arInitialization: "not-started",
  activePin: null,
  activeZone: null,
});

let snapshot = INITIAL_SNAPSHOT;
const listeners = new Set<() => void>();
const scareSkipListeners = new Set<() => void>();
const resetListeners = new Set<() => void>();

function publish(patch: Partial<OperatorRuntimeSnapshot>): void {
  const next = Object.freeze({ ...snapshot, ...patch });
  if (
    Object.keys(patch).every(
      (key) => snapshot[key as keyof OperatorRuntimeSnapshot]
        === next[key as keyof OperatorRuntimeSnapshot],
    )
  ) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function getOperatorRuntimeSnapshot(): OperatorRuntimeSnapshot {
  return snapshot;
}

export function subscribeToOperatorRuntime(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOperatorRuntime(): OperatorRuntimeSnapshot {
  return useSyncExternalStore(
    subscribeToOperatorRuntime,
    getOperatorRuntimeSnapshot,
    () => INITIAL_SNAPSHOT,
  );
}

export function forceOperatorTorch(enabled: boolean): void {
  publish({ forcedTorch: enabled });
}

export function setOperatorAudioMuted(muted: boolean): void {
  publish({ audioMuted: muted });
}

export function setOperatorVhsIntensity(intensity: number | null): void {
  const next = intensity === null
    ? null
    : Math.max(0, Math.min(1, Number.isFinite(intensity) ? intensity : 0));
  publish({ vhsIntensityOverride: next });
}

export function reportOperatorAudioInitialization(
  status: OperatorInitializationState,
): void {
  publish({ audioInitialization: status });
}

export function reportOperatorArInitialization(
  status: OperatorInitializationState,
): void {
  publish({ arInitialization: status });
}

export function reportOperatorContext(
  activePin: number | null,
  activeZone: ZoneId | null,
): void {
  publish({ activePin, activeZone });
}

export function requestOperatorScareSkip(): void {
  publish({ skipScareRevision: snapshot.skipScareRevision + 1 });
  scareSkipListeners.forEach((listener) => listener());
}

export function subscribeToOperatorScareSkip(listener: () => void): () => void {
  scareSkipListeners.add(listener);
  return () => scareSkipListeners.delete(listener);
}

export function requestOperatorReset(): void {
  publish({ resetRevision: snapshot.resetRevision + 1 });
  resetListeners.forEach((listener) => listener());
}

export function subscribeToOperatorReset(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => resetListeners.delete(listener);
}

export function resetOperatorOverrides(): void {
  publish({
    forcedTorch: false,
    audioMuted: false,
    vhsIntensityOverride: null,
    audioInitialization: "not-started",
    arInitialization: "not-started",
    activePin: null,
    activeZone: null,
  });
}

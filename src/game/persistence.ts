import { FINAL_PRESENT_PIN_IDS, TROPHY_PIN_ID } from "../pins";
import type { GameState, HostVoiceId } from "../types";
import { deriveClearedZones } from "./engine";

export const GAME_STATE_JOURNAL_KEY = "birthday-horror:latest";

export interface GameStateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type GameStateWriteScheduler = (write: () => void) => void;

let pendingState: GameState | null = null;
let pendingStorage: GameStateStorage | null = null;
let writeScheduled = false;
let scheduleGeneration = 0;

function cloneGameState(state: GameState): GameState {
  const resolvedPins = [...state.resolvedPins];
  const playedVoiceIds = Array.isArray(state.playedVoiceIds)
    ? [...new Set(state.playedVoiceIds)].filter(
        (id): id is HostVoiceId => typeof id === "string",
      )
    : [];
  const trophyAt = state.trophyAt
    ?? (resolvedPins.includes(TROPHY_PIN_ID) ? state.finishedAt : null);
  const finalPresentsOpened = FINAL_PRESENT_PIN_IDS.every((pinId) =>
    resolvedPins.includes(pinId),
  );
  return {
    ...state,
    inventory: [...state.inventory],
    resolvedPins,
    clearedZones: deriveClearedZones(resolvedPins),
    trophyAt,
    finishedAt: finalPresentsOpened ? state.finishedAt : null,
    playedVoiceIds,
  };
}

function availableStorage(): GameStateStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function flushGameStateSynchronously(
  state: GameState,
  storage: GameStateStorage | null = availableStorage(),
): void {
  const snapshot = cloneGameState(state);
  if (!storage) return;

  try {
    storage.setItem(GAME_STATE_JOURNAL_KEY, JSON.stringify(snapshot));
  } catch {
    // A denied or full local store must not interrupt the game.
  }
}

export function loadSynchronousGameState(
  storage: GameStateStorage | null = availableStorage(),
): GameState | undefined {
  if (!storage) return undefined;

  try {
    const encoded = storage.getItem(GAME_STATE_JOURNAL_KEY);
    if (!encoded) return undefined;
    const state = JSON.parse(encoded) as GameState;
    return cloneGameState(state);
  } catch {
    return undefined;
  }
}
export async function loadGameState(): Promise<GameState | undefined> {
  return loadSynchronousGameState();
}

function cancelQueuedWrite(): void {
  scheduleGeneration += 1;
  writeScheduled = false;
}

/**
 * Retain the newest complete snapshot and defer one coalesced localStorage
 * write until the current synchronous game mutation has left the call stack.
 */
export function queueGameStateWrite(
  state: GameState,
  storage: GameStateStorage | null = availableStorage(),
  schedule: GameStateWriteScheduler = queueMicrotask,
): void {
  pendingState = cloneGameState(state);
  pendingStorage = storage;
  if (writeScheduled) return;

  writeScheduled = true;
  const generation = scheduleGeneration;
  schedule(() => {
    if (generation !== scheduleGeneration) return;
    writeScheduled = false;
    const snapshot = pendingState;
    const target = pendingStorage;
    pendingState = null;
    pendingStorage = null;
    if (snapshot) flushGameStateSynchronously(snapshot, target);
  });
}

export function persistGameStateImmediately(
  state: GameState,
  storage: GameStateStorage | null = availableStorage(),
): Promise<void> {
  cancelQueuedWrite();
  pendingState = null;
  pendingStorage = null;
  flushGameStateSynchronously(state, storage);
  return Promise.resolve();
}

export async function flushGameStateWrite(
  latestState?: GameState,
  storage: GameStateStorage | null = pendingStorage ?? availableStorage(),
): Promise<void> {
  const state = latestState ? cloneGameState(latestState) : pendingState;
  cancelQueuedWrite();
  pendingState = null;
  pendingStorage = null;
  if (state) flushGameStateSynchronously(state, storage);
}

export async function clearStoredGameState(): Promise<void> {
  cancelQueuedWrite();
  pendingState = null;
  pendingStorage = null;

  const storage = availableStorage();
  try {
    storage?.removeItem(GAME_STATE_JOURNAL_KEY);
  } catch {
    // Ignore denied local storage during reset.
  }
}

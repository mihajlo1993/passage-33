import { FINAL_PRESENT_PIN_IDS, TROPHY_PIN_ID } from "../pins";
import type { GameState } from "../types";
import { deriveClearedZones } from "./engine";

export const GAME_STATE_WRITE_DELAY_MS = 300;
export const GAME_STATE_JOURNAL_KEY = "birthday-horror:latest";

export interface GameStateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

let pendingState: GameState | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function cloneGameState(state: GameState): GameState {
  const resolvedPins = [...state.resolvedPins];
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
  pendingState = cloneGameState(state);
  if (!storage) return;

  try {
    storage.setItem(GAME_STATE_JOURNAL_KEY, JSON.stringify(pendingState));
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

/**
 * Coalesce rapid game mutations into one localStorage write 300ms after the last
 * change while always retaining the newest complete GameState snapshot.
 */
export function queueGameStateWrite(state: GameState): void {
  pendingState = cloneGameState(state);

  if (writeTimer !== null) {
    clearTimeout(writeTimer);
  }

  writeTimer = setTimeout(() => {
    writeTimer = null;
    void flushGameStateWrite();
  }, GAME_STATE_WRITE_DELAY_MS);
}


export function persistGameStateImmediately(state: GameState): Promise<void> {
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }

  flushGameStateSynchronously(state);
  pendingState = null;
  return Promise.resolve();
}

export async function flushGameStateWrite(latestState?: GameState): Promise<void> {
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }

  const state = latestState ? cloneGameState(latestState) : pendingState;
  pendingState = null;
  if (state) {
    flushGameStateSynchronously(state);
    pendingState = null;
  }
}

export async function clearStoredGameState(): Promise<void> {
  pendingState = null;
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }

  const storage = availableStorage();
  try {
    storage?.removeItem(GAME_STATE_JOURNAL_KEY);
  } catch {
    // Ignore denied local storage during reset.
  }
}

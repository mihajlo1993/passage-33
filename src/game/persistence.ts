import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { GameState } from "../types";

export const GAME_STATE_WRITE_DELAY_MS = 300;
export const GAME_STATE_RECORD_KEY = "current";
export const GAME_STATE_JOURNAL_KEY = "birthday-horror:latest";

const DATABASE_NAME = "birthday-horror";
const DATABASE_VERSION = 1;
const STORE_NAME = "game-state";

interface GameDatabase extends DBSchema {
  "game-state": {
    key: string;
    value: GameState;
  };
}
export interface GameStateStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

let databasePromise: Promise<IDBPDatabase<GameDatabase>> | null = null;
let pendingState: GameState | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

let writeSequence: Promise<void> = Promise.resolve();
function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    inventory: [...state.inventory],
    resolvedPins: [...state.resolvedPins],
    clearedZones: [...state.clearedZones],
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
async function getDatabase(): Promise<IDBPDatabase<GameDatabase> | null> {
  if (typeof indexedDB === "undefined") {
    return null;
  }

  databasePromise ??= openDB<GameDatabase>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    },
  });

  return databasePromise;
}

export async function loadGameState(): Promise<GameState | undefined> {
  const synchronousState = loadSynchronousGameState();
  if (synchronousState) return synchronousState;

  const database = await getDatabase();
  if (!database) {
    return undefined;
  }

  const state = await database.get(STORE_NAME, GAME_STATE_RECORD_KEY);
  return state ? cloneGameState(state) : undefined;
}

export async function writeGameState(state: GameState): Promise<void> {
  const database = await getDatabase();
  if (!database) {
    return;
  }

  await database.put(
    STORE_NAME,
    cloneGameState(state),
    GAME_STATE_RECORD_KEY,
  );
}

/**
 * Coalesce rapid game mutations into one IndexedDB write 300ms after the last
 * change while always retaining the newest complete GameState snapshot.
 */
export function queueGameStateWrite(state: GameState): void {
  pendingState = cloneGameState(state);

  if (writeTimer !== null) {
    clearTimeout(writeTimer);
  }

  writeTimer = setTimeout(() => {
    writeTimer = null;
    void flushGameStateWrite().catch(() => {
      // Persistence is best-effort when a browser denies IndexedDB. The latest
      // snapshot remains in memory and a later mutation will retry the write.
    });
  }, GAME_STATE_WRITE_DELAY_MS);
}


export function persistGameStateImmediately(state: GameState): Promise<void> {
  flushGameStateSynchronously(state);
  return flushGameStateWrite();
}
export async function flushGameStateWrite(latestState?: GameState): Promise<void> {
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }

  const state = pendingState;
  pendingState = null;
  if (latestState) {
    flushGameStateSynchronously(latestState);
  }


  if (state) {
    writeSequence = writeSequence.catch(() => undefined).then(() => writeGameState(state));
    await writeSequence;
  }
}

export async function clearStoredGameState(): Promise<void> {
  pendingState = null;
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }

  const database = await getDatabase();
  if (database) {
  const storage = availableStorage();
  try {
    storage?.removeItem(GAME_STATE_JOURNAL_KEY);
  } catch {
    // Ignore denied local storage during reset.
  }
    await database.delete(STORE_NAME, GAME_STATE_RECORD_KEY);
  }
}

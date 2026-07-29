"use client";

import { create } from "zustand";

import type { GameState, HostVoiceId, PinResolutionMethod } from "../types";
import {
  attemptResolvePin,
  attemptUseFirstAid,
  createDefaultGameState,
  isCritical,
  type FirstAidUseResult,
  type PinResolutionResult,
} from "./engine";
import {
  persistGameStateImmediately,
  loadGameState,
  queueGameStateWrite,
} from "./persistence";

export interface GameStore extends GameState {
  critical: boolean;
  hydrated: boolean;
  hydrating: boolean;
  lastResolution: PinResolutionResult | null;
  hydrate: () => Promise<GameState>;
  resolvePin: (pinId: number, method?: PinResolutionMethod) => PinResolutionResult;
  previewPin: (pinId: number, method?: PinResolutionMethod) => PinResolutionResult;
  claimVoice: (id: HostVoiceId) => boolean;
  useFirstAid: () => FirstAidUseResult;
  resetGame: (startedAt?: number) => GameState;
  replaceStateFromOperator: (state: GameState) => GameState;
  flushPersistence: () => Promise<void>;
}

export function selectGameState(state: GameState): GameState {
  return {
    act: state.act,
    health: state.health,
    inventory: [...state.inventory],
    resolvedPins: [...state.resolvedPins],
    clearedZones: [...state.clearedZones],
    lastSavePin: state.lastSavePin,
    startedAt: state.startedAt,
    trophyAt: state.trophyAt,
    finishedAt: state.finishedAt,
    playedVoiceIds: [...state.playedVoiceIds],
  };
}

function gameStateChanged(current: GameStore, previous: GameStore): boolean {
  return (
    current.act !== previous.act ||
    current.health !== previous.health ||
    current.inventory !== previous.inventory ||
    current.resolvedPins !== previous.resolvedPins ||
    current.clearedZones !== previous.clearedZones ||
    current.lastSavePin !== previous.lastSavePin ||
    current.startedAt !== previous.startedAt ||
    current.trophyAt !== previous.trophyAt ||
    current.finishedAt !== previous.finishedAt ||
    current.playedVoiceIds !== previous.playedVoiceIds
  );
}

const initialGameState = createDefaultGameState();
let hydrationPromise: Promise<GameState> | null = null;
let operatorMutationRevision = 0;
let sealedPresentRefusalAttempt = 0;

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialGameState,
  critical: isCritical(initialGameState.health),
  hydrated: false,
  hydrating: false,
  lastResolution: null,

  hydrate: async () => {
    if (get().hydrated) {
      return selectGameState(get());
    }

    if (hydrationPromise) {
      return hydrationPromise;
    }

    set({ hydrating: true });
    const hydrationRevision = operatorMutationRevision;
    hydrationPromise = (async () => {
      try {
        const stored = await loadGameState();
        // A production recovery mutation made during hydration must win over
        // the older local snapshot returned by that in-flight read.
        const gameState = operatorMutationRevision === hydrationRevision
          ? (stored ?? selectGameState(get()))
          : selectGameState(get());
        set({
          ...gameState,
          critical: isCritical(gameState.health),
          hydrated: true,
          hydrating: false,
          lastResolution: null,
        });
        return selectGameState(gameState);
      } catch {
        set({ hydrated: true, hydrating: false });
        return selectGameState(get());
      } finally {
        hydrationPromise = null;
      }
    })();

    return hydrationPromise;
  },

  resolvePin: (pinId, method = "scan") => {
    const result = attemptResolvePin(
      selectGameState(get()),
      pinId,
      Date.now(),
      method,
      sealedPresentRefusalAttempt,
    );

    if (!result.ok && result.reason === "sealed-present") {
      sealedPresentRefusalAttempt += 1;
    }
    if (result.ok && result.pin.kind === "sealed") {
      sealedPresentRefusalAttempt = 0;
    }

    if (result.ok) {
      set({
        ...result.state,
        critical: isCritical(result.state.health),
        lastResolution: result,
      });
    } else {
      set({ lastResolution: result });
    }

    return result;
  },

  previewPin: (pinId, method = "scan") =>
    attemptResolvePin(
      selectGameState(get()),
      pinId,
      Date.now(),
      method,
    ),

  claimVoice: (id) => {
    const current = get();
    if (current.playedVoiceIds.includes(id)) return false;

    set({
      playedVoiceIds: [...current.playedVoiceIds, id],
    });
    return true;
  },

  useFirstAid: () => {
    const result = attemptUseFirstAid(selectGameState(get()));
    if (result.ok) {
      set({
        ...result.state,
        critical: isCritical(result.state.health),
      });
    }
    return result;
  },

  resetGame: (startedAt = Date.now()) => {
    const gameState = createDefaultGameState(startedAt);
    sealedPresentRefusalAttempt = 0;
    set({
      ...gameState,
      critical: false,
      hydrated: true,
      hydrating: false,
      lastResolution: null,
    });
    return gameState;
  },

  replaceStateFromOperator: (state) => {
    const gameState = selectGameState(state);
    if (gameState.resolvedPins.length === 0) sealedPresentRefusalAttempt = 0;
    operatorMutationRevision += 1;
    set({
      ...gameState,
      critical: isCritical(gameState.health),
      hydrated: true,
      hydrating: false,
      lastResolution: null,
    });
    // Recovery changes are rare and deliberately bypass the deferred queue.
    void persistGameStateImmediately(gameState).catch(() => undefined);
    return gameState;
  },

  flushPersistence: () => persistGameStateImmediately(selectGameState(get())),
}));

// Keep persistence attached to the state boundary, including mutations made
// with Zustand's setState API outside the convenience actions above.
useGameStore.subscribe((current, previous) => {
  if (gameStateChanged(current, previous)) {
    const snapshot = selectGameState(current);
    queueGameStateWrite(snapshot);
  }
});

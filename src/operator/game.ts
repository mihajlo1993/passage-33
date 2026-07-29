import {
  areFinalPresentsResolved,
  createDefaultGameState,
  deriveAct,
  deriveClearedZones,
} from "../game/engine";
import { items } from "../items";
import { getPinById, pinRevocations, pins, TROPHY_PIN_ID } from "../pins";
import type { Act, GameState, ItemId, ZoneId } from "../types";

function uniqueItems(itemIds: readonly ItemId[]): ItemId[] {
  return Array.from(new Set(itemIds));
}

/** Resolve a known pin with its ordinary consequences but no admission checks. */
export function resolvePinForOperator(
  state: GameState,
  pinId: number,
  resolvedAt = Date.now(),
): GameState {
  const pin = getPinById(pinId);
  if (!pin || state.resolvedPins.includes(pinId)) return state;

  const revoked = new Set(pinRevocations[pinId] ?? []);
  const inventory = state.inventory.filter((itemId) => !revoked.has(itemId));
  inventory.push(...pin.grants);

  const resolvedPins = [...state.resolvedPins, pinId];
  const derivedAct = deriveAct(resolvedPins);
  const act = Math.max(state.act, derivedAct) as Act;
  const damage = Math.max(0, pin.damage ?? 0);

  return {
    ...state,
    act,
    health: Math.max(0, Math.min(100, state.health - damage)),
    inventory: uniqueItems(inventory),
    resolvedPins,
    clearedZones: deriveClearedZones(resolvedPins),
    lastSavePin: pin.kind === "save" ? pin.id : state.lastSavePin,
    trophyAt:
      pin.id === TROPHY_PIN_ID && state.trophyAt === null
        ? resolvedAt
        : state.trophyAt,
    finishedAt:
      areFinalPresentsResolved(resolvedPins) && state.finishedAt === null
        ? resolvedAt
        : state.finishedAt,
  };
}

/**
 * Remove only the resolution record and values derived from it. Inventory and
 * the explicitly selected act stay untouched so an operator does not silently
 * undo later recovery work.
 */
export function unresolvePinForOperator(
  state: GameState,
  pinId: number,
): GameState {
  const pin = getPinById(pinId);
  if (!pin || !state.resolvedPins.includes(pinId)) return state;

  const resolvedPins = state.resolvedPins.filter((id) => id !== pinId);
  const lastSavePin = state.lastSavePin === pinId
    ? [...resolvedPins]
        .reverse()
        .find((id) => getPinById(id)?.kind === "save") ?? null
    : state.lastSavePin;

  return {
    ...state,
    resolvedPins,
    clearedZones: deriveClearedZones(resolvedPins),
    lastSavePin,
    trophyAt: pin.id === TROPHY_PIN_ID ? null : state.trophyAt,
    finishedAt: areFinalPresentsResolved(resolvedPins) ? state.finishedAt : null,
  };
}

export function setItemForOperator(
  state: GameState,
  itemId: ItemId,
  held: boolean,
): GameState {
  if (!items.some((item) => item.id === itemId)) return state;

  const alreadyHeld = state.inventory.includes(itemId);
  if (held === alreadyHeld) return state;
  return {
    ...state,
    inventory: held
      ? [...state.inventory, itemId]
      : state.inventory.filter((id) => id !== itemId),
  };
}

export function setHealthForOperator(
  state: GameState,
  health: number,
): GameState {
  if (!Number.isFinite(health)) return state;
  return {
    ...state,
    health: Math.max(0, Math.min(100, Math.round(health))),
  };
}

export function setActForOperator(state: GameState, act: Act): GameState {
  return state.act === act ? state : { ...state, act };
}

export function resetGameForOperator(startedAt = Date.now()): GameState {
  return createDefaultGameState(startedAt);
}

export function currentPinForOperator(state: GameState): number | null {
  const unresolvedInAct = pins.find(
    (pin) => pin.act === state.act && !state.resolvedPins.includes(pin.id),
  );
  return unresolvedInAct?.id
    ?? pins.find((pin) => !state.resolvedPins.includes(pin.id))?.id
    ?? null;
}

export function currentZoneForOperator(state: GameState): ZoneId {
  const lastResolved = state.resolvedPins.at(-1);
  return lastResolved === undefined
    ? "corridor"
    : (getPinById(lastResolved)?.zone ?? "corridor");
}

import { FINAL_PRESENT_PIN_IDS, pinRevocations, pins } from "../pins";
import type { Act, GameState, ItemId, Pin, PinResolutionMethod, PinResolutionMode, ZoneId } from "../types";

export const CRITICAL_HEALTH_THRESHOLD = 40;

export const refusalHints = {
  unknownPin:
    "That mark is not in the ledger. The Keeper numbered everything he left behind, and he did not leave that.",
  alreadyResolved:
    "That entry is closed and signed. The ledger does not reopen what it has released. The next entry is waiting.",
  outOfAct:
    "Out of order. The locks open in the order they were sealed. The Keeper insists on it, politely, from wherever he is.",
  missingItems:
    "The entry cannot proceed. Something the ledger released is not yet in your hands. Retrace your steps.",
  missingPins:
    "An earlier entry stands open. The Keeper closed nothing out of order in thirty-three years, and tonight will not be the exception.",
  interactionRequired:
    "The mark has done its work. What follows happens at the terminal, with your hands. Paper cannot finish an entry.",
} as const;

export type PinRefusalReason =
  | "unknown-pin"
  | "already-resolved"
  | "out-of-act"
  | "missing-requirements"
  | "missing-prerequisite-pins"
  | "sealed-present"
  | "interaction-required";

export interface SuccessfulPinResolution {
  ok: true;
  status: "resolved";
  pin: Pin;
  state: GameState;
  grantedItems: ItemId[];
  revokedItems: ItemId[];
  damage: number;
  actAdvanced: boolean;
  saveTriggered: boolean;
  finished: boolean;
  gameCompleted: boolean;
}

export interface RefusedPinResolution {
  ok: false;
  status: "refused";
  pin: Pin | null;
  state: GameState;
  reason: PinRefusalReason;
  hint: string;
  missingItems: ItemId[];
  missingPins: number[];
}

export type PinResolutionResult =
  | SuccessfulPinResolution
  | RefusedPinResolution;

export interface SuccessfulFirstAidUse {
  ok: true;
  state: GameState;
  restored: number;
}

export interface RefusedFirstAidUse {
  ok: false;
  state: GameState;
  reason: "not-held";
}

export type FirstAidUseResult =
  | SuccessfulFirstAidUse
  | RefusedFirstAidUse;

const ACTS: readonly Act[] = [1, 2, 3, 4, 5];

function findPin(pinOrId: number | Pin): Pin | undefined {
  if (typeof pinOrId !== "number") {
    return pins.find((pin) => pin.id === pinOrId.id);
  }

  return pins.find((pin) => pin.id === pinOrId);
}

export function resolutionModeForPin(pin: Pin): PinResolutionMode {
  return pin.resolution ?? "scan";
}

function refusal(
  state: GameState,
  pin: Pin | null,
  reason: PinRefusalReason,
  hint: string,
  missingItems: ItemId[] = [],
  missingPins: number[] = [],
): RefusedPinResolution {
  return {
    ok: false,
    status: "refused",
    pin,
    state,
    reason,
    hint,
    missingItems,
    missingPins,
  };
}

export function createDefaultGameState(startedAt = Date.now()): GameState {
  return {
    act: 1,
    health: 100,
    inventory: [],
    resolvedPins: [],
    clearedZones: [],
    lastSavePin: null,
    startedAt,
    trophyAt: null,
    finishedAt: null,
    playedVoiceIds: [],
  };
}

export function isCritical(health: number): boolean {
  return health < CRITICAL_HEALTH_THRESHOLD;
}

export function areFinalPresentsResolved(
  resolvedPins: readonly number[],
): boolean {
  return FINAL_PRESENT_PIN_IDS.every((pinId) => resolvedPins.includes(pinId));
}

/**
 * The active act is the first act that still has unresolved pins. Act five is
 * terminal, so completing it leaves the state at act five.
 */
export function deriveAct(resolvedPins: readonly number[]): Act {
  const resolved = new Set(resolvedPins);

  for (const act of ACTS.slice(0, -1)) {
    const actPins = pins.filter((pin) => pin.act === act);
    if (actPins.some((pin) => !resolved.has(pin.id))) {
      return act;
    }
  }

  return 5;
}

/**
 * Room colours track the SEARCH, not the whole ledger: a zone reads as
 * cleared once something has been resolved there and the hunt has moved on,
 * and flips back to searching if a later stage returns to it (the living
 * room hosts stage one AND stage three). Owner call, 2026-07-30: finding
 * the first gift must visibly settle its room.
 */
export function deriveClearedZones(
  resolvedPins: readonly number[],
): ZoneId[] {
  const resolved = new Set(resolvedPins);
  const nextPin = pins.find((pin) => !resolved.has(pin.id));
  const zones = Array.from(new Set(pins.map((pin) => pin.zone)));

  return zones.filter((zone) => {
    if (zone === nextPin?.zone) return false;
    return pins.some((pin) => pin.zone === zone && resolved.has(pin.id));
  });
}

/**
 * Resolve one physical QR arrival without mutating the supplied state.
 * `resolvedAt` is explicit/deterministic so this function remains pure; the
 * store supplies the real clock for gameplay.
 */
export function attemptResolvePin(
  state: GameState,
  pinOrId: number | Pin,
  resolvedAt = state.startedAt,
  method: PinResolutionMethod = "scan",
  refusalAttempt = 0,
): PinResolutionResult {
  const pin = findPin(pinOrId);

  if (!pin) {
    return refusal(
      state,
      null,
      "unknown-pin",
      refusalHints.unknownPin,
    );
  }

  if (state.resolvedPins.includes(pin.id)) {
    return refusal(
      state,
      pin,
      "already-resolved",
      refusalHints.alreadyResolved,
    );
  }

  const earlyMissingPins = (pin.requiresPin ?? []).filter(
    (requiredPin) => !state.resolvedPins.includes(requiredPin),
  );
  const canRefuseSealedScan =
    pin.scannableFromAct !== undefined
    && state.act >= pin.scannableFromAct
    && method === "scan"
    && earlyMissingPins.length > 0;
  if (canRefuseSealedScan) {
    const variants = pin.earlyRefusals ?? [refusalHints.missingPins];
    const attempt = Number.isFinite(refusalAttempt)
      ? Math.max(0, Math.trunc(refusalAttempt))
      : 0;
    return refusal(
      state,
      pin,
      "sealed-present",
      variants[attempt % variants.length],
      [],
      earlyMissingPins,
    );
  }

  if (pin.act !== state.act) {
    return refusal(state, pin, "out-of-act", refusalHints.outOfAct);
  }

  const expectedMethod = resolutionModeForPin(pin);
  if (method !== "dev" && method !== expectedMethod) {
    return refusal(state, pin, "interaction-required", refusalHints.interactionRequired);
  }

  const missingPins = (pin.requiresPin ?? []).filter(
    (requiredPin) => !state.resolvedPins.includes(requiredPin),
  );
  const missingItems = pin.requires.filter(
    (requiredItem) => !state.inventory.includes(requiredItem),
  );

  if (missingPins.length > 0) {
    return refusal(
      state,
      pin,
      "missing-prerequisite-pins",
      pin.refusalHint ?? refusalHints.missingPins,
      missingItems,
      missingPins,
    );
  }

  if (missingItems.length > 0) {
    return refusal(
      state,
      pin,
      "missing-requirements",
      pin.refusalHint ?? refusalHints.missingItems,
      missingItems,
      missingPins,
    );
  }

  const revokedItems = [...(pinRevocations[pin.id] ?? [])];
  const inventory = state.inventory.filter(
    (itemId) => !revokedItems.includes(itemId),
  );
  const grantedItems = pin.grants.filter(
    (itemId) => !inventory.includes(itemId),
  );
  inventory.push(...grantedItems);

  const resolvedPins = [...state.resolvedPins, pin.id];
  const damage = Math.max(0, pin.damage ?? 0);
  const nextAct = deriveAct(resolvedPins);
  const finished = pin.kind === "win";
  const gameCompleted =
    areFinalPresentsResolved(resolvedPins)
    && !areFinalPresentsResolved(state.resolvedPins);

  const nextState: GameState = {
    ...state,
    act: nextAct,
    // The wish holds: winning restores her completely, which also releases
    // the critical-tier heartbeat before the warm ending.
    health: pin.kind === "win"
      ? 100
      : Math.max(0, Math.min(100, state.health - damage)),
    inventory,
    resolvedPins,
    clearedZones: deriveClearedZones(resolvedPins),
    lastSavePin: pin.kind === "save" ? pin.id : state.lastSavePin,
    trophyAt:
      finished && state.trophyAt === null ? resolvedAt : state.trophyAt,
    finishedAt:
      gameCompleted && state.finishedAt === null ? resolvedAt : state.finishedAt,
  };

  return {
    ok: true,
    status: "resolved",
    pin,
    state: nextState,
    grantedItems,
    revokedItems,
    damage,
    actAdvanced: nextAct !== state.act,
    saveTriggered: pin.kind === "save",
    finished,
    gameCompleted,
  };
}

export const SETBACK_DAMAGE = 5;

/** A failed physical attempt stings; it never blocks progress. */
export function applySetback(state: GameState, amount = SETBACK_DAMAGE): GameState {
  const damage = Math.max(0, Math.trunc(amount));
  if (damage === 0) return state;
  return { ...state, health: Math.max(0, Math.min(100, state.health - damage)) };
}

/** Restore health completely and consume exactly one first-aid item. */
export function attemptUseFirstAid(state: GameState): FirstAidUseResult {
  const firstAidIndex = state.inventory.indexOf("firstAid");

  if (firstAidIndex === -1) {
    return { ok: false, state, reason: "not-held" };
  }

  const inventory = [...state.inventory];
  inventory.splice(firstAidIndex, 1);

  return {
    ok: true,
    state: { ...state, health: 100, inventory },
    restored: 100 - state.health,
  };
}

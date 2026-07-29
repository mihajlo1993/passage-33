import { FINAL_PRESENT_PIN_IDS, pinRevocations, pins } from "../pins";
import type { Act, GameState, ItemId, Pin, PinResolutionMethod, PinResolutionMode, ZoneId } from "../types";

export const CRITICAL_HEALTH_THRESHOLD = 40;

export const refusalHints = {
  unknownPin:
    "That mark is not one of mine. The house only answers to arrangements I made personally, and I would remember making that one.",
  alreadyResolved:
    "We have already enjoyed that little moment, and it went beautifully. Forward, not back. Another room is waiting on you.",
  outOfAct:
    "Eager. I do like that. But that part of the house has not finished being arranged, and no good party shows the guest its kitchen early.",
  missingItems:
    "You have arrived without something the arrangement needs. Look again behind you. I never hide a thing without leaving its handle showing.",
  missingPins:
    "Not yet. One of my earlier arrangements is still sitting untouched, and I refuse to let you skip a single course of your own celebration.",
  interactionRequired:
    "The printed square has done its part. What happens next happens with your hands, on the mechanism I prepared. Paper cannot do everything.",
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

/** A zone clears only after every pin physically assigned to it is resolved. */
export function deriveClearedZones(
  resolvedPins: readonly number[],
): ZoneId[] {
  const resolved = new Set(resolvedPins);
  const zones = Array.from(new Set(pins.map((pin) => pin.zone)));

  return zones.filter((zone) => {
    const zonePins = pins.filter((pin) => pin.zone === zone);
    return zonePins.length > 0 && zonePins.every((pin) => resolved.has(pin.id));
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
    pin.kind === "sealed"
    && pin.scannableFromAct !== undefined
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

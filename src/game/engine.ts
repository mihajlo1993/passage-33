import { pinRevocations, pins } from "../pins";
import type { Act, GameState, ItemId, Pin, PinResolutionMethod, PinResolutionMode, ZoneId } from "../types";

export const CRITICAL_HEALTH_THRESHOLD = 40;

export const refusalHints = {
  unknownPin:
    "That invitation isn't one of mine. Nice try, birthday girl, but the house only answers to the arrangements I made.",
  alreadyResolved:
    "We've already enjoyed this little moment. Do keep up. There are still birthday surprises waiting elsewhere.",
  outOfAct:
    "Eager, aren't you? The room isn't ready for you yet. A good guest waits for her cue, especially at her own birthday party.",
  missingItems:
    "You came all this way with something important still missing. Go back and look properly. I did leave enough party favours for everyone.",
  missingPins:
    "Not yet. One of my earlier arrangements is still waiting for your attention. It would be rude to skip part of your own celebration.",
  interactionRequired:
    "That part of the arrangement is already in your hands. Use the mechanism I prepared, birthday girl. A printed square cannot do everything for you.",
} as const;

export type PinRefusalReason =
  | "unknown-pin"
  | "already-resolved"
  | "out-of-act"
  | "missing-requirements"
  | "missing-prerequisite-pins"
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
    finishedAt: null,
  };
}

export function isCritical(health: number): boolean {
  return health < CRITICAL_HEALTH_THRESHOLD;
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
      refusalHints.missingPins,
      missingItems,
      missingPins,
    );
  }

  if (missingItems.length > 0) {
    return refusal(
      state,
      pin,
      "missing-requirements",
      refusalHints.missingItems,
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

  const nextState: GameState = {
    ...state,
    act: nextAct,
    health: Math.max(0, Math.min(100, state.health - damage)),
    inventory,
    resolvedPins,
    clearedZones: deriveClearedZones(resolvedPins),
    lastSavePin: pin.kind === "save" ? pin.id : state.lastSavePin,
    finishedAt:
      finished && state.finishedAt === null ? resolvedAt : state.finishedAt,
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
  };
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

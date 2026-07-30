import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  FRAGMENTS,
  HIDING,
  KEEPER_VOICE_BY_PIN,
  NUMBER_LOCK,
  REFUSAL_LINES,
  TOTAL_PIN_COUNT,
  numberLockAnswer,
  pins,
  printablePins,
  riddleAnswerMatches,
  riddleConfigByPin,
  normaliseAnswer,
} from "../src/pins";
import { itemIds } from "../src/items";
import {
  SETBACK_DAMAGE,
  applySetback,
  attemptResolvePin,
  createDefaultGameState,
  resolutionModeForPin,
} from "../src/game/engine";
import type { GameState } from "../src/types";

function walkTo(pinId: number | null): GameState {
  let state = createDefaultGameState(1_000);
  for (const pin of pins) {
    if (pinId !== null && pin.id === pinId) break;
    const result = attemptResolvePin(state, pin.id, 1_000 + pin.id, resolutionModeForPin(pin));
    assert.equal(result.ok, true, `pin ${pin.id} must resolve during the walk`);
    state = result.state;
  }
  return state;
}

test("opening all four locks collects all four gifts and the whole letter", () => {
  let state = createDefaultGameState(1_000);
  for (const pin of pins) {
    const result = attemptResolvePin(state, pin.id, 1_000 + pin.id, resolutionModeForPin(pin));
    assert.equal(result.ok, true, `pin ${pin.id}`);
    state = result.state;
    if (pin.kind === "win") {
      assert.equal(result.finished, true);
      assert.equal(state.health, 100, "the ending heals");
    }
  }
  assert.equal(state.resolvedPins.length, TOTAL_PIN_COUNT);
  for (const gift of [itemIds.giftMat, itemIds.giftMouse, itemIds.giftSlips, itemIds.carbonator]) {
    assert.ok(state.inventory.includes(gift), gift);
  }
  for (const fragment of [itemIds.fragment01, itemIds.fragment02, itemIds.fragment03, itemIds.fragment04]) {
    assert.ok(state.inventory.includes(fragment), fragment);
  }
});

test("every stage gate refuses out of order", () => {
  for (const pin of pins.filter((candidate) => (candidate.requiresPin ?? []).length > 0)) {
    const state = walkTo(pin.id);
    for (const required of pin.requiresPin ?? []) {
      const broken: GameState = {
        ...state,
        resolvedPins: state.resolvedPins.filter((id) => id !== required),
      };
      const result = attemptResolvePin(broken, pin.id, 2_000, resolutionModeForPin(pin));
      assert.equal(result.ok, false, `pin ${pin.id} without ${required}`);
    }
  }
});

test("riddle locks reject the wrong method and there are no printed marks", () => {
  assert.equal(printablePins.length, 0);
  for (const pin of pins.filter((candidate) => candidate.resolution === "riddle")) {
    const state = walkTo(pin.id);
    const result = attemptResolvePin(state, pin.id, 2_000, "scan");
    assert.equal(result.ok, false, `pin ${pin.id} must refuse a scan`);
    assert.ok(riddleConfigByPin[pin.id], `pin ${pin.id} needs a riddle config`);
  }
});

test("the riddle matcher is forgiving and exact where it must be", () => {
  const field = riddleConfigByPin[1]!;
  assert.ok(riddleAnswerMatches(field, "Mouse Mat"));
  assert.ok(riddleAnswerMatches(field, "podloga"));
  assert.ok(!riddleAnswerMatches(field, "carpet"));

  const runner = riddleConfigByPin[3]!;
  assert.ok(riddleAnswerMatches(runner, "miška"));
  assert.ok(riddleAnswerMatches(runner, "a mouse"));
  assert.ok(!riddleAnswerMatches(runner, "rat"));

  const wager = riddleConfigByPin[5]!;
  assert.equal(numberLockAnswer(), 1999);
  assert.equal(numberLockAnswer(), NUMBER_LOCK.yearBorn + NUMBER_LOCK.dayOfNight + NUMBER_LOCK.locks);
  assert.ok(riddleAnswerMatches(wager, String(numberLockAnswer())));
  assert.ok(riddleAnswerMatches(wager, " 1,999 "));
  assert.ok(!riddleAnswerMatches(wager, "1998"));

  const sparkle = riddleConfigByPin[8]!;
  assert.ok(riddleAnswerMatches(sparkle, "AARKE"));
  assert.ok(riddleAnswerMatches(sparkle, "sparkling water"));
  assert.ok(riddleAnswerMatches(sparkle, "gazirana voda"));
  assert.ok(!riddleAnswerMatches(sparkle, "kettle"));

  assert.equal(normaliseAnswer("Miška!"), "miska");
});

test("story data is complete and clean", () => {
  assert.equal(FRAGMENTS.length, 4);
  assert.equal(Object.keys(HIDING).length, 4);
  for (const pin of pins) {
    assert.ok(pin.objective.length > 0, `pin ${pin.id} objective`);
    assert.ok(pin.bodyText.length > 0, `pin ${pin.id} bodyText`);
  }
  for (const config of Object.values(riddleConfigByPin)) {
    assert.equal(config!.hints.length, 3);
  }
  assert.ok(REFUSAL_LINES.length >= 3);
  for (const [pinId, clip] of Object.entries(KEEPER_VOICE_BY_PIN)) {
    assert.ok(pins.some((pin) => pin.id === Number(pinId)), `voice pin ${pinId}`);
    assert.ok(["intro", "lock1", "lock2", "lock3", "lock4", "dark", "refuse"].includes(clip as string));
  }
  const source = readFileSync(new URL("../src/pins.ts", import.meta.url), "utf8");
  assert.ok(!source.includes(String.fromCodePoint(0x2014)), "no em dashes");
});

test("setbacks sting, floor at zero, and never block progress", () => {
  const base = createDefaultGameState(1_000);
  assert.equal(applySetback(base).health, 100 - SETBACK_DAMAGE);
  assert.equal(applySetback({ ...base, health: 2 }).health, 0);
});

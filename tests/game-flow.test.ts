import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ADMISSION_CODE,
  CAST_WORD,
  CENSUS_ANSWERS,
  LINE_STEP,
  MAT_CELL_INDEX,
  RING_CODE,
  STAR_ANSWERS,
  STAR_STEP,
  TAG_GLYPH_INDEX,
  TILE_WORD,
  TOTAL_PIN_COUNT,
  dialConfigByPin,
  lineAt,
  musicBoxTargets,
  pins,
  printablePins,
  slipsCellIndex,
  wrapMain,
  wrapStar,
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

test("walking the whole survey closes the file", () => {
  let state = createDefaultGameState(1_000);
  for (const pin of pins) {
    const result = attemptResolvePin(state, pin.id, 1_000 + pin.id, resolutionModeForPin(pin));
    assert.equal(result.ok, true, `pin ${pin.id}`);
    state = result.state;
    if (pin.kind === "win") {
      assert.equal(result.finished, true);
      assert.equal(state.health, 100, "closing the file heals: the count completes");
    }
  }
  assert.equal(state.resolvedPins.length, TOTAL_PIN_COUNT);
  assert.ok(state.inventory.includes(itemIds.carbonator));
  assert.ok(state.inventory.includes(itemIds.giftMat));
  assert.ok(state.inventory.includes(itemIds.giftMouse));
  assert.ok(state.inventory.includes(itemIds.giftSlips));
});

test("every prerequisite gate refuses when its pin is missing", () => {
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

test("every item gate refuses without its item and never names the item id", () => {
  for (const pin of pins.filter((candidate) => candidate.requires.length > 0)) {
    const state = walkTo(pin.id);
    for (const requiredItem of pin.requires) {
      const broken: GameState = {
        ...state,
        inventory: state.inventory.filter((item) => item !== requiredItem),
      };
      const result = attemptResolvePin(broken, pin.id, 2_000, resolutionModeForPin(pin));
      assert.equal(result.ok, false, `pin ${pin.id} without ${requiredItem}`);
      if (!result.ok) {
        assert.ok(
          !result.hint.toLowerCase().includes(requiredItem.toLowerCase()),
          `pin ${pin.id} must not name ${requiredItem}`,
        );
      }
    }
  }
});

test("puzzle pins reject a bare scan; only the four marks scan", () => {
  assert.deepEqual(
    printablePins.map((pin) => pin.id),
    [1, 6, 9, 19],
    "the door, the drawer, the planter, the gift",
  );
  const scanIds = new Set(printablePins.map((pin) => pin.id));
  for (const pin of pins) {
    if (scanIds.has(pin.id)) continue;
    const state = walkTo(pin.id);
    const result = attemptResolvePin(state, pin.id, 2_000, "scan");
    assert.equal(result.ok, false, `pin ${pin.id} must refuse a scan`);
    if (!result.ok) assert.equal(result.reason, "interaction-required");
  }
});

test("the sealed final mark cycles its early refusals from act 4", () => {
  const state = walkTo(13); // act 5 not yet reached; act is 5 only after 12? walk to pin 13 start
  const fromAct4 = { ...walkTo(13), act: 4 as const };
  const first = attemptResolvePin(fromAct4, 19, 2_000, "scan", 0);
  const second = attemptResolvePin(fromAct4, 19, 2_000, "scan", 1);
  assert.equal(first.ok, false);
  assert.equal(second.ok, false);
  if (!first.ok && !second.ok) {
    assert.notEqual(first.hint, second.hint, "refusals must cycle");
  }
  assert.ok(state.resolvedPins.length > 0);
});

test("the six-line arithmetic is closed over the wrap rules", () => {
  assert.equal(LINE_STEP, 33);
  assert.equal(STAR_STEP, 3);
  for (const value of CENSUS_ANSWERS) {
    assert.ok(value >= 1 && value <= 50);
  }
  for (const star of STAR_ANSWERS) {
    assert.ok(star >= 1 && star <= 12);
  }
  assert.equal(wrapMain(50 + 1), 1);
  assert.equal(wrapStar(12 + 1), 1);
  const lineOne = lineAt(0);
  assert.deepEqual(lineOne.mains, [...CENSUS_ANSWERS].sort((a, b) => a - b));
  const lineSix = lineAt(5);
  for (const main of lineSix.mains) assert.ok(main >= 1 && main <= 50);
  for (const star of lineSix.stars) assert.ok(star >= 1 && star <= 12);
  const cell = slipsCellIndex();
  assert.ok(cell >= 1 && cell <= 16);
  const targets = musicBoxTargets();
  assert.equal(targets.length, 5);
  for (const target of targets) assert.ok(target >= 0 && target <= 11);
});

test("setup constants are printable and coherent", () => {
  assert.match(ADMISSION_CODE, /^\d{4}$/);
  assert.match(TILE_WORD, /^[A-Z]{4}$/);
  assert.match(CAST_WORD, /^[A-Z]{3}$/);
  assert.match(RING_CODE, /^\d{6}$/);
  assert.ok(TAG_GLYPH_INDEX >= 1 && TAG_GLYPH_INDEX <= 16);
  assert.ok(MAT_CELL_INDEX >= 1 && MAT_CELL_INDEX <= 16);
  // Every dial pin has a config whose value matches its declared kind.
  for (const pin of pins.filter((candidate) => candidate.resolution === "dial")) {
    const config = dialConfigByPin[pin.id];
    assert.ok(config, `dial pin ${pin.id} needs a config`);
    if (config) {
      assert.ok(config.hints.length >= 2, `dial pin ${pin.id} needs a hint ladder`);
      if (config.kind === "numeric") assert.match(config.value, /^\d+$/);
      else assert.match(config.value, /^[A-Z]+$/);
    }
  }
});

test("setbacks sting, floor at zero, and never block progress", () => {
  const base = createDefaultGameState(1_000);
  assert.equal(applySetback(base).health, 100 - SETBACK_DAMAGE);
  assert.equal(applySetback({ ...base, health: 2 }).health, 0);
  assert.equal(applySetback({ ...base, health: 50 }, 0).health, 50);
});

test("every pin carries an objective and an entry, and no text uses an em dash", () => {
  for (const pin of pins) {
    assert.ok(pin.objective.length > 0, `pin ${pin.id} objective`);
    assert.ok(pin.bodyText.length > 0, `pin ${pin.id} bodyText`);
    assert.ok(!pin.objective.includes("—"), `pin ${pin.id} objective em dash`);
    assert.ok(!pin.bodyText.includes("—"), `pin ${pin.id} bodyText em dash`);
  }
  const source = readFileSync(new URL("../src/pins.ts", import.meta.url), "utf8");
  assert.ok(!source.includes("—"));
});

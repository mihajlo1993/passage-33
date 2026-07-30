import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { numberLockAnswer, riddleConfigByPin } from "../src/pins";
import {
  SPARKLE_NAMEPLATES,
  SPARKLE_SHUTTERS,
  sparkleStatementIsTrue,
} from "../src/components/WitnessPuzzles";

const root = new URL("..", import.meta.url);

/**
 * The witness puzzle contract: locks II, III and IV are played on the 3D
 * artifact with explicit deterministic taps. Lock I stays a typed riddle.
 * Nothing may gate on camera angles and nothing may hard-stall.
 */

test("lock I is a typed riddle; locks II, III, IV are witness puzzles", () => {
  assert.equal(riddleConfigByPin[1]!.puzzle, undefined);
  assert.equal(riddleConfigByPin[3]!.puzzle?.kind, "clicks");
  assert.equal(riddleConfigByPin[5]!.puzzle?.kind, "sum");
  assert.equal(riddleConfigByPin[8]!.puzzle?.kind, "testimony");
});

test("the runner's click pattern is playable and matches its own story", () => {
  const puzzle = riddleConfigByPin[3]!.puzzle;
  assert.ok(puzzle?.kind === "clicks");
  const pattern = puzzle.pattern;
  assert.ok(pattern.length >= 4 && pattern.length <= 7, "pattern must be short enough to enjoy");
  for (const stepId of pattern) assert.match(stepId, /^[LWR]$/);
  // one left for the open lock, a right for each waiting lock, the wheel last
  assert.deepEqual([...pattern], ["L", "R", "R", "R", "W"]);
  const instruction = riddleConfigByPin[3]!.riddle;
  assert.match(instruction, /left shoulder/i);
  assert.match(instruction, /wheel/i);
});

test("the wager's wheels take exactly the engraved sum", () => {
  assert.equal(numberLockAnswer(), 1999);
  const config = riddleConfigByPin[5]!;
  assert.ok(config.numeric, "typed fallback data stays numeric");
  assert.match(config.hints[2], /1 9 9 9/);
});

test("the sparkle witness must testify truthfully before it can be named", () => {
  const puzzle = riddleConfigByPin[8]!.puzzle;
  assert.ok(puzzle?.kind === "testimony");
  assert.deepEqual(
    SPARKLE_SHUTTERS.map((shutter) => shutter.answer),
    ["STILL WATER", "SILVER BREATH", "STARS"],
  );
  for (const shutter of SPARKLE_SHUTTERS) {
    assert.equal(shutter.options[shutter.correctIndex], shutter.answer);
  }
  const truthful = SPARKLE_SHUTTERS.map((shutter) => shutter.correctIndex);
  assert.equal(sparkleStatementIsTrue(truthful), true);
  assert.equal(sparkleStatementIsTrue([0, 0, 0]), false);
  assert.ok(SPARKLE_NAMEPLATES.includes("CARBONATOR"));
  const config = riddleConfigByPin[8]!;
  assert.match(config.riddle, /under oath/i);
  assert.match(config.hints[2], /STILL WATER.*SILVER BREATH.*STARS.*CARBONATOR/i);
});

test("puzzles never watch the camera and never hard-stall", () => {
  const source = readFileSync(new URL("src/components/WitnessPuzzles.tsx", root), "utf8");
  assert.doesNotMatch(source, /camera-change/, "no camera watching");
  assert.doesNotMatch(source, /getCameraOrbit/, "no orbit-angle gating");
  assert.doesNotMatch(source, /pointermove|touchmove/, "no gesture math");
  assert.match(source, /puzzle-fallback/, "a lost model degrades to plain buttons");
  assert.match(source, /addEventListener\("error", handleModelError\)/, "model failure uses a native listener");
  assert.match(source, /is-next/, "the third hint glows the next correct touch");
  assert.match(source, /statementAccepted/, "the last witness must pass before it can be named");
  for (const pinId of [3, 5, 8] as const) {
    assert.equal(riddleConfigByPin[pinId]!.hints.length, 3);
  }
});

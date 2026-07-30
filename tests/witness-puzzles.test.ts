import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { numberLockAnswer, riddleConfigByPin } from "../src/pins";
import { starAnchor } from "../src/components/WitnessPuzzles";

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
  assert.equal(riddleConfigByPin[8]!.puzzle?.kind, "stars");
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
  assert.equal(numberLockAnswer(), 2028);
  const config = riddleConfigByPin[5]!;
  assert.ok(config.numeric, "typed fallback data stays numeric");
  assert.match(config.hints[2], /2 0 2 8/);
});

test("the star ladder counts exactly the stars the witness carries", () => {
  const puzzle = riddleConfigByPin[8]!.puzzle;
  assert.ok(puzzle?.kind === "stars");
  assert.equal(puzzle.count, 7, "scripts/build-witnesses.mjs casts seven rising stars");
  // anchors rise strictly with index, from the vessel's mouth upward
  let previous = -Infinity;
  for (let index = 0; index < puzzle.count; index += 1) {
    const anchor = starAnchor(index);
    assert.ok(anchor.y > previous, `star ${index} must sit higher than the one before`);
    previous = anchor.y;
  }
});

test("puzzles never watch the camera and never hard-stall", () => {
  const source = readFileSync(new URL("src/components/WitnessPuzzles.tsx", root), "utf8");
  assert.doesNotMatch(source, /camera-change/, "no camera watching");
  assert.doesNotMatch(source, /getCameraOrbit/, "no orbit-angle gating");
  assert.match(source, /puzzle-fallback/, "a lost model degrades to plain buttons");
  assert.match(source, /is-next/, "the third hint glows the next correct touch");
  for (const pinId of [3, 5, 8] as const) {
    assert.equal(riddleConfigByPin[pinId]!.hints.length, 3);
  }
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { numberLockAnswer, riddleAnswerMatches, riddleConfigByPin } from "../src/pins";
import {
  SPARKLE_STAR_COUNT,
  SPARKLE_STARS_MS,
  SPARKLE_VERBS,
  sparkleStatementComplete,
} from "../src/components/WitnessPuzzles";

const root = new URL("..", import.meta.url);

/**
 * The witness puzzle contract: locks II, III and IV are played on the 3D
 * artifact with explicit deterministic touches. Locks I and IV end at a
 * typed answer on the same forgiving matcher. Nothing may gate on camera
 * angles and nothing may hard-stall.
 */

test("lock I is a typed riddle; locks II, III, IV are witness puzzles", () => {
  assert.equal(riddleConfigByPin[1]!.puzzle, undefined);
  assert.equal(riddleConfigByPin[3]!.puzzle?.kind, "clicks");
  assert.equal(riddleConfigByPin[5]!.puzzle?.kind, "sum");
  assert.equal(riddleConfigByPin[8]!.puzzle?.kind, "verbs");
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

test("the three verbs run POUR, CHARGE, RELEASE and discover the statement", () => {
  const puzzle = riddleConfigByPin[8]!.puzzle;
  assert.ok(puzzle?.kind === "verbs");
  assert.deepEqual(
    SPARKLE_VERBS.map((verb) => verb.verb),
    ["POUR", "CHARGE", "RELEASE"],
  );
  assert.deepEqual(
    SPARKLE_VERBS.map((verb) => verb.reveals),
    ["STILL WATER", "SILVER BREATH", "STARS"],
  );
  // POUR fills over two seconds; CHARGE builds for two and a half; RELEASE
  // is a single tap.
  assert.deepEqual(
    SPARKLE_VERBS.map((verb) => [verb.kind, verb.holdMs]),
    [["hold", 2_000], ["hold", 2_500], ["tap", 0]],
  );
  // Thirty-three stars rise for three seconds. Of course thirty-three.
  assert.equal(SPARKLE_STAR_COUNT, 33);
  assert.equal(SPARKLE_STARS_MS, 3_000);
  assert.equal(sparkleStatementComplete(2), false);
  assert.equal(sparkleStatementComplete(3), true);
});

test("lock IV ends at a typed name on lock I's matcher contract", () => {
  const config = riddleConfigByPin[8]!;
  assert.ok(riddleAnswerMatches(config, "carbonator"));
  assert.ok(riddleAnswerMatches(config, "AARKE"));
  assert.ok(riddleAnswerMatches(config, "sparkling water"));
  assert.ok(!riddleAnswerMatches(config, "kettle"));
  assert.match(config.riddle, /under oath/i);
  // The third hint names it outright: no hard-stall is possible.
  assert.match(config.hints[2], /POUR.*CHARGE.*RELEASE.*CARBONATOR/i);
});

test("puzzles never watch the camera and never hard-stall", () => {
  const shared = readFileSync(new URL("src/components/WitnessPuzzles.tsx", root), "utf8");
  const verbs = readFileSync(new URL("src/components/SparkleVerbs.tsx", root), "utf8");
  for (const source of [shared, verbs]) {
    assert.doesNotMatch(source, /camera-change/, "no camera watching");
    assert.doesNotMatch(source, /getCameraOrbit/, "no orbit-angle gating");
    assert.doesNotMatch(source, /pointermove|touchmove/, "no gesture math");
    assert.match(source, /is-next/, "the third hint glows the next correct touch");
  }
  assert.match(shared, /puzzle-fallback/, "a lost model degrades to plain buttons");
  assert.match(shared, /addEventListener\("error", handleModelError\)/, "model failure uses a native listener");
  assert.match(verbs, /releaseHold/, "releasing a held verb early resets silently");
  assert.match(verbs, /sparkleStatementComplete/, "the statement must complete before naming");
  assert.doesNotMatch(verbs, /SPARKLE_NAMEPLATES|statementAccepted/, "the nameplate flow is gone");
  for (const pinId of [3, 5, 8] as const) {
    assert.equal(riddleConfigByPin[pinId]!.hints.length, 3);
  }
});

test("lock IV is a legible panel, never hotspots hunted on the model", () => {
  const verbs = readFileSync(new URL("src/components/SparkleVerbs.tsx", root), "utf8");
  // The witness is a clean centerpiece; the work happens on the panel.
  assert.match(verbs, /apparatus-panel/);
  assert.match(verbs, /autoRotate/);
  assert.doesNotMatch(verbs, /slot=|data-position|witness-hotspot/, "no 3D hotspots on lock IV");
  // Every station is always visible and out-of-order touches explain WHY.
  assert.match(verbs, /SPARKLE_ORDER_LINES/);
  assert.match(verbs, /chargeBeforePour/);
  assert.match(verbs, /releaseBeforePour/);
  assert.match(verbs, /releaseBeforeCharge/);
  // The name clue ladder: suggestions after two misses, near-answer after three.
  assert.match(verbs, /nameAttempts >= 2/);
  assert.match(verbs, /nameAttempts >= 3/);
  assert.match(verbs, /It makes your bottle sparkle\./);
});

test("the apparatus answers to the plain names too", () => {
  const config = riddleConfigByPin[8]!;
  for (const accepted of [
    "carbonator", "soda", "sodastream", "bubbles", "fizzy", "bubbly",
    "sparkle", "sparkles", "sparkling water", "soda machine", "fizzy water",
    "mehurcki", "gazirana voda",
  ]) {
    assert.ok(riddleAnswerMatches(config, accepted), accepted);
  }
  assert.ok(!riddleAnswerMatches(config, "kettle"));
  assert.ok(!riddleAnswerMatches(config, "decanter"));
});

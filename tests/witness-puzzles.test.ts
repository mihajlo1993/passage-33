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
import {
  SPARKLE_FLOAT_HEIGHTS_M,
  SPARKLE_FLOAT_RADIUS_M,
  floatingStationPlacements,
  shuffledStationOrder,
} from "../src/components/SparkleVerbs";

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
  // The wheel is the discovery: the story says it hides beneath.
  assert.match(instruction, /beneath/i);
});

test("the wheel control hides on the runner's underside until she looks", () => {
  const shared = readFileSync(new URL("src/components/WitnessPuzzles.tsx", root), "utf8");
  const css = readFileSync(new URL("src/styles/puzzles.css", root), "utf8");
  // Downward anchor under the base; model-viewer stamps data-visible only
  // while that faces the camera. No camera-angle reads anywhere.
  assert.match(shared, /W: \{ position: "0 -0\.002 0", normal: "0 -1 0"/);
  assert.match(shared, /data-visibility-attribute=\{id === "W" \? "visible" : undefined\}/);
  assert.match(css, /\.witness-hotspot--under:not\(\[data-visible\]\)\s*\{[^}]*opacity:\s*0[^}]*pointer-events:\s*none/);
  // The third hint sends her underneath, so no hard-stall is possible.
  assert.match(riddleConfigByPin[3]!.hints[2], /over[\s\S]*underside/i);
});

test("the apparatus stations hang jumbled, never in the giveaway order", () => {
  // Deterministic RNGs cover the corner cases; identity is impossible.
  const identityLeaning = shuffledStationOrder(() => 0.999999);
  assert.deepEqual([...identityLeaning].sort(), [0, 1, 2]);
  assert.ok(!identityLeaning.every((value, index) => value === index));

  const lowRng = shuffledStationOrder(() => 0);
  assert.deepEqual([...lowRng].sort(), [0, 1, 2]);
  assert.ok(!lowRng.every((value, index) => value === index));

  let seed = 42;
  const lcg = () => {
    seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return seed / 4_294_967_296;
  };
  for (let round = 0; round < 50; round += 1) {
    const order = shuffledStationOrder(lcg);
    assert.deepEqual([...order].sort(), [0, 1, 2], "always a full permutation");
    assert.ok(
      !order.every((value, index) => value === index),
      "never pour/charge/release left to right",
    );
  }
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
  // All three are holds of a few seconds: POUR two, CHARGE two and a
  // half, RELEASE two. Only when all three complete does the name appear.
  assert.deepEqual(
    SPARKLE_VERBS.map((verb) => [verb.kind, verb.holdMs]),
    [["hold", 2_000], ["hold", 2_500], ["hold", 2_000]],
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

test("lock IV hangs its hold-stations around the centerpiece, never ON it", () => {
  const verbs = readFileSync(new URL("src/components/SparkleVerbs.tsx", root), "utf8");
  // Floating stations anchored around the witness, hung fresh per visit.
  assert.match(verbs, /floatingStationPlacements\(Math\.random\)/);
  assert.match(verbs, /sparkle-float/);
  assert.match(verbs, /slot=\{`hotspot-float-/);
  // Nothing hides ON the model itself for this lock.
  assert.doesNotMatch(verbs, /witness-hotspot/, "the floats are their own control, not model hotspots");
  // The plain jumbled panel survives as the lost-model fallback.
  assert.match(verbs, /puzzle-fallback/);
  assert.match(verbs, /shuffledStationOrder\(Math\.random\)/);
  // Out-of-order touches explain WHY; only completion reveals the name.
  assert.match(verbs, /SPARKLE_ORDER_LINES/);
  assert.match(verbs, /chargeBeforePour/);
  assert.match(verbs, /releaseBeforePour/);
  assert.match(verbs, /releaseBeforeCharge/);
  // The name clue ladder: suggestions after two misses, near-answer after three.
  assert.match(verbs, /nameAttempts >= 2/);
  assert.match(verbs, /nameAttempts >= 3/);
  assert.match(verbs, /It makes your bottle sparkle\./);
});

test("the floating ring is a fair permutation clear of the witness", () => {
  let seed = 7;
  const lcg = () => {
    seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return seed / 4_294_967_296;
  };
  for (let round = 0; round < 25; round += 1) {
    const placements = floatingStationPlacements(lcg);
    assert.equal(placements.length, 3);
    const heights = placements.map((p) => Number(p.position.split(" ")[1]));
    // Each station takes a distinct slot height: a full permutation.
    assert.deepEqual(
      [...heights].sort((a, b) => a - b),
      [...SPARKLE_FLOAT_HEIGHTS_M],
    );
    const azimuths: number[] = [];
    for (const p of placements) {
      const [x, , z] = p.position.split(" ").map(Number);
      // Every station floats on the ring, clear of the bronze.
      assert.ok(Math.abs(Math.hypot(x, z) - SPARKLE_FLOAT_RADIUS_M) < 0.001);
      azimuths.push(((Math.atan2(x, z) * 180) / Math.PI + 360) % 360);
    }
    // The spokes stand 120 degrees apart, whatever the random spin.
    const sorted = azimuths.slice().sort((a, b) => a - b);
    const gaps = [
      sorted[1] - sorted[0],
      sorted[2] - sorted[1],
      360 - sorted[2] + sorted[0],
    ];
    for (const gap of gaps) assert.ok(Math.abs(gap - 120) < 1.5, String(gap));
  }
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

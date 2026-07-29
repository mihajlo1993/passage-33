import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { motion } from "../src/tokens";
import {
  TAPE_FINAL_STILL_INDEX,
  TAPE_STILLS,
  canUserSkipTape,
  createTapePlaybackState,
  formatTapeTimecode,
  transitionTapePlayback,
} from "../src/media/tape";

test("tape cannot complete on mount or before final hold and blackout", () => {
  let state = createTapePlaybackState();
  assert.deepEqual(state, { phase: "playing", stillIndex: 0 });

  for (let cut = 0; cut < TAPE_FINAL_STILL_INDEX; cut += 1) {
    state = transitionTapePlayback(state, "timer");
    assert.equal(state.phase, "playing");
  }
  assert.equal(state.stillIndex, TAPE_FINAL_STILL_INDEX);

  state = transitionTapePlayback(state, "timer");
  assert.equal(state.phase, "blackout");
  state = transitionTapePlayback(state, "timer");
  assert.equal(state.phase, "complete");
});

test("viewer skip appears only after the third still and still holds on LOSER", () => {
  let state = createTapePlaybackState();
  state = transitionTapePlayback(state, "timer");
  state = transitionTapePlayback(state, "timer");
  assert.equal(state.stillIndex, 2);
  assert.equal(canUserSkipTape(state), false);
  assert.equal(transitionTapePlayback(state, "user-skip"), state);

  state = transitionTapePlayback(state, "timer");
  assert.equal(canUserSkipTape(state), true);
  state = transitionTapePlayback(state, "user-skip");
  assert.deepEqual(state, { phase: "playing", stillIndex: TAPE_FINAL_STILL_INDEX });
  assert.equal(TAPE_STILLS[state.stillIndex]?.assetId, "tape07");
  assert.equal(state.phase, "playing");
});

test("all still durations meet the brief and the final reveal is longest", () => {
  const ordinary = TAPE_STILLS.slice(0, -1).map((still) => still.durationMs);
  assert.ok(ordinary.every((duration) => duration >= 4000 && duration <= 6000));
  assert.ok(TAPE_STILLS[TAPE_FINAL_STILL_INDEX]!.durationMs > Math.max(...ordinary));
  assert.deepEqual(TAPE_STILLS.map((still) => still.durationMs), [...motion.tape.stillDurationsMs]);
  assert.equal(formatTapeTimecode(3723), "00:00:03:21");
});

test("screen forces VHS, uses local picture fallbacks, and resolves only at complete phase", () => {
  const source = readFileSync("src/components/TapePlaybackScreen.tsx", "utf8");
  const css = readFileSync("src/styles/tape.css", "utf8");
  assert.match(source, /setIntensity\(effects\.tape\.forcedVhsIntensity\)/);
  assert.match(source, /vhs\.dropFrames\(motion\.tape\.headSwitchMs\)/);
  assert.match(source, /audio\.play\("ui-contact"\)/);
  assert.match(source, /state\.phase !== "complete"/);
  assert.match(source, /Promise\.resolve\(\)\.then\(onComplete\)/);
  assert.match(source, /latestHealthRef\.current/);
  assert.doesNotMatch(source, /\[audio, health, vhs\]/);
  assert.match(source, /<source srcSet=\{asset\.webp\.url\} type="image\/webp"/);
  assert.match(source, /<img[\s\S]*src=\{asset\.png\.url\}/);
  assert.match(source, /IMAGE LOST/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|https?:\/\//);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
});

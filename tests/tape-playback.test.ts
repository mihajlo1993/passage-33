import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { motion } from "../src/tokens";
import {
  TAPE_FINAL_STILL_INDEX,
  TAPE_IMAGE_CUE_FRACTIONS,
  TAPE_STILLS,
  canUserSkipTape,
  createTapePlaybackState,
  formatTapeTimecode,
  tapeStillIndexAtVoicePosition,
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

test("voice cuts use weighted duration proportions and hold the padlock longest", () => {
  assert.deepEqual(TAPE_IMAGE_CUE_FRACTIONS, [
    0, 0.164, 0.299, 0.389, 0.501, 0.568, 0.748,
  ]);

  const intervals = TAPE_IMAGE_CUE_FRACTIONS.slice(1).map(
    (fraction, index) => fraction - TAPE_IMAGE_CUE_FRACTIONS[index]!,
  );
  const finalHold = 1 - TAPE_IMAGE_CUE_FRACTIONS.at(-1)!;
  assert.ok(finalHold > Math.max(...intervals));

  for (const duration of [75, 113]) {
    TAPE_IMAGE_CUE_FRACTIONS.forEach((fraction, index) => {
      assert.equal(
        tapeStillIndexAtVoicePosition(fraction * duration, duration),
        index,
      );
    });
  }
  assert.equal(tapeStillIndexAtVoicePosition(1, 0), null);
  assert.equal(tapeStillIndexAtVoicePosition(Number.NaN, 75), null);
});

test("voice position advances only forward and voice end preserves blackout", () => {
  let state = createTapePlaybackState();
  state = transitionTapePlayback(state, { type: "voice-position", stillIndex: 4 });
  assert.deepEqual(state, { phase: "playing", stillIndex: 4 });
  state = transitionTapePlayback(state, { type: "voice-position", stillIndex: 2 });
  assert.deepEqual(state, { phase: "playing", stillIndex: 4 });
  state = transitionTapePlayback(state, { type: "voice-position", stillIndex: 99 });
  assert.deepEqual(state, { phase: "playing", stillIndex: TAPE_FINAL_STILL_INDEX });
  state = transitionTapePlayback(state, { type: "voice-ended" });
  assert.deepEqual(state, { phase: "blackout", stillIndex: TAPE_FINAL_STILL_INDEX });
  state = transitionTapePlayback(state, "timer");
  assert.equal(state.phase, "complete");
});

test("screen forces VHS, uses local WebP stills, and resolves only at complete phase", () => {
  const source = readFileSync("src/components/TapePlaybackScreen.tsx", "utf8");
  const css = readFileSync("src/styles/tape.css", "utf8");
  assert.match(source, /setIntensity\(effects\.tape\.forcedVhsIntensity\)/);
  assert.match(source, /vhs\.dropFrames\(motion\.tape\.headSwitchMs\)/);
  assert.match(source, /audio\.play\("dial-tick"\)/);
  assert.match(source, /startVoice\(\)/);
  assert.match(source, /tapeStillIndexAtVoicePosition/);
  assert.match(source, /timingMode !== "fallback"/);
  assert.match(source, /dispatch\(\{ type: "voice-ended" \}\)/);
  assert.doesNotMatch(source, /TAPE_IMAGE_CUE_SECONDS|ui-contact/);
  assert.match(source, /state\.phase !== "complete"/);
  assert.match(source, /Promise\.resolve\(\)\.then\(onComplete\)/);
  assert.match(source, /latestHealthRef\.current/);
  assert.doesNotMatch(source, /\[audio, health, vhs\]/);
  assert.match(source, /asset\.webp !== null/);
  assert.match(source, /<img[\s\S]*src=\{asset\.webp!\.url\}/);
  assert.doesNotMatch(source, /<picture|asset\.png/);
  assert.match(source, /IMAGE LOST/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|https?:\/\//);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
});

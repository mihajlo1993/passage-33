import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { viewAfterRoomFallback } from "../src/ar/RoomARScreen";

const screenSource = readFileSync(
  new URL("../src/ar/RoomARScreen.tsx", import.meta.url),
  "utf8",
);

test("room fallback preserves every placed encounter phase", () => {
  assert.equal(viewAfterRoomFallback("placed", true), "fallback-placed");
  assert.equal(viewAfterRoomFallback("firing", true), "firing");
  assert.equal(viewAfterRoomFallback("hit", true), "hit");
  assert.equal(viewAfterRoomFallback("collapsing", true), "collapsing");
  assert.equal(viewAfterRoomFallback("complete", true), "complete");
});

test("room fallback requires a fresh tap before XR placement", () => {
  for (const view of [
    "checking",
    "briefing",
    "opening",
    "finding-floor",
    "ready-to-place",
  ] as const) {
    assert.equal(viewAfterRoomFallback(view, false), "fallback");
  }
});

test("fallback camera activation follows completed XR disposal", () => {
  const dispose = screenSource.indexOf("await activeRuntime?.dispose()");
  const activateCamera = screenSource.indexOf(
    "setFallbackReason(reason)",
    dispose,
  );

  assert.ok(dispose >= 0, "the screen awaits owned XR disposal");
  assert.ok(
    activateCamera > dispose,
    "the shared fallback camera activates only after XR disposal",
  );
  assert.match(
    screenSource.slice(dispose, activateCamera),
    /mountedRef\.current[\s\S]*sessionGenerationRef\.current/,
  );
});

test("runtime callbacks are generation guarded and placement transfer is tokenized", () => {
  assert.match(
    screenSource,
    /const isCurrentSession = \(\) =>[\s\S]*mountedRef\.current[\s\S]*sessionGenerationRef\.current === sessionGeneration/,
  );
  assert.match(screenSource, /onPhaseChange:[\s\S]*isCurrentSession\(\)/);
  assert.match(screenSource, /onCandidateChange:[\s\S]*isCurrentSession\(\)/);
  assert.match(screenSource, /onPlaced:[\s\S]*isCurrentSession\(\)/);
  assert.match(screenSource, /onSessionEnded:[\s\S]*transferToFallback\(/);
  assert.match(screenSource, /onError:[^\n]*transferToFallback\(/);
  assert.match(screenSource, /effects\.ar\.roomTransferXPercent/);
  assert.match(screenSource, /effects\.ar\.roomTransferYPercent/);
});

test("immersive start remains directly in the click handler", () => {
  const handler = screenSource.slice(
    screenSource.indexOf("const beginRoomSession = () =>"),
    screenSource.indexOf("const placeInRoom = () =>"),
  );

  assert.match(handler, /const runtime = createRoomXrRuntime\(/);
  assert.match(handler, /void runtime\.start\(\)/);
  assert.doesNotMatch(handler, /const beginRoomSession = async/);
});

test("immersive DOM overlay uses the common app ancestor", () => {
  assert.match(
    screenSource,
    /const immersiveOverlayRoot = document\.body/,
  );
  assert.match(screenSource, /overlayRoot: immersiveOverlayRoot/);
  assert.doesNotMatch(screenSource, /overlayRoot: overlayRootRef\.current/);
});

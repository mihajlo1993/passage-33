import assert from "node:assert/strict";
import test from "node:test";

import {
  AR_ACQUISITION_TIMEOUT_MS,
  AR_FRAME_INTERVAL_MS,
  AR_MAX_FPS,
  IMAGE_AR_SCENES,
  ROOM_AR_SCENE,
  ROOM_MONSTER_SCALE_METERS,
  WEBXR_REQUIRED_FEATURES,
  WEBXR_SESSION_MODE,
  createRoomWebXrSessionInit,
  hasArAcquisitionTimedOut,
  isArFrameDue,
} from "../src/ar/config";
import {
  createImageArState,
  createRoomArState,
  didImageArComplete,
  didRoomArComplete,
  didRoomArShotFire,
  imageArReducer,
  roomArReducer,
} from "../src/ar/state";
import type { RoomArPlacement, RoomArState } from "../src/ar/types";

const firstPlacement: RoomArPlacement = {
  xMeters: 0.25,
  yMeters: 0,
  zMeters: -1.4,
  yawRadians: 0.5,
};

function roomReadyToPlace(): RoomArState {
  let state = createRoomArState();
  state = roomArReducer(state, { type: "initialize", atMs: 100 });
  state = roomArReducer(state, { type: "tracking" });
  return roomArReducer(state, {
    type: "acquired",
    placement: firstPlacement,
  });
}

test("image scenes and room scene keep their exact, separate pin mappings", () => {
  assert.deepEqual(IMAGE_AR_SCENES.sheet01, {
    mechanism: "image",
    targetId: "sheet01",
    pinId: 3,
    targetIndex: 0,
    tone: "threatening",
    subject: "wall",
    motions: ["peel", "reach"],
  });
  assert.deepEqual(IMAGE_AR_SCENES.sheet02, {
    mechanism: "image",
    targetId: "sheet02",
    pinId: 17,
    targetIndex: 1,
    tone: "calm",
    subject: "herb",
    motions: ["pulse", "lift"],
  });
  assert.deepEqual(ROOM_AR_SCENE, {
    mechanism: "room",
    pinId: 18,
  });
});

test("acquisition timeout changes state exactly at the 12,000 ms boundary", () => {
  assert.equal(AR_ACQUISITION_TIMEOUT_MS, 12_000);
  assert.equal(hasArAcquisitionTimedOut(500, 12_499.999), false);
  assert.equal(hasArAcquisitionTimedOut(500, 12_500), true);
  assert.equal(hasArAcquisitionTimedOut(null, 12_500), false);
  assert.equal(hasArAcquisitionTimedOut(500, 499), false);

  let state = createImageArState("sheet01");
  state = imageArReducer(state, { type: "initialize", atMs: 500 });
  state = imageArReducer(state, { type: "tracking" });

  const beforeBoundary = imageArReducer(state, {
    type: "tick",
    atMs: 12_499.999,
  });
  assert.strictEqual(beforeBoundary, state);

  const atBoundary = imageArReducer(state, {
    type: "tick",
    atMs: 12_500,
  });
  assert.equal(atBoundary.phase, "fallback2d");
  assert.equal(atBoundary.fallbackReason, "acquisition-timeout");
});

test("explicit failures enter usable 2D fallback paths", () => {
  let imageState = createImageArState("sheet02");
  imageState = imageArReducer(imageState, {
    type: "initialize",
    atMs: 0,
  });
  imageState = imageArReducer(imageState, {
    type: "fallback",
    reason: "camera-denied",
  });
  assert.equal(imageState.phase, "fallback2d");
  assert.equal(imageState.fallbackReason, "camera-denied");

  let roomState = createRoomArState();
  roomState = roomArReducer(roomState, { type: "initialize", atMs: 0 });
  roomState = roomArReducer(roomState, {
    type: "fallback",
    reason: "webxr-unavailable",
  });
  assert.equal(roomState.phase, "fallback2d");
  roomState = roomArReducer(roomState, { type: "tap-place", atMs: 1 });
  assert.equal(roomState.phase, "placed");
  assert.equal(roomState.placementMode, "fallback2d");
  assert.equal(roomState.placement, null);
});

test("WebXR session constants and monster scale are exact", () => {
  assert.equal(WEBXR_SESSION_MODE, "immersive-ar");
  assert.deepEqual(WEBXR_REQUIRED_FEATURES, ["hit-test", "dom-overlay"]);
  assert.equal(ROOM_MONSTER_SCALE_METERS, 1.8);

  const overlayRoot = { id: "room-overlay" };
  const sessionInit = createRoomWebXrSessionInit(overlayRoot);
  assert.deepEqual(sessionInit.requiredFeatures, ["hit-test", "dom-overlay"]);
  assert.strictEqual(sessionInit.domOverlay.root, overlayRoot);
  assert.notStrictEqual(sessionInit.requiredFeatures, WEBXR_REQUIRED_FEATURES);
});

test("AR frame gate is capped at 30fps", () => {
  assert.equal(AR_MAX_FPS, 30);
  assert.equal(AR_FRAME_INTERVAL_MS, 1_000 / 30);
  assert.equal(isArFrameDue(0, null), true);
  assert.equal(isArFrameDue(AR_FRAME_INTERVAL_MS - 0.01, 0), false);
  assert.equal(isArFrameDue(AR_FRAME_INTERVAL_MS, 0), true);
  assert.equal(isArFrameDue(10, 20), true);
  assert.equal(isArFrameDue(Number.NaN, 0), false);
});

test("image tracking completes once from acquired or fallback state", () => {
  let state = createImageArState("sheet01");
  state = imageArReducer(state, { type: "initialize", atMs: 1 });
  state = imageArReducer(state, { type: "tracking" });
  state = imageArReducer(state, { type: "acquired", atMs: 2 });
  assert.equal(state.phase, "acquired");

  const completed = imageArReducer(state, { type: "complete", atMs: 3 });
  assert.equal(completed.phase, "completed");
  assert.equal(didImageArComplete(state, completed), true);

  const duplicate = imageArReducer(completed, {
    type: "complete",
    atMs: 4,
  });
  assert.strictEqual(duplicate, completed);
  assert.equal(duplicate.completedAtMs, 3);
  assert.equal(didImageArComplete(completed, duplicate), false);
});

test("room placement, shot, hit, collapse, and completion have strict order", () => {
  const acquired = roomReadyToPlace();
  assert.equal(acquired.phase, "acquired");

  assert.strictEqual(
    roomArReducer(acquired, { type: "fire", atMs: 200 }),
    acquired,
  );

  const placed = roomArReducer(acquired, { type: "tap-place", atMs: 200 });
  assert.equal(placed.phase, "placed");
  assert.equal(placed.placementMode, "world");

  const firing = roomArReducer(placed, { type: "fire", atMs: 300 });
  assert.equal(firing.phase, "firing");
  assert.equal(didRoomArShotFire(placed, firing), true);
  assert.strictEqual(
    roomArReducer(firing, { type: "collapse", atMs: 400 }),
    firing,
  );

  const hit = roomArReducer(firing, { type: "hit", atMs: 400 });
  assert.equal(hit.phase, "hit");
  assert.strictEqual(
    roomArReducer(hit, { type: "complete", atMs: 500 }),
    hit,
  );

  const collapsing = roomArReducer(hit, { type: "collapse", atMs: 500 });
  assert.equal(collapsing.phase, "collapsing");
  const completed = roomArReducer(collapsing, {
    type: "complete",
    atMs: 600,
  });
  assert.equal(completed.phase, "completed");
  assert.equal(didRoomArComplete(collapsing, completed), true);
});

test("room shot and completion are one-shot idempotent transitions", () => {
  const acquired = roomReadyToPlace();
  const placed = roomArReducer(acquired, { type: "tap-place", atMs: 200 });
  const firing = roomArReducer(placed, { type: "fire", atMs: 300 });

  const duplicateShot = roomArReducer(firing, { type: "fire", atMs: 301 });
  assert.strictEqual(duplicateShot, firing);
  assert.equal(duplicateShot.shotFiredAtMs, 300);
  assert.equal(didRoomArShotFire(firing, duplicateShot), false);

  const hit = roomArReducer(firing, { type: "hit", atMs: 400 });
  const collapsing = roomArReducer(hit, { type: "collapse", atMs: 500 });
  const completed = roomArReducer(collapsing, {
    type: "complete",
    atMs: 600,
  });
  const duplicateCompletion = roomArReducer(completed, {
    type: "complete",
    atMs: 601,
  });
  assert.strictEqual(duplicateCompletion, completed);
  assert.equal(duplicateCompletion.completedAtMs, 600);
  assert.equal(didRoomArComplete(completed, duplicateCompletion), false);
});

test("the first tap locks an immutable room placement", () => {
  const acquired = roomReadyToPlace();
  const placed = roomArReducer(acquired, { type: "tap-place", atMs: 200 });
  const lockedPlacement = placed.placement;
  assert.deepEqual(lockedPlacement, firstPlacement);
  assert.ok(Object.isFrozen(lockedPlacement));

  const replacement: RoomArPlacement = {
    xMeters: 9,
    yMeters: 9,
    zMeters: 9,
    yawRadians: 9,
  };
  const reacquired = roomArReducer(placed, {
    type: "acquired",
    placement: replacement,
  });
  const placedAgain = roomArReducer(reacquired, {
    type: "tap-place",
    atMs: 201,
  });
  assert.strictEqual(reacquired, placed);
  assert.strictEqual(placedAgain, placed);
  assert.strictEqual(placedAgain.placement, lockedPlacement);
});

test("cancellation has one cleanup transition and then ignores stale events", () => {
  let state = roomReadyToPlace();
  state = roomArReducer(state, {
    type: "cancel",
    reason: "screen-unmounted",
  });
  assert.equal(state.phase, "cancelled");
  assert.equal(state.cancellationReason, "screen-unmounted");
  assert.equal(state.candidatePlacement, null);

  const cleanedUp = roomArReducer(state, { type: "cleanup" });
  assert.equal(cleanedUp.phase, "cleanedUp");
  assert.strictEqual(
    roomArReducer(cleanedUp, { type: "fire", atMs: 1_000 }),
    cleanedUp,
  );
  assert.strictEqual(roomArReducer(cleanedUp, { type: "cleanup" }), cleanedUp);
});

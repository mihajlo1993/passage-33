import assert from "node:assert/strict";
import test from "node:test";

import {
  MAP_DOUBLE_TAP_DISTANCE_PX,
  MAP_DOUBLE_TAP_WINDOW_MS,
  MAP_CONTENT_ASPECT_RATIO,
  MAP_TAP_MAX_DURATION_MS,
  MAP_TAP_TRAVEL_PX,
  MAP_VIEWPORT_FRAME_INTERVAL_MS,
  MAP_VIEWPORT_MAX_FPS,
  boundMapViewport,
  clampMapViewportScale,
  coverMapViewport,
  isMapTapGesture,
  isMapViewportFrameDue,
  panMapViewport,
  pinchMapViewport,
  registerMapTap,
  zoomMapViewportAt,
} from "../src/map/viewport";

const viewport = { width: 272, height: 200 };

function approximately(actual: number, expected: number, epsilon = 0.000_001) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≈ ${expected}`);
}

test("scale and translation stay inside the map viewport", () => {
  assert.equal(clampMapViewportScale(-1), 1);
  assert.equal(clampMapViewportScale(2), 2);
  assert.equal(clampMapViewportScale(9), 3);
  assert.equal(clampMapViewportScale(Number.NaN), 1);

  assert.deepEqual(
    boundMapViewport({ x: 90, y: -900, scale: 2 }, viewport),
    { x: 0, y: -200, scale: 2 },
  );
  assert.deepEqual(
    boundMapViewport({ x: -900, y: 90, scale: 3 }, viewport),
    { x: -544, y: 0, scale: 3 },
  );
  assert.deepEqual(
    boundMapViewport({ x: -20, y: -20, scale: 1 }, viewport),
    { x: 0, y: 0, scale: 1 },
  );
});

test("pan and focal zoom math preserve edges and the point under the fingers", () => {
  assert.deepEqual(
    panMapViewport(
      { x: -150, y: -100, scale: 2 },
      { x: -500, y: 500 },
      viewport,
    ),
    { x: -272, y: 0, scale: 2 },
  );

  assert.deepEqual(
    zoomMapViewportAt(
      { x: 0, y: 0, scale: 1 },
      2,
      { x: 150, y: 100 },
      viewport,
    ),
    { x: -150, y: -100, scale: 2 },
  );
});

test("pinch combines zoom and centroid pan, then clamps to the 1..3 range", () => {
  assert.deepEqual(
    pinchMapViewport(
      { x: 0, y: 0, scale: 1 },
      { x: 150, y: 100 },
      { x: 170, y: 110 },
      100,
      200,
      viewport,
    ),
    { x: -130, y: -90, scale: 2 },
  );

  const clamped = pinchMapViewport(
    { x: -150, y: -100, scale: 2 },
    { x: 150, y: 100 },
    { x: 150, y: 100 },
    20,
    200,
    viewport,
  );
  assert.equal(clamped.scale, 3);
  assert.ok(clamped.x >= -544 && clamped.x <= 0);
  assert.ok(clamped.y >= -400 && clamped.y <= 0);
});

test("390 by 844 uses a distortion-free cover plane with pannable crop and no letterbox", () => {
  const portrait = { width: 390, height: 844 };
  const cover = coverMapViewport(portrait);
  assert.equal(MAP_CONTENT_ASPECT_RATIO, 680 / 500);
  approximately(cover.width, 844 * (680 / 500));
  assert.equal(cover.height, portrait.height);
  approximately(cover.width / cover.height, MAP_CONTENT_ASPECT_RATIO);
  assert.ok(cover.width >= portrait.width);
  assert.ok(cover.height >= portrait.height);
  approximately(cover.offsetX, (portrait.width - cover.width) / 2);
  assert.equal(cover.offsetY, 0);

  const leftEdge = boundMapViewport({ x: -10_000, y: 10_000, scale: 1 }, portrait);
  const rightEdge = boundMapViewport({ x: 10_000, y: -10_000, scale: 1 }, portrait);
  approximately(leftEdge.x, cover.offsetX);
  approximately(rightEdge.x, -cover.offsetX);
  assert.equal(leftEdge.y, 0);
  assert.equal(rightEdge.y, 0);
});

test("tap classification rejects holds and drags", () => {
  assert.equal(isMapTapGesture(100, 100 + MAP_TAP_MAX_DURATION_MS, 0), true);
  assert.equal(isMapTapGesture(100, 101 + MAP_TAP_MAX_DURATION_MS, 0), false);
  assert.equal(isMapTapGesture(100, 110, MAP_TAP_TRAVEL_PX), true);
  assert.equal(isMapTapGesture(100, 110, MAP_TAP_TRAVEL_PX + 0.01), false);
});

test("double taps require nearby taps inside the timing window and consume the pair", () => {
  const first = { point: { x: 40, y: 50 }, atMs: 1_000 };
  const recorded = registerMapTap(null, first);
  assert.deepEqual(recorded, { isDoubleTap: false, nextTap: first });

  const matched = registerMapTap(recorded.nextTap, {
    point: { x: 40 + MAP_DOUBLE_TAP_DISTANCE_PX, y: 50 },
    atMs: 1_000 + MAP_DOUBLE_TAP_WINDOW_MS,
  });
  assert.deepEqual(matched, { isDoubleTap: true, nextTap: null });

  const tooLate = registerMapTap(first, {
    point: first.point,
    atMs: first.atMs + MAP_DOUBLE_TAP_WINDOW_MS + 0.01,
  });
  assert.equal(tooLate.isDoubleTap, false);

  const tooFar = registerMapTap(first, {
    point: { x: first.point.x + MAP_DOUBLE_TAP_DISTANCE_PX + 0.01, y: first.point.y },
    atMs: first.atMs + 1,
  });
  assert.equal(tooFar.isDoubleTap, false);
});

test("timestamp gate limits transform commits to 30fps", () => {
  assert.equal(MAP_VIEWPORT_MAX_FPS, 30);
  assert.equal(MAP_VIEWPORT_FRAME_INTERVAL_MS, 1_000 / 30);
  assert.equal(isMapViewportFrameDue(0, null), true);
  assert.equal(isMapViewportFrameDue(MAP_VIEWPORT_FRAME_INTERVAL_MS - 0.01, 0), false);
  assert.equal(isMapViewportFrameDue(MAP_VIEWPORT_FRAME_INTERVAL_MS, 0), true);
  assert.equal(isMapViewportFrameDue(10, 20), true);
  assert.equal(isMapViewportFrameDue(Number.NaN, 0), false);
});

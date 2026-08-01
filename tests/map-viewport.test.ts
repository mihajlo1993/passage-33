import assert from "node:assert/strict";
import test from "node:test";

import {
  MAP_CONTENT_ASPECT_RATIO,
  MAP_DOUBLE_TAP_ZOOM_SCALE,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  clampMapZoom,
  distanceBetweenMapViewportPoints,
  doubleTapTargetZoom,
  fitMapCanvasSize,
  isMapTapGesture,
  isMapViewportFrameDue,
  mapCanvasSizeAtZoom,
  mapScrollAfterZoom,
  midpointMapViewport,
  pinchMapZoom,
  registerMapTap,
} from "../src/map/viewport";
import { mapViewBox, roomDefinitions } from "../src/map/model";

function approximately(actual: number, expected: number, epsilon = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${actual} is not within ${epsilon} of ${expected}`,
  );
}

test("the aspect ratio derives from the drawing, never a hand-copied constant", () => {
  assert.equal(MAP_CONTENT_ASPECT_RATIO, mapViewBox.width / mapViewBox.height);
});

test("fit size contains the WHOLE drawing inside the client box, distortion-free", () => {
  // A 390px phone slot (shell minus chrome), portrait.
  const fit = fitMapCanvasSize({ width: 390, height: 700 });
  assert.ok(fit.width <= 390 && fit.height <= 700);
  approximately(fit.width / fit.height, MAP_CONTENT_ASPECT_RATIO);
  // The 680-wide drawing letterboxes on the shorter axis: width binds here.
  approximately(fit.width, 390);
  approximately(fit.height, 390 / MAP_CONTENT_ASPECT_RATIO);

  // A wider slot: height binds instead.
  const wide = fitMapCanvasSize({ width: 900, height: 400 });
  approximately(wide.height, 400);
  approximately(wide.width, 400 * MAP_CONTENT_ASPECT_RATIO);
});

test("no room can clip offscreen at fit: every room maps inside the fit canvas", () => {
  const container = { width: 390, height: 700 };
  const fit = fitMapCanvasSize(container);
  const scaleX = fit.width / mapViewBox.width;
  const scaleY = fit.height / mapViewBox.height;
  for (const room of roomDefinitions) {
    for (const point of room.geometry.polygon) {
      const px = point.x * scaleX;
      const py = point.y * scaleY;
      assert.ok(px >= 0 && px <= container.width, `${room.id} x inside`);
      assert.ok(py >= 0 && py <= container.height, `${room.id} y inside`);
    }
  }
});

test("zoom clamps to the 1..5 range and degenerate input falls to the floor", () => {
  assert.equal(clampMapZoom(0.2), MAP_MIN_ZOOM);
  assert.equal(clampMapZoom(99), MAP_MAX_ZOOM);
  assert.equal(clampMapZoom(Number.NaN), MAP_MIN_ZOOM);
  const sized = mapCanvasSizeAtZoom({ width: 390, height: 700 }, 2);
  approximately(sized.width, 780);
});

test("scroll compensation keeps the focal point stationary through a zoom", () => {
  const scroll = { scrollLeft: 100, scrollTop: 50, clientWidth: 390, clientHeight: 700 };
  // The content point under the finger is (scroll + focal); after the zoom
  // it has scaled by the ratio, and the same screen point must find it.
  const focal = { x: 120, y: 200 };
  const next = mapScrollAfterZoom(scroll, 2, focal);
  approximately(next.scrollLeft, (100 + 120) * 2 - 120);
  approximately(next.scrollTop, (50 + 200) * 2 - 200);

  // Without a focal point the viewport centre holds instead.
  const centred = mapScrollAfterZoom(scroll, 2);
  approximately(centred.scrollLeft, (100 + 195) * 2 - 195);
  approximately(centred.scrollTop, (50 + 350) * 2 - 350);
});

test("pinch zoom scales with finger distance and clamps at both ends", () => {
  assert.equal(pinchMapZoom(1, 100, 200), 2);
  assert.equal(pinchMapZoom(2, 100, 50), 1);
  assert.equal(pinchMapZoom(1, 100, 25), MAP_MIN_ZOOM);
  assert.equal(pinchMapZoom(4, 100, 400), MAP_MAX_ZOOM);
  // A zero start distance never divides: the zoom simply holds.
  assert.equal(pinchMapZoom(2, 0, 120), 2);
});

test("double taps toggle between fit and the 2x reading zoom", () => {
  assert.equal(doubleTapTargetZoom(MAP_MIN_ZOOM), MAP_DOUBLE_TAP_ZOOM_SCALE);
  assert.equal(doubleTapTargetZoom(2), MAP_MIN_ZOOM);
  assert.equal(doubleTapTargetZoom(4.5), MAP_MIN_ZOOM);
});

test("tap classification rejects holds and drags", () => {
  assert.equal(isMapTapGesture(0, 120, 4), true);
  assert.equal(isMapTapGesture(0, 4_000, 4), false);
  assert.equal(isMapTapGesture(0, 120, 400), false);
  assert.equal(isMapTapGesture(0, Number.NaN, 0), false);
});

test("double taps require nearby taps inside the timing window and consume the pair", () => {
  const first = { point: { x: 40, y: 40 }, atMs: 1_000 };
  const start = registerMapTap(null, first);
  assert.equal(start.isDoubleTap, false);
  assert.deepEqual(start.nextTap, first);

  const paired = registerMapTap(first, { point: { x: 46, y: 44 }, atMs: 1_180 });
  assert.equal(paired.isDoubleTap, true);
  assert.equal(paired.nextTap, null);

  const tooLate = registerMapTap(first, { point: { x: 42, y: 42 }, atMs: 3_000 });
  assert.equal(tooLate.isDoubleTap, false);

  const tooFar = registerMapTap(first, { point: { x: 300, y: 400 }, atMs: 1_100 });
  assert.equal(tooFar.isDoubleTap, false);
});

test("geometry helpers stay exact", () => {
  assert.equal(distanceBetweenMapViewportPoints({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.deepEqual(midpointMapViewport({ x: 0, y: 0 }, { x: 10, y: 20 }), { x: 5, y: 10 });
});

test("timestamp gate limits transform commits to 30fps", () => {
  assert.equal(isMapViewportFrameDue(1_000, null), true);
  assert.equal(isMapViewportFrameDue(1_010, 1_000), false);
  assert.equal(isMapViewportFrameDue(1_040, 1_000), true);
  assert.equal(isMapViewportFrameDue(900, 1_000), true);
  assert.equal(isMapViewportFrameDue(Number.NaN, 1_000), false);
});

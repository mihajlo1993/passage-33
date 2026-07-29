import assert from "node:assert/strict";
import test from "node:test";

import {
  IDLE_OPERATOR_GESTURE,
  OPERATOR_LONG_PRESS_MS,
  OPERATOR_SEQUENCE_WINDOW_MS,
  stepOperatorGesture,
  type OperatorGestureEvent,
  type OperatorGestureState,
} from "../src/operator/gesture";

const VIEWPORT = { width: 390 } as const;

function run(
  state: OperatorGestureState,
  event: OperatorGestureEvent,
) {
  return stepOperatorGesture(state, event, VIEWPORT);
}

test("operator sequence is exactly a 3s top-left hold then two top-right taps", () => {
  assert.equal(OPERATOR_LONG_PRESS_MS, 3_000);
  assert.equal(OPERATOR_SEQUENCE_WINDOW_MS, 2_000);

  let result = run(IDLE_OPERATOR_GESTURE, {
    type: "pointer-down",
    pointerId: 1,
    x: 12,
    y: 12,
    atMs: 1_000,
  });
  assert.equal(result.state.stage, "left-held");

  result = run(result.state, { type: "tick", atMs: 4_000 });
  assert.equal(result.armed, true);
  assert.equal(result.state.stage, "right-ready");

  result = run(result.state, {
    type: "pointer-up",
    pointerId: 1,
    x: 12,
    y: 12,
    atMs: 4_000,
  });
  assert.equal(result.state.stage, "right-ready");

  for (const [pointerId, downAt, upAt] of [
    [2, 4_100, 4_150],
    [3, 4_300, 4_350],
  ] as const) {
    result = run(result.state, {
      type: "pointer-down",
      pointerId,
      x: 378,
      y: 12,
      atMs: downAt,
    });
    assert.equal(result.consume, true);
    result = run(result.state, {
      type: "pointer-up",
      pointerId,
      x: 378,
      y: 12,
      atMs: upAt,
    });
  }

  assert.equal(result.activated, true);
  assert.equal(result.state.stage, "idle");
});

test("releasing the left corner before 3s never arms access", () => {
  let result = run(IDLE_OPERATOR_GESTURE, {
    type: "pointer-down",
    pointerId: 4,
    x: 0,
    y: 0,
    atMs: 0,
  });
  result = run(result.state, { type: "tick", atMs: 2_999 });
  assert.equal(result.state.stage, "left-held");
  result = run(result.state, {
    type: "pointer-up",
    pointerId: 4,
    x: 0,
    y: 0,
    atMs: 2_999,
  });
  assert.equal(result.state.stage, "idle");
  assert.equal(result.activated, false);
});

test("moving out of the left corner cancels the hold", () => {
  let result = run(IDLE_OPERATOR_GESTURE, {
    type: "pointer-down",
    pointerId: 5,
    x: 10,
    y: 10,
    atMs: 0,
  });
  result = run(result.state, {
    type: "pointer-move",
    pointerId: 5,
    x: 80,
    y: 10,
    atMs: 1_000,
  });
  assert.equal(result.state.stage, "idle");
});

test("the two right taps must finish inside the single 2s window", () => {
  let result = run(IDLE_OPERATOR_GESTURE, {
    type: "pointer-down",
    pointerId: 6,
    x: 10,
    y: 10,
    atMs: 0,
  });
  result = run(result.state, { type: "tick", atMs: 3_000 });

  result = run(result.state, {
    type: "pointer-down",
    pointerId: 7,
    x: 380,
    y: 10,
    atMs: 3_100,
  });
  result = run(result.state, {
    type: "pointer-up",
    pointerId: 7,
    x: 380,
    y: 10,
    atMs: 3_150,
  });
  assert.equal(result.state.stage, "right-ready");

  result = run(result.state, {
    type: "pointer-down",
    pointerId: 8,
    x: 380,
    y: 10,
    atMs: 5_001,
  });
  assert.equal(result.state.stage, "idle");
  assert.equal(result.activated, false);
});

test("right-side taps outside the top corner are ignored", () => {
  let result = run(IDLE_OPERATOR_GESTURE, {
    type: "pointer-down",
    pointerId: 9,
    x: 10,
    y: 10,
    atMs: 0,
  });
  result = run(result.state, { type: "tick", atMs: 3_000 });
  result = run(result.state, {
    type: "pointer-down",
    pointerId: 10,
    x: 380,
    y: 80,
    atMs: 3_100,
  });
  assert.equal(result.state.stage, "right-ready");
  assert.equal(result.consume, false);
});

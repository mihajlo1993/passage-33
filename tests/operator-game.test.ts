import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultGameState } from "../src/game/engine";
import { selectGameState, useGameStore } from "../src/game/store";
import { itemIds } from "../src/items";
import {
  currentPinForOperator,
  currentZoneForOperator,
  resetGameForOperator,
  resolvePinForOperator,
  setActForOperator,
  setHealthForOperator,
  setItemForOperator,
  unresolvePinForOperator,
} from "../src/operator/game";
import {
  forceOperatorTorch,
  getOperatorRuntimeSnapshot,
  requestOperatorReset,
  requestOperatorScareSkip,
  resetOperatorOverrides,
  setOperatorAudioMuted,
  setOperatorVhsIntensity,
  subscribeToOperatorReset,
  subscribeToOperatorScareSkip,
} from "../src/operator/runtime";

test("operator resolution bypasses act, item, prerequisite, and mechanism gates", () => {
  const initial = createDefaultGameState(1_000);
  const roomScare = resolvePinForOperator(initial, 18, 2_000);

  assert.deepEqual(roomScare.resolvedPins, [18]);
  assert.equal(roomScare.health, 80);
  assert.equal(roomScare.act, 1);

  const cabinet = resolvePinForOperator(roomScare, 8, 2_100);
  assert.ok(cabinet.inventory.includes(itemIds.chemFluid));
  assert.equal(cabinet.lastSavePin, 8);
});

test("operator resolution preserves normal grants, revocations, saves, and win time", () => {
  let state = createDefaultGameState(1_000);
  state = setItemForOperator(state, itemIds.candleLit, true);
  state = resolvePinForOperator(state, 23, 2_000);
  assert.equal(state.inventory.includes(itemIds.candleLit), false);

  state = resolvePinForOperator(state, 2, 2_100);
  state = resolvePinForOperator(state, 8, 2_200);
  assert.equal(state.lastSavePin, 8);

  state = resolvePinForOperator(state, 26, 2_300);
  assert.equal(state.finishedAt, 2_300);

  state = unresolvePinForOperator(state, 26);
  assert.equal(state.finishedAt, null);
  assert.ok(state.inventory.includes(itemIds.knife));

  state = unresolvePinForOperator(state, 8);
  assert.equal(state.lastSavePin, 2);
});

test("operator health, inventory, act, status, and reset mutations are deterministic", () => {
  let state = createDefaultGameState(5_000);
  state = setHealthForOperator(state, 37.6);
  assert.equal(state.health, 38);
  assert.equal(setHealthForOperator(state, -50).health, 0);
  assert.equal(setHealthForOperator(state, 500).health, 100);

  state = setItemForOperator(state, itemIds.pistol, true);
  assert.deepEqual(state.inventory, [itemIds.pistol]);
  state = setItemForOperator(state, itemIds.pistol, false);
  assert.deepEqual(state.inventory, []);

  state = setActForOperator(state, 4);
  assert.equal(state.act, 4);
  assert.equal(currentPinForOperator(state), 19);
  assert.equal(currentZoneForOperator(state), "corridor");

  state = resolvePinForOperator(state, 19);
  assert.equal(currentZoneForOperator(state), "kitchen");

  const reset = resetGameForOperator(9_000);
  assert.equal(reset.act, 1);
  assert.equal(reset.health, 100);
  assert.deepEqual(reset.resolvedPins, []);
  assert.equal(currentPinForOperator(reset), 1);
});

test("operator runtime commands publish synchronously", () => {
  resetOperatorOverrides();
  let skipCalls = 0;
  let resetCalls = 0;
  const unsubscribeSkip = subscribeToOperatorScareSkip(() => {
    skipCalls += 1;
  });
  const unsubscribeReset = subscribeToOperatorReset(() => {
    resetCalls += 1;
  });

  try {
    forceOperatorTorch(true);
    setOperatorAudioMuted(true);
    setOperatorVhsIntensity(0);
    requestOperatorScareSkip();
    requestOperatorReset();

    const snapshot = getOperatorRuntimeSnapshot();
    assert.equal(snapshot.forcedTorch, true);
    assert.equal(snapshot.audioMuted, true);
    assert.equal(snapshot.vhsIntensityOverride, 0);
    assert.equal(skipCalls, 1);
    assert.equal(resetCalls, 1);
  } finally {
    unsubscribeSkip();
    unsubscribeReset();
    resetOperatorOverrides();
  }
});

test("an operator change made during hydration cannot be overwritten", async () => {
  const previous = selectGameState(useGameStore.getState());
  const cold = createDefaultGameState(10_000);
  useGameStore.setState({
    ...cold,
    hydrated: false,
    hydrating: false,
    critical: false,
    lastResolution: null,
  });

  const hydration = useGameStore.getState().hydrate();
  const forced = {
    ...cold,
    act: 4 as const,
    health: 31,
  };
  useGameStore.getState().replaceStateFromOperator(forced);
  await hydration;

  try {
    assert.equal(useGameStore.getState().act, 4);
    assert.equal(useGameStore.getState().health, 31);
    assert.equal(useGameStore.getState().hydrated, true);
  } finally {
    useGameStore.getState().replaceStateFromOperator(previous);
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultGameState } from "../src/game/engine";
import {
  deriveRoomStates,
  deriveSurveyMap,
  mapFurniture,
  mapLandmarks,
  roomConnections,
  roomDefinitions,
  roomStatusLabels,
} from "../src/map/model";
import type { GameState, ZoneId } from "../src/types";

function roomState(state: GameState, room: ZoneId) {
  const found = deriveRoomStates(state).find((candidate) => candidate.id === room);
  assert.ok(found, `missing room ${room}`);
  return found;
}

test("the survey contains six render-ready rooms with Entry as the hub", () => {
  assert.deepEqual(
    roomDefinitions.map((room) => room.id).sort(),
    ["balcony", "bathroom", "corridor", "entry", "kitchen", "living"],
  );
  assert.equal(roomDefinitions.find((room) => room.id === "entry")?.role, "hub");

  for (const room of roomDefinitions) {
    assert.ok(room.geometry.polygon.length >= 4, room.id);
    assert.ok(Number.isFinite(room.geometry.labelPoint.x), room.id);
    assert.ok(Number.isFinite(room.geometry.labelPoint.y), room.id);
  }
});

test("topology has the specified hub openings and three physical doors", () => {
  assert.deepEqual(
    roomConnections.map(({ rooms, passage }) => ({ rooms, passage })),
    [
      { rooms: ["living", "entry"], passage: "open" },
      { rooms: ["kitchen", "entry"], passage: "door" },
      { rooms: ["corridor", "entry"], passage: "open" },
      { rooms: ["bathroom", "corridor"], passage: "door" },
      { rooms: ["balcony", "living"], passage: "door" },
    ],
  );

  for (const connection of roomConnections) {
    assert.ok(connection.opening.start);
    assert.ok(connection.opening.end);
    assert.equal(Boolean(connection.door), connection.passage === "door");
  }

  const frontDoor = mapLandmarks.find((landmark) => landmark.id === "front-door");
  assert.ok(frontDoor && frontDoor.kind === "sealed-exit");
  assert.equal(frontDoor.room, "entry");
  assert.equal(frontDoor.permanentlySealed, true);

  const start = mapLandmarks.find((landmark) => landmark.id === "start");
  assert.ok(start && start.kind === "start");
  assert.equal(start.room, "corridor");
  assert.equal(start.placement, "far-end");
});

test("fixed furniture records include every surveyed object and profile", () => {
  assert.deepEqual(
    mapFurniture.map((item) => [item.room, item.kind]),
    [
      ["living", "table"],
      ["living", "kallax"],
      ["living", "sectional"],
      ["living", "television"],
      ["entry", "clothes-hanger"],
      ["corridor", "cupboard"],
      ["bathroom", "mirror"],
      ["bathroom", "cabinet"],
    ],
  );
  assert.equal(mapFurniture.find((item) => item.kind === "sectional")?.profile, "notched");
  assert.equal(
    mapFurniture.find((item) => item.id === "corridor-left-cupboard")?.profile,
    "full-height-thin-left",
  );
});

test("room status is semantic: corridor starts entered, pins enter, clears override", () => {
  const initial = createDefaultGameState(1_000);
  assert.equal(roomState(initial, "corridor").status, "unresolved");
  assert.equal(roomState(initial, "bathroom").status, "unentered");
  assert.equal(roomState(initial, "entry").status, "unentered");

  const enteredBathroom: GameState = { ...initial, resolvedPins: [4] };
  assert.equal(roomState(enteredBathroom, "bathroom").status, "unresolved");

  const clearedWithoutPins: GameState = {
    ...initial,
    clearedZones: ["kitchen"],
  };
  assert.equal(roomState(clearedWithoutPins, "kitchen").status, "cleared");
  assert.deepEqual(Object.keys(roomStatusLabels).sort(), ["cleared", "unentered", "unresolved"]);
});

test("the balcony exposes only an outline lock boolean", () => {
  const initial = createDefaultGameState(1_000);
  assert.equal(roomState(initial, "balcony").outlineLocked, true);

  const unlocked: GameState = { ...initial, resolvedPins: [16] };
  assert.equal(roomState(unlocked, "balcony").outlineLocked, false);
  assert.equal(roomState(unlocked, "balcony").status, "unentered");
  assert.ok(deriveRoomStates(initial).filter((room) => room.id !== "balcony").every((room) => !room.outlineLocked));
});

test("render-facing map data has no pin IDs, pin fields, or contact counts", () => {
  const state = createDefaultGameState(1_000);
  const model = deriveSurveyMap(state);
  const labels = [
    ...model.rooms.flatMap((room) => [room.label, room.statusLabel]),
    ...model.furniture.map((item) => item.label),
    ...model.landmarks.map((landmark) => landmark.label),
  ];

  assert.ok(labels.every((label) => !/\d/.test(label)));
  assert.ok(labels.every((label) => !/pin|contact|remaining/i.test(label)));
  assert.doesNotMatch(JSON.stringify(model), /lockedUntilPin|pinId|pinCount|remainingCount/i);
  assert.ok(model.rooms.every((room) => ["unresolved", "cleared", "unentered"].includes(room.status)));
});

test("the actual renderer model owns one bounded 900 by 600 drawing", () => {
  const model = deriveSurveyMap(createDefaultGameState(1_000));
  assert.deepEqual(model.viewBox, { x: 0, y: 0, width: 900, height: 600 });

  const inside = (point: { x: number; y: number }) =>
    point.x >= 0 && point.x <= 900 && point.y >= 0 && point.y <= 600;
  assert.ok(model.rooms.every((room) => room.geometry.polygon.every(inside)));
  assert.equal(model.connections.length, 5);
  assert.equal(model.furniture.length, 8);
  assert.equal(model.landmarks.length, 2);
  assert.deepEqual(roomStatusLabels, {
    unresolved: "UNRESOLVED",
    cleared: "CLEARED",
    unentered: "UNENTERED",
  });
});

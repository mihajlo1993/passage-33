import assert from "node:assert/strict";
import test from "node:test";

import {
  attemptResolvePin,
  createDefaultGameState,
  resolutionModeForPin,
} from "../src/game/engine";
import { pins } from "../src/pins";
import {
  deriveRoomStates,
  deriveSurveyMap,
  mapFurniture,
  mapLandmarks,
  openingCenterline,
  roomConnections,
  roomDefinitions,
  roomStatusLabels,
} from "../src/map/model";
import type { GameState, ZoneId } from "../src/types";
import { zoneAdjacency, zoneConnections } from "../src/zones";

function pairKey(rooms: readonly [ZoneId, ZoneId]): string {
  return [...rooms].sort().join("|");
}

function rectangle(x1: number, y1: number, x2: number, y2: number) {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

function footprintBounds(points: readonly { x: number; y: number }[]) {
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
}

function roomState(state: GameState, room: ZoneId) {
  const found = deriveRoomStates(state).find((candidate) => candidate.id === room);
  assert.ok(found, `missing room ${room}`);
  return found;
}

test("the survey contains the six authoritative room rectangles with Entry as the hub", () => {
  assert.deepEqual(
    roomDefinitions.map((room) => room.id).sort(),
    ["balcony", "bathroom", "corridor", "entry", "kitchen", "living"],
  );
  assert.equal(roomDefinitions.find((room) => room.id === "entry")?.role, "hub");

  const expectedPolygons: Readonly<Record<ZoneId, ReturnType<typeof rectangle>>> = {
    kitchen: rectangle(250, 40, 460, 150),
    entry: rectangle(250, 170, 445, 295),
    living: rectangle(60, 170, 245, 420),
    balcony: rectangle(20, 200, 55, 310),
    corridor: rectangle(290, 300, 445, 480),
    bathroom: rectangle(450, 350, 640, 480),
  };
  for (const [roomId, polygon] of Object.entries(expectedPolygons)) {
    const room = roomDefinitions.find(({ id }) => id === roomId);
    assert.ok(room, `missing room ${roomId}`);
    assert.deepEqual(room.geometry.polygon, polygon, `${roomId} coordinates`);
  }
});

test("every specified adjacency has its exact aperture and no other pair shares one", () => {
  const expected = new Map<string, {
    passage: "open" | "door";
    opening: {
      x: number;
      y: number;
      width: number;
      height: number;
      axis: "horizontal" | "vertical";
    };
  }>([
    ["entry|living", { passage: "open", opening: { x: 243, y: 225, width: 9, height: 60, axis: "vertical" } }],
    ["entry|kitchen", { passage: "door", opening: { x: 424, y: 150, width: 18, height: 20, axis: "horizontal" } }],
    ["corridor|entry", { passage: "open", opening: { x: 388, y: 293, width: 44, height: 9, axis: "horizontal" } }],
    ["bathroom|corridor", { passage: "door", opening: { x: 443, y: 400, width: 9, height: 44, axis: "vertical" } }],
    ["balcony|living", { passage: "door", opening: { x: 53, y: 240, width: 9, height: 40, axis: "vertical" } }],
  ]);
  const actual = new Map(roomConnections.map((connection) => [pairKey(connection.rooms), connection]));
  assert.equal(actual.size, roomConnections.length, "adjacency pairs must be unique");
  assert.equal(actual.size, expected.size);

  const roomIds = roomDefinitions.map(({ id }) => id);
  for (let left = 0; left < roomIds.length; left += 1) {
    for (let right = left + 1; right < roomIds.length; right += 1) {
      const rooms: [ZoneId, ZoneId] = [roomIds[left], roomIds[right]];
      const key = pairKey(rooms);
      const expectedConnection = expected.get(key);
      const actualConnection = actual.get(key);
      assert.equal(
        Boolean(actualConnection),
        Boolean(expectedConnection),
        `${key} must ${expectedConnection ? "share" : "not share"} an opening`,
      );
      assert.equal(
        zoneAdjacency[rooms[0]].includes(rooms[1]),
        Boolean(expectedConnection),
        `${key} forward adjacency matrix`,
      );
      assert.equal(
        zoneAdjacency[rooms[1]].includes(rooms[0]),
        Boolean(expectedConnection),
        `${key} reverse adjacency matrix`,
      );
      if (!expectedConnection || !actualConnection) continue;
      assert.equal(actualConnection.passage, expectedConnection.passage, `${key} passage`);
      assert.deepEqual(actualConnection.opening, expectedConnection.opening, `${key} aperture`);
      assert.equal(Boolean(actualConnection.door), actualConnection.passage === "door");
      if (actualConnection.door) {
        assert.deepEqual(actualConnection.door.threshold, openingCenterline(actualConnection.opening));
      }
    }
  }

  const zonePairs = new Map(zoneConnections.map((connection) => [
    pairKey(connection.zones),
    connection.passage,
  ]));
  assert.deepEqual(
    [...zonePairs].sort(([left], [right]) => left.localeCompare(right)),
    [...expected].map(([key, value]) => [key, value.passage]).sort(([left], [right]) => left.localeCompare(right)),
  );
  const frontDoor = mapLandmarks.find((landmark) => landmark.id === "front-door");
  assert.ok(frontDoor && frontDoor.kind === "sealed-exit");
  assert.equal(frontDoor.room, "entry");
  assert.equal(frontDoor.permanentlySealed, true);
  assert.deepEqual(frontDoor.opening, {
    x: 443,
    y: 216,
    width: 4,
    height: 32,
    axis: "vertical",
  });
  assert.deepEqual(frontDoor.threshold, {
    start: { x: 445, y: 216 },
    end: { x: 445, y: 248 },
  });
  assert.equal((frontDoor.threshold.start.y + frontDoor.threshold.end.y) / 2, 232);
  assert.equal(roomConnections.length + 1, 6, "five internal apertures plus the sealed front door");

  const start = mapLandmarks.find((landmark) => landmark.id === "start");
  assert.ok(start && start.kind === "start");
  assert.equal(start.room, "corridor");
  assert.equal(start.placement, "far-end");
  assert.deepEqual(start.point, { x: 385, y: 460 });
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
      ["kitchen", "counter-hob"],
    ],
  );
  assert.deepEqual(
    mapFurniture.map((item) => [item.id, footprintBounds(item.footprint)]),
    [
      ["living-table", { x: 70, y: 186, width: 58, height: 32 }],
      ["living-kallax", { x: 170, y: 176, width: 66, height: 66 }],
      ["living-sectional", { x: 85, y: 265, width: 145, height: 62 }],
      ["living-tv", { x: 95, y: 386, width: 120, height: 24 }],
      ["entry-clothes-hanger", { x: 300, y: 176, width: 120, height: 14 }],
      ["corridor-left-cupboard", { x: 296, y: 306, width: 34, height: 168 }],
      ["bathroom-mirror", { x: 624, y: 362, width: 14, height: 50 }],
      ["bathroom-cabinet", { x: 624, y: 425, width: 14, height: 50 }],
      ["kitchen-counter-hob", { x: 256, y: 72, width: 198, height: 16 }],
    ],
  );
  assert.deepEqual(
    mapFurniture.find((item) => item.id === "living-sectional")?.footprint,
    [
      { x: 85, y: 265 },
      { x: 230, y: 265 },
      { x: 230, y: 327 },
      { x: 188, y: 327 },
      { x: 188, y: 300 },
      { x: 128, y: 300 },
      { x: 128, y: 327 },
      { x: 85, y: 327 },
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
  assert.equal(roomState(initial, "bathroom").status, "unentered");

  const enteredBathroom: GameState = { ...initial, resolvedPins: [8] };
  assert.equal(roomState(enteredBathroom, "bathroom").status, "unresolved");

  const clearedWithoutPins: GameState = {
    ...initial,
    clearedZones: ["kitchen"],
  };
  assert.equal(roomState(clearedWithoutPins, "kitchen").status, "cleared");
  assert.deepEqual(Object.keys(roomStatusLabels).sort(), ["cleared", "unentered", "unresolved"]);
});

test("state colours transition room by room as pins resolve", () => {
  // Walk the pin graph and check the RE room rule at every step: the room
  // the hunt is in reads crimson (unresolved), rooms whose work is done and
  // left behind read slate (cleared), untouched rooms stay outline-only.
  let state = createDefaultGameState(1_000);
  // She wakes in the corridor; the first lock waits in the living room.
  assert.equal(roomState(state, "corridor").status, "unresolved");
  assert.equal(deriveSurveyMap(state).objectiveZone, "living");
  assert.equal(roomState(state, "living").status, "unresolved");
  assert.equal(roomState(state, "kitchen").status, "unentered");

  for (const pin of pins) {
    const result = attemptResolvePin(state, pin.id, 1_000 + pin.id, resolutionModeForPin(pin));
    assert.equal(result.ok, true, `pin ${pin.id}`);
    state = result.state;

    const resolved = new Set(state.resolvedPins);
    const nextPin = pins.find((candidate) => !resolved.has(candidate.id));
    const model = deriveSurveyMap(state);
    assert.equal(model.objectiveZone, nextPin?.zone ?? null);
    if (nextPin) {
      assert.equal(
        roomState(state, nextPin.zone).status,
        "unresolved",
        `active room after pin ${pin.id}`,
      );
    }
    for (const room of model.rooms) {
      assert.ok(
        ["unresolved", "cleared", "unentered"].includes(room.status),
        room.id,
      );
    }
  }

  // The hunt has ended: nothing is active, and every visited room settled.
  const finished = deriveSurveyMap(state);
  assert.equal(finished.objectiveZone, null);
  assert.ok(
    finished.rooms
      .filter((room) => ["living", "entry", "corridor", "bathroom"].includes(room.id))
      .every((room) => room.status === "cleared"),
  );
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

test("the actual renderer model owns one bounded 680 by 500 drawing", () => {
  const model = deriveSurveyMap(createDefaultGameState(1_000));
  assert.deepEqual(model.viewBox, { x: 0, y: 0, width: 680, height: 500 });

  const inside = (point: { x: number; y: number }) =>
    point.x >= 0 && point.x <= 680 && point.y >= 0 && point.y <= 500;
  assert.ok(model.rooms.every((room) => room.geometry.polygon.every(inside)));
  assert.equal(model.connections.length, 5);
  assert.equal(model.furniture.length, 9);
  assert.equal(model.landmarks.length, 2);
  assert.deepEqual(roomStatusLabels, {
    unresolved: "THE LOCK HOLDS",
    cleared: "RELEASED",
    unentered: "",
  });
});

import { getPinById, pins } from "../pins";
import type { GameState, ZoneId } from "../types";
import type {
  FurnitureRecord,
  MapLandmark,
  MapSegment,
  MapViewBox,
  OpeningBounds,
  RoomConnection,
  RoomDefinition,
  RoomState,
  RoomStatus,
  RoomStatusLabel,
  SurveyMapModel,
} from "./types";

const BALCONY_UNLOCK_PIN = 16;

export const mapViewBox: MapViewBox = {
  x: 0,
  y: 0,
  width: 680,
  height: 500,
};

export function openingCenterline(opening: OpeningBounds): MapSegment {
  if (opening.axis === "horizontal") {
    const y = opening.y + opening.height / 2;
    return {
      start: { x: opening.x, y },
      end: { x: opening.x + opening.width, y },
    };
  }

  const x = opening.x + opening.width / 2;
  return {
    start: { x, y: opening.y },
    end: { x, y: opening.y + opening.height },
  };
}

export const roomStatusLabels: Readonly<Record<RoomStatus, RoomStatusLabel>> = {
  unresolved: "THE LOCK HOLDS",
  cleared: "RELEASED",
  unentered: "",
};

export const roomDefinitions: readonly RoomDefinition[] = [
  {
    id: "kitchen",
    label: "KITCHEN",
    role: "room",
    geometry: {
      polygon: [
        { x: 250, y: 40 },
        { x: 460, y: 40 },
        { x: 460, y: 150 },
        { x: 250, y: 150 },
      ],
      labelPoint: { x: 355, y: 118 },
    },
  },
  {
    id: "entry",
    label: "ENTRY",
    role: "hub",
    geometry: {
      polygon: [
        { x: 250, y: 170 },
        { x: 445, y: 170 },
        { x: 445, y: 295 },
        { x: 250, y: 295 },
      ],
      labelPoint: { x: 345, y: 250 },
    },
  },
  {
    id: "living",
    label: "LIVING",
    role: "room",
    geometry: {
      polygon: [
        { x: 60, y: 170 },
        { x: 245, y: 170 },
        { x: 245, y: 420 },
        { x: 60, y: 420 },
      ],
      labelPoint: { x: 155, y: 350 },
    },
  },
  {
    id: "balcony",
    label: "BALCONY",
    role: "room",
    geometry: {
      polygon: [
        { x: 20, y: 200 },
        { x: 55, y: 200 },
        { x: 55, y: 310 },
        { x: 20, y: 310 },
      ],
      labelPoint: { x: 37.5, y: 255 },
      labelRotation: -90,
    },
  },
  {
    id: "corridor",
    label: "CORRIDOR",
    role: "room",
    geometry: {
      polygon: [
        { x: 290, y: 300 },
        { x: 445, y: 300 },
        { x: 445, y: 480 },
        { x: 290, y: 480 },
      ],
      labelPoint: { x: 386, y: 335 },
    },
  },
  {
    id: "bathroom",
    label: "BATHROOM",
    role: "room",
    geometry: {
      polygon: [
        { x: 450, y: 350 },
        { x: 640, y: 350 },
        { x: 640, y: 480 },
        { x: 450, y: 480 },
      ],
      labelPoint: { x: 535, y: 410 },
    },
  },
];

export const roomConnections: readonly RoomConnection[] = [
  {
    id: "living-entry",
    rooms: ["living", "entry"],
    passage: "open",
    opening: { x: 243, y: 225, width: 9, height: 60, axis: "vertical" },
  },
  {
    id: "kitchen-entry",
    rooms: ["kitchen", "entry"],
    passage: "door",
    opening: { x: 424, y: 150, width: 18, height: 20, axis: "horizontal" },
    door: {
      threshold: { start: { x: 424, y: 160 }, end: { x: 442, y: 160 } },
      hinge: { x: 424, y: 160 },
      openLeafEnd: { x: 424, y: 142 },
    },
  },
  {
    id: "corridor-entry",
    rooms: ["corridor", "entry"],
    passage: "open",
    opening: { x: 388, y: 293, width: 44, height: 9, axis: "horizontal" },
  },
  {
    id: "bathroom-corridor",
    rooms: ["bathroom", "corridor"],
    passage: "door",
    opening: { x: 443, y: 400, width: 9, height: 44, axis: "vertical" },
    door: {
      threshold: { start: { x: 447.5, y: 400 }, end: { x: 447.5, y: 444 } },
      hinge: { x: 447.5, y: 444 },
      openLeafEnd: { x: 403.5, y: 444 },
    },
  },
  {
    id: "balcony-living",
    rooms: ["balcony", "living"],
    passage: "door",
    opening: { x: 53, y: 240, width: 9, height: 40, axis: "vertical" },
    door: {
      threshold: { start: { x: 57.5, y: 240 }, end: { x: 57.5, y: 280 } },
      hinge: { x: 57.5, y: 240 },
      openLeafEnd: { x: 97.5, y: 240 },
    },
  },
];

export const mapFurniture: readonly FurnitureRecord[] = [
  {
    id: "living-table",
    room: "living",
    kind: "table",
    label: "TABLE",
    footprint: [
      { x: 70, y: 186 },
      { x: 128, y: 186 },
      { x: 128, y: 218 },
      { x: 70, y: 218 },
    ],
    labelPoint: { x: 99, y: 207 },
    detailSegments: [
      { start: { x: 76, y: 218 }, end: { x: 74, y: 224 } },
      { start: { x: 122, y: 218 }, end: { x: 124, y: 224 } },
    ],
  },
  {
    // A real KALLAX 4x4: a square of sixteen mouths against the wall.
    id: "living-kallax",
    room: "living",
    kind: "kallax",
    label: "KALLAX",
    footprint: [
      { x: 170, y: 176 },
      { x: 236, y: 176 },
      { x: 236, y: 242 },
      { x: 170, y: 242 },
    ],
    labelPoint: { x: 203, y: 254 },
    detailSegments: [
      { start: { x: 186.5, y: 176 }, end: { x: 186.5, y: 242 } },
      { start: { x: 203, y: 176 }, end: { x: 203, y: 242 } },
      { start: { x: 219.5, y: 176 }, end: { x: 219.5, y: 242 } },
      { start: { x: 170, y: 192.5 }, end: { x: 236, y: 192.5 } },
      { start: { x: 170, y: 209 }, end: { x: 236, y: 209 } },
      { start: { x: 170, y: 225.5 }, end: { x: 236, y: 225.5 } },
    ],
  },
  {
    id: "living-sectional",
    room: "living",
    kind: "sectional",
    label: "SECTIONAL",
    profile: "notched",
    footprint: [
      { x: 85, y: 265 },
      { x: 230, y: 265 },
      { x: 230, y: 327 },
      { x: 188, y: 327 },
      { x: 188, y: 300 },
      { x: 128, y: 300 },
      { x: 128, y: 327 },
      { x: 85, y: 327 },
    ],
    labelPoint: { x: 158, y: 287 },
  },
  {
    id: "living-tv",
    room: "living",
    kind: "television",
    label: "TV UNIT",
    footprint: [
      { x: 95, y: 386 },
      { x: 215, y: 386 },
      { x: 215, y: 410 },
      { x: 95, y: 410 },
    ],
    labelPoint: { x: 155, y: 402 },
  },
  {
    id: "entry-clothes-hanger",
    room: "entry",
    kind: "clothes-hanger",
    label: "CLOTHES HANGER",
    footprint: [
      { x: 300, y: 176 },
      { x: 420, y: 176 },
      { x: 420, y: 190 },
      { x: 300, y: 190 },
    ],
    labelPoint: { x: 360, y: 187 },
    detailSegments: [
      { start: { x: 320, y: 176 }, end: { x: 320, y: 190 } },
      { start: { x: 340, y: 176 }, end: { x: 340, y: 190 } },
      { start: { x: 380, y: 176 }, end: { x: 380, y: 190 } },
      { start: { x: 400, y: 176 }, end: { x: 400, y: 190 } },
    ],
  },
  {
    id: "corridor-left-cupboard",
    room: "corridor",
    kind: "cupboard",
    label: "THIN CUPBOARD",
    profile: "full-height-thin-left",
    footprint: [
      { x: 296, y: 306 },
      { x: 330, y: 306 },
      { x: 330, y: 474 },
      { x: 296, y: 474 },
    ],
    labelPoint: { x: 335, y: 320 },
    labelAnchor: "start",
    detailSegments: [
      { start: { x: 302, y: 330 }, end: { x: 324, y: 330 } },
      { start: { x: 302, y: 354 }, end: { x: 324, y: 354 } },
      { start: { x: 302, y: 378 }, end: { x: 324, y: 378 } },
      { start: { x: 302, y: 402 }, end: { x: 324, y: 402 } },
      { start: { x: 302, y: 426 }, end: { x: 324, y: 426 } },
      { start: { x: 302, y: 450 }, end: { x: 324, y: 450 } },
    ],
  },
  {
    id: "bathroom-mirror",
    room: "bathroom",
    kind: "mirror",
    label: "MIRROR",
    footprint: [
      { x: 624, y: 362 },
      { x: 638, y: 362 },
      { x: 638, y: 412 },
      { x: 624, y: 412 },
    ],
    labelPoint: { x: 619, y: 389 },
    labelAnchor: "end",
  },
  {
    id: "bathroom-cabinet",
    room: "bathroom",
    kind: "cabinet",
    label: "CABINET",
    footprint: [
      { x: 624, y: 425 },
      { x: 638, y: 425 },
      { x: 638, y: 475 },
      { x: 624, y: 475 },
    ],
    labelPoint: { x: 619, y: 452 },
    labelAnchor: "end",
  },
  {
    id: "kitchen-counter-hob",
    room: "kitchen",
    kind: "counter-hob",
    label: "COUNTER / HOB",
    footprint: [
      { x: 256, y: 72 },
      { x: 454, y: 72 },
      { x: 454, y: 88 },
      { x: 256, y: 88 },
    ],
    labelPoint: { x: 355, y: 84 },
    detailSegments: [
      { start: { x: 320, y: 72 }, end: { x: 320, y: 88 } },
      { start: { x: 390, y: 72 }, end: { x: 390, y: 88 } },
    ],
  },
];

export const mapLandmarks: readonly MapLandmark[] = [
  {
    id: "start",
    kind: "start",
    room: "corridor",
    label: "THE TERMINAL",
    placement: "far-end",
    point: { x: 385, y: 460 },
    radius: 10,
    crossHalfSpan: 16,
    labelPoint: { x: 385, y: 440 },
  },
  {
    id: "front-door",
    kind: "sealed-exit",
    room: "entry",
    label: "FRONT DOOR // SEALED",
    permanentlySealed: true,
    opening: { x: 443, y: 216, width: 4, height: 32, axis: "vertical" },
    threshold: { start: { x: 445, y: 216 }, end: { x: 445, y: 248 } },
    outline: [
      { x: 445, y: 216 },
      { x: 477, y: 216 },
      { x: 477, y: 248 },
      { x: 445, y: 248 },
    ],
    sealBars: [
      { start: { x: 453, y: 220 }, end: { x: 453, y: 244 } },
      { start: { x: 461, y: 220 }, end: { x: 461, y: 244 } },
      { start: { x: 469, y: 220 }, end: { x: 469, y: 244 } },
    ],
    labelPoint: { x: 523, y: 236 },
  },
];

function enteredRooms(state: GameState): ReadonlySet<ZoneId> {
  const entered = new Set<ZoneId>(["corridor"]);

  for (const pinId of state.resolvedPins) {
    const pin = getPinById(pinId);
    if (pin) entered.add(pin.zone);
  }

  // The room she is searching RIGHT NOW reads as active, not unentered.
  const resolved = new Set(state.resolvedPins);
  const nextPin = pins.find((pin) => !resolved.has(pin.id));
  if (nextPin) entered.add(nextPin.zone);

  return entered;
}

export function deriveRoomStates(state: GameState): readonly RoomState[] {
  const entered = enteredRooms(state);
  const cleared = new Set(state.clearedZones);
  const balconyLocked = !state.resolvedPins.includes(BALCONY_UNLOCK_PIN);

  return roomDefinitions.map((room) => {
    const status: RoomStatus = cleared.has(room.id)
      ? "cleared"
      : entered.has(room.id)
        ? "unresolved"
        : "unentered";

    return {
      ...room,
      status,
      statusLabel: roomStatusLabels[status],
      outlineLocked: room.id === "balcony" && balconyLocked,
    };
  });
}

/** The room the search is in right now: the first unresolved pin's zone. */
export function deriveObjectiveZone(state: GameState): ZoneId | null {
  const resolved = new Set(state.resolvedPins);
  const nextPin = pins.find((pin) => !resolved.has(pin.id));
  return nextPin?.zone ?? null;
}

export function deriveSurveyMap(state: GameState): SurveyMapModel {
  return {
    viewBox: mapViewBox,
    rooms: deriveRoomStates(state),
    connections: roomConnections,
    furniture: mapFurniture,
    landmarks: mapLandmarks,
    objectiveZone: deriveObjectiveZone(state),
  };
}

import { getPinById } from "../pins";
import type { GameState, ZoneId } from "../types";
import type {
  FurnitureRecord,
  MapLandmark,
  MapViewBox,
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
  width: 900,
  height: 600,
};

export const roomStatusLabels: Readonly<Record<RoomStatus, RoomStatusLabel>> = {
  unresolved: "UNRESOLVED",
  cleared: "CLEARED",
  unentered: "UNENTERED",
};

export const roomDefinitions: readonly RoomDefinition[] = [
  {
    id: "corridor",
    label: "CORRIDOR",
    role: "room",
    geometry: {
      polygon: [
        { x: 39, y: 338 },
        { x: 340, y: 341 },
        { x: 338, y: 481 },
        { x: 41, y: 478 },
      ],
      labelPoint: { x: 190, y: 401 },
    },
  },
  {
    id: "bathroom",
    label: "BATHROOM",
    role: "room",
    geometry: {
      polygon: [
        { x: 169, y: 166 },
        { x: 342, y: 169 },
        { x: 340, y: 341 },
        { x: 171, y: 338 },
      ],
      labelPoint: { x: 255, y: 238 },
    },
  },
  {
    id: "entry",
    label: "ENTRY",
    role: "hub",
    geometry: {
      polygon: [
        { x: 339, y: 300 },
        { x: 493, y: 303 },
        { x: 490, y: 482 },
        { x: 338, y: 480 },
      ],
      labelPoint: { x: 414, y: 369 },
    },
  },
  {
    id: "living",
    label: "LIVING",
    role: "room",
    geometry: {
      polygon: [
        { x: 490, y: 168 },
        { x: 772, y: 171 },
        { x: 770, y: 482 },
        { x: 490, y: 480 },
      ],
      labelPoint: { x: 632, y: 226 },
    },
  },
  {
    id: "balcony",
    label: "BALCONY",
    role: "room",
    geometry: {
      polygon: [
        { x: 771, y: 189 },
        { x: 879, y: 191 },
        { x: 876, y: 462 },
        { x: 770, y: 460 },
      ],
      labelPoint: { x: 824, y: 242 },
    },
  },
  {
    id: "kitchen",
    label: "KITCHEN",
    role: "room",
    geometry: {
      polygon: [
        { x: 339, y: 67 },
        { x: 493, y: 70 },
        { x: 491, y: 303 },
        { x: 340, y: 300 },
      ],
      labelPoint: { x: 416, y: 137 },
    },
  },
];

export const roomConnections: readonly RoomConnection[] = [
  {
    id: "living-entry",
    rooms: ["living", "entry"],
    passage: "open",
    opening: { start: { x: 490, y: 350 }, end: { x: 490, y: 425 } },
  },
  {
    id: "kitchen-entry",
    rooms: ["kitchen", "entry"],
    passage: "door",
    opening: { start: { x: 398, y: 301 }, end: { x: 444, y: 301 } },
    door: {
      threshold: { start: { x: 398, y: 301 }, end: { x: 444, y: 301 } },
      hinge: { x: 398, y: 301 },
      openLeafEnd: { x: 398, y: 255 },
    },
  },
  {
    id: "corridor-entry",
    rooms: ["corridor", "entry"],
    passage: "open",
    opening: { start: { x: 339, y: 385 }, end: { x: 339, y: 445 } },
  },
  {
    id: "bathroom-corridor",
    rooms: ["bathroom", "corridor"],
    passage: "door",
    opening: { start: { x: 230, y: 340 }, end: { x: 276, y: 340 } },
    door: {
      threshold: { start: { x: 230, y: 340 }, end: { x: 276, y: 340 } },
      hinge: { x: 230, y: 340 },
      openLeafEnd: { x: 230, y: 294 },
    },
  },
  {
    id: "balcony-living",
    rooms: ["balcony", "living"],
    passage: "door",
    opening: { start: { x: 771, y: 279 }, end: { x: 771, y: 331 } },
    door: {
      threshold: { start: { x: 771, y: 279 }, end: { x: 771, y: 331 } },
      hinge: { x: 771, y: 279 },
      openLeafEnd: { x: 719, y: 279 },
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
      { x: 593, y: 275 },
      { x: 692, y: 275 },
      { x: 692, y: 336 },
      { x: 593, y: 336 },
    ],
    labelPoint: { x: 642, y: 311 },
    detailSegments: [
      { start: { x: 602, y: 336 }, end: { x: 598, y: 350 } },
      { start: { x: 683, y: 336 }, end: { x: 688, y: 350 } },
    ],
  },
  {
    id: "living-kallax",
    room: "living",
    kind: "kallax",
    label: "KALLAX",
    footprint: [
      { x: 508, y: 187 },
      { x: 554, y: 187 },
      { x: 554, y: 291 },
      { x: 508, y: 291 },
    ],
    labelPoint: { x: 531, y: 305 },
    detailSegments: [
      { start: { x: 508, y: 221 }, end: { x: 554, y: 221 } },
      { start: { x: 508, y: 256 }, end: { x: 554, y: 256 } },
      { start: { x: 531, y: 187 }, end: { x: 531, y: 291 } },
    ],
  },
  {
    id: "living-sectional",
    room: "living",
    kind: "sectional",
    label: "SECTIONAL",
    profile: "notched",
    footprint: [
      { x: 564, y: 421 },
      { x: 736, y: 421 },
      { x: 736, y: 350 },
      { x: 688, y: 350 },
      { x: 688, y: 389 },
      { x: 622, y: 389 },
      { x: 622, y: 350 },
      { x: 564, y: 350 },
    ],
    labelPoint: { x: 648, y: 448 },
  },
  {
    id: "living-tv",
    room: "living",
    kind: "television",
    label: "TV",
    footprint: [
      { x: 698, y: 188 },
      { x: 755, y: 188 },
      { x: 755, y: 216 },
      { x: 698, y: 216 },
    ],
    labelPoint: { x: 726, y: 207 },
    detailSegments: [
      { start: { x: 706, y: 221 }, end: { x: 747, y: 221 } },
    ],
  },
  {
    id: "entry-clothes-hanger",
    room: "entry",
    kind: "clothes-hanger",
    label: "CLOTHES HANGER",
    footprint: [
      { x: 375, y: 325 },
      { x: 383, y: 325 },
      { x: 383, y: 401 },
      { x: 375, y: 401 },
    ],
    labelPoint: { x: 379, y: 416 },
    detailSegments: [
      { start: { x: 366, y: 346 }, end: { x: 379, y: 325 } },
      { start: { x: 379, y: 325 }, end: { x: 392, y: 346 } },
      { start: { x: 363, y: 363 }, end: { x: 395, y: 363 } },
      { start: { x: 368, y: 401 }, end: { x: 390, y: 401 } },
    ],
  },
  {
    id: "corridor-left-cupboard",
    room: "corridor",
    kind: "cupboard",
    label: "THIN CUPBOARD",
    profile: "full-height-thin-left",
    footprint: [
      { x: 51, y: 352 },
      { x: 80, y: 353 },
      { x: 78, y: 464 },
      { x: 49, y: 462 },
    ],
    labelPoint: { x: 91, y: 458 },
    labelAnchor: "start",
    detailSegments: [
      { start: { x: 56, y: 367 }, end: { x: 74, y: 367 } },
      { start: { x: 56, y: 383 }, end: { x: 74, y: 383 } },
      { start: { x: 56, y: 399 }, end: { x: 74, y: 399 } },
      { start: { x: 56, y: 415 }, end: { x: 74, y: 415 } },
      { start: { x: 56, y: 431 }, end: { x: 74, y: 431 } },
      { start: { x: 56, y: 447 }, end: { x: 74, y: 447 } },
    ],
  },
  {
    id: "bathroom-mirror",
    room: "bathroom",
    kind: "mirror",
    label: "MIRROR",
    footprint: [
      { x: 185, y: 181 },
      { x: 275, y: 181 },
      { x: 275, y: 198 },
      { x: 185, y: 198 },
    ],
    labelPoint: { x: 230, y: 194 },
  },
  {
    id: "bathroom-cabinet",
    room: "bathroom",
    kind: "cabinet",
    label: "CABINET",
    footprint: [
      { x: 189, y: 202 },
      { x: 271, y: 202 },
      { x: 271, y: 216 },
      { x: 189, y: 216 },
    ],
    labelPoint: { x: 230, y: 214 },
  },
];

export const mapLandmarks: readonly MapLandmark[] = [
  {
    id: "start",
    kind: "start",
    room: "corridor",
    label: "START // FAR END",
    placement: "far-end",
    point: { x: 109, y: 414 },
    radius: 16,
    crossHalfSpan: 26,
    labelPoint: { x: 109, y: 452 },
  },
  {
    id: "front-door",
    kind: "sealed-exit",
    room: "entry",
    label: "FRONT DOOR // SEALED",
    permanentlySealed: true,
    threshold: { start: { x: 384, y: 481 }, end: { x: 442, y: 481 } },
    outline: [
      { x: 385, y: 481 },
      { x: 385, y: 532 },
      { x: 441, y: 532 },
      { x: 441, y: 481 },
    ],
    sealBars: [
      { start: { x: 398, y: 486 }, end: { x: 398, y: 527 } },
      { start: { x: 412, y: 486 }, end: { x: 412, y: 527 } },
      { start: { x: 427, y: 486 }, end: { x: 427, y: 527 } },
    ],
    labelPoint: { x: 413, y: 548 },
  },
];

function enteredRooms(state: GameState): ReadonlySet<ZoneId> {
  const entered = new Set<ZoneId>(["corridor"]);

  for (const pinId of state.resolvedPins) {
    const pin = getPinById(pinId);
    if (pin) entered.add(pin.zone);
  }

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

export function deriveSurveyMap(state: GameState): SurveyMapModel {
  return {
    viewBox: mapViewBox,
    rooms: deriveRoomStates(state),
    connections: roomConnections,
    furniture: mapFurniture,
    landmarks: mapLandmarks,
  };
}

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
  SurveyMapModel,
} from "./types";

const BALCONY_UNLOCK_PIN = 16;

export const mapViewBox: MapViewBox = {
  x: 0,
  y: 0,
  width: 360,
  height: 480,
};

export const roomStatusLabels: Readonly<Record<RoomStatus, string>> = {
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
        { x: 20, y: 340 },
        { x: 160, y: 340 },
        { x: 160, y: 440 },
        { x: 20, y: 440 },
      ],
      labelPoint: { x: 90, y: 392 },
    },
  },
  {
    id: "bathroom",
    label: "BATHROOM",
    role: "room",
    geometry: {
      polygon: [
        { x: 80, y: 140 },
        { x: 160, y: 140 },
        { x: 160, y: 340 },
        { x: 80, y: 340 },
      ],
      labelPoint: { x: 120, y: 245 },
    },
  },
  {
    id: "entry",
    label: "ENTRY",
    role: "hub",
    geometry: {
      polygon: [
        { x: 160, y: 340 },
        { x: 220, y: 340 },
        { x: 220, y: 440 },
        { x: 160, y: 440 },
      ],
      labelPoint: { x: 190, y: 392 },
    },
  },
  {
    id: "living",
    label: "LIVING ROOM",
    role: "room",
    geometry: {
      polygon: [
        { x: 220, y: 220 },
        { x: 330, y: 220 },
        { x: 330, y: 440 },
        { x: 220, y: 440 },
      ],
      labelPoint: { x: 275, y: 335 },
    },
  },
  {
    id: "balcony",
    label: "BALCONY",
    role: "room",
    geometry: {
      polygon: [
        { x: 330, y: 220 },
        { x: 356, y: 220 },
        { x: 356, y: 440 },
        { x: 330, y: 440 },
      ],
      labelPoint: { x: 343, y: 335 },
    },
  },
  {
    id: "kitchen",
    label: "KITCHEN",
    role: "room",
    geometry: {
      polygon: [
        { x: 160, y: 140 },
        { x: 220, y: 140 },
        { x: 220, y: 340 },
        { x: 160, y: 340 },
      ],
      labelPoint: { x: 190, y: 245 },
    },
  },
];

export const roomConnections: readonly RoomConnection[] = [
  {
    id: "living-entry",
    rooms: ["living", "entry"],
    passage: "open",
    opening: { start: { x: 220, y: 360 }, end: { x: 220, y: 415 } },
  },
  {
    id: "kitchen-entry",
    rooms: ["kitchen", "entry"],
    passage: "door",
    opening: { start: { x: 174, y: 340 }, end: { x: 204, y: 340 } },
    door: {
      threshold: { start: { x: 174, y: 340 }, end: { x: 204, y: 340 } },
      hinge: { x: 174, y: 340 },
      openLeafEnd: { x: 174, y: 310 },
    },
  },
  {
    id: "corridor-entry",
    rooms: ["corridor", "entry"],
    passage: "open",
    opening: { start: { x: 160, y: 365 }, end: { x: 160, y: 415 } },
  },
  {
    id: "bathroom-corridor",
    rooms: ["bathroom", "corridor"],
    passage: "door",
    opening: { start: { x: 105, y: 340 }, end: { x: 135, y: 340 } },
    door: {
      threshold: { start: { x: 105, y: 340 }, end: { x: 135, y: 340 } },
      hinge: { x: 105, y: 340 },
      openLeafEnd: { x: 105, y: 310 },
    },
  },
  {
    id: "balcony-living",
    rooms: ["balcony", "living"],
    passage: "door",
    opening: { start: { x: 330, y: 300 }, end: { x: 330, y: 345 } },
    door: {
      threshold: { start: { x: 330, y: 300 }, end: { x: 330, y: 345 } },
      hinge: { x: 330, y: 300 },
      openLeafEnd: { x: 300, y: 300 },
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
      { x: 252, y: 292 },
      { x: 292, y: 292 },
      { x: 292, y: 324 },
      { x: 252, y: 324 },
    ],
    labelPoint: { x: 272, y: 308 },
  },
  {
    id: "living-kallax",
    room: "living",
    kind: "kallax",
    label: "KALLAX",
    footprint: [
      { x: 224, y: 235 },
      { x: 236, y: 235 },
      { x: 236, y: 292 },
      { x: 224, y: 292 },
    ],
    labelPoint: { x: 230, y: 264 },
  },
  {
    id: "living-sectional",
    room: "living",
    kind: "sectional",
    label: "SECTIONAL",
    profile: "notched",
    footprint: [
      { x: 246, y: 374 },
      { x: 320, y: 374 },
      { x: 320, y: 426 },
      { x: 296, y: 426 },
      { x: 296, y: 398 },
      { x: 246, y: 398 },
    ],
    labelPoint: { x: 282, y: 388 },
  },
  {
    id: "living-tv",
    room: "living",
    kind: "television",
    label: "TV",
    footprint: [
      { x: 282, y: 226 },
      { x: 320, y: 226 },
      { x: 320, y: 235 },
      { x: 282, y: 235 },
    ],
    labelPoint: { x: 301, y: 231 },
  },
  {
    id: "entry-clothes-hanger",
    room: "entry",
    kind: "clothes-hanger",
    label: "CLOTHES HANGER",
    footprint: [
      { x: 165, y: 350 },
      { x: 174, y: 350 },
      { x: 174, y: 379 },
      { x: 165, y: 379 },
    ],
    labelPoint: { x: 170, y: 365 },
  },
  {
    id: "corridor-left-cupboard",
    room: "corridor",
    kind: "cupboard",
    label: "CUPBOARD",
    profile: "full-height-thin-left",
    footprint: [
      { x: 24, y: 344 },
      { x: 36, y: 344 },
      { x: 36, y: 436 },
      { x: 24, y: 436 },
    ],
    labelPoint: { x: 30, y: 390 },
  },
  {
    id: "bathroom-mirror",
    room: "bathroom",
    kind: "mirror",
    label: "MIRROR",
    footprint: [
      { x: 85, y: 146 },
      { x: 125, y: 146 },
      { x: 125, y: 153 },
      { x: 85, y: 153 },
    ],
    labelPoint: { x: 105, y: 150 },
  },
  {
    id: "bathroom-cabinet",
    room: "bathroom",
    kind: "cabinet",
    label: "CABINET",
    footprint: [
      { x: 137, y: 160 },
      { x: 155, y: 160 },
      { x: 155, y: 215 },
      { x: 137, y: 215 },
    ],
    labelPoint: { x: 146, y: 188 },
  },
];

export const mapLandmarks: readonly MapLandmark[] = [
  {
    id: "start",
    kind: "start",
    room: "corridor",
    label: "START",
    placement: "far-end",
    point: { x: 52, y: 420 },
  },
  {
    id: "front-door",
    kind: "sealed-exit",
    room: "entry",
    label: "FRONT DOOR // SEALED",
    permanentlySealed: true,
    threshold: { start: { x: 174, y: 440 }, end: { x: 206, y: 440 } },
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

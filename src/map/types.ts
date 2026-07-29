import type { ZoneId } from "../types";

export type RoomStatus = "unresolved" | "cleared" | "unentered";

export interface MapPoint {
  x: number;
  y: number;
}

export interface MapSegment {
  start: MapPoint;
  end: MapPoint;
}

export interface RoomGeometry {
  polygon: readonly MapPoint[];
  labelPoint: MapPoint;
}

export interface RoomDefinition {
  id: ZoneId;
  label: string;
  role: "hub" | "room";
  geometry: RoomGeometry;
}

export interface RoomState extends RoomDefinition {
  status: RoomStatus;
  statusLabel: string;
  /** A visual outline treatment only; it deliberately carries no unlock ID. */
  outlineLocked: boolean;
}

export type PassageKind = "open" | "door";

export interface DoorGeometry {
  threshold: MapSegment;
  hinge: MapPoint;
  openLeafEnd: MapPoint;
}

export interface RoomConnection {
  id: string;
  rooms: readonly [ZoneId, ZoneId];
  passage: PassageKind;
  opening: MapSegment;
  door?: DoorGeometry;
}

export type FurnitureKind =
  | "table"
  | "kallax"
  | "sectional"
  | "television"
  | "clothes-hanger"
  | "cupboard"
  | "mirror"
  | "cabinet";

export interface FurnitureRecord {
  id: string;
  room: ZoneId;
  kind: FurnitureKind;
  label: string;
  footprint: readonly MapPoint[];
  labelPoint: MapPoint;
  profile?: "notched" | "full-height-thin-left";
}

export interface StartLandmark {
  id: "start";
  kind: "start";
  room: "corridor";
  label: string;
  placement: "far-end";
  point: MapPoint;
}

export interface FrontDoorLandmark {
  id: "front-door";
  kind: "sealed-exit";
  room: "entry";
  label: string;
  permanentlySealed: true;
  threshold: MapSegment;
}

export type MapLandmark = StartLandmark | FrontDoorLandmark;

export interface MapViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SurveyMapModel {
  viewBox: MapViewBox;
  rooms: readonly RoomState[];
  connections: readonly RoomConnection[];
  furniture: readonly FurnitureRecord[];
  landmarks: readonly MapLandmark[];
}

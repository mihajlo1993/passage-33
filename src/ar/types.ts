export type ImageArSheetId = "sheet01" | "sheet02";
export type ImageArPinId = 3 | 17;
export type ImageArTone = "threatening" | "calm";
export type ImageArMotion = "peel" | "reach" | "pulse" | "lift";

/**
 * Pins 3 and 17 are deliberately simple screen-space placements. The scanned
 * QR supplies the sheet identity, and the player chooses the sprite origin by
 * tapping the camera view. They share no state with room-scale WebXR.
 */
export interface ImageArSceneDefinition {
  readonly mechanism: "image";
  readonly sheetId: ImageArSheetId;
  readonly pinId: ImageArPinId;
  readonly tone: ImageArTone;
  readonly subject: "wall" | "herb";
  readonly motions: readonly ImageArMotion[];
}

export interface RoomArSceneDefinition {
  readonly mechanism: "room";
  readonly pinId: 18;
}

/** Plain numeric placement contract; the pure reducer never imports Three. */
export interface RoomArPlacement {
  readonly xMeters: number;
  readonly yMeters: number;
  readonly zMeters: number;
  readonly yawRadians: number;
}

export type RoomArPlacementMode = "world" | "fallback2d";

export type RoomArPhase =
  | "idle"
  | "initializing"
  | "tracking"
  | "acquired"
  | "fallback2d"
  | "placed"
  | "firing"
  | "hit"
  | "collapsing"
  | "completed"
  | "cancelled"
  | "cleanedUp";

export interface RoomArState {
  readonly mechanism: "room";
  readonly scene: RoomArSceneDefinition;
  readonly phase: RoomArPhase;
  readonly initializedAtMs: number | null;
  /** Latest hit-test pose before placement; never becomes the placement itself. */
  readonly candidatePlacement: RoomArPlacement | null;
  /** Locked by the first valid placement and immutable for the session. */
  readonly placement: RoomArPlacement | null;
  readonly placementMode: RoomArPlacementMode | null;
  readonly placedAtMs: number | null;
  readonly shotFiredAtMs: number | null;
  readonly hitAtMs: number | null;
  readonly collapseStartedAtMs: number | null;
  readonly completedAtMs: number | null;
  readonly fallbackReason: string | null;
  readonly cancellationReason: string | null;
}

export type RoomArEvent =
  | { readonly type: "initialize"; readonly atMs: number }
  | { readonly type: "tracking" }
  | {
      readonly type: "acquired";
      readonly placement: RoomArPlacement;
    }
  | { readonly type: "lost" }
  | { readonly type: "tick"; readonly atMs: number }
  | { readonly type: "fallback"; readonly reason?: string }
  | { readonly type: "tap-place"; readonly atMs: number }
  | { readonly type: "fire"; readonly atMs: number }
  | { readonly type: "hit"; readonly atMs: number }
  | { readonly type: "collapse"; readonly atMs: number }
  | { readonly type: "complete"; readonly atMs: number }
  | { readonly type: "cancel"; readonly reason?: string }
  | { readonly type: "cleanup" };

export type WebXrRequiredFeature = "hit-test" | "dom-overlay";

/** Structural session-init type that remains usable without DOM/WebXR globals. */
export interface RoomWebXrSessionInit<TRoot> {
  requiredFeatures: WebXrRequiredFeature[];
  domOverlay: {
    root: TRoot;
  };
}

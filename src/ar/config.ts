import type {
  ImageArSceneDefinition,
  ImageArSheetId,
  RoomArSceneDefinition,
  RoomWebXrSessionInit,
  WebXrRequiredFeature,
} from "./types";
import { effects, motion } from "../tokens";

export const ROOM_AR_ACQUISITION_TIMEOUT_MS = motion.eventMs.arAcquire;
export const AR_MAX_FPS = effects.ar.maxFps;
export const AR_FRAME_INTERVAL_MS = 1_000 / AR_MAX_FPS;

export const WEBXR_SESSION_MODE = "immersive-ar" as const;
export const WEBXR_REQUIRED_FEATURES: readonly WebXrRequiredFeature[] =
  Object.freeze(["hit-test", "dom-overlay"]);

/** Full standing height used to scale the pin 18 room monster. */
export const ROOM_MONSTER_SCALE_METERS = effects.ar.monsterHeightMeters;

const sheet01Scene: ImageArSceneDefinition = Object.freeze({
  mechanism: "image",
  sheetId: "sheet01",
  pinId: 3,
  tone: "threatening",
  subject: "wall",
  motions: Object.freeze(["peel", "reach"] as const),
});

const sheet02Scene: ImageArSceneDefinition = Object.freeze({
  mechanism: "image",
  sheetId: "sheet02",
  pinId: 17,
  tone: "calm",
  subject: "herb",
  motions: Object.freeze(["pulse", "lift"] as const),
});

export const IMAGE_AR_SCENES: Readonly<
  Record<ImageArSheetId, ImageArSceneDefinition>
> = Object.freeze({
  sheet01: sheet01Scene,
  sheet02: sheet02Scene,
});

export const ROOM_AR_SCENE: RoomArSceneDefinition = Object.freeze({
  mechanism: "room",
  pinId: 18,
});

export function getImageArScene(
  sheetId: ImageArSheetId,
): ImageArSceneDefinition {
  return IMAGE_AR_SCENES[sheetId];
}

/**
 * Builds the browser-facing session init without reading browser globals. The
 * caller supplies its own overlay root from the React screen.
 */
export function createRoomWebXrSessionInit<TRoot>(
  root: TRoot,
): RoomWebXrSessionInit<TRoot> {
  return {
    requiredFeatures: [...WEBXR_REQUIRED_FEATURES],
    domOverlay: { root },
  };
}

export function hasRoomArAcquisitionTimedOut(
  initializedAtMs: number | null,
  nowMs: number,
): boolean {
  if (
    initializedAtMs === null
    || !Number.isFinite(initializedAtMs)
    || !Number.isFinite(nowMs)
    || nowMs < initializedAtMs
  ) {
    return false;
  }

  return nowMs - initializedAtMs >= ROOM_AR_ACQUISITION_TIMEOUT_MS;
}

export function isArFrameDue(
  timestampMs: number,
  lastFrameAtMs: number | null,
): boolean {
  if (!Number.isFinite(timestampMs)) return false;
  if (lastFrameAtMs === null || !Number.isFinite(lastFrameAtMs)) return true;
  if (timestampMs < lastFrameAtMs) return true;
  return timestampMs - lastFrameAtMs >= AR_FRAME_INTERVAL_MS;
}

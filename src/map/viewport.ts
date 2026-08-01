import { layout, motion } from "../tokens";
import { mapViewBox } from "./model";

/*
 * Pure math for the survey viewport. The browser owns panning (a native
 * scroll surface, which cannot break); these helpers own everything else:
 * the fit size that shows the WHOLE flat at minimum zoom, zoom clamps,
 * scroll compensation so a zoom keeps its focal point still, pinch zoom
 * from two-finger distances, and tap/double-tap classification.
 */

export interface MapViewportPoint {
  x: number;
  y: number;
}

export interface MapViewportSize {
  width: number;
  height: number;
}

export interface MapScrollState {
  scrollLeft: number;
  scrollTop: number;
  clientWidth: number;
  clientHeight: number;
}

export interface MapTap {
  point: MapViewportPoint;
  atMs: number;
}

export interface MapTapRegistration {
  isDoubleTap: boolean;
  nextTap: MapTap | null;
}

export const MAP_MIN_ZOOM = 1;
export const MAP_MAX_ZOOM = 5;
export const MAP_VIEWPORT_MAX_FPS = 30;
export const MAP_VIEWPORT_FRAME_INTERVAL_MS = 1_000 / MAP_VIEWPORT_MAX_FPS;
export const MAP_CONTENT_ASPECT_RATIO = mapViewBox.width / mapViewBox.height;
export const MAP_DOUBLE_TAP_ZOOM_SCALE = 2;

export const MAP_DOUBLE_TAP_WINDOW_MS = motion.durationMs.base;
export const MAP_TAP_MAX_DURATION_MS = motion.durationMs.base;
export const MAP_DOUBLE_TAP_DISTANCE_PX = layout.spacingPx.xxl;
export const MAP_TAP_TRAVEL_PX = layout.spacingPx.lg;

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function usableDimension(value: number): number {
  return Math.max(0, finiteOr(value, 0));
}

export function clampMapZoom(zoom: number): number {
  return clamp(finiteOr(zoom, MAP_MIN_ZOOM), MAP_MIN_ZOOM, MAP_MAX_ZOOM);
}

/**
 * The canvas size at zoom 1: the whole survey CONTAINED inside the
 * viewport, letterboxed on the shorter axis, distortion-free. No room can
 * clip offscreen at fit because the entire drawing is inside the client box.
 */
export function fitMapCanvasSize(viewport: MapViewportSize): MapViewportSize {
  const width = usableDimension(viewport.width);
  const height = usableDimension(viewport.height);
  if (width === 0 || height === 0) {
    return { width: 0, height: 0 };
  }
  const viewportAspect = width / height;
  if (viewportAspect >= MAP_CONTENT_ASPECT_RATIO) {
    return { width: height * MAP_CONTENT_ASPECT_RATIO, height };
  }
  return { width, height: width / MAP_CONTENT_ASPECT_RATIO };
}

/** The rendered canvas size for a zoom level: fit size scaled up. */
export function mapCanvasSizeAtZoom(
  viewport: MapViewportSize,
  zoom: number,
): MapViewportSize {
  const fit = fitMapCanvasSize(viewport);
  const clamped = clampMapZoom(zoom);
  return { width: fit.width * clamped, height: fit.height * clamped };
}

/**
 * Scroll offsets that keep the content under `focal` (viewport-relative
 * pixels) stationary while the canvas rescales by `ratio`. The scroller
 * clamps to its own bounds afterwards, so out-of-range values are safe.
 */
export function mapScrollAfterZoom(
  scroll: MapScrollState,
  ratio: number,
  focal?: MapViewportPoint,
): { scrollLeft: number; scrollTop: number } {
  const usableRatio = finiteOr(ratio, 1);
  const focalX = finiteOr(focal?.x ?? scroll.clientWidth / 2, 0);
  const focalY = finiteOr(focal?.y ?? scroll.clientHeight / 2, 0);
  return {
    scrollLeft: (scroll.scrollLeft + focalX) * usableRatio - focalX,
    scrollTop: (scroll.scrollTop + focalY) * usableRatio - focalY,
  };
}

/** Two-finger zoom: the zoom scales with the distance between fingers. */
export function pinchMapZoom(
  startZoom: number,
  startDistance: number,
  currentDistance: number,
): number {
  const usableStart = finiteOr(startDistance, 0);
  const usableCurrent = finiteOr(currentDistance, usableStart);
  if (usableStart <= 0) return clampMapZoom(startZoom);
  return clampMapZoom(clampMapZoom(startZoom) * (usableCurrent / usableStart));
}

/** Double taps toggle between the fit view and a 2x reading zoom. */
export function doubleTapTargetZoom(currentZoom: number): number {
  return clampMapZoom(currentZoom) > MAP_MIN_ZOOM + 0.01
    ? MAP_MIN_ZOOM
    : MAP_DOUBLE_TAP_ZOOM_SCALE;
}

export function distanceBetweenMapViewportPoints(
  first: MapViewportPoint,
  second: MapViewportPoint,
): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

export function midpointMapViewport(
  first: MapViewportPoint,
  second: MapViewportPoint,
): MapViewportPoint {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

export function isMapTapGesture(
  startedAtMs: number,
  endedAtMs: number,
  maximumTravelPx: number,
): boolean {
  const durationMs = endedAtMs - startedAtMs;
  return Number.isFinite(durationMs)
    && durationMs >= 0
    && durationMs <= MAP_TAP_MAX_DURATION_MS
    && Number.isFinite(maximumTravelPx)
    && maximumTravelPx <= MAP_TAP_TRAVEL_PX;
}

/** Records a tap, consuming both taps when they form a double tap. */
export function registerMapTap(
  previousTap: MapTap | null,
  currentTap: MapTap,
): MapTapRegistration {
  const currentIsValid = Number.isFinite(currentTap.atMs)
    && Number.isFinite(currentTap.point.x)
    && Number.isFinite(currentTap.point.y);
  if (!currentIsValid) {
    return { isDoubleTap: false, nextTap: null };
  }

  if (previousTap === null) {
    return { isDoubleTap: false, nextTap: currentTap };
  }

  const elapsedMs = currentTap.atMs - previousTap.atMs;
  const distancePx = distanceBetweenMapViewportPoints(
    previousTap.point,
    currentTap.point,
  );
  const isDoubleTap = elapsedMs >= 0
    && elapsedMs <= MAP_DOUBLE_TAP_WINDOW_MS
    && distancePx <= MAP_DOUBLE_TAP_DISTANCE_PX;

  return isDoubleTap
    ? { isDoubleTap: true, nextTap: null }
    : { isDoubleTap: false, nextTap: currentTap };
}

export function isMapViewportFrameDue(
  timestampMs: number,
  lastFrameAtMs: number | null,
): boolean {
  if (!Number.isFinite(timestampMs)) {
    return false;
  }
  if (lastFrameAtMs === null || !Number.isFinite(lastFrameAtMs)) {
    return true;
  }
  if (timestampMs < lastFrameAtMs) {
    return true;
  }
  return timestampMs - lastFrameAtMs >= MAP_VIEWPORT_FRAME_INTERVAL_MS;
}

import { layout, motion } from "../tokens";

export interface MapViewportPoint {
  x: number;
  y: number;
}

export interface MapViewportSize {
  width: number;
  height: number;
}

export interface MapViewportTransform extends MapViewportPoint {
  scale: number;
}

export interface MapTap {
  point: MapViewportPoint;
  atMs: number;
}

export interface MapTapRegistration {
  isDoubleTap: boolean;
  nextTap: MapTap | null;
}

export const MAP_VIEWPORT_MIN_SCALE = 1;
export const MAP_VIEWPORT_MAX_SCALE = 3;
export const MAP_VIEWPORT_MAX_FPS = 30;
export const MAP_VIEWPORT_FRAME_INTERVAL_MS = 1_000 / MAP_VIEWPORT_MAX_FPS;

export const MAP_DOUBLE_TAP_WINDOW_MS = motion.durationMs.base;
export const MAP_TAP_MAX_DURATION_MS = motion.durationMs.base;
export const MAP_DOUBLE_TAP_DISTANCE_PX = layout.spacingPx.xxl;
export const MAP_TAP_TRAVEL_PX = layout.spacingPx.lg;

export const INITIAL_MAP_VIEWPORT: Readonly<MapViewportTransform> = Object.freeze({
  x: 0,
  y: 0,
  scale: MAP_VIEWPORT_MIN_SCALE,
});

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function usableDimension(value: number): number {
  return Math.max(0, finiteOr(value, 0));
}

function clampTranslation(value: number, minimum: number): number {
  const bounded = clamp(finiteOr(value, 0), minimum, 0);
  return Object.is(bounded, -0) ? 0 : bounded;
}

export function clampMapViewportScale(scale: number): number {
  return clamp(
    finiteOr(scale, MAP_VIEWPORT_MIN_SCALE),
    MAP_VIEWPORT_MIN_SCALE,
    MAP_VIEWPORT_MAX_SCALE,
  );
}

/**
 * Constrains a transform for content whose unscaled size matches its wrapper.
 * At scale 1 the content is fixed at the origin. At larger scales, neither
 * edge can be dragged past the corresponding wrapper edge.
 */
export function boundMapViewport(
  transform: MapViewportTransform,
  size: MapViewportSize,
): MapViewportTransform {
  const scale = clampMapViewportScale(transform.scale);
  const width = usableDimension(size.width);
  const height = usableDimension(size.height);
  const minimumX = -width * (scale - MAP_VIEWPORT_MIN_SCALE);
  const minimumY = -height * (scale - MAP_VIEWPORT_MIN_SCALE);

  return {
    x: clampTranslation(transform.x, minimumX),
    y: clampTranslation(transform.y, minimumY),
    scale,
  };
}

export function panMapViewport(
  start: MapViewportTransform,
  delta: MapViewportPoint,
  size: MapViewportSize,
): MapViewportTransform {
  return boundMapViewport(
    {
      x: start.x + finiteOr(delta.x, 0),
      y: start.y + finiteOr(delta.y, 0),
      scale: start.scale,
    },
    size,
  );
}

/** Keeps the content point under `focalPoint` stationary while zooming. */
export function zoomMapViewportAt(
  start: MapViewportTransform,
  nextScale: number,
  focalPoint: MapViewportPoint,
  size: MapViewportSize,
): MapViewportTransform {
  const boundedStart = boundMapViewport(start, size);
  const scale = clampMapViewportScale(nextScale);
  const ratio = scale / boundedStart.scale;
  const focalX = finiteOr(focalPoint.x, 0);
  const focalY = finiteOr(focalPoint.y, 0);

  return boundMapViewport(
    {
      x: focalX - (focalX - boundedStart.x) * ratio,
      y: focalY - (focalY - boundedStart.y) * ratio,
      scale,
    },
    size,
  );
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

export function distanceBetweenMapViewportPoints(
  first: MapViewportPoint,
  second: MapViewportPoint,
): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

/**
 * Applies both the scale and centroid movement of a two-pointer gesture.
 * This formulation preserves the content point that began under the starting
 * centroid, while still allowing the two fingers to pan together.
 */
export function pinchMapViewport(
  start: MapViewportTransform,
  startCentroid: MapViewportPoint,
  currentCentroid: MapViewportPoint,
  startDistance: number,
  currentDistance: number,
  size: MapViewportSize,
): MapViewportTransform {
  const boundedStart = boundMapViewport(start, size);
  const usableStartDistance = finiteOr(startDistance, 0);
  const usableCurrentDistance = finiteOr(currentDistance, usableStartDistance);
  const distanceRatio = usableStartDistance > 0
    ? usableCurrentDistance / usableStartDistance
    : 1;
  const scale = clampMapViewportScale(boundedStart.scale * distanceRatio);
  const scaleRatio = scale / boundedStart.scale;
  const startX = finiteOr(startCentroid.x, 0);
  const startY = finiteOr(startCentroid.y, 0);
  const currentX = finiteOr(currentCentroid.x, startX);
  const currentY = finiteOr(currentCentroid.y, startY);

  return boundMapViewport(
    {
      x: currentX - (startX - boundedStart.x) * scaleRatio,
      y: currentY - (startY - boundedStart.y) * scaleRatio,
      scale,
    },
    size,
  );
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

export function mapViewportTransformsEqual(
  first: MapViewportTransform,
  second: MapViewportTransform,
): boolean {
  return first.x === second.x
    && first.y === second.y
    && first.scale === second.scale;
}

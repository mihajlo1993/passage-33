"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SurveyMapArt } from "./SurveyMap";
import type { GameState } from "../types";
import {
  MAP_DOUBLE_TAP_ZOOM_SCALE,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  clampMapZoom,
  distanceBetweenMapViewportPoints,
  doubleTapTargetZoom,
  fitMapCanvasSize,
  isMapTapGesture,
  mapScrollAfterZoom,
  midpointMapViewport,
  pinchMapZoom,
  registerMapTap,
  type MapTap,
  type MapViewportPoint,
  type MapViewportSize,
} from "./viewport";

const ZOOM_STEP = 1.5;

/**
 * The survey viewport. The browser owns panning (a native scroll surface,
 * which cannot break); pinch zoom, double-tap fit/2x, and the zoom buttons
 * resize the drawing and compensate the scroll so the point under her
 * fingers stays put. A ResizeObserver re-fits when the URL bar collapses.
 * Zoom 1 always shows the WHOLE flat.
 */
export function SurveyScroller({ state }: { state: GameState }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(MAP_MIN_ZOOM);
  const [zoom, setZoom] = useState(MAP_MIN_ZOOM);
  const [fit, setFit] = useState<MapViewportSize>({ width: 0, height: 0 });
  const pinchRef = useRef<{
    startZoom: number;
    startDistance: number;
    centroid: MapViewportPoint;
  } | null>(null);
  const tapRef = useRef<MapTap | null>(null);
  const touchStartRef = useRef<{ atMs: number; point: MapViewportPoint } | null>(null);
  const travelRef = useRef(0);

  const applyZoom = useCallback((next: number, focal?: MapViewportPoint) => {
    const scroller = scrollerRef.current;
    const clamped = clampMapZoom(next);
    const previous = zoomRef.current;
    zoomRef.current = clamped;
    setZoom(clamped);
    if (!scroller || previous === clamped) return;
    const ratio = clamped / previous;
    const { scrollLeft, scrollTop, clientWidth, clientHeight } = scroller;
    requestAnimationFrame(() => {
      const target = mapScrollAfterZoom(
        { scrollLeft, scrollTop, clientWidth, clientHeight },
        ratio,
        focal,
      );
      scroller.scrollLeft = target.scrollLeft;
      scroller.scrollTop = target.scrollTop;
    });
  }, []);

  // Fit-size follows the real client box; the URL bar collapsing re-fits.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const measure = () => {
      setFit(fitMapCanvasSize({
        width: scroller.clientWidth,
        height: scroller.clientHeight,
      }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  // Pinch: two fingers scale the zoom; the centroid stays under them.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const pointOf = (touch: Touch): MapViewportPoint => {
      const box = scroller.getBoundingClientRect();
      return { x: touch.clientX - box.left, y: touch.clientY - box.top };
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        const first = pointOf(event.touches[0]);
        const second = pointOf(event.touches[1]);
        pinchRef.current = {
          startZoom: zoomRef.current,
          startDistance: distanceBetweenMapViewportPoints(first, second),
          centroid: midpointMapViewport(first, second),
        };
        touchStartRef.current = null;
        return;
      }
      if (event.touches.length === 1) {
        touchStartRef.current = {
          atMs: performance.now(),
          point: pointOf(event.touches[0]),
        };
        travelRef.current = 0;
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      const pinch = pinchRef.current;
      if (pinch && event.touches.length === 2) {
        event.preventDefault();
        const first = pointOf(event.touches[0]);
        const second = pointOf(event.touches[1]);
        const distance = distanceBetweenMapViewportPoints(first, second);
        applyZoom(
          pinchMapZoom(pinch.startZoom, pinch.startDistance, distance),
          midpointMapViewport(first, second),
        );
        return;
      }
      const start = touchStartRef.current;
      if (start && event.touches.length === 1) {
        travelRef.current = Math.max(
          travelRef.current,
          distanceBetweenMapViewportPoints(start.point, pointOf(event.touches[0])),
        );
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinchRef.current = null;
      const start = touchStartRef.current;
      if (start && event.touches.length === 0) {
        const endedAt = performance.now();
        if (isMapTapGesture(start.atMs, endedAt, travelRef.current)) {
          const registration = registerMapTap(tapRef.current, {
            point: start.point,
            atMs: endedAt,
          });
          tapRef.current = registration.nextTap;
          if (registration.isDoubleTap) {
            applyZoom(doubleTapTargetZoom(zoomRef.current), start.point);
          }
        } else {
          tapRef.current = null;
        }
        touchStartRef.current = null;
      }
    };

    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchmove", onTouchMove, { passive: false });
    scroller.addEventListener("touchend", onTouchEnd, { passive: true });
    scroller.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchmove", onTouchMove);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [applyZoom]);

  return (
    <div className="survey-scroller-shell">
      <div ref={scrollerRef} className="survey-scroller">
        <div
          className="survey-scroller__canvas"
          style={
            fit.width > 0
              ? { width: `${fit.width * zoom}px`, height: `${fit.height * zoom}px` }
              : undefined
          }
        >
          <SurveyMapArt state={state} />
        </div>
      </div>
      <div className="map-controls" aria-label="Map controls">
        <button
          type="button"
          className="map-control"
          aria-label="Zoom in"
          disabled={zoom >= MAP_MAX_ZOOM}
          onClick={() => applyZoom(zoom * ZOOM_STEP)}
        >
          +
        </button>
        <button
          type="button"
          className="map-control"
          aria-label="Zoom out"
          disabled={zoom <= MAP_MIN_ZOOM}
          onClick={() => applyZoom(zoom / ZOOM_STEP)}
        >
          &minus;
        </button>
        <button
          type="button"
          className="map-control"
          aria-label="Fit the whole flat"
          onClick={() => applyZoom(zoom > MAP_MIN_ZOOM ? MAP_MIN_ZOOM : MAP_DOUBLE_TAP_ZOOM_SCALE)}
        >
          []
        </button>
      </div>
    </div>
  );
}

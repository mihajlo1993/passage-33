"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SurveyMapArt } from "./SurveyMap";
import type { GameState } from "../types";

/**
 * Native-scroll map viewport. The browser owns panning in both axes, so
 * panning can never break; zoom is explicit buttons that resize the drawing
 * and keep the view centre stable. Zoom 1 fits the whole flat on screen.
 */
const MAX_ZOOM = 5;
const ZOOM_STEP = 1.5;

export function SurveyScroller({
  state,
  onClose,
}: {
  state: GameState;
  onClose?: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1.8);

  const applyZoom = useCallback((next: number) => {
    const scroller = scrollerRef.current;
    const clamped = Math.min(MAX_ZOOM, Math.max(1, next));
    if (!scroller) {
      setZoom(clamped);
      return;
    }
    const { scrollLeft, scrollTop, clientWidth, clientHeight } = scroller;
    setZoom((current) => {
      const ratio = clamped / current;
      // Keep the viewport centre fixed through the zoom.
      requestAnimationFrame(() => {
        scroller.scrollLeft = (scrollLeft + clientWidth / 2) * ratio - clientWidth / 2;
        scroller.scrollTop = (scrollTop + clientHeight / 2) * ratio - clientHeight / 2;
      });
      return clamped;
    });
  }, []);

  // Open roughly centred on the flat.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    requestAnimationFrame(() => {
      scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
      scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2;
    });
  }, []);

  return (
    <div className="survey-scroller-shell">
      <div ref={scrollerRef} className="survey-scroller">
        <div
          className="survey-scroller__canvas"
          style={{
            width: `calc(max(100vw, 100dvh * var(--map-aspect)) * ${zoom / 1.8})`,
          }}
        >
          <SurveyMapArt state={state} />
        </div>
      </div>
      <div className="map-controls" aria-label="Map controls">
        <button type="button" className="map-control" aria-label="Zoom in" onClick={() => applyZoom(zoom * ZOOM_STEP)}>+</button>
        <button type="button" className="map-control" aria-label="Zoom out" onClick={() => applyZoom(zoom / ZOOM_STEP)}>&minus;</button>
        <button type="button" className="map-control" aria-label="Fit the whole flat" onClick={() => applyZoom(1)}>[]</button>
        {onClose && (
          <button type="button" className="map-control map-control--close" aria-label="Close the map" onClick={onClose}>X</button>
        )}
      </div>
      <div className="map-legend" aria-hidden="true">
        <span><i className="map-legend__swatch map-legend__swatch--searching" /> Currently searching</span>
        <span><i className="map-legend__swatch map-legend__swatch--done" /> Search completed</span>
      </div>
    </div>
  );
}

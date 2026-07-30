"use client";

import { useEffect, useRef, useState } from "react";
import type { ModelViewerElement } from "@/src/model-viewer";
import { useAudio } from "@/src/audio/useAudio";
import { useHaptics } from "@/src/device";

/** Target orbit for the relic, radians. Found by turning, not by being told. */
const TARGET_THETA = 3.9;
const TARGET_PHI = 1.15;
/** Inside this distance the shadow is considered settled once held. */
const LOCK_DISTANCE = 0.22;
const LOCK_DWELL_MS = 600;
/** Beyond this distance the shadow is fully formless. */
const MAX_DISTANCE = 2.4;

function angularDelta(a: number, b: number): number {
  let delta = (a - b) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export interface ShadowWallProps {
  onSolved: () => void;
  onCancel: () => void;
}

/**
 * The desk's raking light throws the relic's shadow on the wall. Turn the
 * relic until the shadow stops being an animal and becomes a number.
 */
export function ShadowWall({ onSolved, onCancel }: ShadowWallProps) {
  const viewerRef = useRef<ModelViewerElement | null>(null);
  const dwellRef = useRef<number | null>(null);
  const [distance, setDistance] = useState(MAX_DISTANCE);
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const audio = useAudio();
  const haptics = useHaptics();

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const clearDwell = () => {
      if (dwellRef.current !== null) {
        window.clearTimeout(dwellRef.current);
        dwellRef.current = null;
      }
    };

    const handleCameraChange = () => {
      if (lockedRef.current) return;
      const orbit = viewer.getCameraOrbit();
      const d = Math.hypot(
        angularDelta(orbit.theta, TARGET_THETA),
        angularDelta(orbit.phi, TARGET_PHI),
      );
      setDistance(d);
      if (d <= LOCK_DISTANCE) {
        if (dwellRef.current === null) {
          dwellRef.current = window.setTimeout(() => {
            dwellRef.current = null;
            lockedRef.current = true;
            setLocked(true);
            setDistance(0);
            void audio.play("released");
            haptics.contact();
          }, LOCK_DWELL_MS);
        }
      } else {
        clearDwell();
      }
    };

    viewer.addEventListener("camera-change", handleCameraChange);
    return () => {
      clearDwell();
      viewer.removeEventListener("camera-change", handleCameraChange);
    };
  }, [audio, haptics]);

  const closeness = Math.max(0, 1 - distance / MAX_DISTANCE);
  const blurPx = locked ? 0 : 2 + distance * 9;
  const skewDeg = locked ? 0 : distance * 26;
  const shadowOpacity = 0.25 + closeness * 0.65;

  return (
    <section className="shadow-wall" aria-labelledby="shadow-title">
      <header className="lock-screen__heading">
        <p className="eyebrow">THE DESK // RAKING LIGHT</p>
        <h1 id="shadow-title">The Shadow Wall</h1>
      </header>
      <p className="host-copy" aria-live="polite">
        {locked
          ? "There. Thirty-three, thrown on the wall by a stag that never knew it was carrying your age. The scratches on the desk make sense from this angle: the kitchen door wants its colours presented in this order."
          : "Turn the relic in the light. Its shadow is lying to you from every angle except one."}
      </p>
      <div className="shadow-stage" data-locked={locked}>
        <div className="shadow-stage__wall" aria-hidden="true">
          <span
            className="shadow-stage__cast"
            style={{
              filter: `blur(${blurPx}px)`,
              transform: `skewX(${skewDeg}deg) rotate(${skewDeg / 3}deg)`,
              opacity: shadowOpacity,
            }}
          >
            33
          </span>
        </div>
        <model-viewer
          ref={viewerRef}
          className="shadow-stage__relic"
          src="/models/relic.glb"
          alt="A small stag statue on the field desk"
          camera-controls
          disable-pan
          disable-tap
          touch-action="none"
          interaction-prompt="none"
          exposure="0.45"
          shadow-intensity="1"
          tone-mapping="aces"
          camera-orbit="0.6rad 1.4rad 110%"
          min-camera-orbit="-Infinity 0deg auto"
          max-camera-orbit="Infinity 180deg auto"
        />
      </div>
      <div className="interaction-actions">
        <button
          className="mechanical-button mechanical-button--primary"
          disabled={!locked}
          onClick={onSolved}
        >
          {locked ? "READ THE ROUTE" : "THE SHADOW IS STILL LYING"}
        </button>
        <button className="text-control" onClick={onCancel}>STEP AWAY</button>
      </div>
    </section>
  );
}

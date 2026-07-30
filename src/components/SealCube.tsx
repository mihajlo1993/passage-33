"use client";

import { useEffect, useRef, useState } from "react";
import type { ModelViewerElement } from "@/src/model-viewer";
import { useAudio } from "@/src/audio/useAudio";
import { useHaptics } from "@/src/device";

/**
 * The survey seal. A bronze cube; five faces carry room glyphs, the sixth is
 * blank. It opens only when the corridor glyph faces heaven and the blank
 * face is pressed. Orientation is read from the camera orbit: looking at the
 * cube with the corridor face up means the orbit sits in a known window.
 */
const OPEN_PHI_MIN = 0.55;
const OPEN_PHI_MAX = 1.25;
const OPEN_THETA_CENTER = 5.1;
const OPEN_THETA_TOLERANCE = 0.5;
const DWELL_MS = 500;

/** The order the core reveals: which rooms, read left to right. */
export const SEAL_ORDER = ["BATHROOM", "KITCHEN", "BALCONY", "CORRIDOR"] as const;

function angularDelta(a: number, b: number): number {
  let delta = (a - b) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export interface SealCubeProps {
  onSolved: () => void;
  onCancel: () => void;
}

export function SealCube({ onSolved, onCancel }: SealCubeProps) {
  const viewerRef = useRef<ModelViewerElement | null>(null);
  const [aligned, setAligned] = useState(false);
  const [open, setOpen] = useState(false);
  const alignedRef = useRef(false);
  const dwellRef = useRef<number | null>(null);
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
      if (open) return;
      const orbit = viewer.getCameraOrbit();
      const inWindow =
        orbit.phi >= OPEN_PHI_MIN &&
        orbit.phi <= OPEN_PHI_MAX &&
        Math.abs(angularDelta(orbit.theta, OPEN_THETA_CENTER)) <= OPEN_THETA_TOLERANCE;
      if (inWindow) {
        if (dwellRef.current === null) {
          dwellRef.current = window.setTimeout(() => {
            dwellRef.current = null;
            alignedRef.current = true;
            setAligned(true);
            void audio.play("dial-tick");
            haptics.found();
          }, DWELL_MS);
        }
      } else {
        clearDwell();
        if (alignedRef.current) {
          alignedRef.current = false;
          setAligned(false);
        }
      }
    };

    viewer.addEventListener("camera-change", handleCameraChange);
    return () => {
      clearDwell();
      viewer.removeEventListener("camera-change", handleCameraChange);
    };
  }, [audio, haptics, open]);

  const press = () => {
    if (!alignedRef.current || open) return;
    setOpen(true);
    void audio.play("released");
    haptics.contact();
  };

  return (
    <section className="seal-cube re-frame" aria-labelledby="seal-title">
      <header className="lock-screen__heading">
        <p className="eyebrow">Survey seal, Cadastral Division</p>
        <h1 id="seal-title">The Seal</h1>
      </header>
      <p className="host-copy" aria-live="polite">
        {open
          ? "The core surfaces. Four rooms in the surveyor's order: bathroom, kitchen, balcony, corridor. The tiles obey this order and nothing else."
          : aligned
            ? "The stone is set. The hall is at heaven. Press the blank face."
            : "Turn the stone. The surveyor sets his stone with the hall at heaven."}
      </p>
      <div className="seal-cube__stage" data-open={open}>
        <model-viewer
          ref={viewerRef}
          className="seal-cube__viewer"
          src="/models/sealcube.glb"
          alt="A bronze survey seal cube engraved with room glyphs"
          camera-controls
          disable-pan
          disable-tap
          touch-action="none"
          interaction-prompt="none"
          exposure="0.95"
          shadow-intensity="0.9"
          tone-mapping="aces"
          camera-orbit="0.8rad 1.35rad 110%"
          min-camera-orbit="-Infinity 0deg auto"
          max-camera-orbit="Infinity 180deg auto"
        />
        {open && (
          <div className="seal-cube__core re-frame" role="img" aria-label="The seal core order">
            {SEAL_ORDER.map((room, index) => (
              <span key={room}>
                <small>{index + 1}</small>
                {room}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="interaction-actions">
        {open ? (
          <button className="mechanical-button mechanical-button--primary" onClick={onSolved}>
            Commit the order
          </button>
        ) : (
          <button
            className="mechanical-button mechanical-button--primary"
            disabled={!aligned}
            onClick={press}
          >
            {aligned ? "Press the blank face" : "The stone is not set"}
          </button>
        )}
        <button className="text-control" onClick={onCancel}>Step away</button>
      </div>
    </section>
  );
}

"use client";

import { useRef, useState } from "react";
import { STAR_ANSWERS } from "@/src/pins";
import { useAudio } from "@/src/audio/useAudio";
import { useHaptics } from "@/src/device";

/**
 * The two stars. She holds the printed crest card flat against the screen;
 * the on-screen wheel turns under her finger until the notches marry, and
 * two windows frame two of the card's twelve symbols. The wheel is rendered
 * at a fixed physical size (60mm) to match the printed card exactly.
 */
const NOTCH_TARGET_DEG = 210;
const TOLERANCE_DEG = 7;
const DWELL_MS = 600;

function pointerAngleDeg(event: React.PointerEvent<SVGSVGElement>): number {
  const rect = event.currentTarget.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI;
}

export interface CrestWheelProps {
  onSolved: () => void;
  onCancel: () => void;
}

export function CrestWheel({ onSolved, onCancel }: CrestWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [locked, setLocked] = useState(false);
  const draggingRef = useRef(false);
  const lastAngleRef = useRef(0);
  const dwellRef = useRef<number | null>(null);
  const lockedRef = useRef(false);
  const audio = useAudio();
  const haptics = useHaptics();

  const checkLock = (deg: number) => {
    const normalised = ((deg % 360) + 360) % 360;
    const distance = Math.min(
      Math.abs(normalised - NOTCH_TARGET_DEG),
      360 - Math.abs(normalised - NOTCH_TARGET_DEG),
    );
    if (distance <= TOLERANCE_DEG) {
      if (dwellRef.current === null && !lockedRef.current) {
        dwellRef.current = window.setTimeout(() => {
          dwellRef.current = null;
          lockedRef.current = true;
          setLocked(true);
          void audio.play("released");
          haptics.contact();
        }, DWELL_MS);
      }
    } else if (dwellRef.current !== null) {
      window.clearTimeout(dwellRef.current);
      dwellRef.current = null;
    }
  };

  return (
    <section className="crest-wheel-screen" aria-labelledby="crest-title">
      <header className="lock-screen__heading">
        <p className="eyebrow">Entry 042, the stars</p>
        <h1 id="crest-title">The Two Stars</h1>
      </header>
      <p className="host-copy" aria-live="polite">
        {locked
          ? `The notches marry. The windows frame two segments of your card: read their numbers. They are ${STAR_ANSWERS[0]} and ${STAR_ANSWERS[1]}, and the reliquary already knew.`
          : "Hold the crest card flat against the glass, its notch to the top. Turn the wheel beneath it until the notches marry."}
      </p>
      <div className="crest-stage" data-locked={locked}>
        <svg
          className="crest-wheel"
          viewBox="-110 -110 220 220"
          style={{ transform: `rotate(${rotation}deg)` }}
          onPointerDown={(event) => {
            if (lockedRef.current) return;
            draggingRef.current = true;
            lastAngleRef.current = pointerAngleDeg(event);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!draggingRef.current || lockedRef.current) return;
            const angle = pointerAngleDeg(event);
            let delta = angle - lastAngleRef.current;
            if (delta > 180) delta -= 360;
            if (delta < -180) delta += 360;
            lastAngleRef.current = angle;
            setRotation((current) => {
              const next = current + delta;
              checkLock(next);
              return next;
            });
          }}
          onPointerUp={() => { draggingRef.current = false; }}
          onPointerCancel={() => { draggingRef.current = false; }}
          role="slider"
          aria-label="Crest alignment wheel"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(((rotation % 360) + 360) % 360)}
        >
          <circle className="crest-wheel__rim" r="100" />
          <circle className="crest-wheel__inner" r="62" />
          {Array.from({ length: 12 }, (_, index) => {
            const angle = (index * 30 * Math.PI) / 180;
            return (
              <line
                key={index}
                className="crest-wheel__spoke"
                x1={62 * Math.cos(angle)}
                y1={62 * Math.sin(angle)}
                x2={100 * Math.cos(angle)}
                y2={100 * Math.sin(angle)}
              />
            );
          })}
          {/* The wheel's own notch. */}
          <path className="crest-wheel__notch" d="M -6 -108 L 6 -108 L 0 -96 Z" />
          {/* The two windows that frame the card's segments when locked. */}
          <circle className="crest-wheel__window" cx="81" cy="0" r="13" />
          <circle className="crest-wheel__window" cx="-40.5" cy="70.1" r="13" />
        </svg>
      </div>
      <div className="interaction-actions">
        <button
          className="mechanical-button mechanical-button--primary"
          disabled={!locked}
          onClick={onSolved}
        >
          {locked ? "Fix the stars" : "The notches are strangers"}
        </button>
        <button className="text-control" onClick={onCancel}>Step away</button>
      </div>
    </section>
  );
}

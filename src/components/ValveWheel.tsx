"use client";

import { useRef, useState } from "react";
import { useAudio } from "@/src/audio/useAudio";
import { useHaptics } from "@/src/device";

/** Full counterclockwise turns required to choke the fan. */
const TURNS_REQUIRED = 3;

export interface ValveWheelProps {
  onSolved: () => void;
  onCancel: () => void;
}

function pointerAngle(event: React.PointerEvent<SVGSVGElement>): number {
  const rect = event.currentTarget.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return Math.atan2(event.clientY - cy, event.clientX - cx);
}

/**
 * A heavy valve that only answers to sustained counterclockwise effort.
 * Every completed turn drops the fan a register until the air goes still.
 */
export function ValveWheel({ onSolved, onCancel }: ValveWheelProps) {
  const [rotation, setRotation] = useState(0); // radians, negative = ccw progress
  const [dead, setDead] = useState(false);
  const draggingRef = useRef(false);
  const lastAngleRef = useRef(0);
  const lastClunkTurnRef = useRef(0);
  const audio = useAudio();
  const haptics = useHaptics();

  const progress = Math.min(1, Math.max(0, -rotation / (TURNS_REQUIRED * Math.PI * 2)));
  const turnsDone = Math.floor(progress * TURNS_REQUIRED);

  const handleMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current || dead) return;
    const angle = pointerAngle(event);
    let delta = angle - lastAngleRef.current;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    lastAngleRef.current = angle;
    // Clockwise motion tightens nothing: the wheel only credits ccw work.
    setRotation((current) => {
      const next = Math.min(0, current + Math.min(0, delta) + Math.max(0, delta) * 0.15);
      const nextProgress = Math.min(1, -next / (TURNS_REQUIRED * Math.PI * 2));
      const completedTurns = Math.floor(nextProgress * TURNS_REQUIRED);
      if (completedTurns > lastClunkTurnRef.current) {
        lastClunkTurnRef.current = completedTurns;
        void audio.play("dial-tick");
        haptics.found();
      }
      if (nextProgress >= 1 && !dead) {
        setDead(true);
        void audio.play("released");
        haptics.contact();
      }
      return next;
    });
  };

  return (
    <section className="valve-screen" aria-labelledby="valve-title">
      <header className="lock-screen__heading">
        <p className="eyebrow">THE FAN // SHUTOFF VALVE</p>
        <h1 id="valve-title">Wring Its Neck</h1>
      </header>
      <p className="host-copy" aria-live="polite">
        {dead
          ? "Listen. Nothing. The air has finally agreed to hold still for you."
          : "Turn the wheel against the clock and keep turning. Machinery respects nothing but persistence."}
      </p>
      <div className="valve-stage">
        <svg
          className="valve-wheel"
          viewBox="-110 -110 220 220"
          data-dead={dead}
          style={{ transform: `rotate(${rotation}rad)` }}
          onPointerDown={(event) => {
            draggingRef.current = true;
            lastAngleRef.current = pointerAngle(event);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={handleMove}
          onPointerUp={() => { draggingRef.current = false; }}
          onPointerCancel={() => { draggingRef.current = false; }}
          role="slider"
          aria-label="Valve wheel"
          aria-valuemin={0}
          aria-valuemax={TURNS_REQUIRED}
          aria-valuenow={turnsDone}
        >
          <circle className="valve-wheel__rim" r="92" />
          <circle className="valve-wheel__hub" r="22" />
          {[0, 1, 2, 3, 4].map((spoke) => (
            <line
              key={spoke}
              className="valve-wheel__spoke"
              x1="0"
              y1="0"
              x2={92 * Math.cos((spoke * 2 * Math.PI) / 5)}
              y2={92 * Math.sin((spoke * 2 * Math.PI) / 5)}
            />
          ))}
        </svg>
        <div className="valve-readout" aria-live="polite">
          <span>FAN SPEED</span>
          <div className="valve-readout__track" aria-hidden="true">
            <i style={{ width: `${Math.round((1 - progress) * 100)}%` }} />
          </div>
          <strong>{dead ? "STILL AIR" : `${turnsDone} / ${TURNS_REQUIRED} TURNS`}</strong>
        </div>
      </div>
      <div className="interaction-actions">
        <button
          className="mechanical-button mechanical-button--primary"
          disabled={!dead}
          onClick={onSolved}
        >
          {dead ? "THE BLADES HAVE SURRENDERED" : "KEEP TURNING"}
        </button>
        <button className="text-control" onClick={onCancel}>STEP AWAY</button>
      </div>
    </section>
  );
}

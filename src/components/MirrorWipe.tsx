"use client";

import { useEffect, useRef, useState } from "react";
import { CABINET_DIAL_CODE } from "@/src/pins";
import { colours } from "@/src/tokens";
import { useAudio } from "@/src/audio/useAudio";
import { useHaptics } from "@/src/device";

/** Fraction of fog that must be cleared before the figures settle. */
const CLEAR_THRESHOLD = 0.45;
/** The fog creeps back while she hesitates. */
const REFOG_ALPHA = 0.028;
const REFOG_INTERVAL_MS = 900;
const BRUSH_RADIUS_FRACTION = 0.09;

export interface MirrorWipeProps {
  onSolved: () => void;
  onCancel: () => void;
}

/**
 * She stands at the real bathroom mirror; the phone becomes the fogged glass.
 * Rubbing the screen clears the condensation and the three figures the mirror
 * has been keeping come through where her finger has been.
 */
export function MirrorWipe({ onSolved, onCancel }: MirrorWipeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [settled, setSettled] = useState(false);
  const settledRef = useRef(false);
  const wipedRef = useRef(false);
  const audio = useAudio();
  const haptics = useHaptics();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    const width = Math.max(1, Math.floor(parent?.clientWidth ?? 320));
    const height = Math.max(1, Math.floor(parent?.clientHeight ?? 420));
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return;
    contextRef.current = context;

    // Paint the fog: layered grey breath over the dark glass.
    context.globalCompositeOperation = "source-over";
    context.fillStyle = colours.raised;
    context.fillRect(0, 0, width, height);
    for (let i = 0; i < 900; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = 6 + Math.random() * 26;
      const grey = 26 + Math.floor(Math.random() * 26);
      context.fillStyle = `rgba(${grey}, ${grey - 2}, ${grey - 6}, 0.5)`;
      context.beginPath();
      context.arc(x, y, r, 0, Math.PI * 2);
      context.fill();
    }

    // The fog creeps back at the edges of where she has been.
    const refog = window.setInterval(() => {
      if (settledRef.current) return;
      context.globalCompositeOperation = "source-over";
      context.fillStyle = `rgba(31, 27, 21, ${REFOG_ALPHA})`;
      context.fillRect(0, 0, width, height);
    }, REFOG_INTERVAL_MS);

    return () => window.clearInterval(refog);
  }, []);

  const measureCleared = (): number => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return 0;
    // Sample the central band where the figures live.
    const bandY = Math.floor(canvas.height * 0.3);
    const bandHeight = Math.floor(canvas.height * 0.4);
    const data = context.getImageData(0, bandY, canvas.width, bandHeight).data;
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 16) {
      total += 1;
      if (data[i] < 96) clear += 1;
    }
    return total === 0 ? 0 : clear / total;
  };

  const wipeAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context || settledRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    const radius = canvas.width * BRUSH_RADIUS_FRACTION;

    context.globalCompositeOperation = "destination-out";
    const brush = context.createRadialGradient(x, y, 0, x, y, radius);
    brush.addColorStop(0, "rgba(0, 0, 0, 0.85)");
    brush.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = brush;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();

    if (!wipedRef.current) {
      wipedRef.current = true;
      return;
    }
    if (measureCleared() >= CLEAR_THRESHOLD) {
      settledRef.current = true;
      setSettled(true);
      void audio.play("found");
      haptics.found();
    }
  };

  const digits = CABINET_DIAL_CODE.split("");

  return (
    <section className="mirror-wipe" aria-labelledby="mirror-title">
      <header className="lock-screen__heading">
        <p className="eyebrow">THE MIRROR // BREATHE AND WIPE</p>
        <h1 id="mirror-title">Fogged Glass</h1>
      </header>
      <p className="host-copy" aria-live="polite">
        {settled
          ? "There they are. Three figures, in the order the glass remembers them. Do not write them down. You will not forget."
          : "Rub the glass. The mirror only repeats itself for warm hands."}
      </p>
      <div className="mirror-wipe__glass" data-settled={settled}>
        <div className="mirror-wipe__figures" aria-hidden={!settled}>
          {digits.map((digit, index) => (
            <span key={index} style={{ transform: `rotate(${(index - 1) * 2.5}deg)` }}>
              {digit}
            </span>
          ))}
        </div>
        <canvas
          ref={canvasRef}
          className="mirror-wipe__fog"
          onPointerDown={(event) => wipeAt(event.clientX, event.clientY)}
          onPointerMove={(event) => {
            if (event.buttons > 0 || event.pointerType === "touch") {
              wipeAt(event.clientX, event.clientY);
            }
          }}
        />
      </div>
      <div className="interaction-actions">
        <button
          className="mechanical-button mechanical-button--primary"
          disabled={!settled}
          onClick={onSolved}
        >
          {settled ? "COMMIT THEM TO MEMORY" : "THE GLASS IS STILL FOGGED"}
        </button>
        <button className="text-control" onClick={onCancel}>STEP AWAY</button>
      </div>
    </section>
  );
}

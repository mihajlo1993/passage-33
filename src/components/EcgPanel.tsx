"use client";

import { useEffect, useRef } from "react";
import { colours } from "@/src/tokens";

type EcgState = "fine" | "caution" | "orange" | "danger";

function stateFor(health: number): { state: EcgState; word: string; color: string } {
  if (health < 25) return { state: "danger", word: "DANGER", color: colours.rustHot };
  if (health < 50) return { state: "orange", word: "CAUTION", color: colours.ecgOrange };
  if (health < 80) return { state: "caution", word: "CAUTION", color: colours.ecgCaution };
  return { state: "fine", word: "FINE", color: colours.ecg };
}

/**
 * The RE2R wrist monitor: a scanned green trace whose rhythm degrades with
 * her condition. Amplitude falls and rate rises as health drops; in danger
 * the trace turns erratic and the panel pulses.
 */
export function EcgPanel({ health }: { health: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { state, word, color } = stateFor(health);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const width = (canvas.width = canvas.clientWidth * 2 || 400);
    const height = (canvas.height = 88);

    let frame = 0;
    let raf: number | null = null;
    const rate = state === "fine" ? 1 : state === "caution" ? 1.4 : state === "orange" ? 1.8 : 2.4;
    const amplitude = state === "fine" ? 1 : state === "caution" ? 0.8 : state === "orange" ? 0.6 : 0.5;

    const draw = () => {
      frame += 1;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = color;
      context.lineWidth = 3;
      context.beginPath();
      const mid = height / 2;
      for (let x = 0; x <= width; x += 2) {
        const t = (x + frame * 3 * rate) / width;
        const beat = t * 6 * rate;
        const phase = beat - Math.floor(beat);
        let y = 0;
        if (phase < 0.08) y = -(phase / 0.08) * 0.9;
        else if (phase < 0.16) y = -0.9 + ((phase - 0.08) / 0.08) * 1.5;
        else if (phase < 0.22) y = 0.6 - ((phase - 0.16) / 0.06) * 0.6;
        else y = Math.sin(phase * Math.PI * 2) * 0.05;
        if (state === "danger" && Math.random() < 0.02) y += (Math.random() - 0.5) * 0.8;
        const py = mid + y * mid * 0.9 * amplitude;
        if (x === 0) context.moveTo(x, py);
        else context.lineTo(x, py);
      }
      context.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [state, color]);

  return (
    <div className="ecg-panel" data-state={state} aria-label={"Condition: " + word}>
      <canvas ref={canvasRef} className="ecg-panel__trace" aria-hidden="true" />
      <strong className="ecg-panel__word" style={{ color }}>{word}</strong>
    </div>
  );
}

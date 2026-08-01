"use client";

import { useEffect, useRef, useState } from "react";
import { useHaptics } from "@/src/device";

/** Plain confirmations are held, not tapped: 1.2 seconds on the button. */
export const CONFIRM_HOLD_MS = 1_200;

export interface HoldButtonProps {
  label: string;
  holdMs?: number;
  onComplete: () => void;
  className?: string;
  holdingLabel?: string;
}

/**
 * Press-and-hold confirmation on the existing hold-track pattern. Releasing
 * early resets silently; completing the hold pulses the haptics once and
 * fires exactly one onComplete.
 */
export function HoldButton({
  label,
  holdMs = CONFIRM_HOLD_MS,
  onComplete,
  className,
  holdingLabel = "Keep holding...",
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const doneRef = useRef(false);
  const haptics = useHaptics();
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  const begin = () => {
    if (doneRef.current) return;
    setHolding(true);
    startRef.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const next = Math.min(1, elapsed / holdMs);
      setProgress(next);
      if (next >= 1) {
        frameRef.current = null;
        doneRef.current = true;
        haptics.found();
        onCompleteRef.current();
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  };

  const release = () => {
    if (doneRef.current) return;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setProgress(0);
    setHolding(false);
  };

  return (
    <div className={"hold-control" + (className ? " " + className : "")}>
      <button
        className="mechanical-button mechanical-button--primary mechanical-button--full"
        data-holding={holding}
        onPointerDown={begin}
        onPointerUp={release}
        onPointerLeave={release}
        onPointerCancel={release}
        onContextMenu={(event) => event.preventDefault()}
      >
        {holding ? holdingLabel : label}
      </button>
      <div className="hold-control__track" aria-hidden="true">
        <i style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <p className="microcopy hold-control__note" aria-hidden="true">Press and hold</p>
    </div>
  );
}

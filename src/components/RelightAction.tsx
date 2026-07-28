"use client";

import { useState } from "react";

export interface RelightActionProps {
  onSubmit: () => void | Promise<void>;
  onCancel?: () => void;
}

type RelightPhase = "boxed" | "drawn" | "lighting" | "failed";

export function RelightAction({
  onSubmit,
  onCancel,
}: RelightActionProps) {
  const [phase, setPhase] = useState<RelightPhase>("boxed");

  const strike = async () => {
    if (phase === "boxed") {
      setPhase("drawn");
      return;
    }
    if (phase === "lighting") {
      return;
    }

    setPhase("lighting");
    try {
      await onSubmit();
    } catch {
      setPhase("failed");
    }
  };

  return (
    <section className="relight-action" aria-labelledby="relight-title">
      <header className="interaction-heading">
        <p className="eyebrow">KITCHEN // SECOND WISH</p>
        <h1 id="relight-title">Relight the candle.</h1>
      </header>

      <p className="host-copy" aria-live="polite">
        {phase === "boxed"
          ? "One match remains. I saved it for you. Naturally, I knew the first wish would not take."
          : phase === "drawn"
            ? "Match to striker. Wick close. Do be decisive; hesitation makes such an ugly little flame."
            : phase === "failed"
              ? "The spark objected. Draw it hard along the striker and disappoint it."
              : "There. Cup the flame. The flat has already had one chance at it."}
      </p>

      <div className="relight-rig" data-phase={phase} aria-hidden="true">
        <div className="relight-rig__candle">
          <i />
        </div>
        <div className="relight-rig__matchbox">
          <span>BH // SAFETY MATCH</span>
          <i />
        </div>
        <div className="relight-rig__match">
          <i />
        </div>
      </div>

      <div className="interaction-actions">
        <button
          type="button"
          className="mechanical-button mechanical-button--primary relight-action__strike"
          disabled={phase === "lighting"}
          onClick={() => void strike()}
        >
          {phase === "boxed"
            ? "DRAW THE LAST MATCH"
            : phase === "lighting"
              ? "FLAME CATCHING"
              : "STRIKE // TOUCH WICK"}
        </button>
        {onCancel && (
          <button type="button" className="text-control" onClick={onCancel}>
            LEAVE IT DARK
          </button>
        )}
      </div>
    </section>
  );
}

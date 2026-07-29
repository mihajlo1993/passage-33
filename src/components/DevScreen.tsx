"use client";

import { useState } from "react";
import { pins, TROPHY_PIN_ID } from "@/src/pins";
import type { GameState } from "@/src/types";
import type { PinResolutionResult } from "@/src/game";

export interface DevScreenProps {
  state: GameState;
  resolvePin: (pinId: number) => PinResolutionResult;
  resetGame: () => void;
  navigate: (path: string) => void;
}

export function DevScreen({ state, resolvePin, resetGame, navigate }: DevScreenProps) {
  const [lastAttempt, setLastAttempt] = useState<PinResolutionResult | null>(null);
  const [resetArmed, setResetArmed] = useState(false);

  return (
    <section className="screen dev-screen" aria-labelledby="dev-title">
      <header className="screen-heading">
        <p className="eyebrow">LOCAL TEST LEDGER</p>
        <h1 id="dev-title">ALL CONTACTS</h1>
        <p className="screen-index">ACT {state.act} // {String(state.resolvedPins.length).padStart(2, "0")} RESOLVED</p>
      </header>
      <div className="dev-actions">
        <button className="mechanical-button" onClick={() => {
          const next = pins.find((pin) => !state.resolvedPins.includes(pin.id));
          if (next) setLastAttempt(resolvePin(next.id));
        }}>RESOLVE NEXT</button>
        <button className="text-control" data-danger={resetArmed} onClick={() => {
          if (!resetArmed) { setResetArmed(true); return; }
          resetGame(); setLastAttempt(null); setResetArmed(false);
        }}>{resetArmed ? "CONFIRM RESET" : "RESET RUN"}</button>
      </div>
      {lastAttempt && (
        <div className="dev-result" data-refused={!lastAttempt.ok} aria-live="polite">
          <strong>{lastAttempt.ok ? "RESOLVED" : "REFUSED"}</strong>
          <span>{lastAttempt.ok ? lastAttempt.pin.name : lastAttempt.hint}</span>
        </div>
      )}
      <ol className="dev-pin-list">
        {pins.map((pin) => {
          const resolved = state.resolvedPins.includes(pin.id);
          return (
            <li key={pin.id} data-resolved={resolved}>
              <div>
                <span>{String(pin.id).padStart(2, "0")}</span>
                <strong>{pin.name}</strong>
                <small>ACT {pin.act} // {pin.zone} // {pin.kind}</small>
              </div>
              <button className="dev-resolve" disabled={resolved} onClick={() => setLastAttempt(resolvePin(pin.id))}>
                {resolved ? "DONE" : "RESOLVE"}
              </button>
            </li>
          );
        })}
      </ol>
      {state.resolvedPins.includes(TROPHY_PIN_ID) && (
        <button className="mechanical-button mechanical-button--primary mechanical-button--full" onClick={() => navigate("/trophy")}>
          OPEN TROPHY
        </button>
      )}
    </section>
  );
}

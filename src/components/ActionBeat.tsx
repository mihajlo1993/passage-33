"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "@/src/tokens";
import type { Pin } from "@/src/types";
import { roomDisplayName } from "@/src/zones";
import { useTorch } from "@/src/device";

/** The corridor walk in the dark: long enough to be sure nothing happened. */
const THRESHOLD_MS = 14_000;

export interface ActionBeatProps {
  pin: Pin;
  /** Bumped by the operator panel; a change while staging ends the beat. */
  operatorSkipToken: number;
  onResolve: () => void;
  onCancel: () => void;
}

/**
 * The staging layer for the one choreographed beat left in this game: the
 * dark before the last lock. A single tap arms it; the walk stages for
 * fourteen seconds, then resolves on its own. Damage, stingers, and haptics
 * ride the store's resolution pipeline afterwards.
 */
export function ActionBeat({ pin, operatorSkipToken, onResolve, onCancel }: ActionBeatProps) {
  const [phase, setPhase] = useState<"armed" | "staging">("armed");
  const timerRef = useRef<number | null>(null);
  const skipTokenAtArmRef = useRef(operatorSkipToken);
  const onResolveRef = useRef(onResolve);
  onResolveRef.current = onResolve;
  const torch = useTorch();

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  // The operator's SKIP control ends a beat that is mid-stage.
  useEffect(() => {
    if (phase !== "staging") {
      skipTokenAtArmRef.current = operatorSkipToken;
      return;
    }
    if (operatorSkipToken === skipTokenAtArmRef.current) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onResolveRef.current();
  }, [operatorSkipToken, phase]);

  const activate = () => {
    if (phase !== "armed") return;
    if (pin.beat === "threshold") {
      // Every light out, the torch dead, one slow walk. Nothing happens.
      setPhase("staging");
      void torch.kill(motion.eventMs.torchKill);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        onResolveRef.current();
      }, THRESHOLD_MS);
      return;
    }
    onResolve();
  };

  if (phase === "staging") {
    return (
      <section className="action-beat action-beat--staging" data-beat={pin.beat ?? "plain"}>
        <p className="action-beat__staging-line" aria-live="assertive">
          WALK THE CORRIDOR. THE TERMINAL WILL KNOW.
        </p>
      </section>
    );
  }

  return (
    <section className="action-beat" aria-labelledby="beat-title" data-beat={pin.beat ?? "plain"}>
      <header className="lock-screen__heading">
        <p className="eyebrow">{"ENTRY " + ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][pin.id] + " · " + roomDisplayName(pin.zone)}</p>
        <h1 id="beat-title">{pin.name}</h1>
      </header>
      <p className="host-copy">{pin.objective}</p>
      <button
        className="mechanical-button mechanical-button--primary mechanical-button--full"
        onClick={activate}
      >
        {pin.actionLabel ?? "PROCEED"}
      </button>
      <button className="text-control" onClick={onCancel}>NOT YET</button>
    </section>
  );
}

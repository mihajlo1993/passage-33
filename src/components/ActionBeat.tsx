"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "@/src/tokens";
import type { Pin } from "@/src/types";
import { useTorch } from "@/src/device";
import { useVHS } from "@/src/fx";

/** How long the entry blackout holds before the house lets her see again. */
const BLACKOUT_MS = 2_600;
/** The silence before whatever is behind her stops being polite. */
const BEHIND_YOU_MS = 3_200;
/** How far across the kitchen the flame gets before the draught finds it. */
const CARRY_MS = 2_800;
const MIX_HOLD_MS = 1_600;
const WISH_HOLD_MS = 3_000;

export interface ActionBeatProps {
  pin: Pin;
  onResolve: () => void;
  onCancel: () => void;
}

/**
 * The staging layer for action-resolved pins. Plain actions resolve on the
 * press; choreographed beats (the blackout, the thing behind her, the draught,
 * the mix, the wish) make her live through a moment first. Damage, stingers,
 * and haptics ride the store's resolution pipeline afterwards.
 */
export function ActionBeat({ pin, onResolve, onCancel }: ActionBeatProps) {
  const [phase, setPhase] = useState<"armed" | "staging" | "holding">("armed");
  const [holdProgress, setHoldProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const holdFrameRef = useRef<number | null>(null);
  const holdStartRef = useRef(0);
  const torch = useTorch();
  const vhs = useVHS();

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (holdFrameRef.current !== null) cancelAnimationFrame(holdFrameRef.current);
  }, []);

  const stage = (durationMs: number, before?: () => void) => {
    setPhase("staging");
    before?.();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      onResolve();
    }, durationMs);
  };

  const beginHold = (durationMs: number) => {
    setPhase("holding");
    holdStartRef.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - holdStartRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      setHoldProgress(progress);
      if (progress >= 1) {
        holdFrameRef.current = null;
        onResolve();
        return;
      }
      holdFrameRef.current = requestAnimationFrame(tick);
    };
    holdFrameRef.current = requestAnimationFrame(tick);
  };

  const releaseHold = () => {
    if (phase !== "holding") return;
    if (holdFrameRef.current !== null) {
      cancelAnimationFrame(holdFrameRef.current);
      holdFrameRef.current = null;
    }
    setHoldProgress(0);
    setPhase("armed");
  };

  const activate = () => {
    if (phase !== "armed") return;
    switch (pin.beat) {
      case "blackout":
        // The dark is his: cut her real torch and the screen together.
        stage(BLACKOUT_MS, () => {
          void torch.kill(motion.eventMs.torchKill);
          vhs.glitch(motion.eventMs.vhsDamageSpike);
        });
        return;
      case "behindYou":
        stage(BEHIND_YOU_MS);
        return;
      case "carry":
        stage(CARRY_MS, () => vhs.glitch(motion.eventMs.vhsDamageSpike));
        return;
      case "mix":
      case "hold":
      default:
        if (pin.beat === "mix" || pin.beat === "hold") return; // press-and-hold path
        onResolve();
    }
  };

  const isHoldBeat = pin.beat === "mix" || pin.beat === "hold";
  const holdDuration = pin.beat === "hold" ? WISH_HOLD_MS : MIX_HOLD_MS;
  const label = pin.actionLabel ?? "PROCEED";

  const stagingCopy =
    pin.beat === "blackout"
      ? "THE LIGHTS ARE HIS."
      : pin.beat === "behindYou"
        ? "DO NOT TURN AROUND YET."
        : pin.beat === "carry"
          ? "WALK. KEEP THE FLAME CLOSE."
          : "";

  if (phase === "staging") {
    return (
      <section className="action-beat action-beat--staging" data-beat={pin.beat ?? "plain"}>
        <p className="action-beat__staging-line" aria-live="assertive">{stagingCopy}</p>
      </section>
    );
  }

  return (
    <section className="action-beat" aria-labelledby="beat-title" data-beat={pin.beat ?? "plain"}>
      <header className="lock-screen__heading">
        <p className="eyebrow">
          {"PIN " + String(pin.id).padStart(2, "0") + " // " + pin.zone.toUpperCase()}
        </p>
        <h1 id="beat-title">{pin.name}</h1>
      </header>
      <p className="host-copy">{pin.objective}</p>
      {isHoldBeat ? (
        <div className="hold-control">
          <button
            className="mechanical-button mechanical-button--primary mechanical-button--full"
            onPointerDown={() => beginHold(holdDuration)}
            onPointerUp={releaseHold}
            onPointerLeave={releaseHold}
            onPointerCancel={releaseHold}
          >
            {phase === "holding" ? "HOLD..." : label + " (PRESS AND HOLD)"}
          </button>
          <div className="hold-control__track" aria-hidden="true">
            <i style={{ width: `${Math.round(holdProgress * 100)}%` }} />
          </div>
        </div>
      ) : (
        <button
          className="mechanical-button mechanical-button--primary mechanical-button--full"
          onClick={activate}
        >
          {label}
        </button>
      )}
      <button className="text-control" onClick={onCancel}>NOT YET</button>
    </section>
  );
}

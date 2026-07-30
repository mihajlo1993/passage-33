"use client";

import { useState } from "react";
import { MEDIA_ASSETS } from "@/src/media";
import {
  KEEPER_VOICE_BY_PIN,
  TOTAL_PIN_COUNT,
  pins,
  riddleConfigByPin,
} from "@/src/pins";
import { playKeeper, type KeeperClipId } from "@/src/audio/keeper";
import { resolutionModeForPin } from "@/src/game/engine";
import type { PinResolutionResult } from "@/src/game";
import { motion } from "@/src/tokens";
import type { GameState, Pin, PinResolutionMethod } from "@/src/types";
import { useVHS } from "@/src/fx";
import { ActionBeat } from "./ActionBeat";
import { ArrivalPanel } from "./ArrivalPanel";
import { RiddleLock } from "./RiddleLock";

const APPROACH_LABELS: Record<string, string> = {
  riddle: "Face the lock",
};

export interface HomeScreenProps {
  state: GameState;
  coldOpen: boolean;
  onBegin: () => void;
  resolvePin: (pinId: number, method?: PinResolutionMethod) => PinResolutionResult;
  previewPin: (pinId: number, method?: PinResolutionMethod) => PinResolutionResult;
  sufferSetback: () => number;
  flushPersistence: () => Promise<void>;
  /** An AR pin resolved on the /ar route whose payoff has not been read yet. */
  pendingArrival: PinResolutionResult | null;
  onAcknowledgeArrival: () => void;
  navigate: (path: string) => void;
}

export function HomeScreen({
  state,
  coldOpen,
  onBegin,
  resolvePin,
  previewPin,
  sufferSetback,
  flushPersistence,
  pendingArrival,
  onAcknowledgeArrival,
  navigate,
}: HomeScreenProps) {
  const [interacting, setInteracting] = useState(false);
  const [arrival, setArrival] = useState<PinResolutionResult | null>(null);
  const vhs = useVHS();

  const nextPin = pins.find((pin) => !state.resolvedPins.includes(pin.id));
  const mode = nextPin ? resolutionModeForPin(nextPin) : "scan";

  if (coldOpen) {
    const resumed = state.resolvedPins.length > 0;
    const cover = MEDIA_ASSETS.coldOpen;
    const coverUrl = cover.webp?.url;
    return (
      <section className="cold-open" data-has-cover={String(Boolean(coverUrl))} aria-labelledby="cold-title">
        {coverUrl && (
          <img
            className="cold-open__media"
            src={coverUrl}
            width={cover.width}
            height={cover.height}
            alt=""
            aria-hidden="true"
          />
        )}
        <div className="cold-open__rule" />
        <p className="eyebrow">Private commission · One guest</p>
        <div className="cold-open__copy">
          <p className="system-line">THE KEEPER'S FOUR LOCKS</p>
          <h1 id="cold-title">{resumed ? "The locks remember." : "Four locks. Four gifts."}</h1>
          <p className="host-copy">
            {resumed
              ? "The building kept your place. The Keeper never lost count of anything, least of all you."
              : "Thirty-three years ago, the night you were born, the Keeper of this building sealed a letter behind four locks and left four gifts in trust. Nobody ever came for them. You are late by exactly one lifetime. The locks kept."}
          </p>
        </div>
        <button className="mechanical-button mechanical-button--primary" onClick={onBegin}>
          {resumed ? "Return to the locks" : "Begin"}
        </button>
        <p className="microcopy">Sound on · Lights low</p>
      </section>
    );
  }

  const finishArrival = async (result: PinResolutionResult) => {
    setArrival(null);
    if (!result.ok) return;
    if (result.saveTriggered) {
      await flushPersistence();
      navigate("/save");
      return;
    }
    if (result.pin.kind === "win" || result.gameCompleted) {
      navigate("/trophy");
    }
  };

  // Payoff text for pins resolved on other routes (the AR encounters).
  if (pendingArrival) {
    return (
      <section className="screen home-screen">
        <ArrivalPanel
          result={pendingArrival}
          onContinue={() => {
            onAcknowledgeArrival();
            void finishArrival(pendingArrival);
          }}
        />
      </section>
    );
  }

  if (arrival) {
    return (
      <section className="screen home-screen">
        <ArrivalPanel result={arrival} onContinue={() => void finishArrival(arrival)} />
      </section>
    );
  }

  const resolveNow = (pin: Pin): void => {
    const result = resolvePin(pin.id, resolutionModeForPin(pin));
    setInteracting(false);
    setArrival(result);
    if (result.ok) {
      const clip = KEEPER_VOICE_BY_PIN[pin.id];
      if (clip) {
        window.setTimeout(() => playKeeper(clip as KeeperClipId), 700);
      }
    }
  };

  const wrongTurn = () => {
    sufferSetback();
    vhs.glitch(motion.eventMs.vhsDamageSpike);
  };

  if (nextPin && interacting) {
    const cancel = () => {
      setInteracting(false);
    };

    if (mode === "riddle") {
      const config = riddleConfigByPin[nextPin.id];
      if (config) {
        return (
          <RiddleLock
            pin={nextPin}
            config={config}
            onSolved={() => resolveNow(nextPin)}
            onCancel={cancel}
            onWrongAttempt={wrongTurn}
          />
        );
      }
    }
    if (mode === "action") {
      return (
        <ActionBeat pin={nextPin} onResolve={() => resolveNow(nextPin)} onCancel={cancel} />
      );
    }
    // Unknown mode: fall through to the objective view.
  }

  const approach = () => {
    if (!nextPin) {
      navigate("/trophy");
      return;
    }
    if (mode === "scan") {
      navigate("/scan");
      return;
    }
    const preview = previewPin(nextPin.id, mode);
    if (!preview.ok) {
      setArrival(preview);
      return;
    }
    setInteracting(true);
  };

  const approachLabel = nextPin
    ? mode === "action"
      ? nextPin.actionLabel ?? "Proceed"
      : APPROACH_LABELS[mode] ?? "Proceed"
    : "Open the file";

  return (
    <section className="screen home-screen" aria-labelledby="home-title">
      <header className="screen-heading">
        <p className="eyebrow">CURRENT ARRANGEMENT</p>
        <h1 id="home-title">{nextPin ? nextPin.name : "THE PARTY IS COMPLETE"}</h1>
        <p className="screen-index">
          {nextPin
            ? "PIN " + String(nextPin.id).padStart(2, "0") + " // " + nextPin.zone
            : TOTAL_PIN_COUNT + " OF " + TOTAL_PIN_COUNT + " CONTACTS"}
        </p>
      </header>
      <div className="objective-panel">
        <span className="objective-panel__marker" aria-hidden="true" />
        <p className="host-copy">
          {nextPin
            ? nextPin.objective
            : "Every arrangement is complete. The trophy is lit and the letter keeps."}
        </p>
      </div>
      <div className="progress-readout" aria-label={state.resolvedPins.length + " of " + TOTAL_PIN_COUNT + " contacts resolved"}>
        <span>HOUSE CONTACT</span>
        <strong>{String(state.resolvedPins.length).padStart(2, "0")} / {TOTAL_PIN_COUNT}</strong>
      </div>
      <button
        className="mechanical-button mechanical-button--primary mechanical-button--full"
        onClick={approach}
      >
        {approachLabel}
      </button>
      <div className="quick-grid">
        <button className="text-control" onClick={() => navigate("/map")}>CHECK FLOORPLAN</button>
        <button className="text-control" onClick={() => navigate("/inventory")}>OPEN CASE</button>
      </div>
    </section>
  );
}

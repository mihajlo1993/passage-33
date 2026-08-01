"use client";

import { useState } from "react";
import { MEDIA_ASSETS } from "@/src/media";
import { KEEPER_VOICE_BY_PIN, pins, riddleConfigByPin } from "@/src/pins";
import { playKeeper, type KeeperClipId } from "@/src/audio/keeper";
import { resolutionModeForPin } from "@/src/game/engine";
import type { PinResolutionResult } from "@/src/game";
import { motion } from "@/src/tokens";
import type { GameState, Pin, PinResolutionMethod } from "@/src/types";
import { roomDisplayName } from "@/src/zones";
import { useVHS } from "@/src/fx";
import { ActionBeat } from "./ActionBeat";
import { ArrivalPanel } from "./ArrivalPanel";
import { HoldButton } from "./HoldButton";
import { RiddleLock } from "./RiddleLock";
import { SparkleVerbs } from "./SparkleVerbs";
import { RunnerClicks, WagerSum } from "./WitnessPuzzles";

export interface HomeScreenProps {
  state: GameState;
  coldOpen: boolean;
  onBegin: () => void;
  resolvePin: (pinId: number, method?: PinResolutionMethod) => PinResolutionResult;
  previewPin: (pinId: number, method?: PinResolutionMethod) => PinResolutionResult;
  sufferSetback: () => number;
  /** Bumped by the operator panel to skip a staged beat in progress. */
  operatorSkipToken: number;
  navigate: (path: string) => void;
}

export function HomeScreen({
  state,
  coldOpen,
  onBegin,
  resolvePin,
  previewPin,
  sufferSetback,
  operatorSkipToken,
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

  const finishArrival = (result: PinResolutionResult) => {
    setArrival(null);
    if (!result.ok) return;
    if (result.pin.kind === "win" || result.gameCompleted) {
      navigate("/trophy");
    }
  };

  if (arrival) {
    return (
      <section className="screen home-screen">
        <ArrivalPanel result={arrival} onContinue={() => finishArrival(arrival)} />
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

  // Preflight against the engine before showing any interaction, so a gate
  // that refuses (out of order, missing pin) speaks through the arrival panel.
  const preflight = (pin: Pin): boolean => {
    const preview = previewPin(pin.id, resolutionModeForPin(pin));
    if (!preview.ok) {
      setArrival(preview);
      return false;
    }
    return true;
  };

  if (nextPin && interacting && mode === "riddle") {
    const config = riddleConfigByPin[nextPin.id];
    if (config) {
      const lockProps = {
        pin: nextPin,
        config,
        onSolved: () => resolveNow(nextPin),
        onCancel: () => setInteracting(false),
        onWrongAttempt: wrongTurn,
      };
      switch (config.puzzle?.kind) {
        case "clicks":
          return <RunnerClicks {...lockProps} />;
        case "sum":
          return <WagerSum {...lockProps} />;
        case "verbs":
          return <SparkleVerbs {...lockProps} />;
        default:
          return <RiddleLock {...lockProps} />;
      }
    }
  }

  if (nextPin && interacting && mode === "action" && nextPin.beat) {
    // Choreographed beats keep their own screen and a single tap to arm.
    return (
      <ActionBeat
        pin={nextPin}
        operatorSkipToken={operatorSkipToken}
        onResolve={() => resolveNow(nextPin)}
        onCancel={() => setInteracting(false)}
      />
    );
  }

  const openLock = () => {
    if (!nextPin) {
      navigate("/trophy");
      return;
    }
    if (mode === "scan") {
      navigate("/scan");
      return;
    }
    if (!preflight(nextPin)) return;
    setInteracting(true);
  };

  // Plain collects confirm with one held press, right here on the terminal.
  const holdToConfirm = Boolean(
    nextPin && mode === "action" && !nextPin.beat,
  );

  const ctaLabel = nextPin
    ? mode === "riddle"
      ? "Face the lock"
      : nextPin.beat
        ? "Approach"
        : nextPin.actionLabel ?? "Proceed"
    : "Open the file";

  return (
    <section className="screen home-screen" aria-labelledby="home-title">
      <header className="screen-heading">
        <p className="eyebrow">THE KEEPER'S LEDGER</p>
        <h1 id="home-title">{nextPin ? nextPin.name : "THE WATCH IS ENDED"}</h1>
        <p className="screen-index">
          {nextPin
            ? "ENTRY " + ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][nextPin.id] + " · " + roomDisplayName(nextPin.zone)
            : "EVERY LOCK IS OPEN"}
        </p>
      </header>
      <div className="objective-panel">
        <span className="objective-panel__marker" aria-hidden="true" />
        <p className="host-copy">
          {nextPin
            ? nextPin.objective
            : "Every arrangement is complete. The letter keeps."}
        </p>
      </div>
      {holdToConfirm && nextPin ? (
        <HoldButton
          label={ctaLabel}
          onComplete={() => {
            if (!preflight(nextPin)) return;
            resolveNow(nextPin);
          }}
        />
      ) : (
        <button
          className="mechanical-button mechanical-button--primary mechanical-button--full"
          onClick={openLock}
        >
          {ctaLabel}
        </button>
      )}
      <div className="quick-grid">
        <button className="text-control" onClick={() => navigate("/map")}>OPEN THE SURVEY</button>
        <button className="text-control" onClick={() => navigate("/inventory")}>OPEN THE GIFTS</button>
      </div>
    </section>
  );
}

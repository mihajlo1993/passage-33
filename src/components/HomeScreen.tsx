"use client";

import { useState } from "react";
import { MEDIA_ASSETS } from "@/src/media";
import {
  RELIGHT_ACTION_PIN_ID,
  TAPE_PLAYBACK_PIN_ID,
  TOTAL_PIN_COUNT,
  dialConfigByPin,
  pins,
} from "@/src/pins";
import { resolutionModeForPin } from "@/src/game/engine";
import type { PinResolutionResult } from "@/src/game";
import { motion } from "@/src/tokens";
import type { GameState, Pin, PinResolutionMethod } from "@/src/types";
import { useVHS } from "@/src/fx";
import { ActionBeat } from "./ActionBeat";
import { ArrivalPanel } from "./ArrivalPanel";
import { DialLockScreen } from "./DialLockScreen";
import { FieldDeskTorch } from "./FieldDeskTorch";
import { GlyphGrid } from "./GlyphGrid";
import { KeycardSlot } from "./KeycardSlot";
import { MirrorWipe } from "./MirrorWipe";
import { RelightAction } from "./RelightAction";
import { ShadowWall } from "./ShadowWall";
import { ValveWheel } from "./ValveWheel";

const APPROACH_LABELS: Record<string, string> = {
  scan: "OPEN THE SCANNER",
  ar: "RAISE THE CAMERA",
  dial: "WORK THE LOCK",
  wipe: "FACE THE MIRROR",
  glyphs: "FACE THE SHELVES",
  slot: "PRESENT THE CARDS",
  valve: "GRIP THE VALVE",
  shadow: "RAKE THE LIGHT",
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
  const [shadowStage, setShadowStage] = useState<"torch" | "wall">("torch");
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
        <p className="eyebrow">PRIVATE EVENT // THIRTY-THREE</p>
        <div className="cold-open__copy">
          <p className="system-line">BIRTHDAY HOUSE SEVEN</p>
          <h1 id="cold-title">{resumed ? "WELCOME BACK." : "OPEN YOUR EYES."}</h1>
          <p className="host-copy">
            {resumed
              ? "There you are. I kept everything exactly where you left it. A good host never clears the table before the birthday girl has finished."
              : "Happy thirty-third. I have prepared the flat, the presents, and every unpleasant little interruption. All you need to bring is the nerve to look."}
          </p>
        </div>
        <button className="mechanical-button mechanical-button--primary" onClick={onBegin}>
          {resumed ? "RETURN TO THE HOUSE" : "BEGIN"}
        </button>
        <p className="microcopy">HEADPHONES OPTIONAL // LIGHTS OFF</p>
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
    setShadowStage("torch");
    setArrival(result);
  };

  const wrongTurn = () => {
    sufferSetback();
    vhs.glitch(motion.eventMs.vhsDamageSpike);
  };

  if (nextPin && interacting) {
    const cancel = () => {
      setInteracting(false);
      setShadowStage("torch");
    };

    if (mode === "wipe") {
      return <MirrorWipe onSolved={() => resolveNow(nextPin)} onCancel={cancel} />;
    }
    if (mode === "glyphs") {
      return (
        <GlyphGrid
          onSolved={() => resolveNow(nextPin)}
          onCancel={cancel}
          onWrongAttempt={wrongTurn}
        />
      );
    }
    if (mode === "slot") {
      return <KeycardSlot onSolved={() => resolveNow(nextPin)} onCancel={cancel} />;
    }
    if (mode === "valve") {
      return <ValveWheel onSolved={() => resolveNow(nextPin)} onCancel={cancel} />;
    }
    if (mode === "shadow") {
      return shadowStage === "torch" ? (
        <FieldDeskTorch onSubmit={() => setShadowStage("wall")} onCancel={cancel} />
      ) : (
        <ShadowWall onSolved={() => resolveNow(nextPin)} onCancel={cancel} />
      );
    }
    if (mode === "dial") {
      const config = dialConfigByPin[nextPin.id];
      if (config) {
        return (
          <DialLockScreen
            kind={config.kind}
            correctValue={config.value}
            title={config.title}
            hostText={config.hostText}
            wrongText={config.wrongText}
            hints={config.hints}
            onSubmit={() => resolveNow(nextPin)}
            onCancel={cancel}
            onWrongAttempt={wrongTurn}
          />
        );
      }
    }
    if (mode === "action") {
      if (nextPin.id === RELIGHT_ACTION_PIN_ID) {
        return <RelightAction onSubmit={() => resolveNow(nextPin)} />;
      }
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
    if (mode === "ar" || nextPin.id === TAPE_PLAYBACK_PIN_ID) {
      const preview = previewPin(nextPin.id, mode);
      if (!preview.ok) {
        setArrival(preview);
        return;
      }
      navigate(mode === "ar" ? "/ar?pin=" + String(nextPin.id) : "/tape");
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
    ? nextPin.id === TAPE_PLAYBACK_PIN_ID
      ? "PRESS PLAY"
      : mode === "action"
        ? nextPin.actionLabel ?? "PROCEED"
        : APPROACH_LABELS[mode] ?? "PROCEED"
    : "VIEW TROPHY";

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

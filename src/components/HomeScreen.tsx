"use client";

import { useState } from "react";
import { MEDIA_ASSETS } from "@/src/media";
import {
  MAT_CELL_INDEX,
  TAG_GLYPH_INDEX,
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
import { CensusForm } from "./CensusForm";
import { CrestWheel } from "./CrestWheel";
import { DialLockScreen } from "./DialLockScreen";
import { FilmReel } from "./FilmReel";
import { GlyphGrid } from "./GlyphGrid";
import { MirrorWipe } from "./MirrorWipe";
import { MusicBox } from "./MusicBox";
import { SealCube } from "./SealCube";
import { SixLines } from "./SixLines";

const APPROACH_LABELS: Record<string, string> = {
  scan: "Open the lens",
  ar: "Raise the camera",
  dial: "Work the lock",
  wipe: "Develop the photograph",
  glyphs: "Read the arm tag",
  cube: "Turn the seal",
  census: "Open the census",
  wheel: "Align the crest",
  lines: "Open the ledger",
  box: "Wind the box",
  reel: "Load the projector",
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
        <p className="eyebrow">Cadastral Division · Field Terminal 7</p>
        <div className="cold-open__copy">
          <p className="system-line">THE HOUSE KEEPS THE COUNT</p>
          <h1 id="cold-title">{resumed ? "File restored." : "File 33 reopened."}</h1>
          <p className="host-copy">
            {resumed
              ? "The terminal kept your place. The survey resumes exactly where it stopped; the house never lost count of anything, including you."
              : "The survey of this address was opened thirty-three years ago and never closed. Tonight the terminal has decided to finish it. Lights low. Sound on. The house is already counting."}
          </p>
        </div>
        <button className="mechanical-button mechanical-button--primary" onClick={onBegin}>
          {resumed ? "Resume the survey" : "Reopen the file"}
        </button>
        <p className="microcopy">Sound on · Lights off · One occupant</p>
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
  };

  const wrongTurn = () => {
    sufferSetback();
    vhs.glitch(motion.eventMs.vhsDamageSpike);
  };

  if (nextPin && interacting) {
    const cancel = () => {
      setInteracting(false);
    };

    if (mode === "cube") {
      return <SealCube onSolved={() => resolveNow(nextPin)} onCancel={cancel} />;
    }
    if (mode === "census") {
      return (
        <CensusForm
          onSolved={() => resolveNow(nextPin)}
          onCancel={cancel}
          onWrongAttempt={wrongTurn}
        />
      );
    }
    if (mode === "wheel") {
      return <CrestWheel onSolved={() => resolveNow(nextPin)} onCancel={cancel} />;
    }
    if (mode === "lines") {
      return (
        <SixLines
          onSolved={() => resolveNow(nextPin)}
          onCancel={cancel}
          onWrongAttempt={wrongTurn}
        />
      );
    }
    if (mode === "box") {
      return (
        <MusicBox
          onSolved={() => resolveNow(nextPin)}
          onCancel={cancel}
          onWrongAttempt={wrongTurn}
        />
      );
    }
    if (mode === "reel") {
      return (
        <FilmReel
          onSolved={() => resolveNow(nextPin)}
          onCancel={cancel}
          onWrongAttempt={wrongTurn}
        />
      );
    }
    if (mode === "wipe") {
      const mirrored = nextPin.id === 5;
      return (
        <MirrorWipe
          eyebrow={mirrored ? "Entry 021, development" : "Entry 104, development"}
          title={mirrored ? "The Development" : "The Last Development"}
          revealText={
            mirrored
              ? "THE SHELF OF SIXTEEN\nMOUTH " + MAT_CELL_INDEX + " FROM THE LEFT"
              : "THE BATH\nBEHIND THE CURTAIN"
          }
          mirrored={mirrored}
          unsolvedCopy={
            mirrored
              ? "Clear the fog with your hand. Photographs taken in this flat develop backwards."
              : "Clear the fog. This one develops the right way round. You earned that."
          }
          solvedCopy={
            mirrored
              ? "It develops backwards, as warned. The bathroom mirror reads it fluently."
              : "There. A bath, a curtain, and behind the curtain, the last entry."
          }
          confirmLabel={mirrored ? "Read it in the mirror" : "Go to the bath"}
          onSolved={() => resolveNow(nextPin)}
          onCancel={cancel}
        />
      );
    }
    if (mode === "glyphs") {
      return (
        <GlyphGrid
          correctIndex={TAG_GLYPH_INDEX}
          eyebrow="Entry 100, the arm tag"
          title="The Tags"
          introCopy="The arm tag shows the seal, set the way the surveyor set it: hall at heaven. Sixteen glyphs. One is fixed by that setting."
          solvedCopy="The glyph concedes. The pocket tag and the hem tag are now load-bearing. Keep them close."
          confirmLabel="Fix the glyph"
          solvedLabel="Take the tags"
          onSolved={() => resolveNow(nextPin)}
          onCancel={cancel}
          onWrongAttempt={wrongTurn}
        />
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
    if (mode === "ar") {
      const preview = previewPin(nextPin.id, mode);
      if (!preview.ok) {
        setArrival(preview);
        return;
      }
      navigate("/ar?pin=" + String(nextPin.id));
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

"use client";

import { useState } from "react";
import { itemById } from "@/src/items";
import { motion } from "@/src/tokens";
import { TAPE_PLAYBACK_PIN_ID, dialConfigByPin, getPinById } from "@/src/pins";
import type { PinResolutionMethod } from "@/src/types";
import { useVHS } from "@/src/fx";
import { DialLockScreen } from "./DialLockScreen";
import { FieldDeskTorch } from "./FieldDeskTorch";
import type { PinResolutionResult } from "@/src/game";
import { phase2AudioCuesForResolution } from "@/src/game/phase2Integration";
import { useAudio } from "@/src/audio/useAudio";
import { useTorch } from "@/src/device";
import { ScannerView, type ScannerStatus } from "@/src/scanner";

export interface ScanScreenProps {
  resolvePin: (pinId: number, method?: PinResolutionMethod) => PinResolutionResult;
  previewPin: (pinId: number, method?: PinResolutionMethod) => PinResolutionResult;
  sufferSetback: () => number;
  flushPersistence: () => Promise<void>;
  navigate: (path: string) => void;
}

export function ScanScreen({ resolvePin, previewPin, sufferSetback, flushPersistence, navigate }: ScanScreenProps) {
  const [result, setResult] = useState<PinResolutionResult | null>(null);
  const [pendingDial, setPendingDial] = useState<number | null>(null);
  const [status, setStatus] = useState<ScannerStatus>("initializing");
  const [cameraError, setCameraError] = useState(false);
  const torch = useTorch();
  const audio = useAudio();
  const vhs = useVHS();

  const presentAttempt = async (
    attempt: PinResolutionResult,
    locallyAudible = false,
  ) => {
    setResult(attempt);
    if (locallyAudible) {
      for (const cue of phase2AudioCuesForResolution(attempt)) {
        void audio.play(cue);
      }
    }
    if (!attempt.ok) {
      return;
    }
    if (attempt.pin.scare === "torchKill") {
      await torch.kill(motion.eventMs.torchKill);
    }
  };

  const handleScan = async (pinId: number) => {
    // Dispatch is driven entirely by the pin record; this screen carries no
    // pin-id literals of its own.
    const pin = getPinById(pinId);
    if (pinId === TAPE_PLAYBACK_PIN_ID) {
      // The recovered tape plays before it can teach anything.
      const preview = previewPin(pinId, "scan");
      if (!preview.ok) {
        await presentAttempt(preview, true);
        return;
      }
      navigate("/tape");
      return;
    }
    if (pin?.resolution === "ar") {
      const preview = previewPin(pinId, "ar");
      if (!preview.ok) {
        await presentAttempt(preview, true);
        return;
      }
      navigate("/ar?pin=" + String(pinId));
      return;
    }

    if (pin?.resolution === "dial" && dialConfigByPin[pinId]) {
      const preview = previewPin(pinId, "dial");
      if (!preview.ok) {
        await presentAttempt(preview, true);
        return;
      }
      setPendingDial(pinId);
      return;
    }

    await presentAttempt(resolvePin(pinId, "scan"));
  };

  const completeDial = async (pinId: number) => {
    setPendingDial(null);
    await presentAttempt(resolvePin(pinId, "dial"));
  };

  const continueFromResult = async () => {
    if (!result?.ok) {
      setResult(null);
      return;
    }
    if (result.saveTriggered) {
      await flushPersistence();
      navigate("/save");
      return;
    }
    if (result.pin.id === 26 || result.gameCompleted) {
      navigate("/trophy");
      return;
    }
    if (result.pin.id === 23) {
      navigate("/");
      return;
    }
    setResult(null);
  };

  const dialConfig = pendingDial === null ? undefined : dialConfigByPin[pendingDial];
  if (pendingDial !== null && dialConfig) {
    return (
      <DialLockScreen
        kind={dialConfig.kind}
        correctValue={dialConfig.value}
        title={dialConfig.title}
        hostText={dialConfig.hostText}
        wrongText={dialConfig.wrongText}
        hints={dialConfig.hints}
        onSubmit={() => completeDial(pendingDial)}
        onCancel={() => setPendingDial(null)}
        onWrongAttempt={() => {
          // A wrong turn stings: the house notices, the tape degrades.
          sufferSetback();
          vhs.glitch(motion.eventMs.vhsDamageSpike);
        }}
      />
    );
  }

  if (result?.ok && result.pin.id === 15) {
    return (
      <FieldDeskTorch
        onSubmit={continueFromResult}
        onCancel={() => void continueFromResult()}
      />
    );
  }
  return (
    <section className="scan-screen" aria-labelledby="scan-title">
      <header className="scan-heading">
        <div><p className="eyebrow">OPTICAL CONTACT</p><h1 id="scan-title">READ THE MARK</h1></div>
        <span className="scanner-status" data-status={status}>{status.toUpperCase()}</span>
      </header>
      <ScannerView
        active={!result}
        className="scanner-frame"
        videoClassName="scanner-video"
        scanIntervalMs={motion.eventMs.scanInterval}
        duplicateDelayMs={motion.eventMs.scanDuplicate}
        onScan={handleScan}
        onStatusChange={setStatus}
        onError={() => setCameraError(true)}
        overlay={
          <div className="scanner-reticle" aria-hidden="true">
            <i /><i /><i /><i /><span>BH7 // QR</span>
          </div>
        }
      />
      {!result && (
        <div className="scanner-controls">
          <p className="scanner-instruction">ALIGN A PRINTED MARK INSIDE THE FRAME. ONLY HOUSE CODES ARE ACCEPTED.</p>
          {cameraError && <p className="system-warning">CAMERA UNAVAILABLE. ALLOW CAMERA ACCESS IN CHROME, THEN RETURN.</p>}
          {torch.supported && (
            <button className="text-control" onClick={() => void (torch.enabled ? torch.off() : torch.on())}>
              {torch.enabled ? "CUT TORCH" : "RAISE TORCH"}
            </button>
          )}
        </div>
      )}
      {result && (
        <article className="arrival-panel" data-refused={!result.ok} aria-live="assertive">
          <p className="eyebrow">
            {result.ok ? "CONTACT ACCEPTED // PIN " + String(result.pin.id).padStart(2, "0") : "CONTACT REFUSED"}
          </p>
          <h2>{result.ok ? result.pin.name : "NOT YET."}</h2>
          <p className="host-copy">{result.ok ? result.pin.bodyText : result.hint}</p>
          {result.ok && result.grantedItems.length > 0 && (
            <div className="arrival-grants">
              <span>RECOVERED</span>
              <strong>{result.grantedItems.map((id) => itemById[id]?.name ?? id).join(" // ")}</strong>
            </div>
          )}
          {result.ok && result.damage > 0 && <p className="system-warning">THE HOUSE TOOK SOMETHING OUT OF YOU.</p>}
          <button className="mechanical-button mechanical-button--primary mechanical-button--full" onClick={() => void continueFromResult()}>
            {!result.ok
              ? "STEP BACK"
              : result.saveTriggered
                ? "RECORD TO CASSETTE"
                : result.gameCompleted
                  ? "LET THE HOUSE GO QUIET"
                  : result.pin.id === 26
                    ? "VIEW THE TROPHY"
                    : result.pin.id === 27 || result.pin.id === 28
                      ? "FIND THE OTHER PRESENT"
                      : "KEEP MOVING"}
          </button>
        </article>
      )}
    </section>
  );
}

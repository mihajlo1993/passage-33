"use client";

import { useState } from "react";
import { itemById } from "@/src/items";
import { motion } from "@/src/tokens";
import {
  BALCONY_DIAL_WORD,
  CABINET_DIAL_CODE,
  getPinById,
} from "@/src/pins";
import type { PinResolutionMethod } from "@/src/types";
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
  flushPersistence: () => Promise<void>;
  navigate: (path: string) => void;
}

export function ScanScreen({ resolvePin, previewPin, flushPersistence, navigate }: ScanScreenProps) {
  const [result, setResult] = useState<PinResolutionResult | null>(null);
  const [pendingDial, setPendingDial] = useState<8 | 16 | null>(null);
  const [status, setStatus] = useState<ScannerStatus>("initializing");
  const [cameraError, setCameraError] = useState(false);
  const torch = useTorch();
  const audio = useAudio();

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
    const pin = getPinById(pinId);
    if (pinId === 12) {
      const preview = previewPin(pinId, "scan");
      if (!preview.ok) {
        await presentAttempt(preview, true);
        return;
      }
      navigate("/tape");
      return;
    }
    if (pin?.resolution === "ar" && (pinId === 3 || pinId === 17 || pinId === 18)) {
      const preview = previewPin(pinId, "ar");
      if (!preview.ok) {
        await presentAttempt(preview, true);
        return;
      }
      navigate("/ar?pin=" + String(pinId));
      return;
    }

    if (pin?.resolution === "dial" && (pinId === 8 || pinId === 16)) {
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

  const completeDial = async (pinId: 8 | 16) => {
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
    if (result.pin.id === 27) {
      navigate("/trophy");
      return;
    }
    if (result.pin.id === 23) {
      navigate("/");
      return;
    }
    setResult(null);
  };

  if (pendingDial) {
    const numeric = pendingDial === 8;
    return (
      <DialLockScreen
        kind={numeric ? "numeric" : "alpha"}
        correctValue={numeric ? CABINET_DIAL_CODE : BALCONY_DIAL_WORD}
        title={numeric ? "Cabinet Lock" : "Balcony Padlock"}
        hostText={
          numeric
            ? "Three figures. The mirror introduced them already. Turn the little wheels and let the cabinet remember you."
            : "Five letters. The tape was almost embarrassingly clear. Spell what our previous guest became."
        }
        wrongText={
          numeric
            ? "Those are three numbers, certainly. They are not my three. Again, birthday girl."
            : "A word, but not the one the balcony enjoys. The shackle is still listening."
        }
        onSubmit={() => completeDial(pendingDial)}
        onCancel={() => setPendingDial(null)}
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
                : result.pin.id === 27
                  ? "TAKE THE TROPHY"
                  : result.pin.id === 26
                    ? "RETURN TO THE CORRIDOR"
                    : "KEEP MOVING"}
          </button>
        </article>
      )}
    </section>
  );
}

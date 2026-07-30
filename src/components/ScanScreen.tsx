"use client";

import { useState } from "react";
import { motion } from "@/src/tokens";
import type { PinResolutionMethod } from "@/src/types";
import { ArrivalPanel } from "./ArrivalPanel";
import type { PinResolutionResult } from "@/src/game";
import { useTorch } from "@/src/device";
import { ScannerView, type ScannerStatus } from "@/src/scanner";

export interface ScanScreenProps {
  resolvePin: (pinId: number, method?: PinResolutionMethod) => PinResolutionResult;
  flushPersistence: () => Promise<void>;
  navigate: (path: string) => void;
}

/**
 * The scanner serves exactly the three printed marks: the start of the route,
 * the corridor box, and the sealed present. Every other pin resolves through
 * the mechanisms on the home screen, and a stray scan earns a Host refusal.
 */
export function ScanScreen({ resolvePin, flushPersistence, navigate }: ScanScreenProps) {
  const [result, setResult] = useState<PinResolutionResult | null>(null);
  const [status, setStatus] = useState<ScannerStatus>("initializing");
  const [cameraError, setCameraError] = useState(false);
  const torch = useTorch();

  const handleScan = (pinId: number) => {
    setResult(resolvePin(pinId, "scan"));
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
    if (result.pin.kind === "win" || result.gameCompleted) {
      navigate("/trophy");
      return;
    }
    setResult(null);
    navigate("/");
  };

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
      {result && <ArrivalPanel result={result} onContinue={() => void continueFromResult()} />}
    </section>
  );
}

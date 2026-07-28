"use client";

import { useEffect, useRef } from "react";
import { useCamera, useTorch } from "@/src/device";

export interface FieldDeskTorchProps {
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
}

export function FieldDeskTorch({
  onSubmit,
  onCancel,
}: FieldDeskTorchProps) {
  const camera = useCamera();
  const torch = useTorch(camera.stream);
  const latestOff = useRef(torch.off);
  latestOff.current = torch.off;

  useEffect(() => {
    void camera.start();

    return () => {
      void latestOff.current().finally(camera.stop);
    };
  }, [camera.start, camera.stop]);

  useEffect(() => {
    if (camera.status === "ready" && torch.supported && !torch.enabled) {
      void torch.on();
    }
  }, [camera.status, torch.enabled, torch.on, torch.supported]);

  const status =
    camera.status === "requesting"
      ? "WAKING THE REAR CAMERA"
      : camera.status === "error"
        ? "CAMERA REFUSED"
        : camera.status === "unsupported"
          ? "NO CAMERA FOUND"
          : !torch.supported
            ? "TORCH CONTROL UNAVAILABLE"
            : torch.error
              ? "TORCH REFUSED"
              : torch.enabled
                ? "RAKING LIGHT ACTIVE"
                : "RAISING TORCH";

  return (
    <section className="field-desk" aria-labelledby="field-desk-title">
      <header className="interaction-heading">
        <p className="eyebrow">FIELD DESK // IMPRESSED PAPER</p>
        <h1 id="field-desk-title">Hold the light low.</h1>
      </header>

      <div className="field-desk__paper" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>PRESSURE RECORD // 15</span>
      </div>

      <p className="host-copy">
        Lay the phone almost flat against the paper. Let the torch scrape
        across it. The writing will rise as shadow, if you are patient.
      </p>

      <p
        className="field-desk__status"
        data-ready={torch.enabled}
        aria-live="polite"
      >
        {status}
      </p>

      {(camera.error || torch.error) && (
        <p className="system-warning" role="alert">
          THE LIGHT COULD NOT BE FORCED ON. ALLOW CAMERA ACCESS, THEN RETURN.
        </p>
      )}

      <div className="interaction-actions">
        <button
          type="button"
          className="mechanical-button mechanical-button--primary"
          onClick={() => void onSubmit()}
        >
          I CAN READ IT
        </button>
        <button type="button" className="text-control" onClick={onCancel}>
          LEAVE THE DESK
        </button>
      </div>
    </section>
  );
}

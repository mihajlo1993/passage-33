"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ModelViewerElement } from "@/src/model-viewer";
import type { ItemModel } from "@/src/models/manifest";
import { useAudio } from "@/src/audio/useAudio";
import { useHaptics } from "@/src/device";

/**
 * Orbit polar angle is measured down from straight above the object, so
 * anything past ~149 degrees means she has rolled the object over and is
 * looking at its underside.
 */
const UNDERSIDE_PHI_RADIANS = 2.6;
/** The underside must be held, not passed through, before it gives anything up. */
const UNDERSIDE_DWELL_MS = 700;

export interface ExamineModelProps {
  itemName: string;
  model: ItemModel;
  onClose: () => void;
  /** Called when the model cannot load; the caller falls back to the icon panel. */
  onUnavailable: () => void;
}

export function ExamineModel({ itemName, model, onClose, onUnavailable }: ExamineModelProps) {
  const viewerRef = useRef<ModelViewerElement | null>(null);
  const dwellTimerRef = useRef<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(false);
  const audio = useAudio();
  const haptics = useHaptics();

  const reveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setRevealed(true);
    void audio.play("found");
    haptics.found();
  }, [audio, haptics]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const clearDwell = () => {
      if (dwellTimerRef.current !== null) {
        window.clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
    };

    const handleCameraChange = (event: Event) => {
      if (!model.secret || revealedRef.current) return;
      const detail = (event as CustomEvent<{ source?: string }>).detail;
      if (detail?.source !== "user-interaction") return;
      const orbit = viewer.getCameraOrbit();
      if (orbit.phi >= UNDERSIDE_PHI_RADIANS) {
        if (dwellTimerRef.current === null) {
          dwellTimerRef.current = window.setTimeout(() => {
            dwellTimerRef.current = null;
            reveal();
          }, UNDERSIDE_DWELL_MS);
        }
      } else {
        clearDwell();
      }
    };

    const handleError = () => onUnavailable();

    viewer.addEventListener("camera-change", handleCameraChange);
    viewer.addEventListener("error", handleError);
    return () => {
      clearDwell();
      viewer.removeEventListener("camera-change", handleCameraChange);
      viewer.removeEventListener("error", handleError);
    };
  }, [model.secret, onUnavailable, reveal]);

  return (
    <div className="examine-3d" role="dialog" aria-label={"Examining " + itemName}>
      <header className="examine-3d__heading">
        <p className="eyebrow">EXAMINE // ROTATE WITH ONE FINGER</p>
        <h2>{itemName.toUpperCase()}</h2>
      </header>

      <model-viewer
        ref={viewerRef}
        className="examine-3d__viewer"
        src={model.src}
        alt={model.alt}
        camera-controls
        disable-pan
        disable-tap
        touch-action="none"
        interaction-prompt="none"
        exposure="1.0"
        shadow-intensity="0.8"
        shadow-softness="0.6"
        tone-mapping="aces"
        camera-orbit="20deg 78deg 105%"
        min-camera-orbit="-Infinity 0deg auto"
        max-camera-orbit="Infinity 180deg auto"
      />

      <footer className="examine-3d__footing" aria-live="polite">
        {model.secret && !revealed && (
          <p className="examine-3d__hint">{model.secret.hint}</p>
        )}
        {model.secret && revealed && (
          <p className="examine-3d__reveal">{model.secret.revealText}</p>
        )}
        <button className="mechanical-button mechanical-button--full" onClick={onClose}>
          PUT IT BACK
        </button>
      </footer>
    </div>
  );
}

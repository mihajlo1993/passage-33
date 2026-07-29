"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { useAudio } from "../audio/useAudio";
import { reportOperatorArInitialization } from "../operator/runtime";
import { useVHS } from "../fx";
import { motion } from "../tokens";
import { AR_SHEET_ASSETS } from "./assets";
import { useSharedCameraVideo } from "./useSharedCameraVideo";

import type { ImageArSceneDefinition } from "./types";

type ImageArView = "placement" | "animating" | "complete";

interface PlacementPoint {
  readonly xPercent: number;
  readonly yPercent: number;
}

export interface ImageARScreenProps {
  readonly scene: ImageArSceneDefinition;
  readonly onResolved: () => boolean;
  readonly onExit: () => void;
}

export function ImageARScreen({
  scene,
  onResolved,
  onExit,
}: ImageARScreenProps) {
  const {
    videoRef,
    playback,
    error: cameraError,
  } = useSharedCameraVideo(true);
  const audio = useAudio();
  const { suspend } = useVHS();
  const completionSentRef = useRef(false);
  const animationTimerRef = useRef<number | null>(null);
  const [view, setView] = useState<ImageArView>("placement");
  const [placementPoint, setPlacementPoint] = useState<PlacementPoint | null>(
    null,
  );

  const finish = useCallback(() => {
    if (completionSentRef.current) return;
    if (!onResolved()) return;
    completionSentRef.current = true;
    setView("complete");
  }, [onResolved]);

  useEffect(() => {
    reportOperatorArInitialization("not-started");
    suspend(true);
    audio.setZone(scene.sheetId === "sheet01" ? "corridor" : "balcony");
    audio.ambient(
      scene.sheetId === "sheet01"
        ? "ambient-corridor"
        : "ambient-balcony",
    );

    return () => {
      suspend(false);
      if (animationTimerRef.current !== null) {
        window.clearTimeout(animationTimerRef.current);
      }
    };
  }, [audio, scene.sheetId, suspend]);

  useEffect(() => {
    if (playback === "ready") {
      reportOperatorArInitialization("ready");
    } else if (playback === "failed") {
      reportOperatorArInitialization("error");
    }
  }, [playback]);

  const placeSprite = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (view !== "placement" || placementPoint !== null) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const xPercent = (event.clientX - bounds.left) / bounds.width * 100;
    const yPercent = (event.clientY - bounds.top) / bounds.height * 100;
    setPlacementPoint({ xPercent, yPercent });
    setView("animating");

    const duration = scene.sheetId === "sheet01"
      ? motion.eventMs.arImageReveal
      : motion.eventMs.arHerbReward;
    animationTimerRef.current = window.setTimeout(finish, duration);
  };

  const placementStyle = placementPoint
    ? {
        "--ar-tap-x": placementPoint.xPercent + "%",
        "--ar-tap-y": placementPoint.yPercent + "%",
      } as CSSProperties
    : undefined;
  const asset = AR_SHEET_ASSETS[scene.sheetId];
  const spritePlaced = placementPoint !== null;

  return (
    <section
      className="ar-screen"
      data-mechanism="image"
      data-tone={scene.tone}
      aria-labelledby="ar-title"
    >
      <div className="ar-camera-stage">
        <video
          ref={videoRef}
          className="ar-camera-video"
          muted
          playsInline
          aria-label="Live rear camera"
        />
        <button
          className="ar-tap-plane"
          onPointerDown={placeSprite}
          disabled={view !== "placement"}
          aria-label={spritePlaced ? "Drawing placed" : "Tap to place the drawing"}
          style={placementStyle}
        >
          {spritePlaced && (
            <img
              className="ar-fallback-sprite"
              data-sheet={scene.sheetId}
              data-animating={String(view === "animating" || view === "complete")}
              src={asset.spriteUrl}
              alt=""
              aria-hidden="true"
            />
          )}
        </button>
        <div className="ar-registration" aria-hidden="true">
          <i /><i /><i /><i />
        </div>
      </div>

      <div className="ar-instrument-panel" aria-live="polite">
        <p className="eyebrow">MANUAL REGISTRATION</p>
        <h1 id="ar-title">
          {scene.sheetId === "sheet01" ? "MARKED WALL" : "PLANTER STUDY"}
        </h1>
        {view === "complete" ? (
          <>
            <p className="host-copy">
              {scene.tone === "calm"
                ? "There. Something kind remembered your birthday."
                : "Beautiful. It always reaches further for the birthday guest."}
            </p>
            <button
              className="mechanical-button mechanical-button--primary mechanical-button--full"
              onClick={onExit}
            >
              LEAVE THE IMAGE
            </button>
          </>
        ) : (
          <p className="ar-status-line">
            {view === "animating"
              ? "PLACEMENT HELD // CONTACT MOVING"
              : "TAP A POINT IN THE ROOM TO PLACE THE DRAWING"}
          </p>
        )}
        {cameraError && playback === "failed" && (
          <p className="system-warning">
            CAMERA UNAVAILABLE. MANUAL PLACEMENT REMAINS ACTIVE.
          </p>
        )}
      </div>
    </section>
  );
}

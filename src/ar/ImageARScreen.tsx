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
import { useVHS } from "../fx";
import { motion } from "../tokens";
import { AR_SHEET_ASSETS } from "./assets";
import { AR_ACQUISITION_TIMEOUT_MS } from "./config";
import { useSharedCameraVideo } from "./useSharedCameraVideo";

import type { ImageArRuntime } from "./imageRuntime";
import type { ImageArSceneDefinition } from "./types";

type ImageArView =
  | "tracking"
  | "target-found"
  | "fallback"
  | "fallback-animating"
  | "complete";

interface FallbackPoint {
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
    cameraStatus,
    error: cameraError,
  } = useSharedCameraVideo(true);
  const audio = useAudio();
  const { suspend } = useVHS();
  const rendererMountRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ImageArRuntime | null>(null);
  const trackingStartedRef = useRef(false);
  const completionSentRef = useRef(false);
  const fallbackEnteredRef = useRef(false);
  const acquisitionTimerRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const [view, setView] = useState<ImageArView>("tracking");
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [fallbackPoint, setFallbackPoint] = useState<FallbackPoint | null>(
    null,
  );

  const clearAcquisitionTimer = useCallback(() => {
    if (acquisitionTimerRef.current === null) return;
    window.clearTimeout(acquisitionTimerRef.current);
    acquisitionTimerRef.current = null;
  }, []);

  const finish = useCallback(() => {
    if (completionSentRef.current) return;
    if (!onResolved()) return;
    completionSentRef.current = true;
    clearAcquisitionTimer();
    setView("complete");
  }, [clearAcquisitionTimer, onResolved]);

  const enterFallback = useCallback((reason: string) => {
    fallbackEnteredRef.current = true;
    clearAcquisitionTimer();
    runtimeRef.current?.dispose();
    runtimeRef.current = null;
    setFallbackReason(reason);
    setView((current) => current === "complete" ? current : "fallback");
  }, [clearAcquisitionTimer]);
  const armAcquisitionTimer = useCallback(() => {
    clearAcquisitionTimer();
    acquisitionTimerRef.current = window.setTimeout(() => {
      enterFallback("The drawing would not hold still for the lens.");
    }, AR_ACQUISITION_TIMEOUT_MS);
  }, [clearAcquisitionTimer, enterFallback]);

  useEffect(() => {
    suspend(true);
    audio.setZone(scene.targetId === "sheet01" ? "corridor" : "balcony");
    audio.ambient(
      scene.targetId === "sheet01"
        ? "ambient-corridor"
        : "ambient-balcony",
    );

    return () => {
      suspend(false);
      clearAcquisitionTimer();
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
  }, [audio, clearAcquisitionTimer, scene.targetId, suspend]);

  useEffect(() => {
    const cameraStopped =
      playback === "ready" && cameraStatus === "idle";
    if (
      !completionSentRef.current
      && !fallbackEnteredRef.current
      && (playback === "failed" || cameraStopped)
    ) {
      enterFallback(cameraError?.message ?? "Camera contact failed.");
    }
  }, [cameraError, cameraStatus, enterFallback, playback]);

  useEffect(() => {
    if (
      playback !== "ready"
      || trackingStartedRef.current
      || fallbackEnteredRef.current
      || !videoRef.current
      || !rendererMountRef.current
    ) {
      return;
    }

    let cancelled = false;
    trackingStartedRef.current = true;
    armAcquisitionTimer();

    void import("./imageRuntime").then(async ({ createImageArRuntime }) => {
      if (
        cancelled
        || !videoRef.current
        || fallbackEnteredRef.current
        || !rendererMountRef.current
      ) {
        return;
      }

      const runtime = createImageArRuntime({
        video: videoRef.current,
        container: rendererMountRef.current,
        scene,
        onFound: () => {
          if (
            cancelled
            || completionSentRef.current
            || fallbackEnteredRef.current
          ) return;
          clearAcquisitionTimer();
          setView("target-found");
        },
        onLost: () => {
          if (
            cancelled
            || completionSentRef.current
            || fallbackEnteredRef.current
          ) {
            return;
          }
          setView("tracking");
          armAcquisitionTimer();
        },
        onComplete: () => {
          if (!cancelled && !fallbackEnteredRef.current) finish();
        },
        onFallback: (runtimeError) => {
          if (
            !cancelled
            && !completionSentRef.current
            && !fallbackEnteredRef.current
          ) {
            enterFallback(runtimeError.message);
          }
        },
      });
      runtimeRef.current = runtime;
      await runtime.start();
    }).catch((reason: unknown) => {
      if (
        cancelled
        || completionSentRef.current
        || fallbackEnteredRef.current
      ) return;
      enterFallback(
        reason instanceof Error
          ? reason.message
          : "The drawing refused image tracking.",
      );
    });

    return () => {
      cancelled = true;
      trackingStartedRef.current = false;
      clearAcquisitionTimer();
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
  }, [
    armAcquisitionTimer,
    clearAcquisitionTimer,
    enterFallback,
    finish,
    playback,
    scene,
    videoRef,
  ]);

  const placeFallback = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (view !== "fallback" || fallbackPoint) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const xPercent = (event.clientX - bounds.left) / bounds.width * 100;
    const yPercent = (event.clientY - bounds.top) / bounds.height * 100;
    setFallbackPoint({ xPercent, yPercent });
    setView("fallback-animating");

    const duration = scene.targetId === "sheet01"
      ? motion.eventMs.arImageReveal
      : motion.eventMs.arHerbReward;
    fallbackTimerRef.current = window.setTimeout(finish, duration);
  };

  const fallbackStyle = fallbackPoint
    ? {
        "--ar-tap-x": fallbackPoint.xPercent + "%",
        "--ar-tap-y": fallbackPoint.yPercent + "%",
      } as CSSProperties
    : undefined;
  const asset = AR_SHEET_ASSETS[scene.targetId];
  const acquired = view === "target-found";
  const fallback = view === "fallback" || view === "fallback-animating";

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
        <div
          ref={rendererMountRef}
          className="ar-render-mount"
          aria-hidden="true"
        />
        {fallback && (
          <button
            className="ar-tap-plane"
            onPointerDown={placeFallback}
            disabled={view === "fallback-animating"}
            aria-label={
              fallbackPoint
                ? "Drawing placed"
                : "Tap to place the drawing"
            }
            style={fallbackStyle}
          >
            {fallbackPoint && (
              <img
                className="ar-fallback-sprite"
                data-target={scene.targetId}
                data-animating={String(view === "fallback-animating")}
                src={asset.overlayDataUri}
                alt=""
                aria-hidden="true"
              />
            )}
          </button>
        )}
        <div className="ar-registration" aria-hidden="true">
          <i /><i /><i /><i />
        </div>
      </div>

      <div className="ar-instrument-panel" aria-live="polite">
        <p className="eyebrow">
          {fallback ? "MANUAL REGISTRATION" : "IMAGE CONTACT"}
        </p>
        <h1 id="ar-title">
          {scene.targetId === "sheet01" ? "MARKED WALL" : "PLANTER STUDY"}
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
        ) : fallback ? (
          <>
            <p className="ar-status-line">
              TRACKING REFUSED // TAP THE DRAWING TO PLACE IT
            </p>
            {fallbackReason && (
              <p className="host-copy host-copy--compact">
                I prepared a simpler arrangement. Tap where it belongs.
              </p>
            )}
          </>
        ) : (
          <p className="ar-status-line">
            {playback !== "ready"
              ? "OPENING SHUTTER"
              : acquired
                ? "HOLD STILL // CONTACT HELD"
                : "FRAME THE WHOLE CRAYON SHEET"}
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

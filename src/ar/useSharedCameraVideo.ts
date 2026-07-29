"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { useCamera, type CameraStatus } from "../device/useCamera";

const AR_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 30, max: 30 },
  },
};

export type ArCameraPlayback = "idle" | "starting" | "ready" | "failed";

export interface SharedCameraVideo {
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  readonly playback: ArCameraPlayback;
  readonly cameraStatus: CameraStatus;
  readonly error: Error | null;
}

/**
 * Attaches the app's one shared camera lease to a video element. The device
 * layer remains the only code allowed to acquire or stop physical tracks.
 */
export function useSharedCameraVideo(active: boolean): SharedCameraVideo {
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useCamera();
  const [playback, setPlayback] = useState<ArCameraPlayback>("idle");
  const [playbackError, setPlaybackError] = useState<Error | null>(null);

  useEffect(() => {
    if (!active) {
      setPlayback("idle");
      setPlaybackError(null);
      return;
    }

    let cancelled = false;
    let attachedVideo: HTMLVideoElement | null = null;
    setPlayback("starting");
    setPlaybackError(null);

    void camera.start(AR_CAMERA_CONSTRAINTS).then(async (stream) => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!stream || !video) {
        setPlayback("failed");
        setPlaybackError(
          camera.error ?? new Error("The house camera did not answer."),
        );
        return;
      }

      attachedVideo = video;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;

      try {
        await video.play();
        if (!cancelled) setPlayback("ready");
      } catch (reason: unknown) {
        if (cancelled) return;
        setPlayback("failed");
        setPlaybackError(
          reason instanceof Error
            ? reason
            : new Error("The camera image would not begin."),
        );
      }
    });

    return () => {
      cancelled = true;
      if (attachedVideo) {
        attachedVideo.pause();
        attachedVideo.srcObject = null;
      }
      camera.stop();
    };
  }, [active, camera.start, camera.stop]);

  return {
    videoRef,
    playback,
    cameraStatus: camera.status,
    error: playbackError ?? camera.error,
  };
}

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useCamera, type CameraStatus } from "../device/useCamera";
import {
  createJsQrDecoder,
  createQrDecoder,
  type QrDecoder,
  type QrDecoderKind,
} from "./decoder";
import { parsePinPayload } from "./payload";

export type ScannerStatus =
  | CameraStatus
  | "initializing"
  | "scanning"
  | "paused";

export interface ScannerViewProps {
  onScan: (pinId: number, rawValue: string) => void | Promise<void>;
  onError?: (error: Error) => void;
  onStatusChange?: (status: ScannerStatus) => void;
  active?: boolean;
  className?: string;
  videoClassName?: string;
  overlay?: ReactNode;
  scanIntervalMs?: number;
  duplicateDelayMs?: number;
}

const MIN_SCAN_INTERVAL_MS = 80;

interface DecoderState {
  stream: MediaStream | null;
  kind: QrDecoderKind | null;
  failed: boolean;
}

function normalizeDelay(value: number, minimum: number): number {
  return Number.isFinite(value) ? Math.max(minimum, value) : minimum;
}

/**
 * Camera-backed QR view. Only exact bh7 pin payloads reach onScan; arbitrary QR
 * codes are ignored. The underlying stream is leased from useCamera and shared
 * with any present or future camera consumer.
 */
export function ScannerView({
  onScan,
  onError,
  onStatusChange,
  active = true,
  className,
  videoClassName,
  overlay,
  scanIntervalMs = 120,
  duplicateDelayMs = 1500,
}: ScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const decoderRef = useRef<QrDecoder | null>(null);
  const fallbackAttemptedRef = useRef(false);
  const frameRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const lastAttemptRef = useRef(0);
  const lastResultRef = useRef<{ payload: string; at: number } | null>(null);
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  const [decoderState, setDecoderState] = useState<DecoderState>({
    stream: null,
    kind: null,
    failed: false,
  });
  const {
    stream: cameraStream,
    status: cameraStatus,
    error: cameraError,
    start: startCamera,
    stop: stopCamera,
  } = useCamera();
  const decoderKind =
    decoderState.stream === cameraStream ? decoderState.kind : null;
  const decoderFailed =
    decoderState.stream === cameraStream && decoderState.failed;
  const scannerStatus: ScannerStatus = !active
    ? "paused"
    : cameraStatus !== "ready"
      ? cameraStatus
      : decoderFailed
        ? "error"
        : decoderKind
          ? "scanning"
          : "initializing";

  const reportError = useCallback((error: Error) => {
    onErrorRef.current?.(error);
  }, []);

  useEffect(() => {
    onScanRef.current = onScan;
    onErrorRef.current = onError;
  }, [onError, onScan]);

  useEffect(() => {
    onStatusChange?.(scannerStatus);
  }, [onStatusChange, scannerStatus]);

  useEffect(() => {
    if (!active) {
      stopCamera();
      return;
    }

    void startCamera();
    return stopCamera;
  }, [active, startCamera, stopCamera]);

  useEffect(() => {
    if (cameraError) {
      reportError(cameraError);
    }
  }, [cameraError, reportError]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.srcObject = cameraStream;
    if (cameraStream) {
      void video.play().catch((reason: unknown) => {
        reportError(
          reason instanceof Error ? reason : new Error("Unable to play the camera feed."),
        );
      });
    }

    return () => {
      if (video.srcObject === cameraStream) {
        video.srcObject = null;
      }
    };
  }, [cameraStream, reportError]);

  useEffect(() => {
    let cancelled = false;
    if (!active || !cameraStream) {
      decoderRef.current = null;
      return;
    }

    void createQrDecoder()
      .then((decoder) => {
        if (cancelled) {
          return;
        }
        decoderRef.current = decoder;
        fallbackAttemptedRef.current = decoder.kind === "jsqr";
        setDecoderState({ stream: cameraStream, kind: decoder.kind, failed: false });
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          const error =
            reason instanceof Error
              ? reason
              : new Error("Unable to initialize the QR scanner.");
          setDecoderState({ stream: cameraStream, kind: null, failed: true });
          reportError(error);
        }
      });

    return () => {
      cancelled = true;
      decoderRef.current = null;
    };
  }, [active, cameraStream, reportError]);

  useEffect(() => {
    if (!active || !cameraStream) {
      return;
    }

    let cancelled = false;
    const interval = normalizeDelay(scanIntervalMs, MIN_SCAN_INTERVAL_MS);
    const duplicateDelay = normalizeDelay(duplicateDelayMs, 0);

    const scan = async (now: number) => {
      frameRef.current = null;
      if (cancelled) {
        return;
      }

      const video = videoRef.current;
      const decoder = decoderRef.current;
      const ready =
        video &&
        decoder &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0;

      if (ready && !busyRef.current && now - lastAttemptRef.current >= interval) {
        busyRef.current = true;
        lastAttemptRef.current = now;

        try {
          const rawValues = await decoder.decode(video);
          if (cancelled) {
            return;
          }
          for (const rawValue of rawValues) {
            const pinId = parsePinPayload(rawValue);
            if (pinId === null) {
              continue;
            }

            const previous = lastResultRef.current;
            const isDuplicate =
              previous?.payload === rawValue && now - previous.at < duplicateDelay;
            if (!isDuplicate) {
              lastResultRef.current = { payload: rawValue, at: now };
              await onScanRef.current(pinId, rawValue);
            }
            break;
          }
        } catch (reason: unknown) {
          if (cancelled) {
            return;
          }
          // Some Chromium builds expose BarcodeDetector but fail on video input.
          // Switch once to the local decoder and keep the session alive.
          if (decoder.kind === "barcode-detector" && !fallbackAttemptedRef.current) {
            fallbackAttemptedRef.current = true;
            const fallback = createJsQrDecoder();
            decoderRef.current = fallback;
            setDecoderState({
              stream: cameraStream,
              kind: fallback.kind,
              failed: false,
            });
          } else {
            reportError(
              reason instanceof Error
                ? reason
                : new Error("Unable to read the camera frame."),
            );
          }
        } finally {
          busyRef.current = false;
        }
      }

      if (!cancelled) {
        frameRef.current = requestAnimationFrame(scan);
      }
    };

    frameRef.current = requestAnimationFrame(scan);
    return () => {
      cancelled = true;
      busyRef.current = false;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [active, cameraStream, duplicateDelayMs, reportError, scanIntervalMs]);

  return (
    <div
      className={className}
      data-camera-status={cameraStatus}
      data-decoder={decoderKind ?? undefined}
      data-scanner-status={scannerStatus}
    >
      <video
        ref={videoRef}
        className={videoClassName}
        autoPlay
        muted
        playsInline
        aria-label="QR scanner camera"
      />
      {overlay}
    </div>
  );
}

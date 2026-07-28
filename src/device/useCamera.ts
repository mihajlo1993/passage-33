"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

export type CameraStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "unsupported"
  | "error";

export interface CameraSnapshot {
  stream: MediaStream | null;
  status: CameraStatus;
  error: Error | null;
}

export interface CameraController extends CameraSnapshot {
  supported: boolean;
  start: (constraints?: MediaStreamConstraints) => Promise<MediaStream | null>;
  stop: () => void;
}

const DEFAULT_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
  },
};

const SERVER_SNAPSHOT: CameraSnapshot = {
  stream: null,
  status: "idle",
  error: null,
};

let snapshot: CameraSnapshot = SERVER_SNAPSHOT;
let pendingRequest: Promise<MediaStream | null> | null = null;

const listeners = new Set<() => void>();
const consumers = new Set<symbol>();

function hasCameraApi(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

function publish(next: CameraSnapshot): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function streamIsLive(stream: MediaStream | null): stream is MediaStream {
  return Boolean(
    stream && stream.getVideoTracks().some((track) => track.readyState === "live"),
  );
}

function stopStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

function handleTrackEnded(stream: MediaStream): void {
  if (snapshot.stream !== stream || streamIsLive(stream)) {
    return;
  }

  publish({ stream: null, status: "idle", error: null });
}

/**
 * Subscribe to the shared camera state. Exported for sibling device wrappers;
 * app code should normally use useCamera().
 */
export function subscribeToCamera(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** See subscribeToCamera. */
export function getCameraSnapshot(): CameraSnapshot {
  return snapshot;
}

export function getCameraServerSnapshot(): CameraSnapshot {
  return SERVER_SNAPSHOT;
}

async function acquireCamera(
  consumer: symbol,
  constraints: MediaStreamConstraints,
): Promise<MediaStream | null> {
  consumers.add(consumer);

  if (streamIsLive(snapshot.stream)) {
    return snapshot.stream;
  }

  if (pendingRequest) {
    return pendingRequest;
  }

  if (!hasCameraApi()) {
    publish({ stream: null, status: "unsupported", error: null });
    return null;
  }

  publish({ stream: null, status: "requesting", error: null });

  pendingRequest = navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      if (consumers.size === 0) {
        stopStream(stream);
        publish({ stream: null, status: "idle", error: null });
        return null;
      }

      stream.getVideoTracks().forEach((track) => {
        track.addEventListener("ended", () => handleTrackEnded(stream), {
          once: true,
        });
      });
      publish({ stream, status: "ready", error: null });
      return stream;
    })
    .catch((reason: unknown) => {
      const error =
        reason instanceof Error ? reason : new Error("Unable to open the camera.");
      publish({ stream: null, status: "error", error });
      return null;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}

function releaseCamera(consumer: symbol): void {
  consumers.delete(consumer);

  if (consumers.size > 0) {
    return;
  }

  if (snapshot.stream) {
    stopStream(snapshot.stream);
  }
  publish({ stream: null, status: "idle", error: null });
}

/**
 * A reference-safe lease on the app's one camera stream. Calling start more than
 * once from the same hook is idempotent; the physical tracks stop only after the
 * last mounted consumer calls stop or unmounts.
 */
export function useCamera(): CameraController {
  const consumerRef = useRef<symbol | null>(null);
  if (consumerRef.current === null) {
    consumerRef.current = Symbol("camera-consumer");
  }

  const current = useSyncExternalStore(
    subscribeToCamera,
    getCameraSnapshot,
    getCameraServerSnapshot,
  );

  const start = useCallback((constraints = DEFAULT_CONSTRAINTS) => {
    return acquireCamera(consumerRef.current as symbol, constraints);
  }, []);

  const stop = useCallback(() => {
    releaseCamera(consumerRef.current as symbol);
  }, []);

  useEffect(() => stop, [stop]);

  return {
    ...current,
    supported: current.status !== "unsupported" && hasCameraApi(),
    start,
    stop,
  };
}

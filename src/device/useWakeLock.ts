"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

interface WakeLockSentinelLike extends EventTarget {
  readonly released: boolean;
  release: () => Promise<void>;
}

interface WakeLockManagerLike {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
}

interface NavigatorWithWakeLock {
  wakeLock?: WakeLockManagerLike;
}

export interface WakeLockSnapshot {
  supported: boolean;
  active: boolean;
  error: Error | null;
}

export interface WakeLockController extends WakeLockSnapshot {
  acquire: () => Promise<boolean>;
  release: () => Promise<void>;
}

const SERVER_SNAPSHOT: WakeLockSnapshot = {
  supported: false,
  active: false,
  error: null,
};

let snapshot: WakeLockSnapshot = SERVER_SNAPSHOT;
let sentinel: WakeLockSentinelLike | null = null;
let pendingRequest: Promise<boolean> | null = null;
let listeningForVisibility = false;

const listeners = new Set<() => void>();
const consumers = new Set<symbol>();

function wakeLockManager(): WakeLockManagerLike | null {
  if (typeof navigator === "undefined") {
    return null;
  }
  return (navigator as unknown as NavigatorWithWakeLock).wakeLock ?? null;
}

function publish(next: WakeLockSnapshot): void {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): WakeLockSnapshot {
  return snapshot;
}

function getServerSnapshot(): WakeLockSnapshot {
  return SERVER_SNAPSHOT;
}

async function requestSharedWakeLock(): Promise<boolean> {
  const manager = wakeLockManager();
  if (!manager) {
    publish({ supported: false, active: false, error: null });
    return false;
  }

  if (sentinel && !sentinel.released) {
    return true;
  }
  if (pendingRequest) {
    return pendingRequest;
  }
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return false;
  }

  publish({ supported: true, active: false, error: null });
  pendingRequest = manager
    .request("screen")
    .then((nextSentinel) => {
      if (consumers.size === 0) {
        void nextSentinel.release();
        return false;
      }

      sentinel = nextSentinel;
      nextSentinel.addEventListener(
        "release",
        () => {
          if (sentinel === nextSentinel) {
            sentinel = null;
            publish({ supported: true, active: false, error: null });
          }
        },
        { once: true },
      );
      publish({ supported: true, active: true, error: null });
      return true;
    })
    .catch((reason: unknown) => {
      const error =
        reason instanceof Error
          ? reason
          : new Error("Unable to keep the screen awake.");
      publish({ supported: true, active: false, error });
      return false;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}

async function releaseSharedWakeLock(): Promise<void> {
  const current = sentinel;
  sentinel = null;
  if (current && !current.released) {
    try {
      await current.release();
    } catch {
      // A browser may release it first while the page is being hidden.
    }
  }
  publish({ supported: Boolean(wakeLockManager()), active: false, error: null });
}

function handleVisibilityChange(): void {
  if (document.visibilityState === "visible" && consumers.size > 0) {
    void requestSharedWakeLock();
  }
}

function addVisibilityListener(): void {
  if (!listeningForVisibility && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    listeningForVisibility = true;
  }
}

function removeVisibilityListener(): void {
  if (listeningForVisibility && typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    listeningForVisibility = false;
  }
}

async function retain(consumer: symbol): Promise<boolean> {
  consumers.add(consumer);
  addVisibilityListener();
  return requestSharedWakeLock();
}

async function release(consumer: symbol): Promise<void> {
  consumers.delete(consumer);
  if (consumers.size === 0) {
    removeVisibilityListener();
    await releaseSharedWakeLock();
  }
}

/** Holds one shared screen wake lock for as long as any consumer is mounted. */
export function useWakeLock(): WakeLockController {
  const consumerRef = useRef<symbol | null>(null);
  if (consumerRef.current === null) {
    consumerRef.current = Symbol("wake-lock-consumer");
  }

  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const acquire = useCallback(
    () => retain(consumerRef.current as symbol),
    [],
  );
  const releaseOwnLock = useCallback(
    () => release(consumerRef.current as symbol),
    [],
  );

  useEffect(() => {
    void acquire();
    return () => {
      void releaseOwnLock();
    };
  }, [acquire, releaseOwnLock]);

  return { ...current, acquire, release: releaseOwnLock };
}

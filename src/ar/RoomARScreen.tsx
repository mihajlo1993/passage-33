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
import { effects, motion } from "../tokens";
import { AR_CREATURE_ASSET } from "./assets";
import { ROOM_AR_ACQUISITION_TIMEOUT_MS } from "./config";
import {
  createRoomXrRuntime,
  isRoomXrSupported,
  type RoomXrRuntime,
} from "./roomRuntime";
import { useSharedCameraVideo } from "./useSharedCameraVideo";

type RoomArView =
  | "checking"
  | "briefing"
  | "opening"
  | "finding-floor"
  | "ready-to-place"
  | "placed"
  | "firing"
  | "hit"
  | "collapsing"
  | "complete"
  | "fallback"
  | "fallback-placed";

interface FallbackPoint {
  readonly xPercent: number;
  readonly yPercent: number;
}

type RoomArViewUpdate =
  | RoomArView
  | ((current: RoomArView) => RoomArView);

interface FallbackTransition {
  readonly expectedGeneration: number;
  readonly preservePlacement: boolean;
}

const ROOM_TRANSFER_POINT: FallbackPoint = Object.freeze({
  xPercent: effects.ar.roomTransferXPercent,
  yPercent: effects.ar.roomTransferYPercent,
});

export function viewAfterRoomFallback(
  current: RoomArView,
  preservePlacement: boolean,
): RoomArView {
  if (!preservePlacement) return "fallback";
  if (
    current === "firing"
    || current === "hit"
    || current === "collapsing"
    || current === "complete"
  ) {
    return current;
  }
  return "fallback-placed";
}

export interface RoomARScreenProps {
  readonly onResolved: () => boolean;
  readonly onExit: () => void;
}

export function RoomARScreen({
  onResolved,
  onExit,
}: RoomARScreenProps) {
  const rendererMountRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<RoomXrRuntime | null>(null);
  const timersRef = useRef<number[]>([]);
  const placementTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const sessionGenerationRef = useRef(0);
  const viewRef = useRef<RoomArView>("checking");
  const placementAnnouncedRef = useRef(false);
  const shotFiredRef = useRef(false);
  const resolutionSentRef = useRef(false);
  const [view, setView] = useState<RoomArView>("checking");
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [fallbackPoint, setFallbackPoint] = useState<FallbackPoint | null>(
    null,
  );
  const fallbackCameraActive = fallbackReason !== null;
  const fallbackActive = fallbackCameraActive;
  const { videoRef, playback, error: cameraError } =
    useSharedCameraVideo(fallbackCameraActive);
  const audio = useAudio();
  const { suspend } = useVHS();

  const clearPlacementTimer = useCallback(() => {
    if (placementTimerRef.current === null) return;
    window.clearTimeout(placementTimerRef.current);
    placementTimerRef.current = null;
  }, []);

  const updateView = useCallback((update: RoomArViewUpdate) => {
    if (!mountedRef.current) return;
    const next = typeof update === "function"
      ? update(viewRef.current)
      : update;
    viewRef.current = next;
    setView(next);
  }, []);

  const addTimer = useCallback((callback: () => void, delayMs: number) => {
    const timer = window.setTimeout(() => {
      if (mountedRef.current) callback();
    }, delayMs);
    timersRef.current.push(timer);
  }, []);

  const announcePlacement = useCallback(() => {
    if (!mountedRef.current || placementAnnouncedRef.current) return;
    placementAnnouncedRef.current = true;
    clearPlacementTimer();
    updateView((current) =>
      current === "fallback" ? "fallback-placed" : "placed"
    );
    void audio.play("room-monster-arrival");
  }, [audio, clearPlacementTimer, updateView]);

  const enterFallback = useCallback(async (
    reason: string,
    transition: FallbackTransition,
  ) => {
    if (
      !mountedRef.current
      || sessionGenerationRef.current !== transition.expectedGeneration
    ) {
      return;
    }

    reportOperatorArInitialization("error");

    // Invalidate every callback owned by this XR attempt before disposal can
    // synchronously emit an error or end notification.
    const fallbackGeneration = transition.expectedGeneration + 1;
    sessionGenerationRef.current = fallbackGeneration;
    clearPlacementTimer();
    const activeRuntime = runtimeRef.current;
    runtimeRef.current = null;

    await activeRuntime?.dispose();

    if (
      !mountedRef.current
      || sessionGenerationRef.current !== fallbackGeneration
    ) {
      return;
    }

    // fallbackReason activates the shared getUserMedia lease, so it must be
    // committed only after the immersive session has fully released camera.
    setFallbackReason(reason);
    if (transition.preservePlacement) {
      setFallbackPoint(ROOM_TRANSFER_POINT);
    } else {
      setFallbackPoint(null);
      placementAnnouncedRef.current = false;
    }
    updateView((current) => viewAfterRoomFallback(
      current,
      transition.preservePlacement,
    ));
  }, [clearPlacementTimer, updateView]);

  useEffect(() => {
    mountedRef.current = true;
    reportOperatorArInitialization("not-started");
    suspend(true);
    audio.setZone("living");
    audio.ambient("ambient-living");

    let cancelled = false;
    const supportGeneration = sessionGenerationRef.current;
    void isRoomXrSupported().then((supported) => {
      if (
        cancelled
        || !mountedRef.current
        || sessionGenerationRef.current !== supportGeneration
      ) {
        return;
      }
      if (supported) updateView("briefing");
      else {
        void enterFallback(
          "Immersive AR is unavailable on this phone.",
          {
            expectedGeneration: supportGeneration,
            preservePlacement: false,
          },
        );
      }
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      sessionGenerationRef.current += 1;
      suspend(false);
      clearPlacementTimer();
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
      void runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
  }, [audio, clearPlacementTimer, enterFallback, suspend, updateView]);

  const beginRoomSession = () => {
    if (
      !mountedRef.current
      || runtimeRef.current !== null
      || view !== "briefing"
      || !rendererMountRef.current
    ) {
      return;
    }

    const sessionGeneration = sessionGenerationRef.current + 1;
    sessionGenerationRef.current = sessionGeneration;
    const isCurrentSession = () =>
      mountedRef.current
      && sessionGenerationRef.current === sessionGeneration;

    const transferToFallback = (reason: string) => {
      if (!isCurrentSession()) return;
      void enterFallback(reason, {
        expectedGeneration: sessionGeneration,
        preservePlacement: placementAnnouncedRef.current,
      });
    };

    const immersiveOverlayRoot = document.body;
    const runtime = createRoomXrRuntime({
      mount: rendererMountRef.current,
      overlayRoot: immersiveOverlayRoot,
      onPhaseChange: (phase) => {
        if (isCurrentSession() && phase === "tracking") {
          updateView("finding-floor");
        }
      },
      onCandidateChange: (placement) => {
        if (!isCurrentSession()) return;
        updateView((current) => {
          if (
            current === "placed"
            || current === "firing"
            || current === "hit"
            || current === "collapsing"
            || current === "complete"
          ) {
            return current;
          }
          return placement ? "ready-to-place" : "finding-floor";
        });
      },
      onPlaced: () => {
        if (isCurrentSession()) announcePlacement();
      },
      onSessionEnded: () => {
        transferToFallback(
          placementAnnouncedRef.current
            ? "The immersive room closed. The guest remains in the field."
            : "The immersive room closed before the guest arrived.",
        );
      },
      onError: (runtimeError) => transferToFallback(runtimeError.message),
    });
    runtimeRef.current = runtime;
    updateView("opening");
    placementTimerRef.current = window.setTimeout(() => {
      transferToFallback("The floor would not hold a placement.");
    }, ROOM_AR_ACQUISITION_TIMEOUT_MS);

    // Keep this call directly inside the user gesture. The runtime performs
    // requestSession before its first await.
    void runtime.start()
      .then(() => {
        if (isCurrentSession()) reportOperatorArInitialization("ready");
      })
      .catch((reason: unknown) => {
        transferToFallback(
          reason instanceof Error
            ? reason.message
            : "The immersive room would not open.",
        );
      });
  };

  const placeInRoom = () => {
    runtimeRef.current?.place();
  };

  const placeFallback = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (view !== "fallback" || fallbackPoint) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setFallbackPoint({
      xPercent: (event.clientX - bounds.left) / bounds.width * 100,
      yPercent: (event.clientY - bounds.top) / bounds.height * 100,
    });
    announcePlacement();
  };

  const fire = () => {
    if (
      shotFiredRef.current
      || (view !== "placed" && view !== "fallback-placed")
    ) {
      return;
    }

    shotFiredRef.current = true;
    updateView("firing");
    void audio.play("pistol-fire");

    addTimer(() => {
      updateView("hit");
      void audio.play("monster-hit");
      if (!resolutionSentRef.current && onResolved()) {
        resolutionSentRef.current = true;
      }

      addTimer(() => {
        updateView("collapsing");
        runtimeRef.current?.collapse();
        void audio.play("monster-collapse");

        addTimer(() => {
          updateView("complete");
        }, motion.eventMs.arCollapseDuration);
      }, motion.eventMs.arCollapseLead);
    }, motion.eventMs.arHit);
  };

  const fallbackStyle = fallbackPoint
    ? {
        "--ar-tap-x": fallbackPoint.xPercent + "%",
        "--ar-tap-y": fallbackPoint.yPercent + "%",
      } as CSSProperties
    : undefined;
  const canPlace = view === "ready-to-place";
  const canFire = view === "placed" || view === "fallback-placed";
  const cameraFallbackVisible = fallbackCameraActive;

  return (
    <section
      className="ar-screen"
      data-mechanism="room"
      data-shaking={String(view === "firing" || view === "hit")}
      data-collapsing={String(view === "collapsing")}
      data-collapsed={String(view === "complete")}
      aria-labelledby="ar-room-title"
    >
      <div className="ar-camera-stage">
        {cameraFallbackVisible && (
          <video
            ref={videoRef}
            className="ar-camera-video"
            muted
            playsInline
            aria-label="Live rear camera"
          />
        )}
        <div
          ref={rendererMountRef}
          className="ar-render-mount"
          aria-hidden="true"
        />
        {cameraFallbackVisible && (
          <button
            className="ar-tap-plane"
            onPointerDown={placeFallback}
            disabled={view !== "fallback"}
            aria-label={
              fallbackPoint
                ? "Room guest placed"
                : "Tap the floor to place the room guest"
            }
            style={fallbackStyle}
          >
            {fallbackPoint && (
              <img
                className="ar-fallback-sprite ar-fallback-sprite--monster"
                data-animating="true"
                src={AR_CREATURE_ASSET.dataUri}
                alt=""
                aria-hidden="true"
              />
            )}
          </button>
        )}
        <div className="ar-floor-reticle" data-ready={String(canPlace)} aria-hidden="true" />
      </div>

      <div className="ar-instrument-panel" aria-live="polite">
        <p className="eyebrow">
          {fallbackActive ? "MANUAL ROOM CONTACT" : "ROOM CONTACT"}
        </p>
        <h1 id="ar-room-title">THE OTHER GUEST</h1>

        {view === "checking" && (
          <p className="ar-status-line">CHECKING THE ROOM</p>
        )}
        {view === "briefing" && (
          <>
            <p className="host-copy">
              I saved him a place in the living room. Open it when you are ready.
            </p>
            <button
              className="mechanical-button mechanical-button--primary mechanical-button--full"
              onClick={beginRoomSession}
            >
              OPEN THE ROOM
            </button>
          </>
        )}
        {(view === "opening" || view === "finding-floor") && (
          <p className="ar-status-line">
            AIM LOW // FIND A CLEAR PATCH OF FLOOR
          </p>
        )}
        {canPlace && (
          <button
            className="mechanical-button mechanical-button--primary mechanical-button--full"
            onClick={placeInRoom}
          >
            STAND HIM THERE
          </button>
        )}
        {view === "fallback" && (
          <>
            <p className="ar-status-line">
              TAP A CLEAR PATCH OF FLOOR
            </p>
            {fallbackReason && (
              <p className="host-copy host-copy--compact">
                The larger arrangement declined. This one still knows where to stand.
              </p>
            )}
          </>
        )}
        {canFire && (
          <button
            className="ar-fire-control"
            onClick={fire}
            aria-label="Fire the pistol"
          >
            FIRE
          </button>
        )}
        {(view === "firing" || view === "hit") && (
          <p className="ar-status-line">CONTACT // HOLD</p>
        )}
        {view === "collapsing" && (
          <p className="ar-status-line">HE IS FINISHED. LET HIM FALL.</p>
        )}
        {view === "complete" && (
          <>
            <p className="host-copy">
              Excellent shot. He stood more patiently for you than for the previous guest.
            </p>
            <button
              className="mechanical-button mechanical-button--primary mechanical-button--full"
              onClick={onExit}
            >
              LEAVE THE ROOM
            </button>
          </>
        )}
        {cameraError && playback === "failed" && fallbackActive && (
          <p className="system-warning">
            CAMERA UNAVAILABLE. THE PLACEMENT FIELD IS STILL ACTIVE.
          </p>
        )}
      </div>
    </section>
  );
}

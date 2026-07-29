"use client";

import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useGameStore } from "../game";
import { getPinById } from "../pins";
import {
  reportOperatorArInitialization,
  reportOperatorContext,
  subscribeToOperatorScareSkip,
} from "../operator/runtime";
import { getImageArScene } from "./config";

const LazyImageARScreen = lazy(() =>
  import("./ImageARScreen").then((module) => ({
    default: module.ImageARScreen,
  }))
);
const LazyRoomARScreen = lazy(() =>
  import("./RoomARScreen").then((module) => ({
    default: module.RoomARScreen,
  }))
);

type ArPinId = 3 | 17 | 18;

export interface ARScreenProps {
  readonly navigate: (path: string) => void;
}

function requestedArPin(): ArPinId | null {
  if (typeof window === "undefined") return null;
  const value = Number(new URLSearchParams(window.location.search).get("pin"));
  return value === 3 || value === 17 || value === 18 ? value : null;
}

function ArLoadingPlate() {
  return (
    <section className="ar-screen ar-screen--loading" role="status">
      <div className="ar-instrument-panel">
        <p className="eyebrow">OPTICAL BENCH</p>
        <h1>PREPARING CONTACT</h1>
        <p className="ar-status-line">LOADING LOCAL INSTRUMENTS</p>
      </div>
    </section>
  );
}

export function ARScreen({ navigate }: ARScreenProps) {
  const pinId = useMemo(requestedArPin, []);
  const previewPin = useGameStore((state) => state.previewPin);
  const resolvePin = useGameStore((state) => state.resolvePin);
  const flushPersistence = useGameStore((state) => state.flushPersistence);
  const resolvedRef = useRef(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [admission] = useState(() =>
    pinId === null ? null : previewPin(pinId, "ar")
  );

  const resolve = useCallback(() => {
    if (resolvedRef.current) return true;
    if (pinId === null) return false;

    const result = resolvePin(pinId, "ar");
    if (!result.ok) {
      setResolutionError(result.hint);
      return false;
    }

    resolvedRef.current = true;
    void flushPersistence();
    return true;
  }, [flushPersistence, pinId, resolvePin]);

  const leave = useCallback(() => navigate("/"), [navigate]);

  useEffect(() => {
    if (pinId === null || admission === null || !admission.ok) {
      reportOperatorArInitialization("error");
      reportOperatorContext(null, null);
      return;
    }

    reportOperatorContext(pinId, getPinById(pinId)?.zone ?? null);
    const unsubscribe = pinId === 18
      ? subscribeToOperatorScareSkip(() => {
          if (resolve()) leave();
        })
      : () => undefined;

    return () => {
      unsubscribe();
      reportOperatorContext(null, null);
    };
  }, [admission, leave, pinId, resolve]);

  if (pinId === null || admission === null) {
    return (
      <section className="ar-screen ar-screen--denied">
        <div className="ar-instrument-panel">
          <p className="eyebrow">NO TARGET CARD</p>
          <h1>NOTHING TO REGISTER.</h1>
          <button className="mechanical-button" onClick={leave}>
            RETURN TO THE HOUSE
          </button>
        </div>
      </section>
    );
  }

  if (!admission.ok) {
    return (
      <section className="ar-screen ar-screen--denied">
        <div className="ar-instrument-panel">
          <p className="eyebrow">CONTACT REFUSED</p>
          <h1>NOT YET.</h1>
          <p className="host-copy">{admission.hint}</p>
          <button className="mechanical-button" onClick={leave}>
            STEP BACK
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      {resolutionError && (
        <p className="ar-resolution-error system-warning" role="alert">
          {resolutionError}
        </p>
      )}
      <Suspense fallback={<ArLoadingPlate />}>
        {pinId === 18 ? (
          <LazyRoomARScreen onResolved={resolve} onExit={leave} />
        ) : (
          <LazyImageARScreen
            scene={getImageArScene(pinId === 3 ? "sheet01" : "sheet02")}
            onResolved={resolve}
            onExit={leave}
          />
        )}
      </Suspense>
    </>
  );
}

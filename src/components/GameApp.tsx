"use client";

import {
  Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { Phase2IntegrationCoordinator, useGameStore } from "@/src/game";
import { resolutionModeForPin } from "@/src/game/engine";
import { TAPE_PLAYBACK_PIN_ID, getPinById } from "@/src/pins";
import { useHaptics, useWakeLock } from "@/src/device";
import { getVHSHealthProfile, useVHS } from "@/src/fx";
import { motion } from "@/src/tokens";
import { useAudio } from "@/src/audio/useAudio";
import { HomeScreen } from "./HomeScreen";
import { MapScreen } from "./MapScreen";
import { InventoryScreen } from "./InventoryScreen";
import { ScanScreen } from "./ScanScreen";
import { ScenePlate } from "./ScenePlate";
import { NotesScreen } from "./NotesScreen";
import { SaveScreen } from "./SaveScreen";
import { TrophyScreen } from "./TrophyScreen";
import { DevScreen } from "./DevScreen";
import { TapePlaybackScreen } from "./TapePlaybackScreen";
import { useOperatorRuntime } from "../operator";

const LazyARScreen = lazy(() => import("../ar/ARScreen").then((module) => ({
  default: module.ARScreen,
})));
const LazyCodesScreen = lazy(() => import("./print/CodesRoute"));
const LazyGlyphsScreen = lazy(() => import("./print/GlyphsRoute"));
const LazySheetsScreen = lazy(() => import("./print/SheetsRoute"));

function PrintRouteLoading() {
  return (
    <main className="restore-screen" role="status">
      <p className="eyebrow">PRINT LEDGER</p>
      <h1>PREPARING THE PAPER.</h1>
    </main>
  );
}

const PLAY_ROUTES = new Set([
  "/",
  "/map",
  "/inventory",
  "/scan",
  "/notes",
  "/save",
  "/trophy",
  "/codes",
  "/glyphs",
  "/dev",
  "/ar",
  "/tape",
  "/sheets",
]);

function currentPath(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

function elapsedTimecode(startedAt: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function useRouteShroud(route: string): { displayedRoute: string; phase: "idle" | "out" | "hold" | "in" } {
  const [displayedRoute, setDisplayedRoute] = useState(route);
  const [phase, setPhase] = useState<"idle" | "out" | "hold" | "in">("idle");

  useEffect(() => {
    if (route === displayedRoute) return;
    setPhase("out");
    const toHold = window.setTimeout(() => {
      setPhase("hold");
      setDisplayedRoute(route);
      const toIn = window.setTimeout(() => {
        setPhase("in");
        const toIdle = window.setTimeout(() => setPhase("idle"), 420);
        return () => window.clearTimeout(toIdle);
      }, 180);
      return () => window.clearTimeout(toIn);
    }, 320);
    return () => window.clearTimeout(toHold);
  }, [route, displayedRoute]);

  return { displayedRoute, phase };
}

function useHouseRouter() {
  const [route, setRoute] = useState("/");

  useEffect(() => {
    const sync = () => setRoute(currentPath());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const navigate = useCallback((path: string) => {
    const next = path.split("?")[0] || "/";
    if (next === "/save") {
      const pin = useGameStore.getState().lastSavePin;
      if (pin !== null) sessionStorage.setItem("bh7-save-ticket", String(pin));
    } else if (window.location.pathname === "/save") {
      sessionStorage.removeItem("bh7-save-ticket");
    }

    if (window.location.pathname !== next) window.history.pushState({}, "", path);
    setRoute(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return {
    route: PLAY_ROUTES.has(route) ? route : "/missing",
    navigate,
  };
}

const NAV_ITEMS = [
  { path: "/map", label: "Map" },
  { path: "/inventory", label: "Items" },
  { path: "/scan", label: "Lens" },
  { path: "/notes", label: "Files" },
] as const;

export function GameApp() {
  const store = useGameStore();
  const { route: targetRoute, navigate } = useHouseRouter();
  const { displayedRoute: route, phase: shroudPhase } = useRouteShroud(targetRoute);
  const [coldOpen, setColdOpen] = useState(true);
  const [seenArrival, setSeenArrival] = useState<unknown>(null);
  const state = useMemo(
    () => ({
      act: store.act,
      health: store.health,
      inventory: store.inventory,
      resolvedPins: store.resolvedPins,
      clearedZones: store.clearedZones,
      lastSavePin: store.lastSavePin,
      startedAt: store.startedAt,
      trophyAt: store.trophyAt,
      finishedAt: store.finishedAt,
      playedVoiceIds: store.playedVoiceIds,
    }),
    [
      store.act,
      store.health,
      store.inventory,
      store.resolvedPins,
      store.clearedZones,
      store.lastSavePin,
      store.startedAt,
      store.trophyAt,
      store.finishedAt,
      store.playedVoiceIds,
    ],
  );
  const vhs = useVHS();
  const audio = useAudio();
  const operatorRuntime = useOperatorRuntime();
  const lastDamageResolution = useRef<unknown>(null);
  const lastAudioResolution = useRef<unknown>(null);
  const haptics = useHaptics();
  const coordinator = useMemo(
    () => new Phase2IntegrationCoordinator({
      audio,
      haptics,
      voices: { claim: store.claimVoice },
    }),
    [audio, haptics, store.claimVoice],
  );

  useWakeLock();
  useEffect(() => {
    const profile = getVHSHealthProfile(store.health);
    vhs.setIntensity(profile.intensity);

    let timecodeTimer: number | null = null;
    let dropTimer: number | null = null;
    if (profile.unstableTimecode) {
      const updateTimecode = () => {
        vhs.setTimecode("REC " + elapsedTimecode(store.startedAt));
      };
      updateTimecode();
      timecodeTimer = window.setInterval(updateTimecode, 1_000);
    } else {
      vhs.setTimecode(null);
    }

    if (profile.periodicDropFrames) {
      dropTimer = window.setInterval(
        () => vhs.dropFrames(motion.eventMs.vhsCriticalDrop),
        motion.eventMs.vhsCriticalInterval,
      );
    }

    return () => {
      if (timecodeTimer !== null) window.clearInterval(timecodeTimer);
      if (dropTimer !== null) window.clearInterval(dropTimer);
      vhs.setTimecode(null);
    };
  }, [store.health, store.startedAt, vhs]);

  useEffect(() => {
    const resolution = store.lastResolution;
    if (resolution === lastDamageResolution.current) return;
    lastDamageResolution.current = resolution;
    if (resolution?.ok && resolution.damage > 0) {
      vhs.glitch(motion.eventMs.vhsDamageSpike);
    }
  }, [store.lastResolution, vhs]);

  useEffect(() => {
    coordinator.syncZoneFromResolvedPins(store.resolvedPins);
  }, [coordinator, store.resolvedPins]);

  useEffect(() => {
    coordinator.syncHealth(store.health);
  }, [coordinator, store.health]);

  useEffect(() => {
    const resolution = store.lastResolution;
    if (resolution === lastAudioResolution.current) return;
    lastAudioResolution.current = resolution;
    if (resolution !== null) coordinator.handleResolution(resolution);
  }, [coordinator, store.lastResolution]);

  useEffect(() => () => coordinator.stopSession(), [coordinator]);

  useEffect(() => {
    void store.hydrate();
  }, [store.hydrate]);

  useEffect(() => {
    const flushPendingState = () => {
      void store.flushPersistence();
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flushPendingState();
    };

    window.addEventListener("pagehide", flushPendingState);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushPendingState);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [store.flushPersistence]);

  const startTapeVoice = useCallback(
    () => coordinator.startVoiceForPin(TAPE_PLAYBACK_PIN_ID),
    [coordinator],
  );

  // AR pins resolve on the /ar route; their payoff text waits on the home screen.
  const pendingArrival =
    store.lastResolution?.ok
    && store.lastResolution !== seenArrival
    && resolutionModeForPin(store.lastResolution.pin) === "ar"
      ? store.lastResolution
      : null;

  const latestResolvedPin = [...store.resolvedPins]
    .reverse()
    .map((pinId) => getPinById(pinId))
    .find((pin) => pin !== undefined);
  const currentZone = latestResolvedPin?.zone ?? "corridor";

  const begin = () => {
    const unlock = audio.master.unlock();
    setColdOpen(false);
    void unlock.catch(() => undefined);
  };

  if (!store.hydrated) {
    return (
      <main className="restore-screen" role="status">
        <p className="eyebrow">CASSETTE MEMORY</p>
        <h1>RESTORING THE HOUSE...</h1>
        <div className="restore-track" aria-hidden="true"><i /></div>
      </main>
    );
  }

  if (route === "/map") return <MapScreen state={state} onClose={() => navigate("/")} />;

  if (route === "/codes") {
    return (
      <Suspense fallback={<PrintRouteLoading />}>
        <LazyCodesScreen />
      </Suspense>
    );
  }
  if (route === "/glyphs") {
    return (
      <Suspense fallback={<PrintRouteLoading />}>
        <LazyGlyphsScreen />
      </Suspense>
    );
  }
  if (route === "/sheets") {
    return (
      <Suspense fallback={<PrintRouteLoading />}>
        <LazySheetsScreen />
      </Suspense>
    );
  }

  if (route === "/save") {
    const ticket = typeof window === "undefined" ? null : Number(sessionStorage.getItem("bh7-save-ticket"));
    const valid = store.lastSavePin !== null
      && getPinById(store.lastSavePin)?.kind === "save"
      && ticket === store.lastSavePin;
    return (
      <SaveScreen
        pinId={store.lastSavePin}
        valid={valid}
        onCommit={store.flushPersistence}
        navigate={navigate}
      />
    );
  }

  if (route === "/trophy") return <TrophyScreen state={state} navigate={navigate} />;

  if (route === "/dev" && !import.meta.env.DEV) {
    return (
      <main className="access-denied">
        <p className="eyebrow">NO LOCAL LEDGER</p>
        <h1>THIS DOOR IS SEALED.</h1>
        <button className="mechanical-button" onClick={() => navigate("/")}>RETURN</button>
      </main>
    );
  }

  const page = (() => {
    switch (route) {
      case "/":
        return (
          <HomeScreen
            state={state}
            coldOpen={coldOpen}
            onBegin={begin}
            resolvePin={store.resolvePin}
            previewPin={store.previewPin}
            sufferSetback={store.sufferSetback}
            flushPersistence={store.flushPersistence}
            pendingArrival={pendingArrival}
            onAcknowledgeArrival={() => setSeenArrival(store.lastResolution)}
            navigate={navigate}
          />
        );
      case "/inventory":
        return <InventoryScreen state={state} onUseFirstAid={() => store.useFirstAid().ok} />;
      case "/scan":
        return (
          <ScanScreen
            resolvePin={store.resolvePin}
            flushPersistence={store.flushPersistence}
            navigate={navigate}
          />
        );
      case "/notes":
        return <NotesScreen state={state} />;
      case "/dev":
        return (
          <DevScreen
            state={state}
            resolvePin={(pinId) => store.resolvePin(pinId, "dev")}
            resetGame={() => {
              store.resetGame();
              sessionStorage.removeItem("bh7-save-ticket");
            }}
            navigate={navigate}
          />
        );
      case "/ar":
        return (
          <Suspense
            fallback={(
              <section className="ar-screen ar-screen--loading" role="status">
                <div className="ar-instrument-panel">
                  <p className="eyebrow">OPTICAL BENCH</p>
                  <h1>PREPARING CONTACT</h1>
                </div>
              </section>
            )}
          >
            <LazyARScreen navigate={navigate} />
          </Suspense>
        );
      case "/tape":
        return (
          <TapePlaybackScreen
            health={store.health}
            operatorSkipToken={operatorRuntime.skipScareRevision}
            startVoice={startTapeVoice}
            onComplete={() => store.resolvePin(TAPE_PLAYBACK_PIN_ID, "action").ok}
            onExit={() => navigate("/map")}
          />
        );
      default:
        return (
          <section className="screen missing-screen">
            <p className="eyebrow">UNMARKED ROOM</p>
            <h1>YOU ARE OFF THE PLAN.</h1>
            <button className="mechanical-button" onClick={() => navigate("/")}>RETURN TO THE HOUSE</button>
          </section>
        );
    }
  })();

  const hideChrome = route === "/ar" || route === "/tape"
    || (route === "/" && coldOpen);

  return (
    <main className="game-shell" data-route={route}>
      <ScenePlate route={route} zone={currentZone} coldOpen={route === "/" && coldOpen} />
      <div className="screen-grain" aria-hidden="true" />
      {shroudPhase !== "idle" && (
        <div className="route-shroud" data-phase={shroudPhase} aria-hidden="true" />
      )}
      {!hideChrome && (
        <header className="app-header">
          <button className="app-header__brand" onClick={() => navigate("/")}>
            <span>CD</span><strong>FILE 33</strong>
          </button>
          <div className="app-header__status"><span>Chapter {store.act}</span><small>Survey open</small></div>
        </header>
      )}
      <div className="screen-slot">{page}</div>
      {!hideChrome && (
        <nav className="bottom-nav" aria-label="House tools">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              data-active={route === item.path}
              onClick={() => navigate(item.path)}
              aria-current={route === item.path ? "page" : undefined}
            >
              <span aria-hidden="true" />{item.label}
            </button>
          ))}
        </nav>
      )}
    </main>
  );
}

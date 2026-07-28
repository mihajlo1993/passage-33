"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useGameStore } from "@/src/game";
import { useHaptics, useWakeLock } from "@/src/device";
import { HomeScreen } from "./HomeScreen";
import { MapScreen } from "./MapScreen";
import { InventoryScreen } from "./InventoryScreen";
import { ScanScreen } from "./ScanScreen";
import { NotesScreen } from "./NotesScreen";
import { SaveScreen } from "./SaveScreen";
import { TrophyScreen } from "./TrophyScreen";
import { DevScreen } from "./DevScreen";
import { CodesScreen } from "./CodesScreen";
import { GlyphsScreen } from "./GlyphsScreen";

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
]);

function currentPath(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname;
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
  { path: "/map", label: "MAP" },
  { path: "/inventory", label: "CASE" },
  { path: "/scan", label: "SCAN" },
  { path: "/notes", label: "NOTES" },
] as const;

export function GameApp() {
  const store = useGameStore();
  const { route, navigate } = useHouseRouter();
  const [coldOpen, setColdOpen] = useState(true);
  const state = useMemo(
    () => ({
      act: store.act,
      health: store.health,
      inventory: store.inventory,
      resolvedPins: store.resolvedPins,
      clearedZones: store.clearedZones,
      lastSavePin: store.lastSavePin,
      startedAt: store.startedAt,
      finishedAt: store.finishedAt,
    }),
    [
      store.act,
      store.health,
      store.inventory,
      store.resolvedPins,
      store.clearedZones,
      store.lastSavePin,
      store.startedAt,
      store.finishedAt,
    ],
  );

  useWakeLock();
  useHaptics(store.critical);

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

  useEffect(() => {
    setColdOpen(sessionStorage.getItem("bh7-intro-seen") !== "1");
  }, []);

  const begin = () => {
    sessionStorage.setItem("bh7-intro-seen", "1");
    setColdOpen(false);
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

  if (route === "/codes") return <CodesScreen />;
  if (route === "/glyphs") return <GlyphsScreen />;

  if (route === "/save") {
    const ticket = typeof window === "undefined" ? null : Number(sessionStorage.getItem("bh7-save-ticket"));
    const valid = (store.lastSavePin === 2 || store.lastSavePin === 8) && ticket === store.lastSavePin;
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
            onRelight={() => {
              const result = store.resolvePin(24, "action");
              if (!result.ok) throw new Error(result.reason);
            }}
            navigate={navigate}
          />
        );
      case "/map":
        return <MapScreen state={state} />;
      case "/inventory":
        return <InventoryScreen state={state} onUseFirstAid={() => store.useFirstAid().ok} />;
      case "/scan":
        return (
          <ScanScreen
            resolvePin={store.resolvePin}
            previewPin={store.previewPin}
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

  const hideChrome = route === "/" && coldOpen;

  return (
    <main className="game-shell" data-route={route}>
      {!hideChrome && (
        <header className="app-header">
          <button className="app-header__brand" onClick={() => navigate("/")}>
            <span>BH</span><strong>SEVEN</strong>
          </button>
          <div className="app-header__status"><span>ACT {store.act}</span><small>MEMORY HELD</small></div>
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

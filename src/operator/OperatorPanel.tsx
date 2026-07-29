"use client";

import {
  useEffect,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";

import { useAudio } from "../audio/useAudio";
import { useCamera, useTorch } from "../device";
import { getVHSHealthProfile, useVHS } from "../fx";
import { selectGameState, useGameStore } from "../game";
import { items } from "../items";
import { pins } from "../pins";
import type { Act, GameState, ZoneId } from "../types";
import {
  currentPinForOperator,
  currentZoneForOperator,
  resetGameForOperator,
  resolvePinForOperator,
  setActForOperator,
  setHealthForOperator,
  setItemForOperator,
  unresolvePinForOperator,
} from "./game";
import {
  forceOperatorTorch,
  reportOperatorArInitialization,
  reportOperatorAudioInitialization,
  reportOperatorContext,
  requestOperatorReset,
  requestOperatorScareSkip,
  resetOperatorOverrides,
  setOperatorAudioMuted,
  setOperatorVhsIntensity,
  useOperatorRuntime,
  type OperatorInitializationState,
} from "./runtime";
import { useOperatorAccess } from "./useOperatorAccess";

const ACTS: readonly Act[] = [1, 2, 3, 4, 5];
const VHS_PRESETS = [0, 0.15, 0.35, 0.6, 0.85, 0.9] as const;

export interface OperatorPanelProps {
  /** Optional route-level truth when a mechanism owns a pin. */
  readonly activePin?: number | null;
  /** Optional runtime zone truth; otherwise the latest resolved-pin zone wins. */
  readonly activeZone?: ZoneId | null;
  /** AR screens report ready/error through this prop or the exported runtime API. */
  readonly arInitialization?: OperatorInitializationState;
  readonly onSkipScare?: () => void;
  readonly onReset?: () => void;
}

function commitGameState(transform: (state: GameState) => GameState): void {
  const store = useGameStore.getState();
  const next = transform(selectGameState(store));
  if (next === store) return;

  store.replaceStateFromOperator(next);
}

function audioInitializationState(
  state: ReturnType<typeof useAudio>["master"]["state"],
): OperatorInitializationState {
  if (state === "ready" || state === "suspended") return "ready";
  return state === "error" ? "error" : "not-started";
}

function statusWord(state: OperatorInitializationState): string {
  if (state === "ready") return "READY";
  if (state === "error") return "FAILED";
  return "NOT STARTED";
}

export function OperatorPanel({
  activePin,
  activeZone,
  arInitialization,
  onSkipScare,
  onReset,
}: OperatorPanelProps) {
  const access = useOperatorAccess();
  const runtime = useOperatorRuntime();
  const game = useGameStore();
  const audio = useAudio();
  const vhs = useVHS();
  const camera = useCamera();
  const torch = useTorch(camera.stream);

  const derivedPin = useMemo(
    () => currentPinForOperator(selectGameState(game)),
    [game],
  );
  const derivedZone = useMemo(
    () => currentZoneForOperator(selectGameState(game)),
    [game],
  );
  const displayedPin = activePin ?? runtime.activePin ?? derivedPin;
  const displayedZone = activeZone ?? runtime.activeZone ?? derivedZone;
  const [selectedPin, setSelectedPin] = useState(displayedPin ?? 1);
  const [selectedItem, setSelectedItem] = useState(items[0]?.id ?? "");

  useEffect(() => {
    if (activePin !== undefined || activeZone !== undefined) {
      reportOperatorContext(activePin ?? null, activeZone ?? null);
    }
  }, [activePin, activeZone]);

  useEffect(() => {
    if (arInitialization !== undefined) {
      reportOperatorArInitialization(arInitialization);
    }
  }, [arInitialization]);

  const observedAudioInitialization = audioInitializationState(audio.master.state);
  useEffect(() => {
    reportOperatorAudioInitialization(observedAudioInitialization);
  }, [observedAudioInitialization]);

  useEffect(() => {
    audio.master.mute(runtime.audioMuted);
  }, [audio, runtime.audioMuted]);

  // Subscribe to health so a manual value is reasserted after the normal
  // health-driven parent effect runs.
  useEffect(() => {
    if (runtime.vhsIntensityOverride !== null) {
      vhs.setIntensity(runtime.vhsIntensityOverride);
    }
  }, [game.health, runtime.vhsIntensityOverride, vhs]);

  useEffect(() => {
    if (runtime.forcedTorch === null) return;
    if (!runtime.forcedTorch) {
      void torch.off().finally(camera.stop);
      return;
    }
    if (camera.stream) {
      void torch.on();
    } else {
      void camera.start();
    }
  }, [camera.start, camera.stop, camera.stream, runtime.forcedTorch, torch.off, torch.on]);


  const close = () => access.close();

  const resolveSelectedPin = () => {
    commitGameState((state) => resolvePinForOperator(state, selectedPin));
  };
  const unresolveSelectedPin = () => {
    commitGameState((state) => unresolvePinForOperator(state, selectedPin));
  };
  const setItem = (held: boolean) => {
    commitGameState((state) => setItemForOperator(state, selectedItem, held));
  };
  const setHealth = (health: number) => {
    commitGameState((state) => setHealthForOperator(state, health));
  };
  const setAct = (act: Act) => {
    commitGameState((state) => setActForOperator(state, act));
  };
  const setMuted = (muted: boolean) => {
    setOperatorAudioMuted(muted);
    audio.master.mute(muted);
  };
  const setVhs = (intensity: number | null) => {
    setOperatorVhsIntensity(intensity);
    vhs.setIntensity(
      intensity ?? getVHSHealthProfile(useGameStore.getState().health).intensity,
    );
  };
  const setTorch = (enabled: boolean) => {
    forceOperatorTorch(enabled);
  };
  const skipScare = () => {
    requestOperatorScareSkip();
    onSkipScare?.();
  };
  const reset = () => {
    commitGameState(() => resetGameForOperator());
    resetOperatorOverrides();
    requestOperatorReset();
    audio.master.mute(false);
    vhs.setIntensity(getVHSHealthProfile(100).intensity);
    onReset?.();

    if (typeof window !== "undefined") {
      sessionStorage.removeItem("bh7-save-ticket");
      sessionStorage.removeItem("bh7-intro-seen");
      if (!onReset) {
        window.history.replaceState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }
    close();
  };

  const stopPanelPointer = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  // This null return is the complete pre-activation DOM contract.
  if (!access.open) return null;

  return createPortal(
    <div
      className="operator-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="operator-panel"
        aria-label="Production recovery controls"
        onPointerDown={stopPanelPointer}
      >
        <header className="operator-panel__header">
          <div>
            <p className="eyebrow">HOUSE SERVICE LEDGER</p>
            <h1>OPERATOR OVERRIDE</h1>
          </div>
          <button type="button" className="operator-panel__close" onClick={close}>
            CLOSE
          </button>
        </header>

        <dl className="operator-status">
          <div><dt>PIN</dt><dd>{displayedPin ?? "—"}</dd></div>
          <div><dt>ACT</dt><dd>{game.act}</dd></div>
          <div><dt>HEALTH</dt><dd>{game.health}</dd></div>
          <div className="operator-status__wide">
            <dt>INVENTORY</dt>
            <dd>{game.inventory.length > 0 ? game.inventory.join(" / ") : "EMPTY"}</dd>
          </div>
          <div><dt>ZONE</dt><dd>{displayedZone.toUpperCase()}</dd></div>
          <div><dt>AUDIO</dt><dd>{statusWord(runtime.audioInitialization)}</dd></div>
          <div><dt>AR</dt><dd>{statusWord(runtime.arInitialization)}</dd></div>
        </dl>

        <div className="operator-panel__body">
          <fieldset className="operator-block">
            <legend>PIN CONTROL</legend>
            <label className="operator-field">
              <span>PIN NUMBER</span>
              <input
                type="number"
                min={pins[0]?.id ?? 1}
                max={pins.at(-1)?.id ?? 27}
                value={selectedPin}
                onChange={(event) => setSelectedPin(Number(event.currentTarget.value))}
              />
            </label>
            <div className="operator-actions">
              <button type="button" onClick={resolveSelectedPin}>RESOLVE</button>
              <button type="button" onClick={unresolveSelectedPin}>UN-RESOLVE</button>
            </div>
          </fieldset>

          <fieldset className="operator-block">
            <legend>INVENTORY</legend>
            <label className="operator-field">
              <span>ITEM</span>
              <select
                value={selectedItem}
                onChange={(event) => setSelectedItem(event.currentTarget.value)}
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <div className="operator-actions">
              <button type="button" onClick={() => setItem(true)}>GRANT</button>
              <button type="button" onClick={() => setItem(false)}>REVOKE</button>
            </div>
          </fieldset>

          <fieldset className="operator-block">
            <legend>HEALTH</legend>
            <label className="operator-field operator-field--range">
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={game.health}
                onChange={(event) => setHealth(Number(event.currentTarget.value))}
              />
              <input
                type="number"
                min="0"
                max="100"
                value={game.health}
                onChange={(event) => setHealth(Number(event.currentTarget.value))}
              />
            </label>
          </fieldset>

          <fieldset className="operator-block">
            <legend>ACT</legend>
            <div className="operator-actions operator-actions--five">
              {ACTS.map((act) => (
                <button
                  key={act}
                  type="button"
                  data-active={game.act === act}
                  onClick={() => setAct(act)}
                >
                  {act}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="operator-block">
            <legend>TORCH</legend>
            <div className="operator-actions">
              <button
                type="button"
                data-active={runtime.forcedTorch === true}
                onClick={() => setTorch(true)}
              >
                FORCE ON
              </button>
              <button
                type="button"
                data-active={runtime.forcedTorch === false}
                onClick={() => setTorch(false)}
              >
                FORCE OFF
              </button>
            </div>
          </fieldset>

          <fieldset className="operator-block">
            <legend>AUDIO</legend>
            <div className="operator-actions">
              <button
                type="button"
                data-active={!runtime.audioMuted}
                onClick={() => setMuted(false)}
              >
                UNMUTE
              </button>
              <button
                type="button"
                data-active={runtime.audioMuted}
                onClick={() => setMuted(true)}
              >
                MUTE ALL
              </button>
            </div>
          </fieldset>

          <fieldset className="operator-block operator-block--wide">
            <legend>VHS INTENSITY</legend>
            <label className="operator-field operator-field--range">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={runtime.vhsIntensityOverride ?? getVHSHealthProfile(game.health).intensity}
                onChange={(event) => setVhs(Number(event.currentTarget.value))}
              />
              <output>
                {runtime.vhsIntensityOverride === null
                  ? "AUTO"
                  : runtime.vhsIntensityOverride.toFixed(2)}
              </output>
            </label>
            <div className="operator-actions operator-actions--vhs">
              <button type="button" onClick={() => setVhs(null)}>AUTO</button>
              {VHS_PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  data-active={runtime.vhsIntensityOverride === value}
                  onClick={() => setVhs(value)}
                >
                  {value === 0 ? "OFF" : value.toFixed(2)}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="operator-terminal-actions operator-block--wide">
            <button type="button" onClick={skipScare}>SKIP CURRENT SCARE</button>
            <button type="button" data-danger="true" onClick={reset}>FULL RESET TO PIN 1</button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

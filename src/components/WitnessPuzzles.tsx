"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { REFUSAL_LINES, numberLockAnswer, type RiddleConfig } from "@/src/pins";
import { motion } from "@/src/tokens";
import type { Pin } from "@/src/types";
import type { ModelViewerElement } from "@/src/model-viewer";
import { playKeeper } from "@/src/audio/keeper";
import { useAudio } from "@/src/audio/useAudio";
import { useHaptics } from "@/src/device";

/*
 * The three witness puzzles: locks played ON the 3D artifact itself.
 * Every interaction is an explicit deterministic tap the app tracks
 * (hotspots anchored to model coordinates, a spin control, dial wheels).
 * The bench NEVER reads camera angles and nothing here can hard-stall:
 * hints are free, the third hint makes the next correct touch glow, and
 * a witness that fails to load degrades to plain buttons.
 */

export interface WitnessPuzzleProps {
  pin: Pin;
  config: RiddleConfig;
  onSolved: () => void;
  onCancel: () => void;
  onWrongAttempt: () => void;
}

/* Hotspot anchors in model space (metres). The shoulders mirror the
 * deterministic geometry in scripts/build-witnesses.mjs; rebuild both
 * together. The WHEEL is the discovery: its control hides on the
 * UNDERSIDE of the base (downward normal), so model-viewer only shows
 * it while she has genuinely rolled the runner over to look beneath. */
const RUNNER_SPOTS = {
  L: { position: "-0.013 0.056 0.013", normal: "-0.35 0.85 0.4", label: "L" },
  R: { position: "0.013 0.056 0.013", normal: "0.35 0.85 0.4", label: "R" },
  W: { position: "0 -0.002 0", normal: "0 -1 0", label: "W" },
} as const;

/**
 * THE THREE VERBS, played on hold-stations floating AROUND the witness
 * (the centerpiece itself stays clean; nothing hides on the model). All
 * three are held for a few seconds, gauges filling; the last one sets
 * thirty-three stars out of the mouth. Only when all three are done does
 * the typed name appear, on lock I's contract.
 */
export const SPARKLE_VERBS = [
  {
    id: "pour",
    verb: "POUR",
    kind: "hold",
    holdMs: 2_000,
    tag: "IN",
    lead: "I TAKE",
    reveals: "STILL WATER",
    instruction: "Hold until the vessel fills",
  },
  {
    id: "charge",
    verb: "CHARGE",
    kind: "hold",
    holdMs: 2_500,
    tag: "GAS",
    lead: "I BREATHE",
    reveals: "SILVER BREATH",
    instruction: "Hold until the hiss peaks",
  },
  {
    id: "release",
    verb: "RELEASE",
    kind: "hold",
    holdMs: 2_000,
    tag: "OUT",
    lead: "I RETURN",
    reveals: "STARS",
    instruction: "Hold, and let it speak",
  },
] as const;

export type SparkleVerb = typeof SPARKLE_VERBS[number];

/** Thirty-three, of course. */
export const SPARKLE_STAR_COUNT = 33;
export const SPARKLE_STARS_MS = 3_000;

export function sparkleStatementComplete(doneVerbs: number): boolean {
  return doneVerbs >= SPARKLE_VERBS.length;
}

/** Camera azimuths that square each obelisk face to the viewer. */
const WAGER_FACE_THETA = [0, -120, -240] as const;
const WAGER_OPERANDS = ["1993", "2", "IIII"] as const;

/** Shared refusal/feedback state for a lock: rotate lines, shake, damage. */
export function useLockFeedback(
  onWrongAttempt: () => void,
  lines: readonly string[] = REFUSAL_LINES,
) {
  const [feedback, setFeedback] = useState("");
  const [shaking, setShaking] = useState(false);
  const wrongRef = useRef(0);
  const audio = useAudio();
  const haptics = useHaptics();

  const wrong = (chargeEvery = 1) => {
    wrongRef.current += 1;
    setFeedback(lines[(wrongRef.current - 1) % lines.length]);
    setShaking(true);
    window.setTimeout(() => setShaking(false), 340);
    void audio.play("refused");
    haptics.stutter();
    if (wrongRef.current === 3) playKeeper("refuse");
    if (wrongRef.current % chargeEvery === 0) onWrongAttempt();
  };

  const step = () => {
    setFeedback("");
    haptics.contact();
  };

  const solved = (onSolved: () => void) => {
    void audio.play("released");
    haptics.found();
    onSolved();
  };

  return { feedback, shaking, wrong, step, solved };
}

interface BenchProps {
  config: RiddleConfig;
  lost: boolean;
  onLost: () => void;
  cameraOrbit: string;
  cameraTarget?: string;
  /** A slow idle turn for benches that are pure centerpiece. */
  autoRotate?: boolean;
  viewerRef?: React.Ref<ModelViewerElement>;
  children?: React.ReactNode;
}

function assignViewerRef(
  ref: React.Ref<ModelViewerElement> | undefined,
  value: ModelViewerElement | null,
): void {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
}

/** The lit bench with the witness and its tappable hotspots. */
export function WitnessBench({
  config, lost, onLost, cameraOrbit, cameraTarget, autoRotate, viewerRef, children,
}: BenchProps) {
  const onLostRef = useRef(onLost);
  const attachedViewerRef = useRef<ModelViewerElement | null>(null);
  onLostRef.current = onLost;

  const handleModelError = useCallback(() => {
    onLostRef.current();
  }, []);
  const attachViewer = useCallback((viewer: ModelViewerElement | null) => {
    attachedViewerRef.current?.removeEventListener("error", handleModelError);
    attachedViewerRef.current = viewer;
    assignViewerRef(viewerRef, viewer);
    viewer?.addEventListener("error", handleModelError);
  }, [handleModelError, viewerRef]);

  return (
    <div className="riddle-bench riddle-bench--puzzle">
      {!lost && (
        <model-viewer
          ref={attachViewer}
          className="riddle-bench__viewer"
          src={config.model}
          alt="The Keeper's witness for this lock"
          camera-controls
          disable-pan
          disable-tap
          touch-action="pan-y"
          interaction-prompt="none"
          exposure="1.0"
          shadow-intensity="0.9"
          tone-mapping="aces"
          camera-orbit={cameraOrbit}
          camera-target={cameraTarget}
          min-camera-orbit="-Infinity 0deg auto"
          max-camera-orbit="Infinity 180deg auto"
          auto-rotate={autoRotate ? "" : undefined}
          auto-rotate-delay={autoRotate ? "2500" : undefined}
          rotation-per-second={autoRotate ? "12deg" : undefined}
          onError={onLost}
        >
          {children}
        </model-viewer>
      )}
      {lost && (
        <p className="riddle-bench__lost">
          The witness refuses the light. The lock accepts a plainer touch below.
        </p>
      )}
      <p className="riddle-bench__note">{config.benchNote}</p>
    </div>
  );
}

export function LockHeading({ pin }: { pin: Pin }) {
  return (
    <header className="lock-screen__heading">
      <p className="eyebrow">{pin.name}</p>
      <h1 id="witness-title">{pin.zone === "bathroom" ? "The last of four" : "One of four"}</h1>
    </header>
  );
}

interface HintRowProps {
  hints: readonly [string, string, string];
  hintCount: number;
  onHint: () => void;
}

export function HintRow({ hints, hintCount, onHint }: HintRowProps) {
  return (
    <>
      {hintCount > 0 && <p className="riddle-box__hint">{hints[hintCount - 1]}</p>}
      <div className="riddle-box__hintrow">
        <button className="text-control" onClick={onHint} disabled={hintCount >= hints.length}>
          {hintCount === 0
            ? "Ask the Keeper for help"
            : hintCount < hints.length
              ? "Ask again"
              : "The Keeper has said all he will"}
        </button>
      </div>
    </>
  );
}

/** Toggle that trades the Keeper's words for a bigger witness. */
export function WordsToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button className="text-control panel-toggle" onClick={onToggle}>
      {shown ? "Give the witness room" : "Show the words"}
    </button>
  );
}

/* ================= LOCK II: speak click back to the runner ================= */

export function RunnerClicks({ pin, config, onSolved, onCancel, onWrongAttempt }: WitnessPuzzleProps) {
  const pattern = config.puzzle?.kind === "clicks" ? config.puzzle.pattern : [];
  const [progress, setProgress] = useState(0);
  const [hitSpot, setHitSpot] = useState<"L" | "W" | "R" | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [lost, setLost] = useState(false);
  const [wordsShown, setWordsShown] = useState(true);
  const feedback = useLockFeedback(onWrongAttempt, config.refusals);
  const hitTimerRef = useRef<number | null>(null);
  const glowing = hintCount >= 3;

  useEffect(() => () => {
    if (hitTimerRef.current !== null) window.clearTimeout(hitTimerRef.current);
  }, []);

  const tap = (id: "L" | "W" | "R") => {
    if (progress >= pattern.length) return;
    if (id === pattern[progress]) {
      feedback.step();
      // A soft flash where the correct click landed.
      setHitSpot(id);
      if (hitTimerRef.current !== null) window.clearTimeout(hitTimerRef.current);
      hitTimerRef.current = window.setTimeout(() => setHitSpot(null), 280);
      const next = progress + 1;
      setProgress(next);
      if (next === pattern.length) feedback.solved(onSolved);
      return;
    }
    setProgress(0);
    feedback.wrong(2);
  };

  const spot = (id: keyof typeof RUNNER_SPOTS) => (
    <button
      key={id}
      slot={`hotspot-${id.toLowerCase()}`}
      data-position={RUNNER_SPOTS[id].position}
      data-normal={RUNNER_SPOTS[id].normal}
      // model-viewer stamps data-visible while the anchor faces the camera;
      // the underside wheel is styled invisible and untappable without it.
      data-visibility-attribute={id === "W" ? "visible" : undefined}
      className={
        "witness-hotspot"
        + (id === "W" ? " witness-hotspot--under" : "")
        + (glowing && pattern[progress] === id ? " is-next" : "")
        + (hitSpot === id ? " is-hit" : "")
      }
      aria-label={id === "L" ? "Left shoulder" : id === "R" ? "Right shoulder" : "The wheel, hidden beneath"}
      onClick={() => tap(id)}
    >
      {RUNNER_SPOTS[id].label}
    </button>
  );

  return (
    <section className="riddle-lock" aria-labelledby="witness-title">
      <LockHeading pin={pin} />
      <WitnessBench
        config={config}
        lost={lost}
        onLost={() => setLost(true)}
        cameraOrbit="0deg 62deg 100%"
      >
        {spot("L")}
        {spot("W")}
        {spot("R")}
      </WitnessBench>

      <div className={"riddle-box re-frame" + (feedback.shaking ? " riddle-box--shake" : "")}>
        <WordsToggle shown={wordsShown} onToggle={() => setWordsShown(!wordsShown)} />
        {wordsShown && <p className="riddle-box__riddle">{config.riddle}</p>}
        <div className="puzzle-pattern" aria-label="The clicks so far">
          {pattern.map((stepId, index) => (
            <span
              key={index}
              className={
                "puzzle-chip"
                + (index < progress ? " is-lit" : "")
                + (glowing && index === progress ? " is-next" : "")
              }
            >
              {stepId}
            </span>
          ))}
        </div>
        {lost && (
          <div className="puzzle-fallback">
            <button className="mechanical-button" onClick={() => tap("L")}>LEFT</button>
            <button className="mechanical-button" onClick={() => tap("W")}>WHEEL</button>
            <button className="mechanical-button" onClick={() => tap("R")}>RIGHT</button>
          </div>
        )}
        <p className="riddle-box__feedback" aria-live="polite">{feedback.feedback}</p>
        {wordsShown && (
          <HintRow hints={config.hints} hintCount={hintCount} onHint={() => setHintCount(hintCount + 1)} />
        )}
      </div>

      <button className="text-control" onClick={onCancel}>Step away</button>
    </section>
  );
}

/* ============ LOCK III: collect the numbers, dial their sum ============ */

export function WagerSum({ pin, config, onSolved, onCancel, onWrongAttempt }: WitnessPuzzleProps) {
  const viewerRef = useRef<ModelViewerElement | null>(null);
  const [face, setFace] = useState(0);
  const [seenCount, setSeenCount] = useState(1);
  const [dials, setDials] = useState<[number, number, number, number]>([0, 0, 0, 0]);
  const [hintCount, setHintCount] = useState(0);
  const [lost, setLost] = useState(false);
  const [wordsShown, setWordsShown] = useState(true);
  const feedback = useLockFeedback(onWrongAttempt, config.refusals);
  const haptics = useHaptics();
  const audio = useAudio();
  const tweenFrameRef = useRef<number | null>(null);
  const thetaRef = useRef(0);
  const repeatTimerRef = useRef<number | null>(null);
  const repeatIntervalRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (tweenFrameRef.current !== null) cancelAnimationFrame(tweenFrameRef.current);
    if (repeatTimerRef.current !== null) window.clearTimeout(repeatTimerRef.current);
    if (repeatIntervalRef.current !== null) window.clearInterval(repeatIntervalRef.current);
  }, []);

  const allSeen = lost || seenCount >= WAGER_FACE_THETA.length;

  /** An eased camera tween face to face; never a hard cut. */
  const tweenCameraTo = (targetTheta: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (tweenFrameRef.current !== null) cancelAnimationFrame(tweenFrameRef.current);
    const startTheta = thetaRef.current;
    const startedAt = performance.now();
    const durationMs = motion.durationMs.slow + motion.durationMs.base;
    const tick = () => {
      const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
      // The heavy house curve, approximated: ease-out cubic.
      const eased = 1 - Math.pow(1 - progress, 3);
      const theta = startTheta + (targetTheta - startTheta) * eased;
      thetaRef.current = theta;
      viewer.cameraOrbit = `${theta}deg 75deg 105%`;
      if (progress < 1) {
        tweenFrameRef.current = requestAnimationFrame(tick);
      } else {
        tweenFrameRef.current = null;
      }
    };
    tweenFrameRef.current = requestAnimationFrame(tick);
  };

  const turnWitness = () => {
    const next = (face + 1) % WAGER_FACE_THETA.length;
    setFace(next);
    haptics.contact();
    // Always turn a full step onward, past 360, so the spin never rewinds.
    const currentTheta = thetaRef.current;
    const step = 360 / WAGER_FACE_THETA.length;
    tweenCameraTo(currentTheta - step);
    if (next + 1 > seenCount) {
      // A number nobody has read for thirty-three years: stamp it.
      setSeenCount(next + 1);
      haptics.found();
      void audio.play("dial-tick");
    }
  };

  const spin = (wheel: number, delta: number) => {
    haptics.contact();
    void audio.play("dial-tick");
    setDials((current) => {
      const next = [...current] as typeof dials;
      next[wheel] = (next[wheel] + delta + 10) % 10;
      return next;
    });
  };

  /** Long-press auto-repeat: the wheel keeps turning under a held thumb. */
  const beginSpinRepeat = (wheel: number, delta: number) => {
    spin(wheel, delta);
    repeatTimerRef.current = window.setTimeout(() => {
      repeatIntervalRef.current = window.setInterval(() => spin(wheel, delta), 110);
    }, 380);
  };

  const endSpinRepeat = () => {
    if (repeatTimerRef.current !== null) {
      window.clearTimeout(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
    if (repeatIntervalRef.current !== null) {
      window.clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  };

  const submit = () => {
    const value = dials[0] * 1000 + dials[1] * 100 + dials[2] * 10 + dials[3];
    if (value === numberLockAnswer()) {
      feedback.solved(onSolved);
      return;
    }
    feedback.wrong(1);
  };

  return (
    <section className="riddle-lock" aria-labelledby="witness-title">
      <LockHeading pin={pin} />
      <WitnessBench
        config={config}
        lost={lost}
        onLost={() => setLost(true)}
        cameraOrbit="0deg 75deg 105%"
        viewerRef={viewerRef}
      />

      <div className={"riddle-box re-frame" + (feedback.shaking ? " riddle-box--shake" : "")}>
        <WordsToggle shown={wordsShown} onToggle={() => setWordsShown(!wordsShown)} />
        {wordsShown && <p className="riddle-box__riddle">{config.riddle}</p>}

        {!lost && (
          <button className="mechanical-button mechanical-button--full" onClick={turnWitness}>
            Turn the witness
          </button>
        )}
        <div className="puzzle-pattern" aria-label="The numbers found so far">
          {WAGER_OPERANDS.map((operand, index) => (
            <span
              key={operand}
              className={"puzzle-chip puzzle-chip--wide" + (lost || index < seenCount ? " is-lit" : "")}
            >
              {lost || index < seenCount ? operand : "?"}
            </span>
          ))}
        </div>
        {allSeen && (
          <p className="puzzle-sum" aria-live="polite">1993 + 2 + IIII. The wheels take the sum.</p>
        )}

        <div className="dial-row" aria-label="Four brass wheels">
          {dials.map((digit, index) => (
            <div className="dial-wheel" key={index}>
              <button
                className="text-control"
                aria-label={`Wheel ${index + 1} up`}
                onPointerDown={() => beginSpinRepeat(index, 1)}
                onPointerUp={endSpinRepeat}
                onPointerLeave={endSpinRepeat}
                onPointerCancel={endSpinRepeat}
                onContextMenu={(event) => event.preventDefault()}
              >
                +
              </button>
              <span className="dial-wheel__digit" key={`digit-${index}-${digit}`}>{digit}</span>
              <button
                className="text-control"
                aria-label={`Wheel ${index + 1} down`}
                onPointerDown={() => beginSpinRepeat(index, -1)}
                onPointerUp={endSpinRepeat}
                onPointerLeave={endSpinRepeat}
                onPointerCancel={endSpinRepeat}
                onContextMenu={(event) => event.preventDefault()}
              >
                &minus;
              </button>
            </div>
          ))}
        </div>
        <button className="mechanical-button mechanical-button--primary mechanical-button--full" onClick={submit}>
          Turn the lock
        </button>

        <p className="riddle-box__feedback" aria-live="polite">{feedback.feedback}</p>
        {wordsShown && (
          <HintRow hints={config.hints} hintCount={hintCount} onHint={() => setHintCount(hintCount + 1)} />
        )}
      </div>

      <button className="text-control" onClick={onCancel}>Step away</button>
    </section>
  );
}


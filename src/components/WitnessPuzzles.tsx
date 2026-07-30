"use client";

import { useRef, useState } from "react";
import { REFUSAL_LINES, numberLockAnswer, type RiddleConfig } from "@/src/pins";
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

/* Hotspot anchors in model space (metres). These mirror the deterministic
 * geometry in scripts/build-witnesses.mjs; rebuild both together. */
const RUNNER_SPOTS = {
  L: { position: "-0.013 0.056 0.013", normal: "-0.35 0.85 0.4", label: "L" },
  R: { position: "0.013 0.056 0.013", normal: "0.35 0.85 0.4", label: "R" },
  W: { position: "0 0.0635 0.0195", normal: "0 1 0.25", label: "W" },
} as const;

export function starAnchor(index: number): { x: number; y: number; z: number } {
  return {
    x: 0.012 * Math.sin(index * 2.1),
    y: 0.028 + 0.084 + (index / 6) * 0.09,
    z: 0.012 * Math.cos(index * 1.7),
  };
}

/** Camera azimuths that square each obelisk face to the viewer. */
const WAGER_FACE_THETA = [0, -120, -240] as const;
const WAGER_OPERANDS = ["1993", "31", "IIII"] as const;

/** Shared refusal/feedback state for a lock: rotate lines, shake, damage. */
function useLockFeedback(onWrongAttempt: () => void) {
  const [feedback, setFeedback] = useState("");
  const [shaking, setShaking] = useState(false);
  const wrongRef = useRef(0);
  const audio = useAudio();
  const haptics = useHaptics();

  const wrong = (chargeEvery = 1) => {
    wrongRef.current += 1;
    setFeedback(REFUSAL_LINES[(wrongRef.current - 1) % REFUSAL_LINES.length]);
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
  viewerRef?: React.Ref<ModelViewerElement>;
  children?: React.ReactNode;
}

/** The lit bench with the witness and its tappable hotspots. */
function WitnessBench({ config, lost, onLost, cameraOrbit, cameraTarget, viewerRef, children }: BenchProps) {
  return (
    <div className="riddle-bench riddle-bench--puzzle">
      {!lost && (
        <model-viewer
          ref={viewerRef}
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

function LockHeading({ pin }: { pin: Pin }) {
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

function HintRow({ hints, hintCount, onHint }: HintRowProps) {
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
function WordsToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
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
  const [hintCount, setHintCount] = useState(0);
  const [lost, setLost] = useState(false);
  const [wordsShown, setWordsShown] = useState(true);
  const feedback = useLockFeedback(onWrongAttempt);
  const glowing = hintCount >= 3;

  const tap = (id: "L" | "W" | "R") => {
    if (progress >= pattern.length) return;
    if (id === pattern[progress]) {
      feedback.step();
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
      className={
        "witness-hotspot"
        + (glowing && pattern[progress] === id ? " is-next" : "")
      }
      aria-label={id === "L" ? "Left shoulder" : id === "R" ? "Right shoulder" : "The wheel"}
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
  const feedback = useLockFeedback(onWrongAttempt);
  const haptics = useHaptics();

  const allSeen = lost || seenCount >= WAGER_FACE_THETA.length;

  const turnWitness = () => {
    const next = (face + 1) % WAGER_FACE_THETA.length;
    setFace(next);
    setSeenCount(Math.max(seenCount, next + 1));
    haptics.contact();
    const viewer = viewerRef.current;
    if (viewer) viewer.cameraOrbit = `${WAGER_FACE_THETA[next]}deg 75deg 105%`;
  };

  const spin = (wheel: number, delta: number) => {
    haptics.contact();
    setDials((current) => {
      const next = [...current] as typeof dials;
      next[wheel] = (next[wheel] + delta + 10) % 10;
      return next;
    });
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
          <p className="puzzle-sum" aria-live="polite">1993 + 31 + IIII. The wheels take the sum.</p>
        )}

        <div className="dial-row" aria-label="Four brass wheels">
          {dials.map((digit, index) => (
            <div className="dial-wheel" key={index}>
              <button
                className="text-control"
                aria-label={`Wheel ${index + 1} up`}
                onClick={() => spin(index, 1)}
              >
                +
              </button>
              <span className="dial-wheel__digit">{digit}</span>
              <button
                className="text-control"
                aria-label={`Wheel ${index + 1} down`}
                onClick={() => spin(index, -1)}
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

/* ============= LOCK IV: touch the stars in the order they rose ============= */

export function StarLadder({ pin, config, onSolved, onCancel, onWrongAttempt }: WitnessPuzzleProps) {
  const count = config.puzzle?.kind === "stars" ? config.puzzle.count : 7;
  const [progress, setProgress] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const [lost, setLost] = useState(false);
  const [wordsShown, setWordsShown] = useState(true);
  const feedback = useLockFeedback(onWrongAttempt);
  const glowing = hintCount >= 3;

  const tap = (index: number) => {
    if (progress >= count) return;
    if (index === progress) {
      feedback.step();
      const next = progress + 1;
      setProgress(next);
      if (next === count) feedback.solved(onSolved);
      return;
    }
    setProgress(0);
    feedback.wrong(2);
  };

  const stars = Array.from({ length: count }, (_, index) => {
    const anchor = starAnchor(index);
    return (
      <button
        key={index}
        slot={`hotspot-star-${index}`}
        data-position={`${anchor.x} ${anchor.y} ${anchor.z}`}
        data-normal="0 0 1"
        className={
          "witness-hotspot witness-hotspot--star"
          + (index < progress ? " is-lit" : "")
          + (glowing && index === progress ? " is-next" : "")
        }
        aria-label={`Star ${index + 1} of ${count}, counting from the lowest`}
        onClick={() => tap(index)}
      >
        <i aria-hidden="true" />
      </button>
    );
  });

  return (
    <section className="riddle-lock" aria-labelledby="witness-title">
      <LockHeading pin={pin} />
      <WitnessBench
        config={config}
        lost={lost}
        onLost={() => setLost(true)}
        cameraOrbit="0deg 85deg 0.32m"
        cameraTarget="0m 0.15m 0m"
      >
        {stars}
      </WitnessBench>

      <div className={"riddle-box re-frame" + (feedback.shaking ? " riddle-box--shake" : "")}>
        <WordsToggle shown={wordsShown} onToggle={() => setWordsShown(!wordsShown)} />
        {wordsShown && <p className="riddle-box__riddle">{config.riddle}</p>}
        <p className="puzzle-sum" aria-live="polite">
          {progress} of {count} stars caught{progress > 0 && progress < count ? ". Keep rising." : "."}
        </p>
        {lost && (
          <div className="puzzle-fallback">
            {Array.from({ length: count }, (_, index) => (
              <button
                key={index}
                className={"mechanical-button" + (index < progress ? " is-lit" : "")}
                onClick={() => tap(index)}
              >
                {index + 1}
              </button>
            ))}
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

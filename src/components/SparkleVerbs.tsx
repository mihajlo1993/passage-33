"use client";

import { useEffect, useRef, useState } from "react";
import { riddleAnswerMatches } from "@/src/pins";
import { useAudio } from "@/src/audio/useAudio";
import { useHaptics } from "@/src/device";
import {
  HintRow,
  LockHeading,
  SPARKLE_STAR_COUNT,
  SPARKLE_STARS_MS,
  SPARKLE_VERBS,
  WitnessBench,
  WordsToggle,
  sparkleStatementComplete,
  useLockFeedback,
  type WitnessPuzzleProps,
} from "./WitnessPuzzles";

/* ====== LOCK IV: operate the witness, then name it (THE THREE VERBS) ====== */

interface VerbHoldState {
  verbIndex: number;
  progress: number;
}

export function SparkleVerbs({ pin, config, onSolved, onCancel, onWrongAttempt }: WitnessPuzzleProps) {
  const [doneVerbs, setDoneVerbs] = useState(0);
  const [hold, setHold] = useState<VerbHoldState | null>(null);
  const [starsFlying, setStarsFlying] = useState(false);
  const [draft, setDraft] = useState("");
  const [hintCount, setHintCount] = useState(0);
  const [lost, setLost] = useState(false);
  const [wordsShown, setWordsShown] = useState(true);
  const feedback = useLockFeedback(onWrongAttempt, config.refusals);
  const audio = useAudio();
  const haptics = useHaptics();
  const holdFrameRef = useRef<number | null>(null);
  const holdPulseRef = useRef<number | null>(null);
  const starsTimerRef = useRef<number | null>(null);
  const doneVerbsRef = useRef(0);
  doneVerbsRef.current = doneVerbs;
  const guideOn = hintCount >= 3;
  const naming = sparkleStatementComplete(doneVerbs);
  const reducedMotion = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => () => {
    if (holdFrameRef.current !== null) cancelAnimationFrame(holdFrameRef.current);
    if (holdPulseRef.current !== null) window.clearInterval(holdPulseRef.current);
    if (starsTimerRef.current !== null) window.clearTimeout(starsTimerRef.current);
  }, []);

  const clearHoldTimers = () => {
    if (holdFrameRef.current !== null) {
      cancelAnimationFrame(holdFrameRef.current);
      holdFrameRef.current = null;
    }
    if (holdPulseRef.current !== null) {
      window.clearInterval(holdPulseRef.current);
      holdPulseRef.current = null;
    }
  };

  const completeVerb = (index: number) => {
    clearHoldTimers();
    setHold(null);
    haptics.found();
    void audio.play("released");
    const next = index + 1;
    setDoneVerbs(next);
    feedback.step();
    if (SPARKLE_VERBS[index]?.id === "release") {
      // Thirty-three stars rise out of the mouth, over the witness.
      setStarsFlying(true);
      starsTimerRef.current = window.setTimeout(
        () => setStarsFlying(false),
        reducedMotion ? 400 : SPARKLE_STARS_MS,
      );
    }
  };

  const beginHold = (index: number) => {
    const verb = SPARKLE_VERBS[index];
    if (!verb || index !== doneVerbsRef.current || verb.kind !== "hold") return;
    clearHoldTimers();
    // The pour rises; the charge hisses and pulses in rhythm.
    void audio.play(verb.id === "pour" ? "drag" : "write");
    if (verb.id === "charge") {
      holdPulseRef.current = window.setInterval(() => haptics.contact(), 320);
    }
    const startedAt = performance.now();
    const tick = () => {
      const progress = Math.min(1, (performance.now() - startedAt) / verb.holdMs);
      setHold({ verbIndex: index, progress });
      if (progress >= 1) {
        holdFrameRef.current = null;
        completeVerb(index);
        return;
      }
      holdFrameRef.current = requestAnimationFrame(tick);
    };
    holdFrameRef.current = requestAnimationFrame(tick);
  };

  /** Releasing early resets silently: no refusal, no damage, no sound. */
  const releaseHold = () => {
    clearHoldTimers();
    setHold(null);
  };

  const tapVerb = (index: number) => {
    const verb = SPARKLE_VERBS[index];
    if (!verb || verb.kind !== "tap") return;
    if (index !== doneVerbsRef.current) {
      feedback.wrong(2);
      return;
    }
    completeVerb(index);
  };

  const pressVerb = (index: number) => {
    // A hold started out of order is a gentle refusal, once, on press.
    if (index !== doneVerbsRef.current) {
      feedback.wrong(2);
      return;
    }
    beginHold(index);
  };

  const submitName = () => {
    if (riddleAnswerMatches(config, draft)) {
      feedback.solved(onSolved);
      return;
    }
    feedback.wrong(1);
  };

  const activeVerb = SPARKLE_VERBS[doneVerbs];

  const hotspots = SPARKLE_VERBS.map((verb, index) => {
    if (naming) return null;
    // The mouth serves POUR and RELEASE from the same point; draw only the
    // verb whose turn it is there, so the two never stack.
    if (verb.position === activeVerb?.position && verb.id !== activeVerb.id) return null;
    const isActive = index === doneVerbs;
    const holding = hold?.verbIndex === index;
    return (
      <button
        key={verb.id}
        slot={`hotspot-verb-${verb.id}`}
        data-position={verb.position}
        data-normal={verb.normal}
        className={
          "witness-hotspot witness-hotspot--verb"
          + (holding ? " is-holding" : "")
          + (guideOn && isActive ? " is-next" : "")
          + (index < doneVerbs ? " is-lit" : "")
        }
        aria-label={`${verb.verb}: ${verb.instruction}`}
        onPointerDown={verb.kind === "hold" ? () => pressVerb(index) : undefined}
        onPointerUp={verb.kind === "hold" ? releaseHold : undefined}
        onPointerLeave={verb.kind === "hold" ? releaseHold : undefined}
        onPointerCancel={verb.kind === "hold" ? releaseHold : undefined}
        onClick={verb.kind === "tap" ? () => tapVerb(index) : undefined}
        onContextMenu={(event) => event.preventDefault()}
      >
        {verb.hotspot}
      </button>
    );
  });

  return (
    <section className="riddle-lock" aria-labelledby="witness-title">
      <LockHeading pin={pin} />
      <div className="sparkle-bench-stage">
        <WitnessBench
          config={config}
          lost={lost}
          onLost={() => setLost(true)}
          cameraOrbit="0deg 85deg 0.32m"
          cameraTarget="0m 0.15m 0m"
        >
          {!lost && hotspots}
        </WitnessBench>
        {starsFlying && (
          <div className="sparkle-stars" aria-hidden="true">
            {Array.from({ length: SPARKLE_STAR_COUNT }, (_, index) => (
              <i
                key={index}
                style={{
                  left: `${18 + ((index * 23) % 64)}%`,
                  animationDelay: `${(index * 53) % 900}ms`,
                  animationDuration: `${1_600 + ((index * 97) % 1_100)}ms`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className={"riddle-box re-frame" + (feedback.shaking ? " riddle-box--shake" : "")}>
        <WordsToggle shown={wordsShown} onToggle={() => setWordsShown(!wordsShown)} />
        {wordsShown && <p className="riddle-box__riddle">{config.riddle}</p>}

        {/* The statement discovers itself, clause by clause. */}
        <div className="sparkle-statement" aria-label="The witness statement">
          {SPARKLE_VERBS.map((verb, index) => (
            <p className="sparkle-clause" key={verb.id}>
              <span>{verb.lead}</span>
              <strong className={index < doneVerbs ? "is-sworn" : ""}>
                {index < doneVerbs ? verb.reveals : "____"}
              </strong>
            </p>
          ))}
        </div>

        {!naming && activeVerb && (
          <>
            <p className="puzzle-sum" aria-live="polite">
              {activeVerb.verb}: {activeVerb.instruction}.
            </p>
            {hold?.verbIndex === doneVerbs && (
              <div className="hold-control__track sparkle-gauge" aria-hidden="true">
                <i style={{ width: `${Math.round(hold.progress * 100)}%` }} />
              </div>
            )}
            {lost && (
              <div className="puzzle-fallback sparkle-fallback" aria-label="Plain verb controls">
                {SPARKLE_VERBS.map((verb, index) => (
                  <button
                    key={verb.id}
                    className={
                      "mechanical-button"
                      + (guideOn && index === doneVerbs ? " is-next" : "")
                      + (index < doneVerbs ? " is-lit" : "")
                    }
                    disabled={index < doneVerbs}
                    onPointerDown={verb.kind === "hold" ? () => pressVerb(index) : undefined}
                    onPointerUp={verb.kind === "hold" ? releaseHold : undefined}
                    onPointerLeave={verb.kind === "hold" ? releaseHold : undefined}
                    onPointerCancel={verb.kind === "hold" ? releaseHold : undefined}
                    onClick={verb.kind === "tap" ? () => tapVerb(index) : undefined}
                  >
                    {verb.verb}{verb.kind === "hold" ? " (HOLD)" : " (TAP)"}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {naming && (
          <>
            <p className="puzzle-sum" aria-live="polite">
              The statement is true. Name the apparatus.
            </p>
            <div className="riddle-box__row">
              <input
                className={"riddle-box__input brass-input" + (guideOn ? " is-next" : "")}
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="Name it"
                aria-label="The apparatus name"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitName();
                }}
              />
              <button
                className="mechanical-button mechanical-button--primary"
                disabled={draft.trim() === ""}
                onClick={submitName}
              >
                Speak
              </button>
            </div>
          </>
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

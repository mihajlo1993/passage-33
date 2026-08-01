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

/*
 * LOCK IV: THE APPARATUS PANEL. The witness stands clean on the bench (a
 * centerpiece to admire, full orbit, nothing to hunt for on the model).
 * The work happens on a clear brass panel below it: three stations, IN /
 * GAS / OUT, always visible. Only the order every such machine obeys will
 * work; an out-of-order touch answers with the REASON, so the puzzle
 * teaches itself. When the statement is complete she types the name.
 */

/** Why an out-of-order touch refuses: the machine explains itself. */
export const SPARKLE_ORDER_LINES = {
  chargeBeforePour:
    "It will not breathe into an empty vessel. Something still must go in first.",
  releaseBeforePour:
    "Nothing to release. The vessel stands empty.",
  releaseBeforeCharge:
    "Still water alone does not sparkle. It wants its silver breath first.",
  alreadyDone:
    "That part of the work is done. The apparatus remembers.",
} as const;

/** The clue ladder under the name input: after two misses, then three. */
export const SPARKLE_NAME_CLUES = {
  afterTwo:
    "It answers to plainer names too: a soda maker, a sparkling water machine, the bubbly water thing on the counter.",
  afterThree:
    "It makes your bottle sparkle.",
} as const;

/**
 * The stations hang on the panel in a jumbled order (never left-to-right),
 * so the ARRANGEMENT gives nothing away: only the machine's own logic
 * says what comes first. The press order stays pour, charge, release.
 */
export function shuffledStationOrder(
  random: () => number,
): readonly number[] {
  const order = SPARKLE_VERBS.map((_, index) => index);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.min(Math.max(random(), 0), 0.999999) * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (!order.every((value, index) => value === index)) return order;
  }
  // A degenerate random source still never yields the giveaway order.
  return order.map((_, index) => (index + 1) % order.length);
}

interface StationHoldState {
  verbIndex: number;
  progress: number;
}

export function SparkleVerbs({ pin, config, onSolved, onCancel, onWrongAttempt }: WitnessPuzzleProps) {
  const [doneVerbs, setDoneVerbs] = useState(0);
  // The panel arrangement is drawn once per visit, never left-to-right.
  const [stationOrder] = useState<readonly number[]>(
    () => shuffledStationOrder(Math.random),
  );
  const [hold, setHold] = useState<StationHoldState | null>(null);
  const [starsFlying, setStarsFlying] = useState(false);
  const [orderLine, setOrderLine] = useState("");
  const [draft, setDraft] = useState("");
  const [nameAttempts, setNameAttempts] = useState(0);
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

  /**
   * An out-of-order touch answers with its reason: no damage, no shake.
   * Curiosity is how she learns the machine; only wrong NAMES cost.
   */
  const explainOrder = (index: number) => {
    const done = doneVerbsRef.current;
    if (index < done) {
      setOrderLine(SPARKLE_ORDER_LINES.alreadyDone);
    } else if (SPARKLE_VERBS[index]?.id === "charge") {
      setOrderLine(SPARKLE_ORDER_LINES.chargeBeforePour);
    } else if (done === 0) {
      setOrderLine(SPARKLE_ORDER_LINES.releaseBeforePour);
    } else {
      setOrderLine(SPARKLE_ORDER_LINES.releaseBeforeCharge);
    }
    haptics.stutter();
  };

  const completeVerb = (index: number) => {
    clearHoldTimers();
    setHold(null);
    setOrderLine("");
    haptics.found();
    void audio.play("released");
    setDoneVerbs(index + 1);
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
    if (!verb || verb.kind !== "hold") return;
    if (index !== doneVerbsRef.current) {
      explainOrder(index);
      return;
    }
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
      explainOrder(index);
      return;
    }
    completeVerb(index);
  };

  const submitName = () => {
    if (riddleAnswerMatches(config, draft)) {
      feedback.solved(onSolved);
      return;
    }
    setNameAttempts((count) => count + 1);
    feedback.wrong(1);
  };

  return (
    <section className="riddle-lock" aria-labelledby="witness-title">
      <LockHeading pin={pin} />
      <div className="sparkle-bench-stage">
        <WitnessBench
          config={config}
          lost={lost}
          onLost={() => setLost(true)}
          cameraOrbit="25deg 78deg 105%"
          autoRotate
        />
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

        {!naming && (
          <>
            {/* The apparatus panel: three stations, always all visible,
                hung in a jumbled order. Only the logic says what is first. */}
            <div className="apparatus-panel" aria-label="The apparatus controls">
              {stationOrder.map((index) => {
                const verb = SPARKLE_VERBS[index];
                const done = index < doneVerbs;
                const active = index === doneVerbs;
                const holding = hold?.verbIndex === index;
                const progress = done ? 1 : holding ? hold.progress : 0;
                return (
                  <button
                    key={verb.id}
                    className={
                      "apparatus-station"
                      + (done ? " is-done" : "")
                      + (holding ? " is-holding" : "")
                      + (guideOn && active ? " is-next" : "")
                    }
                    disabled={done}
                    aria-label={`${verb.verb}: ${verb.instruction}`}
                    onPointerDown={verb.kind === "hold" ? () => beginHold(index) : undefined}
                    onPointerUp={verb.kind === "hold" ? releaseHold : undefined}
                    onPointerLeave={verb.kind === "hold" ? releaseHold : undefined}
                    onPointerCancel={verb.kind === "hold" ? releaseHold : undefined}
                    onClick={verb.kind === "tap" ? () => tapVerb(index) : undefined}
                    onContextMenu={(event) => event.preventDefault()}
                  >
                    <span className="apparatus-station__tag">{verb.tag}</span>
                    <strong className="apparatus-station__verb">{verb.verb}</strong>
                    <span className="apparatus-station__how">
                      {done ? verb.reveals : verb.kind === "hold" ? "HOLD" : "TAP"}
                    </span>
                    <span className="apparatus-station__gauge" aria-hidden="true">
                      <i style={{ width: `${Math.round(progress * 100)}%` }} />
                    </span>
                  </button>
                );
              })}
            </div>
            {/* The machine explains itself when touched out of order. */}
            <p className="riddle-box__feedback apparatus-reason" aria-live="polite">
              {orderLine}
            </p>
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
            {/* After two misses the Keeper starts helping; after three he
                all but says it. Wrong names never lock anything. */}
            {nameAttempts >= 2 && (
              <p className="riddle-box__hint">{SPARKLE_NAME_CLUES.afterTwo}</p>
            )}
            {nameAttempts >= 3 && (
              <p className="riddle-box__hint">{SPARKLE_NAME_CLUES.afterThree}</p>
            )}
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

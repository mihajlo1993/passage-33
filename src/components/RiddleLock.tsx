"use client";

import { useState } from "react";
import {
  REFUSAL_LINES,
  riddleAnswerMatches,
  type RiddleConfig,
} from "@/src/pins";
import type { Pin } from "@/src/types";
import { playKeeper } from "@/src/audio/keeper";
import { useAudio } from "@/src/audio/useAudio";
import { useHaptics } from "@/src/device";

export interface RiddleLockProps {
  pin: Pin;
  config: RiddleConfig;
  onSolved: () => void;
  onCancel: () => void;
  onWrongAttempt: () => void;
}

/**
 * A lock is a riddle. On the bench above stands the Keeper's witness: a cast
 * bronze artifact whose engravings genuinely speak to the riddle (the wager
 * obelisk wears all three numbers of its sum). She can orbit it fully, under
 * side included; the typed answer below is still the only thing that opens
 * the lock. Three hints on demand, free, the third one practically answers.
 * Nothing here can hard-stall and the witness never gates.
 */
export function RiddleLock({ pin, config, onSolved, onCancel, onWrongAttempt }: RiddleLockProps) {
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState("");
  const [wrongCount, setWrongCount] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [benchLost, setBenchLost] = useState(false);
  const [wordsShown, setWordsShown] = useState(true);
  const audio = useAudio();
  const haptics = useHaptics();

  const submit = () => {
    if (riddleAnswerMatches(config, draft)) {
      void audio.play("released");
      haptics.found();
      onSolved();
      return;
    }
    const next = wrongCount + 1;
    setWrongCount(next);
    const lines = config.refusals ?? REFUSAL_LINES;
    setFeedback(lines[(next - 1) % lines.length]);
    setShaking(true);
    window.setTimeout(() => setShaking(false), 340);
    void audio.play("refused");
    haptics.stutter();
    if (next === 3) playKeeper("refuse");
    onWrongAttempt();
  };

  const hint = () => {
    if (hintCount < config.hints.length) setHintCount(hintCount + 1);
  };

  return (
    <section className="riddle-lock" aria-labelledby="riddle-title">
      <header className="lock-screen__heading">
        <p className="eyebrow">{pin.name}</p>
        <h1 id="riddle-title">{pin.zone === "bathroom" ? "The last of four" : "One of four"}</h1>
      </header>

      <div className="riddle-bench">
        {!benchLost && (
          <model-viewer
            className="riddle-bench__viewer"
            src={config.model}
            alt="The Keeper's witness for this lock"
            camera-controls
            disable-pan
            disable-tap
            touch-action="pan-y"
            interaction-prompt="none"
            auto-rotate
            auto-rotate-delay="2500"
            rotation-per-second="12deg"
            exposure="1.0"
            shadow-intensity="0.9"
            tone-mapping="aces"
            camera-orbit="25deg 72deg 105%"
            min-camera-orbit="-Infinity 0deg auto"
            max-camera-orbit="Infinity 180deg auto"
            onError={() => setBenchLost(true)}
          />
        )}
        {benchLost && (
          <p className="riddle-bench__lost">The witness refuses the light. The lock does not mind.</p>
        )}
        <p className="riddle-bench__note">{config.benchNote}</p>
      </div>

      <div className={"riddle-box re-frame" + (shaking ? " riddle-box--shake" : "")}>
        <button className="text-control panel-toggle" onClick={() => setWordsShown(!wordsShown)}>
          {wordsShown ? "Give the witness room" : "Show the words"}
        </button>
        {wordsShown && <p className="riddle-box__riddle">{config.riddle}</p>}
        <div className="riddle-box__row">
          <input
            className="riddle-box__input brass-input"
            type={config.numeric ? "number" : "text"}
            inputMode={config.numeric ? "numeric" : "text"}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Speak to the lock"
            aria-label="Your answer"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
          <button
            className="mechanical-button mechanical-button--primary"
            disabled={draft.trim() === ""}
            onClick={submit}
          >
            Speak
          </button>
        </div>
        <p className="riddle-box__feedback" aria-live="polite">{feedback}</p>
        {wordsShown && (
          <>
            {hintCount > 0 && (
              <p className="riddle-box__hint">{config.hints[hintCount - 1]}</p>
            )}
            <div className="riddle-box__hintrow">
              <button className="text-control" onClick={hint} disabled={hintCount >= config.hints.length}>
                {hintCount === 0
                  ? "Ask the Keeper for help"
                  : hintCount < config.hints.length
                    ? "Ask again"
                    : "The Keeper has said all he will"}
              </button>
            </div>
          </>
        )}
      </div>

      <button className="text-control" onClick={onCancel}>Step away</button>
    </section>
  );
}

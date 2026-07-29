"use client";

import { useMemo, useState } from "react";
import {
  createDialValue,
  dialCodeMatches,
  dialValue,
  isValidDialCode,
  normaliseDialCode,
  rotateDialAt,
  symbolsForDial,
  type DialDirection,
  type DialLockKind,
} from "@/src/locks";
import { phase2DialAudioCue } from "@/src/game/phase2Integration";
import { useAudio } from "@/src/audio/useAudio";

export interface DialLockScreenProps {
  kind: DialLockKind;
  correctValue: string;
  title?: string;
  hostText?: string;
  wrongText?: string;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: (value: string) => void | Promise<void>;
  onCancel: () => void;
  onWrongAttempt?: (attempts: number) => void;
}

const DEFAULT_HOST_TEXT =
  "A little wheel for every little certainty. Set them carefully. I have all evening.";

const DEFAULT_WRONG_TEXT =
  "No. But the lock enjoyed your confidence. Again, birthday girl.";

export function DialLockScreen({
  kind,
  correctValue,
  title = "Combination Lock",
  hostText = DEFAULT_HOST_TEXT,
  wrongText = DEFAULT_WRONG_TEXT,
  submitLabel = "TRY THE SHACKLE",
  cancelLabel = "STEP AWAY",
  onSubmit,
  onCancel,
  onWrongAttempt,
}: DialLockScreenProps) {
  const audio = useAudio();
  const symbols = useMemo(() => symbolsForDial(kind), [kind]);
  // Wheel count derives from the configured code so an edited code can never
  // leave the lock physically unopenable.
  const [wheels, setWheels] = useState<readonly string[]>(() =>
    createDialValue(kind, normaliseDialCode(correctValue).length),
  );
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState(hostText);
  const [submitting, setSubmitting] = useState(false);
  const setupIsValid = isValidDialCode(correctValue, kind);

  const turn = (position: number, direction: DialDirection) => {
    setWheels((current) =>
      rotateDialAt(current, position, direction, symbols),
    );
    setFeedback(hostText);
  };

  const submit = async () => {
    if (submitting || !setupIsValid) {
      return;
    }

    const value = dialValue(wheels);
    if (!dialCodeMatches(value, correctValue)) {
      void audio.play(phase2DialAudioCue(false));
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setFeedback(wrongText);
      onWrongAttempt?.(nextAttempts);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(value);
    } catch {
      setFeedback(
        "The shackle moved. The house did not. Give the mechanism another turn.",
      );
      setSubmitting(false);
    }
  };

  return (
    <section className="lock-screen" aria-labelledby="dial-lock-title">
      <header className="lock-screen__heading">
        <p className="eyebrow">HOUSE HARDWARE // MANUAL RELEASE</p>
        <h1 id="dial-lock-title">{title}</h1>
      </header>

      <p className="host-copy lock-screen__host" aria-live="polite">
        {feedback}
      </p>

      <div className="padlock" data-kind={kind}>
        <div className="padlock__shackle" aria-hidden="true" />
        <div className="padlock__body">
          <p className="padlock__maker">BAKER HOUSE // SERIES 33</p>
          <div
            className="padlock__wheels"
            role="group"
            aria-label={`${wheels.length} position combination`}
          >
            {wheels.map((symbol, position) => (
              <div className="dial-wheel" key={position}>
                <button
                  type="button"
                  className="dial-wheel__turn"
                  aria-label={`Raise position ${position + 1}`}
                  onClick={() => turn(position, 1)}
                >
                  +
                </button>
                <output
                  className="dial-wheel__value"
                  aria-label={`Position ${position + 1}: ${symbol}`}
                >
                  {symbol}
                </output>
                <button
                  type="button"
                  className="dial-wheel__turn"
                  aria-label={`Lower position ${position + 1}`}
                  onClick={() => turn(position, -1)}
                >
                  −
                </button>
              </div>
            ))}
          </div>
          <p className="padlock__attempts">
            {attempts === 0
              ? "SHACKLE UNDER TENSION"
              : `FAILED TURNS // ${String(attempts).padStart(2, "0")} // NO LOCKOUT`}
          </p>
        </div>
      </div>

      {!setupIsValid && (
        <p className="system-warning" role="alert">
          LOCK SETUP FAULT. EXPECTED A{" "}
          {kind === "numeric" ? "NUMBER" : "WORD"} USING ONLY DIAL SYMBOLS.
        </p>
      )}

      <div className="interaction-actions">
        <button
          type="button"
          className="mechanical-button mechanical-button--primary"
          disabled={submitting || !setupIsValid}
          onClick={() => void submit()}
        >
          {submitting ? "SHACKLE MOVING" : submitLabel}
        </button>
        <button
          type="button"
          className="text-control"
          disabled={submitting}
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
      </div>
    </section>
  );
}

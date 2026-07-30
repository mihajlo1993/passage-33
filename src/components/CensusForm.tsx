"use client";

import { useState } from "react";
import { CENSUS_ANSWERS } from "@/src/pins";
import { useAudio } from "@/src/audio/useAudio";
import { useHaptics } from "@/src/device";

/**
 * Five wounds. Each count is validated on its own, so one miscount never
 * poisons the rest: the single most important solo-fairness decision in the
 * whole hunt. The questions live on the printed census card; the terminal
 * only keeps the ledger.
 */
const SLOT_LABELS = [
  "First wound",
  "Second wound",
  "Third wound",
  "Fourth wound",
  "Fifth wound",
] as const;

export interface CensusFormProps {
  onSolved: () => void;
  onCancel: () => void;
  onWrongAttempt: () => void;
}

export function CensusForm({ onSolved, onCancel, onWrongAttempt }: CensusFormProps) {
  const [accepted, setAccepted] = useState<boolean[]>(() =>
    CENSUS_ANSWERS.map(() => false),
  );
  const [drafts, setDrafts] = useState<string[]>(() => CENSUS_ANSWERS.map(() => ""));
  const [feedback, setFeedback] = useState(
    "The census card asks five questions. Answer them with your feet, then with numbers.",
  );
  const audio = useAudio();
  const haptics = useHaptics();

  const complete = accepted.every(Boolean);

  const submit = (index: number) => {
    if (accepted[index]) return;
    const value = Number(drafts[index]);
    if (!Number.isInteger(value) || value < 1 || value > 50) {
      setFeedback("The house counts in whole numbers between one and fifty.");
      return;
    }
    if (value === CENSUS_ANSWERS[index]) {
      const next = [...accepted];
      next[index] = true;
      setAccepted(next);
      void audio.play("found");
      haptics.found();
      setFeedback(
        next.every(Boolean)
          ? "Five wounds filled. The house agrees with itself."
          : "The house agrees. Next wound.",
      );
    } else {
      void audio.play("refused");
      onWrongAttempt();
      setFeedback("The house disagrees. Count again; it never miscounts itself.");
    }
  };

  return (
    <section className="census-form" aria-labelledby="census-title">
      <header className="lock-screen__heading">
        <p className="eyebrow">Entry 041, the census</p>
        <h1 id="census-title">Five Wounds</h1>
      </header>
      <p className="host-copy" aria-live="polite">{feedback}</p>
      <div className="census-slots re-frame">
        {SLOT_LABELS.map((label, index) => (
          <div className="census-slot" key={label} data-accepted={accepted[index]}>
            <span className="census-slot__label">
              {label}
              <small>{"Question " + (index + 1) + " on the card"}</small>
            </span>
            {accepted[index] ? (
              <strong className="census-slot__value">{CENSUS_ANSWERS[index]}</strong>
            ) : (
              <span className="census-slot__entry">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={50}
                  value={drafts[index]}
                  aria-label={label}
                  onChange={(event) => {
                    const next = [...drafts];
                    next[index] = event.target.value;
                    setDrafts(next);
                  }}
                />
                <button
                  className="mechanical-button"
                  onClick={() => submit(index)}
                  disabled={drafts[index] === ""}
                >
                  Set
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="interaction-actions">
        <button
          className="mechanical-button mechanical-button--primary"
          disabled={!complete}
          onClick={onSolved}
        >
          {complete ? "Close the census" : "Wounds remain open"}
        </button>
        <button className="text-control" onClick={onCancel}>Step away</button>
      </div>
    </section>
  );
}

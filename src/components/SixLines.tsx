"use client";

import { useState } from "react";
import { lineAt, slipsCellIndex } from "@/src/pins";
import { useAudio } from "@/src/audio/useAudio";
import { useHaptics } from "@/src/device";

/**
 * The hardest table in the file. Line 1 is hers (census + stars); line 6 is
 * already written. Lines 2 through 5 must be derived; the rule is never
 * stated anywhere and the only key is her age. Each submitted line validates
 * on its own; line 6 is the self-check that tells her the rule was right.
 */
function formatLine(line: { mains: number[]; stars: number[] }): string {
  return line.mains.join(" ") + "  |  " + line.stars.join(" ");
}

function parseEntry(raw: string): { mains: number[]; stars: number[] } | null {
  const parts = raw
    .replace(/[|,;]+/g, " ")
    .split(/\s+/)
    .map((token) => Number(token))
    .filter((value) => Number.isFinite(value));
  if (parts.length !== 7) return null;
  const mains = parts.slice(0, 5).sort((a, b) => a - b);
  const stars = parts.slice(5).sort((a, b) => a - b);
  return { mains, stars };
}

function sameLine(
  a: { mains: number[]; stars: number[] },
  b: { mains: number[]; stars: number[] },
): boolean {
  return (
    a.mains.length === b.mains.length &&
    a.mains.every((value, index) => value === b.mains[index]) &&
    a.stars.every((value, index) => value === b.stars[index])
  );
}

export interface SixLinesProps {
  onSolved: () => void;
  onCancel: () => void;
  onWrongAttempt: () => void;
}

export function SixLines({ onSolved, onCancel, onWrongAttempt }: SixLinesProps) {
  const [solvedLines, setSolvedLines] = useState<boolean[]>([false, false, false, false]);
  const [drafts, setDrafts] = useState<string[]>(["", "", "", ""]);
  const [feedback, setFeedback] = useState(
    "Line one is yours. Line six is written. Something happened five times between them.",
  );
  const audio = useAudio();
  const haptics = useHaptics();

  const complete = solvedLines.every(Boolean);

  const submit = (lineIndex: number) => {
    const parsed = parseEntry(drafts[lineIndex]);
    if (!parsed) {
      setFeedback("A line is five numbers, a bar, then two stars. Seven numbers.");
      return;
    }
    const expected = lineAt(lineIndex + 1);
    if (sameLine(parsed, expected)) {
      const next = [...solvedLines];
      next[lineIndex] = true;
      setSolvedLines(next);
      void audio.play("found");
      haptics.found();
      setFeedback(
        next.every(Boolean)
          ? "The lines agree with the ledger. Transcribe all six onto the slips."
          : "The ledger accepts the line.",
      );
    } else {
      void audio.play("refused");
      onWrongAttempt();
      setFeedback("The ledger refuses the line. The rule holds for every line or none.");
    }
  };

  return (
    <section className="six-lines" aria-labelledby="lines-title">
      <header className="lock-screen__heading">
        <p className="eyebrow">Entry 043, the wager</p>
        <h1 id="lines-title">The Six Lines</h1>
      </header>
      <p className="host-copy" aria-live="polite">{feedback}</p>
      <div className="six-lines__table re-frame">
        <div className="six-lines__row" data-fixed="true">
          <span>1</span>
          <strong>{formatLine(lineAt(0))}</strong>
        </div>
        {solvedLines.map((solved, index) => (
          <div className="six-lines__row" key={index} data-solved={solved}>
            <span>{index + 2}</span>
            {solved ? (
              <strong>{formatLine(lineAt(index + 1))}</strong>
            ) : (
              <span className="six-lines__entry">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="5 numbers | 2 stars"
                  value={drafts[index]}
                  aria-label={"Line " + (index + 2)}
                  onChange={(event) => {
                    const next = [...drafts];
                    next[index] = event.target.value;
                    setDrafts(next);
                  }}
                />
                <button
                  className="mechanical-button"
                  onClick={() => submit(index)}
                  disabled={drafts[index].trim() === ""}
                >
                  Set
                </button>
              </span>
            )}
          </div>
        ))}
        <div className="six-lines__row" data-fixed="true">
          <span>6</span>
          <strong>{formatLine(lineAt(5))}</strong>
        </div>
      </div>
      {complete && (
        <p className="six-lines__closing host-copy">
          {"The last number of the last line counts a mouth on the shelf of sixteen: mouth " +
            slipsCellIndex() +
            ", from the left. Something red and blue is folded inside."}
        </p>
      )}
      <div className="interaction-actions">
        <button
          className="mechanical-button mechanical-button--primary"
          disabled={!complete}
          onClick={onSolved}
        >
          {complete ? "Claim the wager" : "Four lines are missing"}
        </button>
        <button className="text-control" onClick={onCancel}>Step away</button>
      </div>
    </section>
  );
}

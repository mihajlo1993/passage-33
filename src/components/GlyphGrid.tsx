"use client";

import { useState } from "react";
import { KALLAX_KEY_GLYPH_INDEX, kallaxGlyphs } from "@/src/glyphs";
import { colours } from "@/src/tokens";
import { useAudio } from "@/src/audio/useAudio";
import { GameIcon } from "./GameIcon";

const WRONG_LINES = [
  "That cell holds dust and my disappointment. The card in your hand disagrees with you.",
  "No. Look at the wet card again, properly, under light.",
  "The mark has four of its kind on that shelf and none of them are where you keep pointing.",
];

export interface GlyphGridProps {
  onSolved: () => void;
  onCancel: () => void;
  onWrongAttempt: () => void;
}

/**
 * Sixteen cells on screen mirror the sixteen printed glyph cards on the real
 * Kallax. She matches the mark from the cistern card, and only then does the
 * app tell her to open the physical cell.
 */
export function GlyphGrid({ onSolved, onCancel, onWrongAttempt }: GlyphGridProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [feedback, setFeedback] = useState(
    "Sixteen cells. One wears the mark from the water. Choose with your eyes, not your hopes.",
  );
  const [solved, setSolved] = useState(false);
  const audio = useAudio();

  const confirm = () => {
    if (selected === null || solved) return;
    if (selected === KALLAX_KEY_GLYPH_INDEX) {
      setSolved(true);
      void audio.play("released");
      setFeedback(
        "That one. Open the real cell with the same mark. What is inside was always going to be yours.",
      );
      return;
    }
    void audio.play("refused");
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    setFeedback(WRONG_LINES[Math.min(nextAttempts - 1, WRONG_LINES.length - 1)]);
    onWrongAttempt();
  };

  return (
    <section className="glyph-grid-screen" aria-labelledby="glyph-title">
      <header className="lock-screen__heading">
        <p className="eyebrow">THE KALLAX // SIXTEEN CELLS</p>
        <h1 id="glyph-title">Match the Mark</h1>
      </header>
      <p className="host-copy" aria-live="polite">{feedback}</p>
      <div className="glyph-grid" role="group" aria-label="Sixteen Kallax cells">
        {kallaxGlyphs.map((glyph) => (
          <button
            key={glyph.index}
            className="glyph-cell"
            data-selected={selected === glyph.index}
            data-solved={solved && glyph.index === KALLAX_KEY_GLYPH_INDEX}
            disabled={solved}
            onClick={() => setSelected(glyph.index)}
            aria-label={`Cell ${glyph.index}`}
          >
            <GameIcon
              name={glyph.icon}
              className="glyph-cell__icon"
              color={colours.bone}
            />
            <span>{String(glyph.index).padStart(2, "0")}</span>
          </button>
        ))}
      </div>
      <div className="interaction-actions">
        <button
          className="mechanical-button mechanical-button--primary"
          disabled={selected === null && !solved}
          onClick={solved ? onSolved : confirm}
        >
          {solved ? "I HAVE OPENED THE CELL" : "CONFIRM THE MARK"}
        </button>
        <button className="text-control" onClick={onCancel}>STEP AWAY</button>
      </div>
    </section>
  );
}

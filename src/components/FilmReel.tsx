"use client";

import { useState } from "react";
import { useAudio } from "@/src/audio/useAudio";
import { useHaptics } from "@/src/device";

/**
 * Six frames of her own evening, tapped into chronological order. Unsolvable
 * by anyone who did not play tonight; trivially executable by the one who
 * did. The empty frame goes last, because the evening is not over.
 */
interface Frame {
  readonly id: string;
  readonly label: string;
  readonly caption: string;
}

/** Authored in true chronological order; presentation shuffles them. */
const FRAMES: readonly Frame[] = [
  { id: "seal", label: "The seal", caption: "A bronze stone, hall at heaven" },
  { id: "shadow", label: "The cast", caption: "Three arms on a corridor wall" },
  { id: "census", label: "The census", caption: "Five wounds, five rooms" },
  { id: "crest", label: "The stars", caption: "A card against the glass" },
  { id: "hem", label: "The hem frame", caption: "Stamped, carried, yours" },
  { id: "blank", label: "The empty frame", caption: "The evening is not over" },
];

const PRESENTATION_ORDER = [3, 5, 0, 4, 2, 1] as const;

export interface FilmReelProps {
  onSolved: () => void;
  onCancel: () => void;
  onWrongAttempt: () => void;
}

export function FilmReel({ onSolved, onCancel, onWrongAttempt }: FilmReelProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState(
    "Tap the frames in the order the evening happened. The projector accepts one order only.",
  );
  const audio = useAudio();
  const haptics = useHaptics();

  const pick = (frame: Frame) => {
    if (solved || picked.includes(frame.id)) return;
    const position = picked.length;
    if (FRAMES[position].id !== frame.id) {
      void audio.play("refused");
      haptics.stutter();
      onWrongAttempt();
      setPicked([]);
      setFeedback("The projector jams and spits the splice. From the beginning.");
      return;
    }
    const next = [...picked, frame.id];
    setPicked(next);
    void audio.play("dial-tick");
    if (next.length === FRAMES.length) {
      setSolved(true);
      void audio.play("released");
      haptics.contact();
      setFeedback("The reel runs. Tonight, in order, ending on an empty frame.");
    }
  };

  return (
    <section className="film-reel" aria-labelledby="reel-title">
      <header className="lock-screen__heading">
        <p className="eyebrow">Entry 103</p>
        <h1 id="reel-title">The Reel</h1>
      </header>
      <p className="host-copy" aria-live="polite">{feedback}</p>
      <div className="film-reel__strip re-frame">
        {PRESENTATION_ORDER.map((frameIndex) => {
          const frame = FRAMES[frameIndex];
          const order = picked.indexOf(frame.id);
          return (
            <button
              key={frame.id}
              className="film-frame"
              data-picked={order >= 0}
              data-blank={frame.id === "blank"}
              disabled={solved || order >= 0}
              onClick={() => pick(frame)}
            >
              <span className="film-frame__order">{order >= 0 ? order + 1 : ""}</span>
              <strong>{frame.label}</strong>
              <small>{frame.caption}</small>
            </button>
          );
        })}
      </div>
      <div className="interaction-actions">
        <button
          className="mechanical-button mechanical-button--primary"
          disabled={!solved}
          onClick={onSolved}
        >
          {solved ? "Run the reel" : "The splice is incomplete"}
        </button>
        <button className="text-control" onClick={onCancel}>Step away</button>
      </div>
    </section>
  );
}

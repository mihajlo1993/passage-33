"use client";

import { useMemo, useState } from "react";
import { musicBoxTargets } from "@/src/pins";
import { useAudio } from "@/src/audio/useAudio";
import { useHaptics } from "@/src/device";

/**
 * Five cylinders, one scratch each, twelve positions. The only clue in the
 * world is the beat title: IT REMEMBERS YOUR FIRST LINE. The targets are her
 * own EuroMillions line one, each number mod twelve.
 */
export interface MusicBoxProps {
  onSolved: () => void;
  onCancel: () => void;
  onWrongAttempt: () => void;
}

export function MusicBox({ onSolved, onCancel, onWrongAttempt }: MusicBoxProps) {
  const targets = useMemo(() => musicBoxTargets(), []);
  const [positions, setPositions] = useState<number[]>(() => targets.map(() => 0));
  const [playing, setPlaying] = useState(false);
  const [feedback, setFeedback] = useState("It remembers your first line.");
  const audio = useAudio();
  const haptics = useHaptics();

  const turn = (index: number, direction: 1 | -1) => {
    if (playing) return;
    void audio.play("dial-tick");
    setPositions((current) =>
      current.map((value, cursor) =>
        cursor === index ? ((value + direction + 12) % 12) : value,
      ),
    );
  };

  const wind = () => {
    if (playing) return;
    const correct = positions.every((value, index) => value === targets[index]);
    if (correct) {
      setPlaying(true);
      void audio.play("released");
      haptics.found();
      setFeedback("The box plays clean. A birthday song, at last, at speed.");
      return;
    }
    void audio.play("refused");
    onWrongAttempt();
    setFeedback("The tune comes out wrong and stops itself. It remembers. Do you?");
  };

  return (
    <section className="music-box" aria-labelledby="box-title">
      <header className="lock-screen__heading">
        <p className="eyebrow">Entry 102</p>
        <h1 id="box-title">The Music Box</h1>
      </header>
      <p className="host-copy" aria-live="polite">{feedback}</p>
      <div className="music-box__cylinders re-frame" data-playing={playing}>
        {positions.map((value, index) => (
          <div className="music-cylinder" key={index}>
            <button
              type="button"
              className="dial-wheel__turn"
              aria-label={"Raise cylinder " + (index + 1)}
              onClick={() => turn(index, 1)}
            >
              +
            </button>
            <output
              className="music-cylinder__value"
              aria-label={"Cylinder " + (index + 1) + " at position " + value}
            >
              {value}
            </output>
            <button
              type="button"
              className="dial-wheel__turn"
              aria-label={"Lower cylinder " + (index + 1)}
              onClick={() => turn(index, -1)}
            >
              &minus;
            </button>
          </div>
        ))}
      </div>
      <div className="interaction-actions">
        {playing ? (
          <button className="mechanical-button mechanical-button--primary" onClick={onSolved}>
            Let it finish
          </button>
        ) : (
          <button className="mechanical-button mechanical-button--primary" onClick={wind}>
            Wind the box
          </button>
        )}
        <button className="text-control" onClick={onCancel} disabled={playing}>
          Step away
        </button>
      </div>
    </section>
  );
}

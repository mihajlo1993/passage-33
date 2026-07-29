"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "@/src/tokens";
import { useAudio } from "@/src/audio/useAudio";
import { SAVE_WRITTEN_AUDIO_CUE } from "@/src/game/phase2Integration";

export interface SaveScreenProps {
  pinId: number | null;
  valid: boolean;
  onCommit: () => Promise<void>;
  navigate: (path: string) => void;
}

export function SaveScreen({ pinId, valid, onCommit, navigate }: SaveScreenProps) {
  const [complete, setComplete] = useState(false);
  const audio = useAudio();
  const committedPin = useRef<number | null>(null);

  useEffect(() => {
    if (!valid) return;
    setComplete(false);
    if (pinId !== null && committedPin.current !== pinId) {
      committedPin.current = pinId;
      void onCommit()
        .then(() => audio.play(SAVE_WRITTEN_AUDIO_CUE))
        .catch(() => {
          committedPin.current = null;
        });
    }
    const timer = window.setTimeout(() => setComplete(true), motion.eventMs.saveTheatre);
    return () => window.clearTimeout(timer);
  }, [audio, onCommit, pinId, valid]);

  if (!valid) {
    return (
      <section className="save-theatre save-theatre--denied">
        <p className="eyebrow">CASSETTE DECK</p>
        <h1>NO TAPE INSERTED.</h1>
        <p className="host-copy">That machine is reached at a save point. You cannot rehearse the moment.</p>
        <button className="mechanical-button" onClick={() => navigate("/")}>RETURN</button>
      </section>
    );
  }

  return (
    <section className="save-theatre" aria-labelledby="save-title">
      <div className="cassette-deck" data-complete={complete}>
        <div className="cassette-deck__screws" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="cassette-slot">
          <div className="cassette">
            <span>BH-7</span>
            <strong>SAVE {String(pinId).padStart(2, "0")}</strong>
            <div className="cassette__reels" aria-hidden="true"><i /><i /></div>
          </div>
        </div>
        <div className="deck-counter" aria-hidden="true">{complete ? "00:33" : "--:--"}</div>
      </div>
      <div className="save-theatre__copy" aria-live="polite">
        <p className="eyebrow">MECHANICAL WRITE</p>
        <h1 id="save-title">{complete ? "MEMORY HELD." : "RECORDING..."}</h1>
        <p className="host-copy">
          {complete
            ? "There. The house remembers exactly where the birthday girl stood."
            : "The tape is taking this moment from you. Hold still. Old machines dislike being hurried."}
        </p>
      </div>
      {complete && (
        <button className="mechanical-button mechanical-button--primary" onClick={() => navigate("/")}>
          EJECT AND CONTINUE
        </button>
      )}
    </section>
  );
}

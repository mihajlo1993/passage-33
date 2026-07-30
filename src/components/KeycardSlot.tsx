"use client";

import { useRef, useState } from "react";
import { useAudio } from "@/src/audio/useAudio";
import { useHaptics } from "@/src/device";

const HOLD_MS = 900;

type SlotColour = "red" | "blue";

export interface KeycardSlotProps {
  onSolved: () => void;
  onCancel: () => void;
}

/**
 * Two halves of the invitation. Press and hold each card against its slot;
 * the reader takes its time, the way old machines do.
 */
export function KeycardSlot({ onSolved, onCancel }: KeycardSlotProps) {
  const [inserted, setInserted] = useState<Record<SlotColour, boolean>>({
    red: false,
    blue: false,
  });
  const [holding, setHolding] = useState<SlotColour | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const audio = useAudio();
  const haptics = useHaptics();

  const bothIn = inserted.red && inserted.blue;

  const beginHold = (colour: SlotColour) => {
    if (inserted[colour] || bothIn) return;
    if (colour === "blue" && !inserted.red) return; // red before blue
    setHolding(colour);
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      setHolding(null);
      setInserted((current) => ({ ...current, [colour]: true }));
      void audio.play("released");
      haptics.found();
    }, HOLD_MS);
  };

  const endHold = () => {
    setHolding(null);
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  return (
    <section className="keycard-screen" aria-labelledby="keycard-title">
      <header className="lock-screen__heading">
        <p className="eyebrow">KITCHEN DOOR // PAIRED READER</p>
        <h1 id="keycard-title">Both Halves</h1>
      </header>
      <p className="host-copy" aria-live="polite">
        {bothIn
          ? "The reader accepts the pair. Six lines of numbers, two colours, one door. The kitchen will see you now."
          : "Hold each card to its slot until the reader stops doubting you. Red first. The blue one sulks if it goes in alone."}
      </p>
      <div className="keycard-slots">
        {(["red", "blue"] as const).map((colour) => (
          <button
            key={colour}
            className="keycard-slot"
            data-colour={colour}
            data-inserted={inserted[colour]}
            data-holding={holding === colour}
            disabled={inserted[colour]}
            onPointerDown={() => beginHold(colour)}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            aria-label={`${colour} keycard slot`}
          >
            <i className="keycard-slot__mouth" aria-hidden="true" />
            <span className="keycard-slot__card" aria-hidden="true" />
            <strong>{colour.toUpperCase()}</strong>
            <small>
              {inserted[colour]
                ? "ACCEPTED"
                : holding === colour
                  ? "READING..."
                  : "HOLD CARD HERE"}
            </small>
          </button>
        ))}
      </div>
      <div className="interaction-actions">
        <button
          className="mechanical-button mechanical-button--primary"
          disabled={!bothIn}
          onClick={onSolved}
        >
          {bothIn ? "OPEN THE KITCHEN DOOR" : "THE READER IS WAITING"}
        </button>
        <button className="text-control" onClick={onCancel}>STEP AWAY</button>
      </div>
    </section>
  );
}

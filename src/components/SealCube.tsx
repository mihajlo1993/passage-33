"use client";

import { useEffect, useState } from "react";
import { useAudio } from "@/src/audio/useAudio";
import { useHaptics } from "@/src/device";

/**
 * The survey seal. The 3D stone above is the artifact; the surveyor's
 * diagram below is the mechanism. Two controls turn the stone in quarter
 * turns; the app tracks the faces exactly, so the puzzle can never
 * mis-detect. When the hall glyph (C) reaches heaven, the blank face may
 * be pressed and the core surfaces.
 */
export const SEAL_ORDER = ["BATHROOM", "KITCHEN", "BALCONY", "CORRIDOR"] as const;

interface FacePlacement {
  up: string;
  north: string;
  east: string;
  south: string;
  west: string;
  down: string;
}

const START: FacePlacement = {
  up: "Y",
  north: "K",
  east: "B",
  south: "C",
  west: "L",
  down: "·",
};

/** Tip the stone away from you: south face rises to heaven. */
function tilt(place: FacePlacement): FacePlacement {
  return {
    up: place.south,
    north: place.up,
    down: place.north,
    south: place.down,
    east: place.east,
    west: place.west,
  };
}

/** Spin the stone a quarter turn clockwise on the spot. */
function spin(place: FacePlacement): FacePlacement {
  return {
    up: place.up,
    down: place.down,
    north: place.west,
    east: place.north,
    south: place.east,
    west: place.south,
  };
}

const FACE_NAMES: Record<string, string> = {
  C: "the hall",
  B: "the bath",
  K: "the kitchen",
  L: "the parlour",
  Y: "the balcony",
  "·": "the blank",
};

const HINT_DELAY_MS = 30_000;

export interface SealCubeProps {
  onSolved: () => void;
  onCancel: () => void;
}

export function SealCube({ onSolved, onCancel }: SealCubeProps) {
  const [place, setPlace] = useState<FacePlacement>(START);
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(false);
  const audio = useAudio();
  const haptics = useHaptics();

  useEffect(() => {
    const timer = window.setTimeout(() => setHint(true), HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const aligned = place.up === "C";

  const turn = (turner: (p: FacePlacement) => FacePlacement) => {
    if (open) return;
    void audio.play("dial-tick");
    setPlace((current) => turner(current));
  };

  const press = () => {
    if (!aligned || open) return;
    setOpen(true);
    void audio.play("released");
    haptics.contact();
  };

  return (
    <section className="seal-cube" aria-labelledby="seal-title">
      <header className="lock-screen__heading">
        <p className="eyebrow">Survey seal, Cadastral Division</p>
        <h1 id="seal-title">The Seal</h1>
      </header>
      <p className="host-copy" aria-live="polite">
        {open
          ? "The core surfaces. Four rooms in the surveyor's order: bathroom, kitchen, balcony, corridor. The tiles obey this order and nothing else."
          : aligned
            ? "The stone is set. The hall is at heaven. Press the blank face."
            : hint
              ? "Turn the stone with the two controls. Heaven is the top of the diagram. The hall wears the letter C."
              : "The surveyor sets his stone with the hall at heaven. Turn it until it agrees."}
      </p>

      <div className="seal-cube__stage" data-open={open}>
        <model-viewer
          className="seal-cube__viewer"
          src="/models/sealcube.glb"
          alt="A bronze survey seal cube engraved with room glyphs"
          camera-controls
          disable-pan
          disable-tap
          touch-action="none"
          interaction-prompt="none"
          exposure="0.95"
          shadow-intensity="0.9"
          tone-mapping="aces"
          camera-orbit="0.8rad 1.35rad 110%"
        />
        {open && (
          <div className="seal-cube__core re-frame" role="img" aria-label="The seal core order">
            {SEAL_ORDER.map((room, index) => (
              <span key={room}>
                <small>{index + 1}</small>
                {room}
              </span>
            ))}
          </div>
        )}
      </div>

      {!open && (
        <div className="seal-net" aria-label="The surveyor's diagram">
          <div className="seal-net__cross">
            <span className="seal-net__cell seal-net__cell--north">{place.north}</span>
            <span className="seal-net__cell seal-net__cell--west">{place.west}</span>
            <span
              className="seal-net__cell seal-net__cell--up"
              data-aligned={aligned}
              aria-label={"At heaven: " + (FACE_NAMES[place.up] ?? place.up)}
            >
              {place.up}
            </span>
            <span className="seal-net__cell seal-net__cell--east">{place.east}</span>
            <span className="seal-net__cell seal-net__cell--south">{place.south}</span>
          </div>
          <div className="seal-net__controls">
            <button type="button" className="mechanical-button" onClick={() => turn(tilt)}>
              Tip the stone
            </button>
            <button type="button" className="mechanical-button" onClick={() => turn(spin)}>
              Spin the stone
            </button>
          </div>
        </div>
      )}

      <div className="interaction-actions">
        {open ? (
          <button className="mechanical-button mechanical-button--primary" onClick={onSolved}>
            Commit the order
          </button>
        ) : (
          <button
            className="mechanical-button mechanical-button--primary"
            disabled={!aligned}
            onClick={press}
          >
            {aligned ? "Press the blank face" : "The stone is not set"}
          </button>
        )}
        <button className="text-control" onClick={onCancel}>Step away</button>
      </div>
    </section>
  );
}

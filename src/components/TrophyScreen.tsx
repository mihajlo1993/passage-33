"use client";

import { MEDIA_ASSETS } from "@/src/media";
import type { GameState } from "@/src/types";

function elapsedLabel(startedAt: number, finishedAt: number): string {
  const totalSeconds = Math.max(0, Math.floor((finishedAt - startedAt) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export interface TrophyScreenProps {
  state: GameState;
  navigate: (path: string) => void;
}

export function TrophyScreen({ state, navigate }: TrophyScreenProps) {
  const { finishedAt } = state;
  const won = finishedAt !== null;
  const fullCircle = state.resolvedPins.includes(27);
  const trophy = MEDIA_ASSETS.trophy;

  if (!won) {
    return (
      <section className="screen trophy-locked" aria-labelledby="trophy-title">
        <p className="eyebrow">THE ALTAR</p>
        <h1 id="trophy-title">NOT YET.</h1>
        <p className="host-copy">I did bake the ending. You still have to carry the flame to it.</p>
        <button className="mechanical-button mechanical-button--primary" onClick={() => navigate("/scan")}>
          RETURN TO THE HUNT
        </button>
      </section>
    );
  }

  return (
    <section className="trophy-screen" aria-labelledby="trophy-title">
      <div className="trophy-image">
        {trophy.available ? (
          <picture>
            {trophy.webp && <source srcSet={trophy.webp.url} type="image/webp" />}
            <img
              src={trophy.png.url}
              width={trophy.width}
              height={trophy.height}
              alt="A dark birthday cake burning with thirty-three candles in the abandoned kitchen"
            />
          </picture>
        ) : (
          <img src="/og.png" width="1280" height="720" alt="A dark birthday cake burning with thirty-three candles in the abandoned kitchen" />
        )}
      </div>
      <div className="trophy-card">
        <p className="eyebrow">BIRTHDAY RECORD // 33</p>
        <h1 id="trophy-title">THIRTY-THREE CANDLES</h1>
        <p className="trophy-card__message">
          {fullCircle
            ? "THE HOUSE IS SATISFIED. THE HAND AND THE ALTAR ARE YOURS."
            : "THE WISH IS YOURS. THE LAST PRESENT IS BACK WHERE YOU WOKE."}
        </p>
        <dl className="trophy-stats">
          <div><dt>CONTACTS</dt><dd>{String(state.resolvedPins.length).padStart(2, "0")} / 27</dd></div>
          <div><dt>TIME IN HOUSE</dt><dd>{elapsedLabel(state.startedAt, finishedAt)}</dd></div>
        </dl>
        {!fullCircle ? (
          <button className="mechanical-button mechanical-button--primary mechanical-button--full" onClick={() => navigate("/scan")}>
            COMPLETE THE CIRCLE
          </button>
        ) : (
          <button className="mechanical-button mechanical-button--full" onClick={() => navigate("/inventory")}>
            EXAMINE YOUR TROPHIES
          </button>
        )}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { MEDIA_ASSETS } from "@/src/media";
import { useAudio } from "@/src/audio/useAudio";
import { areFinalPresentsResolved } from "@/src/game/engine";
import { TOTAL_PIN_COUNT } from "@/src/pins";
import { motion } from "@/src/tokens";
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
  const { trophyAt } = state;
  const trophyUnlocked = trophyAt !== null;
  const corridorPresentOpened = state.resolvedPins.includes(27);
  const kitchenPresentOpened = state.resolvedPins.includes(28);
  const finalPresentsOpened = areFinalPresentsResolved(state.resolvedPins);
  const [quiet, setQuiet] = useState(false);
  const trophy = MEDIA_ASSETS.trophy;
  const audio = useAudio();

  useEffect(() => {
    if (!finalPresentsOpened) {
      setQuiet(false);
      return;
    }

    setQuiet(false);
    const timer = window.setTimeout(() => {
      audio.ambient(null);
      audio.silence();
      setQuiet(true);
    }, motion.eventMs.saveTheatre);
    return () => window.clearTimeout(timer);
  }, [audio, finalPresentsOpened]);

  if (!trophyUnlocked) {
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

  if (finalPresentsOpened && quiet) {
    return <section className="trophy-screen trophy-screen--quiet" aria-label="The house is quiet" />;
  }

  if (finalPresentsOpened) {
    return (
      <section className="screen trophy-locked" aria-labelledby="trophy-title">
        <p className="eyebrow">ALL PRESENTS OPENED</p>
        <h1 id="trophy-title">THAT IS EVERYTHING.</h1>
        <p className="host-copy">Both boxes are open. Good. That is everything. Happy birthday.</p>
      </section>
    );
  }

  const remainingMessage = corridorPresentOpened
    ? "THE CORRIDOR GIFT IS YOURS. THE SEALED PRESENT IS STILL IN THE KITCHEN."
    : kitchenPresentOpened
      ? "THE KITCHEN PRESENT IS YOURS. THE CORRIDOR BOX IS WHERE YOU WOKE."
      : "TWO PRESENTS REMAIN. ONE IS WHERE YOU WOKE. ONE IS HERE IN THE KITCHEN.";
  const actionLabel = corridorPresentOpened
    ? "OPEN THE KITCHEN PRESENT"
    : kitchenPresentOpened
      ? "RETURN TO THE CORRIDOR"
      : "OPEN THE LAST PRESENTS";

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
        <p className="trophy-card__message">{remainingMessage}</p>
        <dl className="trophy-stats">
          <div><dt>CONTACTS</dt><dd>{String(state.resolvedPins.length).padStart(2, "0")} / {TOTAL_PIN_COUNT}</dd></div>
          <div><dt>TIME TO CANDLES</dt><dd>{elapsedLabel(state.startedAt, trophyAt)}</dd></div>
        </dl>
        <button className="mechanical-button mechanical-button--primary mechanical-button--full" onClick={() => navigate("/scan")}>
          {actionLabel}
        </button>
      </div>
    </section>
  );
}

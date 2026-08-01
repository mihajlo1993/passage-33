"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ENDING_MUSIC_PATH } from "@/src/audio/manifest";
import { CINEMA_FILM_PATH, CINEMA_POSTER_PATH } from "@/src/cinema";
import { useAudio } from "@/src/audio/useAudio";
import { areFinalPresentsResolved } from "@/src/game/engine";
import { FRAGMENTS, LETTER_CODA } from "@/src/pins";
import {
  playKeeper, stopKeeper, unlockKeeper, type KeeperPlaybackResult,
} from "@/src/audio/keeper";
import type { GameState } from "@/src/types";

/** Duration of the recorded reading in keeper-lock4.mp3 (ffprobe, ms). */
const LETTER_READ_MS = 93_600;

interface LetterParagraph {
  readonly coda: boolean;
  readonly words: readonly string[];
}

/**
 * The whole letter, read aloud word by word. The four quarters arrive as one
 * formal block; the coda beneath the signature arrives plainly, because that
 * is where the mask comes off. Words pace evenly across the recording. The
 * screen follows the voice unless she takes over the scroll herself, and
 * nothing ends until she chooses to put the letter down.
 */
function LetterReading({
  onFinished,
  startedAt,
}: {
  onFinished: () => void;
  startedAt: number | null;
}) {
  const paragraphs = useMemo<LetterParagraph[]>(
    () => [
      { coda: false, words: FRAGMENTS.join(" ").split(" ") },
      ...LETTER_CODA.map((paragraph) => ({ coda: true, words: paragraph.split(" ") })),
    ],
    [],
  );
  const totalWords = useMemo(
    () => paragraphs.reduce((sum, paragraph) => sum + paragraph.words.length, 0),
    [paragraphs],
  );

  const [revealed, setRevealed] = useState(0);
  const followRef = useRef(true);
  const finishedRef = useRef(false);
  const frontierRef = useRef<HTMLSpanElement | null>(null);
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    if (startedAt === null) return;
    finishedRef.current = false;

    setRevealed(0);
    let timer: number | null = null;
    let finishTimer: number | null = null;
    const revealNextWords = () => {
      const elapsed = performance.now() - startedAt;
      const count = Math.max(
        0,
        Math.min(totalWords, Math.ceil((elapsed / LETTER_READ_MS) * totalWords)),
      );
      setRevealed(count);
      if (followRef.current) {
        frontierRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      if (count >= totalWords && !finishedRef.current) {
        finishedRef.current = true;
        if (timer !== null) window.clearInterval(timer);
        finishTimer = window.setTimeout(() => {
          onFinishedRef.current();
        }, 600);
      }
    };

    revealNextWords();
    if (!finishedRef.current) {
      timer = window.setInterval(revealNextWords, 240);
    }
    return () => {
      if (timer !== null) window.clearInterval(timer);
      if (finishTimer !== null) window.clearTimeout(finishTimer);
    };
  }, [startedAt, totalWords]);

  // Her scroll wins over the voice's scroll, permanently and silently.
  const takeOver = () => {
    followRef.current = false;
  };

  let wordIndex = 0;
  return (
    <div
      className="letter-reading"
      onWheel={takeOver}
      onTouchMove={takeOver}
      aria-label="The Keeper's letter, read aloud"
    >
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p
          key={paragraphIndex}
          className={"letter-paragraph" + (paragraph.coda ? " letter-paragraph--coda" : "")}
        >
          {paragraph.words.map((word) => {
            const index = wordIndex;
            wordIndex += 1;
            const shown = index < revealed;
            return (
              <span
                key={index}
                ref={
                  index === Math.max(0, Math.min(revealed - 1, totalWords - 1))
                    ? frontierRef
                    : undefined
                }
                className={"letter-word" + (shown ? " is-read" : "")}
                aria-hidden={!shown}
              >
                {word}{" "}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}

/**
 * The silent film beneath the reading: full-bleed, muted, playsinline, cut
 * to the narration's exact length. The narration clock is the master. If
 * the film ends early it HOLDS its final frame (the candle shot); if it
 * fails it fades to the poster and the letter never stops. Under
 * prefers-reduced-motion the poster stands in for the film entirely.
 */
function FinaleFilm({ playing }: { playing: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reducedMotion = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [mode, setMode] = useState<"film" | "poster">(reducedMotion ? "poster" : "film");

  useEffect(() => {
    if (mode !== "film" || !playing) return;
    // Muted playback is gesture-exempt; the arrival tap started us anyway.
    void videoRef.current?.play().catch(() => setMode("poster"));
  }, [mode, playing]);

  if (mode === "poster") {
    return (
      <div className="finale-film" aria-hidden="true">
        <img className="finale-film__poster" src={CINEMA_POSTER_PATH} alt="" />
      </div>
    );
  }

  return (
    <div className="finale-film" aria-hidden="true">
      <video
        ref={videoRef}
        className="finale-film__video"
        src={CINEMA_FILM_PATH}
        poster={CINEMA_POSTER_PATH}
        muted
        playsInline
        autoPlay
        preload="auto"
        onError={() => setMode("poster")}
      />
    </div>
  );
}

export interface TrophyScreenProps {
  state: GameState;
  navigate: (path: string) => void;
}

export function TrophyScreen({ state, navigate }: TrophyScreenProps) {
  const { trophyAt } = state;
  const trophyUnlocked = trophyAt !== null;
  const finalPresentsOpened = areFinalPresentsResolved(state.resolvedPins);
  const [quiet, setQuiet] = useState(false);
  const [letterDone, setLetterDone] = useState(false);
  const [voiceState, setVoiceState] =
    useState<"starting" | "playing" | "blocked">("starting");
  const [voiceStartedAt, setVoiceStartedAt] = useState<number | null>(null);
  const audio = useAudio();
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const voiceAttemptRef = useRef(0);

  const startKeeperReading = useCallback((restart: boolean) => {
    const attemptId = voiceAttemptRef.current + 1;
    voiceAttemptRef.current = attemptId;
    setVoiceState("starting");
    void playKeeper("lock4", { restart }).then((result: KeeperPlaybackResult) => {
      if (attemptId !== voiceAttemptRef.current) return;
      if (!result.started || result.startedAt === null) {
        setVoiceState("blocked");
        return;
      }
      setVoiceStartedAt(result.startedAt);
      setVoiceState("playing");
    });
  }, []);

  useEffect(() => {
    if (!finalPresentsOpened) return;
    startKeeperReading(false);
    return () => {
      voiceAttemptRef.current += 1;
      stopKeeper();
    };
  }, [finalPresentsOpened, startKeeperReading]);

  // The mask-off piece: a dusty music box that starts as the letter settles
  // and keeps the room warm through the reading. Local file, looped. It
  // sits UNDER the narration: quiet enough that every word stays clear.
  useEffect(() => {
    if (!trophyUnlocked || typeof window === "undefined") return;
    const element = new window.Audio(ENDING_MUSIC_PATH);
    element.loop = true;
    element.volume = 0.38;
    musicRef.current = element;
    const start = () => void element.play().catch(() => undefined);
    const timer = window.setTimeout(start, 2_400);
    window.addEventListener("pointerdown", start, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", start);
      element.pause();
      element.removeAttribute("src");
      musicRef.current = null;
    };
  }, [trophyUnlocked]);

  // The house goes quiet only when SHE puts the letter down; an early
  // timer here once stole the letter two seconds in. Never again.
  const putTheLetterDown = () => {
    audio.ambient(null);
    musicRef.current?.pause();
    stopKeeper();
    setQuiet(true);
  };

  if (!trophyUnlocked) {
    return (
      <section className="screen trophy-locked" aria-labelledby="trophy-title">
        <p className="eyebrow">The locks</p>
        <h1 id="trophy-title">Still holding.</h1>
        <p className="host-copy">Locks remain. The Keeper opens nothing out of order.</p>
        <button className="mechanical-button mechanical-button--primary" onClick={() => navigate("/")}>
          RETURN TO THE LEDGER
        </button>
      </section>
    );
  }

  if (finalPresentsOpened && quiet) {
    return <section className="trophy-screen trophy-screen--quiet" aria-label="The house is quiet" />;
  }

  if (finalPresentsOpened) {
    return (
      <section className="letter-screen letter-screen--film" aria-label="The letter, read over the film">
        <FinaleFilm playing={voiceState === "playing"} />
        <p className="letter-screen__mark eyebrow">Thirty-three years to the night</p>
        <div className="letter-band" data-done={letterDone}>
          <div className="letter-band__scrim" aria-hidden="true" />
          <LetterReading
            startedAt={voiceStartedAt}
            onFinished={() => setLetterDone(true)}
          />
        </div>
        {voiceState === "blocked" && (
          <div className="letter-audio-fallback" role="status">
            <p className="eyebrow">The Keeper is waiting for your hand.</p>
            <button
              className="mechanical-button mechanical-button--primary"
              onClick={() => {
                unlockKeeper();
                startKeeperReading(true);
              }}
            >
              READ THE LETTER ALOUD
            </button>
          </div>
        )}
        <div className={"letter-finale" + (letterDone ? " is-lit" : "")} aria-hidden={!letterDone}>
          <div className="candles" aria-label="Thirty-three candles">
            {Array.from({ length: 33 }, (_, index) => (
              <i key={index} className="candle-flame-css" style={{ animationDelay: `${(index * 37) % 1200}ms` }} />
            ))}
          </div>
          <h2 className="hbd-line">Happy birthday, Melissa.</h2>
          <p className="microcopy">The watch has ended. Miha has you now.</p>
          <button className="text-control" onClick={putTheLetterDown}>
            Put the letter down
          </button>
        </div>
      </section>
    );
  }

  // In this game the trophy IS the letter: pin 9 is the only final present,
  // so an unlocked trophy always has the letter open. This state is a guard.
  return (
    <section className="screen trophy-locked" aria-labelledby="trophy-title">
      <p className="eyebrow">The locks</p>
      <h1 id="trophy-title">The letter is close.</h1>
      <p className="host-copy">The last lock is open. Bring the gift back, and the Keeper will read.</p>
      <button className="mechanical-button mechanical-button--primary" onClick={() => navigate("/")}>
        RETURN TO THE LEDGER
      </button>
    </section>
  );
}

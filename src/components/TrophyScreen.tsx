"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MEDIA_ASSETS } from "@/src/media";
import { ENDING_MUSIC_PATH } from "@/src/audio/manifest";
import { useAudio } from "@/src/audio/useAudio";
import { areFinalPresentsResolved } from "@/src/game/engine";
import { FRAGMENTS, LETTER_CODA, TOTAL_PIN_COUNT } from "@/src/pins";
import {
  playKeeper, stopKeeper, unlockKeeper, type KeeperPlaybackResult,
} from "@/src/audio/keeper";
import type { GameState } from "@/src/types";

/** Duration of the recorded reading in keeper-lock4.mp3 (ffprobe, ms). */
const LETTER_READ_MS = 93_600;

const VERDICT_FRONT = ["S", "E", "A", "L", "E", "D"] as const;
const VERDICT_BACK = ["Y", "O", "U", "R", "S", "."] as const;
const VERDICT_FLIP_DELAY_MS = 1_400;

/**
 * The previous guest's padlock, one last time. It holds his verdict just long
 * enough to be read, then turns over a letter at a time into hers.
 */
function PadlockVerdict() {
  const [flipped, setFlipped] = useState(false);
  const audio = useAudio();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFlipped(true);
      void audio.play("released");
    }, VERDICT_FLIP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [audio]);

  return (
    <div
      className="padlock-verdict"
      role="img"
      aria-label={flipped ? "The file is yours" : "The file is sealed"}
    >
      {VERDICT_BACK.map((back, index) => (
        <span
          key={index}
          className="verdict-tile"
          data-flipped={flipped}
          style={{ transitionDelay: `${index * 130}ms` }}
        >
          <i className="verdict-tile__face verdict-tile__face--front">
            {VERDICT_FRONT[index]}
          </i>
          <i className="verdict-tile__face verdict-tile__face--back">{back}</i>
        </span>
      ))}
    </div>
  );
}

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
  const [letterDone, setLetterDone] = useState(false);
  const [voiceState, setVoiceState] =
    useState<"starting" | "playing" | "blocked">("starting");
  const [voiceStartedAt, setVoiceStartedAt] = useState<number | null>(null);
  const trophy = MEDIA_ASSETS.trophy;
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

  // The mask-off piece: a dusty music box that starts as WINNER settles and
  // keeps the room warm through the letter. Local file, precached, looped.
  useEffect(() => {
    if (!trophyUnlocked || typeof window === "undefined") return;
    const element = new window.Audio(ENDING_MUSIC_PATH);
    element.loop = true;
    element.volume = 0.5;
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
      <section className="screen letter-screen" aria-labelledby="trophy-title">
        <header className="letter-screen__heading">
          <p className="eyebrow">Thirty-three years to the night</p>
          <h1 id="trophy-title">The letter, whole</h1>
        </header>
        <div className="letter-document">
          <blockquote className="letter-whole re-frame">
            <LetterReading
              startedAt={voiceStartedAt}
              onFinished={() => setLetterDone(true)}
            />
          </blockquote>
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
        </div>
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
        {trophy.webp && (
          <img
            src={trophy.webp.url}
            width={trophy.width}
            height={trophy.height}
            alt="A dark birthday cake burning with thirty-three candles in the abandoned kitchen"
          />
        )}
      </div>
      <div className="trophy-card">
        <PadlockVerdict />
        <p className="eyebrow">Record of trust, year 33</p>
        <h1 id="trophy-title">Four Locks Open</h1>
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

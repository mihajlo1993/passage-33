"use client";

/**
 * The Keeper's voice: plain HTMLAudio, outside the engine graph, so a clip
 * can never be blocked by engine state. Begin primes the local elements, and
 * later gesture-bound calls can report whether playback actually started.
 */
const CLIPS = {
  intro: "/audio/keeper/keeper-intro.mp3",
  lock1: "/audio/keeper/keeper-lock1.mp3",
  lock2: "/audio/keeper/keeper-lock2.mp3",
  lock3: "/audio/keeper/keeper-lock3.mp3",
  lock4: "/audio/keeper/keeper-lock4.mp3",
  dark: "/audio/keeper/keeper-dark.mp3",
  refuse: "/audio/keeper/keeper-refuse.mp3",
} as const;

export type KeeperClipId = keyof typeof CLIPS;

export interface KeeperPlaybackResult {
  readonly started: boolean;
  readonly startedAt: number | null;
}

export interface KeeperPlayOptions {
  readonly restart?: boolean;
}

const BLOCKED_PLAYBACK: KeeperPlaybackResult = {
  started: false,
  startedAt: null,
};

const players = new Map<KeeperClipId, HTMLAudioElement>();
let unlocked = false;
let activeId: KeeperClipId | null = null;
let activeStartedAt: number | null = null;
let activeAttempt: Promise<KeeperPlaybackResult> | null = null;

function ensurePlayers(): void {
  if (players.size > 0 || typeof window === "undefined") return;
  for (const [id, src] of Object.entries(CLIPS) as [KeeperClipId, string][]) {
    const element = new window.Audio(src);
    element.preload = "auto";
    players.set(id, element);
  }
}

function playbackClock(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

/** Call from Begin so later local voice clips are ready to play. */
export function unlockKeeper(): void {
  if (unlocked) return;
  ensurePlayers();
  unlocked = true;
  for (const [id, element] of players) {
    try {
      element.muted = true;
      const attempt = element.play();
      void Promise.resolve(attempt).then(
        () => {
          if (activeId === id) return;
          element.pause();
          element.currentTime = 0;
          element.muted = false;
        },
        () => {
          if (activeId !== id) element.muted = false;
        },
      );
    } catch {
      if (activeId !== id) element.muted = false;
    }
  }
}

/**
 * Start a local Keeper clip and report whether the browser accepted it.
 * Passing restart false reuses an already-running clip, preserving its clock.
 */
export function playKeeper(
  id: KeeperClipId,
  options: KeeperPlayOptions = {},
): Promise<KeeperPlaybackResult> {
  if (!unlocked) return Promise.resolve(BLOCKED_PLAYBACK);
  ensurePlayers();
  const element = players.get(id);
  if (!element) return Promise.resolve(BLOCKED_PLAYBACK);

  if (options.restart === false && activeId === id) {
    if (activeAttempt) return activeAttempt;
    if (activeStartedAt !== null && !element.paused && !element.ended) {
      return Promise.resolve({ started: true, startedAt: activeStartedAt });
    }
  }

  stopKeeper();
  element.currentTime = 0;
  element.muted = false;
  activeId = id;
  activeStartedAt = null;

  try {
    const attempt = element.play();
    const confirmation = Promise.resolve(attempt).then<KeeperPlaybackResult, KeeperPlaybackResult>(
      () => {
        if (activeId !== id) return BLOCKED_PLAYBACK;
        const mediaElapsedMs = Number.isFinite(element.currentTime)
          ? Math.max(0, element.currentTime * 1_000)
          : 0;
        const startedAt = playbackClock() - mediaElapsedMs;
        activeStartedAt = startedAt;
        return { started: true, startedAt };
      },
      () => {
        if (activeId === id) {
          activeId = null;
          activeStartedAt = null;
          activeAttempt = null;
        }
        return BLOCKED_PLAYBACK;
      },
    );
    activeAttempt = confirmation;
    void confirmation.then(() => {
      if (activeAttempt === confirmation) activeAttempt = null;
    });
    return confirmation;
  } catch {
    activeId = null;
    activeStartedAt = null;
    activeAttempt = null;
    return Promise.resolve(BLOCKED_PLAYBACK);
  }
}

export function stopKeeper(): void {
  activeId = null;
  activeStartedAt = null;
  activeAttempt = null;
  for (const element of players.values()) {
    try {
      element.pause();
      element.currentTime = 0;
      element.muted = false;
    } catch {
      // The on-screen copy remains available if media teardown fails.
    }
  }
}

/** Every clip path, for anything that wants to preload or audit them. */
export const KEEPER_CLIP_PATHS = Object.values(CLIPS);

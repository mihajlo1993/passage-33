"use client";

/**
 * The Keeper's voice: plain HTMLAudio, outside the engine graph, so a clip
 * can never be blocked by engine state. One user gesture (Begin) blesses
 * every element; failures degrade silently because every line also exists
 * as on-screen text.
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

const players = new Map<KeeperClipId, HTMLAudioElement>();
let unlocked = false;

function ensurePlayers(): void {
  if (players.size > 0 || typeof window === "undefined") return;
  for (const [id, src] of Object.entries(CLIPS) as [KeeperClipId, string][]) {
    const element = new window.Audio(src);
    element.preload = "auto";
    players.set(id, element);
  }
}

/** Call from the Begin tap: blesses every element for later play(). */
export function unlockKeeper(): void {
  ensurePlayers();
  unlocked = true;
  for (const element of players.values()) {
    try {
      element.muted = true;
      const attempt = element.play();
      if (attempt?.then) {
        attempt
          .then(() => {
            element.pause();
            element.currentTime = 0;
            element.muted = false;
          })
          .catch(() => {
            element.muted = false;
          });
      }
    } catch {
      element.muted = false;
    }
  }
}

export function playKeeper(id: KeeperClipId): void {
  if (!unlocked) return;
  ensurePlayers();
  stopKeeper();
  const element = players.get(id);
  if (!element) return;
  try {
    element.currentTime = 0;
    void element.play().catch(() => undefined);
  } catch {
    // Voice is garnish; the text is always on screen.
  }
}

export function stopKeeper(): void {
  for (const element of players.values()) {
    try {
      element.pause();
      element.currentTime = 0;
    } catch {
      // fine
    }
  }
}

/** Every clip path, for anything that wants to preload or audit them. */
export const KEEPER_CLIP_PATHS = Object.values(CLIPS);

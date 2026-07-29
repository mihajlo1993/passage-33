import type { VoiceId } from "./types";

export const VOICE_CUES_BY_PIN: Readonly<Partial<Record<number, VoiceId>>> = {
  1: "cold-open",
  12: "tape",
  23: "draught",
  26: "trophy",
  28: "present",
};

export const PLAYED_VOICE_STORAGE_KEY = "bh7-audio-played-voices-v1";
export const TAPE_PLACEHOLDER_DURATION_SECONDS = 75;

/**
 * PROVISIONAL: seven image starts distributed against the 75-second silent
 * placeholder. Re-time these against the final performed MP3 waveform.
 */
export const TAPE_IMAGE_CUE_SECONDS = [0, 10.5, 21.5, 32, 43.5, 55, 66.5] as const;

export function readPlayedVoiceIds(storage: Pick<Storage, "getItem">): Set<VoiceId> {
  try {
    const raw = storage.getItem(PLAYED_VOICE_STORAGE_KEY);
    if (raw === null) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

export function writePlayedVoiceIds(
  storage: Pick<Storage, "setItem">,
  played: ReadonlySet<VoiceId>,
): void {
  try {
    storage.setItem(PLAYED_VOICE_STORAGE_KEY, JSON.stringify([...played].sort()));
  } catch {
    // Storage can be denied; the in-memory guard still prevents repeats now.
  }
}

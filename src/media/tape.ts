import { effects, motion } from "../tokens";
import type { MediaAssetId } from "./assets";

export interface TapeStill {
  readonly id: number;
  readonly assetId: MediaAssetId;
  readonly durationMs: number;
  readonly narration: readonly [string, string?];
  readonly alt: string;
}

export const TAPE_STILLS: readonly TapeStill[] = [
  {
    id: 1,
    assetId: "tape01",
    durationMs: motion.tape.stillDurationsMs[0],
    narration: ["A cake for one.", "He never understood why the candle stayed cold."],
    alt: "An old birthday cake with one unlit candle on a bare table",
  },
  {
    id: 2,
    assetId: "tape02",
    durationMs: motion.tape.stillDurationsMs[1],
    narration: ["He sat where I told him.", "Good guests are wonderfully predictable."],
    alt: "An empty wooden dining chair facing away in a dim room",
  },
  {
    id: 3,
    assetId: "tape03",
    durationMs: motion.tape.stillDurationsMs[2],
    narration: ["The door was open before he arrived.", "I congratulated him anyway."],
    alt: "A doorway into a darker room with empty space at the left edge",
  },
  {
    id: 4,
    assetId: "tape04",
    durationMs: motion.tape.stillDurationsMs[3],
    narration: ["He reached in eventually.", "Birthdays make brave people of us all."],
    alt: "A hand and forearm reaching into broken plaster",
  },
  {
    id: 5,
    assetId: "tape05",
    durationMs: motion.tape.stillDurationsMs[4],
    narration: ["I filled the hall for him.", "He said there was no room to celebrate."],
    alt: "A narrow hallway packed tightly with party balloons",
  },
  {
    id: 6,
    assetId: "tape06",
    durationMs: motion.tape.stillDurationsMs[5],
    narration: ["Then he met the entertainment.", "It had been waiting very still."],
    alt: "A cracked mannequin clown offering an unlit candle",
  },
  {
    id: 7,
    assetId: "tape07",
    durationMs: motion.tape.stillDurationsMs[6],
    narration: ["There.", "Even he left you one useful birthday present."],
    alt: "A tarnished five-dial letter lock set to LOSER",
  },
] as const;

export const TAPE_FINAL_STILL_INDEX = TAPE_STILLS.length - 1;

export type TapePlaybackPhase = "playing" | "blackout" | "complete";

export interface TapePlaybackState {
  readonly phase: TapePlaybackPhase;
  readonly stillIndex: number;
}

export type TapePlaybackEvent = "timer" | "user-skip" | "operator-skip";

export function createTapePlaybackState(): TapePlaybackState {
  return { phase: "playing", stillIndex: 0 };
}

export function canUserSkipTape(state: TapePlaybackState): boolean {
  return state.phase === "playing"
    && state.stillIndex >= 3
    && state.stillIndex < TAPE_FINAL_STILL_INDEX;
}

export function transitionTapePlayback(
  state: TapePlaybackState,
  event: TapePlaybackEvent,
): TapePlaybackState {
  if (state.phase === "complete") return state;

  if (event === "user-skip") {
    return canUserSkipTape(state)
      ? { phase: "playing", stillIndex: TAPE_FINAL_STILL_INDEX }
      : state;
  }

  if (event === "operator-skip") {
    return state.phase === "playing"
      ? { phase: "playing", stillIndex: TAPE_FINAL_STILL_INDEX }
      : state;
  }

  if (state.phase === "blackout") {
    return { phase: "complete", stillIndex: TAPE_FINAL_STILL_INDEX };
  }
  if (state.stillIndex >= TAPE_FINAL_STILL_INDEX) {
    return { phase: "blackout", stillIndex: TAPE_FINAL_STILL_INDEX };
  }
  return { phase: "playing", stillIndex: state.stillIndex + 1 };
}

export function tapeStateDurationMs(state: TapePlaybackState): number | null {
  if (state.phase === "complete") return null;
  if (state.phase === "blackout") return motion.tape.blackoutMs;
  return TAPE_STILLS[state.stillIndex]?.durationMs ?? null;
}

export function formatTapeTimecode(elapsedMs: number): string {
  const safeMilliseconds = Math.max(0, Math.floor(elapsedMs));
  const totalSeconds = Math.floor(safeMilliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const frames = Math.floor(
    (safeMilliseconds % 1000) * effects.tape.timecodeFps / 1000,
  );
  return [hours, minutes, seconds, frames]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

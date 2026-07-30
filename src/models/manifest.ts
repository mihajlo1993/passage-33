import type { ItemId } from "../types";

/**
 * A detail hidden on the model that only reveals itself when she physically
 * turns the object over on screen, exactly like the taped lockpick in the
 * source material. Purely atmospheric; never gates progress.
 */
export interface ModelSecret {
  /** Shown while unrevealed, as a nudge to keep rotating. */
  readonly hint: string;
  /** Shown once the detail has genuinely been looked at. */
  readonly revealText: string;
  /**
   * Where the detail lives: 'under' needs the object rolled over; 'edge'
   * needs an edge-on grazing view. Both need a real zoom-in: the detail
   * only gives itself up close, never from across the bench.
   */
  readonly view?: "under" | "edge";
}

export interface ItemModel {
  readonly src: string;
  readonly alt: string;
  readonly secret?: ModelSecret;
}

/**
 * Items with a 3D examine model. Files live in /public/models and are listed
 * in /public/models/manifest.json with author and license records; the
 * CREDITS.md at the repo root carries the CC-BY attributions.
 *
 * A missing or failed file degrades to the classic icon examine panel, so
 * this table is safe to extend before the model lands on disk.
 */
export const modelByItem: Readonly<Partial<Record<ItemId, ItemModel>>> = {
  sealArtifact: {
    src: "/models/witnessField.glb",
    alt: "The first witness: a bronze field with the runner resting on it",
    secret: {
      hint: "THE UNDERSIDE IS MARKED",
      revealText:
        "Thirty-three ticks around the rim, one for every year it waited. A single notch: the first lock.",
    },
  },
  jarArtifact: {
    src: "/models/witnessRunner.glb",
    alt: "The second witness: the runner cast in bronze, tail and all",
    secret: {
      hint: "THE UNDERSIDE IS MARKED",
      revealText:
        "Thirty-three ticks, two notches. The Keeper catalogued it kindly: one tail, no bones, no bad intentions.",
    },
  },
  reliquaryArtifact: {
    src: "/models/witnessWager.glb",
    alt: "The third witness: an obelisk wearing three numbers",
    secret: {
      hint: "THE UNDERSIDE IS MARKED",
      revealText:
        "Thirty-three ticks, three notches. The sum was never the treasure; the thirty-three chances are.",
    },
  },
  candleArtifact: {
    src: "/models/witnessSparkle.glb",
    alt: "The last witness: the sparkle, breathing out stars",
    secret: {
      hint: "THE UNDERSIDE IS MARKED",
      revealText:
        "Thirty-three ticks, four notches. Held in trust from the night she was born. Signed, the Keeper.",
    },
  },
} as const;

export function getItemModel(itemId: ItemId): ItemModel | undefined {
  return modelByItem[itemId];
}

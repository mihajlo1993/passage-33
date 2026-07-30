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
    src: "/models/sealcube.glb",
    alt: "The Keeper's bronze seal",
  },
  jarArtifact: {
    src: "/models/jar.glb",
    alt: "The Keeper's specimen jar",
  },
  reliquaryArtifact: {
    src: "/models/reliquary.glb",
    alt: "The Keeper's reliquary",
    secret: {
      hint: "THE LID IS ENGRAVED",
      revealText: "Held in trust. Thirty-three years. Signed, the Keeper.",
    },
  },
  candleArtifact: {
    src: "/models/candleLit.glb",
    alt: "The Keeper's candle",
  },
} as const;

export function getItemModel(itemId: ItemId): ItemModel | undefined {
  return modelByItem[itemId];
}

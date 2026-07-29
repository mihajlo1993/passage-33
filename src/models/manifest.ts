import type { ItemId } from "../types";

/**
 * A detail hidden on the model that only reveals itself when she physically
 * turns the object over on screen, exactly like the taped lockpick in the
 * source material. Purely atmospheric; never gates progress.
 */
export interface ModelSecret {
  /** Shown while unrevealed, as a nudge to keep rotating. */
  readonly hint: string;
  /** Shown once the underside has been held in view. */
  readonly revealText: string;
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
  knife: {
    src: "/models/knife.glb",
    alt: "A kitchen knife with a worn handle",
    secret: {
      hint: "SOMETHING IS SCRATCHED NEAR THE HANDLE",
      revealText:
        "Two letters are scratched into the flat of the blade, small and close together: M + M. The scratches are old.",
    },
  },
  chemFluid: {
    src: "/models/chemFluid.glb",
    alt: "A stoppered chemistry flask of cloudy fluid",
    secret: {
      hint: "THE BASE CARRIES A MARK",
      revealText:
        "A glyph is scratched into the glass base. You have seen the same mark on a damp little card. The Host checks his own work.",
    },
  },
  tape: {
    src: "/models/tape.glb",
    alt: "A VHS cassette with LOSER on the label",
    secret: {
      hint: "THE SPINE HAS A SECOND LABEL",
      revealText:
        "A second label hides on the underside, written smaller, in a gentler hand: PLEASE WATCH TO THE END.",
    },
  },
  pistol: {
    src: "/models/pistol.glb",
    alt: "An old, oiled handgun",
  },
  herb: {
    src: "/models/herb.glb",
    alt: "A green herb growing in a small pot",
  },
  valve: {
    src: "/models/valve.glb",
    alt: "A heavy valve wheel",
  },
  candleLit: {
    src: "/models/candleLit.glb",
    alt: "A single candle",
  },
  firstAid: {
    src: "/models/chemFluid.glb",
    alt: "A mixed medicinal draught",
  },
} as const;

export function getItemModel(itemId: ItemId): ItemModel | undefined {
  return modelByItem[itemId];
}

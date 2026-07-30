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
  keycard: {
    src: "/models/keycard3d.glb",
    alt: "A laminated Cadastral Division clearance card",
    secret: {
      hint: "THE EDGE CARRIES SOMETHING RAISED",
      revealText:
        "Embossed along the rim, felt before seen: 1 9 9 3. The year the survey began.",
      view: "edge",
    },
  },
  specimenJar: {
    src: "/models/jar.glb",
    alt: "A sealed specimen jar holding a bent wire cast",
    secret: {
      hint: "A TAG HANGS ON THE UNDERSIDE",
      revealText:
        "The tag, in the surveyor's hand: CAST AT FLOOR HEIGHT. THREE ARMS SPEAK. THE SHORTEST SPEAKS FIRST.",
    },
  },
  reliquary: {
    src: "/models/reliquary.glb",
    alt: "A small reliquary box with five slots and a notched rim",
    secret: {
      hint: "THE LID IS ENGRAVED",
      revealText:
        "FIVE WOUNDS, TWO STARS. THE HOUSE KEEPS THE COUNT. Beneath, smaller: IT HAS ALWAYS KEPT IT.",
    },
  },
  fieldRecording: {
    src: "/models/tape.glb",
    alt: "The recovered field recording",
  },
  giftMouse: {
    src: "/models/creature.glb",
    alt: "Entry 033, as catalogued",
  },
} as const;

export function getItemModel(itemId: ItemId): ItemModel | undefined {
  return modelByItem[itemId];
}

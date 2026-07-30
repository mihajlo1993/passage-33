import type { Item, ItemId } from './types';

export const itemIds = {
  keycard: 'keycard',
  sealCore: 'sealCore',
  development01: 'development01',
  giftMat: 'giftMat',
  specimenJar: 'specimenJar',
  fieldRecording: 'fieldRecording',
  giftMouse: 'giftMouse',
  reliquary: 'reliquary',
  sixLines: 'sixLines',
  giftSlips: 'giftSlips',
  coatTags: 'coatTags',
  filmReel: 'filmReel',
  development02: 'development02',
  carbonator: 'carbonator',
  file01: 'file01',
  file02: 'file02',
  file03: 'file03',
  file04: 'file04',
} as const satisfies Record<string, ItemId>;

/**
 * Everything the terminal takes into custody. Descriptions are survey
 * entries: dry, procedural, and quietly wrong. `thumb` names a generated
 * media asset (Tier 2 renders); the icon slug is the offline fallback.
 */
export const items: readonly Item[] = [
  {
    id: itemIds.keycard,
    name: 'Clearance card',
    icon: 'key-card',
    tint: 'bone',
    thumb: 'itemKeycard',
    examine:
      'Cadastral Division clearance, one bearer. The lamination has yellowed from the inside. The card number is embossed on the edge, felt more easily than seen.',
  },
  {
    id: itemIds.sealCore,
    name: 'Seal core',
    icon: 'combination-lock',
    tint: 'amber',
    thumb: 'itemSealcube',
    examine:
      'The inner core of the survey seal. Four room glyphs in a fixed order. The bronze is warm, which the Division asks you not to think about.',
  },
  {
    id: itemIds.development01,
    name: 'Development 01',
    icon: 'treasure-map',
    tint: 'bone',
    thumb: 'paperPhoto',
    examine:
      'A photograph developed backwards. A shelf of sixteen mouths, one of them holding its breath. Held to a mirror, it behaves.',
  },
  {
    id: itemIds.giftMat,
    name: 'A flat place',
    icon: 'star-altar',
    tint: 'bone',
    thumb: 'itemMat',
    examine:
      'Catalogued as A FLAT PLACE FOR A SMALL ANIMAL TO RUN. Rolled, tied, and released to the occupant. Property of the occupant now.',
  },
  {
    id: itemIds.specimenJar,
    name: 'Specimen jar',
    icon: 'chemical-drop',
    tint: 'bile',
    thumb: 'itemJar',
    examine:
      'Entry 033. A cast of three bent arms in preserving fluid. The label has been rewritten at least twice. The tag hides underneath.',
  },
  {
    id: itemIds.fieldRecording,
    name: 'Field recording',
    icon: 'vhs',
    tint: 'boneDim',
    thumb: 'itemRecording',
    examine:
      'A microcassette, catalogued the night Entry 033 was heard in the walls. The Division notes that the recording is clearest near doors.',
  },
  {
    id: itemIds.giftMouse,
    name: 'The small grey runner',
    icon: 'hand',
    tint: 'bone',
    thumb: 'itemMouse',
    examine:
      'Entry 035. The specimen was never caught; it was replaced. Fits under a palm. Clicks. Released to the occupant.',
  },
  {
    id: itemIds.reliquary,
    name: 'Reliquary',
    icon: 'locked-chest',
    tint: 'amber',
    thumb: 'itemReliquary',
    examine:
      'Five numbered slots, twelve notches at the rim. FIVE WOUNDS, TWO STARS. THE HOUSE KEEPS THE COUNT. It is lighter than it looks and colder than it should be.',
  },
  {
    id: itemIds.sixLines,
    name: 'The six lines',
    icon: 'secret-book',
    tint: 'bone',
    thumb: 'itemCensus',
    examine:
      'Six lines of numbers, five mains and two stars each, advancing by a rule the file never states. The Division called them a wager against the future. Transcribe them onto the slips.',
  },
  {
    id: itemIds.giftSlips,
    name: 'Two lucky slips',
    icon: 'key-card',
    tint: 'rust',
    thumb: 'itemSlips',
    examine:
      'One red, one blue, three lines each. The only new things in the file. Released to the occupant with the Division\'s compliments and, uncharacteristically, its hope.',
  },
  {
    id: itemIds.coatTags,
    name: 'Coat tags',
    icon: 'folded-paper',
    tint: 'boneDim',
    thumb: 'itemTag',
    examine:
      'Three manila tags, pinned to a coat that was not tagged yesterday. Arm: a seal glyph. Pocket: a mirrored date, incomplete. Hem: one film frame, stamped.',
  },
  {
    id: itemIds.filmReel,
    name: 'The reel',
    icon: 'vhs',
    tint: 'boneDim',
    thumb: 'itemFilm',
    examine:
      'Six frames, spliced tonight. The projector accepted them in one order only: the true one. The last frame is empty because the evening was still happening.',
  },
  {
    id: itemIds.development02,
    name: 'Development 02',
    icon: 'treasure-map',
    tint: 'bone',
    thumb: 'paperPhoto',
    examine:
      'The last photograph, developed the right way round. A bath. A drawn curtain. Behind the curtain, a machine for putting the sparkle into water.',
  },
  {
    id: itemIds.carbonator,
    name: 'The property',
    icon: 'soda-can',
    tint: 'bone',
    thumb: 'itemCarbonator',
    examine:
      'Entry 105. One machine for carbonating water, brushed steel, unused. Held in trust by the Division for thirty-three years. CLASSIFICATION: BIRTHDAY. Released to the occupant.',
  },
  {
    id: itemIds.file01,
    name: 'Survey file 01',
    icon: 'secret-book',
    tint: 'boneDim',
    thumb: 'paperMemo',
    examine:
      'FILE 01, OPENING REMARKS. The address presents as a two-bedroom flat. Initial count found six rooms, then six rooms, then six rooms. The surveyor has requested that the third count not be discussed.',
  },
  {
    id: itemIds.file02,
    name: 'Survey file 02',
    icon: 'secret-book',
    tint: 'boneDim',
    thumb: 'paperMemo',
    examine:
      'FILE 02, FURNISHINGS. Shelving unit, sixteen apertures, all measured identical. The surveyor notes that at night the apertures do not stay identical, and that he has stopped measuring after dark.',
  },
  {
    id: itemIds.file03,
    name: 'Survey file 03',
    icon: 'secret-book',
    tint: 'boneDim',
    thumb: 'paperMemo',
    examine:
      'FILE 03, ENTRY 033. Movement recorded at skirting level, corridor, 03:12. Small, grey, quick. The cast was taken on the fourth attempt. The first three casts came out shaped like something else.',
  },
  {
    id: itemIds.file04,
    name: 'Survey file 04',
    icon: 'secret-book',
    tint: 'boneDim',
    thumb: 'paperMemo',
    examine:
      'FILE 04, CLOSING REMARKS, UNFILED. The house counts back. It has been counting toward a date. The Division has decided to leave the file open and the building alone until the count completes. It completes on a birthday.',
  },
] as const;

export const itemById: Readonly<Partial<Record<ItemId, Item>>> =
  Object.fromEntries(items.map((item) => [item.id, item]));

export function getItemById(id: ItemId): Item | undefined {
  return itemById[id];
}

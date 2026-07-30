import { itemIds } from './items';
import type { ItemId, Pin } from './types';

/*
 * THE HOUSE KEEPS THE COUNT
 *
 * Before she lived here, the flat was catalogued. The Cadastral Division
 * surveyed every room, counted every slat and tile and blade, and recorded
 * one entry it could not classify: SPECIMEN 33, known only by its shadow.
 * The survey was never closed. Tonight the terminal reopens the file.
 *
 * Five chapters. Every gift is guarded by a signature puzzle. QR marks are
 * artifact pickups, never gates: scanning one lifts an object into the
 * terminal's custody, and the puzzles decide what happens next.
 */

/** SETUP CONSTANT: the admission code embossed on the clearance card edge. */
export const ADMISSION_CODE = '1993';

/** SETUP CONSTANT: the word the cadastral tiles spell when ordered and flipped. */
export const TILE_WORD = 'SALT';

/** SETUP CONSTANT: the three letters the shadow arms select on the plate. */
export const CAST_WORD = 'RAT';

/**
 * SETUP CONSTANTS: the census. Verify each count in the real flat before the
 * night and correct these numbers; the printed census card asks exactly these
 * five questions in this order. Every value must land between 1 and 50.
 */
export const CENSUS_ANSWERS = [7, 12, 14, 21, 19] as const;

/** SETUP CONSTANTS: the two star numbers framed by the crest windows (1-12). */
export const STAR_ANSWERS = [4, 9] as const;

/** The hidden rule of the six lines. Never printed, never spoken. */
export const LINE_STEP = 33;
export const STAR_STEP = 3;

/**
 * SETUP CONSTANT: the ring date, DDMMYY. The coat tag prints it MIRRORED with
 * the fifth digit missing; only one digit makes it a real date, and that digit
 * is hers. Default is the night itself.
 */
export const RING_CODE = '310726';

/** Which of the sixteen glyphs the arm tag points to via the seal orientation. */
export const TAG_GLYPH_INDEX = 7;

/** Kallax cell (1-16, counted from the left) hiding the rolled mat. */
export const MAT_CELL_INDEX = 6;

export interface DialPinConfig {
  readonly kind: 'numeric' | 'alpha';
  readonly value: string;
  readonly title: string;
  readonly hostText: string;
  readonly wrongText: string;
  /** Escalating help, one step per wrong attempt from the second on. */
  readonly hints: readonly string[];
}

export const dialConfigByPin: Readonly<Partial<Record<number, DialPinConfig>>> = {
  2: {
    kind: 'numeric',
    value: ADMISSION_CODE,
    title: 'Admission',
    hostText:
      'The clearance card carries its number on the edge, where numbers go when they are not for everyone. Hold the card against the light of the lens and read the rim.',
    wrongText:
      'Entry refused. The Division does not repeat itself. Read the edge again.',
    hints: [
      'Numbers hide on edges. Turn the card in the lens until the light grazes it.',
      'Four digits, embossed, not printed. The year the survey began.',
      'The survey began in 1993. Enter it.',
    ],
  },
  4: {
    kind: 'alpha',
    value: TILE_WORD,
    title: 'The Tile Word',
    hostText:
      'Four tiles were issued, one to a room. The seal fixed their order. Their frames fix their faces: square meets square, six meets six. When the tiles agree, their corners speak.',
    wrongText:
      'The tiles disagree with you. Look at the frames, not the pictures.',
    hints: [
      'Lay the tiles in the order the seal core showed. Physically. On the floor.',
      'Adjacent frames must match shape. Two of your tiles are lying face down.',
      'Read the small corner letters left to right once every frame agrees.',
    ],
  },
  7: {
    kind: 'alpha',
    value: CAST_WORD,
    title: 'The Cast',
    hostText:
      'The specimen speaks in shadow. Floor height, three arms, the shortest first. Read the wall, not the screen.',
    wrongText:
      'That is not what the wall says. Kill the lights and look again.',
    hints: [
      'Lights off. Caster on its floor mark. Torch flat on the cradle mark.',
      'Three of the eight letters are touched by shadow. Order by arm length, shortest first.',
      'The wall spells a small grey animal. Three letters.',
    ],
  },
  15: {
    kind: 'numeric',
    value: RING_CODE,
    title: 'The Ring',
    hostText:
      'Six wheels. The pocket tag gave you five figures, written the way mirrors write. One figure is missing. Only one number makes the date real.',
    wrongText:
      'That date never happened. One of them did.',
    hints: [
      'The tag reads correctly in the bathroom mirror. You have done this before.',
      'Five digits recovered, one hole. It is a date: day, month, year.',
      'The missing figure is the age the file was opened for.',
    ],
  },
};

/** Retired routes; kept as inert constants so older code paths stay typed. */
export const TAPE_PLAYBACK_PIN_ID = -1;
export const RELIGHT_ACTION_PIN_ID = -2;

export const TROPHY_PIN_ID = 19;
export const SEALED_PRESENT_PIN_ID = 19;
export const FINAL_PRESENT_PIN_IDS = [19] as const;

export const pins: readonly Pin[] = [
  // ---- CHAPTER 1: ADMISSION ----
  {
    id: 1,
    act: 1,
    zone: 'entry',
    name: 'The Clearance Card',
    requires: [],
    grants: [itemIds.keycard, itemIds.file01],
    kind: 'item',
    resolution: 'scan',
    objective:
      'A mark is fixed to the front door. Scan it. The Division left a card for whoever came next.',
    bodyText:
      'Entry 001. One laminated clearance card, Cadastral Division, issue date illegible. The bearer is advised that the survey of this address was opened and never closed. Examine the card. Edges first. The Division always kept its numbers on the edges.',
    refusalHint:
      'The terminal accepts nothing before the card. The door mark is waiting.',
  },
  {
    id: 2,
    act: 1,
    zone: 'entry',
    name: 'Admission',
    requires: [itemIds.keycard],
    requiresPin: [1],
    grants: [],
    kind: 'puzzle',
    resolution: 'dial',
    objective:
      'The card carries a number where numbers are kept from casual eyes. Find it, then give it to the terminal.',
    bodyText:
      'Admission granted. Entry 002: the occupant has accepted the survey. The Division thanks you and regrets that it cannot stop what resumes now. The living room desk was surveyed last. Its underside was not.',
  },

  // ---- CHAPTER 2: THE CADASTRE (guards the mat) ----
  {
    id: 3,
    act: 2,
    zone: 'living',
    name: 'The Survey Seal',
    requires: [],
    requiresPin: [2],
    grants: [itemIds.sealCore, itemIds.file02],
    kind: 'puzzle',
    resolution: 'cube',
    objective:
      'Under the lip of the desk, a second mark. The surveyor sealed his findings in bronze. The note that came with it says: the surveyor sets his stone with the hall at heaven.',
    bodyText:
      'The seal opens. Entry 019: four rooms were tiled for reference. The core fixes their order. The tiles were left where they were cut; each room keeps its own. Collect all four before you ask the terminal anything.',
    refusalHint:
      'The seal will not open for a stone set wrong. The hall belongs at heaven.',
  },
  {
    id: 4,
    act: 2,
    zone: 'living',
    name: 'The Cadastral Tiles',
    requires: [itemIds.sealCore],
    requiresPin: [3],
    grants: [],
    kind: 'puzzle',
    resolution: 'dial',
    objective:
      'Four tiles, four rooms. Lay them in the order the core fixed. Make the frames agree. Then tell the terminal what the corners spell.',
    bodyText:
      'Entry 020: the tiles agree. Development of the reference photograph may proceed. The Division notes, without comment, that photographs taken in this flat develop backwards.',
  },
  {
    id: 5,
    act: 2,
    zone: 'living',
    name: 'The Development',
    requires: [],
    requiresPin: [4],
    grants: [itemIds.development01, itemIds.giftMat],
    kind: 'puzzle',
    resolution: 'wipe',
    objective:
      'The reference photograph is fogged. Clear it with your hand. What it shows, it shows the wrong way round.',
    bodyText:
      'Entry 021. The photograph shows a shelf of sixteen mouths. Count the way the mirror taught you. What was rolled and tied and put away is yours; it was always going to be. The Division catalogued it as A FLAT PLACE FOR A SMALL ANIMAL TO RUN.',
  },

  // ---- CHAPTER 3: THE SHADOW OF THE OPERATOR (guards the mouse) ----
  {
    id: 6,
    act: 3,
    zone: 'kitchen',
    name: 'The Specimen',
    requires: [],
    requiresPin: [5],
    grants: [itemIds.specimenJar, itemIds.file03],
    kind: 'item',
    resolution: 'scan',
    objective:
      'The kitchen keeps its mark inside the top drawer. Scan it. Entry 033 could not be classified, but something of it was preserved.',
    bodyText:
      'Entry 033. SPECIMEN. Classification pending since the survey opened. The jar preserves the only cast the Division managed to take. Turn it in the light. The tag is on the underside, where tags end up.',
    refusalHint:
      'The jar comes first. The kitchen drawer keeps its mark.',
  },
  {
    id: 7,
    act: 3,
    zone: 'corridor',
    name: 'The Cast',
    requires: [itemIds.specimenJar],
    requiresPin: [6],
    grants: [],
    kind: 'puzzle',
    resolution: 'dial',
    objective:
      'What is in the jar was catalogued by its shadow. Cast it again: the folded arms on the floor mark, your torch on the cradle mark, all other lights dead. Read the wall.',
    bodyText:
      'Entry 034: the shadow answers. The Division notes that the specimen was small, grey, and fond of running along flat places. A field recording was made the night it was catalogued. Play it standing still.',
  },
  {
    id: 8,
    act: 3,
    zone: 'entry',
    name: 'The Field Recording',
    requires: [],
    requiresPin: [7],
    grants: [itemIds.fieldRecording, itemIds.giftMouse],
    kind: 'puzzle',
    resolution: 'action',
    actionLabel: 'Play the recording',
    beat: 'listen',
    objective:
      'The terminal has recovered the field recording. Play it. Recordings from this flat are clearest near the front door, where things leave.',
    bodyText:
      'Entry 035, appended in a later hand: the specimen was never caught. It was REPLACED. A small grey runner, boxed and counted from the left of where the shoes sleep, third of its row. The Division does not explain itself. Collect it.',
  },

  // ---- CHAPTER 4: SIX LINES (guards the slips) ----
  {
    id: 9,
    act: 4,
    zone: 'balcony',
    name: 'The Reliquary',
    requires: [],
    requiresPin: [8],
    grants: [itemIds.reliquary, itemIds.file04],
    kind: 'item',
    resolution: 'scan',
    objective:
      'The balcony planter has kept a mark dry in a sleeve since the survey. Scan it. The Division buried its arithmetic where things grow.',
    bodyText:
      'Entry 040. One reliquary, five numbered slots, twelve notches at the rim. The lid is engraved: FIVE WOUNDS, TWO STARS. THE HOUSE KEEPS THE COUNT. The census card tells you where the house keeps it.',
    refusalHint:
      'The reliquary first. The planter has been patient for years; it can wait one more minute.',
  },
  {
    id: 10,
    act: 4,
    zone: 'living',
    name: 'The Census',
    requires: [itemIds.reliquary],
    requiresPin: [9],
    grants: [],
    kind: 'puzzle',
    resolution: 'census',
    objective:
      'Five questions, five rooms, five numbers. Nothing here is a riddle; it is arithmetic and legwork. The house has never once been miscounted.',
    bodyText:
      'Entry 041: five wounds filled. The house confirms its own count, as it always has, as it did the first time, when the surveyor wrote that the rooms seemed to be counting him back.',
  },
  {
    id: 11,
    act: 4,
    zone: 'living',
    name: 'The Two Stars',
    requires: [],
    requiresPin: [10],
    grants: [],
    kind: 'puzzle',
    resolution: 'wheel',
    objective:
      'The stars are not counted. They are aligned. Hold the crest card flat against the glass of the terminal and turn the wheel until the notches marry.',
    bodyText:
      'Entry 042: two stars fixed. The Division notes that the crest predates the building. It does not note by how much.',
  },
  {
    id: 12,
    act: 4,
    zone: 'living',
    name: 'The Six Lines',
    requires: [],
    requiresPin: [11],
    grants: [itemIds.sixLines, itemIds.giftSlips],
    kind: 'puzzle',
    resolution: 'lines',
    objective:
      'The file holds six lines of numbers. The first is yours already; the last is written. The four between are missing, and the rule that fills them was never recorded. Something happened five times.',
    bodyText:
      'Entry 043: the lines agree with the ledger. Transcribe all six onto the paper slips; the Division has always considered them a wager against the future. The last number of the last line counts a mouth on the shelf of sixteen. What waits inside is red and blue and twice lucky.',
  },

  // ---- CHAPTER 5: THE PARTY REMEMBERS EVERYTHING (finale) ----
  {
    id: 13,
    act: 5,
    zone: 'corridor',
    name: 'The Threshold',
    requires: [],
    requiresPin: [12],
    grants: [],
    kind: 'scare',
    damage: 30,
    resolution: 'action',
    actionLabel: 'Put the lights out',
    beat: 'threshold',
    objective:
      'The last page of the survey opens in the dark. Put out every light in the flat. Walk the corridor once, end to end, with the torch off. The terminal will know.',
    bodyText:
      'Entry 099. The corridor measured the same in both directions, which the surveyor noted was no longer true at night. Something has been left on the soft furniture. Three tags. The Division tags what it means to keep.',
  },
  {
    id: 14,
    act: 5,
    zone: 'living',
    name: 'The Tags',
    requires: [],
    requiresPin: [13],
    grants: [itemIds.coatTags],
    kind: 'puzzle',
    resolution: 'glyphs',
    objective:
      'Your own coat, tagged at the arm like a specimen. The arm tag shows the seal, set the way the surveyor set it. Which glyph does it fix? Choose on the terminal.',
    bodyText:
      'Entry 100: the arm concedes its glyph. The pocket tag is written in mirror-hand and incomplete. The hem tag holds a single film frame. Keep it within reach. The reel is missing exactly one frame, and it is that one.',
  },
  {
    id: 15,
    act: 5,
    zone: 'bathroom',
    name: 'The Ring',
    requires: [itemIds.coatTags],
    requiresPin: [14],
    grants: [],
    kind: 'puzzle',
    resolution: 'dial',
    objective:
      'Six wheels want a date. The pocket tag gave five of its figures, mirror-written. The sixth was left out on purpose. Only one number makes the date real.',
    bodyText:
      'Entry 101: the date is accepted. The Division wrote it down thirty-three years ago and has been waiting for the calendar to agree. Listen: the lullaby in the walls has corrected its tempo.',
  },
  {
    id: 16,
    act: 5,
    zone: 'living',
    name: 'The Music Box',
    requires: [],
    requiresPin: [15],
    grants: [],
    kind: 'puzzle',
    resolution: 'box',
    objective:
      'Five cylinders, one scratch each. IT REMEMBERS YOUR FIRST LINE.',
    bodyText:
      'Entry 102: the box plays clean. The tune is the one the surveyor heard through the party wall on his last night here, and could never afterwards stop hearing. It is, he noted, a birthday song slowed to the speed of waiting.',
  },
  {
    id: 17,
    act: 5,
    zone: 'living',
    name: 'The Reel',
    requires: [itemIds.coatTags],
    requiresPin: [16],
    grants: [itemIds.filmReel],
    kind: 'puzzle',
    resolution: 'reel',
    objective:
      'Six frames. Five belong to tonight; the sixth is in your hand, stamped at the hem. Put the evening in the order it happened. The empty frame goes last. The evening is not over.',
    bodyText:
      'Entry 103: the reel is complete and the projector agrees. The survey has recorded everything it was opened to record. One development remains. It is the one the Division kept for itself.',
  },
  {
    id: 18,
    act: 5,
    zone: 'bathroom',
    name: 'The Last Development',
    requires: [],
    requiresPin: [17],
    grants: [itemIds.development02],
    kind: 'puzzle',
    resolution: 'wipe',
    objective:
      'One photograph left. Clear it. This one develops the right way round; the Division decided you had earned that.',
    bodyText:
      'Entry 104. The photograph shows a bath, a drawn curtain, and behind the curtain a machine for putting the sparkle into water. The final mark is on its wrapping. The file is ready to close.',
  },
  {
    id: 19,
    act: 5,
    zone: 'bathroom',
    name: 'Classification',
    requires: [],
    requiresPin: [18],
    grants: [itemIds.carbonator],
    kind: 'win',
    resolution: 'scan',
    scannableFromAct: 4,
    earlyRefusals: [
      'The file is still open. The Division closes nothing out of order.',
      'Again at the wrapping. The survey admires persistence and remains unmoved.',
      'Not yet. Four entries stand between you and the last mark.',
      'The Division has waited thirty-three years. It can watch you wait a little.',
    ],
    objective:
      'Scan the final mark and close the file.',
    bodyText:
      'Entry 105, the last. SPECIMEN 33: classification resolved. The shadow on the corridor wall was measured at one metre sixty-something and thirty-three years, and it was yours; it was always yours; the house had simply been keeping it until you grew into it. CLASSIFICATION: BIRTHDAY. The survey is closed. The property is released to the occupant. Everything it counted, it counted for you.',
  },
];

export const TOTAL_PIN_COUNT = pins.length;
/** Only scan-resolved pins print a QR mark: five artifact pickups. */
export const printablePins = pins.filter((pin) => (pin.resolution ?? 'scan') === 'scan');
export const scannablePins = printablePins;

export const NON_PRINTED_PIN_IDS = new Set<number>();

export const pinById: Readonly<Partial<Record<number, Pin>>> =
  Object.fromEntries(pins.map((pin) => [pin.id, pin]));

export function getPinById(id: number): Pin | undefined {
  return pinById[id];
}

/** Side effects that intentionally do not alter the Pin contract. */
export const pinRevocations: Readonly<Partial<Record<number, ItemId[]>>> = {};

/** EuroMillions line arithmetic: the never-spoken rule of the six lines. */
export function wrapMain(value: number): number {
  return ((value - 1) % 50 + 50) % 50 + 1;
}

export function wrapStar(value: number): number {
  return ((value - 1) % 12 + 12) % 12 + 1;
}

export function lineAt(index: number): { mains: number[]; stars: number[] } {
  const mains = CENSUS_ANSWERS
    .map((main) => wrapMain(main + LINE_STEP * index))
    .sort((a, b) => a - b);
  const stars = STAR_ANSWERS
    .map((star) => wrapStar(star + STAR_STEP * index))
    .sort((a, b) => a - b);
  return { mains, stars };
}

/** The Kallax mouth counted by the last number of the last line. */
export function slipsCellIndex(): number {
  const finalLine = lineAt(5);
  return ((finalLine.mains[finalLine.mains.length - 1] - 1) % 16) + 1;
}

/** Music box cylinder targets: line 1 mains mod 12. */
export function musicBoxTargets(): number[] {
  return lineAt(0).mains.map((main) => main % 12);
}

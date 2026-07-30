import { itemIds } from './items';
import type { ItemId, Pin } from './types';

/*
 * THE KEEPER'S FOUR LOCKS
 *
 * Thirty-three years ago, on the night Melissa was born, the building's
 * Keeper sealed a birthday letter behind four locks and left four gifts in
 * trust, one lock each. Nobody ever came for them. Tonight the terminal
 * wakes. Each opened lock releases a quarter of the letter and names where
 * its gift waits in the real flat. The fourth opens on the whole letter,
 * read aloud, and thirty-three candles.
 *
 * Four stages, one per gift. Riddles are the locks. The 3D artifacts are
 * flavor on the bench and never gate anything.
 */

/* ====================== MIHA'S SETUP BLOCK ====================== */

/** Where each gift physically hides. Write these for YOUR flat. */
export const HIDING = {
  mat: 'Lift the seat cushion you always choose on the sofa. The first gift is underneath, rolled and tied.',
  mouse: 'The shoe rack by the front door. Third box from the left. It has been waiting to click.',
  slips: 'The shelf of square compartments in the living room. Count six mouths from the left and reach to the back.',
  carbonator: 'Where water sleeps: the bath, behind the drawn curtain. It breathes in silver and breathes out stars.',
} as const;

/** The number lock on stage three: yearBorn + dayOfNight + locks. */
export const NUMBER_LOCK = {
  yearBorn: 1993,
  dayOfNight: 31,
  locks: 4,
} as const;

export function numberLockAnswer(): number {
  return NUMBER_LOCK.yearBorn + NUMBER_LOCK.dayOfNight + NUMBER_LOCK.locks;
}

/** The letter, one fragment per lock; read aloud whole at the finale. */
export const FRAGMENTS = [
  'To the one born while I watched the door: I counted your first night in this world, and I have counted every one since.',
  'Some things are sealed not to hide them, but to keep them safe until they are grown into.',
  'The gifts were never mine. They were always yours; I only held the locks.',
  'The last one breathes in silver and breathes out stars, and it is waiting where water sleeps. Happy birthday, Melissa. The building is proud of you. Signed, the Keeper.',
] as const;

/* ====================== RIDDLE LOCKS ====================== */

export interface RiddleConfig {
  readonly model: string;
  readonly riddle: string;
  /** Normalised acceptable answers; empty when numeric. */
  readonly answers: readonly string[];
  readonly numeric?: boolean;
  readonly hints: readonly [string, string, string];
}

export const riddleConfigByPin: Readonly<Partial<Record<number, RiddleConfig>>> = {
  1: {
    model: '/models/sealcube.glb',
    riddle:
      'My whole life is spent under a runner who never leaves home. Storms of clicking pass over me and I keep every journey but show none. Cities get maps. Desks get me. What am I?',
    answers: ['mat', 'mousemat', 'mousepad', 'pad', 'podloga', 'deskmat', 'matt'],
    hints: [
      'It lies flat, and something small travels across it all day.',
      'You would find one next to every keyboard in the world.',
      'A mouse runs on it. Tell the lock what it runs on.',
    ],
  },
  3: {
    model: '/models/jar.glb',
    riddle:
      'I have a tail but no bones. I run all day and never leave your side. I speak only in clicks, and I am happiest under your hand. What am I?',
    answers: ['mouse', 'miska', 'computermouse', 'amouse', 'themouse', 'mis'],
    hints: [
      'It is an animal only by name.',
      'Its tail is a cable, or nothing at all these days.',
      'It moves the little arrow on every screen you have ever used.',
    ],
  },
  5: {
    model: '/models/reliquary.glb',
    riddle:
      'Take the year you were born. Add the day of this very night. Add the number of locks the Keeper built. Give the lock the sum.',
    answers: [],
    numeric: true,
    hints: [
      'Three numbers: a year, a day of the month, and a very small count of locks.',
      'The year is 1993. Tonight is the 31st. How many locks did the Keeper build?',
      'It is 1993 plus 31 plus 4.',
    ],
  },
  8: {
    model: '/models/candleLit.glb',
    riddle:
      'I am still until you press me. I take the plainest drink there is and teach it to dance. I breathe in silver and breathe out stars. What am I?',
    answers: [
      'carbonator', 'aarke', 'sodastream', 'sparklingwater', 'sodamaker',
      'gaziranavoda', 'soda', 'fizzywater', 'watercarbonator',
      'sparklingwatermaker', 'sodawater',
    ],
    hints: [
      'It stands on a kitchen counter and hisses politely when used.',
      'It turns still water into sparkling water.',
      'A carbonator. Tell the lock so.',
    ],
  },
};

/** In-character replies to wrong answers; they rotate and never punish. */
export const REFUSAL_LINES = [
  'The lock listens, considers, and declines.',
  'No. But the lock admires the attempt.',
  'The Keeper wrote: wrong guesses cost nothing but pride.',
  'Not that. The lock has waited thirty-three years; it can wait another minute.',
] as const;

/** Keeper voice clip per pin, played when the pin resolves. */
export const KEEPER_VOICE_BY_PIN: Readonly<Partial<Record<number, string>>> = {
  1: 'lock1',
  3: 'lock2',
  5: 'lock3',
  7: 'dark',
};

/* ====================== THE GRAPH ====================== */

/** Retired identifiers kept as typed inert constants for old code paths. */
export const TAPE_PLAYBACK_PIN_ID = -1;
export const RELIGHT_ACTION_PIN_ID = -2;
export const ADMISSION_CODE = '0000';

export const TROPHY_PIN_ID = 9;
export const SEALED_PRESENT_PIN_ID = 9;
export const FINAL_PRESENT_PIN_IDS = [9] as const;

export const dialConfigByPin: Readonly<Partial<Record<number, never>>> = {};

export const pins: readonly Pin[] = [
  // ---- STAGE ONE: THE FIELD (the mouse mat) ----
  {
    id: 1,
    act: 1,
    zone: 'living',
    name: 'The First Lock',
    requires: [],
    grants: [itemIds.fragment01, itemIds.sealArtifact],
    kind: 'puzzle',
    resolution: 'riddle',
    objective:
      'The first lock listens for the name of a quiet servant. Solve it, and a quarter of the letter is yours.',
    bodyText:
      'The first lock turns. A quarter of the letter is released, and the first gift is named. ' + HIDING.mat,
  },
  {
    id: 2,
    act: 1,
    zone: 'living',
    name: 'The Field',
    requires: [],
    requiresPin: [1],
    grants: [itemIds.giftMat],
    kind: 'item',
    resolution: 'action',
    actionLabel: 'I have it in my hands',
    objective:
      'Go and take the first gift from its keeping. Come back to the terminal with it in your hands.',
    bodyText:
      'Catalogued and released: one flat place for a small runner. The Keeper chose it for the desk where you will win things. Three locks remain.',
  },

  // ---- STAGE TWO: THE RUNNER (the mouse) ----
  {
    id: 3,
    act: 2,
    zone: 'entry',
    name: 'The Second Lock',
    requires: [],
    requiresPin: [2],
    grants: [itemIds.fragment02, itemIds.jarArtifact],
    kind: 'puzzle',
    resolution: 'riddle',
    objective:
      'The second lock keeps a small grey tenant. It has no bones and no bad intentions.',
    bodyText:
      'The second lock turns. Half the letter now. ' + HIDING.mouse,
  },
  {
    id: 4,
    act: 2,
    zone: 'entry',
    name: 'The Runner',
    requires: [],
    requiresPin: [3],
    grants: [itemIds.giftMouse],
    kind: 'item',
    resolution: 'action',
    actionLabel: 'I have it in my hands',
    objective:
      'Collect the small grey runner from its box. It will not run away; it has been patient.',
    bodyText:
      'Catalogued and released: one runner, grey, clicking, boneless. The Keeper trusts you will get along famously. Two locks remain.',
  },

  // ---- STAGE THREE: THE WAGER (the EuroMillions slips) ----
  {
    id: 5,
    act: 3,
    zone: 'living',
    name: 'The Third Lock',
    requires: [],
    requiresPin: [4],
    grants: [itemIds.fragment03, itemIds.reliquaryArtifact],
    kind: 'puzzle',
    resolution: 'riddle',
    objective:
      'The third lock is arithmetic. The Keeper built it from three numbers only the two of you could know tonight.',
    bodyText:
      'The third lock turns. Three quarters of the letter. ' + HIDING.slips,
  },
  {
    id: 6,
    act: 3,
    zone: 'living',
    name: 'The Wager',
    requires: [],
    requiresPin: [5],
    grants: [itemIds.giftSlips],
    kind: 'item',
    resolution: 'action',
    actionLabel: 'I have them in my hands',
    objective:
      'Collect the third gift: thin as paper and worth whatever the future decides.',
    bodyText:
      'Catalogued and released: six lines, three red, three blue. Thirty-three chances, by the Keeper\'s arithmetic. One lock remains, and it prefers the dark.',
  },

  // ---- STAGE FOUR: THE SPARKLE (the carbonator) ----
  {
    id: 7,
    act: 4,
    zone: 'corridor',
    name: 'The Dark',
    requires: [],
    requiresPin: [6],
    grants: [],
    kind: 'scare',
    damage: 25,
    resolution: 'action',
    actionLabel: 'Put the lights out',
    beat: 'threshold',
    objective:
      'Before the last lock, a courtesy. Put out every light. Stand still, and let the building look at you the way the Keeper did, the night the letter was sealed.',
    bodyText:
      'Nothing here has ever wished you harm. Nothing here ever will. The last lock is listening now.',
  },
  {
    id: 8,
    act: 4,
    zone: 'bathroom',
    name: 'The Last Lock',
    requires: [],
    requiresPin: [7],
    grants: [itemIds.fragment04, itemIds.candleArtifact],
    kind: 'puzzle',
    resolution: 'riddle',
    objective:
      'The last lock guards the gift the Keeper chose himself. It has held its breath for thirty-three years.',
    bodyText:
      'The last lock turns. The letter is whole. ' + HIDING.carbonator,
  },
  {
    id: 9,
    act: 4,
    zone: 'bathroom',
    name: 'The Sparkle',
    requires: [],
    requiresPin: [8],
    grants: [itemIds.carbonator],
    kind: 'win',
    resolution: 'action',
    actionLabel: 'I have it. Read me the letter.',
    objective:
      'Take the last gift from where water sleeps, and bring it back. The Keeper will read the letter himself.',
    bodyText:
      'The Keeper\'s watch is ended. The letter is yours, the gifts were always yours, and the building is proud of you. Happy birthday, Melissa.',
  },
];

export const TOTAL_PIN_COUNT = pins.length;
/** No printed marks in this game; the scanner stays dormant. */
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

/** Forgiving answer matching: case, spacing, and accents are ignored. */
export function normaliseAnswer(value: string): string {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function riddleAnswerMatches(config: RiddleConfig, raw: string): boolean {
  if (config.numeric) {
    const number = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
    return Number.isFinite(number) && number === numberLockAnswer();
  }
  const given = normaliseAnswer(raw);
  if (given.length === 0) return false;
  return config.answers.some((answer) => normaliseAnswer(answer) === given);
}

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
 * Four stages, one per gift. Riddles are the locks. On every bench stands a
 * WITNESS: a bronze artifact the Keeper cast for that lock. Witnesses carry
 * true engravings (the wager obelisk wears all three numbers of its sum) and
 * genuinely help, but they NEVER gate: the typed answer alone opens a lock.
 */

/* ====================== MIHA'S SETUP BLOCK ====================== */

/** Where each gift physically hides. Write these for YOUR flat. */
export const HIDING = {
  mat: 'The big pillow in the bottom left corner of the living room. Lift it: the first gift is underneath, rolled and tied.',
  mouse: 'The shoe rack by the front door. Third box from the left. It has been waiting to click.',
  slips: 'The shelf of square compartments in the living room. Count six mouths from the left and reach to the back.',
  carbonator: 'Where water sleeps: the bath, behind the drawn curtain. It breathes in silver and breathes out stars.',
} as const;

/** The number lock on stage three: yearBorn + dayOfNight + locks. */
export const NUMBER_LOCK = {
  yearBorn: 1993,
  dayOfNight: 2,
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

/**
 * The postscript beneath the signature, read aloud at the finale after the
 * four quarters. This is where the mask comes off. The recorded reading in
 * public/audio/keeper/keeper-lock4.mp3 speaks FRAGMENTS + LETTER_CODA in
 * order; regenerate that clip if any of this text changes.
 */
export const LETTER_CODA = [
  'And now the letter is out of quarters, so I will spend the truth instead.',
  'I am proud of you. Proud of your hard work, of every quiet hour of it that nobody stood up to applaud. I have watched your love and your dedication hold a life together, and I have never once taken either lightly. You are truly special. Not special the way birthday cards say it; special the way a keystone is special: things stand because you hold them.',
  'I wish you would fear the world much less. Truly, between the two of you, it is the world that should be afraid.',
  'I wish you the most in this world. I offer you deep love, the kind with no bottom to it and no expiry written anywhere, and I will always, always care for you.',
  'One last thing, the lock beneath every lock: this building never had a Keeper. It had me. It was always me. My name is Miha, and I have been keeping you all along.',
  'Happy birthday, Melissa.',
] as const;

/* ====================== RIDDLE LOCKS ====================== */

/**
 * The interactive puzzle a lock plays ON its witness. All of them are
 * explicit deterministic taps tracked by the app: hotspots anchored to the
 * 3D model, dial wheels, a spin button. NEVER camera-angle detection or
 * gesture math; those are banned after real field failures.
 */
export type WitnessPuzzle =
  | { readonly kind: 'clicks'; readonly pattern: readonly ('L' | 'W' | 'R')[] }
  | { readonly kind: 'sum' }
  | { readonly kind: 'verbs' };

export interface RiddleConfig {
  readonly model: string;
  /** One line under the bench telling her what this witness truly shows. */
  readonly benchNote: string;
  readonly riddle: string;
  /** Normalised acceptable answers; empty when numeric. */
  readonly answers: readonly string[];
  readonly numeric?: boolean;
  readonly hints: readonly [string, string, string];
  /** Pin-specific refusal lines, rotated in order; min eight per lock. */
  readonly refusals: readonly string[];
  /**
   * When set, the lock is played on the witness itself instead of typed:
   * the riddle text becomes the Keeper's instruction. The answers above
   * stay as dormant data (and as the matcher's contract for tests).
   */
  readonly puzzle?: WitnessPuzzle;
}

export const riddleConfigByPin: Readonly<Partial<Record<number, RiddleConfig>>> = {
  1: {
    model: '/models/witnessField.glb',
    benchNote: 'The Keeper cast a witness for every lock. This one shows a field, and what rests upon it.',
    riddle:
      'My whole life is spent under a runner who never leaves home. Storms of clicking pass over me and I keep every journey but show none. Cities get maps. Desks get me. What am I?',
    answers: ['mat', 'mousemat', 'mousepad', 'pad', 'podloga', 'deskmat', 'matt'],
    hints: [
      'Look at the witness on the bench: the flat piece, not the sleeper resting on it. The lock wants the flat piece named.',
      'You would find one beside every keyboard in the world, and nobody has ever thanked it.',
      'A mouse runs on it. Tell the lock what the mouse runs on.',
    ],
    refusals: [
      'The lock listens, considers, and declines.',
      'No. But the lock admires the attempt. It has heard far worse.',
      'Wrong guesses cost nothing but pride. The Keeper wrote that on the first night.',
      'Not that. The lock has waited twelve thousand nights; it can wait one more minute.',
      'The lock turns your answer over twice, to be polite. Still no.',
      'Declined, and entered in the ledger as nearly.',
      'The quiet servant would not answer to that name either.',
      'Patience. The answer is flatter than you think.',
    ],
  },
  3: {
    model: '/models/witnessRunner.glb',
    benchNote: 'Its shoulders click plainly. What else clicks, it keeps underneath.',
    riddle:
      'It had a tail but no bones, and it spoke only in clicks. Speak its language back to it: one click on its left shoulder for the lock already open, one on its right shoulder for every lock still waiting, and last, the wheel that counted the years. It kept that one hidden beneath itself, the way counters keep their counting private.',
    answers: ['mouse', 'miska', 'computermouse', 'amouse', 'themouse', 'mis'],
    puzzle: { kind: 'clicks', pattern: ['L', 'R', 'R', 'R', 'W'] },
    hints: [
      'Touch the runner itself. It has a left shoulder and a right shoulder in plain view. The wheel it hides; things held underneath are still things held.',
      'One lock stands open behind you; three still wait; the wheel comes last. Left once, right three times, then roll the runner over and look beneath it.',
      'Tap: left, right, right, right. Then turn the witness fully over: the wheel waits on its underside, and the next correct touch now glows for you.',
    ],
    refusals: [
      'The runner flicks an ear. Not its language.',
      'A wrong click. It forgives you; it keeps no ledger of grudges.',
      'The pattern broke. Begin again; the runner always does.',
      'Not that shoulder, not that order. Listen with your fingers.',
      'The lock heard an accent it did not know. Speak click, not word.',
      'Declined. The runner rehearsed this for thirty-three years; take your time.',
      'Nearly. Instinct is only patience moving faster.',
      'The wheel comes last. Everything before it is shoulders.',
    ],
  },
  5: {
    model: '/models/witnessWager.glb',
    benchNote: 'Three numbers ride this witness. The wheels below take their sum.',
    riddle:
      'The Keeper cut three numbers into this witness, one to a face: the year you were born, the day you were born returning as the day of this very night, and the count of his locks. Turn it, take all three, and set their sum on the brass wheels.',
    answers: [],
    numeric: true,
    puzzle: { kind: 'sum' },
    hints: [
      'Turn the witness face by face. It wears your birth year, the day your birthday returns tonight, and IIII for the Keeper\'s four locks.',
      'The year is 1993. You were born on the 2nd, and tonight is the 2nd again. The Keeper built four locks. Add all three.',
      '1993 + 2 + 4 = 1999. Set the wheels to 1 9 9 9 and turn the lock.',
    ],
    refusals: [
      'The wheels return your sum untouched. Count again.',
      'The arithmetic declines. The Keeper checked it thirty-three years early.',
      'A wrong sum. The wager stands; steady nerve, then a correct number.',
      'The lock does not round. It never has.',
      'Declined, and entered in the ledger as close enough for anyone but a lock.',
      'Three numbers, one sum. The witness wears all three; turn it and collect them.',
      'No. Though the Keeper always admired a confident wrong answer.',
      'The house held this wager for decades. It can hold your next attempt too.',
    ],
  },
  8: {
    model: '/models/witnessSparkle.glb',
    benchNote: 'A silver vessel gives its evidence in three parts: what it takes, what it breathes, what it returns.',
    riddle:
      'The last witness is under oath, and words alone will not do. Its panel carries three controls: what it takes, what it breathes, what it returns. Work them in the only order such a machine allows, and when all three truths are said, name the apparatus. The Keeper has already wrapped one. Naturally.',
    answers: [
      'carbonator', 'aarke', 'sodastream', 'sparklingwater', 'sodamaker',
      'gaziranavoda', 'soda', 'fizzywater', 'watercarbonator',
      'sparklingwatermaker', 'sodawater', 'bubbles', 'bubbly', 'bubblywater',
      'bubblewater', 'fizzy', 'fizzymaker', 'sparkle', 'sparkles',
      'sparklewater', 'sodamachine', 'sparklingwatermachine', 'sodamaster',
      'mehurcki', 'gazirka', 'sifon', 'sodasifon',
    ],
    puzzle: { kind: 'verbs' },
    hints: [
      'The panel works the way every such machine works: something still goes in, something silver charges it, then it can speak. Begin with the pour; the machine will tell you if you rush it.',
      'Hold POUR until the vessel fills. Hold CHARGE until the hiss peaks. Then one tap on RELEASE sets the stars out. What drinks still water and breathes out a celebration?',
      'POUR, CHARGE, RELEASE, then type CARBONATOR. The next correct control now glows.',
    ],
    refusals: [
      'The witness keeps its statement. Not that.',
      'Declined. The apparatus knows its own name, and waits to hear you say it.',
      'It does not take that, breathe that, or return that.',
      'Wrong. The stars stay in the vessel a moment longer.',
      'The last lock is the fussiest of the four. The Keeper made it that way on purpose.',
      'No. Joy is exact, or it is only noise.',
      'The witness has held its oath for thirty-three years. It will not bend it now.',
      'Declined, gently. It wants to be named as badly as you want to name it.',
    ],
  },
};

/**
 * The generic fallback replies to wrong answers; each lock carries its own
 * eight in riddleConfigByPin.refusals. They rotate and never punish.
 */
export const REFUSAL_LINES = [
  'The lock listens, considers, and declines.',
  'No. But the lock admires the attempt.',
  'The Keeper wrote: wrong guesses cost nothing but pride.',
  'Not that. The lock has waited thirty-three years; it can wait another minute.',
  'Declined, and entered in the ledger as nearly.',
  'The lock turns your answer over twice, to be polite. Still no.',
  'The house has heard twelve thousand nights of silence. It can bear one wrong answer.',
  'Try again. The Keeper never once punished a guess.',
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
      'The first lock keeps the quietest thing the Keeper ever catalogued. It has practised patience under storms of clicking for twelve thousand and fifty-three nights. Name it, and a quarter of the letter is released.',
    bodyText:
      'The first lock turns. One quarter of the letter, released and entered in the ledger. ' + HIDING.mat,
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
      'Go and take the first gift out of its keeping, then come back to the terminal with it in your hands. It has waited this long; it will not begrudge you the walk.',
    bodyText:
      'Catalogued and released: one flat field for a small runner, kept rolled and tied since the night you were born. It taught this house patience. The Keeper chose it for the desk where you will win things. Three locks hold.',
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
      'The second lock keeps a small grey tenant, boneless and quick, with no bad intentions on record. It answers to nothing but its own language. Instinct will do here what vocabulary will not.',
    bodyText:
      'The second lock turns. Half the letter now, released and entered in the ledger. ' + HIDING.mouse,
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
      'Collect the small grey runner from its box. It will not run away; patience was never its gift, but it learned from the mat.',
    bodyText:
      'Catalogued and released: one runner, grey, clicking, boneless. Quick as a good guess. The Keeper trusts you will get along famously. Two locks hold.',
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
      'The third lock is arithmetic with nerve in it. The Keeper built it from three numbers only the two of you could know tonight, then wagered on the future and never once checked the result.',
    bodyText:
      'The third lock turns. Three quarters of the letter, released and entered in the ledger. ' + HIDING.slips,
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
      'Collect the third gift: thin as paper, worth whatever the future decides. The Keeper never gambled small. He gambled once, on you, and called it arithmetic.',
    bodyText:
      'Catalogued and released: six lines, three red, three blue. Thirty-three chances, by the Keeper\'s arithmetic. One lock holds, and it prefers the dark.',
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
      'Before the last lock, the Keeper asks the only favour in the whole arrangement. Put out every light. Stand still in the dark, and let the building look at you the way he did the night the letter was sealed. You have trusted the locks all evening. This once, they ask to trust you back.',
    bodyText:
      'Nothing here has ever wished you harm. Nothing here ever will. The building looked, and entered one line in the ledger: she came. The last lock is listening now.',
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
      'The last lock keeps the gift the Keeper chose himself: the one that breathes in silver and breathes out stars. It has held its breath for thirty-three years. It would very much like to celebrate.',
    bodyText:
      'The last lock turns. The letter is whole, and the ledger wants one closing entry. ' + HIDING.carbonator,
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
      'Take the last gift from where water sleeps, and bring it back. Then the Keeper will read you the letter himself, whole and aloud. He has been rehearsing it for twelve thousand and fifty-three nights.',
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

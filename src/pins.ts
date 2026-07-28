import { itemIds } from './items';
import type { ItemId, Pin } from './types';

/**
 * SETUP CONSTANT: change this value if the bathroom cabinet combination is
 * changed. Keep it to exactly three decimal digits.
 */
export const CABINET_DIAL_CODE = '731';

export const BALCONY_DIAL_WORD = 'LOSER';
export const NON_PRINTED_PIN_IDS = new Set([24]);

export const pins: readonly Pin[] = [
  {
    id: 1,
    act: 1,
    zone: 'corridor',
    name: 'Waking',
    requires: [],
    grants: [],
    kind: 'flavour',
    bodyText:
      'Up you get, birthday girl. Thirty-three deserves a proper beginning, and I have prepared every inch of one. The corridor is waiting. Try not to keep the party waiting with it.',
  },
  {
    id: 2,
    act: 1,
    zone: 'corridor',
    name: 'Item Locker',
    requires: [],
    requiresPin: [1],
    grants: [itemIds.knife, itemIds.note01],
    kind: 'save',
    bodyText:
      'Look at that. You found the first present before I had to worry. A knife, because every birthday cake needs one, and a note from your devoted Host. Take both. The little deck nearby remembers this moment better than people do. Let it make the occasion official.',
  },
  {
    id: 3,
    act: 1,
    zone: 'corridor',
    name: 'Marked Wall',
    requires: [],
    requiresPin: [2],
    grants: [],
    kind: 'item',
    arTarget: 'sheet01',
    bodyText:
      'I marked this wall especially for you. Hold the camera steady and let the shape settle into place. The last guest rushed this part. He was terribly eager to reach the bathroom. You have always had better patience. Consider that my first birthday compliment.',
  },
  {
    id: 4,
    act: 2,
    zone: 'bathroom',
    name: 'Threshold',
    requires: [],
    requiresPin: [3],
    grants: [],
    kind: 'flavour',
    bodyText:
      'Welcome to the bathroom. Intimate, echoing, impossible to ignore. A fine room for birthday preparations. Everything you need is already in here, though not necessarily where a polite host would leave it.',
  },
  {
    id: 5,
    act: 2,
    zone: 'bathroom',
    name: 'The Mirror',
    requires: [],
    requiresPin: [4],
    grants: [itemIds.code3],
    kind: 'puzzle',
    bodyText:
      'There she is. Thirty-three years, and the mirror still has the nerve to keep secrets. Do not ask it for the answer. Look at what it chooses to repeat. Three figures will introduce themselves when you stop trying to make them behave.',
  },
  {
    id: 6,
    act: 2,
    zone: 'bathroom',
    name: 'The Cistern',
    requires: [],
    requiresPin: [5],
    grants: [itemIds.kallaxGlyph],
    kind: 'item',
    bodyText:
      'The cistern has been saving a card for you. Thoughtful, isn\'t it? Reach in. One mark on it belongs to one square shelf. The previous player stared at every cell except the right one. You have the advantage of a birthday clue.',
  },
  {
    id: 7,
    act: 2,
    zone: 'bathroom',
    name: 'The Shower',
    requires: [],
    requiresPin: [6],
    grants: [itemIds.pistol],
    kind: 'item',
    bodyText:
      'A shower should wash trouble away. This one has been collecting it. Your next present is close, heavy, and rather less festive than ribbon. Pick it up carefully. I would hate for the birthday girl to arrive at the next surprise improperly dressed.',
  },
  {
    id: 8,
    act: 2,
    zone: 'bathroom',
    name: 'Cabinet',
    requires: [itemIds.code3],
    requiresPin: [7],
    grants: [itemIds.chemFluid],
    kind: 'save',
    resolution: 'dial',
    bodyText:
      'Three little numbers, and the cabinet finally admits you. Inside is enough chemistry to improve the evening. Take it. The cassette deck is ready for another memory, too. You have done wonderfully already. I knew you would, which is almost the same as congratulations.',
  },
  {
    id: 9,
    act: 3,
    zone: 'entry',
    name: 'The Turn',
    requires: [],
    requiresPin: [8],
    grants: [],
    kind: 'scare',
    scare: 'torchKill',
    damage: 15,
    bodyText:
      'Happy birthday. Lights out. I do adore the moment a room stops pretending to be empty. Hold still if you like; it will not make you safer. The last guest tried running. He made the corridor sound wonderfully alive. You can do better.',
  },
  {
    id: 10,
    act: 3,
    zone: 'entry',
    name: 'Sealed Exit',
    requires: [],
    requiresPin: [9],
    grants: [],
    kind: 'flavour',
    bodyText:
      'The front door remembers being useful. Tonight it is decoration. No need to sulk; the party is inside, and I have arranged far more interesting exits for a woman turning thirty-three.',
  },
  {
    id: 11,
    act: 3,
    zone: 'entry',
    name: 'Coat Pocket',
    requires: [],
    requiresPin: [10],
    grants: [itemIds.tape],
    kind: 'item',
    bodyText:
      'Someone left a coat for the occasion. Check the pocket. The tape inside belonged to the player before you, though he never understood what a generous gift it was. Take it somewhere comfortable. Birthdays are better with old home movies.',
  },
  {
    id: 12,
    act: 3,
    zone: 'living',
    name: 'The Tape',
    requires: [itemIds.tape],
    requiresPin: [11],
    grants: [itemIds.knowLoser],
    kind: 'puzzle',
    bodyText:
      'Go on, press play. Our previous player left one useful lesson between the static: what makes a loser. He did not enjoy the screening. You have the advantage of a birthday audience and my undivided attention.',
  },
  {
    id: 13,
    act: 3,
    zone: 'living',
    name: 'The Cushion',
    requires: [],
    requiresPin: [12],
    grants: [itemIds.keycardRed],
    kind: 'item',
    bodyText:
      'The sofa has been holding your seat and one red little invitation. Search the cushion properly. Yes, there. A keycard is not much of a birthday card, but this one opens more interesting things than good wishes ever could tonight.',
  },
  {
    id: 14,
    act: 3,
    zone: 'living',
    name: 'The Kallax',
    requires: [itemIds.kallaxGlyph],
    requiresPin: [13],
    grants: [itemIds.keycardBlue],
    kind: 'puzzle',
    bodyText:
      'All those square cells, lined up so neatly. Match the mark on the damp little card to the labels. The correct compartment has been waiting to offer its blue companion. Red alone is merely dramatic. Together they become a proper invitation.',
  },
  {
    id: 15,
    act: 3,
    zone: 'living',
    name: 'Field Desk',
    requires: [],
    requiresPin: [14],
    grants: [itemIds.knowKitchen],
    kind: 'puzzle',
    bodyText:
      'Lay the phone torch flat against the paper. A raking light makes pressed-in writing throw a shadow. What appears is not a map, exactly, but it knows how the kitchen wants to be approached. The previous player held the light above it and remained hungry.',
  },
  {
    id: 16,
    act: 3,
    zone: 'living',
    name: 'Balcony Door',
    requires: [itemIds.knowLoser],
    requiresPin: [15],
    grants: [],
    kind: 'gate',
    resolution: 'dial',
    bodyText:
      'The balcony door likes the right sort of loser. Strange taste, but every party has a guest list. If the tape taught you the word, the lock will listen. Step outside. The air has been saving a birthday breath for you.',
  },
  {
    id: 17,
    act: 3,
    zone: 'balcony',
    name: 'The Planter',
    requires: [],
    requiresPin: [16],
    grants: [itemIds.herb, itemIds.valve],
    kind: 'item',
    arTarget: 'sheet02',
    bodyText:
      'The planter has produced a splendid crop: one living thing and one piece of plumbing. Take the herb and the valve. I planted neither, which makes their devotion to your birthday especially touching. Let the camera notice what else has taken root here.',
  },
  {
    id: 18,
    act: 3,
    zone: 'living',
    name: 'Re-entry',
    requires: [itemIds.pistol],
    requiresPin: [17],
    grants: [],
    kind: 'scare',
    scare: 'roomMonster',
    damage: 20,
    bodyText:
      'Back inside already? Wonderful. You brought the pistol, exactly as I congratulated you for doing. The room has acquired another guest while you were out. Do try the obvious answer. He dislikes being ignored more than he dislikes being shot.',
  },
  {
    id: 19,
    act: 4,
    zone: 'kitchen',
    name: 'Kitchen Door',
    requires: [
      itemIds.keycardRed,
      itemIds.keycardBlue,
      itemIds.knowKitchen,
    ],
    requiresPin: [18],
    grants: [],
    kind: 'gate',
    bodyText:
      'Two colours for one door, and a route hidden in the desk\'s scratches. Present all three properly. The kitchen has been terribly patient. So have I. Your birthday supper is nearly ready, though the cook may object to your methods.',
  },
  {
    id: 20,
    act: 4,
    zone: 'kitchen',
    name: 'Chem Station',
    requires: [itemIds.herb, itemIds.chemFluid],
    requiresPin: [19],
    grants: [itemIds.firstAid],
    kind: 'craft',
    bodyText:
      'Herb first. Fluid second. Do not confuse generosity with safety; I have provided both because damaged guests become slow guests. Mix them at the station. What you make can pull you back from a very ugly edge, once. Save it for a memorable toast.',
  },
  {
    id: 22,
    act: 4,
    zone: 'kitchen',
    name: 'Behind You',
    requires: [],
    requiresPin: [20],
    grants: [],
    kind: 'scare',
    scare: 'closeQuarters',
    damage: 20,
    bodyText:
      'Did you feel that? Of course you did. Turn around, birthday girl. Quickly would be entertaining. Slowly would be brave. Either way, I have placed this guest close enough to admire your expression. The previous player never offered such a good view.',
  },
  {
    id: 21,
    act: 4,
    zone: 'kitchen',
    name: 'The Flame',
    requires: [],
    requiresPin: [22],
    grants: [itemIds.candleLit],
    kind: 'item',
    bodyText:
      'Now that our close guest has finished admiring you, every celebration needs a flame. Light the candle and guard it like the tiny, unreasonable life it is. Thirty-three candles would be excessive, so we shall let one stand in for the crowd.',
  },
  {
    id: 23,
    act: 5,
    zone: 'kitchen',
    name: 'The Draught',
    requires: [itemIds.candleLit],
    requiresPin: [21],
    grants: [],
    kind: 'scare',
    bodyText:
      'A draught. Such a small thing to ruin such careful ceremony. Your flame is gone, and I am devastated on your behalf. Truly. Fortunately, birthdays permit second wishes. Go and earn another light while the dark enjoys what I arranged behind it.',
  },
  {
    id: 24,
    act: 5,
    zone: 'kitchen',
    name: 'Relight',
    requires: [],
    requiresPin: [23],
    grants: [itemIds.candleLit],
    kind: 'item',
    resolution: 'action',
    bodyText:
      'Back for another spark. I knew you would not let a little darkness cancel the party. Relight the candle. Cup your hand around it this time. The flat has developed opinions about open flames, and not all of them are architectural.',
  },
  {
    id: 25,
    act: 5,
    zone: 'kitchen',
    name: 'The Valve',
    requires: [itemIds.valve],
    requiresPin: [24],
    grants: [itemIds.fanOff],
    kind: 'puzzle',
    bodyText:
      'The valve fits where the fan keeps worrying the air. Turn it. Listen to the blades surrender. There. Your candle may finally travel without being bullied. The previous player blamed the machinery. I prefer to thank you for correcting it.',
  },
  {
    id: 26,
    act: 5,
    zone: 'kitchen',
    name: 'Thirty-Three Candles',
    requires: [itemIds.candleLit, itemIds.fanOff],
    requiresPin: [25],
    grants: [],
    kind: 'win',
    bodyText:
      'Bring the living flame to the silent fan. One candle for every year would have been vulgar, so imagine the other thirty-two. You made it to the wish, exactly as promised. Go on. The party has one final present, and it has been waiting since the corridor.',
  },
  {
    id: 27,
    act: 5,
    zone: 'corridor',
    name: 'Full Circle',
    requires: [],
    requiresPin: [26],
    grants: [itemIds.theHand, itemIds.theAltar],
    kind: 'flavour',
    bodyText:
      'Full circle. Back where you woke, but not empty-handed. The Hand and the Altar are yours now. Thirty-three suited you beautifully. Take the trophy. I have been looking forward to congratulating you in person.',
  },
];

export const printablePins = pins.filter((pin) => !NON_PRINTED_PIN_IDS.has(pin.id));
export const scannablePins = printablePins;

export const pinById: Readonly<Partial<Record<number, Pin>>> =
  Object.fromEntries(pins.map((pin) => [pin.id, pin]));

export function getPinById(id: number): Pin | undefined {
  return pinById[id];
}

/** Side effects that intentionally do not alter the Phase 2 Pin contract. */
export const pinRevocations: Readonly<
  Partial<Record<number, ItemId[]>>
> = {
  23: [itemIds.candleLit],
};


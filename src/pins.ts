import { itemIds } from './items';
import type { ItemId, Pin } from './types';

/**
 * SETUP CONSTANT: change this value if the bathroom cabinet combination is
 * changed. Keep it to exactly three decimal digits.
 */
export const CABINET_DIAL_CODE = '731';

export const BALCONY_DIAL_WORD = 'LOSER';

export interface DialPinConfig {
  readonly kind: 'numeric' | 'alpha';
  readonly value: string;
  readonly title: string;
  readonly hostText: string;
  readonly wrongText: string;
  /** Escalating help, one step per wrong attempt from the second on. */
  readonly hints: readonly string[];
}

/**
 * Lock configuration for every dial-resolved pin. Screens read this table;
 * they never carry their own pin-id literals or copy.
 */
export const dialConfigByPin: Readonly<Partial<Record<number, DialPinConfig>>> = {
  8: {
    kind: 'numeric',
    value: CABINET_DIAL_CODE,
    title: 'On-Screen Dial',
    hostText:
      'The cabinet kept only the square. The mirror introduced three figures. Turn the wheels here on the screen.',
    wrongText:
      'Those are three numbers, certainly. They are not my three. Again.',
    hints: [
      'The mirror gave you three figures, and it gave them in an order. The order was part of the gift.',
      'Steam remembers what fingers wrote. If the figures have faded, go back to the glass and breathe again.',
      'Very well, since it is your birthday: seven, three, one. Tell no one I said so.',
    ],
  },
  16: {
    kind: 'alpha',
    value: BALCONY_DIAL_WORD,
    title: 'Balcony Padlock',
    hostText:
      'Five letters. The tape was almost embarrassingly clear. Spell what our previous guest became.',
    wrongText:
      'A word, but not the one the balcony enjoys. The shackle is still listening.',
    hints: [
      'It is not a name. It is a verdict.',
      'The tape spelled it out on a padlock exactly like this one. Five letters, one loser.',
      'L, O, S, E, R. What he became. What you are not.',
    ],
  },
};

/** The pin whose scan routes to the tape playback screen before resolving. */
export const TAPE_PLAYBACK_PIN_ID = 12;

/** The in-app relight action; it has no printed code. */
export const RELIGHT_ACTION_PIN_ID = 24;

export const NON_PRINTED_PIN_IDS = new Set([RELIGHT_ACTION_PIN_ID]);
export const TROPHY_PIN_ID = 26;
export const SEALED_PRESENT_PIN_ID = 28;
export const FINAL_PRESENT_PIN_IDS = [27, SEALED_PRESENT_PIN_ID] as const;

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
      'There she is. Awake at last, birthday girl. Thirty-three years old today, and the house has been holding its breath all morning. Everything that happens next, I arranged for you. Walk the corridor slowly. Anticipation is the only gift I get to keep.',
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
      'A knife and a note, exactly where I promised myself you would find them. Take both. Every celebration needs something sharp, and every guest deserves instructions. The little deck beside you keeps memories better than people do. Give it this one.',
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
    resolution: 'ar',
    bodyText:
      'Hold the camera to my mark and let the shape settle. The last guest rushed this part. He was in such a hurry to be finished with the evening that he never saw what the wall was offering him. You were never like that. Look properly.',
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
      'The bathroom. Every morning you stand in here half-asleep, certain nothing is watching. Tonight the room would like to correct the record. Everything you need is already inside. None of it is where a polite host would leave it.',
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
      'Closer, Melissa. The mirror has kept every version of you it ever held, and tonight it will part with three of its figures. Do not ask the glass questions. Breathe on it, the way you do on cold mornings, and watch what it chooses to repeat.',
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
      'Reach into the cistern. Yes. In. There is a card waiting in the dark water with one mark on it, and one square shelf in this flat wears the same mark. The last guest checked every cell except the right one. He did not trust the water. Trust the water.',
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
      'Behind the curtain. Heavy, oiled, and not remotely festive. I would apologise for the tone of this particular present, but you will want it before the night is done, and I have never once heard you complain about being prepared.',
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
    refusalHint:
      'The wheels want the mirror\'s three figures, in the mirror\'s order. If the glass has not introduced them yet, go back and breathe on it.',
    bodyText:
      'Three wheels, and a mirror that has already made the introductions. Set them in the order the glass remembers and the cabinet gives up its chemistry. Then let the deck take another memory. You are doing better than he did. I keep the comparisons honest.',
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
    damage: 20,
    bodyText:
      'Lights out. Forgive me. No. I planned this for weeks and I regret nothing. Stand still if it helps. The dark in this flat is mine, and it has waited all day to meet you. The last guest ran. The corridor still remembers how he sounded.',
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
      'The front door has been told it is furniture tonight. Do not take it personally. Everything worth having is already on this side of it. I made very sure of that before you woke.',
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
      'Check the coat. Not your coat. The pocket has been carrying a home movie for a long time and has grown tired of the weight. Take it somewhere with a screen. Every household has one tape it never labels honestly.',
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
    refusalHint:
      'You arrived at the screening empty-handed. Check the coat by the front door; its pocket has been keeping something for you.',
    bodyText:
      'Press play. The guest before you left his finest hour on this tape. All of it true, none of it flattering. Watch what the padlock decided he was. He left you one useful word, and it cost him everything he came here to win.',
  },
  {
    id: 13,
    act: 3,
    zone: 'living',
    name: 'The Cushion',
    requires: [],
    requiresPin: [12],
    grants: [itemIds.keycardRed, itemIds.theAltar],
    kind: 'item',
    bodyText:
      'Under the seat you always take. A red card, one half of a paired invitation, and beneath it, flat and patient, the Altar. Lift the cushion properly and take both into your keeping. The ceremony they belong to is closer than you think.',
  },
  {
    id: 14,
    act: 3,
    zone: 'living',
    name: 'The Kallax',
    requires: [itemIds.kallaxGlyph],
    requiresPin: [13],
    grants: [itemIds.keycardBlue, itemIds.theHand],
    kind: 'puzzle',
    refusalHint:
      'Bare fingers will not choose the right cell. The card in the cistern knows which square; go and get your hand wet.',
    bodyText:
      'Sixteen cells, and one of them wears your wet little mark. Inside, the blue half of the invitation and the Hand. Yes, a hand. It will answer to yours and no one else\'s. The house has strange ideas about gifts. So does your Host.',
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
      'Lay the torch flat against the desk and let the light rake sideways. Pressed writing throws a shadow when the angle is cruel enough. The last guest held his light straight above it, like a man reading a menu. He remained hungry.',
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
    refusalHint:
      'The padlock listens for one word, and only the tape can teach it. Watch the screening to its end.',
    bodyText:
      'The padlock out here has a vocabulary of exactly one word, and the tape has already taught it to you. Spell what he became. Then step out and breathe. You have earned one cold, honest breath before the finale begins.',
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
    resolution: 'ar',
    bodyText:
      'The planter has been growing your insurance since spring. Take the herb. Study the valve. The draught you are about to meet is machinery pretending to be weather, and machinery can be made to stop. I planted everything here except the part that matters.',
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
    resolution: 'ar',
    damage: 30,
    refusalHint:
      'You walked in on our guest empty-handed. The shower left you something heavy for exactly this introduction. He will wait. He enjoys waiting.',
    bodyText:
      'Back inside. Slowly. The living room acquired a guest while you were out breathing my cold air, and nobody told him it is your birthday. You are carrying the shower\'s heavy present. Use it. He hates being ignored far more than he hates being shot.',
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
    refusalHint:
      'This door wants the red half, the blue half, and the desk\'s route. Arrive with all three, or do not arrive.',
    bodyText:
      'Both halves of the invitation, presented the way the desk taught you. The kitchen has been patient with you. So has your supper. So, frankly, have I, and patience was never the strongest part of my character.',
  },
  {
    id: 20,
    act: 4,
    zone: 'kitchen',
    name: 'Glass Mixture',
    requires: [itemIds.herb, itemIds.chemFluid],
    requiresPin: [19],
    grants: [itemIds.firstAid],
    kind: 'craft',
    refusalHint:
      'The glass wants both halves of the medicine: something grown and something poured. Half a recipe is only a poison, and I want you standing at the end.',
    bodyText:
      'Herb first, fluid second. Put them in a glass, mix, and drink it down when the edge gets close. It will taste like a garden fire, and it will pull you back. Once. That sound is your own heart. I checked.',
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
    damage: 25,
    bodyText:
      'Do not finish reading this. Turn around first. There. He stood close enough to count your eyelashes, and all he did was watch, because I asked nicely and I outrank him. That was the last favour I call in tonight. Steady hands now. The candle is next.',
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
      'Light the candle. One flame standing in for thirty-two absent friends. Guard it like it owes you money. The kitchen has opinions about open fire, and the loudest of them hangs on a wall, spinning, waiting to be introduced.',
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
      'Out. Just like that. One breath of moving air, and your little wish is smoke. I am nearly sorry. I needed you to feel it go out once, so that keeping it alive would mean something. Nothing in the dark behind you is new. Go and find another light.',
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
      'Strike. Cup. Shield. The flat has learned what your hands look like when they are protecting something, and so have I. This time, the flame travels with an escort.',
  },
  {
    id: 25,
    act: 5,
    zone: 'kitchen',
    name: 'The Fan',
    requires: [itemIds.valve],
    requiresPin: [24],
    grants: [itemIds.fanOff],
    kind: 'puzzle',
    refusalHint:
      'The fan cannot be argued with bare-handed. The balcony planter holds the piece that knows how it dies.',
    bodyText:
      'The draught has a source. Switch it off. Yes, the real fan, the one moving the air. The planter already told you it could be stopped, and you are carrying the how. Listen. Blades surrendering: the house admitting it cannot take this from you anymore. Nothing between you and the wish now but your own two feet.',
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
    refusalHint:
      'The wish needs a living flame and dead air. You are missing at least one, and the kitchen knows which.',
    bodyText:
      'Bring the flame into the still air and make the wish. Picture the other thirty-two candles: every year that carried you here, to my house, to my game, to the end of it. You won. He never did. Two last presents are unlocked: the box where you woke, and the paper in the kitchen. The house is finished being cruel.',
  },
  {
    id: 27,
    act: 5,
    zone: 'corridor',
    name: 'Full Circle',
    requires: [],
    requiresPin: [26],
    grants: [itemIds.note02],
    kind: 'flavour',
    bodyText:
      'The corridor box, back where you woke. Inside is the last thing I ever hid from you: a letter. Read it in good light, all the way to the signature. It was not written in the Host\'s hand. It never was.',
  },
  {
    id: SEALED_PRESENT_PIN_ID,
    act: 5,
    zone: 'kitchen',
    name: 'The Present',
    requires: [],
    requiresPin: [26],
    grants: [itemIds.carbonator],
    kind: 'sealed',
    scannableFromAct: 4,
    earlyRefusals: [
      'Already? Delightful. I know exactly what is under that paper. The birthday girl may open it after the candles.',
      'Back at the ribbon. Curious birthday girl. I know what is inside. I am still not telling.',
      'You do make waiting look difficult. The birthday present stays sealed until the wish. I chose it myself.',
      'Again? Wonderful. Your curiosity is the best part of this party. Candles first. Then the paper.',
    ],
    bodyText:
      'Open it. I have known what is under that paper for weeks, and keeping the secret nearly finished me, which would have been a twist worthy of the tape. It sparkles, like the water it makes. Happy birthday, from a man who was never as anonymous as he pretended to be.',
  },
];

export const TOTAL_PIN_COUNT = pins.length;
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


import type { Item, ItemId } from './types';
import { KALLAX_KEY_GLYPH_INDEX, kallaxKeyGlyph } from './glyphs';


export const itemIds = {
  knife: 'knife',
  note01: 'note01',
  code3: 'code3',
  kallaxGlyph: 'kallaxGlyph',
  pistol: 'pistol',
  chemFluid: 'chemFluid',
  tape: 'tape',
  knowLoser: 'knowLoser',
  keycardRed: 'keycardRed',
  keycardBlue: 'keycardBlue',
  knowKitchen: 'knowKitchen',
  herb: 'herb',
  valve: 'valve',
  firstAid: 'firstAid',
  candleLit: 'candleLit',
  fanOff: 'fanOff',
  carbonator: 'carbonator',
  theHand: 'theHand',
  theAltar: 'theAltar',
  note02: 'note02',
} as const satisfies Record<string, ItemId>;

/**
 * Every value granted by a pin has an entry here, including knowledge and
 * world-state tokens. Icons are bare slugs from the bundled game-icons set.
 */
export const items: readonly Item[] = [
  {
    id: itemIds.knife,
    name: 'Kitchen Knife',
    icon: 'bowie-knife',
    tint: 'boneDim',
    examine:
      'The edge has been sharpened recently. A dark line marks the handle where another hand gripped it too tightly.',
  },
  {
    id: itemIds.note01,
    name: 'Note 01',
    icon: 'secret-book',
    tint: 'bone',
    examine:
      'HAPPY THIRTY-THIRD. START WHERE THE HOUSE HAS BEEN MARKED. BRING THE CAMERA. DO NOT MAKE ME REPEAT MYSELF.',
  },
  {
    id: itemIds.code3,
    name: 'Three-Digit Code',
    icon: 'combination-lock',
    tint: 'amber',
    examine:
      'Three figures copied from the mirror. Their order feels deliberate, as if the glass expected them to be remembered.',
  },
  {
    id: itemIds.kallaxGlyph,
    name: 'Kallax Glyph Card',
    icon: kallaxKeyGlyph.icon,
    tint: 'amber',
    examine:
      `A damp card carrying GLYPH ${String(KALLAX_KEY_GLYPH_INDEX).padStart(2, '0')}. One Kallax cell wears the same mark.`,
  },
  {
    id: itemIds.pistol,
    name: 'M19 Handgun',
    icon: 'pistol-gun',
    tint: 'boneDim',
    examine:
      'Old, oiled, and heavier than it looks. The slide has been worked recently. Someone intended it to be found ready.',
  },
  {
    id: itemIds.chemFluid,
    name: 'Chem Fluid',
    icon: 'chemical-drop',
    tint: 'bile',
    examine:
      'A cloudy reagent in a scuffed bottle. The label promises nothing, but the sharp medicinal smell suggests a use.',
  },
  {
    id: itemIds.tape,
    name: 'Derelict Tape',
    icon: 'vhs',
    tint: 'boneDim',
    examine:
      'A video cassette with LOSER written across its label. The plastic is warm despite the cold room.',
  },
  {
    id: itemIds.knowLoser,
    name: 'The Loser Rule',
    icon: 'brain',
    tint: 'amber',
    examine:
      'The tape made the word important. A lock on the balcony was built to recognise the same ugly little lesson.',
  },
  {
    id: itemIds.keycardRed,
    name: 'Red Keycard',
    icon: 'key-card',
    tint: 'rust',
    examine:
      'The red half of a paired invitation. Three printed lines of numbers run down its face. Not codes. Chances. Keep it very safe after tonight.',
  },
  {
    id: itemIds.keycardBlue,
    name: 'Blue Keycard',
    icon: 'key-card',
    tint: 'slate',
    examine:
      'The blue half, pulled from the marked cell. Three more printed lines. Between red and blue you now hold six chances, and the Host insists they stay valuable long after his locks are open.',
  },
  {
    id: itemIds.knowKitchen,
    name: 'Kitchen Route',
    icon: 'treasure-map',
    tint: 'amber',
    examine:
      'Raking torchlight exposed a sequence pressed into the field desk. It describes how the kitchen door expects to be approached.',
  },
  {
    id: itemIds.herb,
    name: 'Green Herb',
    icon: 'herbs-bundle',
    tint: 'bile',
    examine:
      'A tough green herb with a bitter, clean smell. Its leaves have survived in soil that should have killed them.',
  },
  {
    id: itemIds.valve,
    name: 'Fan Shutoff',
    icon: 'valve',
    tint: 'boneDim',
    examine:
      'A reminder from the planter: the draught is machinery, not weather. The real fan can be switched off when the flame needs still air.',
  },
  {
    id: itemIds.firstAid,
    name: 'First Aid Med',
    icon: 'health-potion',
    tint: 'bile',
    examine:
      'A fresh medicinal mixture. Use it once to steady the body and restore health completely.',
    consumable: true,
  },
  {
    id: itemIds.candleLit,
    name: 'Living Flame',
    icon: 'candle-flame',
    tint: 'amber',
    examine:
      'A single candle burns with a narrow flame. Every movement of air bends it toward extinction.',
  },
  {
    id: itemIds.fanOff,
    name: 'Silent Fan',
    icon: 'wind-slap',
    tint: 'slate',
    examine:
      'The fan has stopped. In the sudden stillness, a candle might cross the kitchen without losing its flame.',
  },
  {
    id: itemIds.carbonator,
    name: 'Carbonator',
    icon: 'soda-can',
    tint: 'bone',
    examine:
      'The sealed birthday present at last. Heavy, useful, and chosen by someone who enjoyed knowing the answer before you did.',
  },
  {
    id: itemIds.theHand,
    name: 'The Hand',
    icon: 'hand',
    tint: 'bone',
    examine:
      'The Hand. It fits under your palm and clicks when pressed, which is a strange property for a relic. It will move a cursor with uncanny grace once the ceremony is over.',
  },
  {
    id: itemIds.theAltar,
    name: 'The Altar',
    icon: 'star-altar',
    tint: 'amber',
    examine:
      'The Altar: a soft, flat rectangle on which the Hand is meant to rest and glide. Domestic ritual equipment of the highest order. The pair belong on a desk you already own.',
  },
  {
    id: itemIds.note02,
    name: 'The Last Letter',
    icon: 'secret-book',
    tint: 'bone',
    examine:
      'Melissa. There was no previous guest. It was me, every year, standing in front of your birthday like a man in front of a padlock, and every year it read LOSER. Dinner. Flowers. A card, gone by morning. This year I built you a house instead, and you walked it better than I ever could. The padlock says WINNER now. It is yours. So am I. \u2014 M.',
  },
] as const;

export const itemById: Readonly<Partial<Record<ItemId, Item>>> =
  Object.fromEntries(items.map((item) => [item.id, item]));

export function getItemById(id: ItemId): Item | undefined {
  return itemById[id];
}


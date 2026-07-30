import type { Item, ItemId } from './types';

export const itemIds = {
  sealArtifact: 'sealArtifact',
  jarArtifact: 'jarArtifact',
  reliquaryArtifact: 'reliquaryArtifact',
  candleArtifact: 'candleArtifact',
  giftMat: 'giftMat',
  giftMouse: 'giftMouse',
  giftSlips: 'giftSlips',
  carbonator: 'carbonator',
  fragment01: 'fragment01',
  fragment02: 'fragment02',
  fragment03: 'fragment03',
  fragment04: 'fragment04',
} as const satisfies Record<string, ItemId>;

/**
 * Everything the terminal takes into custody: the Keeper's bench artifacts,
 * the four gifts, and the four quarters of the letter (readable in Files).
 */
export const items: readonly Item[] = [
  {
    id: itemIds.sealArtifact,
    name: 'The Keeper\'s seal',
    icon: 'combination-lock',
    tint: 'amber',
    examine:
      'A bronze seal from the first lock. Five rooms and one blank face. The bronze is warm, which the Keeper asks you not to think about.',
  },
  {
    id: itemIds.jarArtifact,
    name: 'Specimen jar',
    icon: 'chemical-drop',
    tint: 'bile',
    examine:
      'From the second lock: a jar the Keeper kept beside the door. Something small was studied here, catalogued kindly, and let go.',
  },
  {
    id: itemIds.reliquaryArtifact,
    name: 'Reliquary',
    icon: 'locked-chest',
    tint: 'amber',
    examine:
      'From the third lock: a box for keeping wagers. Lighter than it looks and colder than it should be.',
  },
  {
    id: itemIds.candleArtifact,
    name: 'The Keeper\'s candle',
    icon: 'candle-flame',
    tint: 'amber',
    examine:
      'From the last lock: the candle the Keeper lit the night the letter was sealed. It has thirty-two brothers waiting.',
  },
  {
    id: itemIds.giftMat,
    name: 'A flat place',
    icon: 'star-altar',
    tint: 'bone',
    examine:
      'Gift the first: a flat place for a small animal to run. Rolled, tied, and held in trust for thirty-three years.',
  },
  {
    id: itemIds.giftMouse,
    name: 'The small grey runner',
    icon: 'hand',
    tint: 'bone',
    examine:
      'Gift the second: it fits under a palm and clicks. The Keeper trusts you will get along famously.',
  },
  {
    id: itemIds.giftSlips,
    name: 'Two lucky slips',
    icon: 'key-card',
    tint: 'rust',
    examine:
      'Gift the third: six lines, three red, three blue. Thirty-three chances, by the Keeper\'s arithmetic. Worth whatever the future decides.',
  },
  {
    id: itemIds.carbonator,
    name: 'The sparkle',
    icon: 'soda-can',
    tint: 'bone',
    examine:
      'Gift the last, chosen by the Keeper himself. It breathes in silver and breathes out stars. Released to the one it always belonged to.',
  },
  {
    id: itemIds.fragment01,
    name: 'Letter, first quarter',
    icon: 'secret-book',
    tint: 'boneDim',
    examine:
      'To the one born while I watched the door: I counted your first night in this world, and I have counted every one since.',
  },
  {
    id: itemIds.fragment02,
    name: 'Letter, second quarter',
    icon: 'secret-book',
    tint: 'boneDim',
    examine:
      'Some things are sealed not to hide them, but to keep them safe until they are grown into.',
  },
  {
    id: itemIds.fragment03,
    name: 'Letter, third quarter',
    icon: 'secret-book',
    tint: 'boneDim',
    examine:
      'The gifts were never mine. They were always yours; I only held the locks.',
  },
  {
    id: itemIds.fragment04,
    name: 'Letter, last quarter',
    icon: 'secret-book',
    tint: 'boneDim',
    examine:
      'The last one breathes in silver and breathes out stars, and it is waiting where water sleeps. Happy birthday, Melissa. The building is proud of you. Signed, the Keeper.',
  },
] as const;

export const itemById: Readonly<Partial<Record<ItemId, Item>>> =
  Object.fromEntries(items.map((item) => [item.id, item]));

export function getItemById(id: ItemId): Item | undefined {
  return itemById[id];
}

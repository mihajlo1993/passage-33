import type { colours } from './tokens';

export type ZoneId =
  | 'corridor'
  | 'bathroom'
  | 'entry'
  | 'living'
  | 'balcony'
  | 'kitchen';

export type Act = 1 | 2 | 3 | 4 | 5;
export type ItemId = string;
export type PinResolutionMode = 'scan' | 'dial' | 'action' | 'ar';
export type PinResolutionMethod = PinResolutionMode | 'dev';


export interface Item {
  id: ItemId;
  name: string;
  icon: string;
  tint?: keyof colours;
  examine: string;
  consumable?: boolean;
}

export interface Pin {
  id: number;
  act: Act;
  zone: ZoneId;
  name: string;
  requires: ItemId[];
  requiresPin?: number[];
  grants: ItemId[];
  kind:
    | 'flavour'
    | 'item'
    | 'save'
    | 'puzzle'
    | 'scare'
    | 'craft'
    | 'gate'
    | 'win';
  arTarget?: 'sheet01' | 'sheet02';
  scare?: 'torchKill' | 'roomMonster' | 'closeQuarters';
  damage?: number;
  resolution?: PinResolutionMode;
  bodyText: string;
}

export interface GameState {
  act: Act;
  health: number;
  inventory: ItemId[];
  resolvedPins: number[];
  clearedZones: ZoneId[];
  lastSavePin: number | null;
  startedAt: number;
  finishedAt: number | null;
}


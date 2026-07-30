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
export type HostVoiceId =
  | 'cold-open'
  | 'tape'
  | 'draught'
  | 'trophy'
  | 'present';
export type PinResolutionMode =
  | 'scan'
  | 'dial'
  | 'action'
  | 'ar'
  | 'wipe'
  | 'glyphs'
  | 'slot'
  | 'valve'
  | 'shadow';
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
    | 'win'
    | 'sealed';
  scannableFromAct?: Act;
  earlyRefusals?: readonly [string, string, string, string, ...string[]];
  arTarget?: 'sheet01' | 'sheet02';
  scare?: 'torchKill' | 'roomMonster' | 'closeQuarters';
  damage?: number;
  resolution?: PinResolutionMode;
  /** The Host's riddle shown BEFORE she hunts; bodyText is the payoff after. */
  objective: string;
  /** Button label for action-resolved pins. */
  actionLabel?: string;
  /** Choreography for action beats that need staging before they resolve. */
  beat?: 'blackout' | 'behindYou' | 'carry' | 'mix' | 'hold';
  /** Pin-specific line used when this pin refuses for missing items or pins. */
  refusalHint?: string;
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
  trophyAt: number | null;
  finishedAt: number | null;
  playedVoiceIds: HostVoiceId[];
}


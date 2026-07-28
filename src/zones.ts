import type { Act, ZoneId } from './types';

export interface ZoneDefinition {
  id: ZoneId;
  name: string;
  acts: readonly Act[];
  /** Dimensionless grid units; presentation decides their rendered size. */
  grid: {
    column: number;
    row: number;
    columnSpan: number;
    rowSpan: number;
  };
}

export interface ZoneConnection {
  zones: readonly [ZoneId, ZoneId];
  passage: 'open' | 'door';
  lockedUntilPin?: number;
}

export const zones: readonly ZoneDefinition[] = [
  {
    id: 'corridor',
    name: 'Corridor',
    acts: [1, 5],
    grid: { column: 1, row: 3, columnSpan: 2, rowSpan: 1 },
  },
  {
    id: 'bathroom',
    name: 'Bathroom',
    acts: [2],
    grid: { column: 2, row: 1, columnSpan: 1, rowSpan: 2 },
  },
  {
    id: 'entry',
    name: 'Entry',
    acts: [3],
    grid: { column: 3, row: 3, columnSpan: 1, rowSpan: 1 },
  },
  {
    id: 'living',
    name: 'Living Room',
    acts: [3],
    grid: { column: 4, row: 2, columnSpan: 2, rowSpan: 2 },
  },
  {
    id: 'balcony',
    name: 'Balcony',
    acts: [3],
    grid: { column: 6, row: 2, columnSpan: 1, rowSpan: 2 },
  },
  {
    id: 'kitchen',
    name: 'Kitchen',
    acts: [4, 5],
    grid: { column: 3, row: 1, columnSpan: 1, rowSpan: 2 },
  },
] as const;

export const zoneById: Readonly<Record<ZoneId, ZoneDefinition>> =
  Object.fromEntries(zones.map((zone) => [zone.id, zone])) as Record<
    ZoneId,
    ZoneDefinition
  >;

export const zoneConnections: readonly ZoneConnection[] = [
  { zones: ['entry', 'living'], passage: 'open' },
  { zones: ['entry', 'kitchen'], passage: 'door' },
  { zones: ['entry', 'corridor'], passage: 'open' },
  { zones: ['corridor', 'bathroom'], passage: 'door' },
  { zones: ['living', 'balcony'], passage: 'door', lockedUntilPin: 16 },
] as const;

export const zoneAdjacency: Readonly<Record<ZoneId, readonly ZoneId[]>> = {
  corridor: ['entry', 'bathroom'],
  bathroom: ['corridor'],
  entry: ['living', 'kitchen', 'corridor'],
  living: ['entry', 'balcony'],
  balcony: ['living'],
  kitchen: ['entry'],
};

export const mapLandmarks = {
  start: { zone: 'corridor' as const, edge: 'far' as const },
  frontDoor: { zone: 'entry' as const, opens: false },
} as const;


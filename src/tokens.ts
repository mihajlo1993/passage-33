/**
 * Visual constants for the Baker House interface.
 *
 * Values with physical units name that unit explicitly so callers can use the
 * same source for inline styles, CSS custom properties, timers, and canvas
 * drawing without maintaining a second token table.
 */
export const colours = {
  void: '#0B0A08',
  surface: '#14120E',
  raised: '#1F1B15',
  hairline: '#2C2620',
  bone: '#D8D2C4',
  boneDim: '#8A8377',
  rust: '#8E2A1E',
  rustHot: '#C4351F',
  slate: '#2E5A73',
  bile: '#6E7A2E',
  amber: '#B8843A',
} as const;

// Kept as a type with the requested name so Item.tint can be `keyof colours`.
export type colours = typeof colours;
export type ColourName = keyof colours;

export const typography = {
  fontFamily: {
    ui: '"Archivo Narrow", "Arial Narrow", sans-serif',
    doc: '"Courier Prime", "Courier New", monospace',
    award: '"Special Elite", "Courier New", serif',
  },
  uiLetterSpacing: '0.08em',
  scalePx: {
    micro: 11,
    small: 13,
    body: 15,
    heading: 19,
    title: 26,
    display: 40,
  },
  lineHeight: {
    tight: 1,
    ui: 1.2,
    body: 1.5,
  },
} as const;

export const motion = {
  durationMs: {
    fast: 180,
    base: 280,
    slow: 420,
  },
  eventMs: {
    saveTheatre: 2000,
    torchKill: 1800,
    scanInterval: 120,
    scanDuplicate: 1500,
  },
  easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
} as const;

export const eventMs = motion.eventMs;

/** Dimension tokens are intentionally square, spare, and mechanical. */
export const layout = {
  hairlinePx: 1,
  frameMaxWidthPx: 430,
  touchTargetPx: 44,
  controlHeightPx: 48,
  radiusPx: {
    square: 0,
    subtle: 2,
  },
  spacingPx: {
    none: 0,
    hair: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    huge: 48,
  },
  iconSizePx: {
    small: 18,
    body: 24,
    large: 40,
    examine: 64,
  },
} as const;


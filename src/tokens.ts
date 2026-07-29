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
  chromaRed: '#7A211D',
  chromaCyan: '#246673',
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
    trackingRoll: 200,
    vhsDamageSpike: 360,
    vhsCriticalDrop: 120,
    vhsCriticalInterval: 2200,
    arAcquire: 12000,
    arImageReveal: 2800,
    arHerbReward: 2400,
    arHit: 180,
    arCollapseLead: 700,
    arCollapseDuration: 2400,
    operatorLongPress: 3000,
    operatorSequenceWindow: 2000,
  },
  tape: {
    stillDurationsMs: [4800, 5200, 4600, 5000, 5400, 4800, 6500],
    blackoutMs: 1200,
    timecodeTickMs: 100,
    headSwitchMs: 180,
  },
  easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
} as const;

export const eventMs = motion.eventMs;

export const effects = {
  vhs: {
    renderScale: 0.5,
    maxFps: 30,
    grainCycleFrames: 3,
    dropoutMinPx: 1,
    dropoutMaxPx: 4,
    tearMinPx: 12,
    tearMaxPx: 20,
    scanlineStepPx: 3,
    jitterChance: 0.035,
    hardRollChance: 0.0015,
    maxBlurPx: 0.55,
    maxChromaPx: 2,
    saturateLoss: 0.14,
    contrastGain: 0.22,
  },
  ar: {
    maxFps: 30,
    renderPixelRatioMax: 1.25,
    wallPeelScale: 1.08,
    wallReachScale: 1.16,
    wallShoulderDegrees: 14,
    wallUvDisplacement: 0.035,
    herbPulseScale: 1.06,
    herbLiftMeters: 0.06,
    monsterHeightMeters: 1.8,
    monsterCollapseDegrees: -90,
    fallbackSpriteWidthPercent: 54,
    wallFallbackReachXPercent: 8,
    wallFallbackReachYPercent: -12,
    roomTransferXPercent: 50,
    roomTransferYPercent: 72,
    herbFallbackLiftPercent: -8,
    screenShakePx: 8,
  },
  tape: {
    forcedVhsIntensity: 0.9,
    timecodeFps: 30,
  },
} as const;

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


/**
 * Visual constants for the Baker House interface.
 *
 * Values with physical units name that unit explicitly so callers can use the
 * same source for inline styles, CSS custom properties, timers, and canvas
 * drawing without maintaining a second token table.
 */
/**
 * The measured Resident Evil ramp. Panels are TRUE black; every "white" is
 * warm bone; selection inverts (bone fill, ink text); red is rationed to one
 * element per screen and is never a button.
 */
export const colours = {
  void: '#000000',
  surface: '#050504',
  raised: '#1A1815',
  hairline: '#3A352E',
  bone: '#E4DBD2',
  boneBright: '#F2ECE2',
  boneMuted: '#D8D0C2',
  boneDim: '#877F78',
  textHi: '#ECE3DC',
  text: '#C4BCB2',
  textMute: '#6E6A64',
  ink: '#241F1A',
  plate: '#6E6963',
  plateHi: '#7E7B76',
  plateLo: '#56514D',
  rust: '#B0261E',
  rustHot: '#D63A2E',
  mapRed: '#58332F',
  slate: '#354A52',
  bile: '#5CBF3A',
  amber: '#C88A3C',
  ecg: '#2FBF6F',
  ecgCaution: '#D8C33A',
  ecgOrange: '#E08A22',
  chromaRed: '#7A211D',
  chromaCyan: '#246673',
  printBlack: '#000000',
  printWhite: '#FFFFFF',
} as const;

/** Warm hairline runs; always these, never neutral grey borders. */
export const lines = {
  line: 'rgba(200, 190, 175, 0.28)',
  lineSoft: 'rgba(200, 190, 175, 0.14)',
  lineWarm: 'rgba(160, 140, 110, 0.30)',
  tick: 'rgba(210, 200, 185, 0.75)',
} as const;

/** Layered surface treatments; dimming is always flat multiply, never blur. */
export const surfaces = {
  sceneDim:
    'linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.48) 45%, rgba(0,0,0,0.86) 100%)',
  vignette:
    'radial-gradient(ellipse 120% 120% at 50% 45%, transparent 28%, rgba(0,0,0,0.50) 74%, rgba(0,0,0,0.94) 100%)',
  glowSelect: '0 0 18px 4px rgba(255, 248, 236, 0.45)',
  glowCombine: '0 0 20px 5px rgba(232, 192, 96, 0.55)',
  shadowItem: '2px 4px 5px rgba(0, 0, 0, 0.45)',
  shadowProp: '3px 6px 10px rgba(0, 0, 0, 0.75)',
  grainOpacity: 0.045,
} as const;

// Kept as a type with the requested name so Item.tint can be `keyof colours`.
export type colours = typeof colours;
export type ColourName = keyof colours;

export const typography = {
  fontFamily: {
    // Libre Franklin is the open revival of RE7's Franklin Gothic.
    ui: '"Libre Franklin", "Franklin Gothic Medium", "Arial", sans-serif',
    display: '"Archivo Narrow", "Arial Narrow", sans-serif',
    doc: '"Courier Prime", "Courier New", monospace',
    award: '"Special Elite", "Courier New", serif',
  },
  // RE tracking scale: body 0, labels 0.005, caps 0.08, titles 0.12, menu 0.18.
  uiLetterSpacing: '0.005em',
  capsLetterSpacing: '0.08em',
  titleLetterSpacing: '0.12em',
  menuLetterSpacing: '0.18em',
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


import { effects } from "../tokens";
import type {
  VHSFrameGeometry,
  VHSHealthProfile,
  VHSRandomSource,
  VHSRenderProfile,
} from "./types";

export const VHS_HEALTH_ANCHORS = [
  { health: 100, intensity: 0.05 },
  { health: 60, intensity: 0.14 },
  { health: 40, intensity: 0.3 },
  { health: 20, intensity: 0.5 },
  { health: 0, intensity: 0.5 },
] as const;

export const VHS_FRAME_INTERVAL_MS = 1_000 / effects.vhs.maxFps;

export function clampVHSIntensity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function clampHealth(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(100, Math.max(0, value));
}

/** Piecewise-linear interpolation keeps damage changes gradual between anchors. */
export function getVHSHealthProfile(value: number): VHSHealthProfile {
  const health = clampHealth(value);
  let intensity: number = VHS_HEALTH_ANCHORS.at(-1)!.intensity;

  for (let index = 0; index < VHS_HEALTH_ANCHORS.length - 1; index += 1) {
    const upper = VHS_HEALTH_ANCHORS[index];
    const lower = VHS_HEALTH_ANCHORS[index + 1];
    if (health > upper.health || health < lower.health) continue;

    const distance = upper.health - lower.health;
    const progress = distance === 0 ? 0 : (upper.health - health) / distance;
    intensity = upper.intensity + (lower.intensity - upper.intensity) * progress;
    break;
  }

  return {
    health,
    intensity: clampVHSIntensity(intensity),
    unstableTimecode: health <= 40,
    periodicDropFrames: health < 20,
  };
}

/**
 * Resolves all visual scalars in one pure function. A disabled profile is
 * deliberately neutral so stale CSS properties cannot degrade interaction.
 */
export function getVHSRenderProfile(
  value: number,
  disabled: boolean,
): VHSRenderProfile {
  if (disabled) {
    return {
      disabled: true,
      intensity: 0,
      canvasOpacity: 0,
      saturation: 1,
      contrast: 1,
      blurPx: 0,
      chromaOffsetPx: 0,
    };
  }

  const intensity = clampVHSIntensity(value);
  return {
    disabled: false,
    intensity,
    canvasOpacity: intensity * 0.46,
    saturation: 1 - intensity * effects.vhs.saturateLoss,
    contrast: 1 + intensity * effects.vhs.contrastGain,
    blurPx: intensity * effects.vhs.maxBlurPx,
    chromaOffsetPx: intensity * effects.vhs.maxChromaPx,
  };
}

export function randomIntegerInclusive(
  minimum: number,
  maximum: number,
  random: VHSRandomSource = Math.random,
): number {
  const low = Math.ceil(Math.min(minimum, maximum));
  const high = Math.floor(Math.max(minimum, maximum));
  const sample = Math.min(1 - Number.EPSILON, Math.max(0, random()));
  return low + Math.floor(sample * (high - low + 1));
}

export function sampleVHSFrameGeometry(
  value: number,
  disabled: boolean,
  random: VHSRandomSource = Math.random,
): VHSFrameGeometry {
  if (disabled) {
    return { dropoutHeightPx: 0, tearHeightPx: 0, jitterYPx: 0 };
  }

  const intensity = clampVHSIntensity(value);
  const maximumJitterPx = Math.max(
    effects.vhs.dropoutMinPx,
    Math.round(effects.vhs.dropoutMaxPx * intensity),
  );

  return {
    dropoutHeightPx: randomIntegerInclusive(
      effects.vhs.dropoutMinPx,
      effects.vhs.dropoutMaxPx,
      random,
    ),
    tearHeightPx: randomIntegerInclusive(
      effects.vhs.tearMinPx,
      effects.vhs.tearMaxPx,
      random,
    ),
    jitterYPx: randomIntegerInclusive(-maximumJitterPx, maximumJitterPx, random),
  };
}

export function isVHSFrameDue(
  timestampMs: number,
  lastRenderedAtMs: number | null,
): boolean {
  if (lastRenderedAtMs === null) return true;
  return timestampMs - lastRenderedAtMs >= VHS_FRAME_INTERVAL_MS;
}

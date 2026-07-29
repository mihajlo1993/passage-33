import type { ReactNode } from "react";

export interface VHSControls {
  setIntensity: (intensity: number) => void;
  glitch: (durationMs: number) => void;
  dropFrames: (durationMs: number) => void;
  setTimecode: (timecode: string | null) => void;
  suspend: (suspended: boolean) => void;
}

export interface VHSLayerProps {
  disabled: boolean;
  children: ReactNode;
}

export interface VHSHealthProfile {
  health: number;
  intensity: number;
  unstableTimecode: boolean;
  periodicDropFrames: boolean;
}

export interface VHSRenderProfile {
  disabled: boolean;
  intensity: number;
  canvasOpacity: number;
  saturation: number;
  contrast: number;
  blurPx: number;
  chromaOffsetPx: number;
}

export interface VHSFrameGeometry {
  dropoutHeightPx: number;
  tearHeightPx: number;
  jitterYPx: number;
}

export type VHSRandomSource = () => number;

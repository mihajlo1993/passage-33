import type { DetailedHTMLProps, HTMLAttributes } from "react";

/**
 * Minimal surface of the <model-viewer> custom element, loaded from the
 * vendored bundle at /vendor/model-viewer.min.js (BSD-3-Clause, Google).
 * The bundle carries its own three.js and never touches the app bundle.
 */
export interface ModelViewerOrbit {
  theta: number;
  phi: number;
  radius: number;
}

export interface ModelViewerElement extends HTMLElement {
  getCameraOrbit(): ModelViewerOrbit;
  jumpCameraToGoal(): void;
  cameraOrbit: string;
  loaded: boolean;
}

type ModelViewerAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  src?: string;
  alt?: string;
  poster?: string;
  loading?: "auto" | "lazy" | "eager";
  reveal?: "auto" | "manual";
  exposure?: number | string;
  "shadow-intensity"?: number | string;
  "shadow-softness"?: number | string;
  "camera-controls"?: boolean;
  "disable-pan"?: boolean;
  "disable-tap"?: boolean;
  "touch-action"?: "none" | "pan-x" | "pan-y";
  "interaction-prompt"?: "auto" | "none";
  "camera-orbit"?: string;
  "min-camera-orbit"?: string;
  "max-camera-orbit"?: string;
  "field-of-view"?: string;
  "environment-image"?: string;
  "tone-mapping"?: string;
  autoplay?: boolean;
  "animation-name"?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerAttributes;
    }
  }
}

declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerAttributes;
    }
  }
}

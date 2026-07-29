import type { ZoneId } from "../types";
import rawManifest from "./manifest.json";
import type { AudioCategory, AudioManifestEntry, ImpulseManifestEntry } from "./types";

interface AudioMetadata {
  readonly id: string;
  readonly category: AudioCategory;
  readonly fileName: string;
  readonly durationMs: number;
  readonly loop: boolean;
  readonly pinId?: number;
  readonly purpose: string;
}

interface ImpulseMetadata {
  readonly id: string;
  readonly zone: ZoneId;
  readonly fileName: string;
  readonly durationMs: number;
  readonly preDelayMs: number;
  readonly wet: number;
  readonly seed: number;
  readonly filterCoefficient: number;
  readonly decayPower: number;
  readonly purpose: string;
}

export interface AudioAssetRecord extends AudioManifestEntry {
  readonly fileName: string;
  readonly durationMs: number;
  readonly purpose: string;
}

export interface ImpulseAssetRecord extends ImpulseManifestEntry {
  readonly fileName: string;
  readonly durationMs: number;
  readonly durationSeconds: number;
  readonly preDelayMs: number;
  readonly seed: number;
  readonly filterCoefficient: number;
  readonly decayPower: number;
  readonly purpose: string;
}

const metadata = rawManifest as unknown as {
  readonly audio: readonly AudioMetadata[];
  readonly impulses: readonly ImpulseMetadata[];
};

function publicAudioPath(fileName: string): string {
  const segments = fileName.replaceAll("\\", "/").split("/");
  if (
    segments.length === 0
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Invalid public audio filename: ${fileName}`);
  }
  return `/audio/${segments.join("/")}`;
}

export const audioManifest: readonly AudioAssetRecord[] = metadata.audio.map(
  (entry) => ({
    ...entry,
    durationSeconds: entry.durationMs / 1_000,
    mimeType: entry.category === "voice" ? "audio/mpeg" as const : "audio/wav" as const,
    publicPath: publicAudioPath(entry.fileName),
  }),
);

export const impulseManifest: readonly ImpulseAssetRecord[] = metadata.impulses.map(
  (entry) => ({
    ...entry,
    durationSeconds: entry.durationMs / 1_000,
    mimeType: "audio/wav" as const,
    publicPath: publicAudioPath(entry.fileName),
  }),
);

/** Complete public audio inventory for Workbox/config integration. */
export const audioPrecachePaths = [
  ...audioManifest.map(({ publicPath }) => publicPath),
  ...impulseManifest.map(({ publicPath }) => publicPath),
] as const;

export const audioAssets = audioManifest;
export const impulseAssets = impulseManifest;

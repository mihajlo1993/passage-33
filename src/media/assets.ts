import { generatedMediaAssets } from "./generated/media.generated";

export type MediaAssetId =
  | "coldOpen"
  | "tape01"
  | "tape02"
  | "tape03"
  | "tape04"
  | "tape05"
  | "tape06"
  | "tape07"
  | "trophy"
  | "creature"
  | "appIcon"
  | "sheet01"
  | "sheet02";

export interface AvailableMediaAsset {
  readonly available: true;
  readonly sourceFileName: string;
  readonly sourceWidth: number;
  readonly sourceHeight: number;
  readonly width: number;
  readonly height: number;
  readonly png: {
    readonly url: string;
    readonly bytes: number;
    readonly sha256: string;
  };
  readonly webp: {
    readonly url: string;
    readonly bytes: number;
    readonly sha256: string;
  } | null;
  readonly blackKeyed: boolean;
  readonly reason: string | null;
}

export interface MissingMediaAsset {
  readonly available: false;
  readonly sourceFileName: string;
  readonly sourceWidth: null;
  readonly sourceHeight: null;
  readonly width: number;
  readonly height: number;
  readonly png: null;
  readonly webp: null;
  readonly blackKeyed: boolean;
  readonly reason: string;
}

export type MediaAsset = AvailableMediaAsset | MissingMediaAsset;

export const MEDIA_ASSETS = generatedMediaAssets.assets as unknown as Readonly<
  Record<MediaAssetId, MediaAsset>
>;

export const MISSING_MEDIA_ASSETS = generatedMediaAssets.missing;
export const MEDIA_ASSET_ERRORS = generatedMediaAssets.errors;

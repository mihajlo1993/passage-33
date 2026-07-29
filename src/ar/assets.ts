import { generatedArAssets } from "./generated/ar-assets.generated";

import type { ImageArSheetId } from "./types";

export const AR_SHEET_ORDER = ["sheet01", "sheet02"] as const satisfies readonly ImageArSheetId[];

export interface ArSheetAsset {
  readonly spriteUrl: `/ar/sprites/${ImageArSheetId}.webp`;
  readonly width: number;
  readonly height: number;
  readonly byteLength: number;
  readonly placeholder: boolean;
}

export interface ArCreatureAsset {
  readonly url: "/ar/textures/creature.webp";
  readonly width: 1024;
  readonly height: 2048;
  readonly byteLength: number;
  readonly placeholder: boolean;
  readonly blackKeyed: true;
  readonly sourcePngSha256: string;
}

if (
  generatedArAssets.sheetOrder.length !== AR_SHEET_ORDER.length
  || generatedArAssets.sheetOrder.some((sheet, index) => sheet !== AR_SHEET_ORDER[index])
) {
  throw new Error("Generated AR sheet order is stale. Run the AR asset generator.");
}

export const AR_SHEET_ASSETS: Readonly<Record<ImageArSheetId, ArSheetAsset>> = Object.freeze({
  sheet01: Object.freeze({
    spriteUrl: generatedArAssets.sheets.sheet01.spriteUrl,
    width: generatedArAssets.sheets.sheet01.width,
    height: generatedArAssets.sheets.sheet01.height,
    byteLength: generatedArAssets.sheets.sheet01.byteLength,
    placeholder: generatedArAssets.sheets.sheet01.placeholder,
  }),
  sheet02: Object.freeze({
    spriteUrl: generatedArAssets.sheets.sheet02.spriteUrl,
    width: generatedArAssets.sheets.sheet02.width,
    height: generatedArAssets.sheets.sheet02.height,
    byteLength: generatedArAssets.sheets.sheet02.byteLength,
    placeholder: generatedArAssets.sheets.sheet02.placeholder,
  }),
});

export const AR_CREATURE_ASSET: ArCreatureAsset = Object.freeze({
  url: generatedArAssets.creature.url,
  width: generatedArAssets.creature.width as 1024,
  height: generatedArAssets.creature.height as 2048,
  byteLength: generatedArAssets.creature.byteLength,
  placeholder: generatedArAssets.creature.placeholder,
  blackKeyed: generatedArAssets.creature.blackKeyed,
  sourcePngSha256: generatedArAssets.creature.sourcePngSha256,
});

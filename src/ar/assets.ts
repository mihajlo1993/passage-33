import { generatedArAssets } from "./generated/ar-assets.generated";

import type { ImageArSheetId } from "./types";

export const AR_SHEET_ORDER = ["sheet01", "sheet02"] as const satisfies readonly ImageArSheetId[];

export interface ArSheetAsset {
  readonly spriteDataUri: string;
  readonly width: number;
  readonly height: number;
  readonly placeholder: boolean;
}

export interface ArCreatureAsset {
  readonly dataUri: string;
  readonly width: 1024;
  readonly height: 2048;
  readonly placeholder: boolean;
  readonly blackKeyed: true;
}

if (
  generatedArAssets.sheetOrder.length !== AR_SHEET_ORDER.length
  || generatedArAssets.sheetOrder.some((sheet, index) => sheet !== AR_SHEET_ORDER[index])
) {
  throw new Error("Generated AR sheet order is stale. Run the AR asset generator.");
}

export const AR_SHEET_ASSETS: Readonly<Record<ImageArSheetId, ArSheetAsset>> = Object.freeze({
  sheet01: Object.freeze({
    spriteDataUri: generatedArAssets.sheets.sheet01.spriteDataUri,
    width: generatedArAssets.sheets.sheet01.width,
    height: generatedArAssets.sheets.sheet01.height,
    placeholder: generatedArAssets.sheets.sheet01.placeholder,
  }),
  sheet02: Object.freeze({
    spriteDataUri: generatedArAssets.sheets.sheet02.spriteDataUri,
    width: generatedArAssets.sheets.sheet02.width,
    height: generatedArAssets.sheets.sheet02.height,
    placeholder: generatedArAssets.sheets.sheet02.placeholder,
  }),
});

export const AR_CREATURE_ASSET: ArCreatureAsset = Object.freeze({
  dataUri: generatedArAssets.creature.dataUri,
  width: generatedArAssets.creature.width as 1024,
  height: generatedArAssets.creature.height as 2048,
  placeholder: generatedArAssets.creature.placeholder,
  blackKeyed: generatedArAssets.creature.blackKeyed,
});

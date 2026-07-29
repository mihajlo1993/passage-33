import { generatedArAssets } from "./generated/ar-assets.generated";

import type { ImageArTargetId } from "./types";

export const AR_TARGET_ORDER = ["sheet01", "sheet02"] as const satisfies readonly ImageArTargetId[];

export interface ArTargetDatabaseAsset {
  /** A new owned copy on every read, so MindAR cannot mutate the embedded source. */
  readonly bytes: Uint8Array;
  readonly placeholder: boolean;
  readonly fileName: string;
}

export interface ArSheetAsset {
  readonly paperDataUri: string;
  readonly overlayDataUri: string;
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

function decodeBase64(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

if (
  generatedArAssets.targetOrder.length !== AR_TARGET_ORDER.length
  || generatedArAssets.targetOrder.some((target, index) => target !== AR_TARGET_ORDER[index])
) {
  throw new Error("Generated AR target order is stale. Run the AR asset generator.");
}

const embeddedTargetDatabaseBytes = decodeBase64(generatedArAssets.targetDatabase.base64);

export const AR_TARGET_DATABASE: ArTargetDatabaseAsset = Object.freeze({
  get bytes(): Uint8Array {
    return embeddedTargetDatabaseBytes.slice();
  },
  placeholder: generatedArAssets.targetDatabase.placeholder,
  fileName: generatedArAssets.targetDatabase.fileName,
});

export const AR_SHEET_ASSETS: Readonly<Record<ImageArTargetId, ArSheetAsset>> = Object.freeze({
  sheet01: Object.freeze({
    paperDataUri: generatedArAssets.sheets.sheet01.paperDataUri,
    overlayDataUri: generatedArAssets.sheets.sheet01.overlayDataUri,
    width: generatedArAssets.sheets.sheet01.width,
    height: generatedArAssets.sheets.sheet01.height,
    placeholder: generatedArAssets.sheets.sheet01.placeholder,
  }),
  sheet02: Object.freeze({
    paperDataUri: generatedArAssets.sheets.sheet02.paperDataUri,
    overlayDataUri: generatedArAssets.sheets.sheet02.overlayDataUri,
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

export function targetDatabaseBuffer(): ArrayBuffer {
  return embeddedTargetDatabaseBytes.slice().buffer as ArrayBuffer;
}

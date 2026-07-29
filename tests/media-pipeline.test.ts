import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { createCanvas, loadImage } from "canvas";

const processorUrl = pathToFileURL(path.resolve("scripts/process-image-assets.mjs")).href;

interface MediaProcessorModule {
  processMediaAssets(options: Record<string, unknown>): Promise<{
    readonly records: Record<string, {
      readonly available: boolean;
      readonly png?: unknown;
      readonly webp?: unknown;
      readonly reason?: unknown;
    }>;
    readonly missing: readonly string[];
    readonly errors: readonly unknown[];
    readonly placeholderSheets: readonly string[];
    readonly stale: boolean;
  }>;
}

async function mediaProcessor(): Promise<MediaProcessorModule> {
  return await import(processorUrl) as MediaProcessorModule;
}

function sourcePng(width: number, height: number, withBlackKey = false): Buffer {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.fillStyle = withBlackKey ? "rgb(0, 0, 0)" : "rgb(64, 48, 32)";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "rgb(102, 118, 61)";
  context.fillRect(width * 0.35, height * 0.2, width * 0.3, height * 0.6);
  return canvas.toBuffer("image/png");
}

async function imageDimensions(file: string): Promise<readonly [number, number]> {
  const image = await loadImage(readFileSync(file));
  return [image.width, image.height];
}

function webpDimensions(file: string): readonly [number, number] {
  const bytes = readFileSync(file);
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const fourCc = bytes.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const payload = offset + 8;
    if (fourCc === "VP8 ") {
      assert.deepEqual([...bytes.subarray(payload + 3, payload + 6)], [0x9d, 0x01, 0x2a]);
      return [
        bytes.readUInt16LE(payload + 6) & 0x3fff,
        bytes.readUInt16LE(payload + 8) & 0x3fff,
      ];
    }
    if (fourCc === "VP8L") {
      assert.equal(bytes[payload], 0x2f);
      const packed = bytes.readUInt32LE(payload + 1);
      return [
        (packed & 0x3fff) + 1,
        ((packed >>> 14) & 0x3fff) + 1,
      ];
    }
    if (fourCc === "VP8X") {
      return [
        bytes.readUIntLE(payload + 4, 3) + 1,
        bytes.readUIntLE(payload + 7, 3) + 1,
      ];
    }
    offset = payload + chunkSize + (chunkSize % 2);
  }

  assert.fail(`${file} contains no WebP image chunk`);
}

test("media pipeline is deterministic, non-fatal for missing sources, and emits WebP plus PNG", async () => {
  const { processMediaAssets } = await mediaProcessor();
  const root = mkdtempSync(path.join(tmpdir(), "bh7-media-"));
  const incoming = path.join(root, "incoming");
  const publicDirectory = path.join(root, "public");
  const generatedFile = path.join(root, "generated", "media.generated.ts");
  mkdirSync(incoming, { recursive: true });
  writeFileSync(path.join(incoming, "tape-01.png"), sourcePng(32, 18));
  writeFileSync(path.join(incoming, "creature.png"), sourcePng(16, 32, true));
  writeFileSync(path.join(incoming, "app-icon.png"), sourcePng(24, 24));
  writeFileSync(path.join(incoming, "sheet01.png"), sourcePng(20, 20));

  try {
    const result = await processMediaAssets({
      sourceDirectory: incoming,
      publicDirectory,
      generatedFile,
      legacyTrophyFile: false,
      quiet: true,
    });

    assert.equal(result.errors.length, 0);
    assert.equal(result.records.tape01?.available, true);
    assert.equal(result.records.creature?.available, true);
    assert.equal(result.records.sheet01?.available, true);
    assert.equal(result.records.sheet02?.available, false);
    assert.equal(result.records.coldOpen?.available, false);
    assert.ok(result.missing.includes("cold-open.png"));
    assert.ok(result.missing.includes("sheet02.png"));
    assert.deepEqual(
      await imageDimensions(path.join(publicDirectory, "media", "tape-01.png")),
      [640, 360],
    );
    assert.deepEqual(
      await imageDimensions(path.join(publicDirectory, "icons", "icon-192.png")),
      [192, 192],
    );
    assert.deepEqual(
      await imageDimensions(path.join(publicDirectory, "icons", "icon-512.png")),
      [512, 512],
    );
    assert.deepEqual(
      await imageDimensions(path.join(publicDirectory, "media", "sheet01.png")),
      [1754, 2480],
    );

    const sheet = await loadImage(
      readFileSync(path.join(publicDirectory, "media", "sheet01.png")),
    );
    const decodedSheet = createCanvas(sheet.width, sheet.height);
    const sheetContext = decodedSheet.getContext("2d");
    sheetContext.drawImage(sheet, 0, 0);
    assert.deepEqual(
      [...sheetContext.getImageData(0, 0, 1, 1).data],
      [255, 255, 255, 255],
      "contain must letterbox rather than crop or stretch",
    );
    assert.deepEqual(
      [...sheetContext.getImageData(877, 1240, 1, 1).data],
      [102, 118, 61, 255],
      "the complete source remains centred on the A4 canvas",
    );

    const tapeWebp = readFileSync(path.join(publicDirectory, "media", "tape-01.webp"));
    assert.equal(tapeWebp.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(tapeWebp.subarray(8, 12).toString("ascii"), "WEBP");

    const creature = await loadImage(
      readFileSync(path.join(publicDirectory, "ar", "textures", "creature.png")),
    );
    const decoded = createCanvas(creature.width, creature.height);
    const context = decoded.getContext("2d");
    context.drawImage(creature, 0, 0);
    assert.equal(context.getImageData(0, 0, 1, 1).data[3], 0);
    assert.equal(
      context.getImageData(
        Math.floor(creature.width / 2),
        Math.floor(creature.height / 2),
        1,
        1,
      ).data[3],
      255,
    );

    const firstModule = readFileSync(generatedFile, "utf8");
    const checked = await processMediaAssets({
      sourceDirectory: incoming,
      publicDirectory,
      generatedFile,
      legacyTrophyFile: false,
      checkOnly: true,
      quiet: true,
    });
    assert.equal(checked.stale, false);
    assert.equal(readFileSync(generatedFile, "utf8"), firstModule);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("media pipeline loudly warns but does not fail for decorative prop-sheet placeholders", async () => {
  const { processMediaAssets } = await mediaProcessor();
  const root = mkdtempSync(path.join(tmpdir(), "bh7-media-placeholder-sheet-"));
  const incoming = path.join(root, "incoming");
  const publicDirectory = path.join(root, "public");
  const generatedFile = path.join(root, "generated", "media.generated.ts");
  mkdirSync(incoming, { recursive: true });
  writeFileSync(path.join(incoming, "sheet01.png"), sourcePng(20, 20));
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...values: unknown[]) => warnings.push(values.map(String).join(" "));

  try {
    const placeholderResult = await processMediaAssets({
      sourceDirectory: incoming,
      publicDirectory,
      generatedFile,
      legacyTrophyFile: false,
      warnPropSheetPlaceholders: true,
      quiet: true,
    });

    assert.equal(existsSync(generatedFile), true, "decorative sheets never block generated output");
    assert.deepEqual(placeholderResult.placeholderSheets, ["sheet02"]);
    assert.deepEqual(warnings, ["[media-assets] WARNING: placeholder prop sheets: sheet02"]);

    writeFileSync(path.join(incoming, "sheet02.png"), sourcePng(20, 20));
    warnings.length = 0;
    const result = await processMediaAssets({
      sourceDirectory: incoming,
      publicDirectory,
      generatedFile,
      legacyTrophyFile: false,
      warnPropSheetPlaceholders: true,
      quiet: true,
    });

    assert.equal(result.records.sheet02?.available, true);
    assert.deepEqual(result.placeholderSheets, []);
    assert.deepEqual(warnings, []);
    assert.deepEqual(
      await imageDimensions(path.join(publicDirectory, "media", "sheet02.png")),
      [1754, 2480],
    );
    assert.deepEqual(
      webpDimensions(path.join(publicDirectory, "media", "sheet02.webp")),
      [1754, 2480],
    );
  } finally {
    console.warn = originalWarn;
    rmSync(root, { recursive: true, force: true });
  }
});

test("media pipeline keeps a usable PNG when the optional WebP encoder is unavailable", async () => {
  const { processMediaAssets } = await mediaProcessor();
  const root = mkdtempSync(path.join(tmpdir(), "bh7-media-png-fallback-"));
  const incoming = path.join(root, "incoming");
  const publicDirectory = path.join(root, "public");
  const generatedFile = path.join(root, "generated", "media.generated.ts");
  mkdirSync(incoming, { recursive: true });
  writeFileSync(path.join(incoming, "tape-01.png"), sourcePng(32, 18));

  try {
    const result = await processMediaAssets({
      sourceDirectory: incoming,
      publicDirectory,
      generatedFile,
      legacyTrophyFile: false,
      ffmpegCommand: "bh7-no-such-ffmpeg",
      quiet: true,
    });

    const tape = result.records.tape01;
    assert.equal(tape?.available, true);
    assert.ok(tape?.png);
    assert.equal(tape?.webp, null);
    assert.match(String(tape?.reason), /FFmpeg WebP encoder unavailable/);
    assert.equal(existsSync(path.join(publicDirectory, "media", "tape-01.png")), true);
    assert.equal(existsSync(path.join(publicDirectory, "media", "tape-01.webp")), false);
    assert.equal(result.errors.length, 1);
    assert.equal(existsSync(generatedFile), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("media pipeline preserves encoder fallbacks and refuses real asset overwrite", async () => {
  const { processMediaAssets } = await mediaProcessor();
  const root = mkdtempSync(path.join(tmpdir(), "bh7-media-guard-"));
  const incoming = path.join(root, "incoming");
  const publicDirectory = path.join(root, "public");
  const generatedFile = path.join(root, "generated", "media.generated.ts");
  const sourceFile = path.join(incoming, "tape-01.png");
  const pngFile = path.join(publicDirectory, "media", "tape-01.png");
  const webpFile = path.join(publicDirectory, "media", "tape-01.webp");
  mkdirSync(incoming, { recursive: true });
  writeFileSync(sourceFile, sourcePng(32, 18));

  try {
    await processMediaAssets({
      sourceDirectory: incoming,
      publicDirectory,
      generatedFile,
      legacyTrophyFile: false,
      quiet: true,
    });
    const originalWebp = readFileSync(webpFile);

    const withoutEncoder = await processMediaAssets({
      sourceDirectory: incoming,
      publicDirectory,
      generatedFile,
      legacyTrophyFile: false,
      ffmpegCommand: "bh7-no-such-ffmpeg",
      quiet: true,
    });
    assert.deepEqual(readFileSync(webpFile), originalWebp);
    assert.ok(withoutEncoder.records.tape01?.webp);
    assert.match(
      String(withoutEncoder.records.tape01?.reason),
      /preserved verified existing WebP/,
    );

    const protectedFiles = [pngFile, webpFile, generatedFile];
    const before = protectedFiles.map((file) => readFileSync(file));
    rmSync(sourceFile);
    await assert.rejects(
      processMediaAssets({
        sourceDirectory: incoming,
        publicDirectory,
        generatedFile,
        legacyTrophyFile: false,
        quiet: true,
      }),
      /Refusing to orphan existing non-placeholder asset/,
    );
    assert.deepEqual(
      protectedFiles.map((file) => readFileSync(file)),
      before,
    );

    writeFileSync(sourceFile, sourcePng(32, 18, true));
    await assert.rejects(
      processMediaAssets({
        sourceDirectory: incoming,
        publicDirectory,
        generatedFile,
        legacyTrophyFile: false,
        quiet: true,
      }),
      /Refusing to overwrite existing non-placeholder asset/,
    );
    assert.deepEqual(
      protectedFiles.map((file) => readFileSync(file)),
      before,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

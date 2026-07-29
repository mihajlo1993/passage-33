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
    assert.equal(result.records.coldOpen?.available, false);
    assert.ok(result.missing.includes("cold-open.png"));
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

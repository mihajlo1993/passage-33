import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

import { createCanvas, loadImage } from "canvas";

import {
  AR_CREATURE_ASSET,
  AR_SHEET_ASSETS,
  AR_TARGET_DATABASE,
  AR_TARGET_ORDER,
  targetDatabaseBuffer,
} from "../src/ar/assets";

interface PixelImage {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}

interface GeneratedPayload {
  targetOrder: string[];
  targetDatabase: {
    base64: string;
    placeholder: boolean;
    fileName: string;
  };
  sheets: Record<"sheet01" | "sheet02", {
    paperDataUri: string;
    overlayDataUri: string;
    width: number;
    height: number;
    placeholder: boolean;
  }>;
  creature: {
    dataUri: string;
    width: number;
    height: number;
    placeholder: boolean;
    blackKeyed: boolean;
  };
  sourceMode: Record<string, string>;
}

const root = fileURLToPath(new URL("..", import.meta.url));
const generatorUrl = pathToFileURL(path.join(root, "scripts", "generate-ar-assets.mjs")).href;

async function generator(): Promise<{
  generateArAssets(options: {
    sourceDirectory: string;
    outputDirectory: string;
    checkOnly?: boolean;
    quiet?: boolean;
  }): Promise<{
    outputFile: string;
    stale: boolean;
    sourceMode: Record<string, string>;
    targetOrder: readonly string[];
  }>;
}> {
  return import(generatorUrl);
}

function parseGeneratedModule(file: string): GeneratedPayload {
  const source = readFileSync(file, "utf8");
  const prefix = "export const generatedArAssets = ";
  const suffix = " as const;\n";
  const start = source.indexOf(prefix);
  assert.notEqual(start, -1);
  assert.ok(source.endsWith(suffix));
  return JSON.parse(source.slice(start + prefix.length, -suffix.length)) as GeneratedPayload;
}

async function decodePng(dataUri: string): Promise<PixelImage> {
  assert.match(dataUri, /^data:image\/png;base64,/);
  const encoded = dataUri.slice(dataUri.indexOf(",") + 1);
  const bytes = Buffer.from(encoded, "base64");
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const image = await loadImage(bytes);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  return {
    width: image.width,
    height: image.height,
    pixels: context.getImageData(0, 0, image.width, image.height).data,
  };
}

function writePng(
  file: string,
  width: number,
  height: number,
  draw: (context: ReturnType<ReturnType<typeof createCanvas>["getContext"]>) => void,
): void {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  draw(context);
  writeFileSync(file, canvas.toBuffer("image/png", { compressionLevel: 9 }));
}

function writeSourceFixture(sourceDirectory: string): void {
  mkdirSync(sourceDirectory, { recursive: true });
  for (const [id, ink] of [["sheet01", 52], ["sheet02", 76]] as const) {
    writePng(path.join(sourceDirectory, `${id}.png`), 1754, 2480, (context) => {
      context.fillStyle = "rgba(181, 169, 139, 1)";
      context.fillRect(0, 0, 1754, 2480);
      context.fillStyle = `rgba(${ink}, ${ink - 5}, ${ink - 11}, 1)`;
      context.fillRect(430, 540, 720, 1120);
      context.strokeStyle = "rgba(118, 103, 79, 1)";
      context.lineWidth = 18;
      context.strokeRect(100, 120, 1554, 2240);
    });
    writePng(path.join(sourceDirectory, `${id}-mask.png`), 1754, 2480, (context) => {
      context.fillStyle = "rgba(255, 255, 255, 1)";
      context.fillRect(430, 540, 720, 1120);
    });
  }

  writePng(path.join(sourceDirectory, "monster-source.png"), 1024, 2048, (context) => {
    context.fillStyle = "rgba(0, 0, 0, 1)";
    context.fillRect(0, 0, 1024, 2048);
    context.fillStyle = "rgba(31, 29, 25, 1)";
    context.fillRect(330, 280, 364, 1500);
  });
}

test("public AR assets preserve target order and return owned target bytes", () => {
  assert.deepEqual(AR_TARGET_ORDER, ["sheet01", "sheet02"]);
  assert.equal(AR_TARGET_DATABASE.fileName, "targets.mind");
  assert.equal(AR_TARGET_DATABASE.placeholder, true);
  const first = AR_TARGET_DATABASE.bytes;
  const second = AR_TARGET_DATABASE.bytes;
  assert.notEqual(first, second);
  assert.deepEqual(first, second);
  const sentinel = Buffer.from(first).toString("utf8");
  assert.match(sentinel, /target index 0: sheet01/);
  assert.match(sentinel, /target index 1: sheet02/);

  first[0] = 0;
  assert.notEqual(AR_TARGET_DATABASE.bytes[0], 0);
  const buffer = targetDatabaseBuffer();
  assert.ok(buffer instanceof ArrayBuffer);
  assert.equal(buffer.byteLength, second.byteLength);
  assert.deepEqual(new Uint8Array(buffer), second);
});

test("embedded paper and isolated overlays are decodable and pixel-related", async () => {
  for (const id of AR_TARGET_ORDER) {
    const asset = AR_SHEET_ASSETS[id];
    assert.equal(asset.width, 512);
    assert.equal(asset.height, 724);
    assert.equal(asset.placeholder, true);
    const paper = await decodePng(asset.paperDataUri);
    const overlay = await decodePng(asset.overlayDataUri);
    assert.deepEqual([paper.width, paper.height], [asset.width, asset.height]);
    assert.deepEqual([overlay.width, overlay.height], [asset.width, asset.height]);

    let transparent = 0;
    let opaque = 0;
    let matchedOpaquePixel = false;
    for (let offset = 0; offset < overlay.pixels.length; offset += 4) {
      assert.equal(paper.pixels[offset + 3], 255, `${id} paper is opaque`);
      const alpha = overlay.pixels[offset + 3];
      if (alpha === 0) transparent += 1;
      if (alpha === 255) {
        opaque += 1;
        if (
          overlay.pixels[offset] === paper.pixels[offset]
          && overlay.pixels[offset + 1] === paper.pixels[offset + 1]
          && overlay.pixels[offset + 2] === paper.pixels[offset + 2]
        ) {
          matchedOpaquePixel = true;
        }
      }
    }
    assert.ok(transparent > paper.width * paper.height * 0.2, `${id} overlay has transparent isolation`);
    assert.ok(opaque > 500, `${id} overlay has visible drawing pixels`);
    assert.equal(matchedOpaquePixel, true, `${id} overlay comes from its photographed paper pixels`);
  }
});

test("creature is decoded at 1024x2048 after exact black-to-alpha keying", async () => {
  assert.deepEqual(
    {
      width: AR_CREATURE_ASSET.width,
      height: AR_CREATURE_ASSET.height,
      placeholder: AR_CREATURE_ASSET.placeholder,
      blackKeyed: AR_CREATURE_ASSET.blackKeyed,
    },
    { width: 1024, height: 2048, placeholder: false, blackKeyed: true },
  );
  const creature = await decodePng(AR_CREATURE_ASSET.dataUri);
  assert.deepEqual([creature.width, creature.height], [1024, 2048]);
  let transparent = 0;
  let visible = 0;
  let opaqueBlack = 0;
  for (let offset = 0; offset < creature.pixels.length; offset += 4) {
    const red = creature.pixels[offset];
    const green = creature.pixels[offset + 1];
    const blue = creature.pixels[offset + 2];
    const alpha = creature.pixels[offset + 3];
    if (alpha === 0) transparent += 1;
    else {
      visible += 1;
      if (red === 0 && green === 0 && blue === 0) opaqueBlack += 1;
    }
  }
  assert.ok(transparent > creature.width * creature.height * 0.25);
  assert.ok(visible > 100);
  assert.equal(opaqueBlack, 0, "every exact-black source pixel was keyed transparent");
});

test("generator output is deterministic and --check/--quiet is clean", async (context) => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "re7bday-ar-placeholder-"));
  context.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));
  const sourceDirectory = path.join(temporaryRoot, "source");
  const outputDirectory = path.join(temporaryRoot, "generated");
  mkdirSync(sourceDirectory, { recursive: true });
  const { generateArAssets } = await generator();
  const first = await generateArAssets({ sourceDirectory, outputDirectory, quiet: true });
  const firstSource = readFileSync(first.outputFile, "utf8");
  const second = await generateArAssets({ sourceDirectory, outputDirectory, quiet: true });
  assert.equal(readFileSync(second.outputFile, "utf8"), firstSource);
  const checked = await generateArAssets({ sourceDirectory, outputDirectory, checkOnly: true, quiet: true });
  assert.equal(checked.stale, false);
  assert.deepEqual(checked.targetOrder, ["sheet01", "sheet02"]);

  const cli = spawnSync(process.execPath, ["scripts/generate-ar-assets.mjs", "--check", "--quiet"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.equal(cli.stdout, "");
  assert.equal(cli.stderr, "");
});

test("real source mode validates, composes, keys, and preserves database order", async (context) => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "re7bday-ar-source-"));
  context.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));
  const sourceDirectory = path.join(temporaryRoot, "source");
  const outputDirectory = path.join(temporaryRoot, "generated");
  writeSourceFixture(sourceDirectory);

  const msgpackName = "@msgpack/msgpack";
  const { encode, decode } = await import(msgpackName) as typeof import("@msgpack/msgpack");
  const mindBytes = encode({
    v: 2,
    dataList: [
      {
        targetImage: { width: 1754, height: 2480 },
        matchingData: [{ source: "sheet01" }],
        trackingData: [],
      },
      {
        targetImage: { width: 1754, height: 2480 },
        matchingData: [{ source: "sheet02" }],
        trackingData: [],
      },
    ],
  });
  writeFileSync(path.join(sourceDirectory, "targets.mind"), mindBytes);

  const { generateArAssets } = await generator();
  const result = await generateArAssets({ sourceDirectory, outputDirectory, quiet: true });
  assert.deepEqual(result.sourceMode, {
    sheet01: "source",
    sheet02: "source",
    creature: "source",
    targets: "source",
  });
  assert.deepEqual(result.targetOrder, ["sheet01", "sheet02"]);

  const generated = parseGeneratedModule(result.outputFile);
  assert.deepEqual(generated.targetOrder, ["sheet01", "sheet02"]);
  assert.equal(generated.targetDatabase.placeholder, false);
  assert.equal(generated.targetDatabase.fileName, "targets.mind");
  const decodedMind = decode(Buffer.from(generated.targetDatabase.base64, "base64")) as {
    dataList: Array<{ matchingData: Array<{ source: string }> }>;
  };
  assert.deepEqual(decodedMind.dataList.map((entry) => entry.matchingData[0]?.source), ["sheet01", "sheet02"]);
  assert.equal(generated.sheets.sheet01.placeholder, false);
  assert.equal(generated.sheets.sheet02.placeholder, false);
  assert.equal(generated.creature.placeholder, false);
  assert.equal(generated.creature.blackKeyed, true);

  const sourceCreature = await decodePng(generated.creature.dataUri);
  const backgroundAlpha = sourceCreature.pixels[3];
  const creatureOffset = (500 * sourceCreature.width + 500) * 4;
  assert.equal(backgroundAlpha, 0);
  assert.equal(sourceCreature.pixels[creatureOffset + 3], 255);
  assert.notDeepEqual([...sourceCreature.pixels.slice(creatureOffset, creatureOffset + 3)], [0, 0, 0]);
});

test("source photographs are rejected unless dimensions are exact", async (context) => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "re7bday-ar-invalid-"));
  context.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));
  const sourceDirectory = path.join(temporaryRoot, "source");
  mkdirSync(sourceDirectory, { recursive: true });
  for (const name of ["sheet01.png", "sheet01-mask.png"]) {
    writePng(path.join(sourceDirectory, name), 100, 100, (context2d) => {
      context2d.fillStyle = "rgba(255, 255, 255, 1)";
      context2d.fillRect(0, 0, 100, 100);
    });
  }
  const { generateArAssets } = await generator();
  await assert.rejects(
    generateArAssets({
      sourceDirectory,
      outputDirectory: path.join(temporaryRoot, "generated"),
      quiet: true,
    }),
    /sheet01\.png must be exactly 1754x2480/,
  );
});

test("non-author target instructions specify every offline source contract", () => {
  const docs = readFileSync(path.join(root, "src", "ar", "TARGETS.md"), "utf8");
  for (const required of [
    "1754 pixels wide by 2480 pixels high",
    "sheet01.png",
    "sheet01-mask.png",
    "sheet02.png",
    "sheet02-mask.png",
    "targets.mind",
    "monster-source.png",
    "targetIndex",
    "node scripts/generate-ar-assets.mjs --check",
    "target index 0",
    "target index 1",
    "pure-black background",
  ]) {
    assert.ok(docs.includes(required), `TARGETS.md includes ${required}`);
  }

  const runtimeSource = readFileSync(path.join(root, "src", "ar", "assets.ts"), "utf8");
  assert.doesNotMatch(runtimeSource, /canvas|fetch\s*\(|https?:\/\//i);
  assert.doesNotMatch(runtimeSource, /#[\da-f]{3,8}\b/i);
});

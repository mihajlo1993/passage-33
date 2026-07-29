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

import { createCanvas } from "canvas";

import {
  AR_CREATURE_ASSET,
  AR_SHEET_ASSETS,
  AR_SHEET_ORDER,
} from "../src/ar/assets";

interface PixelImage {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}

interface GeneratedPayload {
  sheetOrder: string[];
  sheets: Record<"sheet01" | "sheet02", {
    spriteUrl: string;
    width: number;
    height: number;
    byteLength: number;
    placeholder: boolean;
    sourceMode: string;
  }>;
  creature: {
    url: string;
    width: number;
    height: number;
    byteLength: number;
    placeholder: boolean;
    blackKeyed: boolean;
    sourcePngSha256: string;
  };
  sourceMode: Record<string, string>;
}

const root = fileURLToPath(new URL("..", import.meta.url));
const generatorUrl = pathToFileURL(
  path.join(root, "scripts", "generate-ar-assets.mjs"),
).href;

async function generator(): Promise<{
  generateArAssets(options: {
    sourceDirectory: string;
    incomingDirectory?: string | false;
    outputDirectory: string;
    publicDirectory?: string;
    checkOnly?: boolean;
    quiet?: boolean;
  }): Promise<{
    outputFile: string;
    moduleBytes: number;
    publicBytes: number;
    publicFiles: readonly string[];
    stale: boolean;
    sourceMode: Record<string, string>;
    sheetOrder: readonly string[];
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
  return JSON.parse(
    source.slice(start + prefix.length, -suffix.length),
  ) as GeneratedPayload;
}

function publicAssetPath(url: string, publicDirectory = path.join(root, "public")): string {
  assert.match(url, /^\/ar\/(?:sprites|textures)\/[a-z0-9-]+\.webp$/);
  return path.join(publicDirectory, ...url.slice(1).split("/"));
}

function decodeWebp(file: string, width: number, height: number): PixelImage {
  const bytes = readFileSync(file);
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
  const decoded = spawnSync(
    "ffmpeg",
    [
      "-v", "error",
      "-i", file,
      "-frames:v", "1",
      "-f", "rawvideo",
      "-pix_fmt", "rgba",
      "pipe:1",
    ],
    {
      encoding: null,
      maxBuffer: width * height * 4 + 1024,
      windowsHide: true,
    },
  );
  assert.equal(decoded.status, 0, String(decoded.stderr ?? ""));
  assert.ok(Buffer.isBuffer(decoded.stdout));
  assert.equal(decoded.stdout.length, width * height * 4);
  return {
    width,
    height,
    pixels: new Uint8ClampedArray(decoded.stdout),
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
    });
    writePng(path.join(sourceDirectory, `${id}-mask.png`), 1754, 2480, (context) => {
      context.fillStyle = "rgba(0, 0, 0, 1)";
      context.fillRect(0, 0, 1754, 2480);
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

test("public AR assets contain only ordered 2D sprites and the room creature", async () => {
  assert.deepEqual(AR_SHEET_ORDER, ["sheet01", "sheet02"]);
  for (const id of AR_SHEET_ORDER) {
    const asset = AR_SHEET_ASSETS[id];
    assert.deepEqual([asset.width, asset.height], [512, 724]);
    assert.equal(asset.spriteUrl, `/ar/sprites/${id}.webp`);
    const sprite = decodeWebp(
      publicAssetPath(asset.spriteUrl),
      asset.width,
      asset.height,
    );
    assert.deepEqual([sprite.width, sprite.height], [512, 724]);
    assert.equal(readFileSync(publicAssetPath(asset.spriteUrl)).length, asset.byteLength);
    assert.equal(typeof asset.placeholder, "boolean");
    assert.ok(
      sprite.pixels.some((value, offset) => offset % 4 === 3 && value > 0),
      `${id} sprite has visible pixels`,
    );
  }
});

test("creature uses one local WebP while retaining the exact keyed PNG hash", () => {
  assert.deepEqual(
    {
      width: AR_CREATURE_ASSET.width,
      height: AR_CREATURE_ASSET.height,
      placeholder: AR_CREATURE_ASSET.placeholder,
      blackKeyed: AR_CREATURE_ASSET.blackKeyed,
      sourcePngSha256: AR_CREATURE_ASSET.sourcePngSha256,
    },
    {
      width: 1024,
      height: 2048,
      placeholder: false,
      blackKeyed: true,
      sourcePngSha256:
        "c0e4a81439ebd2cb6a916abe96ea49389a058a387df790be8e39fa17c47fa546",
    },
  );
  assert.equal(AR_CREATURE_ASSET.url, "/ar/textures/creature.webp");
  const creature = decodeWebp(
    publicAssetPath(AR_CREATURE_ASSET.url),
    AR_CREATURE_ASSET.width,
    AR_CREATURE_ASSET.height,
  );
  let transparent = 0;
  let visible = 0;
  for (let offset = 0; offset < creature.pixels.length; offset += 4) {
    const alpha = creature.pixels[offset + 3];
    if (alpha === 0) transparent += 1;
    else visible += 1;
  }
  assert.ok(transparent > creature.width * creature.height * 0.25);
  assert.ok(visible > 100);
  assert.equal(
    readFileSync(publicAssetPath(AR_CREATURE_ASSET.url)).length,
    AR_CREATURE_ASSET.byteLength,
  );
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
  const firstPublicAssets = first.publicFiles.map((file) => readFileSync(file));
  const second = await generateArAssets({ sourceDirectory, outputDirectory, quiet: true });
  assert.equal(readFileSync(second.outputFile, "utf8"), firstSource);
  assert.deepEqual(
    second.publicFiles.map((file) => readFileSync(file)),
    firstPublicAssets,
  );
  assert.ok(first.moduleBytes < 16_384);
  assert.equal(
    first.publicBytes,
    firstPublicAssets.reduce((total, bytes) => total + bytes.length, 0),
  );
  const checked = await generateArAssets({
    sourceDirectory,
    outputDirectory,
    checkOnly: true,
    quiet: true,
  });
  assert.equal(checked.stale, false);
  assert.deepEqual(checked.sheetOrder, ["sheet01", "sheet02"]);

  const cli = spawnSync(
    process.execPath,
    ["scripts/generate-ar-assets.mjs", "--check", "--quiet"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
  assert.equal(cli.stdout, "");
  assert.equal(cli.stderr, "");
});

test("paired source masks isolate sprites without any tracking database", async (context) => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "re7bday-ar-source-"));
  context.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));
  const sourceDirectory = path.join(temporaryRoot, "source");
  const outputDirectory = path.join(temporaryRoot, "generated");
  writeSourceFixture(sourceDirectory);

  const { generateArAssets } = await generator();
  const result = await generateArAssets({ sourceDirectory, outputDirectory, quiet: true });
  assert.deepEqual(result.sourceMode, {
    sheet01: "source",
    sheet02: "source",
    creature: "source",
  });
  assert.deepEqual(result.sheetOrder, ["sheet01", "sheet02"]);

  const generated = parseGeneratedModule(result.outputFile);
  assert.deepEqual(generated.sheetOrder, ["sheet01", "sheet02"]);
  assert.equal(generated.sheets.sheet01.placeholder, false);
  assert.equal(generated.sheets.sheet02.placeholder, false);
  assert.equal(generated.creature.placeholder, false);
  assert.equal(generated.creature.blackKeyed, true);
  const sheet = decodeWebp(
    publicAssetPath(
      generated.sheets.sheet01.spriteUrl,
      path.join(temporaryRoot, "public"),
    ),
    generated.sheets.sheet01.width,
    generated.sheets.sheet01.height,
  );
  const alphaAtCorner = sheet.pixels[3];
  const subjectOffset = (300 * sheet.width + 200) * 4;
  assert.equal(alphaAtCorner, 0);
  assert.ok(sheet.pixels[subjectOffset + 3] > 0);
});

test("incoming print art becomes a full-page 2D sprite at arbitrary portrait size", async (context) => {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "re7bday-ar-incoming-"));
  context.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));
  const sourceDirectory = path.join(temporaryRoot, "source");
  const incomingDirectory = path.join(temporaryRoot, "incoming");
  const outputDirectory = path.join(temporaryRoot, "generated");
  mkdirSync(sourceDirectory, { recursive: true });
  mkdirSync(incomingDirectory, { recursive: true });
  for (const id of ["sheet01", "sheet02"] as const) {
    writePng(path.join(incomingDirectory, `${id}.png`), 941, 1672, (context2d) => {
      context2d.fillStyle = "rgba(222, 211, 184, 1)";
      context2d.fillRect(0, 0, 941, 1672);
      context2d.fillStyle = "rgba(52, 45, 37, 1)";
      context2d.fillRect(300, 350, 340, 900);
    });
  }

  const { generateArAssets } = await generator();
  const result = await generateArAssets({
    sourceDirectory,
    incomingDirectory,
    outputDirectory,
    quiet: true,
  });
  assert.deepEqual(result.sourceMode, {
    sheet01: "incoming",
    sheet02: "incoming",
    creature: "placeholder",
  });
  const generated = parseGeneratedModule(result.outputFile);
  assert.equal(generated.sheets.sheet01.placeholder, false);
  assert.equal(generated.sheets.sheet02.placeholder, false);
  assert.deepEqual(
    [generated.sheets.sheet01.width, generated.sheets.sheet01.height],
    [512, 724],
  );
  assert.equal(
    readFileSync(
      publicAssetPath(
        generated.sheets.sheet01.spriteUrl,
        path.join(temporaryRoot, "public"),
      ),
    ).length,
    generated.sheets.sheet01.byteLength,
  );
});

test("legacy masked sources are rejected unless dimensions are exact", async (context) => {
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

test("source handoff documents pure 2D offline inputs and no target compiler", () => {
  const docs = readFileSync(
    path.join(root, "src", "ar", "assets", "source", "README.md"),
    "utf8",
  );
  for (const required of [
    "screen-space tap placement",
    "assets-incoming/sheet01.png",
    "assets-incoming/sheet02.png",
    "sheet01-mask.png",
    "sheet02-mask.png",
    "npm run generate:ar",
    "No runtime image processing",
  ]) {
    assert.ok(docs.includes(required), `source README includes ${required}`);
  }
  assert.doesNotMatch(docs, /target compiler/i);

  const runtimeSource = readFileSync(path.join(root, "src", "ar", "assets.ts"), "utf8");
  assert.doesNotMatch(runtimeSource, /canvas|fetch\s*\(|https?:\/\//i);
  assert.doesNotMatch(runtimeSource, /#[\da-f]{3,8}\b/i);
});

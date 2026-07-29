import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createCanvas, loadImage } from "canvas";

const SHEET_ORDER = Object.freeze(["sheet01", "sheet02"]);
const SOURCE_SHEET_WIDTH = 1754;
const SOURCE_SHEET_HEIGHT = 2480;
const RUNTIME_SHEET_WIDTH = 512;
const RUNTIME_SHEET_HEIGHT = 724;
const CREATURE_WIDTH = 1024;
const CREATURE_HEIGHT = 2048;
const MAX_GENERATED_MODULE_BYTES = 16 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const WEBP_RIFF = Buffer.from("RIFF", "ascii");
const WEBP_SIGNATURE = Buffer.from("WEBP", "ascii");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSourceDirectory = path.join(repoRoot, "src", "ar", "assets", "source");
const defaultIncomingDirectory = path.join(repoRoot, "assets-incoming");
const defaultOutputDirectory = path.join(repoRoot, "src", "ar", "generated");
const defaultPublicDirectory = path.join(repoRoot, "public");

function invariant(condition, message) {
  if (!condition) throw new Error(`[ar-assets] ${message}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function pngBytes(canvas) {
  return canvas.toBuffer("image/png", { compressionLevel: 9 });
}

function webpBytes(canvas, label, ffmpegCommand = "ffmpeg") {
  const encoded = spawnSync(
    ffmpegCommand,
    [
      "-v", "error",
      "-fflags", "+bitexact",
      "-f", "image2pipe",
      "-vcodec", "png",
      "-i", "pipe:0",
      "-map_metadata", "-1",
      "-frames:v", "1",
      "-c:v", "libwebp",
      "-quality", "82",
      "-compression_level", "6",
      "-preset", "picture",
      "-f", "webp",
      "pipe:1",
    ],
    {
      input: pngBytes(canvas),
      encoding: null,
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
    },
  );
  invariant(
    encoded.error === undefined,
    `${label} WebP encoder is unavailable: ${encoded.error?.message ?? "unknown error"}`,
  );
  invariant(
    encoded.status === 0,
    `${label} WebP encode failed: ${String(encoded.stderr ?? "").trim()}`,
  );
  const bytes = encoded.stdout;
  invariant(
    Buffer.isBuffer(bytes)
      && bytes.length >= 12
      && bytes.subarray(0, 4).equals(WEBP_RIFF)
      && bytes.subarray(8, 12).equals(WEBP_SIGNATURE),
    `${label} encoder returned an invalid WebP payload`,
  );
  return bytes;
}

function publicUrl(relativeFile) {
  return `/${relativeFile.split(path.sep).join("/")}`;
}

function assertPng(bytes, label) {
  invariant(
    bytes.length >= PNG_SIGNATURE.length
      && bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE),
    `${label} must be a PNG file`,
  );
}

async function loadPng(file, label, expectedSize = null) {
  const bytes = readFileSync(file);
  assertPng(bytes, label);
  let image;
  try {
    image = await loadImage(bytes);
  } catch (error) {
    throw new Error(
      `[ar-assets] ${label} could not be decoded: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  invariant(image.width > 0 && image.height > 0, `${label} has invalid dimensions`);
  if (expectedSize) {
    invariant(
      image.width === expectedSize.width && image.height === expectedSize.height,
      `${label} must be exactly ${expectedSize.width}x${expectedSize.height}; found ${image.width}x${image.height}`,
    );
  }
  return image;
}

function canvasFromImage(image, width, height) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function canvasContainingImage(image, width, height, background = null) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  return canvas;
}

function drawPlaceholderSheet(sheetId) {
  const canvas = createCanvas(RUNTIME_SHEET_WIDTH, RUNTIME_SHEET_HEIGHT);
  const context = canvas.getContext("2d");
  context.lineCap = "round";
  context.lineJoin = "round";

  if (sheetId === "sheet01") {
    context.fillStyle = "rgba(39, 35, 29, 0.96)";
    context.strokeStyle = "rgba(18, 17, 15, 0.92)";
    context.lineWidth = 8;
    context.beginPath();
    context.ellipse(260, 146, 48, 62, 0, 0, Math.PI * 2);
    context.moveTo(228, 190);
    context.bezierCurveTo(178, 270, 189, 443, 236, 520);
    context.lineTo(188, 659);
    context.lineTo(241, 677);
    context.lineTo(277, 548);
    context.lineTo(319, 678);
    context.lineTo(370, 648);
    context.lineTo(319, 513);
    context.bezierCurveTo(348, 390, 343, 258, 293, 188);
    context.closePath();
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(219, 260);
    context.lineTo(72, 502);
    context.moveTo(309, 257);
    context.lineTo(463, 475);
    context.strokeStyle = "rgba(56, 49, 39, 0.96)";
    context.lineWidth = 26;
    context.stroke();
  } else {
    context.strokeStyle = "rgba(47, 65, 43, 0.96)";
    context.fillStyle = "rgba(62, 79, 50, 0.94)";
    context.lineWidth = 11;
    context.beginPath();
    context.moveTo(258, 660);
    context.bezierCurveTo(258, 514, 246, 346, 263, 116);
    context.moveTo(255, 458);
    context.lineTo(133, 349);
    context.moveTo(257, 389);
    context.lineTo(386, 244);
    context.moveTo(258, 305);
    context.lineTo(177, 188);
    context.stroke();
    for (const [x, y, rotation] of [
      [133, 349, 0.2],
      [186, 397, 0.4],
      [386, 244, -0.25],
      [336, 174, -0.4],
      [177, 188, 0.28],
      [324, 324, -0.45],
    ]) {
      context.save();
      context.translate(x, y);
      context.rotate(rotation);
      context.beginPath();
      context.moveTo(0, 0);
      context.bezierCurveTo(-29, -22, -74, -13, -89, 5);
      context.bezierCurveTo(-58, 28, -24, 29, 0, 0);
      context.fill();
      context.restore();
    }
  }
  return canvas;
}

function isolateFromMask(paper, mask, label) {
  const paperPixels = paper.getContext("2d").getImageData(0, 0, paper.width, paper.height);
  const maskPixels = mask.getContext("2d").getImageData(0, 0, mask.width, mask.height);
  const output = createCanvas(paper.width, paper.height);
  const outputPixels = output.getContext("2d").createImageData(paper.width, paper.height);
  let visiblePixels = 0;
  let transparentPixels = 0;

  for (let offset = 0; offset < paperPixels.data.length; offset += 4) {
    const maskAlpha = maskPixels.data[offset + 3];
    const maskLuma = Math.round(
      (maskPixels.data[offset] + maskPixels.data[offset + 1] + maskPixels.data[offset + 2]) / 3,
    );
    const alpha = Math.round(paperPixels.data[offset + 3] * Math.min(maskAlpha, maskLuma) / 255);
    outputPixels.data[offset] = paperPixels.data[offset];
    outputPixels.data[offset + 1] = paperPixels.data[offset + 1];
    outputPixels.data[offset + 2] = paperPixels.data[offset + 2];
    outputPixels.data[offset + 3] = alpha;
    if (alpha >= 16) visiblePixels += 1;
    else transparentPixels += 1;
  }

  const totalPixels = paper.width * paper.height;
  invariant(visiblePixels > totalPixels * 0.002, `${label} mask is empty or too small`);
  invariant(transparentPixels > totalPixels * 0.2, `${label} mask covers too much of the sheet`);
  output.getContext("2d").putImageData(outputPixels, 0, 0);
  return output;
}

async function buildSheetAsset(
  sourceDirectory,
  incomingDirectory,
  sheetId,
  ffmpegCommand,
) {
  const sourceName = `${sheetId}.png`;
  const maskName = `${sheetId}-mask.png`;
  const sourceFile = path.join(sourceDirectory, sourceName);
  const maskFile = path.join(sourceDirectory, maskName);
  const hasSource = existsSync(sourceFile);
  const hasMask = existsSync(maskFile);
  invariant(hasSource === hasMask, `${sourceName} and ${maskName} must be supplied together`);

  const incomingFile = incomingDirectory
    ? path.join(incomingDirectory, sourceName)
    : null;
  let sprite;
  let placeholder = false;
  let sourceFileName;
  let maskFileName = null;
  let sourceMode;

  if (hasSource) {
    const expectedSize = { width: SOURCE_SHEET_WIDTH, height: SOURCE_SHEET_HEIGHT };
    const [paperImage, maskImage] = await Promise.all([
      loadPng(sourceFile, sourceName, expectedSize),
      loadPng(maskFile, maskName, expectedSize),
    ]);
    const paper = canvasFromImage(paperImage, RUNTIME_SHEET_WIDTH, RUNTIME_SHEET_HEIGHT);
    const mask = canvasFromImage(maskImage, RUNTIME_SHEET_WIDTH, RUNTIME_SHEET_HEIGHT);
    sprite = isolateFromMask(paper, mask, maskName);
    sourceFileName = sourceName;
    maskFileName = maskName;
    sourceMode = "source";
  } else if (incomingFile && existsSync(incomingFile)) {
    const incomingImage = await loadPng(incomingFile, sourceName);
    sprite = canvasContainingImage(incomingImage, RUNTIME_SHEET_WIDTH, RUNTIME_SHEET_HEIGHT);
    sourceFileName = path.relative(repoRoot, incomingFile).split(path.sep).join("/");
    sourceMode = "incoming";
  } else {
    sprite = drawPlaceholderSheet(sheetId);
    placeholder = true;
    sourceFileName = sourceName;
    sourceMode = "placeholder";
  }

  const relativeFile = path.join("ar", "sprites", `${sheetId}.webp`);
  const bytes = webpBytes(sprite, `${sheetId} runtime sprite`, ffmpegCommand);
  return {
    relativeFile,
    bytes,
    metadata: {
      spriteUrl: publicUrl(relativeFile),
      width: RUNTIME_SHEET_WIDTH,
      height: RUNTIME_SHEET_HEIGHT,
      byteLength: bytes.length,
      placeholder,
      spriteSha256: sha256(bytes),
      sourceFileName,
      maskFileName,
      sourceMode,
    },
  };
}

function drawPlaceholderCreatureSource() {
  const canvas = createCanvas(CREATURE_WIDTH, CREATURE_HEIGHT);
  const context = canvas.getContext("2d");
  context.fillStyle = "rgba(0, 0, 0, 1)";
  context.fillRect(0, 0, CREATURE_WIDTH, CREATURE_HEIGHT);
  context.fillStyle = "rgba(24, 23, 20, 1)";
  context.beginPath();
  context.moveTo(458, 212);
  context.bezierCurveTo(347, 273, 325, 408, 374, 529);
  context.bezierCurveTo(239, 684, 223, 982, 302, 1241);
  context.lineTo(212, 1846);
  context.lineTo(405, 1879);
  context.lineTo(502, 1332);
  context.lineTo(571, 1888);
  context.lineTo(782, 1814);
  context.lineTo(678, 1212);
  context.bezierCurveTo(797, 917, 735, 648, 626, 518);
  context.bezierCurveTo(682, 377, 610, 236, 512, 202);
  context.closePath();
  context.fill();
  context.strokeStyle = "rgba(48, 45, 38, 1)";
  context.lineWidth = 22;
  context.beginPath();
  context.moveTo(347, 664);
  context.lineTo(135, 1200);
  context.moveTo(674, 663);
  context.lineTo(892, 1174);
  context.stroke();
  return canvas;
}

function keyBlackToAlpha(source, label) {
  const pixels = source.getContext("2d").getImageData(0, 0, source.width, source.height);
  const keyed = createCanvas(source.width, source.height);
  let blackPixels = 0;
  let nonBlackPixels = 0;

  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    invariant(pixels.data[offset + 3] === 255, `${label} must be fully opaque before black keying`);
    if (
      pixels.data[offset] === 0
      && pixels.data[offset + 1] === 0
      && pixels.data[offset + 2] === 0
    ) {
      pixels.data[offset + 3] = 0;
      blackPixels += 1;
    } else {
      nonBlackPixels += 1;
    }
  }

  const totalPixels = source.width * source.height;
  invariant(blackPixels > totalPixels * 0.25, `${label} needs a substantial pure-black background`);
  invariant(nonBlackPixels > 100, `${label} contains no visible non-black creature`);
  keyed.getContext("2d").putImageData(pixels, 0, 0);
  return keyed;
}

async function buildCreatureAsset(
  sourceDirectory,
  incomingDirectory,
  ffmpegCommand,
) {
  const incomingName = "creature.png";
  const incomingFile = incomingDirectory
    ? path.join(incomingDirectory, incomingName)
    : null;
  const useIncoming = Boolean(incomingFile && existsSync(incomingFile));
  const sourceFileName = useIncoming ? incomingName : "monster-source.png";
  const sourceFile = useIncoming
    ? incomingFile
    : path.join(sourceDirectory, sourceFileName);
  const placeholder = !sourceFile || !existsSync(sourceFile);
  let source;

  if (placeholder) {
    source = drawPlaceholderCreatureSource();
  } else if (useIncoming) {
    const image = await loadPng(sourceFile, sourceFileName);
    source = canvasContainingImage(
      image,
      CREATURE_WIDTH,
      CREATURE_HEIGHT,
      "rgba(0, 0, 0, 1)",
    );
  } else {
    const image = await loadPng(sourceFile, sourceFileName, {
      width: CREATURE_WIDTH,
      height: CREATURE_HEIGHT,
    });
    source = canvasFromImage(image, CREATURE_WIDTH, CREATURE_HEIGHT);
  }

  const keyed = keyBlackToAlpha(source, sourceFileName);
  const sourcePngBytes = pngBytes(keyed);
  const bytes = webpBytes(keyed, "room creature", ffmpegCommand);
  const relativeFile = path.join("ar", "textures", "creature.webp");
  return {
    relativeFile,
    bytes,
    metadata: {
      url: publicUrl(relativeFile),
      width: CREATURE_WIDTH,
      height: CREATURE_HEIGHT,
      byteLength: bytes.length,
      placeholder,
      blackKeyed: true,
      sha256: sha256(bytes),
      sourcePngSha256: sha256(sourcePngBytes),
      sourceFileName,
    },
  };
}

function generatedModuleSource(payload) {
  return `/* Deterministic build output. Run node scripts/generate-ar-assets.mjs; do not edit. */\n\nexport const generatedArAssets = ${JSON.stringify(payload, null, 2)} as const;\n`;
}

export async function generateArAssets(options = {}) {
  const sourceDirectory = path.resolve(options.sourceDirectory ?? defaultSourceDirectory);
  const incomingDirectory = options.incomingDirectory === false
    || (options.sourceDirectory !== undefined && options.incomingDirectory === undefined)
    ? null
    : path.resolve(options.incomingDirectory ?? defaultIncomingDirectory);
  const outputDirectory = path.resolve(options.outputDirectory ?? defaultOutputDirectory);
  const publicDirectory = path.resolve(
    options.publicDirectory
      ?? (options.outputDirectory === undefined
        ? defaultPublicDirectory
        : path.join(path.dirname(outputDirectory), "public")),
  );
  const ffmpegCommand = options.ffmpegCommand ?? "ffmpeg";
  const checkOnly = options.checkOnly === true;
  const quiet = options.quiet === true;

  const builtSheetEntries = await Promise.all(
    SHEET_ORDER.map(async (sheetId) => [
      sheetId,
      await buildSheetAsset(
        sourceDirectory,
        incomingDirectory,
        sheetId,
        ffmpegCommand,
      ),
    ]),
  );
  const builtSheets = Object.fromEntries(builtSheetEntries);
  const builtCreature = await buildCreatureAsset(
    sourceDirectory,
    incomingDirectory,
    ffmpegCommand,
  );
  const sheets = Object.fromEntries(
    SHEET_ORDER.map((sheetId) => [sheetId, builtSheets[sheetId].metadata]),
  );
  const creature = builtCreature.metadata;
  const sourceMode = {
    sheet01: sheets.sheet01.sourceMode,
    sheet02: sheets.sheet02.sourceMode,
    creature: creature.placeholder ? "placeholder" : "source",
  };
  const payload = {
    sheetOrder: SHEET_ORDER,
    sheets,
    creature,
    sourceMode,
  };
  const source = generatedModuleSource(payload);
  const moduleBytes = Buffer.byteLength(source);
  invariant(
    moduleBytes <= MAX_GENERATED_MODULE_BYTES,
    `Generated TypeScript is ${moduleBytes} bytes; budget is ${MAX_GENERATED_MODULE_BYTES}. Reduce source image detail.`,
  );

  const outputFile = path.join(outputDirectory, "ar-assets.generated.ts");
  const publicOutputs = [
    ...SHEET_ORDER.map((sheetId) => builtSheets[sheetId]),
    builtCreature,
  ];
  const publicBytes = publicOutputs.reduce(
    (total, output) => total + output.bytes.length,
    0,
  );
  let stale = false;

  for (const output of publicOutputs) {
    const file = path.join(publicDirectory, output.relativeFile);
    const matches = existsSync(file)
      && readFileSync(file).equals(output.bytes);
    if (checkOnly) {
      if (!matches) {
        stale = true;
        if (!quiet) {
          console.error(
            `[ar-assets] Stale generated file: ${path.relative(repoRoot, file)}`,
          );
        }
      }
    } else {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, output.bytes);
    }
  }

  if (checkOnly) {
    const moduleStale = !existsSync(outputFile)
      || readFileSync(outputFile, "utf8") !== source;
    stale = stale || moduleStale;
    if (moduleStale && !quiet) {
      console.error(`[ar-assets] Stale generated file: ${path.relative(repoRoot, outputFile)}`);
    }
  } else {
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(outputFile, source);
  }

  if (!quiet && !stale) {
    const verb = checkOnly ? "Verified" : "Wrote";
    console.log(
      `[ar-assets] ${verb} ${path.relative(repoRoot, outputFile)} (${moduleBytes} metadata bytes; ${publicBytes} WebP bytes; ${Object.values(sourceMode).join(", ")}).`,
    );
  }

  return {
    outputFile,
    moduleBytes,
    publicBytes,
    publicFiles: Object.freeze(
      publicOutputs.map((output) => path.join(publicDirectory, output.relativeFile)),
    ),
    stale,
    sourceMode: Object.freeze({ ...sourceMode }),
    sheetOrder: Object.freeze([...SHEET_ORDER]),
  };
}

function parseCliArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--check") options.checkOnly = true;
    else if (argument === "--quiet") options.quiet = true;
    else if (
      argument === "--source-dir"
      || argument === "--incoming-dir"
      || argument === "--output-dir"
      || argument === "--public-dir"
    ) {
      const value = args[index + 1];
      invariant(value && !value.startsWith("--"), `${argument} needs a path`);
      if (argument === "--source-dir") options.sourceDirectory = value;
      else if (argument === "--incoming-dir") options.incomingDirectory = value;
      else if (argument === "--output-dir") options.outputDirectory = value;
      else options.publicDirectory = value;
      index += 1;
    } else if (argument.startsWith("--source-dir=")) {
      options.sourceDirectory = argument.slice("--source-dir=".length);
    } else if (argument.startsWith("--incoming-dir=")) {
      options.incomingDirectory = argument.slice("--incoming-dir=".length);
    } else if (argument.startsWith("--output-dir=")) {
      options.outputDirectory = argument.slice("--output-dir=".length);
    } else if (argument.startsWith("--public-dir=")) {
      options.publicDirectory = argument.slice("--public-dir=".length);
    } else {
      throw new Error(`[ar-assets] Unknown argument: ${argument}`);
    }
  }
  return options;
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await generateArAssets(parseCliArgs(process.argv.slice(2)));
  if (result.stale) process.exitCode = 1;
}

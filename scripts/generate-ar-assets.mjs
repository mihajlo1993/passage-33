import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createCanvas, loadImage } from "canvas";

const TARGET_ORDER = Object.freeze(["sheet01", "sheet02"]);
const SOURCE_SHEET_WIDTH = 1754;
const SOURCE_SHEET_HEIGHT = 2480;
const RUNTIME_SHEET_WIDTH = 512;
const RUNTIME_SHEET_HEIGHT = 724;
const CREATURE_WIDTH = 1024;
const CREATURE_HEIGHT = 2048;
const MAX_GENERATED_MODULE_BYTES = 16 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSourceDirectory = path.join(repoRoot, "src", "ar", "assets", "source");
const defaultOutputDirectory = path.join(repoRoot, "src", "ar", "generated");

function invariant(condition, message) {
  if (!condition) throw new Error(`[ar-assets] ${message}`);
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 1831565813) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function pngBytes(canvas) {
  return canvas.toBuffer("image/png", { compressionLevel: 9 });
}

function pngDataUri(canvas) {
  return `data:image/png;base64,${pngBytes(canvas).toString("base64")}`;
}

function canvasFromImage(image, width, height) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function makePaper(seed) {
  const canvas = createCanvas(RUNTIME_SHEET_WIDTH, RUNTIME_SHEET_HEIGHT);
  const context = canvas.getContext("2d");
  const pixels = context.createImageData(RUNTIME_SHEET_WIDTH, RUNTIME_SHEET_HEIGHT);
  const random = seededRandom(seed);

  for (let y = 0; y < RUNTIME_SHEET_HEIGHT; y += 1) {
    for (let x = 0; x < RUNTIME_SHEET_WIDTH; x += 1) {
      const offset = (y * RUNTIME_SHEET_WIDTH + x) * 4;
      const edge = Math.max(
        Math.abs(x / (RUNTIME_SHEET_WIDTH - 1) - 0.5) * 2,
        Math.abs(y / (RUNTIME_SHEET_HEIGHT - 1) - 0.5) * 2,
      );
      const grain = (random() - 0.5) * 18;
      const band = Math.sin((x * 3 + y * 5 + seed) * 0.011) * 2.5;
      pixels.data[offset] = clampByte(184 + grain + band - edge * 24);
      pixels.data[offset + 1] = clampByte(171 + grain * 0.8 + band - edge * 22);
      pixels.data[offset + 2] = clampByte(139 + grain * 0.55 - edge * 19);
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);

  context.save();
  context.strokeStyle = "rgba(50, 45, 37, 0.26)";
  context.lineWidth = 2;
  context.strokeRect(17.5, 17.5, RUNTIME_SHEET_WIDTH - 35, RUNTIME_SHEET_HEIGHT - 35);
  context.strokeStyle = "rgba(71, 62, 48, 0.18)";
  context.lineWidth = 1;
  for (let index = 0; index < 13; index += 1) {
    const y = 48 + index * 48 + random() * 18;
    context.beginPath();
    context.moveTo(31 + random() * 40, y);
    context.bezierCurveTo(150, y - 6, 348, y + 8, 481 - random() * 36, y - 2);
    context.stroke();
  }
  context.restore();
  return canvas;
}

function figurePath(context) {
  context.beginPath();
  context.moveTo(233, 174);
  context.bezierCurveTo(215, 151, 218, 113, 247, 99);
  context.bezierCurveTo(277, 91, 297, 115, 294, 145);
  context.bezierCurveTo(292, 162, 283, 175, 274, 183);
  context.bezierCurveTo(312, 203, 330, 237, 337, 283);
  context.lineTo(358, 390);
  context.lineTo(332, 542);
  context.lineTo(286, 605);
  context.lineTo(261, 508);
  context.lineTo(238, 611);
  context.lineTo(189, 553);
  context.lineTo(180, 390);
  context.lineTo(194, 285);
  context.bezierCurveTo(198, 235, 210, 201, 233, 174);
  context.closePath();

  context.moveTo(198, 238);
  context.bezierCurveTo(166, 241, 139, 261, 118, 294);
  context.lineTo(77, 367);
  context.lineTo(99, 382);
  context.lineTo(160, 324);
  context.lineTo(211, 294);
  context.closePath();

  context.moveTo(323, 235);
  context.bezierCurveTo(366, 236, 393, 259, 408, 295);
  context.lineTo(444, 386);
  context.lineTo(419, 397);
  context.lineTo(371, 324);
  context.lineTo(317, 291);
  context.closePath();
}

function drawFigure(paper, mask) {
  const paperContext = paper.getContext("2d");
  paperContext.save();
  figurePath(paperContext);
  paperContext.fillStyle = "rgba(39, 35, 29, 0.94)";
  paperContext.fill("evenodd");
  paperContext.strokeStyle = "rgba(18, 17, 15, 0.82)";
  paperContext.lineWidth = 5;
  paperContext.stroke();
  paperContext.beginPath();
  paperContext.moveTo(239, 132);
  paperContext.lineTo(250, 137);
  paperContext.moveTo(275, 136);
  paperContext.lineTo(286, 131);
  paperContext.moveTo(251, 159);
  paperContext.quadraticCurveTo(264, 166, 278, 157);
  paperContext.strokeStyle = "rgba(157, 143, 112, 0.72)";
  paperContext.lineWidth = 3;
  paperContext.stroke();
  paperContext.restore();

  const maskContext = mask.getContext("2d");
  maskContext.save();
  figurePath(maskContext);
  maskContext.fillStyle = "rgba(255, 255, 255, 1)";
  maskContext.fill("evenodd");
  maskContext.strokeStyle = "rgba(255, 255, 255, 1)";
  maskContext.lineWidth = 7;
  maskContext.stroke();
  maskContext.restore();
}

function herbPaths(context) {
  context.beginPath();
  context.moveTo(257, 590);
  context.bezierCurveTo(257, 493, 250, 378, 258, 190);
  context.moveTo(255, 475);
  context.bezierCurveTo(218, 425, 177, 389, 132, 361);
  context.moveTo(255, 416);
  context.bezierCurveTo(300, 371, 337, 321, 373, 258);
  context.moveTo(256, 349);
  context.bezierCurveTo(215, 302, 191, 254, 176, 204);
  context.moveTo(258, 294);
  context.bezierCurveTo(294, 256, 319, 219, 333, 172);
}

function leafPath(context, x, y, scaleX, scaleY, angle) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.scale(scaleX, scaleY);
  context.beginPath();
  context.moveTo(0, 0);
  context.bezierCurveTo(-25, -17, -54, -11, -67, 2);
  context.bezierCurveTo(-45, 17, -20, 22, 0, 0);
  context.closePath();
  context.restore();
}

function drawHerb(paper, mask) {
  const leaves = [
    [132, 361, 1.05, 1.0, 0.2],
    [179, 399, 0.88, 0.84, 0.38],
    [373, 258, -1.02, 0.92, -0.22],
    [333, 172, -0.86, 0.84, -0.35],
    [176, 204, 0.92, 0.88, 0.26],
    [205, 282, 0.82, 0.8, 0.46],
    [322, 326, -0.82, 0.82, -0.42],
  ];

  for (const context of [paper.getContext("2d"), mask.getContext("2d")]) {
    const isMask = context.canvas === mask;
    context.save();
    herbPaths(context);
    context.strokeStyle = isMask ? "rgba(255, 255, 255, 1)" : "rgba(47, 65, 43, 0.96)";
    context.lineWidth = isMask ? 12 : 8;
    context.lineCap = "round";
    context.stroke();
    for (const [x, y, scaleX, scaleY, angle] of leaves) {
      leafPath(context, x, y, scaleX, scaleY, angle);
      context.fillStyle = isMask ? "rgba(255, 255, 255, 1)" : "rgba(62, 79, 50, 0.94)";
      context.fill();
      if (!isMask) {
        context.strokeStyle = "rgba(30, 43, 29, 0.72)";
        context.lineWidth = 2;
        context.stroke();
      }
    }
    context.restore();
  }
}

function placeholderSheet(id) {
  const paper = makePaper(id === "sheet01" ? 701 : 1702);
  const mask = createCanvas(RUNTIME_SHEET_WIDTH, RUNTIME_SHEET_HEIGHT);
  if (id === "sheet01") drawFigure(paper, mask);
  else drawHerb(paper, mask);
  return { paper, mask };
}

function isolateFromPaper(paper, mask, label) {
  const paperContext = paper.getContext("2d");
  const maskContext = mask.getContext("2d");
  const paperPixels = paperContext.getImageData(0, 0, paper.width, paper.height);
  const maskPixels = maskContext.getImageData(0, 0, mask.width, mask.height);
  const output = createCanvas(paper.width, paper.height);
  const outputContext = output.getContext("2d");
  const outputPixels = outputContext.createImageData(paper.width, paper.height);

  let hasTransparentMaskPixel = false;
  for (let offset = 3; offset < maskPixels.data.length; offset += 4) {
    if (maskPixels.data[offset] < 250) {
      hasTransparentMaskPixel = true;
      break;
    }
  }

  let visiblePixels = 0;
  let transparentPixels = 0;
  for (let offset = 0; offset < paperPixels.data.length; offset += 4) {
    const maskStrength = hasTransparentMaskPixel
      ? maskPixels.data[offset + 3]
      : Math.round((maskPixels.data[offset] + maskPixels.data[offset + 1] + maskPixels.data[offset + 2]) / 3);
    const alpha = Math.round(paperPixels.data[offset + 3] * maskStrength / 255);
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
  outputContext.putImageData(outputPixels, 0, 0);
  return output;
}

function validateOpaquePaper(canvas, label) {
  const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
  for (let offset = 3; offset < pixels.length; offset += 4) {
    invariant(pixels[offset] === 255, `${label} must be a fully opaque photograph`);
  }
}

function assertPng(bytes, label) {
  invariant(bytes.length >= PNG_SIGNATURE.length && bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE), `${label} must be a PNG file`);
}

async function loadSourcePng(file, label, width, height) {
  const bytes = readFileSync(file);
  assertPng(bytes, label);
  let image;
  try {
    image = await loadImage(bytes);
  } catch (error) {
    throw new Error(`[ar-assets] ${label} could not be decoded: ${error instanceof Error ? error.message : String(error)}`);
  }
  invariant(image.width === width && image.height === height, `${label} must be exactly ${width}x${height}; found ${image.width}x${image.height}`);
  return image;
}

async function buildSheetAsset(sourceDirectory, id) {
  const paperName = `${id}.png`;
  const maskName = `${id}-mask.png`;
  const paperFile = path.join(sourceDirectory, paperName);
  const maskFile = path.join(sourceDirectory, maskName);
  const hasPaper = existsSync(paperFile);
  const hasMask = existsSync(maskFile);
  invariant(hasPaper === hasMask, `${paperName} and ${maskName} must be supplied together`);

  let paper;
  let mask;
  const placeholder = !hasPaper;
  if (placeholder) {
    ({ paper, mask } = placeholderSheet(id));
  } else {
    const [paperImage, maskImage] = await Promise.all([
      loadSourcePng(paperFile, paperName, SOURCE_SHEET_WIDTH, SOURCE_SHEET_HEIGHT),
      loadSourcePng(maskFile, maskName, SOURCE_SHEET_WIDTH, SOURCE_SHEET_HEIGHT),
    ]);
    paper = canvasFromImage(paperImage, RUNTIME_SHEET_WIDTH, RUNTIME_SHEET_HEIGHT);
    mask = canvasFromImage(maskImage, RUNTIME_SHEET_WIDTH, RUNTIME_SHEET_HEIGHT);
  }

  validateOpaquePaper(paper, paperName);
  const overlay = isolateFromPaper(paper, mask, maskName);
  const paperBuffer = pngBytes(paper);
  const overlayBuffer = pngBytes(overlay);
  return {
    paperDataUri: `data:image/png;base64,${paperBuffer.toString("base64")}`,
    overlayDataUri: `data:image/png;base64,${overlayBuffer.toString("base64")}`,
    width: RUNTIME_SHEET_WIDTH,
    height: RUNTIME_SHEET_HEIGHT,
    placeholder,
    paperSha256: sha256(paperBuffer),
    overlaySha256: sha256(overlayBuffer),
    sourceFileName: paperName,
    maskFileName: maskName,
  };
}

function drawPlaceholderCreatureSource() {
  const canvas = createCanvas(CREATURE_WIDTH, CREATURE_HEIGHT);
  const context = canvas.getContext("2d");
  context.fillStyle = "rgba(0, 0, 0, 1)";
  context.fillRect(0, 0, CREATURE_WIDTH, CREATURE_HEIGHT);

  context.save();
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
  context.lineCap = "square";
  context.beginPath();
  context.moveTo(347, 664);
  context.lineTo(135, 1200);
  context.lineTo(205, 1235);
  context.moveTo(674, 663);
  context.lineTo(892, 1174);
  context.lineTo(831, 1231);
  context.stroke();

  context.strokeStyle = "rgba(72, 67, 56, 1)";
  context.lineWidth = 9;
  for (let y = 584; y < 1280; y += 86) {
    context.beginPath();
    context.moveTo(390 + (y % 3) * 8, y);
    context.bezierCurveTo(461, y + 22, 560, y - 18, 637, y + 4);
    context.stroke();
  }
  context.fillStyle = "rgba(94, 86, 69, 1)";
  context.fillRect(420, 376, 52, 16);
  context.fillRect(554, 372, 50, 16);
  context.restore();
  return canvas;
}

function keyBlackToAlpha(source, label) {
  const sourceContext = source.getContext("2d");
  const pixels = sourceContext.getImageData(0, 0, source.width, source.height);
  const keyed = createCanvas(source.width, source.height);
  const keyedContext = keyed.getContext("2d");
  let blackPixels = 0;
  let nonBlackPixels = 0;

  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    invariant(pixels.data[offset + 3] === 255, `${label} must be fully opaque before black keying`);
    if (pixels.data[offset] === 0 && pixels.data[offset + 1] === 0 && pixels.data[offset + 2] === 0) {
      pixels.data[offset + 3] = 0;
      blackPixels += 1;
    } else {
      nonBlackPixels += 1;
    }
  }

  const totalPixels = source.width * source.height;
  invariant(blackPixels > totalPixels * 0.25, `${label} needs a substantial pure-black background`);
  invariant(nonBlackPixels > 100, `${label} contains no visible non-black creature`);
  keyedContext.putImageData(pixels, 0, 0);
  return keyed;
}

async function buildCreatureAsset(sourceDirectory) {
  const sourceFileName = "monster-source.png";
  const sourceFile = path.join(sourceDirectory, sourceFileName);
  const placeholder = !existsSync(sourceFile);
  const source = placeholder
    ? drawPlaceholderCreatureSource()
    : canvasFromImage(
      await loadSourcePng(sourceFile, sourceFileName, CREATURE_WIDTH, CREATURE_HEIGHT),
      CREATURE_WIDTH,
      CREATURE_HEIGHT,
    );
  const keyed = keyBlackToAlpha(source, sourceFileName);
  const bytes = pngBytes(keyed);
  return {
    dataUri: `data:image/png;base64,${bytes.toString("base64")}`,
    width: CREATURE_WIDTH,
    height: CREATURE_HEIGHT,
    placeholder,
    blackKeyed: true,
    sha256: sha256(bytes),
    sourceFileName,
  };
}

function placeholderTargetDatabase() {
  return Buffer.from([
    "BAKER HOUSE SEVEN - PLACEHOLDER MINDAR DATABASE",
    "This sentinel is intentionally not a usable .mind file.",
    "target index 0: sheet01",
    "target index 1: sheet02",
    "",
  ].join("\n"), "utf8");
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function validateMindDatabase(bytes, label) {
  let decoded;
  try {
    const { decode } = await import("@msgpack/msgpack");
    decoded = decode(bytes);
  } catch (error) {
    throw new Error(`[ar-assets] ${label} is not a readable MindAR database: ${error instanceof Error ? error.message : String(error)}`);
  }
  invariant(isRecord(decoded) && decoded.v === 2, `${label} must use MindAR target database version 2`);
  invariant(Array.isArray(decoded.dataList) && decoded.dataList.length === TARGET_ORDER.length, `${label} must contain exactly two targets in sheet01, sheet02 order`);
  for (let index = 0; index < TARGET_ORDER.length; index += 1) {
    const target = decoded.dataList[index];
    invariant(isRecord(target) && isRecord(target.targetImage), `${label} target index ${index} is malformed`);
    invariant(target.targetImage.width === SOURCE_SHEET_WIDTH && target.targetImage.height === SOURCE_SHEET_HEIGHT, `${label} target index ${index} must be ${SOURCE_SHEET_WIDTH}x${SOURCE_SHEET_HEIGHT}`);
    invariant("matchingData" in target && "trackingData" in target, `${label} target index ${index} lacks compiled tracking data`);
  }
}

async function buildTargetDatabase(sourceDirectory) {
  const fileName = "targets.mind";
  const file = path.join(sourceDirectory, fileName);
  const placeholder = !existsSync(file);
  const bytes = placeholder ? placeholderTargetDatabase() : readFileSync(file);
  if (!placeholder) await validateMindDatabase(bytes, fileName);
  return {
    base64: bytes.toString("base64"),
    byteLength: bytes.length,
    sha256: sha256(bytes),
    placeholder,
    fileName,
  };
}

function generatedModuleSource(payload) {
  return `/* Deterministic build output. Run node scripts/generate-ar-assets.mjs; do not edit. */\n\nexport const generatedArAssets = ${JSON.stringify(payload, null, 2)} as const;\n`;
}

export async function generateArAssets(options = {}) {
  const sourceDirectory = path.resolve(options.sourceDirectory ?? defaultSourceDirectory);
  const outputDirectory = path.resolve(options.outputDirectory ?? defaultOutputDirectory);
  const checkOnly = options.checkOnly === true;
  const quiet = options.quiet === true;

  const sheet01 = await buildSheetAsset(sourceDirectory, "sheet01");
  const sheet02 = await buildSheetAsset(sourceDirectory, "sheet02");
  const creature = await buildCreatureAsset(sourceDirectory);
  const targetDatabase = await buildTargetDatabase(sourceDirectory);
  const sourceMode = {
    sheet01: sheet01.placeholder ? "placeholder" : "source",
    sheet02: sheet02.placeholder ? "placeholder" : "source",
    creature: creature.placeholder ? "placeholder" : "source",
    targets: targetDatabase.placeholder ? "placeholder" : "source",
  };
  const payload = {
    targetOrder: TARGET_ORDER,
    targetDatabase,
    sheets: { sheet01, sheet02 },
    creature,
    sourceMode,
  };
  const source = generatedModuleSource(payload);
  const moduleBytes = Buffer.byteLength(source);
  invariant(moduleBytes <= MAX_GENERATED_MODULE_BYTES, `Generated TypeScript is ${moduleBytes} bytes; budget is ${MAX_GENERATED_MODULE_BYTES}. Reduce source image detail.`);

  const outputFile = path.join(outputDirectory, "ar-assets.generated.ts");
  let stale = false;
  if (checkOnly) {
    stale = !existsSync(outputFile) || readFileSync(outputFile, "utf8") !== source;
    if (stale && !quiet) console.error(`[ar-assets] Stale generated file: ${path.relative(repoRoot, outputFile)}`);
  } else {
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(outputFile, source);
  }

  if (!quiet && !stale) {
    const verb = checkOnly ? "Verified" : "Wrote";
    console.log(`[ar-assets] ${verb} ${path.relative(repoRoot, outputFile)} (${moduleBytes} bytes; ${Object.values(sourceMode).join(", ")}).`);
  }

  return {
    outputFile,
    moduleBytes,
    stale,
    sourceMode: Object.freeze({ ...sourceMode }),
    targetOrder: Object.freeze([...TARGET_ORDER]),
  };
}

function parseCliArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--check") options.checkOnly = true;
    else if (argument === "--quiet") options.quiet = true;
    else if (argument === "--source-dir" || argument === "--output-dir") {
      const value = args[index + 1];
      invariant(value && !value.startsWith("--"), `${argument} needs a path`);
      if (argument === "--source-dir") options.sourceDirectory = value;
      else options.outputDirectory = value;
      index += 1;
    } else if (argument.startsWith("--source-dir=")) {
      options.sourceDirectory = argument.slice("--source-dir=".length);
    } else if (argument.startsWith("--output-dir=")) {
      options.outputDirectory = argument.slice("--output-dir=".length);
    } else {
      throw new Error(`[ar-assets] Unknown argument: ${argument}`);
    }
  }
  return options;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await generateArAssets(parseCliArgs(process.argv.slice(2)));
  if (result.stale) process.exitCode = 1;
}

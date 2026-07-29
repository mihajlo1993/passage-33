import { spawnSync } from "node:child_process";
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
import {
  applyProtectedAssetWrite,
  planProtectedAssetWrite,
} from "./lib/protected-asset.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultSourceDirectory = path.join(repoRoot, "assets-incoming");
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const WEBP_RIFF = Buffer.from("RIFF", "ascii");
const WEBP_SIGNATURE = Buffer.from("WEBP", "ascii");
const PROP_SHEET_IDS = Object.freeze(["sheet01", "sheet02"]);

const SOURCE_SPECS = Object.freeze([
  { id: "coldOpen", source: "cold-open.png", output: "media/cold-open", width: 1080, height: 1920 },
  ...Array.from({ length: 7 }, (_, offset) => ({
    id: `tape${String(offset + 1).padStart(2, "0")}`,
    source: `tape-${String(offset + 1).padStart(2, "0")}.png`,
    output: `media/tape-${String(offset + 1).padStart(2, "0")}`,
    width: 640,
    height: 360,
  })),
  { id: "trophy", source: "trophy.png", output: "media/trophy", width: 1280, height: 720 },
  { id: "creature", source: "creature.png", output: "ar/textures/creature", width: 1024, height: 2048, blackKey: true, webp: false },
  { id: "appIcon", source: "app-icon.png", output: "media/app-icon", width: 1024, height: 1024, icon: true },
  { id: "sheet01", source: "sheet01.png", output: "media/sheet01", width: 1754, height: 2480, fit: "contain" },
  { id: "sheet02", source: "sheet02.png", output: "media/sheet02", width: 1754, height: 2480, fit: "contain" },
]);

function invariant(condition, message) {
  if (!condition) throw new Error(`[media-assets] ${message}`);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertPng(bytes, label) {
  invariant(
    bytes.length >= PNG_SIGNATURE.length
      && bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE),
    `${label} is not a PNG file`,
  );
}

function pngBytes(canvas) {
  return canvas.toBuffer("image/png", { compressionLevel: 9 });
}

function webpBytes(canvas, ffmpegCommand = "ffmpeg") {
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
  invariant(encoded.error === undefined, `FFmpeg WebP encoder unavailable: ${encoded.error?.message ?? "unknown error"}`);
  invariant(encoded.status === 0, `FFmpeg WebP encode failed: ${String(encoded.stderr ?? "").trim()}`);
  const bytes = encoded.stdout;
  invariant(
    Buffer.isBuffer(bytes)
      && bytes.length >= 12
      && bytes.subarray(0, 4).equals(WEBP_RIFF)
      && bytes.subarray(8, 12).equals(WEBP_SIGNATURE),
    "FFmpeg returned an invalid WebP payload",
  );
  return bytes;
}

function coverImage(image, width, height) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const sourceAspect = image.width / image.height;
  const outputAspect = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.width;
  let sourceHeight = image.height;
  if (sourceAspect > outputAspect) {
    sourceWidth = image.height * outputAspect;
    sourceX = (image.width - sourceWidth) / 2;
  } else if (sourceAspect < outputAspect) {
    sourceHeight = image.width / outputAspect;
    sourceY = (image.height - sourceHeight) / 2;
  }

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
  return canvas;
}

/** Preserve every source pixel on a white A4 portrait canvas. */
function containImage(image, width, height) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "rgb(255, 255, 255)";
  context.fillRect(0, 0, width, height);

  const scale = Math.min(width / image.width, height / image.height);
  const drawnWidth = image.width * scale;
  const drawnHeight = image.height * scale;
  const drawnX = (width - drawnWidth) / 2;
  const drawnY = (height - drawnHeight) / 2;
  context.drawImage(image, drawnX, drawnY, drawnWidth, drawnHeight);
  return canvas;
}

/** Exact pure-black key, matching the established AR asset generator. */
export function keyBlackToAlpha(source, label = "creature.png") {
  const context = source.getContext("2d");
  const pixels = context.getImageData(0, 0, source.width, source.height);
  const keyed = createCanvas(source.width, source.height);
  let blackPixels = 0;
  let visiblePixels = 0;

  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    invariant(pixels.data[offset + 3] === 255, `${label} must be opaque before keying`);
    if (
      pixels.data[offset] === 0
      && pixels.data[offset + 1] === 0
      && pixels.data[offset + 2] === 0
    ) {
      pixels.data[offset + 3] = 0;
      blackPixels += 1;
    } else {
      visiblePixels += 1;
    }
  }

  const totalPixels = source.width * source.height;
  invariant(blackPixels > totalPixels * 0.25, `${label} needs a substantial pure-black background`);
  invariant(visiblePixels > 100, `${label} contains no visible creature`);
  keyed.getContext("2d").putImageData(pixels, 0, 0);
  return keyed;
}

async function decodePng(file, label) {
  const bytes = readFileSync(file);
  assertPng(bytes, label);
  const image = await loadImage(bytes);
  invariant(image.width > 0 && image.height > 0, `${label} has invalid dimensions`);
  return image;
}

function publicUrl(relativeFile) {
  return "/" + relativeFile.split(path.sep).join("/");
}

function bytesRecord(bytes, relativeFile) {
  return Object.freeze({
    url: publicUrl(relativeFile),
    bytes: bytes.length,
    sha256: sha256(bytes),
  });
}

function readPreviousPayload(generatedFile) {
  if (!existsSync(generatedFile)) return null;
  const source = readFileSync(generatedFile, "utf8");
  const match = source.match(/export const generatedMediaAssets = ([\s\S]+) as const;\s*$/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function verifiedPreviousWebp(file, relativeFile, metadata) {
  if (
    !metadata
    || metadata.url !== publicUrl(relativeFile)
    || typeof metadata.sha256 !== "string"
    || !existsSync(file)
  ) {
    return null;
  }
  const bytes = readFileSync(file);
  if (
    bytes.length < 12
    || !bytes.subarray(0, 4).equals(WEBP_RIFF)
    || !bytes.subarray(8, 12).equals(WEBP_SIGNATURE)
    || sha256(bytes) !== metadata.sha256
  ) {
    return null;
  }
  return bytes;
}

function writeOrCompare(file, bytes, checkOnly) {
  const current = existsSync(file) ? readFileSync(file) : null;
  const stale = current === null || !current.equals(bytes);
  if (!checkOnly && stale) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  }
  return stale;
}


function generatedModuleSource(payload) {
  return `/* Deterministic build output. Run npm run generate:media; do not edit. */\n\nexport const generatedMediaAssets = ${JSON.stringify(payload, null, 2)} as const;\n`;
}

function existingBinaryOutputs(spec, publicDirectory, pngFile, webpFile) {
  const candidates = [pngFile];
  if (spec.webp !== false) candidates.push(webpFile);
  if (spec.id === "trophy") candidates.push(path.join(publicDirectory, "og.png"));
  if (spec.icon) {
    candidates.push(
      path.join(publicDirectory, "icons", "icon-192.png"),
      path.join(publicDirectory, "icons", "icon-512.png"),
    );
  }
  return candidates.filter((file) => existsSync(file));
}

function refuseOrphanedAssets(files, reason) {
  if (files.length === 0) return;
  const labels = files.map((file) => path.relative(repoRoot, file)).join(", ");
  throw new Error(
    `[asset-guard] Refusing to orphan existing non-placeholder asset(s): ${labels} (${reason})`,
  );
}

function missingRecord(spec, reason = "missing") {
  return {
    available: false,
    sourceFileName: spec.source,
    sourceWidth: null,
    sourceHeight: null,
    width: spec.width,
    height: spec.height,
    png: null,
    webp: null,
    blackKeyed: spec.blackKey === true,
    reason,
  };
}

export async function processMediaAssets(options = {}) {
  const sourceDirectory = path.resolve(options.sourceDirectory ?? defaultSourceDirectory);
  const publicDirectory = path.resolve(options.publicDirectory ?? path.join(repoRoot, "public"));
  const generatedFile = path.resolve(
    options.generatedFile ?? path.join(repoRoot, "src", "media", "generated", "media.generated.ts"),
  );
  const previousPayload = readPreviousPayload(generatedFile);
  const legacyTrophyFile = options.legacyTrophyFile === false
    ? null
    : path.resolve(options.legacyTrophyFile ?? path.join(publicDirectory, "og.png"));
  const checkOnly = options.checkOnly === true;
  const quiet = options.quiet === true;
  const ffmpegCommand = options.ffmpegCommand ?? "ffmpeg";
  const warnPropSheetPlaceholders = options.warnPropSheetPlaceholders === true
    || (options.warnPropSheetPlaceholders !== false && sourceDirectory === defaultSourceDirectory);
  const records = {};
  const missing = [];
  const errors = [];
  const publicOutputs = [];
  let stale = false;

  for (const spec of SOURCE_SPECS) {
    const incomingFile = path.join(sourceDirectory, spec.source);
    const sourceFile = existsSync(incomingFile)
      ? incomingFile
      : spec.id === "trophy" && legacyTrophyFile && existsSync(legacyTrophyFile)
        ? legacyTrophyFile
        : null;
    const pngRelative = `${spec.output}.png`;
    const webpRelative = `${spec.output}.webp`;
    const pngFile = path.join(publicDirectory, pngRelative);
    const webpFile = path.join(publicDirectory, webpRelative);
    const existingOutputs = existingBinaryOutputs(
      spec,
      publicDirectory,
      pngFile,
      webpFile,
    );

    if (!sourceFile) {
      refuseOrphanedAssets(existingOutputs, `${spec.source} is missing`);
      records[spec.id] = missingRecord(spec);
      missing.push(spec.source);
      continue;
    }

    try {
      const specPublicOutputs = [];
      const image = await decodePng(sourceFile, spec.source);
      const sourceWidth = image.width;
      const sourceHeight = image.height;
      let canvas = spec.fit === "contain"
        ? containImage(image, spec.width, spec.height)
        : coverImage(image, spec.width, spec.height);
      if (spec.blackKey) canvas = keyBlackToAlpha(canvas, spec.source);
      const png = pngBytes(canvas);
      specPublicOutputs.push({ file: pngFile, bytes: png });
      let webp = null;
      let webpReason = null;
      if (spec.webp !== false) {
        try {
          const webpBytesValue = webpBytes(canvas, ffmpegCommand);
          specPublicOutputs.push({ file: webpFile, bytes: webpBytesValue });
          webp = bytesRecord(webpBytesValue, webpRelative);
        } catch (error) {
          webpReason = error instanceof Error ? error.message : String(error);
          errors.push({ fileName: `${spec.source} (WebP)`, reason: webpReason });
          const existingWebp = verifiedPreviousWebp(
            webpFile,
            webpRelative,
            previousPayload?.assets?.[spec.id]?.webp,
          );
          if (existingWebp) {
            webp = bytesRecord(existingWebp, webpRelative);
            webpReason += "; preserved verified existing WebP";
          } else if (existsSync(webpFile)) {
            webpReason += "; unverified existing WebP left untouched and unreferenced";
          }
        }
      }

      if (spec.id === "trophy") {
        specPublicOutputs.push({ file: path.join(publicDirectory, "og.png"), bytes: png });
      }

      const iconRecords = {};
      if (spec.icon) {
        for (const size of [192, 512]) {
          const iconCanvas = coverImage(image, size, size);
          const iconBytes = pngBytes(iconCanvas);
          const relative = `icons/icon-${size}.png`;
          const iconFile = path.join(publicDirectory, relative);
          specPublicOutputs.push({ file: iconFile, bytes: iconBytes });
          iconRecords[size] = bytesRecord(iconBytes, relative);
        }
      }

      records[spec.id] = {
        available: true,
        sourceFileName: path.relative(repoRoot, sourceFile).split(path.sep).join("/"),
        sourceWidth,
        sourceHeight,
        width: spec.width,
        height: spec.height,
        png: bytesRecord(png, pngRelative),
        webp,
        blackKeyed: spec.blackKey === true,
        icons: spec.icon ? iconRecords : undefined,
        reason: webpReason,
      };
      publicOutputs.push(...specPublicOutputs);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      refuseOrphanedAssets(existingOutputs, reason);
      records[spec.id] = missingRecord(spec, reason);
      errors.push({ fileName: spec.source, reason });
    }
  }

  const publicPlans = publicOutputs.map(({ file, bytes }) => ({
    file,
    plan: planProtectedAssetWrite(file, bytes, {
      label: path.relative(repoRoot, file),
    }),
  }));
  for (const { file, plan } of publicPlans) {
    const result = applyProtectedAssetWrite(file, plan, { checkOnly });
    if (result.stale) {
      stale = true;
      if (!quiet) {
        console.error(`[media-assets] Stale or missing file: ${path.relative(repoRoot, file)}`);
      }
    }
  }

  const placeholderSheets = PROP_SHEET_IDS.filter((sheetId) => records[sheetId]?.reason === "missing");
  if (warnPropSheetPlaceholders && placeholderSheets.length > 0) {
    console.warn(`[media-assets] WARNING: placeholder prop sheets: ${placeholderSheets.join(", ")}`);
  }

  const payload = {
    schemaVersion: 1,
    assets: records,
    missing,
    errors,
  };
  const moduleBytes = Buffer.from(generatedModuleSource(payload), "utf8");
  stale = writeOrCompare(generatedFile, moduleBytes, checkOnly) || stale;

  if (!quiet) {
    const mode = checkOnly ? "Verified" : "Processed";
    console.log(`[media-assets] ${mode} ${Object.values(records).filter((record) => record.available).length}/${SOURCE_SPECS.length} sources.`);
    if (missing.length > 0) console.warn(`[media-assets] Missing optional sources: ${missing.join(", ")}`);
    for (const error of errors) console.warn(`[media-assets] ${error.fileName}: ${error.reason}`);
    if (checkOnly && stale) console.error("[media-assets] Generated media output is stale.");
  }

  return Object.freeze({
    records: Object.freeze(records),
    missing: Object.freeze([...missing]),
    errors: Object.freeze([...errors]),
    placeholderSheets: Object.freeze([...placeholderSheets]),
    generatedFile,
    stale,
  });
}

function parseCliArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--check") options.checkOnly = true;
    else if (argument === "--quiet") options.quiet = true;
    else if (argument === "--source-dir" || argument === "--public-dir" || argument === "--generated-file") {
      const value = args[index + 1];
      invariant(value && !value.startsWith("--"), `${argument} needs a path`);
      if (argument === "--source-dir") options.sourceDirectory = value;
      else if (argument === "--public-dir") options.publicDirectory = value;
      else options.generatedFile = value;
      index += 1;
    } else if (argument.startsWith("--source-dir=")) options.sourceDirectory = argument.slice(13);
    else if (argument.startsWith("--public-dir=")) options.publicDirectory = argument.slice(13);
    else if (argument.startsWith("--generated-file=")) options.generatedFile = argument.slice(17);
    else throw new Error(`[media-assets] Unknown argument: ${argument}`);
  }
  return options;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const result = await processMediaAssets(parseCliArgs(process.argv.slice(2)));
  if (result.stale && process.argv.includes("--check")) process.exitCode = 1;
}

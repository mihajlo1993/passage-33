import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * The finale film pipeline. Copies assets-incoming/cinema/finale.mp4 into
 * public/cinema/ with metadata stripped, and extracts frame 0 as the
 * poster. If the stripped film exceeds the 60MB cinema budget it is
 * re-encoded at CRF 23, 720x1280, and whichever candidate fits ships.
 * A missing source is a WARNING, never a failure: the app runs
 * poster-only (and the player falls back to the poster at runtime).
 *
 * Run: npm run generate:cinema  (never part of the build itself)
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFile = path.join(repoRoot, "assets-incoming", "cinema", "finale.mp4");
const outputDirectory = path.join(repoRoot, "public", "cinema");
const filmFile = path.join(outputDirectory, "finale.mp4");
const posterFile = path.join(outputDirectory, "poster.webp");

export const CINEMA_FILM_LIMIT_BYTES = 60_000_000;

function run(args, label) {
  const result = spawnSync("ffmpeg", ["-v", "error", "-y", ...args], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`[cinema] ffmpeg unavailable for ${label}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`[cinema] ffmpeg failed for ${label}: ${String(result.stderr).trim()}`);
  }
}

function bytes(file) {
  return statSync(file).size;
}

function report(label, file) {
  console.log(`[cinema] ${label}: ${bytes(file).toLocaleString("en-US")} bytes (${file === filmFile ? "shipping" : path.basename(file)})`);
}

if (!existsSync(sourceFile)) {
  console.warn(
    "[cinema] WARNING: assets-incoming/cinema/finale.mp4 is missing. "
    + "The finale runs poster-only. Nothing was changed.",
  );
  process.exit(0);
}

mkdirSync(outputDirectory, { recursive: true });

// 1. Strip metadata, stream copy: byte-exact video, no re-encode.
run(
  ["-i", sourceFile, "-map_metadata", "-1", "-c", "copy", "-movflags", "+faststart", filmFile],
  "metadata strip",
);
const strippedBytes = bytes(filmFile);
console.log(`[cinema] stripped copy: ${strippedBytes.toLocaleString("en-US")} bytes`);

// 2. Over budget: re-encode CRF 23 at 720x1280 and ship whichever fits.
if (strippedBytes >= CINEMA_FILM_LIMIT_BYTES) {
  const reencoded = path.join(outputDirectory, "finale-720.tmp.mp4");
  run(
    [
      "-i", sourceFile,
      "-map_metadata", "-1",
      "-vf", "scale=720:1280",
      "-c:v", "libx264",
      "-crf", "23",
      "-preset", "medium",
      "-pix_fmt", "yuv420p",
      "-an",
      "-movflags", "+faststart",
      reencoded,
    ],
    "720x1280 CRF 23 re-encode",
  );
  const reencodedBytes = bytes(reencoded);
  console.log(`[cinema] re-encoded 720x1280 CRF 23: ${reencodedBytes.toLocaleString("en-US")} bytes`);
  if (reencodedBytes < CINEMA_FILM_LIMIT_BYTES) {
    const { renameSync, rmSync } = await import("node:fs");
    rmSync(filmFile);
    renameSync(reencoded, filmFile);
    console.log("[cinema] shipping the 720x1280 re-encode (stripped original was over 60MB).");
  } else {
    const { rmSync } = await import("node:fs");
    rmSync(reencoded);
    console.warn("[cinema] WARNING: both candidates exceed 60MB; shipping the stripped original.");
  }
}

// 3. Frame 0 becomes the instant poster.
run(
  ["-i", filmFile, "-frames:v", "1", "-c:v", "libwebp", "-quality", "82", posterFile],
  "poster extraction",
);

report("final film", filmFile);
console.log(`[cinema] poster: ${bytes(posterFile).toLocaleString("en-US")} bytes`);

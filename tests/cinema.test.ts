import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

/*
 * The finale film contract. The narration clock (keeper-lock4.mp3) is the
 * master; the film is a silent visual bed that holds its last frame, falls
 * back to its poster, and never carries timing.
 */

const CINEMA_LIMIT_BYTES = 60_000_000;

const trophy = readFileSync("src/components/TrophyScreen.tsx", "utf8");
const notes = readFileSync("src/components/NotesScreen.tsx", "utf8");
const pipeline = readFileSync("scripts/prepare-cinema.mjs", "utf8");
const auditScript = readFileSync("scripts/audit-build-output.mjs", "utf8");
const puzzlesCss = readFileSync("src/styles/puzzles.css", "utf8");

test("the shipped film and poster exist, and the cinema bucket fits its budget", () => {
  assert.ok(existsSync("public/cinema/finale.mp4"), "public/cinema/finale.mp4 must ship");
  assert.ok(existsSync("public/cinema/poster.webp"), "public/cinema/poster.webp must ship");

  const filmBytes = statSync("public/cinema/finale.mp4").size;
  const posterBytes = statSync("public/cinema/poster.webp").size;
  assert.ok(
    filmBytes + posterBytes < CINEMA_LIMIT_BYTES,
    `cinema bucket is ${filmBytes + posterBytes} bytes; must be below ${CINEMA_LIMIT_BYTES}`,
  );

  // Real containers, not placeholders: MP4 ftyp box and WebP RIFF header.
  const filmHead = readFileSync("public/cinema/finale.mp4").subarray(4, 8).toString("ascii");
  assert.equal(filmHead, "ftyp");
  const poster = readFileSync("public/cinema/poster.webp");
  assert.equal(poster.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(poster.subarray(8, 12).toString("ascii"), "WEBP");
});

test("the player is a muted, inline, autoplaying bed under the letter", () => {
  assert.match(trophy, /muted\s/);
  assert.match(trophy, /playsInline/);
  assert.match(trophy, /autoPlay/);
  assert.match(trophy, /poster=\{CINEMA_POSTER_PATH\}/);
  assert.match(trophy, /src=\{CINEMA_FILM_PATH\}/);
  // The film never loops and never goes black: an ended video holds its
  // final frame; only an error swaps to the poster. (The music box element
  // loops by design; only the video element is checked here.)
  const videoStart = trophy.indexOf("<video");
  assert.ok(videoStart >= 0, "the film video element exists");
  const videoTag = trophy.slice(videoStart, trophy.indexOf("/>", videoStart) + 2);
  assert.doesNotMatch(videoTag, /\bloop\b/);
  assert.match(trophy, /onError=\{\(\) => setMode\("poster"\)\}/);
  // prefers-reduced-motion: poster and letter, no video.
  assert.match(trophy, /prefers-reduced-motion/);
});

test("the narration clock stays the master; the video carries no timing", () => {
  assert.match(trophy, /LETTER_READ_MS = 93_600/);
  assert.match(trophy, /voiceStartedAt/);
  assert.doesNotMatch(trophy, /onTimeUpdate|video\.currentTime|timeupdate/);
  // Her scroll takeover survives the restyle.
  assert.match(trophy, /followRef\.current = false/);
  // The house goes quiet only from her hand.
  assert.match(trophy, /putTheLetterDown/);
});

test("the letter rides a lower-third band on a gradient scrim, never a box", () => {
  assert.match(trophy, /letter-band/);
  assert.match(puzzlesCss, /\.letter-band__scrim[\s\S]*?linear-gradient/);
  assert.doesNotMatch(
    puzzlesCss,
    /\.letter-band\s*\{[^}]*background/,
    "the band itself carries no solid background",
  );
  // The ending overlays the HELD final frame: a scrim, not a solid slab.
  assert.match(puzzlesCss, /\.letter-finale\s*\{[\s\S]*?radial-gradient/);
  assert.match(trophy, /candle-flame-css/);
  assert.match(trophy, /Happy birthday, Melissa\./);
});

test("the chronicle card replays film and narration from the start, once finished", () => {
  assert.match(notes, /state\.finishedAt !== null/);
  assert.match(notes, /The Letter, whole/);
  assert.match(notes, /playKeeper\("lock4", \{ restart: true \}\)/);
  assert.match(notes, /navigate\("\/trophy"\)/);
  assert.match(notes, /CINEMA_POSTER_PATH/);
});

test("the pipeline is local, budgeted, and degrades to poster-only with a warning", () => {
  assert.doesNotMatch(pipeline, /https?:\/\/|\bfetch\s*\(/);
  assert.match(pipeline, /CINEMA_FILM_LIMIT_BYTES = 60_000_000/);
  assert.match(pipeline, /map_metadata/);
  assert.match(pipeline, /scale=720:1280/);
  assert.match(pipeline, /-crf", "23/);
  assert.match(pipeline, /WARNING[\s\S]*poster-only/);
  assert.match(pipeline, /process\.exit\(0\)/);
});

test("the build audit carries a separate cinema bucket and prints its subtotal", () => {
  assert.match(auditScript, /CINEMA_LIMIT_BYTES = 60_000_000/);
  assert.match(auditScript, /cinemaSubtotal/);
  assert.match(auditScript, /poster-only/);
  assert.doesNotMatch(auditScript, /sw\.js/);
});

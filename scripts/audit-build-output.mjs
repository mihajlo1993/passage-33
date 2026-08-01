import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Audits dist/ after a build. There is no service worker (stale caches once
 * masked fixes for days), so the audit walks the emitted files directly and
 * buckets them: shell (js/css/html/fonts), media, audio, models, vendor,
 * and CINEMA (the finale film + poster), each with its own budget and a
 * printed subtotal. A missing film is a WARNING (poster-only mode), never
 * a failure.
 */

const MAIN_LIMIT_BYTES = 2_000_000;
const SHELL_LIMIT_BYTES = 8_000_000;
const CINEMA_LIMIT_BYTES = 60_000_000;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(repoRoot, "dist");

function invariant(condition, message) {
  if (!condition) throw new Error(`[build-audit] ${message}`);
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

invariant(existsSync(distRoot), "dist/ is missing; run npm run build first");
const indexPath = path.join(distRoot, "index.html");
invariant(existsSync(indexPath), "dist/index.html is missing");

const html = readFileSync(indexPath, "utf8");
const entryMatch = html.match(
  /<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i,
);
invariant(entryMatch, "could not locate the module entry in dist/index.html");
const entryUrl = entryMatch[1];
const entryPath = path.join(distRoot, ...entryUrl.replace(/^\//, "").split("/"));
invariant(existsSync(entryPath), `main entry is missing: ${entryUrl}`);
const mainBytes = statSync(entryPath).size;
invariant(
  mainBytes < MAIN_LIMIT_BYTES,
  `main chunk is ${mainBytes} bytes; target is below ${MAIN_LIMIT_BYTES}`,
);

const buckets = {
  shell: { bytes: 0, files: 0 },
  audio: { bytes: 0, files: 0 },
  media: { bytes: 0, files: 0 },
  models: { bytes: 0, files: 0 },
  vendor: { bytes: 0, files: 0 },
  cinema: { bytes: 0, files: 0 },
  print: { bytes: 0, files: 0 },
  other: { bytes: 0, files: 0 },
};

function bucketFor(relative) {
  const posix = relative.split(path.sep).join("/");
  if (posix.startsWith("cinema/")) return "cinema";
  if (posix.startsWith("audio/")) return "audio";
  if (posix.startsWith("models/")) return "models";
  if (posix.startsWith("vendor/")) return "vendor";
  if (/^assets\/(?:print-routes|CodesScreen|GlyphsScreen|SheetsScreen)/.test(posix)) return "print";
  if (posix.startsWith("media/") || posix.startsWith("icons/") || posix === "og.png") return "media";
  if (
    posix === "index.html"
    || posix.startsWith("assets/")
  ) return "shell";
  return "other";
}

for (const file of walk(distRoot)) {
  const relative = path.relative(distRoot, file);
  const bucket = buckets[bucketFor(relative)];
  bucket.bytes += statSync(file).size;
  bucket.files += 1;
}

invariant(
  buckets.shell.bytes < SHELL_LIMIT_BYTES,
  `app shell is ${buckets.shell.bytes} bytes; target is below ${SHELL_LIMIT_BYTES}`,
);

// The cinema bucket: the finale film and its poster, under 60MB together.
const filmPath = path.join(distRoot, "cinema", "finale.mp4");
const posterPath = path.join(distRoot, "cinema", "poster.webp");
if (!existsSync(filmPath)) {
  console.warn("[build-audit] WARNING: cinema/finale.mp4 absent; the finale runs poster-only.");
} else {
  invariant(existsSync(posterPath), "cinema/poster.webp is missing beside the film");
  invariant(
    buckets.cinema.bytes < CINEMA_LIMIT_BYTES,
    `cinema bucket is ${buckets.cinema.bytes} bytes; target is below ${CINEMA_LIMIT_BYTES}`,
  );
}

// Offline invariants: the required shell and audio assets ship in dist.
const requiredAssets = [
  "media/cold-open.webp",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "audio/keeper/keeper-intro.mp3",
  "audio/keeper/keeper-lock1.mp3",
  "audio/keeper/keeper-lock2.mp3",
  "audio/keeper/keeper-lock3.mp3",
  "audio/keeper/keeper-lock4.mp3",
  "audio/keeper/keeper-dark.mp3",
  "audio/keeper/keeper-refuse.mp3",
  "models/witnessField.glb",
  "models/witnessRunner.glb",
  "models/witnessWager.glb",
  "models/witnessSparkle.glb",
  "vendor/model-viewer.min.js",
];
for (const asset of requiredAssets) {
  invariant(
    existsSync(path.join(distRoot, ...asset.split("/"))),
    `required offline asset is absent from dist: ${asset}`,
  );
}

const audioManifest = JSON.parse(
  readFileSync(path.join(repoRoot, "src", "audio", "manifest.json"), "utf8"),
);
const oneShots = audioManifest.audio.filter((entry) => entry.category === "oneshot");
const voices = audioManifest.audio.filter((entry) => entry.category === "voice");
const impulses = audioManifest.impulses;
invariant(oneShots.length === 10, `expected 10 one-shots, found ${oneShots.length}`);
invariant(voices.length === 5, `expected 5 voices, found ${voices.length}`);
invariant(impulses.length === 6, `expected 6 impulses, found ${impulses.length}`);
for (const entry of [...oneShots, ...voices, ...impulses]) {
  invariant(
    existsSync(path.join(distRoot, "audio", ...entry.fileName.split("/"))),
    `offline audio asset is absent from dist: audio/${entry.fileName}`,
  );
}

// No embedded payloads may creep back into the bundle.
const sourceFiles = [
  path.join(repoRoot, "src", "audio", "manifest.ts"),
  path.join(repoRoot, "src", "audio", "engine.ts"),
];
for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8");
  invariant(
    !/audio\.generated|impulses\.generated|data:audio|base64|hexToBytes/i.test(source),
    `embedded audio path remains in ${path.relative(repoRoot, file)}`,
  );
}

const assetsRoot = path.join(distRoot, "assets");
invariant(existsSync(assetsRoot), "dist/assets is missing");
const builtJavaScript = walk(assetsRoot)
  .filter((file) => /\.js$/i.test(file))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
invariant(builtJavaScript.length > 0, "dist/assets contains no JavaScript");
invariant(
  !/data:audio\/|hexToBytes/i.test(builtJavaScript),
  "embedded hex/base64 audio remains in built JavaScript",
);
invariant(
  !/data:image\/(?:png|webp);base64/i.test(builtJavaScript),
  "embedded PNG/WebP payload remains in built JavaScript",
);

const subtotals = Object.fromEntries(
  Object.entries(buckets).map(([name, bucket]) => [
    name,
    { files: bucket.files, bytes: bucket.bytes },
  ]),
);
console.log(
  JSON.stringify(
    {
      main: { url: entryUrl, bytes: mainBytes, limitBytes: MAIN_LIMIT_BYTES },
      buckets: subtotals,
      cinemaSubtotal: {
        bytes: buckets.cinema.bytes,
        limitBytes: CINEMA_LIMIT_BYTES,
        film: existsSync(filmPath) ? statSync(filmPath).size : null,
        poster: existsSync(posterPath) ? statSync(posterPath).size : null,
      },
      totalBytes: Object.values(buckets).reduce((sum, bucket) => sum + bucket.bytes, 0),
    },
    null,
    2,
  ),
);

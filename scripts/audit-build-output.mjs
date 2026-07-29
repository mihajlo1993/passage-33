import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAIN_LIMIT_BYTES = 2_000_000;
const PRECACHE_LIMIT_BYTES = 8_000_000;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(repoRoot, "dist");

function invariant(condition, message) {
  if (!condition) throw new Error(`[build-audit] ${message}`);
}

function distPath(url) {
  const relative = url.replace(/^\//, "").split("/").join(path.sep);
  const resolved = path.resolve(distRoot, relative);
  invariant(
    resolved === distRoot || resolved.startsWith(distRoot + path.sep),
    `precache path escaped dist: ${url}`,
  );
  return resolved;
}

function collectJavaScriptFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectJavaScriptFiles(file));
    else if (entry.isFile() && /\.js$/i.test(entry.name)) files.push(file);
  }
  return files;
}

const indexPath = path.join(distRoot, "index.html");
const workerPath = path.join(distRoot, "sw.js");
invariant(existsSync(indexPath), "dist/index.html is missing");
invariant(existsSync(workerPath), "dist/sw.js is missing");

const html = readFileSync(indexPath, "utf8");
const entryMatch = html.match(
  /<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i,
);
invariant(entryMatch, "could not locate the module entry in dist/index.html");
const entryUrl = entryMatch[1];
const normalizedEntryUrl = entryUrl.replace(/^\//, "");
const entryPath = distPath(entryUrl);
invariant(existsSync(entryPath), `main entry is missing: ${entryUrl}`);
const mainBytes = statSync(entryPath).size;
invariant(
  mainBytes < MAIN_LIMIT_BYTES,
  `main chunk is ${mainBytes} bytes; target is below ${MAIN_LIMIT_BYTES}`,
);

const worker = readFileSync(workerPath, "utf8");
const precacheUrls = [
  ...worker.matchAll(/\{url:"([^"]+)"/g),
].map((match) => match[1]);
const uniqueUrls = [...new Set(precacheUrls)];
invariant(uniqueUrls.length > 0, "service worker has no precache entries");
const requiredShellAssets = [
  "index.html",
  normalizedEntryUrl,
  "media/cold-open.webp",
  "media/trophy.webp",
  "icons/icon-192.png",
  "icons/icon-512.png",
];
for (const requiredShellAsset of requiredShellAssets) {
  invariant(
    uniqueUrls.includes(requiredShellAsset),
    `offline shell asset is absent from precache: ${requiredShellAsset}`,
  );
}

let precacheBytes = 0;
for (const url of uniqueUrls) {
  const file = distPath(url);
  invariant(existsSync(file), `precache target is missing: ${url}`);
  precacheBytes += statSync(file).size;

  invariant(
    !/^(?:media\/sheet|assets\/(?:print-routes|CodesScreen|GlyphsScreen|SheetsScreen)-)/i.test(url),
    `print-only asset entered precache: ${url}`,
  );
  if (/\.png$/i.test(url)) {
    invariant(
      /^icons\/icon-(?:192|512)\.png$/i.test(url),
      `non-icon PNG entered precache: ${url}`,
    );
  }
}

invariant(
  precacheBytes < PRECACHE_LIMIT_BYTES,
  `unique precache is ${precacheBytes} bytes; target is below ${PRECACHE_LIMIT_BYTES}`,
);
const audioManifest = JSON.parse(
  readFileSync(path.join(repoRoot, "src", "audio", "manifest.json"), "utf8"),
);
const oneShots = audioManifest.audio.filter((entry) => entry.category === "oneshot");
const voices = audioManifest.audio.filter((entry) => entry.category === "voice");
const impulses = audioManifest.impulses;
invariant(oneShots.length === 10, `expected 10 one-shots, found ${oneShots.length}`);
invariant(voices.length === 5, `expected 5 voices, found ${voices.length}`);
invariant(impulses.length === 6, `expected 6 impulses, found ${impulses.length}`);
const requiredAudioAssets = [...oneShots, ...voices, ...impulses]
  .map((entry) => `audio/${entry.fileName}`);
invariant(
  new Set(requiredAudioAssets).size === 21,
  `expected 21 unique audio paths, found ${new Set(requiredAudioAssets).size}`,
);
for (const requiredAudioAsset of requiredAudioAssets) {
  invariant(
    uniqueUrls.includes(requiredAudioAsset),
    `offline audio asset is absent from precache: ${requiredAudioAsset}`,
  );
}

const requiredTapeAssets = Array.from(
  { length: 7 },
  (_, index) => `media/tape-${String(index + 1).padStart(2, "0")}.webp`,
);
for (const requiredTapeAsset of requiredTapeAssets) {
  invariant(
    uniqueUrls.includes(requiredTapeAsset),
    `offline tape still is absent from precache: ${requiredTapeAsset}`,
  );
}

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
const builtJavaScriptFiles = collectJavaScriptFiles(assetsRoot);
invariant(builtJavaScriptFiles.length > 0, "dist/assets contains no JavaScript");
const builtJavaScript = builtJavaScriptFiles
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");
invariant(
  !/data:audio\/|hexToBytes/i.test(builtJavaScript),
  "embedded hex/base64 audio remains in built JavaScript",
);
invariant(
  !/data:image\/(?:png|webp);base64/i.test(builtJavaScript),
  "embedded PNG/WebP payload remains in built JavaScript",
);

for (const requiredArAsset of [
  "ar/sprites/sheet01.webp",
  "ar/sprites/sheet02.webp",
  "ar/textures/creature.webp",
]) {
  invariant(
    uniqueUrls.includes(requiredArAsset),
    `offline AR asset is absent from precache: ${requiredArAsset}`,
  );
}

const generatedArPath = path.join(
  repoRoot,
  "src",
  "ar",
  "generated",
  "ar-assets.generated.ts",
);
const generatedAr = readFileSync(generatedArPath, "utf8");
invariant(
  statSync(generatedArPath).size < 16_384,
  "generated AR metadata module exceeds 16,383 bytes",
);
invariant(
  !/data:|base64|https?:\/\//i.test(generatedAr),
  "generated AR metadata contains an embedded or remote asset",
);

console.log(
  JSON.stringify(
    {
      main: { url: entryUrl, bytes: mainBytes, limitBytes: MAIN_LIMIT_BYTES },
      precache: {
        declarations: precacheUrls.length,
        uniqueEntries: uniqueUrls.length,
        bytes: precacheBytes,
        limitBytes: PRECACHE_LIMIT_BYTES,
      },
      coverage: {
        oneShots: oneShots.length,
        voices: voices.length,
        impulses: impulses.length,
        tapeWebps: requiredTapeAssets.length,
        arWebps: 3,
        shellAssets: requiredShellAssets.length,
      },
    },
    null,
    2,
  ),
);

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("processed media is wired through local WebP sources with PNG fallbacks", () => {
  const home = readFileSync("src/components/HomeScreen.tsx", "utf8");
  const trophy = readFileSync("src/components/TrophyScreen.tsx", "utf8");
  const mediaCss = readFileSync("src/styles/media.css", "utf8");
  assert.match(home, /MEDIA_ASSETS\.coldOpen/);
  assert.match(home, /<source srcSet=\{cover\.webp\.url\} type="image\/webp"/);
  assert.match(home, /<img src=\{cover\.png\.url\}/);
  assert.match(trophy, /MEDIA_ASSETS\.trophy/);
  assert.match(trophy, /<source srcSet=\{trophy\.webp\.url\} type="image\/webp"/);
  assert.match(trophy, /<img[\s\S]*src=\{trophy\.png\.url\}/);
  assert.match(mediaCss, /\.cold-open__media[\s\S]*position: absolute/);
  assert.match(mediaCss, /object-fit: cover/);
  assert.match(mediaCss, /\.trophy-image[\s\S]*aspect-ratio: 16 \/ 9/);
  assert.doesNotMatch(mediaCss, /#[0-9a-f]{3,8}\b/i);
});

test("build order keys the incoming creature before AR generation and precaches WebP", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  const processor = readFileSync("scripts/process-image-assets.mjs", "utf8");
  const arGenerator = readFileSync("scripts/generate-ar-assets.mjs", "utf8");
  const vite = readFileSync("vite.config.ts", "utf8");

  assert.match(packageJson.scripts.prebuild ?? "", /generate:media.*generate:ar/);
  assert.match(processor, /output: "ar\/textures\/creature"/);
  assert.match(processor, /keyBlackToAlpha\(canvas, spec\.source\)/);
  assert.match(arGenerator, /defaultIncomingDirectory/);
  assert.match(arGenerator, /incomingName = "creature\.png"/);
  assert.match(arGenerator, /path\.join\(incomingDirectory, incomingName\)/);
  assert.match(vite, /png,webp,svg/);
  assert.doesNotMatch(processor, /https?:\/\/|\bfetch\s*\(/);
});

test("pin 12 is previewed and routed to tape without resolving on scan", () => {
  const scanner = readFileSync("src/components/ScanScreen.tsx", "utf8");
  const start = scanner.indexOf("if (pinId === 12)");
  const end = scanner.indexOf("if (pin?.resolution", start);
  assert.ok(start >= 0 && end > start);
  const branch = scanner.slice(start, end);
  assert.match(branch, /previewPin\(pinId, "scan"\)/);
  assert.match(branch, /navigate\("\/tape"\)/);
  assert.doesNotMatch(branch, /resolvePin\(/);
});

test("app shell owns the tape route and resolves pin 12 only after playback", () => {
  const app = readFileSync("src/components/GameApp.tsx", "utf8");
  assert.match(app, /"\/tape"/);
  assert.match(app, /TapePlaybackScreen/);
  assert.match(app, /resolvePin\(12, "scan"\)/);
  assert.match(app, /navigate\("\/map"\)/);
  assert.match(app, /route === "\/tape"/);
});

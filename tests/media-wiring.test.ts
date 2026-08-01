import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("phone media is wired through local WebP only", () => {
  const home = readFileSync("src/components/HomeScreen.tsx", "utf8");
  const mediaCss = readFileSync("src/styles/media.css", "utf8");
  assert.match(home, /MEDIA_ASSETS\.coldOpen/);
  assert.match(home, /const coverUrl = cover\.webp\?\.url/);
  assert.match(home, /src=\{coverUrl\}/);
  assert.doesNotMatch(home, /\.png\.url|\/og\.png|<source\b|<picture\b/);
  assert.match(mediaCss, /\.cold-open__media[\s\S]*position: absolute/);
  assert.match(mediaCss, /object-fit: cover/);
  assert.doesNotMatch(mediaCss, /#[0-9a-f]{3,8}\b/i);
});

test("the media generator stays local, deterministic, and PNG-source only", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  const processor = readFileSync("scripts/process-image-assets.mjs", "utf8");
  const vite = readFileSync("vite.config.ts", "utf8");

  assert.equal(packageJson.scripts.prebuild, undefined);
  assert.equal(packageJson.scripts.build, "tsc -b && vite build");
  assert.doesNotMatch(vite, /\*\.\{[^}]*png/);
  assert.doesNotMatch(processor, /https?:\/\/|\bfetch\s*\(/);
});

test("the tape and AR routes are gone from the shell entirely", () => {
  const app = readFileSync("src/components/GameApp.tsx", "utf8");
  const home = readFileSync("src/components/HomeScreen.tsx", "utf8");
  assert.ok(!app.includes("/tape"), "no tape route");
  assert.ok(!app.includes("TapePlaybackScreen"), "no tape screen import");
  assert.ok(!app.includes("ARScreen"), "no AR screen import");
  assert.ok(!app.includes('"/save"'), "no save route");
  assert.ok(!home.includes("/tape"), "the home driver no longer routes to tape");
});

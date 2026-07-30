import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("phone media is wired through local WebP only", () => {
  const home = readFileSync("src/components/HomeScreen.tsx", "utf8");
  const trophy = readFileSync("src/components/TrophyScreen.tsx", "utf8");
  const tape = readFileSync("src/components/TapePlaybackScreen.tsx", "utf8");
  const mediaCss = readFileSync("src/styles/media.css", "utf8");
  assert.match(home, /MEDIA_ASSETS\.coldOpen/);
  assert.match(home, /const coverUrl = cover\.webp\?\.url/);
  assert.match(home, /src=\{coverUrl\}/);
  assert.match(trophy, /MEDIA_ASSETS\.trophy/);
  assert.match(trophy, /src=\{trophy\.webp\.url\}/);
  assert.match(tape, /src=\{asset\.webp!\.url\}/);
  for (const phoneSource of [home, trophy, tape]) {
    assert.doesNotMatch(phoneSource, /\.png\.url|\/og\.png|<source\b|<picture\b/);
  }
  assert.match(mediaCss, /\.cold-open__media[\s\S]*position: absolute/);
  assert.match(mediaCss, /object-fit: cover/);
  assert.match(mediaCss, /\.trophy-image[\s\S]*aspect-ratio: 16 \/ 9/);
  assert.doesNotMatch(mediaCss, /#[0-9a-f]{3,8}\b/i);
});

test("build order keys the incoming creature and precaches WebP without general PNG", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  const processor = readFileSync("scripts/process-image-assets.mjs", "utf8");
  const arGenerator = readFileSync("scripts/generate-ar-assets.mjs", "utf8");
  const vite = readFileSync("vite.config.ts", "utf8");

  assert.equal(packageJson.scripts.prebuild, undefined);
  assert.equal(packageJson.scripts.build, "tsc -b && vite build");
  assert.match(packageJson.scripts["generate:assets"] ?? "", /generate:media.*generate:ar/);
  assert.match(processor, /output: "ar\/textures\/creature"/);
  assert.match(processor, /keyBlackToAlpha\(canvas, spec\.source\)/);
  assert.match(arGenerator, /defaultIncomingDirectory/);
  assert.match(arGenerator, /incomingName = "creature\.png"/);
  assert.match(arGenerator, /path\.join\(incomingDirectory, incomingName\)/);
  assert.match(vite, /html,webp,svg,webmanifest/);
  assert.doesNotMatch(vite, /\*\.\{[^}]*png/);
  assert.match(vite, /icons\/icon-192\.png/);
  assert.match(arGenerator, /ar["'], ["']sprites/);
  assert.match(arGenerator, /ar["'], ["']textures["'], ["']creature\.webp/);
  assert.doesNotMatch(arGenerator, /data:image|base64/i);
  assert.doesNotMatch(processor, /https?:\/\/|\bfetch\s*\(/);
});

test("pin 12 is previewed and routed to tape without resolving early", () => {
  const home = readFileSync("src/components/HomeScreen.tsx", "utf8");
  const gate = home.indexOf('nextPin.id === TAPE_PLAYBACK_PIN_ID');
  assert.ok(gate >= 0, "the home driver must own the tape handoff");
  assert.match(home, /previewPin\(nextPin\.id, mode\)/);
  assert.match(home, /"\/tape"/);
});

test("app shell owns the tape route and resolves pin 12 only after playback", () => {
  const app = readFileSync("src/components/GameApp.tsx", "utf8");
  assert.match(app, /"\/tape"/);
  assert.match(app, /TapePlaybackScreen/);
  assert.match(app, /resolvePin\(TAPE_PLAYBACK_PIN_ID, "action"\)/);
  assert.match(app, /navigate\("\/map"\)/);
  assert.match(app, /route === "\/tape"/);
});

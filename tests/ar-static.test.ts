import assert from "node:assert/strict";
import {
  readdirSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { resolutionModeForPin } from "../src/game/engine";
import { getPinById } from "../src/pins";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function sourceFilesUnder(relativeDirectory: string): string[] {
  const directory = path.join(repoRoot, relativeDirectory);
  const found: string[] = [];
  const visit = (currentDirectory: string): void => {
    for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "generated") visit(absolutePath);
      } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
        found.push(absolutePath);
      }
    }
  };
  visit(directory);
  return found.sort();
}

function combinedSource(files: readonly string[]): string {
  return files
    .map((file) => `\n/* FILE ${path.relative(repoRoot, file)} */\n${readFileSync(file, "utf8")}`)
    .join("\n");
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ");
}

function indexOfPattern(value: string, pattern: RegExp, from = 0): number {
  const relativeIndex = value.slice(from).search(pattern);
  return relativeIndex < 0 ? -1 : from + relativeIndex;
}

const arCodeFiles = sourceFilesUnder("src/ar");
const arCode = combinedSource(arCodeFiles);
const arComponentCode = combinedSource(
  arCodeFiles.filter((file) => file.endsWith(".tsx")),
);

test("AR pins and the game engine use the dedicated resolution method", () => {
  for (const [pinId, sheet] of [[3, "sheet01"], [17, "sheet02"]] as const) {
    const pin = getPinById(pinId);
    assert.ok(pin, `pin ${pinId} exists`);
    assert.equal(pin.resolution, "ar");
    assert.equal(pin.arTarget, sheet);
    assert.equal(resolutionModeForPin(pin), "ar");
  }

  const roomPin = getPinById(18);
  assert.ok(roomPin);
  assert.equal(roomPin.resolution, "ar");
  assert.equal(roomPin.scare, "roomMonster");
  assert.equal(roomPin.arTarget, undefined);
  assert.equal(resolutionModeForPin(roomPin), "ar");
});

test("the removed image-tracking package is absent while build tools stay pinned", () => {
  const packageJson = JSON.parse(source("package.json")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    overrides?: Record<string, string>;
  };
  const removedTrackerPackage = ["mind", "ar"].join("-");

  assert.equal(packageJson.dependencies[removedTrackerPackage], undefined);
  assert.equal(packageJson.overrides?.canvas, undefined);
  assert.equal(packageJson.devDependencies.canvas, "3.2.0");
  assert.equal(packageJson.dependencies.three, "0.160.1");
  assert.equal(packageJson.devDependencies["@types/three"], "0.160.0");
  assert.equal(packageJson.devDependencies.typescript, "5.9.3");
});

test("app-owned AR code cannot open a second camera or a runtime network path", () => {
  assert.doesNotMatch(arCode, /\bfetch\s*\(/);
  assert.doesNotMatch(arCode, /\bgetUserMedia\s*\(/);
  assert.doesNotMatch(arCode, /\bgetTracks\s*\(/);
  assert.doesNotMatch(arCode, /\btrack\s*\.\s*stop\s*\(/);
  assert.doesNotMatch(arCode, /\bTextureLoader\b/);
  assert.doesNotMatch(arCode, /addImageTargets|targetIndex|targetDatabase/);
  assert.doesNotMatch(arCode, /\b(?:XMLHttpRequest|WebSocket|EventSource)\b/);
  assert.doesNotMatch(arCode, /https?:\/\//i);

  assert.match(arCode, /\buseCamera\s*\(/);
  const sharedCameraSource = arCodeFiles
    .map((file) => readFileSync(file, "utf8"))
    .find((candidate) => /\buseCamera\s*\(\)/.test(candidate));
  assert.ok(sharedCameraSource);
  assert.match(sharedCameraSource, /camera\.start\s*\(/);
  assert.match(sharedCameraSource, /video\.srcObject\s*=\s*stream/);
  assert.match(sharedCameraSource, /\.srcObject\s*=\s*null/);
  assert.match(sharedCameraSource, /camera\.stop\s*\(\)/);
  assert.doesNotMatch(sharedCameraSource, /new\s+MediaStream\s*\(/);
});

test("WebXR room placement keeps its exact offline session and floor hit-test path", () => {
  const configSource = source("src/ar/config.ts");
  assert.match(configSource, /WEBXR_SESSION_MODE\s*=\s*["']immersive-ar["']/);
  assert.match(
    compact(configSource),
    /Object\.freeze\(\[["']hit-test["'], ["']dom-overlay["']\]\)/,
  );
  assert.match(configSource, /domOverlay\s*:\s*\{\s*root\s*\}/);

  const roomRuntime = arCodeFiles
    .map((file) => readFileSync(file, "utf8"))
    .find((candidate) => /requestSession\s*\(/.test(candidate));
  assert.ok(roomRuntime);
  assert.match(roomRuntime, /requestSession\s*\(\s*WEBXR_SESSION_MODE\s*,/);
  assert.match(roomRuntime, /createRoomWebXrSessionInit\s*\(/);
  assert.match(roomRuntime, /requestReferenceSpace\s*\(\s*["']local["']\s*\)/);
  assert.match(roomRuntime, /requestReferenceSpace\s*\(\s*["']viewer["']\s*\)/);
  assert.match(roomRuntime, /requestHitTestSource/);
  assert.match(roomRuntime, /getHitTestResults\s*\(/);
  assert.match(roomRuntime, /isHorizontalFloorHitMatrix\s*\(/);
});

test("only room WebXR retains the twelve-second acquisition fallback", () => {
  const configSource = source("src/ar/config.ts");
  const stateSource = source("src/ar/state.ts");
  const roomScreen = source("src/ar/RoomARScreen.tsx");
  const imageScreen = source("src/ar/ImageARScreen.tsx");

  assert.match(
    configSource,
    /ROOM_AR_ACQUISITION_TIMEOUT_MS\s*=\s*motion\.eventMs\.arAcquire/,
  );
  assert.match(stateSource, /hasRoomArAcquisitionTimedOut\s*\(/);
  assert.match(stateSource, /fallbackReason\s*:\s*["']acquisition-timeout["']/);
  assert.match(
    roomScreen,
    /setTimeout\s*\([\s\S]{0,300}ROOM_AR_ACQUISITION_TIMEOUT_MS\s*\)/,
  );
  assert.doesNotMatch(imageScreen, /ACQUISITION|acquisition|tracking|onFound|onLost/);
});

test("2D sprites and room creature use local WebP URLs; pixel work remains build-time", () => {
  const assetsSource = source("src/ar/assets.ts");
  const generatedSource = source("src/ar/generated/ar-assets.generated.ts");
  const generatorSource = source("scripts/generate-ar-assets.mjs");
  const packageJson = JSON.parse(source("package.json")) as {
    scripts: Record<string, string>;
  };

  assert.match(assetsSource, /from ["']\.\/generated\/ar-assets\.generated["']/);
  assert.match(assetsSource, /AR_SHEET_ASSETS/);
  assert.match(assetsSource, /AR_CREATURE_ASSET/);
  assert.match(assetsSource, /spriteUrl/);
  assert.match(generatedSource, /\/ar\/sprites\/sheet01\.webp/);
  assert.match(generatedSource, /\/ar\/sprites\/sheet02\.webp/);
  assert.match(generatedSource, /\/ar\/textures\/creature\.webp/);
  assert.doesNotMatch(generatedSource, /data:|base64/i);
  assert.ok(Buffer.byteLength(generatedSource) < 16_384);
  assert.doesNotMatch(generatedSource, /targetDatabase|targetOrder/);
  assert.doesNotMatch(generatedSource, /https?:\/\//i);

  const roomRuntime = arCodeFiles
    .map((file) => readFileSync(file, "utf8"))
    .find((candidate) => /requestSession\s*\(/.test(candidate));
  assert.ok(roomRuntime);
  assert.match(roomRuntime, /AR_CREATURE_ASSET/);
  assert.doesNotMatch(arCode, /\b(?:getImageData|putImageData|createImageData|drawImage)\s*\(/);
  assert.doesNotMatch(arCode, /getContext\s*\(\s*["']2d["']\s*\)/);

  assert.match(generatorSource, /from ["']canvas["']/);
  assert.match(generatorSource, /function keyBlackToAlpha\s*\(/);
  assert.match(generatorSource, /getImageData\s*\(/);
  assert.match(generatorSource, /putImageData\s*\(/);
  assert.doesNotMatch(generatorSource, /addImageTargets|targetDatabase|targetIndex/i);

  const generatorScript = Object.entries(packageJson.scripts)
    .find(([, command]) => command.includes("generate-ar-assets.mjs"));
  assert.ok(generatorScript);
  const [generatorScriptName] = generatorScript;
  assert.equal(packageJson.scripts.prebuild, undefined);
  assert.match(packageJson.scripts["generate:assets"] ?? "", new RegExp(`npm run ${generatorScriptName}`));
  const pretest = packageJson.scripts.pretest ?? "";
  assert.ok(
    pretest.includes("generate-ar-assets.mjs")
      || pretest.includes(`npm run ${generatorScriptName}`),
  );
});

test("scanner hands eligible AR pins to /ar without resolving them as scans", () => {
  const scanSource = source("src/components/ScanScreen.tsx");
  const normalized = compact(scanSource);
  const arGate = indexOfPattern(normalized, /pin\?\.resolution === ["']ar["']/);
  const preview = indexOfPattern(normalized, /previewPin\(pinId, ["']ar["']\)/, arGate);
  const navigation = indexOfPattern(
    normalized,
    /navigate\(["']\/ar\?pin=["'] \+ String\(pinId\)\)/,
    preview,
  );
  const ordinaryScan = indexOfPattern(
    normalized,
    /resolvePin\(pinId, ["']scan["']\)/,
    navigation,
  );

  assert.ok(arGate >= 0);
  assert.match(normalized.slice(arGate, preview), /pinId === 3.*pinId === 17.*pinId === 18/);
  assert.ok(preview > arGate);
  assert.ok(navigation > preview);
  assert.ok(ordinaryScan > navigation);
  assert.doesNotMatch(scanSource, /resolvePin\s*\(\s*pinId\s*,\s*["']ar["']/);
  assert.match(arComponentCode, /resolvePin\s*\([^,]+,\s*["']ar["']\s*\)/);
});

test("room AR leaves every resolution cue to the phase-two coordinator", () => {
  const directorSource = compact(source("src/audio/AudioDirector.tsx"));
  const integrationSource = compact(source("src/game/phase2Integration.ts"));
  const roomScreen = source("src/ar/RoomARScreen.tsx");
  assert.doesNotMatch(directorSource, /useGameStore|\.play\(|startVoice/);
  assert.doesNotMatch(roomScreen, /\.play\(/);
  assert.doesNotMatch(
    roomScreen,
    /room-monster-arrival|pistol-fire|monster-hit|monster-collapse/,
  );
  assert.match(integrationSource, /roomMonster:\s*["']stinger-b["']/);
  assert.match(integrationSource, /scheduleDelayedStinger\(SCARE_AUDIO_CUES\[result\.pin\.scare\]\)/);
});

test("/ar is a real app route and cannot render the normal game chrome", () => {
  const appSource = source("src/components/GameApp.tsx");
  const normalized = compact(appSource);
  assert.match(normalized, /PLAY_ROUTES[^;]*["']\/ar["']/);
  assert.match(normalized, /(?:case ["']\/ar["']|route === ["']\/ar["'])/);
  assert.match(normalized, /lazy\(\(\) => import\(["']\.\.\/ar\/ARScreen["']\)/);

  const earlyArReturn = /if \(route === ["']\/ar["']\) (?:\{ )?return [\s\S]{0,700}<ARScreen/.test(normalized);
  const hideChromeDeclaration = normalized.match(/const hideChrome = [^;]+;/)?.[0] ?? "";
  assert.ok(earlyArReturn || /route === ["']\/ar["']/.test(hideChromeDeclaration));
});

test("pins 3 and 17 are immediate QR-selected 2D tap placements", () => {
  const imageScreen = compact(source("src/ar/ImageARScreen.tsx"));
  const arScreen = compact(source("src/ar/ARScreen.tsx"));

  assert.match(arScreen, /pinId === 3 \? ["']sheet01["'] : ["']sheet02["']/);
  assert.match(imageScreen, /useSharedCameraVideo\(true\)/);
  assert.match(imageScreen, /onPointerDown=\{placeSprite\}/);
  assert.match(imageScreen, /AR_SHEET_ASSETS\[scene\.sheetId\]/);
  assert.match(imageScreen, /src=\{asset\.spriteUrl\}/);
  assert.match(imageScreen, /window\.setTimeout\(finish, duration\)/);
  assert.match(imageScreen, /if \(!onResolved\(\)\) return/);
  assert.doesNotMatch(
    imageScreen,
    /imageRuntime|onFound|onLost|addImageTargets|targetDatabase|targetIndex|AR_ACQUISITION/i,
  );
});

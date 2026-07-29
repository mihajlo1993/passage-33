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
        continue;
      }
      if (/\.(?:ts|tsx)$/.test(entry.name)) found.push(absolutePath);
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
  for (const [pinId, target] of [[3, "sheet01"], [17, "sheet02"]] as const) {
    const pin = getPinById(pinId);
    assert.ok(pin, `pin ${pinId} exists`);
    assert.equal(pin.resolution, "ar");
    assert.equal(pin.arTarget, target);
    assert.equal(resolutionModeForPin(pin), "ar");
  }

  const roomPin = getPinById(18);
  assert.ok(roomPin, "pin 18 exists");
  assert.equal(roomPin.resolution, "ar");
  assert.equal(roomPin.scare, "roomMonster");
  assert.equal(roomPin.arTarget, undefined);
  assert.equal(resolutionModeForPin(roomPin), "ar");

  const typeSource = source("src/types.ts");
  assert.match(typeSource, /PinResolutionMode[^;]*\bar\b/);
});

test("MindAR, Three, and their compile-time types remain exactly pinned", () => {
  const packageJson = JSON.parse(source("package.json")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };

  assert.equal(packageJson.dependencies["mind-ar"], "1.2.5");
  assert.equal(packageJson.dependencies.three, "0.160.1");
  assert.equal(packageJson.devDependencies["@types/three"], "0.160.0");
  assert.equal(packageJson.devDependencies.typescript, "5.9.3");
});

test("app-owned AR code cannot open media or a runtime network path", () => {
  assert.doesNotMatch(arCode, /\bfetch\s*\(/);
  assert.doesNotMatch(arCode, /\bgetUserMedia\s*\(/);
  assert.doesNotMatch(arCode, /\bgetTracks\s*\(/);
  assert.doesNotMatch(arCode, /\btrack\s*\.\s*stop\s*\(/);
  assert.doesNotMatch(arCode, /\bTextureLoader\b/);
  assert.doesNotMatch(arCode, /\bMindARThree\b/);
  assert.doesNotMatch(arCode, /\.addImageTargets\s*\(/);
  assert.doesNotMatch(arCode, /\b(?:XMLHttpRequest|WebSocket|EventSource)\b/);
  assert.doesNotMatch(arCode, /https?:\/\//i);

  assert.match(arCode, /\buseCamera\s*\(/);
  const sharedCameraSource = arCodeFiles
    .map((file) => readFileSync(file, "utf8"))
    .find((candidate) => /\buseCamera\s*\(\)/.test(candidate));
  assert.ok(sharedCameraSource, "AR has a shared-camera video adapter");
  assert.match(sharedCameraSource, /camera\.start\s*\(/);
  assert.match(sharedCameraSource, /video\.srcObject\s*=\s*stream/);
  assert.match(sharedCameraSource, /\.srcObject\s*=\s*null/);
  assert.match(sharedCameraSource, /camera\.stop\s*\(\)/);
  assert.doesNotMatch(sharedCameraSource, /new\s+MediaStream\s*\(/);
});

test("WebXR room placement requests the exact offline session and floor hit-test path", () => {
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
  assert.ok(roomRuntime, "room AR runtime requests a WebXR session");
  assert.match(roomRuntime, /requestSession\s*\(\s*WEBXR_SESSION_MODE\s*,/);
  assert.match(roomRuntime, /createRoomWebXrSessionInit\s*\(/);
  assert.match(roomRuntime, /requestReferenceSpace\s*\(\s*["']local["']\s*\)/);
  assert.match(roomRuntime, /requestReferenceSpace\s*\(\s*["']viewer["']\s*\)/);
  assert.match(
    compact(roomRuntime),
    /requestHitTestSource\?*\.?(?:call)?\s*\([^)]*entityTypes\s*:\s*\[["']plane["']\]/,
  );
  assert.match(roomRuntime, /getHitTestResults\s*\(/);
  assert.match(roomRuntime, /isHorizontalFloorHitMatrix\s*\(/);
  assert.match(roomRuntime, /getHitTestResults[\s\S]{0,400}isHorizontalFloorHitMatrix/);
});

test("the twelve-second acquisition limit is wired to a usable 2D fallback", () => {
  const configSource = source("src/ar/config.ts");
  const tokenSource = source("src/tokens.ts");
  const normalizedTimeout = tokenSource
    .match(/arAcquire\s*:\s*([\d_]+)/)?.[1]
    ?.replaceAll("_", "");
  assert.equal(normalizedTimeout, "12000");
  assert.match(
    configSource,
    /AR_ACQUISITION_TIMEOUT_MS\s*=\s*motion\.eventMs\.arAcquire/,
  );

  const stateSource = source("src/ar/state.ts");
  assert.match(stateSource, /hasArAcquisitionTimedOut\s*\(/);
  assert.match(stateSource, /phase\s*:\s*["']fallback2d["']/);
  assert.match(stateSource, /fallbackReason\s*:\s*["']acquisition-timeout["']/);

  const timedFallbackScreens = arCodeFiles
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => readFileSync(file, "utf8"))
    .filter((candidate) => candidate.includes("AR_ACQUISITION_TIMEOUT_MS"));
  assert.equal(
    timedFallbackScreens.length,
    2,
    "both image and room mechanisms enforce the acquisition limit",
  );
  for (const screenSource of timedFallbackScreens) {
    assert.match(
      screenSource,
      /setTimeout\s*\([\s\S]{0,300}AR_ACQUISITION_TIMEOUT_MS\s*\)/,
    );
    assert.match(screenSource, /enterFallback\s*\(/);
    assert.match(screenSource, /onPointerDown=\{placeFallback\}/);
  }
  assert.match(arComponentCode, /src=\{asset\.overlayDataUri\}/);
  assert.match(arComponentCode, /src=\{AR_CREATURE_ASSET\.dataUri\}/);
});

test("AR images and target data are embedded, with black keying confined to the build script", () => {
  const assetsSource = source("src/ar/assets.ts");
  const generatedSource = source("src/ar/generated/ar-assets.generated.ts");
  const generatorSource = source("scripts/generate-ar-assets.mjs");
  const packageJson = JSON.parse(source("package.json")) as {
    scripts: Record<string, string>;
  };

  assert.match(assetsSource, /from ["']\.\/generated\/ar-assets\.generated["']/);
  assert.match(assetsSource, /targetDatabaseBuffer\s*\(\)/);
  assert.match(assetsSource, /AR_SHEET_ASSETS/);
  assert.match(assetsSource, /AR_CREATURE_ASSET/);
  assert.ok(
    (generatedSource.match(/data:image\/png;base64,/g) ?? []).length >= 5,
    "both paper/overlay pairs and the room creature are embedded PNGs",
  );
  assert.match(generatedSource, /["']targetDatabase["']\s*:/);
  assert.match(generatedSource, /["']base64["']\s*:\s*["'][A-Za-z0-9+/=]+["']/);
  assert.doesNotMatch(generatedSource, /https?:\/\//i);

  const imageRuntime = arCodeFiles
    .map((file) => readFileSync(file, "utf8"))
    .find((candidate) => /addImageTargetsFromBuffer\s*\(/.test(candidate));
  const roomRuntime = arCodeFiles
    .map((file) => readFileSync(file, "utf8"))
    .find((candidate) => /requestSession\s*\(/.test(candidate));
  assert.ok(imageRuntime, "the image runtime exists");
  assert.match(imageRuntime, /targetDatabaseBuffer\s*\(\)/);
  assert.match(imageRuntime, /AR_SHEET_ASSETS/);
  assert.ok(roomRuntime, "the room runtime exists");
  assert.match(roomRuntime, /AR_CREATURE_ASSET/);
  assert.doesNotMatch(
    arCode,
    /\b(?:getImageData|putImageData|createImageData|drawImage)\s*\(/,
  );
  assert.doesNotMatch(arCode, /getContext\s*\(\s*["']2d["']\s*\)/);
  assert.doesNotMatch(arCode, /\bCanvasRenderingContext2D\b/);
  assert.doesNotMatch(arCode, /\bglobalCompositeOperation\b/);

  assert.match(generatorSource, /from ["']canvas["']/);
  assert.match(generatorSource, /function keyBlackToAlpha\s*\(/);
  assert.match(generatorSource, /getImageData\s*\(/);
  assert.match(generatorSource, /putImageData\s*\(/);
  const arGeneratorScript = Object.entries(packageJson.scripts)
    .find(([, command]) => command.includes("generate-ar-assets.mjs"));
  assert.ok(arGeneratorScript, "package scripts expose the AR generator");
  const [arGeneratorScriptName] = arGeneratorScript;
  for (const lifecycle of ["prebuild", "pretest"] as const) {
    const command = packageJson.scripts[lifecycle] ?? "";
    assert.ok(
      command.includes("generate-ar-assets.mjs")
        || command.includes(`npm run ${arGeneratorScriptName}`),
      `${lifecycle} refreshes or checks embedded AR assets`,
    );
  }
  assert.match(packageJson.scripts.test ?? "", /tests\/ar-static\.test\.ts/);
});

test("the scanner hands eligible AR pins to /ar without resolving them as scans", () => {
  const scanSource = source("src/components/ScanScreen.tsx");
  const normalized = compact(scanSource);
  const arGate = indexOfPattern(
    normalized,
    /pin\?\.resolution === ["']ar["']/,
  );
  const preview = indexOfPattern(
    normalized,
    /previewPin\(pinId, ["']ar["']\)/,
    arGate,
  );
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

  assert.ok(arGate >= 0, "scanner recognizes the dedicated AR resolution mode");
  assert.match(
    normalized.slice(arGate, preview),
    /pinId === 3.*pinId === 17.*pinId === 18/,
  );
  assert.ok(preview > arGate, "AR prerequisites are previewed before navigation");
  assert.ok(navigation > preview, "eligible AR pins navigate with their pin id");
  assert.ok(ordinaryScan > navigation, "ordinary QR resolution remains after the AR handoff");
  assert.doesNotMatch(scanSource, /resolvePin\s*\(\s*pinId\s*,\s*["']ar["']/);
  assert.match(arComponentCode, /resolvePin\s*\([^,]+,\s*["']ar["']\s*\)/);
});

test("room-monster arrival audio is not auto-fired by the global audio director", () => {
  const directorSource = compact(source("src/audio/AudioDirector.tsx"));
  const integrationSource = compact(source("src/game/phase2Integration.ts"));
  assert.doesNotMatch(
    directorSource,
    /audio\.play\(\s*["']room-monster-arrival["']\s*\)/,
  );

  const computedScarePlay = integrationSource.match(
    /if \(result\.pin\.scare && result\.pin\.scare !== ["']roomMonster["']\) \{([^}]*)\}/,
  );
  assert.ok(computedScarePlay, "the global scare cue branch excludes roomMonster");
  assert.match(computedScarePlay[1], /cues\.push\(SCARE_AUDIO_CUES\[result\.pin\.scare\]\)/);
});

test("/ar is a real app route and cannot render the normal game chrome", () => {
  const appSource = source("src/components/GameApp.tsx");
  const normalized = compact(appSource);
  assert.match(normalized, /PLAY_ROUTES[^;]*["']\/ar["']/);
  assert.match(normalized, /(?:case ["']\/ar["']|route === ["']\/ar["'])/);
  assert.match(normalized, /ARScreen/);

  const earlyArReturn = /if \(route === ["']\/ar["']\) (?:\{ )?return [\s\S]{0,700}<ARScreen/.test(normalized);
  const hideChromeDeclaration = normalized.match(/const hideChrome = [^;]+;/)?.[0] ?? "";
  const chromeExplicitlyHidden = /route === ["']\/ar["']/.test(hideChromeDeclaration);
  assert.ok(
    earlyArReturn || chromeExplicitlyHidden,
    "the AR route either returns before the shell or explicitly suppresses its header/nav",
  );
});

test("image tracking rearms acquisition and cannot revive after fallback", () => {
  const imageScreen = compact(source("src/ar/ImageARScreen.tsx"));
  const lostHandler = imageScreen.match(
    /onLost: \(\) => \{([\s\S]*?)\}, onComplete:/,
  )?.[1] ?? "";

  assert.match(lostHandler, /completionSentRef\.current/);
  assert.match(lostHandler, /fallbackEnteredRef\.current/);
  assert.match(lostHandler, /setView\(["']tracking["']\)/);
  assert.match(lostHandler, /armAcquisitionTimer\(\)/);

  const fallbackGuards = imageScreen.match(/fallbackEnteredRef\.current/g) ?? [];
  assert.ok(
    fallbackGuards.length >= 6,
    "lazy import and every late runtime callback are guarded after fallback",
  );
  const lateFailureGuard = imageScreen.match(
    /\.catch\(\(reason: unknown\) => \{([\s\S]*?)enterFallback/,
  )?.[1] ?? "";
  assert.match(lateFailureGuard, /cancelled/);
  assert.match(lateFailureGuard, /completionSentRef\.current/);
  assert.match(lateFailureGuard, /fallbackEnteredRef\.current/);
  assert.match(lateFailureGuard, /return/);
  assert.match(imageScreen, /trackingStartedRef\.current = false/);
});

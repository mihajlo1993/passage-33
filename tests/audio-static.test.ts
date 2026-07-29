import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { INITIAL_ONE_SHOT_IDS, VOICE_DUCK_GAIN } from "../src/audio/engine";
import { audioPrecachePaths } from "../src/audio/manifest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function sourceFiles(relativeDirectory: string): string[] {
  const root = path.join(repoRoot, relativeDirectory);
  const visit = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return visit(target);
      return /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
    });
  return visit(root);
}

test("audio runtime uses local fetch/decode with no embedded or remote payload path", () => {
  const runtimeSource = sourceFiles("src/audio")
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  const engineSource = source("src/audio/engine.ts");
  const manifestSource = source("src/audio/manifest.ts");

  assert.match(engineSource, /fetcher\(publicPath\)/);
  assert.match(engineSource, /response\.arrayBuffer\(\)/);
  assert.match(engineSource, /decodeAudioData\(bytes\)/);
  assert.match(engineSource, /assetLoads\.get\(entry\.id\)/);
  assert.match(engineSource, /impulseLoads\.get\(entry\.zone\)/);
  assert.match(manifestSource, /`\/audio\/\$\{segments\.join\("\/"\)\}`/);

  assert.doesNotMatch(runtimeSource, /https?:\/\/|data:audio|createObjectURL|new\s+Audio\s*\(|AudioLoader/);
  assert.doesNotMatch(runtimeSource, /\b(?:atob|btoa)\s*\(|base64/i);
  assert.doesNotMatch(runtimeSource, /audio\.generated|impulses\.generated|assetCodec/);
  assert.doesNotMatch(runtimeSource, /Buffer\.from|Uint8Array\.from|String\.fromCharCode/);
  assert.ok(audioPrecachePaths.every((value) => value.startsWith("/audio/")));
});

test("generator writes public files and metadata, never JavaScript audio payloads", () => {
  const generatorSource = source("scripts/generate-audio-assets.mjs");
  const imports = [...generatorSource.matchAll(/from\s+["']([^"']+)["']/g)]
    .map((match) => match[1]);
  assert.ok(
    imports.length > 0
      && imports.every((specifier) => (
        specifier.startsWith("node:") || specifier === "./lib/protected-asset.mjs"
      )),
  );
  assert.ok(imports.includes("./lib/protected-asset.mjs"));
  assert.doesNotMatch(generatorSource, /node_modules|generated\/audio|generated\/impulses/);
  assert.match(generatorSource, /publicAudioDirectory/);
  assert.match(generatorSource, /manifestPath/);
  assert.equal(existsSync(path.join(repoRoot, "src/audio/assetCodec.ts")), false);
  assert.equal(existsSync(path.join(repoRoot, "src/audio/generated/audio.generated.ts")), false);
  assert.equal(existsSync(path.join(repoRoot, "src/audio/generated/impulses.generated.ts")), false);
});

test("initial unlock is bounded to the corridor impulse and Act I one-shots", () => {
  assert.deepEqual(INITIAL_ONE_SHOT_IDS, [
    "found",
    "refused",
    "released",
    "dial-tick",
    "write",
    "stinger-a",
    "heartbeat",
  ]);
  const engineSource = source("src/audio/engine.ts");
  assert.match(engineSource, /preloadInitialAssets/);
  assert.match(engineSource, /impulsesByZone\.get\("corridor"\)/);
  assert.doesNotMatch(
    engineSource.slice(
      engineSource.indexOf("private async preloadInitialAssets"),
      engineSource.indexOf("private resumeContext"),
    ),
    /category\s*===\s*["']voice["']|startVoice|loadImpulse\([^)]*(?:bathroom|entry|living|balcony|kitchen)/,
  );
});

test("voice controls expose a timed handle, duck to 0.3, and preserve silence", () => {
  assert.equal(VOICE_DUCK_GAIN, 0.3);
  const typesSource = source("src/audio/types.ts");
  const engineSource = source("src/audio/engine.ts");
  const providerSource = source("src/audio/AudioProvider.tsx");
  const hookSource = source("src/audio/useAudio.ts");

  assert.match(typesSource, /interface VoicePlaybackHandle/);
  assert.match(typesSource, /positionSeconds\(\): number/);
  assert.match(typesSource, /finished: Promise<void>/);
  assert.match(typesSource, /stop\(\): void/);
  assert.match(engineSource, /startVoice\(id: VoiceId\): Promise<VoicePlaybackHandle \| null>/);
  assert.match(engineSource, /public async say\(id: VoiceId\): Promise<void>/);
  assert.match(providerSource, /startVoice: \(id\) => engine\.startVoice\(id\)/);
  assert.match(providerSource, /setBedTension: \(value\) => engine\.setBedTension\(value\)/);
  assert.match(providerSource, /silence: \(\) => engine\.silence\(\)/);
  assert.match(hookSource, /startVoice: \(id: VoiceId\) => Promise<VoicePlaybackHandle \| null>/);
});

test("AudioDirector is inert and owns no gameplay subscriptions or cues", () => {
  const directorSource = source("src/audio/AudioDirector.tsx");
  assert.match(directorSource, /export function AudioDirector\(\)/);
  assert.match(directorSource, /return null/);
  assert.doesNotMatch(directorSource, /useGameStore|useAudio|\.play\(|\.say\(|startVoice|setBedTension|heartbeat/);
  assert.equal(existsSync(path.join(repoRoot, "src/audio/voiceCues.ts")), false);
});

test("visibility handling resumes only when visible and never cuts hidden audio", () => {
  const providerSource = source("src/audio/AudioProvider.tsx");
  const engineSource = source("src/audio/engine.ts");
  assert.match(providerSource, /visibilitychange/);
  assert.match(providerSource, /engine\.handleVisibility\(document\.visibilityState\)/);
  assert.match(engineSource, /visibilityState !== "visible"/);
  assert.doesNotMatch(providerSource, /visibilityState\s*===\s*["']hidden["'][\s\S]{0,120}(?:mute|suspend|silence)/);
});

test("audio-owned files contain no unresolved merge markers", () => {
  const ownedFiles = [
    ...sourceFiles("src/audio"),
    path.join(repoRoot, "scripts/generate-audio-assets.mjs"),
    path.join(repoRoot, "scripts/report-voice-audio.mjs"),
    path.join(repoRoot, "tests/audio-assets.test.ts"),
    path.join(repoRoot, "tests/audio-engine.test.ts"),
    path.join(repoRoot, "tests/audio-static.test.ts"),
  ];
  for (const file of ownedFiles) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /^(?:<<<<<<<|=======|>>>>>>>)/m, file);
  }
});

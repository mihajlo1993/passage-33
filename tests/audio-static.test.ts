import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { healthToBedTension } from "../src/audio/AudioDirector";
import {
  PLAYED_VOICE_STORAGE_KEY,
  readPlayedVoiceIds,
  TAPE_IMAGE_CUE_SECONDS,
  TAPE_PLACEHOLDER_DURATION_SECONDS,
  VOICE_CUES_BY_PIN,
  writePlayedVoiceIds,
} from "../src/audio/voiceCues";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

function sourceTree(relativePath: string): string {
  const root = fileURLToPath(new URL(relativePath, import.meta.url));
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name))
    .map((entry) => readFileSync(path.join(root, entry.name), "utf8"))
    .join("\n");
}

test("audio runtime is compiled-local with no URL, remote, media-element, or base64 path", () => {
  const runtimeSource = sourceTree("../src/audio");
  const generatorSource = source("../scripts/generate-audio-assets.mjs");
  assert.doesNotMatch(
    runtimeSource,
    /https?:\/\/|fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|new\s+Audio\s*\(|AudioLoader|createObjectURL/,
  );
  assert.match(runtimeSource, /decodeAudioData/);
  assert.doesNotMatch(runtimeSource + generatorSource, /base64/i);
  assert.doesNotMatch(generatorSource, /node_modules/);
  const imports = [...generatorSource.matchAll(/from\s+["']([^"']+)["']/g)]
    .map((match) => match[1]);
  assert.ok(imports.length > 0 && imports.every((specifier) => specifier.startsWith("node:")));
});

test("cold-open gesture still unlocks audio before session or async work", () => {
  const appSource = source("../src/components/GameApp.tsx");
  const unlockOffset = appSource.indexOf("audio.master.unlock()");
  const sessionOffset = appSource.indexOf('sessionStorage.getItem("bh7-intro-seen")');
  const continuationOffset = appSource.indexOf(".then(() => audio.say(voice))");
  assert.ok(unlockOffset >= 0);
  assert.ok(sessionOffset > unlockOffset);
  assert.ok(continuationOffset > sessionOffset);
});

test("visibility lifecycle delegates without cutting audio on hidden", () => {
  const providerSource = source("../src/audio/AudioProvider.tsx");
  assert.match(providerSource, /visibilitychange/);
  assert.match(providerSource, /engine\.handleVisibility\(document\.visibilityState\)/);
  assert.doesNotMatch(providerSource, /visibilityState\s*===\s*["']hidden["'][\s\S]{0,120}(?:mute|suspend)/);
});

test("health maps linearly to tension and heartbeat changes below forty", () => {
  assert.equal(healthToBedTension(100), 0);
  assert.equal(healthToBedTension(60), 0.5);
  assert.equal(healthToBedTension(20), 1);
  assert.equal(healthToBedTension(0), 1);
  const directorSource = source("../src/audio/AudioDirector.tsx");
  assert.match(directorSource, /audio\.setBedTension\(healthToBedTension\(health\)\)/);
  assert.match(directorSource, /audio\.heartbeat\(health < 40\)/);
});

test("pin voice mapping is exact, once-only storage is stable, and tape cuts are provisional", () => {
  assert.deepEqual(VOICE_CUES_BY_PIN, {
    1: "cold-open",
    12: "tape",
    23: "draught",
    26: "trophy",
    28: "present",
  });
  assert.equal(TAPE_PLACEHOLDER_DURATION_SECONDS, 75);
  assert.equal(TAPE_IMAGE_CUE_SECONDS.length, 7);
  assert.equal(TAPE_IMAGE_CUE_SECONDS[0], 0);
  assert.ok(TAPE_IMAGE_CUE_SECONDS.every((cue, index) => index === 0 || cue > TAPE_IMAGE_CUE_SECONDS[index - 1]));
  assert.ok(TAPE_IMAGE_CUE_SECONDS.at(-1)! < TAPE_PLACEHOLDER_DURATION_SECONDS);

  let stored: string | null = null;
  const storage = {
    getItem: (key: string) => key === PLAYED_VOICE_STORAGE_KEY ? stored : null,
    setItem: (key: string, value: string) => {
      if (key === PLAYED_VOICE_STORAGE_KEY) stored = value;
    },
  };
  const played = readPlayedVoiceIds(storage);
  played.add("tape");
  played.add("cold-open");
  writePlayedVoiceIds(storage, played);
  assert.equal(stored, '["cold-open","tape"]');
  assert.deepEqual([...readPlayedVoiceIds(storage)], ["cold-open", "tape"]);
});

test("owned director wires every game-state signal currently available", () => {
  const directorSource = source("../src/audio/AudioDirector.tsx");
  assert.match(directorSource, /grantedItems\.length > 0[\s\S]{0,60}play\("found"\)/);
  assert.match(directorSource, /!lastResolution\.ok[\s\S]{0,80}play\("refused"\)/);
  assert.match(directorSource, /pin\.resolution === "dial"[\s\S]{0,80}play\("released"\)/);
  assert.match(directorSource, /saveTriggered[\s\S]{0,60}play\("write"\)/);
  assert.match(directorSource, /9: "stinger-a"/);
  assert.match(directorSource, /18: "stinger-b"/);
  assert.match(directorSource, /22: "stinger-c"/);
  assert.match(directorSource, /play\("drag"\)[\s\S]{0,180}, 800\)/);
});

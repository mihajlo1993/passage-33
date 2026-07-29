import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("audio runtime has no URL-backed or network-backed playback path", () => {
  const runtimeSource = [
    "../src/audio/AudioDirector.tsx",
    "../src/audio/AudioProvider.tsx",
    "../src/audio/assetCodec.ts",
    "../src/audio/engine.ts",
    "../src/audio/graph.ts",
    "../src/audio/useAudio.ts",
  ].map(source).join("\n");

  assert.doesNotMatch(
    runtimeSource,
    /https?:\/\/|fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|new\s+Audio\s*\(|AudioLoader|TextureLoader/,
  );
  assert.match(runtimeSource, /decodeAudioData/);
});

test("cold-open gesture unlocks audio before session or async work", () => {
  const appSource = source("../src/components/GameApp.tsx");
  const unlockOffset = appSource.indexOf("audio.master.unlock()");
  const sessionOffset = appSource.indexOf(
    'sessionStorage.getItem("bh7-intro-seen")',
  );
  const continuationOffset = appSource.indexOf(".then(() => audio.say(voice))");

  assert.ok(unlockOffset >= 0);
  assert.ok(sessionOffset > unlockOffset);
  assert.ok(continuationOffset > sessionOffset);
});

test("visibility lifecycle delegates without muting on hidden", () => {
  const providerSource = source("../src/audio/AudioProvider.tsx");
  assert.match(providerSource, /visibilitychange/);
  assert.match(providerSource, /engine\.handleVisibility\(document\.visibilityState\)/);
  assert.doesNotMatch(providerSource, /visibilityState\s*===\s*["']hidden["'][\s\S]{0,120}(?:mute|suspend)/);
});
test("zone direction selects both its impulse and matching ambient bed", () => {
  const directorSource = source("../src/audio/AudioDirector.tsx");
  const zoneOffset = directorSource.indexOf("audio.setZone(zone)");
  const bedOffset = directorSource.indexOf('audio.ambient("ambient-" + zone)');
  assert.ok(zoneOffset >= 0);
  assert.ok(bedOffset > zoneOffset);
});

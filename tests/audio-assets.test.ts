import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { audioAssets, impulseAssets } from "../src/audio/manifest";

interface WaveInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  frameCount: number;
  data: Buffer;
}

function parseWave(base64: string): WaveInfo {
  const bytes = Buffer.from(base64, "base64");
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
  let format: Omit<WaveInfo, "frameCount" | "data"> | undefined;
  let data: Buffer | undefined;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const body = offset + 8;
    assert.ok(body + size <= bytes.length, `truncated ${id} chunk`);
    if (id === "fmt ") {
      assert.equal(bytes.readUInt16LE(body), 1, "integer PCM");
      format = {
        channels: bytes.readUInt16LE(body + 2),
        sampleRate: bytes.readUInt32LE(body + 4),
        bitsPerSample: bytes.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      data = bytes.subarray(body, body + size);
    }
    offset = body + size + (size % 2);
  }
  assert.ok(format && data);
  const blockAlign = format.channels * format.bitsPerSample / 8;
  assert.equal(data.length % blockAlign, 0);
  return { ...format, frameCount: data.length / blockAlign, data };
}

const ambient = [
  ["ambient-corridor", "ambient/corridor-bed.wav", 30000],
  ["ambient-bathroom", "ambient/bathroom-bed.wav", 24000],
  ["ambient-entry", "ambient/entry-bed.wav", 26000],
  ["ambient-living", "ambient/living-bed.wav", 32000],
  ["ambient-balcony", "ambient/balcony-bed.wav", 28000],
  ["ambient-kitchen", "ambient/kitchen-bed.wav", 30000],
] as const;
const pinDurations = [9000, 11000, 10000, 12000, 10000, 11000, 9000, 12000, 9000, 12000, 10000, 11000, 10000, 12000, 9000, 11000, 10000, 8000, 9000, 10000, 9000, 12000, 9000, 8000, 10000, 11000, 12000];
const oneShots: Readonly<Record<string, readonly [string, number]>> = {
  "ui-contact": ["oneshot/ui-contact.wav", 180],
  "ui-found": ["oneshot/ui-found.wav", 650],
  "ui-refused": ["oneshot/ui-refused.wav", 900],
  "torch-kill": ["oneshot/torch-kill.wav", 1800],
  "room-monster-arrival": ["oneshot/room-monster-arrival.wav", 3500],
  "close-quarters": ["oneshot/close-quarters.wav", 1500],
  "candle-light": ["oneshot/candle-light.wav", 700],
  "candle-out": ["oneshot/candle-out.wav", 500],
  "fan-stop": ["oneshot/fan-stop.wav", 2200],
  "pistol-fire": ["oneshot/pistol-fire.wav", 450],
  "monster-hit": ["oneshot/monster-hit.wav", 800],
  "monster-collapse": ["oneshot/monster-collapse.wav", 2400],
  "save-deck": ["oneshot/save-deck.wav", 2000],
  "trophy-resolve": ["oneshot/trophy-resolve.wav", 3500],
  heartbeat: ["oneshot/heartbeat-loop.wav", 1200],
};

test("audio inventory is unique and complete", () => {
  assert.equal(audioAssets.length, 50);
  assert.equal(new Set(audioAssets.map(({ id }) => id)).size, 50);
  assert.equal(new Set(audioAssets.map(({ fileName }) => fileName)).size, 50);
  assert.deepEqual(
    audioAssets.filter(({ category }) => category === "ambient").map(({ id }) => id),
    ambient.map(([id]) => id),
  );
  assert.deepEqual(
    audioAssets.filter(({ category }) => category === "voice").map(({ id }) => id),
    ["voice-host-intro", "voice-host-resume", ...pinDurations.map((_, index) => `voice-pin-${String(index + 1).padStart(2, "0")}`)],
  );
  assert.deepEqual(
    audioAssets.filter(({ category }) => category === "oneshot").map(({ id }) => id),
    Object.keys(oneShots),
  );

  for (const [id, fileName, durationMs] of ambient) {
    assert.deepEqual(audioAssets.find((asset) => asset.id === id)?.fileName, fileName);
    assert.equal(audioAssets.find((asset) => asset.id === id)?.durationMs, durationMs);
  }
  assert.equal(audioAssets.find(({ id }) => id === "voice-host-intro")?.durationMs, 12000);
  assert.equal(audioAssets.find(({ id }) => id === "voice-host-resume")?.durationMs, 6000);
  pinDurations.forEach((durationMs, index) => {
    const pin = index + 1;
    const asset = audioAssets.find(({ id }) => id === `voice-pin-${String(pin).padStart(2, "0")}`);
    assert.equal(asset?.fileName, `voice/host-pin-${String(pin).padStart(2, "0")}.wav`);
    assert.equal(asset?.durationMs, durationMs);
    assert.equal(asset?.pinId, pin);
  });
  for (const [id, [fileName, durationMs]] of Object.entries(oneShots)) {
    const asset = audioAssets.find((candidate) => candidate.id === id);
    assert.equal(asset?.fileName, fileName);
    assert.equal(asset?.durationMs, durationMs);
  }
  assert.ok(audioAssets.every(({ purpose }) => purpose.length >= 20));
});

test("every embedded audio WAV has its exact declared frame duration", () => {
  for (const asset of audioAssets) {
    const wave = parseWave(asset.base64);
    assert.equal(wave.channels, 1, asset.id);
    assert.equal(wave.frameCount, asset.frameCount, asset.id);
    assert.equal(wave.sampleRate, asset.sampleRate, asset.id);
    assert.equal(wave.frameCount * 1000, asset.durationMs * wave.sampleRate, asset.id);
    if (asset.placeholder) {
      assert.equal(wave.sampleRate, 8000);
      assert.equal(wave.bitsPerSample, 8);
      assert.ok(wave.data.every((sample) => sample === 128), `${asset.id} placeholder is silent`);
    }
  }
});

test("zone impulses are exact, bounded, nonzero, and decay", () => {
  const expected = [
    ["corridor", "ir/corridor.wav", 1800, 18, 0.34],
    ["bathroom", "ir/bathroom.wav", 1150, 6, 0.52],
    ["entry", "ir/entry.wav", 900, 10, 0.28],
    ["living", "ir/living.wav", 1350, 14, 0.3],
    ["balcony", "ir/balcony.wav", 2600, 110, 0.1],
    ["kitchen", "ir/kitchen.wav", 1050, 8, 0.38],
  ] as const;
  assert.equal(impulseAssets.length, 6);
  assert.equal(new Set(impulseAssets.map(({ id }) => id)).size, 6);
  for (const [zone, fileName, durationMs, preDelayMs, wet] of expected) {
    const asset = impulseAssets.find((candidate) => candidate.zone === zone);
    assert.ok(asset);
    assert.equal(asset.fileName, fileName);
    assert.equal(asset.durationMs, durationMs);
    assert.equal(asset.preDelayMs, preDelayMs);
    assert.equal(asset.wet, wet);
    const wave = parseWave(asset.base64);
    assert.equal(wave.sampleRate, 12000);
    assert.equal(wave.bitsPerSample, 16);
    assert.equal(wave.frameCount * 1000, durationMs * wave.sampleRate);
    const samples = Array.from({ length: wave.frameCount }, (_, index) => wave.data.readInt16LE(index * 2));
    const preDelayFrames = preDelayMs * wave.sampleRate / 1000;
    assert.ok(samples.slice(0, preDelayFrames).every((sample) => sample === 0));
    assert.notEqual(samples[preDelayFrames], 0);
    const peak = Math.max(...samples.map(Math.abs));
    assert.ok(peak > 1000 && peak <= 24000, `${zone} peak ${peak}`);
    const active = samples.slice(preDelayFrames);
    const window = Math.floor(active.length / 4);
    const energy = (values: number[]) => values.reduce((sum, value) => sum + value * value, 0) / values.length;
    assert.ok(energy(active.slice(-window)) < energy(active.slice(0, window)) * 0.2, `${zone} tail decays`);
  }
});

test("generated modules are deterministic and remain inside the embed budget", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const result = spawnSync(process.execPath, ["scripts/generate-audio-assets.mjs", "--check", "--quiet"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const generated = ["../src/audio/generated/audio.generated.ts", "../src/audio/generated/impulses.generated.ts"];
  const total = generated.reduce((sum, file) => sum + statSync(fileURLToPath(new URL(file, import.meta.url))).size, 0);
  assert.ok(total < 8 * 1024 * 1024, `generated modules use ${total} bytes`);
  const sources = generated.map((file) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8")).join("\n");
  assert.doesNotMatch(sources, /https?:\/\/|fetch\s*\(/);
});

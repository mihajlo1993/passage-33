import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  audioAssets,
  audioPrecachePaths,
  impulseAssets,
} from "../src/audio/manifest";

interface WaveInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  frameCount: number;
  samples: Int16Array;
}

function parseWave(bytes: Buffer): WaveInfo {
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WAVE");
  let sampleRate = 0;
  let channels = 0;
  let bitsPerSample = 0;
  let data: Buffer | undefined;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const body = offset + 8;
    assert.ok(body + size <= bytes.length, `truncated ${id} chunk`);
    if (id === "fmt ") {
      assert.equal(bytes.readUInt16LE(body), 1, "integer PCM");
      channels = bytes.readUInt16LE(body + 2);
      sampleRate = bytes.readUInt32LE(body + 4);
      bitsPerSample = bytes.readUInt16LE(body + 14);
    } else if (id === "data") {
      data = bytes.subarray(body, body + size);
    }
    offset = body + size + (size % 2);
  }
  assert.ok(data);
  assert.equal(channels, 1);
  assert.equal(bitsPerSample, 16);
  const samples = new Int16Array(data.length / 2);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = data.readInt16LE(index * 2);
  }
  return { sampleRate, channels, bitsPerSample, frameCount: samples.length, samples };
}

function listFiles(root: string, relative = ""): string[] {
  const directory = path.join(root, relative);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(relative, entry.name);
    return entry.isDirectory() ? listFiles(root, child) : [child.replaceAll("\\", "/")];
  });
}

function peakAbs(values: Int16Array): number {
  let peak = 0;
  for (const value of values) peak = Math.max(peak, Math.abs(value));
  return peak;
}

const expectedOneShots: Readonly<Record<string, readonly [string, number]>> = {
  found: ["oneshot/found.wav", 180],
  refused: ["oneshot/refused.wav", 400],
  released: ["oneshot/released.wav", 700],
  "dial-tick": ["oneshot/dial-tick.wav", 90],
  write: ["oneshot/write.wav", 1_600],
  "stinger-a": ["oneshot/stinger-a.wav", 2_200],
  "stinger-b": ["oneshot/stinger-b.wav", 3_500],
  "stinger-c": ["oneshot/stinger-c.wav", 1_400],
  drag: ["oneshot/drag.wav", 2_800],
  heartbeat: ["oneshot/heartbeat.wav", 1_400],
};

const expectedVoices: Readonly<Record<string, readonly [string, number, number]>> = {
  "cold-open": ["voice/cold-open.mp3", 22_000, 1],
  tape: ["voice/tape.mp3", 75_000, 12],
  draught: ["voice/draught.mp3", 16_000, 23],
  trophy: ["voice/trophy.mp3", 20_000, 26],
  present: ["voice/present.mp3", 14_000, 28],
};

test("manifest contains exactly ten one-shots, five voices, and no ambient files", () => {
  assert.equal(audioAssets.length, 15);
  assert.equal(new Set(audioAssets.map(({ id }) => id)).size, 15);
  assert.equal(new Set(audioAssets.map(({ fileName }) => fileName)).size, 15);
  assert.deepEqual(
    audioAssets.filter(({ category }) => category === "oneshot").map(({ id }) => id),
    Object.keys(expectedOneShots),
  );
  assert.deepEqual(
    audioAssets.filter(({ category }) => category === "voice").map(({ id }) => id),
    Object.keys(expectedVoices),
  );
  assert.ok(audioAssets.every(({ purpose }) => purpose.length >= 20));
  assert.ok(audioAssets.every(({ fileName }) => !fileName.includes("ambient")));
});

test("deterministic one-shots are exact PCM16 mono 44.1 kHz at their target peaks", () => {
  for (const [id, [fileName, durationMs]] of Object.entries(expectedOneShots)) {
    const asset = audioAssets.find((candidate) => candidate.id === id);
    assert.ok(asset);
    assert.equal(asset.fileName, fileName);
    assert.equal(asset.durationMs, durationMs);
    assert.equal(asset.placeholder, false);
    assert.equal(asset.generated, true);
    const bytes = Buffer.from(asset.hex, "hex");
    const wave = parseWave(bytes);
    assert.equal(wave.sampleRate, 44_100, id);
    assert.equal(wave.frameCount * 1_000, durationMs * wave.sampleRate, id);
    const peak = peakAbs(wave.samples);
    const targetDb = id.startsWith("stinger-") ? -3 : -6;
    const actualDb = 20 * Math.log10(peak / 32_767);
    assert.ok(Math.abs(actualDb - targetDb) < 0.03, `${id} peak ${actualDb.toFixed(3)} dBFS`);
    assert.ok(peak <= 32_767, `${id} does not clip`);
  }
});

test("heartbeat loop endpoints match and its second beat is quieter", () => {
  const heartbeat = audioAssets.find(({ id }) => id === "heartbeat");
  assert.ok(heartbeat);
  const { samples, sampleRate } = parseWave(Buffer.from(heartbeat.hex, "hex"));
  assert.ok(Math.abs(samples[0] - samples.at(-1)!) <= 1);
  const firstWindow = samples.slice(0, Math.round(sampleRate * 0.2));
  const secondWindow = samples.slice(Math.round(sampleRate * 0.26), Math.round(sampleRate * 0.46));
  assert.ok(peakAbs(secondWindow) < peakAbs(firstWindow));
});

test("voice files are mono 44.1 kHz and placeholders stay near declared duration", () => {
  for (const [id, [fileName, durationMs, pinId]] of Object.entries(expectedVoices)) {
    const asset = audioAssets.find((candidate) => candidate.id === id);
    assert.ok(asset);
    assert.equal(asset.fileName, fileName);
    assert.equal(asset.pinId, pinId);
    assert.equal(asset.sampleRate, 44_100);
    assert.equal(asset.channels, 1);
    assert.equal(asset.mimeType, "audio/mpeg");
    if (asset.placeholder) {
      assert.equal(asset.generated, true);
      assert.ok(asset.frameCount !== null);
      const actualMs = asset.frameCount! * 1_000 / asset.sampleRate;
      assert.ok(Math.abs(actualMs - durationMs) < 27, `${id} placeholder differs by ${actualMs - durationMs}ms`);
    }
  }
});

test("six unchanged impulses remain bounded, nonzero, delayed, and decaying", () => {
  const expected = [
    ["corridor", "ir/corridor.wav", 1_800, 18, 0.34],
    ["bathroom", "ir/bathroom.wav", 1_150, 6, 0.52],
    ["entry", "ir/entry.wav", 900, 10, 0.28],
    ["living", "ir/living.wav", 1_350, 14, 0.3],
    ["balcony", "ir/balcony.wav", 2_600, 110, 0.1],
    ["kitchen", "ir/kitchen.wav", 1_050, 8, 0.38],
  ] as const;
  assert.equal(impulseAssets.length, 6);
  for (const [zone, fileName, durationMs, preDelayMs, wet] of expected) {
    const asset = impulseAssets.find((candidate) => candidate.zone === zone);
    assert.ok(asset);
    assert.equal(asset.fileName, fileName);
    assert.equal(asset.durationMs, durationMs);
    assert.equal(asset.preDelayMs, preDelayMs);
    assert.equal(asset.wet, wet);
    const wave = parseWave(Buffer.from(asset.hex, "hex"));
    assert.equal(wave.sampleRate, 12_000);
    const preDelayFrames = preDelayMs * wave.sampleRate / 1_000;
    assert.ok(wave.samples.slice(0, preDelayFrames).every((sample) => sample === 0));
    assert.notEqual(wave.samples[preDelayFrames], 0);
    const peak = peakAbs(wave.samples);
    assert.ok(peak > 1_000 && peak <= 24_000, `${zone} peak ${peak}`);
    const active = wave.samples.slice(preDelayFrames);
    const window = Math.floor(active.length / 4);
    const energy = (values: Int16Array) => values.reduce((sum, value) => sum + value * value, 0) / values.length;
    assert.ok(energy(active.slice(-window)) < energy(active.slice(0, window)) * 0.2, `${zone} tail decays`);
  }
});

test("public audio inventory is complete and byte-identical to compiled precache entries", () => {
  const root = fileURLToPath(new URL("../public/audio", import.meta.url));
  const actual = listFiles(root).sort();
  const declared = audioPrecachePaths.map((value) => value.replace(/^\/audio\//, "")).sort();
  assert.deepEqual(actual, declared);
  for (const asset of [...audioAssets, ...impulseAssets]) {
    const publicBytes = readFileSync(path.join(root, asset.fileName));
    assert.ok(publicBytes.equals(Buffer.from(asset.hex, "hex")), asset.fileName);
  }
});

test("generated files are deterministic and compiled bytes remain inside budget", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const result = spawnSync(process.execPath, ["scripts/generate-audio-assets.mjs", "--check", "--quiet"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const generated = [
    "../src/audio/generated/audio.generated.ts",
    "../src/audio/generated/impulses.generated.ts",
  ];
  const total = generated.reduce(
    (sum, file) => sum + statSync(fileURLToPath(new URL(file, import.meta.url))).size,
    0,
  );
  assert.ok(total < 8 * 1024 * 1024, `generated modules use ${total} bytes`);
});

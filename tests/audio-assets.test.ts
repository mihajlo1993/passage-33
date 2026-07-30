import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import rawManifest from "../src/audio/manifest.json";
import { audioAssets, audioPrecachePaths, impulseAssets } from "../src/audio/manifest";

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

const mpeg1Layer3Kbps = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const mpeg2Layer3Kbps = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

function mp3Frame(bytes: Buffer, offset: number) {
  if (offset + 4 > bytes.length || bytes[offset] !== 0xff || (bytes[offset + 1] & 0xe0) !== 0xe0) return null;
  const versionBits = (bytes[offset + 1] >> 3) & 0x03;
  const layerBits = (bytes[offset + 1] >> 1) & 0x03;
  const bitrateIndex = (bytes[offset + 2] >> 4) & 0x0f;
  const sampleRateIndex = (bytes[offset + 2] >> 2) & 0x03;
  if (versionBits === 1 || layerBits !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) return null;
  const rates = versionBits === 3
    ? [44_100, 48_000, 32_000]
    : versionBits === 2
      ? [22_050, 24_000, 16_000]
      : [11_025, 12_000, 8_000];
  const sampleRate = rates[sampleRateIndex];
  const bitrate = (versionBits === 3 ? mpeg1Layer3Kbps : mpeg2Layer3Kbps)[bitrateIndex] * 1_000;
  const padding = (bytes[offset + 2] >> 1) & 1;
  return {
    sampleRate,
    channels: (bytes[offset + 3] >> 6) === 3 ? 1 : 2,
    frameLength: Math.floor((versionBits === 3 ? 144 : 72) * bitrate / sampleRate) + padding,
    samples: versionBits === 3 ? 1_152 : 576,
  };
}

function inspectMp3(bytes: Buffer) {
  let offset = 0;
  if (bytes.toString("ascii", 0, 3) === "ID3" && bytes.length >= 10) {
    offset = 10 + ((bytes[6] & 0x7f) << 21)
      + ((bytes[7] & 0x7f) << 14)
      + ((bytes[8] & 0x7f) << 7)
      + (bytes[9] & 0x7f);
  }
  while (offset + 4 <= bytes.length && mp3Frame(bytes, offset) === null) offset += 1;
  const first = mp3Frame(bytes, offset);
  assert.ok(first, "MP3 contains a complete MPEG Layer III frame");
  let durationSeconds = 0;
  let frames = 0;
  while (offset + 4 <= bytes.length) {
    const frame = mp3Frame(bytes, offset);
    if (frame === null || offset + frame.frameLength > bytes.length) break;
    assert.equal(frame.sampleRate, first.sampleRate);
    assert.equal(frame.channels, first.channels);
    durationSeconds += frame.samples / frame.sampleRate;
    frames += 1;
    offset += frame.frameLength;
  }
  assert.ok(frames > 0);
  return { sampleRate: first.sampleRate, channels: first.channels, durationSeconds, frames };
}

function listFiles(root: string, relative = ""): string[] {
  return readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap((entry) => {
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

const publicRoot = fileURLToPath(new URL("../public/audio", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

test("manifest contains exactly ten one-shots, five voices, and six impulses", () => {
  assert.equal(audioAssets.length, 15);
  assert.equal(impulseAssets.length, 6);
  assert.equal(new Set(audioAssets.map(({ id }) => id)).size, 15);
  assert.equal(new Set(audioAssets.map(({ publicPath }) => publicPath)).size, 15);
  assert.deepEqual(
    audioAssets.filter(({ category }) => category === "oneshot").map(({ id }) => id),
    Object.keys(expectedOneShots),
  );
  assert.deepEqual(
    audioAssets.filter(({ category }) => category === "voice").map(({ id }) => id),
    Object.keys(expectedVoices),
  );
  assert.ok([...audioAssets, ...impulseAssets].every(({ publicPath }) => /^\/audio\/[a-z0-9./-]+$/.test(publicPath)));
});

test("one-shots on disk are exact PCM16 mono 44.1 kHz at their target peaks", () => {
  for (const [id, [fileName, durationMs]] of Object.entries(expectedOneShots)) {
    const asset = rawManifest.audio.find((candidate) => candidate.id === id);
    assert.ok(asset);
    assert.equal(asset.fileName, fileName);
    assert.equal(asset.durationMs, durationMs);
    assert.equal(asset.placeholder, false);
    const wave = parseWave(readFileSync(path.join(publicRoot, fileName)));
    assert.equal(wave.sampleRate, 44_100, id);
    if (asset.generated === false) {
      // Production audio (hand-produced replacement): format is enforced,
      // exact duration and design peaks are the producer's choice.
      assert.equal(wave.channels ?? 1, 1, id);
      assert.ok(wave.frameCount > 0, id);
      continue;
    }
    assert.equal(asset.generated, true);
    assert.equal(wave.frameCount * 1_000, durationMs * wave.sampleRate, id);
    const peak = peakAbs(wave.samples);
    const targetDb = id.startsWith("stinger-") ? -3 : -6;
    const actualDb = 20 * Math.log10(peak / 32_767);
    assert.ok(Math.abs(actualDb - targetDb) < 0.03, `${id} peak ${actualDb.toFixed(3)} dBFS`);
  }
});

test("heartbeat loop endpoints match and its second beat is quieter", () => {
  const { samples, sampleRate } = parseWave(readFileSync(path.join(publicRoot, "oneshot/heartbeat.wav")));
  assert.ok(Math.abs(samples[0] - samples.at(-1)!) <= 1);
  const firstWindow = samples.slice(0, Math.round(sampleRate * 0.2));
  const secondWindow = samples.slice(Math.round(sampleRate * 0.26), Math.round(sampleRate * 0.46));
  assert.ok(peakAbs(secondWindow) < peakAbs(firstWindow));
});

test("voice files on disk are mono 44.1 kHz with measured manifest metadata", () => {
  for (const [id, [fileName, durationMs, pinId]] of Object.entries(expectedVoices)) {
    const asset = rawManifest.audio.find((candidate) => candidate.id === id);
    assert.ok(asset);
    assert.equal(asset.fileName, fileName);
    assert.equal(asset.pinId, pinId);
    const details = inspectMp3(readFileSync(path.join(publicRoot, fileName)));
    assert.equal(details.sampleRate, 44_100);
    assert.equal(details.channels, 1);
    if (asset.placeholder) {
      assert.ok(Math.abs(details.durationSeconds * 1_000 - durationMs) < 27, id);
      assert.equal(asset.generated, true);
    } else {
      assert.equal(asset.generated, false);
      assert.ok(details.durationSeconds > 1, id);
    }
    assert.ok(Math.abs(details.durationSeconds * 1_000 - asset.actualDurationMs) < 0.001, id);
    assert.equal(asset.frameCount, details.frames);
  }
});

test("impulses on disk remain bounded, delayed, nonzero, and decaying", () => {
  const expected = [
    ["corridor", "ir/corridor.wav", 1_800, 18, 0.34],
    ["bathroom", "ir/bathroom.wav", 1_150, 6, 0.52],
    ["entry", "ir/entry.wav", 900, 10, 0.28],
    ["living", "ir/living.wav", 1_350, 14, 0.3],
    ["balcony", "ir/balcony.wav", 2_600, 110, 0.1],
    ["kitchen", "ir/kitchen.wav", 1_050, 8, 0.38],
  ] as const;
  for (const [zone, fileName, durationMs, preDelayMs, wet] of expected) {
    const asset = impulseAssets.find((candidate) => candidate.zone === zone);
    assert.ok(asset);
    assert.equal(asset.fileName, fileName);
    assert.equal(asset.durationMs, durationMs);
    assert.equal(asset.preDelayMs, preDelayMs);
    assert.equal(asset.wet, wet);
    const wave = parseWave(readFileSync(path.join(publicRoot, fileName)));
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

test("public inventory exactly matches local precache paths", () => {
  const actual = listFiles(publicRoot).sort();
  const declared = audioPrecachePaths.map((value) => value.replace(/^\/audio\//, "")).sort();
  assert.deepEqual(actual, declared);
  assert.equal(actual.length, 29);
});

test("generator check and voice report pass without generated payload modules", () => {
  const check = spawnSync(process.execPath, ["scripts/generate-audio-assets.mjs", "--check", "--quiet"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(check.status, 0, check.stderr || check.stdout);

  const report = spawnSync(process.execPath, ["scripts/report-voice-audio.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(report.status, 0, report.stderr || report.stdout);
  for (const id of Object.keys(expectedVoices)) assert.match(report.stdout, new RegExp(`^${id}\\s`, "m"));
  assert.equal((report.stdout.match(/silent placeholder|production audio/g) ?? []).length, 5);

  assert.equal(existsSync(path.join(repoRoot, "src/audio/generated/audio.generated.ts")), false);
  assert.equal(existsSync(path.join(repoRoot, "src/audio/generated/impulses.generated.ts")), false);
  assert.equal(existsSync(path.join(repoRoot, "src/audio/assetCodec.ts")), false);
});

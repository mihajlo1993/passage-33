import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  readFileSync(path.join(repoRoot, "src", "audio", "manifest.json"), "utf8"),
);
const sampleRate = 44_100;

function fail(message) {
  throw new Error(`[voice-audio] ${message}`);
}

function silentMp3(durationMs) {
  const frameCount = Math.max(
    1,
    Math.round(durationMs * sampleRate / (1_000 * 1_152)),
  );
  const chunks = [];
  let paddingAccumulator = 0;
  const exactFrameBytes = 144 * 32_000 / sampleRate;

  for (let frame = 0; frame < frameCount; frame += 1) {
    paddingAccumulator += exactFrameBytes - Math.floor(exactFrameBytes);
    const padded = paddingAccumulator >= 1;
    if (padded) paddingAccumulator -= 1;
    const frameLength = Math.floor(exactFrameBytes) + (padded ? 1 : 0);
    const bytes = Buffer.alloc(frameLength);
    bytes[0] = 0xff;
    bytes[1] = 0xfb;
    bytes[2] = 0x10 | (padded ? 0x02 : 0);
    bytes[3] = 0xc0;
    chunks.push(bytes);
  }

  return Buffer.concat(chunks);
}

const mpeg1Layer3Kbps = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const mpeg2Layer3Kbps = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

function mp3Frame(bytes, offset) {
  if (offset + 4 > bytes.length || bytes[offset] !== 0xff || (bytes[offset + 1] & 0xe0) !== 0xe0) {
    return null;
  }
  const versionBits = (bytes[offset + 1] >> 3) & 0x03;
  const layerBits = (bytes[offset + 1] >> 1) & 0x03;
  const bitrateIndex = (bytes[offset + 2] >> 4) & 0x0f;
  const sampleRateIndex = (bytes[offset + 2] >> 2) & 0x03;
  if (versionBits === 1 || layerBits !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
    return null;
  }
  const rates = versionBits === 3
    ? [44_100, 48_000, 32_000]
    : versionBits === 2
      ? [22_050, 24_000, 16_000]
      : [11_025, 12_000, 8_000];
  const frameSampleRate = rates[sampleRateIndex];
  const bitrate = (versionBits === 3 ? mpeg1Layer3Kbps : mpeg2Layer3Kbps)[bitrateIndex] * 1_000;
  const padding = (bytes[offset + 2] >> 1) & 1;
  return {
    sampleRate: frameSampleRate,
    channels: (bytes[offset + 3] >> 6) === 3 ? 1 : 2,
    frameLength: Math.floor((versionBits === 3 ? 144 : 72) * bitrate / frameSampleRate) + padding,
    samples: versionBits === 3 ? 1_152 : 576,
  };
}

function inspectMp3(bytes, label) {
  let offset = 0;
  if (bytes.toString("ascii", 0, 3) === "ID3" && bytes.length >= 10) {
    const size = ((bytes[6] & 0x7f) << 21)
      | ((bytes[7] & 0x7f) << 14)
      | ((bytes[8] & 0x7f) << 7)
      | (bytes[9] & 0x7f);
    offset = 10 + size;
  }
  while (offset + 4 <= bytes.length && mp3Frame(bytes, offset) === null) offset += 1;
  const first = mp3Frame(bytes, offset);
  if (first === null) fail(`${label} does not contain an MPEG Layer III frame`);

  let seconds = 0;
  let frameCount = 0;
  while (offset + 4 <= bytes.length) {
    const frame = mp3Frame(bytes, offset);
    if (frame === null || offset + frame.frameLength > bytes.length) break;
    if (frame.sampleRate !== first.sampleRate) fail(`${label} changes sample rate mid-stream`);
    if (frame.channels !== first.channels) fail(`${label} changes channel mode mid-stream`);
    seconds += frame.samples / frame.sampleRate;
    frameCount += 1;
    offset += frame.frameLength;
  }
  if (frameCount === 0) fail(`${label} contains no complete frames`);
  return { durationSeconds: seconds, sampleRate: first.sampleRate, channels: first.channels };
}

const voices = manifest.audio.filter(({ category }) => category === "voice");
if (voices.length !== 5) fail(`Expected five voice entries, found ${voices.length}`);

console.log("Voice asset report (files under public/audio)");
for (const entry of voices) {
  const target = path.join(repoRoot, "public", "audio", ...entry.fileName.split("/"));
  const bytes = readFileSync(target);
  const details = inspectMp3(bytes, entry.fileName);
  if (details.sampleRate !== sampleRate || details.channels !== 1) {
    fail(`${entry.fileName} must be mono 44.1 kHz`);
  }
  const placeholder = bytes.equals(silentMp3(entry.durationMs));
  console.log(
    `${entry.id.padEnd(10)} ${details.durationSeconds.toFixed(3).padStart(7)}s  ${placeholder ? "silent placeholder" : "production audio"}  /audio/${entry.fileName}`,
  );
}

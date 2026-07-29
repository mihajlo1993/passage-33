import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
const unknownArgs = [...args].filter((arg) => !["--check", "--quiet"].includes(arg));
if (unknownArgs.length > 0) throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}`);

const checkOnly = args.has("--check");
const quiet = args.has("--quiet");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "src", "audio", "manifest.json");
const publicAudioDirectory = path.join(repoRoot, "public", "audio");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const ONE_SHOT_SAMPLE_RATE = 44_100;

function invariant(condition, message) {
  if (!condition) throw new Error(`[audio-assets] ${message}`);
}

function publicFile(fileName) {
  const target = path.resolve(publicAudioDirectory, ...fileName.split("/"));
  const relative = path.relative(publicAudioDirectory, target);
  invariant(
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
    `Unsafe public path: ${fileName}`,
  );
  return target;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function writeWaveHeader(buffer, frameCount, sampleRate, bitsPerSample) {
  const bytesPerSample = bitsPerSample / 8;
  const dataBytes = frameCount * bytesPerSample;
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataBytes, 40);
}

function parsePcmWave(bytes, label) {
  invariant(bytes.length >= 44, `${label} is too short to be a WAV file`);
  invariant(bytes.toString("ascii", 0, 4) === "RIFF", `${label} must use little-endian RIFF`);
  invariant(bytes.toString("ascii", 8, 12) === "WAVE", `${label} is not a WAVE file`);
  let format = null;
  let dataLength = null;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const chunkId = bytes.toString("ascii", offset, offset + 4);
    const chunkLength = bytes.readUInt32LE(offset + 4);
    const body = offset + 8;
    invariant(body + chunkLength <= bytes.length, `${label} contains a truncated ${chunkId} chunk`);
    if (chunkId === "fmt ") {
      format = {
        audioFormat: bytes.readUInt16LE(body),
        channels: bytes.readUInt16LE(body + 2),
        sampleRate: bytes.readUInt32LE(body + 4),
        blockAlign: bytes.readUInt16LE(body + 12),
        bitsPerSample: bytes.readUInt16LE(body + 14),
      };
    } else if (chunkId === "data") {
      dataLength = chunkLength;
    }
    offset = body + chunkLength + (chunkLength % 2);
  }
  invariant(format && dataLength !== null, `${label} must contain fmt and data chunks`);
  invariant(format.audioFormat === 1, `${label} must be uncompressed integer PCM`);
  invariant(format.channels === 1, `${label} must be mono`);
  invariant(format.bitsPerSample === 16, `${label} must be signed 16-bit PCM`);
  invariant(dataLength % format.blockAlign === 0, `${label} ends on a partial sample frame`);
  return { ...format, frameCount: dataLength / format.blockAlign };
}

function normalise(samples, peakDb) {
  let mean = 0;
  for (const sample of samples) mean += sample;
  mean /= samples.length;
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] -= mean;
    peak = Math.max(peak, Math.abs(samples[index]));
  }
  const target = 10 ** (peakDb / 20);
  const scale = peak === 0 ? 0 : target / peak;
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.max(-1, Math.min(1, samples[index] * scale));
  }
  return samples;
}

function pcm16Wave(samples, sampleRate = ONE_SHOT_SAMPLE_RATE) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  writeWaveHeader(bytes, samples.length, sampleRate, 16);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-32768, Math.min(32767, Math.round(samples[index] * 32767)));
    bytes.writeInt16LE(value, 44 + index * 2);
  }
  return bytes;
}

function envelope(t, attack, duration, power = 2) {
  if (t < 0 || t >= duration) return 0;
  const rise = Math.min(1, t / attack);
  return rise * Math.max(0, 1 - t / duration) ** power;
}

function onePoleLowpass(cutoff) {
  const alpha = 1 - Math.exp(-2 * Math.PI * cutoff / ONE_SHOT_SAMPLE_RATE);
  let value = 0;
  return (input) => {
    value += alpha * (input - value);
    return value;
  };
}

function noiseBandpass(lowCutoff, highCutoff) {
  const lowAlpha = 1 - Math.exp(-2 * Math.PI * lowCutoff / ONE_SHOT_SAMPLE_RATE);
  const highAlpha = 1 - Math.exp(-2 * Math.PI * highCutoff / ONE_SHOT_SAMPLE_RATE);
  let lowState = 0;
  let highState = 0;
  return (input) => {
    lowState += lowAlpha * (input - lowState);
    highState += highAlpha * (input - highState);
    return highState - lowState;
  };
}

function renderFound(length, random) {
  const samples = new Float64Array(length);
  const filtered = onePoleLowpass(2_800);
  for (let index = 0; index < length; index += 1) {
    const t = index / ONE_SHOT_SAMPLE_RATE;
    samples[index] = envelope(t, 0.003, 0.18, 4) * (
      filtered(random() * 2 - 1) * 0.55
      + Math.sin(2 * Math.PI * 900 * t) * Math.exp(-t / 0.06) * 0.7
    );
  }
  return samples;
}

function renderRefused(length, random) {
  const samples = new Float64Array(length);
  const low = onePoleLowpass(120);
  for (let index = 0; index < length; index += 1) {
    const t = index / ONE_SHOT_SAMPLE_RATE;
    samples[index] = low(random() * 2 - 1) * envelope(t, 0.004, 0.4, 1.7);
  }
  return samples;
}

function renderReleased(length, random) {
  const samples = new Float64Array(length);
  const thud = onePoleLowpass(180);
  for (let index = 0; index < length; index += 1) {
    const t = index / ONE_SHOT_SAMPLE_RATE;
    let value = Math.sin(2 * Math.PI * 90 * t) * envelope(t, 0.003, 0.42, 3) * 0.8;
    value += thud(random() * 2 - 1) * envelope(t, 0.002, 0.25, 3) * 0.35;
    for (const [start, frequency, amount] of [[0, 1_200, 0.6], [0.045, 1_800, 0.5]]) {
      const local = t - start;
      if (local >= 0) {
        value += Math.sin(2 * Math.PI * frequency * local)
          * envelope(local, 0.002, 0.5, 3) * amount;
      }
    }
    samples[index] = value;
  }
  return samples;
}

function renderDialTick(length, random) {
  const samples = new Float64Array(length);
  const dry = onePoleLowpass(3_200);
  for (let index = 0; index < length; index += 1) {
    const t = index / ONE_SHOT_SAMPLE_RATE;
    samples[index] = envelope(t, 0.0015, 0.09, 5) * (
      dry(random() * 2 - 1) * 0.55 + Math.sin(2 * Math.PI * 600 * t) * 0.7
    );
  }
  return samples;
}

function renderWrite(length, random) {
  const samples = new Float64Array(length);
  const clunk = onePoleLowpass(190);
  let phase = 0;
  for (let index = 0; index < length; index += 1) {
    const t = index / ONE_SHOT_SAMPLE_RATE;
    const frequency = 70 + Math.sin(2 * Math.PI * 0.7 * t) * 0.8;
    phase = (phase + frequency / ONE_SHOT_SAMPLE_RATE) % 1;
    const motorEnvelope = Math.min(1, t / 0.08) * Math.max(0, Math.min(1, (1.52 - t) / 0.18));
    const modulation = 0.72 + 0.28 * Math.sin(2 * Math.PI * 5.3 * t);
    let value = (phase * 2 - 1) * motorEnvelope * modulation * 0.38;
    const local = t - 1.2;
    if (local >= 0) {
      value += clunk(random() * 2 - 1) * envelope(local, 0.002, 0.32, 3) * 1.2;
    }
    samples[index] = value;
  }
  return samples;
}

function addSubDrop(samples, start, duration, fromHz, toHz, amount) {
  let phase = 0;
  for (let index = Math.max(0, Math.floor(start * ONE_SHOT_SAMPLE_RATE)); index < samples.length; index += 1) {
    const t = index / ONE_SHOT_SAMPLE_RATE - start;
    if (t >= duration) break;
    const progress = t / duration;
    const frequency = fromHz + (toHz - fromHz) * progress;
    phase += 2 * Math.PI * frequency / ONE_SHOT_SAMPLE_RATE;
    samples[index] += Math.sin(phase) * envelope(t, 0.005, duration, 1.5) * amount;
  }
}

function addTornTransient(samples, random, start, duration, low, high, amount) {
  const band = noiseBandpass(low, high);
  for (let index = Math.max(0, Math.floor(start * ONE_SHOT_SAMPLE_RATE)); index < samples.length; index += 1) {
    const t = index / ONE_SHOT_SAMPLE_RATE - start;
    if (t >= duration) break;
    const ragged = 0.58 + 0.42 * Math.abs(Math.sin(2 * Math.PI * (19 + 7 * t) * t));
    samples[index] += band(random() * 2 - 1)
      * envelope(t, 0.005, duration, 2.1) * ragged * amount;
  }
}

function renderStingerA(length, random) {
  const samples = new Float64Array(length);
  addSubDrop(samples, 0, 0.4, 90, 28, 1.1);
  addTornTransient(samples, random, 0, 0.6, 3_000, 9_000, 1.2);
  return samples;
}

function renderStingerB(length, random) {
  const samples = new Float64Array(length);
  const hit = 1.5;
  let lowState = 0;
  let highState = 0;
  for (let index = 0; index < Math.floor(hit * ONE_SHOT_SAMPLE_RATE); index += 1) {
    const t = index / ONE_SHOT_SAMPLE_RATE;
    const progress = t / hit;
    const center = 320 + 2_500 * progress ** 1.6;
    const lowAlpha = 1 - Math.exp(-2 * Math.PI * center * 0.55 / ONE_SHOT_SAMPLE_RATE);
    const highAlpha = 1 - Math.exp(-2 * Math.PI * center * 1.7 / ONE_SHOT_SAMPLE_RATE);
    const white = random() * 2 - 1;
    lowState += lowAlpha * (white - lowState);
    highState += highAlpha * (white - highState);
    samples[index] = (highState - lowState) * progress ** 2 * 0.55;
  }
  addSubDrop(samples, hit, 0.48, 90, 22, 1.35);
  addTornTransient(samples, random, hit, 0.72, 2_400, 10_000, 1.45);
  return samples;
}

function renderStingerC(length, random) {
  const samples = new Float64Array(length);
  const crack = noiseBandpass(480, 1_050);
  addSubDrop(samples, 0, 0.24, 84, 35, 1.15);
  for (let index = 0; index < length; index += 1) {
    const t = index / ONE_SHOT_SAMPLE_RATE;
    samples[index] += crack(random() * 2 - 1) * envelope(t, 0.002, 0.22, 4) * 1.6;
    samples[index] += Math.sin(2 * Math.PI * 700 * t) * envelope(t, 0.001, 0.18, 4) * 0.8;
  }
  return samples;
}

function renderDrag(length, random) {
  const samples = new Float64Array(length);
  let brown = 0;
  let lowState = 0;
  let highState = 0;
  let modulationPhase = 0;
  for (let index = 0; index < length; index += 1) {
    const t = index / ONE_SHOT_SAMPLE_RATE;
    const progress = t / (length / ONE_SHOT_SAMPLE_RATE);
    const center = 300 + 1_100 * Math.sin(Math.PI * progress);
    const lowAlpha = 1 - Math.exp(-2 * Math.PI * center * 0.55 / ONE_SHOT_SAMPLE_RATE);
    const highAlpha = 1 - Math.exp(-2 * Math.PI * center * 1.55 / ONE_SHOT_SAMPLE_RATE);
    brown = (brown + 0.018 * (random() * 2 - 1)) / 1.018;
    lowState += lowAlpha * (brown - lowState);
    highState += highAlpha * (brown - highState);
    const rate = 3 + 4 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.37 * t));
    modulationPhase += 2 * Math.PI * rate / ONE_SHOT_SAMPLE_RATE;
    const irregular = 0.32 + 0.68 * Math.abs(Math.sin(modulationPhase));
    samples[index] = (highState - lowState) * irregular * Math.sin(Math.PI * progress) * 3.6;
  }
  return samples;
}

function renderHeartbeat(length) {
  const samples = new Float64Array(length);
  for (let index = 0; index < length; index += 1) {
    const t = index / ONE_SHOT_SAMPLE_RATE;
    for (const [start, frequency, amount] of [[0, 60, 1], [0.26, 75, 0.68]]) {
      const local = t - start;
      if (local >= 0 && local < 0.19) {
        samples[index] += Math.sin(2 * Math.PI * frequency * local)
          * envelope(local, 0.01, 0.19, 2.7) * amount;
      }
    }
  }
  samples[0] = 0;
  samples[samples.length - 1] = 0;
  return samples;
}

const RENDERERS = {
  found: renderFound,
  refused: renderRefused,
  released: renderReleased,
  "dial-tick": renderDialTick,
  write: renderWrite,
  "stinger-a": renderStingerA,
  "stinger-b": renderStingerB,
  "stinger-c": renderStingerC,
  drag: renderDrag,
  heartbeat: renderHeartbeat,
};

function generatedOneShot(entry, index) {
  const frameCount = entry.durationMs * ONE_SHOT_SAMPLE_RATE / 1_000;
  invariant(Number.isInteger(frameCount), `${entry.id} duration does not align to 44.1 kHz`);
  const renderer = RENDERERS[entry.id];
  invariant(typeof renderer === "function", `No one-shot synthesiser for ${entry.id}`);
  const samples = renderer(frameCount, seededRandom(0xb470_000 + index));
  normalise(samples, entry.id.startsWith("stinger-") ? -3 : -6);
  if (entry.id === "heartbeat") {
    samples[0] = 0;
    samples[samples.length - 1] = 0;
  }
  return pcm16Wave(samples);
}

function generatedImpulse(entry) {
  const { sampleRate, bitsPerSample } = manifest.impulseFormat;
  const frameCount = entry.durationMs * sampleRate / 1_000;
  const preDelayFrames = entry.preDelayMs * sampleRate / 1_000;
  invariant(
    Number.isInteger(frameCount) && Number.isInteger(preDelayFrames),
    `${entry.id} timing does not align to ${sampleRate}Hz`,
  );
  const samples = new Float64Array(frameCount);
  const random = seededRandom(entry.seed);
  let filtered = 0;
  const activeFrames = frameCount - preDelayFrames;
  const reflectionA = Math.round(sampleRate * (9 + entry.seed % 4) / 1_000);
  const reflectionB = Math.round(sampleRate * (27 + entry.seed % 7) / 1_000);
  for (let index = 0; index < activeFrames; index += 1) {
    const white = random() * 2 - 1;
    filtered += entry.filterCoefficient * (white - filtered);
    const progress = activeFrames <= 1 ? 1 : index / (activeFrames - 1);
    const envelopeValue = (1 - progress) ** entry.decayPower;
    let sample = filtered * envelopeValue;
    if (index === 0) sample += 0.82;
    if (index === reflectionA) sample += 0.36 * envelopeValue;
    if (index === reflectionB) sample -= 0.2 * envelopeValue;
    samples[preDelayFrames + index] = sample;
  }
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const scale = peak === 0 ? 0 : 0.72 / peak;
  for (let index = 0; index < samples.length; index += 1) samples[index] *= scale;
  return pcm16Wave(samples, sampleRate);
}

function silentMp3(durationMs) {
  const frameCount = Math.max(
    1,
    Math.round(durationMs * ONE_SHOT_SAMPLE_RATE / (1_000 * 1_152)),
  );
  const chunks = [];
  let paddingAccumulator = 0;
  const exactFrameBytes = 144 * 32_000 / ONE_SHOT_SAMPLE_RATE;
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

const MPEG1_LAYER3_KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MPEG2_LAYER3_KBPS = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

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
  const sampleRate = rates[sampleRateIndex];
  const bitrate = (versionBits === 3 ? MPEG1_LAYER3_KBPS : MPEG2_LAYER3_KBPS)[bitrateIndex] * 1_000;
  const padding = (bytes[offset + 2] >> 1) & 1;
  const frameLength = Math.floor((versionBits === 3 ? 144 : 72) * bitrate / sampleRate) + padding;
  return {
    sampleRate,
    channels: (bytes[offset + 3] >> 6) === 3 ? 1 : 2,
    frameLength,
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
  invariant(first !== null, `${label} does not contain an MPEG Layer III frame`);
  let durationSeconds = 0;
  let frameCount = 0;
  while (offset + 4 <= bytes.length) {
    const frame = mp3Frame(bytes, offset);
    if (frame === null || offset + frame.frameLength > bytes.length) break;
    invariant(frame.sampleRate === first.sampleRate, `${label} changes sample rate mid-stream`);
    invariant(frame.channels === first.channels, `${label} changes channel mode mid-stream`);
    durationSeconds += frame.samples / frame.sampleRate;
    frameCount += 1;
    offset += frame.frameLength;
  }
  invariant(frameCount > 0, `${label} has no complete MPEG audio frames`);
  return {
    sampleRate: first.sampleRate,
    channels: first.channels,
    durationMs: durationSeconds * 1_000,
    frameCount,
  };
}

function fileMetadata(bytes) {
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
  };
}

function waveMetadata(bytes, entry, generated) {
  const wave = parsePcmWave(bytes, entry.fileName);
  invariant(
    wave.frameCount * 1_000 === entry.durationMs * wave.sampleRate,
    `${entry.fileName} must be exactly ${entry.durationMs}ms`,
  );
  return {
    ...fileMetadata(bytes),
    sampleRate: wave.sampleRate,
    channels: wave.channels,
    bitsPerSample: wave.bitsPerSample,
    frameCount: wave.frameCount,
    actualDurationMs: entry.durationMs,
    encoding: "pcm-signed-16",
    placeholder: false,
    generated,
  };
}

const ids = new Set();
const fileNames = new Set();
for (const entry of [...manifest.audio, ...manifest.impulses]) {
  invariant(!ids.has(entry.id), `Duplicate asset id: ${entry.id}`);
  invariant(!fileNames.has(entry.fileName), `Duplicate asset filename: ${entry.fileName}`);
  invariant(
    Number.isInteger(entry.durationMs) && entry.durationMs > 0,
    `${entry.id} needs a positive integer durationMs`,
  );
  ids.add(entry.id);
  fileNames.add(entry.fileName);
}
invariant(manifest.audio.filter(({ category }) => category === "oneshot").length === 10, "Expected ten one-shots");
invariant(manifest.audio.filter(({ category }) => category === "voice").length === 5, "Expected five voices");
invariant(manifest.impulses.length === 6, "Expected six impulses");

const publicOutputs = new Map();
const detailsById = new Map();
const oneShots = manifest.audio.filter(({ category }) => category === "oneshot");
oneShots.forEach((entry, index) => {
  const bytes = generatedOneShot(entry, index);
  publicOutputs.set(publicFile(entry.fileName), bytes);
  detailsById.set(entry.id, waveMetadata(bytes, entry, true));
});

for (const entry of manifest.audio.filter(({ category }) => category === "voice")) {
  const file = publicFile(entry.fileName);
  const placeholderBytes = silentMp3(entry.durationMs);
  const existing = existsSync(file) ? readFileSync(file) : null;
  const bytes = existing ?? placeholderBytes;
  const placeholder = bytes.equals(placeholderBytes);
  const mp3 = inspectMp3(bytes, entry.fileName);
  invariant(mp3.sampleRate === 44_100, `${entry.fileName} must be 44.1 kHz`);
  invariant(mp3.channels === 1, `${entry.fileName} must be mono`);
  publicOutputs.set(file, bytes);
  detailsById.set(entry.id, {
    ...fileMetadata(bytes),
    sampleRate: mp3.sampleRate,
    channels: mp3.channels,
    bitsPerSample: null,
    frameCount: mp3.frameCount,
    actualDurationMs: mp3.durationMs,
    encoding: "mpeg-layer-3",
    placeholder,
    generated: placeholder,
  });
}

for (const entry of manifest.impulses) {
  const bytes = generatedImpulse(entry);
  publicOutputs.set(publicFile(entry.fileName), bytes);
  detailsById.set(entry.id, waveMetadata(bytes, entry, true));
}

const nextManifest = {
  ...manifest,
  schemaVersion: 3,
  audio: manifest.audio.map((entry) => ({ ...entry, ...detailsById.get(entry.id) })),
  impulses: manifest.impulses.map((entry) => ({ ...entry, ...detailsById.get(entry.id) })),
};
const manifestSource = `${JSON.stringify(nextManifest, null, 2)}\n`;
const totalPublicBytes = [...publicOutputs.values()].reduce((total, bytes) => total + bytes.length, 0);

let stale = false;
function emit(file, contents) {
  if (checkOnly) {
    const expected = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
    if (!existsSync(file) || !readFileSync(file).equals(expected)) {
      console.error(`[audio-assets] Stale or missing file: ${path.relative(repoRoot, file)}`);
      stale = true;
    }
    return;
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

for (const [file, bytes] of publicOutputs) emit(file, bytes);
emit(manifestPath, manifestSource);
if (stale) process.exitCode = 1;
if (!quiet && !stale) {
  console.log(
    `[audio-assets] ${checkOnly ? "Verified" : "Wrote"} 10 one-shots, 5 voices, and 6 impulses (${totalPublicBytes} public bytes; no embedded payload).`,
  );
}

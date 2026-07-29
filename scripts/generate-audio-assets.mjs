import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
const unknownArgs = [...args].filter((arg) => !["--check", "--quiet"].includes(arg));
if (unknownArgs.length > 0) throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}`);

const checkOnly = args.has("--check");
const quiet = args.has("--quiet");
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "src", "audio", "manifest.json");
const outputDirectory = path.join(repoRoot, "src", "audio", "generated");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const sourceRoot = path.resolve(repoRoot, manifest.sourceRoot);
const maxGeneratedModuleBytes = 8 * 1024 * 1024;

function invariant(condition, message) {
  if (!condition) throw new Error(`[audio-assets] ${message}`);
}

function sourceFile(fileName) {
  const target = path.resolve(sourceRoot, ...fileName.split("/"));
  const relative = path.relative(sourceRoot, target);
  invariant(relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative), `Unsafe source path: ${fileName}`);
  return target;
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
      invariant(chunkLength >= 16, `${label} has an invalid fmt chunk`);
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
  invariant(format.bitsPerSample % 8 === 0, `${label} has an unsupported sample width`);
  invariant(format.blockAlign === format.channels * format.bitsPerSample / 8, `${label} has an invalid block alignment`);
  invariant(dataLength % format.blockAlign === 0, `${label} ends on a partial sample frame`);
  return { ...format, frameCount: dataLength / format.blockAlign };
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

function silentPlaceholder(durationMs) {
  const { sampleRate, bitsPerSample } = manifest.placeholderFormat;
  const frameCount = durationMs * sampleRate / 1000;
  invariant(Number.isInteger(frameCount), `Placeholder duration ${durationMs}ms does not align to ${sampleRate}Hz`);
  const bytes = Buffer.alloc(44 + frameCount);
  writeWaveHeader(bytes, frameCount, sampleRate, bitsPerSample);
  bytes.fill(128, 44);
  return bytes;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 1831565813) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function generatedImpulse(entry) {
  const { sampleRate, bitsPerSample } = manifest.impulseFormat;
  const frameCount = entry.durationMs * sampleRate / 1000;
  const preDelayFrames = entry.preDelayMs * sampleRate / 1000;
  invariant(Number.isInteger(frameCount) && Number.isInteger(preDelayFrames), `${entry.id} timing does not align to ${sampleRate}Hz`);
  const samples = new Float64Array(frameCount);
  const random = seededRandom(entry.seed);
  let filtered = 0;
  const activeFrames = frameCount - preDelayFrames;
  const reflectionA = Math.round(sampleRate * (9 + entry.seed % 4) / 1000);
  const reflectionB = Math.round(sampleRate * (27 + entry.seed % 7) / 1000);
  for (let index = 0; index < activeFrames; index += 1) {
    const white = random() * 2 - 1;
    filtered += entry.filterCoefficient * (white - filtered);
    const progress = activeFrames <= 1 ? 1 : index / (activeFrames - 1);
    let envelope = 1 - progress;
    for (let power = 1; power < entry.decayPower; power += 1) envelope *= 1 - progress;
    let sample = filtered * envelope;
    if (index === 0) sample += 0.82;
    if (index === reflectionA) sample += 0.36 * envelope;
    if (index === reflectionB) sample -= 0.2 * envelope;
    samples[preDelayFrames + index] = sample;
  }
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const scale = peak === 0 ? 0 : 0.72 / peak;
  const bytes = Buffer.alloc(44 + frameCount * 2);
  writeWaveHeader(bytes, frameCount, sampleRate, bitsPerSample);
  for (let index = 0; index < frameCount; index += 1) {
    const value = Math.max(-32768, Math.min(32767, Math.round(samples[index] * scale * 32767)));
    bytes.writeInt16LE(value, 44 + index * 2);
  }
  return bytes;
}

function waveMetadata(bytes, entry, placeholder, generated) {
  const wave = parsePcmWave(bytes, entry.fileName);
  invariant(wave.frameCount * 1000 === entry.durationMs * wave.sampleRate, `${entry.fileName} must be exactly ${entry.durationMs}ms; found ${wave.frameCount / wave.sampleRate}s`);
  return {
    base64: bytes.toString("base64"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
    sampleRate: wave.sampleRate,
    channels: wave.channels,
    bitsPerSample: wave.bitsPerSample,
    frameCount: wave.frameCount,
    encoding: wave.bitsPerSample === 8 ? "pcm-unsigned-8" : `pcm-signed-${wave.bitsPerSample}`,
    placeholder,
    generated,
  };
}

const ids = new Set();
const fileNames = new Set();
for (const entry of [...manifest.audio, ...manifest.impulses]) {
  invariant(!ids.has(entry.id), `Duplicate asset id: ${entry.id}`);
  invariant(!fileNames.has(entry.fileName), `Duplicate asset filename: ${entry.fileName}`);
  invariant(Number.isInteger(entry.durationMs) && entry.durationMs > 0, `${entry.id} needs a positive integer durationMs`);
  ids.add(entry.id);
  fileNames.add(entry.fileName);
}
invariant(manifest.audio.length === 50, `Expected 50 audio assets, found ${manifest.audio.length}`);
invariant(manifest.impulses.length === 6, `Expected 6 impulse assets, found ${manifest.impulses.length}`);

const embeddedAudio = {};
for (const entry of manifest.audio) {
  const file = sourceFile(entry.fileName);
  const placeholder = !existsSync(file);
  if (placeholder && !quiet) console.warn(`[audio-assets] Missing ${entry.fileName}; embedding an exact-duration silent PCM WAV placeholder.`);
  const bytes = placeholder ? silentPlaceholder(entry.durationMs) : readFileSync(file);
  embeddedAudio[entry.id] = waveMetadata(bytes, entry, placeholder, false);
}

const embeddedImpulses = {};
for (const entry of manifest.impulses) {
  const replacement = sourceFile(entry.fileName);
  const replaced = existsSync(replacement);
  const bytes = replaced ? readFileSync(replacement) : generatedImpulse(entry);
  embeddedImpulses[entry.id] = waveMetadata(bytes, entry, false, !replaced);
}

function moduleSource(exportName, interfaceName, values) {
  return `/* This file is deterministic build output. Run node scripts/generate-audio-assets.mjs; do not edit. */\n\nexport interface ${interfaceName} {\n  readonly base64: string;\n  readonly sha256: string;\n  readonly byteLength: number;\n  readonly sampleRate: number;\n  readonly channels: number;\n  readonly bitsPerSample: number;\n  readonly frameCount: number;\n  readonly encoding: string;\n  readonly placeholder: boolean;\n  readonly generated: boolean;\n}\n\nexport const ${exportName}: Readonly<Record<string, ${interfaceName}>> = ${JSON.stringify(values, null, 2)};\n`;
}

const outputs = new Map([
  [path.join(outputDirectory, "audio.generated.ts"), moduleSource("embeddedAudio", "EmbeddedAudio", embeddedAudio)],
  [path.join(outputDirectory, "impulses.generated.ts"), moduleSource("embeddedImpulses", "EmbeddedImpulse", embeddedImpulses)],
]);
const totalModuleBytes = [...outputs.values()].reduce((total, source) => total + Buffer.byteLength(source), 0);
invariant(totalModuleBytes < maxGeneratedModuleBytes, `Generated TypeScript is ${totalModuleBytes} bytes; budget is ${maxGeneratedModuleBytes}. Reduce source WAV sample rates/widths.`);

mkdirSync(outputDirectory, { recursive: true });
let stale = false;
for (const [file, source] of outputs) {
  if (checkOnly) {
    if (!existsSync(file) || readFileSync(file, "utf8") !== source) {
      console.error(`[audio-assets] Stale generated file: ${path.relative(repoRoot, file)}`);
      stale = true;
    }
  } else {
    writeFileSync(file, source);
  }
}
if (stale) process.exitCode = 1;
if (!quiet && !stale) console.log(`[audio-assets] ${checkOnly ? "Verified" : "Wrote"} 50 audio assets and 6 impulses (${totalModuleBytes} embedded module bytes).`);

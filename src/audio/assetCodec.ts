import type { AudioBufferLike, AudioContextLike } from "./types";

const HEX_PATTERN = /^(?:[0-9a-fA-F]{2})+$/;

/** Converts compiled hexadecimal bytes without creating a URL or fetching. */
export function hexToArrayBuffer(encoded: string): ArrayBuffer {
  const compact = encoded.replace(/\s/g, "");
  if (!HEX_PATTERN.test(compact)) {
    throw new Error("Invalid hexadecimal audio payload");
  }

  const output = new ArrayBuffer(compact.length / 2);
  const bytes = new Uint8Array(output);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(compact.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

export function decodeEmbeddedAudio(
  context: AudioContextLike,
  encoded: string,
): Promise<AudioBufferLike> {
  return context.decodeAudioData(hexToArrayBuffer(encoded));
}

import type { AudioBufferLike, AudioContextLike } from "./types";

const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** Decodes an embedded base64 payload without a network or media-element path. */
export function base64ToArrayBuffer(encoded: string): ArrayBuffer {
  const compact = encoded.replace(/\s/g, "");
  if (compact.length === 0 || !BASE64_PATTERN.test(compact)) {
    throw new Error("Invalid base64 audio payload");
  }

  const binary = globalThis.atob(compact);
  const output = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(output);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return output;
}

export function decodeEmbeddedAudio(
  context: AudioContextLike,
  encoded: string,
): Promise<AudioBufferLike> {
  return context.decodeAudioData(base64ToArrayBuffer(encoded));
}

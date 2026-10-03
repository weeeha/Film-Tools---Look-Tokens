import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export interface RenderKeyInput {
  model: string;
  ratio: string;
  seed: number;
  prompt: string;
}

// One key for staleness, the browser render map, and (phase 2) the Blob path.
// Synchronous SHA-256, so the browser and the server compute the same key.
export function renderKey(input: RenderKeyInput): string {
  const text = [input.model, input.ratio, String(input.seed), input.prompt].join("|");
  return bytesToHex(sha256(utf8ToBytes(text)));
}

// FNV-1a over the shot id: fixed per shot, so before and after differ only
// by the token change. Unsigned 32-bit.
export function shotSeed(shotId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < shotId.length; i++) {
    h ^= shotId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

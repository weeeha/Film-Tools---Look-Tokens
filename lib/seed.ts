import groups from "../data/seed/tokens.json";
import shots from "../data/seed/shots.json";
import { validate } from "./engine/validate";
import type { Seed } from "./engine/types";

// Runs at import time, so an invalid seed fails `next build` and every test.
function loadSeed(): Seed {
  const result = validate({ groups, shots });
  if (!result.ok) throw new Error(`Invalid seed:\n${result.errors.join("\n")}`);
  return result.seed;
}

export const seed: Seed = loadSeed();

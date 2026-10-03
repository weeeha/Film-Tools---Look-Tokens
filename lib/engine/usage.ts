import { compose } from "./compose";
import type { Shot, TokenGroup } from "./types";
import type { Adapter } from "./adapters/types";

// USED BY: value path -> ids of shots whose composed prompt contains it.
// Built from `reads`, so a value counts only where the adapter used it.
export function usage(groups: TokenGroup[], shots: Shot[], adapter: Adapter): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const shot of shots) {
    const c = compose(shot, groups, adapter);
    if (!c.ok) continue;
    for (const path of new Set(c.reads)) map.set(path, [...(map.get(path) ?? []), shot.id]);
  }
  return map;
}

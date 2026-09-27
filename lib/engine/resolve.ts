import type { Shot, TokenGroup } from "./types";

export interface Resolved {
  groups: TokenGroup[]; // in ref order
  unresolved: string[];
}

// Prim refs count as unresolved even though validate() already rejects them,
// so a spoiler can never reach an adapter through a skipped validation.
export function resolve(shot: Shot, groups: TokenGroup[]): Resolved {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const found: TokenGroup[] = [];
  const unresolved: string[] = [];
  for (const ref of shot.refs) {
    const g = byId.get(ref);
    if (!g || g.tier === "prim") unresolved.push(ref);
    else found.push(g);
  }
  return { groups: found, unresolved };
}

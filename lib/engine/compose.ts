import { resolve } from "./resolve";
import { parsePath, type Shot, type TokenGroup } from "./types";
import type { Adapter } from "./adapters/types";

export type Composition =
  | { ok: true; prompt: string; reads: string[] }
  | { ok: false; unresolved: string[] };

// Resolves refs, runs the adapter, and checks the adapter kept the rules.
// An unresolved ref stops composition: a quietly dropped token is the drift
// this tool exists to prevent.
export function compose(shot: Shot, groups: TokenGroup[], adapter: Adapter): Composition {
  const r = resolve(shot, groups);
  if (r.unresolved.length) return { ok: false, unresolved: r.unresolved };

  const out = adapter.compose(shot, r.groups);
  const byId = new Map(r.groups.map((g) => [g.id, g]));
  for (const path of out.reads) {
    const parsed = parsePath(path);
    const group = parsed ? byId.get(parsed.groupId) : undefined;
    const value = parsed && group ? group.values[parsed.key] : undefined;
    if (!group || !value) throw new Error(`${adapter.id} read ${path}, which the shot does not reference`);
    if (value.prompt === false || group.spoiler) {
      throw new Error(`${adapter.id} read ${path}, which is documentation-only`);
    }
  }
  return { ok: true, prompt: out.prompt, reads: out.reads };
}

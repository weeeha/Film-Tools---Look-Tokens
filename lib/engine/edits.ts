import { parsePath, type Edit, type Seed, type TokenGroup, type TokenValue } from "./types";

export interface ApplyResult {
  groups: TokenGroup[];
  conflicts: Edit[]; // edits whose path is gone or whose `from` no longer matches
}

// State is a pure fold of the edit log over the seed. History is recorded
// on each value as it is replaced, so rollback is just another edit.
export function applyEdits(groups: TokenGroup[], edits: Edit[]): ApplyResult {
  const next: TokenGroup[] = structuredClone(groups);
  const byId = new Map(next.map((g) => [g.id, g]));
  const conflicts: Edit[] = [];

  for (const edit of edits) {
    const parsed = parsePath(edit.path);
    const group = parsed ? byId.get(parsed.groupId) : undefined;
    const value = parsed && group ? group.values[parsed.key] : undefined;
    if (!group || !value || group.spoiler || value.current !== edit.from) {
      conflicts.push(edit);
      continue;
    }
    value.history = [...(value.history ?? []), { value: value.current, at: edit.at }];
    value.current = edit.to;
  }

  return { groups: next, conflicts };
}

// Builds the edit the UI should append, or null when there is nothing to do.
export function makeEdit(groups: TokenGroup[], path: string, to: string, at: string): Edit | null {
  const parsed = parsePath(path);
  const group = parsed ? groups.find((g) => g.id === parsed.groupId) : undefined;
  const value = parsed && group ? group.values[parsed.key] : undefined;
  const next = to.trim();
  if (!group || !value || group.spoiler || next === "" || next === value.current) return null;
  return { path, from: value.current, to: next, at };
}

export interface HistoryItem {
  value: string;
  replacedAt: string | null; // null for the current value
}

// Oldest first, current value last.
export function valueHistory(value: TokenValue): HistoryItem[] {
  return [
    ...(value.history ?? []).map((h) => ({ value: h.value, replacedAt: h.at })),
    { value: value.current, replacedAt: null },
  ];
}

// The seed with edits applied and history kept, ready to commit as the new seed.
export function exportSeed(seed: Seed, edits: Edit[]): Seed {
  return { groups: applyEdits(seed.groups, edits).groups, shots: seed.shots };
}

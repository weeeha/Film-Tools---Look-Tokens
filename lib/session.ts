import { compose, type Composition } from "./engine/compose";
import { renderKey, shotSeed } from "./engine/key";
import { promptValues, type Edit, type Shot, type TokenGroup } from "./engine/types";
import type { Adapter } from "./engine/adapters/types";

// Per-viewer session state. Pure functions only; the React hook wires them up.

export interface RenderEntry {
  kind: "mock" | "live";
  url: string;
  prompt: string;
  at: string;
}

export interface ApplyPair {
  shotId: string;
  beforeKey: string | null;
  afterKey: string;
}

export interface ApplyRecord {
  edits: Edit[]; // the edits this Apply rendered
  pairs: ApplyPair[];
  at: string;
}

export interface Session {
  log: Edit[];
  renders: Record<string, RenderEntry>; // renderKey -> image
  shown: Record<string, string>; // shotId -> renderKey last displayed as fresh
  appliedThrough: number; // log index up to which edits have been rendered
  lastApply: ApplyRecord | null;
}

export function emptySession(): Session {
  return { log: [], renders: {}, shown: {}, appliedThrough: 0, lastApply: null };
}

export function addEdit(session: Session, edit: Edit): Session {
  return { ...session, log: [...session.log, edit] };
}

export function pendingEdits(session: Session): Edit[] {
  return session.log.slice(session.appliedThrough);
}

export function dismissApply(session: Session): Session {
  return { ...session, lastApply: null };
}

export interface ShotView {
  shot: Shot;
  composition: Composition;
  key: string | null; // null when the shot does not compose
  display: RenderEntry | null; // the fresh render, else the last one shown
  fresh: boolean;
  needsFirstRender: boolean;
}

export function shotViews(groups: TokenGroup[], shots: Shot[], adapter: Adapter, session: Session): ShotView[] {
  return shots.map((shot) => {
    const composition = compose(shot, groups, adapter);
    const key = composition.ok
      ? renderKey({ model: adapter.target.model, ratio: shot.ratio, seed: shotSeed(shot.id), prompt: composition.prompt })
      : null;
    const current = key ? session.renders[key] : undefined;
    const shownKey = session.shown[shot.id];
    const previous = shownKey ? session.renders[shownKey] : undefined;
    return {
      shot,
      composition,
      key,
      display: current ?? previous ?? null,
      fresh: Boolean(current),
      needsFirstRender: key !== null && !current && !shownKey,
    };
  });
}

export function staleViews(views: ShotView[]): ShotView[] {
  return views.filter((v) => v.key !== null && !v.fresh);
}

export interface NewRender {
  shotId: string;
  key: string;
  entry: RenderEntry;
}

// `apply: true` is the "Apply to N shots" path and records before/after.
// `apply: false` is the first render of a never-rendered shot.
export function recordRenders(session: Session, renders: NewRender[], opts: { apply: boolean; at: string }): Session {
  const nextRenders = { ...session.renders };
  const nextShown = { ...session.shown };
  const pairs: ApplyPair[] = [];
  for (const r of renders) {
    nextRenders[r.key] = r.entry;
    pairs.push({ shotId: r.shotId, beforeKey: session.shown[r.shotId] ?? null, afterKey: r.key });
    nextShown[r.shotId] = r.key;
  }
  if (!opts.apply) return { ...session, renders: nextRenders, shown: nextShown };
  return {
    ...session,
    renders: nextRenders,
    shown: nextShown,
    appliedThrough: session.log.length,
    lastApply: { edits: pendingEdits(session), pairs, at: opts.at },
  };
}

// When every shot is fresh without a render (a rollback to rendered values),
// catch `shown` and `appliedThrough` up. Returns the same object when
// nothing changes, so a React effect calling it settles.
export function settle(session: Session, views: ShotView[]): Session {
  if (views.some((v) => v.key !== null && !v.fresh)) return session;
  let changed = session.appliedThrough !== session.log.length;
  const shown = { ...session.shown };
  for (const v of views) {
    if (v.key !== null && shown[v.shot.id] !== v.key) {
      shown[v.shot.id] = v.key;
      changed = true;
    }
  }
  return changed ? { ...session, shown, appliedThrough: session.log.length } : session;
}

// The shot's look values as one line, for the mock renderer and alt text.
export function lookText(shot: Shot, groups: TokenGroup[]): string {
  const look = groups.find((g) => g.id.startsWith("look/") && shot.refs.includes(g.id));
  return look ? promptValues(look).map(([, v]) => v.current).join(", ") : "";
}

export function lookId(shot: Shot): string | null {
  return shot.refs.find((r) => r.startsWith("look/")) ?? null;
}

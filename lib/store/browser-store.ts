import { get, set } from "idb-keyval";
import type { Session } from "../session";

// Where the session lives. IndexedDB normally; memory when IndexedDB is
// unavailable (private windows, blocked storage). `persistent` says which,
// so the UI can tell the viewer instead of failing quietly.

export interface Backend {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export interface SessionStore {
  readonly persistent: boolean;
  load(): Session | null;
  save(session: Session): Promise<void>;
}

const KEY = "look-tokens:session:v1";

function isSession(x: unknown): x is Session {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  return (
    Array.isArray(s.log) &&
    typeof s.renders === "object" &&
    s.renders !== null &&
    typeof s.shown === "object" &&
    s.shown !== null &&
    typeof s.appliedThrough === "number"
  );
}

export async function openStore(backend: Backend): Promise<SessionStore> {
  let persistent = true;
  let loaded: Session | null = null;
  try {
    const raw = await backend.get(KEY);
    loaded = isSession(raw) ? { ...raw, lastApply: raw.lastApply ?? null } : null;
  } catch {
    persistent = false;
  }

  return {
    get persistent() {
      return persistent;
    },
    load: () => loaded,
    async save(session) {
      loaded = session;
      if (!persistent) return;
      try {
        await backend.set(KEY, session);
      } catch {
        persistent = false;
      }
    },
  };
}

export const idbBackend: Backend = {
  get: (key) => get(key),
  set: (key, value) => set(key, value),
};

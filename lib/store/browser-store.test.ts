import { describe, expect, it } from "vitest";
import { emptySession } from "../session";
import { openStore, type Backend } from "./browser-store";

const memoryBackend = (initial: unknown = undefined): Backend & { data: Map<string, unknown> } => {
  const data = new Map<string, unknown>();
  if (initial !== undefined) data.set("look-tokens:session:v1", initial);
  return { data, get: async (k) => data.get(k), set: async (k, v) => void data.set(k, v) };
};

describe("openStore", () => {
  it("round-trips a session through the backend", async () => {
    const backend = memoryBackend();
    const store = await openStore(backend);
    expect(store.load()).toBeNull();
    const s = emptySession();
    await store.save(s);
    expect((await openStore(backend)).load()).toEqual(s);
    expect(store.persistent).toBe(true);
  });

  it("falls back to memory when the backend cannot be read", async () => {
    const store = await openStore({
      get: async () => {
        throw new Error("blocked");
      },
      set: async () => {},
    });
    expect(store.persistent).toBe(false);
    expect(store.load()).toBeNull();
    const s = emptySession();
    await store.save(s);
    expect(store.load()).toBe(s);
  });

  it("stops claiming persistence when a write fails", async () => {
    const store = await openStore({
      get: async () => undefined,
      set: async () => {
        throw new Error("quota");
      },
    });
    await store.save(emptySession());
    expect(store.persistent).toBe(false);
  });

  it("ignores a stored value that is not a session", async () => {
    expect((await openStore(memoryBackend({ log: "nope" }))).load()).toBeNull();
  });
});

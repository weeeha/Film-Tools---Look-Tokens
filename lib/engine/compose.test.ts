import { describe, expect, it, vi } from "vitest";
import { compose } from "./compose";
import { renderKey, shotSeed } from "./key";
import { resolve } from "./resolve";
import { echoAdapter, fixtureGroups, fixtureShot } from "./test-fixtures";
import type { Adapter } from "./adapters/types";

describe("resolve", () => {
  it("returns groups in ref order and lists unknown refs", () => {
    const r = resolve(fixtureShot("s1", ["bot/test", "look/test", "bot/nope"]), fixtureGroups);
    expect(r.groups.map((g) => g.id)).toEqual(["bot/test", "look/test"]);
    expect(r.unresolved).toEqual(["bot/nope"]);
  });

  it("treats a prim ref as unresolved, so spoilers never reach an adapter", () => {
    const r = resolve(fixtureShot("s1", ["prim/director-only-1"]), fixtureGroups);
    expect(r.groups).toEqual([]);
    expect(r.unresolved).toEqual(["prim/director-only-1"]);
  });
});

describe("compose", () => {
  it("returns the prompt and the value paths it read", () => {
    const c = compose(fixtureShot("s1", ["look/test", "bot/test"]), fixtureGroups, echoAdapter);
    expect(c).toEqual({
      ok: true,
      prompt: "Action of s1. grey light A robot.",
      reads: ["look/test.light", "bot/test.identity"],
    });
  });

  it("stops on an unresolved ref without calling the adapter", () => {
    const spy = vi.fn(echoAdapter.compose);
    const c = compose(fixtureShot("s1", ["bot/test", "bot/nope"]), fixtureGroups, { ...echoAdapter, compose: spy });
    expect(c).toEqual({ ok: false, unresolved: ["bot/nope"] });
    expect(spy).not.toHaveBeenCalled();
  });

  it("throws when an adapter reads a documentation-only value", () => {
    const leaky: Adapter = {
      ...echoAdapter,
      compose: () => ({ prompt: "x", reads: ["bot/test.behaviour"] }),
    };
    expect(() => compose(fixtureShot("s1", ["bot/test"]), fixtureGroups, leaky)).toThrow(/documentation-only/);
  });

  it("throws when an adapter reads a group the shot does not reference", () => {
    const stray: Adapter = { ...echoAdapter, compose: () => ({ prompt: "x", reads: ["prop/test.identity"] }) };
    expect(() => compose(fixtureShot("s1", ["bot/test"]), fixtureGroups, stray)).toThrow(/does not reference/);
  });
});

describe("renderKey", () => {
  it("is SHA-256 of model|ratio|seed|prompt", () => {
    expect(renderKey({ model: "gen4_image", ratio: "16:9", seed: 1, prompt: "a" })).toBe(
      "f7981ae3a89b7b1a9f3a4086c38f6f6ca8cb78de9bf22b356d09ff21754ee2d3",
    );
  });

  it("changes when the prompt changes", () => {
    const base = { model: "m", ratio: "16:9", seed: 1 };
    expect(renderKey({ ...base, prompt: "a" })).not.toBe(renderKey({ ...base, prompt: "b" }));
  });
});

describe("shotSeed", () => {
  it("is a fixed unsigned 32-bit number per shot id", () => {
    expect(shotSeed("s15-pour-medium")).toBe(3292263119);
    expect(shotSeed("s15-pour-medium")).toBe(shotSeed("s15-pour-medium"));
    expect(shotSeed("s15-trip")).not.toBe(shotSeed("s15-pour-medium"));
  });
});

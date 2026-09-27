import { describe, expect, it } from "vitest";
import { applyEdits, exportSeed, makeEdit, valueHistory } from "./edits";
import { validate } from "./validate";
import type { Edit, Seed, TokenGroup } from "./types";

const groups: TokenGroup[] = [
  { id: "look/test", tier: "semantic", citations: [], values: { light: { current: "grey" } } },
  {
    id: "prim/director-only-1",
    tier: "prim",
    spoiler: true,
    citations: [],
    values: { text: { current: "[director-only]", prompt: false } },
  },
];
const edit = (from: string, to: string, at: string): Edit => ({ path: "look/test.light", from, to, at });
const light = (gs: TokenGroup[]) => gs[0].values.light;

describe("applyEdits", () => {
  it("applies an edit and records the replaced value in history", () => {
    const { groups: out, conflicts } = applyEdits(groups, [edit("grey", "sodium", "t1")]);
    expect(conflicts).toEqual([]);
    expect(light(out).current).toBe("sodium");
    expect(light(out).history).toEqual([{ value: "grey", at: "t1" }]);
  });

  it("rolls back by appending an edit to an older value", () => {
    const { groups: out } = applyEdits(groups, [edit("grey", "sodium", "t1"), edit("sodium", "grey", "t2")]);
    expect(light(out).current).toBe("grey");
    expect(light(out).history).toEqual([
      { value: "grey", at: "t1" },
      { value: "sodium", at: "t2" },
    ]);
  });

  it("does not mutate its input", () => {
    applyEdits(groups, [edit("grey", "sodium", "t1")]);
    expect(light(groups).current).toBe("grey");
    expect(light(groups).history).toBeUndefined();
  });

  it("reports conflicts and keeps applying later edits", () => {
    const stale = edit("teal", "sodium", "t1");
    const missing: Edit = { path: "look/gone.light", from: "a", to: "b", at: "t2" };
    const good = edit("grey", "amber", "t3");
    const { groups: out, conflicts } = applyEdits(groups, [stale, missing, good]);
    expect(conflicts).toEqual([stale, missing]);
    expect(light(out).current).toBe("amber");
  });

  it("never edits a spoiler group", () => {
    const e: Edit = { path: "prim/director-only-1.text", from: "[director-only]", to: "x", at: "t1" };
    expect(applyEdits(groups, [e]).conflicts).toEqual([e]);
  });
});

describe("makeEdit", () => {
  it("fills `from` with the current value and trims `to`", () => {
    expect(makeEdit(groups, "look/test.light", "  sodium ", "t1")).toEqual(edit("grey", "sodium", "t1"));
  });

  it("returns null for a no-op, an empty value, an unknown path or a spoiler", () => {
    expect(makeEdit(groups, "look/test.light", "grey", "t1")).toBeNull();
    expect(makeEdit(groups, "look/test.light", "   ", "t1")).toBeNull();
    expect(makeEdit(groups, "look/test.nope", "x", "t1")).toBeNull();
    expect(makeEdit(groups, "prim/director-only-1.text", "x", "t1")).toBeNull();
  });
});

describe("valueHistory", () => {
  it("lists past values oldest first and the current value last", () => {
    const { groups: out } = applyEdits(groups, [edit("grey", "sodium", "t1")]);
    expect(valueHistory(light(out))).toEqual([
      { value: "grey", replacedAt: "t1" },
      { value: "sodium", replacedAt: null },
    ]);
  });
});

describe("exportSeed", () => {
  it("returns a seed that still validates and carries history", () => {
    const seed: Seed = {
      groups,
      shots: [
        {
          id: "s1",
          scene: 1,
          label: "One",
          shotSize: "wide shot",
          action: "A robot stands.",
          actionCitations: [],
          era: "post",
          ratio: "16:9",
          refs: ["look/test"],
          proposedFields: [],
        },
      ],
    };
    const out = exportSeed(seed, [edit("grey", "sodium", "t1")]);
    const r = validate(JSON.parse(JSON.stringify(out)));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.seed.groups[0].values.light.history).toEqual([{ value: "grey", at: "t1" }]);
  });
});

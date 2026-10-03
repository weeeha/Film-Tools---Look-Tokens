import { describe, expect, it } from "vitest";
import { validate } from "./validate";

const look = {
  id: "look/test",
  tier: "semantic",
  values: { light: { current: "grey" } },
  citations: [],
};
const bot = {
  id: "bot/test",
  tier: "entity",
  values: { identity: { current: "A robot." } },
  citations: [],
};
const secret = {
  id: "prim/director-only-1",
  tier: "prim",
  spoiler: true,
  values: { text: { current: "[director-only]", prompt: false } },
  citations: [],
};
const shot = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  scene: 1,
  label: "One",
  shotSize: "wide shot",
  action: "A robot stands.",
  actionCitations: [],
  era: "post",
  ratio: "16:9",
  refs: ["look/test", "bot/test"],
  ...over,
});
const seed = (over: Record<string, unknown> = {}) => ({
  groups: [look, bot, secret],
  shots: [shot()],
  ...over,
});

const errorsOf = (input: unknown) => {
  const r = validate(input);
  return r.ok ? [] : r.errors;
};

describe("validate", () => {
  it("accepts a valid seed and defaults proposedFields", () => {
    const r = validate(seed());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.seed.shots[0].proposedFields).toEqual([]);
  });

  it("reports schema errors with their path", () => {
    expect(errorsOf(seed({ shots: [shot({ ratio: "4:3" })] })).join("\n")).toContain("shots.0.ratio");
  });

  it("rejects a ref that does not exist", () => {
    expect(errorsOf(seed({ shots: [shot({ refs: ["bot/nope"] })] }))).toContain(
      "s1: ref bot/nope does not exist",
    );
  });

  it("rejects a shot that references a primitive", () => {
    const errors = errorsOf(seed({ shots: [shot({ refs: ["bot/test", "prim/director-only-1"] })] }));
    expect(errors.join("\n")).toContain("is a primitive");
  });

  it("rejects two looks on one shot", () => {
    const look2 = { ...look, id: "look/other" };
    const errors = errorsOf(
      seed({ groups: [look, look2, bot], shots: [shot({ refs: ["look/test", "look/other"] })] }),
    );
    expect(errors).toContain("s1: references 2 looks; at most one is allowed");
  });

  it("rejects a namespace on the wrong tier", () => {
    const errors = errorsOf(seed({ groups: [{ ...look, tier: "entity" }, bot] }));
    expect(errors).toContain('look/test: namespace "look" belongs to tier semantic, not entity');
  });

  it("rejects a spoiler outside the prim tier", () => {
    const errors = errorsOf(seed({ groups: [look, { ...bot, spoiler: true }] }));
    expect(errors).toContain("bot/test: only prim groups can be spoilers");
  });

  it("rejects duplicate ids", () => {
    const errors = errorsOf(seed({ groups: [look, bot, bot], shots: [shot(), shot()] }));
    expect(errors).toContain("duplicate group id bot/test");
    expect(errors).toContain("duplicate shot id s1");
  });

  it("lists every violation, not only the first", () => {
    const errors = errorsOf(seed({ shots: [shot({ refs: ["bot/nope", "look/nope"] })] }));
    expect(errors).toHaveLength(2);
  });
});

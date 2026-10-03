import { describe, expect, it } from "vitest";
import { usage } from "./usage";
import { echoAdapter, fixtureGroups, fixtureShot } from "./test-fixtures";

describe("usage", () => {
  const shots = [
    fixtureShot("s1", ["look/test", "bot/test"]),
    fixtureShot("s2", ["look/test", "bot/test", "prop/test"]),
    fixtureShot("s3", ["look/test", "world/test"]),
    fixtureShot("s4", ["look/test", "bot/nope"]),
  ];
  const map = usage(fixtureGroups, shots, echoAdapter);

  it("maps each value path to the shots whose prompt contains it", () => {
    expect(map.get("look/test.light")).toEqual(["s1", "s2", "s3"]);
    expect(map.get("bot/test.identity")).toEqual(["s1", "s2"]);
    expect(map.get("prop/test.identity")).toEqual(["s2"]);
  });

  it("counts a referenced group only where the adapter read it", () => {
    expect(map.get("world/test.use")).toBeUndefined();
  });

  it("never counts documentation-only values", () => {
    expect(map.get("bot/test.behaviour")).toBeUndefined();
  });

  it("skips shots that do not compose", () => {
    expect([...map.values()].flat()).not.toContain("s4");
  });
});

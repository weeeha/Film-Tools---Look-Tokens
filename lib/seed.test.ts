import { describe, expect, it } from "vitest";
import { seed } from "./seed";

describe("seed", () => {
  it("loads 13 token groups and 6 shots", () => {
    expect(seed.groups).toHaveLength(13);
    expect(seed.shots).toHaveLength(6);
  });

  it("puts every Scene 15 shot on look/overgrown-interior", () => {
    for (const shot of seed.shots) expect(shot.refs).toContain("look/overgrown-interior");
  });

  it("keeps spoiler text and spoiler-revealing ids out of the repo", () => {
    const spoilers = seed.groups.filter((g) => g.spoiler);
    expect(spoilers.map((g) => g.id)).toEqual(["prim/director-only-1", "prim/director-only-2"]);
    for (const g of spoilers) {
      for (const v of Object.values(g.values)) {
        expect(v.prompt).toBe(false);
        expect(v.current.startsWith("[director-only")).toBe(true);
      }
    }
  });
});

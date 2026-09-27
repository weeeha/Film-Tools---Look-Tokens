import { describe, expect, it } from "vitest";
import { seed } from "../../seed";
import { resolve } from "../resolve";
import { usage } from "../usage";
import { promptValues, valuePath } from "../types";
import { imageGen } from "./image-gen";

const shotById = (id: string) => {
  const s = seed.shots.find((x) => x.id === id);
  if (!s) throw new Error(`no shot ${id}`);
  return s;
};
const run = (id: string) => {
  const shot = shotById(id);
  const groups = resolve(shot, seed.groups).groups;
  return { shot, groups, out: imageGen.compose(shot, groups) };
};
// Case and a trailing period may change when a value becomes a sentence.
const norm = (s: string) => s.replace(/[.\s]+$/, "").toLowerCase();
const count = (haystack: string, needle: string) => haystack.toLowerCase().split(norm(needle)).length - 1;
// Groups image-gen reads: entities plus the one look. World and voice are Seedance's.
const readable = (id: string) => id.startsWith("look/") || ["bot/", "prop/", "loc/"].some((p) => id.startsWith(p));

describe("image-gen adapter", () => {
  it("targets gen4_image", () => {
    expect(imageGen.target.model).toBe("gen4_image");
  });

  it("opens with the framing, then the action line", () => {
    for (const s of seed.shots) {
      const { out } = run(s.id);
      expect(out.prompt.toLowerCase().startsWith(norm(s.shotSize))).toBe(true);
      expect(out.prompt).toContain(s.action);
      expect(out.prompt.indexOf(s.action)).toBeLessThan(out.prompt.length / 3);
    }
  });

  it("includes every prompt value of the referenced entities and the look exactly once", () => {
    for (const s of seed.shots) {
      const { out, groups } = run(s.id);
      for (const g of groups.filter((x) => readable(x.id))) {
        for (const [key, v] of promptValues(g)) {
          expect(count(out.prompt, v.current), `${s.id}: ${g.id}.${key}`).toBe(1);
        }
      }
    }
  });

  it("leaves out documentation-only values and spoilers", () => {
    for (const s of seed.shots) {
      const { out, groups } = run(s.id);
      for (const g of groups) {
        for (const v of Object.values(g.values).filter((x) => x.prompt === false)) {
          expect(count(out.prompt, v.current), `${s.id}: ${g.id}`).toBe(0);
        }
      }
      expect(out.prompt).not.toContain("director-only");
    }
  });

  it("reports exactly the value paths it used", () => {
    for (const s of seed.shots) {
      const { out, groups } = run(s.id);
      const expected = groups
        .filter((g) => readable(g.id))
        .flatMap((g) => promptValues(g).map(([key]) => valuePath(g.id, key)));
      expect([...out.reads].sort()).toEqual([...expected].sort());
    }
  });

  // If you pick a different order in the [HAND] task, rewrite this string to match it.
  it("composes s15-pour-medium exactly", () => {
    expect(run("s15-pour-medium").out.prompt).toBe(
      "Medium shot. The robot leans over the diner's cup and tilts the carafe. Nothing comes out. " +
        "A simple general-purpose service robot in an abandoned restaurant, still working its shift. " +
        "The diners at the set tables are dead. " +
        "Slim humanoid service unit, worn cream-white chassis, a serving tray arm, smooth precise movement. " +
        "A broken, empty carafe. " +
        "Set tables with dead diners. " +
        "Soft overcast daylight through overgrown windows, in green-tinted shafts, dust hangs in the still air, " +
        "muted desaturated palette, cool greens against warm dust, modern digital cinema, " +
        "35mm lens, shallow depth of field. " +
        "Signifiers: a cover on its back that opens to its batteries; the pour that delivers nothing; " +
        "set tables, dead diners, live robot.",
    );
  });

  it("gives the USED BY counts in spec section 4", () => {
    const map = usage(seed.groups, seed.shots, imageGen);
    const n = (path: string) => (map.get(path) ?? []).length;
    for (const key of ["light", "air", "palette", "capture", "lens"]) {
      expect(n(`look/overgrown-interior.${key}`)).toBe(6);
    }
    expect(n("bot/restaurant.identity")).toBe(6);
    expect(n("loc/restaurant.interior")).toBe(5);
    expect(n("prop/carafe.identity")).toBe(3);
    expect(n("prop/cable.identity")).toBe(1);
    expect(n("world/most-people-died.use")).toBe(0);
    expect(n("voice/restaurant-robot.register")).toBe(0);
  });
});

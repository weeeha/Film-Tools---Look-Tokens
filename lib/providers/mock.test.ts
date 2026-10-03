import { describe, expect, it } from "vitest";
import { hueFor, mockSvg } from "./mock";

const seedLook =
  "soft overcast daylight through overgrown windows, in green-tinted shafts, dust hangs in the still air, " +
  "muted desaturated palette, cool greens against warm dust, modern digital cinema, 35mm lens, shallow depth of field";
const demoLook = seedLook.replace(
  "soft overcast daylight through overgrown windows, in green-tinted shafts",
  "sodium streetlight through the windows at dusk",
);
const input = { label: "The pour, medium", shotSize: "medium shot", lookText: seedLook, key: "abcdef0123456789" };
const decode = (url: string) => decodeURIComponent(url.slice(url.indexOf(",") + 1));

describe("hueFor", () => {
  it("reads the seed look as green and the demo edit as amber", () => {
    expect(hueFor(seedLook)).toBe(140);
    expect(hueFor(demoLook)).toBe(32);
  });

  it("falls back to a stable hash hue", () => {
    expect(hueFor("plain")).toBe(hueFor("plain"));
    expect(hueFor("plain")).toBeGreaterThanOrEqual(0);
    expect(hueFor("plain")).toBeLessThan(360);
  });
});

describe("mockSvg", () => {
  it("is a deterministic SVG data URL with a STUB badge", () => {
    const url = mockSvg(input);
    expect(url.startsWith("data:image/svg+xml")).toBe(true);
    expect(url).toBe(mockSvg(input));
    const svg = decode(url);
    expect(svg).toContain("STUB");
    expect(svg).toContain("The pour, medium");
    expect(svg).toContain("abcdef01");
  });

  it("changes when the look changes", () => {
    expect(mockSvg({ ...input, lookText: demoLook })).not.toBe(mockSvg(input));
  });

  it("escapes text", () => {
    const svg = decode(mockSvg({ ...input, label: "A & <B>" }));
    expect(svg).toContain("A &amp; &lt;B&gt;");
  });
});

// Shared fixtures for engine tests. Not imported by app code.
import type { Adapter } from "./adapters/types";
import { promptValues, type Shot, type TokenGroup } from "./types";

export const fixtureGroups: TokenGroup[] = [
  { id: "look/test", tier: "semantic", citations: [], values: { light: { current: "grey light" } } },
  {
    id: "bot/test",
    tier: "entity",
    citations: [],
    values: {
      identity: { current: "A robot." },
      behaviour: { current: "It falls over.", prompt: false },
    },
  },
  { id: "prop/test", tier: "entity", citations: [], values: { identity: { current: "A cup." } } },
  { id: "world/test", tier: "semantic", citations: [], values: { use: { current: "Empty streets." } } },
  {
    id: "prim/director-only-1",
    tier: "prim",
    spoiler: true,
    citations: [],
    values: { text: { current: "[director-only]", prompt: false } },
  },
];

export const fixtureShot = (id: string, refs: string[]): Shot => ({
  id,
  scene: 1,
  label: id,
  shotSize: "wide shot",
  action: `Action of ${id}.`,
  actionCitations: [],
  era: "post",
  ratio: "16:9",
  refs,
  proposedFields: [],
});

// Puts every prompt-eligible value of every non-world group into the prompt.
export const echoAdapter: Adapter = {
  id: "image-gen",
  target: { model: "test-model" },
  compose(shot, groups) {
    const used = groups.filter((g) => !g.id.startsWith("world/"));
    const reads = used.flatMap((g) => promptValues(g).map(([k]) => `${g.id}.${k}`));
    const prompt = [shot.action, ...used.flatMap((g) => promptValues(g).map(([, v]) => v.current))].join(" ");
    return { prompt, reads };
  },
};

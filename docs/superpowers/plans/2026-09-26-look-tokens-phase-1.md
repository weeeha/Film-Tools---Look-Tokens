# Look Tokens Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship phase 1 of Look Tokens: a token table, six Scene 15 shots, and the edit → "Apply to 6 shots" → before/after → rollback loop, running on a mock renderer with zero environment variables, deployed as an unlisted Vercel preview.

**Architecture:** One Next.js App Router page. All token logic lives in `lib/engine/`, pure TypeScript that an ESLint rule keeps free of React, Next and I/O. `lib/session.ts` holds per-viewer state as pure functions, `lib/providers/mock.ts` draws the stub frames, `lib/store/browser-store.ts` persists to IndexedDB with a memory fallback, and `components/` is the UI. State is `applyEdits(seed, log)`; staleness is derived from a render map keyed by `renderKey`.

**Tech Stack:** Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript 5.9, Tailwind CSS 4, Zod 4.6, Vitest 5.0, @noble/hashes 2.4, idb-keyval 6.3, pnpm 11, Node 26 locally.

**Spec:** `docs/superpowers/specs/2026-09-26-look-tokens-design.md` (approved 2026-09-26). Read it before starting.

**Verified:** every file in this plan was built and run once in a throwaway spike on 2026-09-26: 59 tests pass, `tsc`, `eslint` and `next build` are clean, and the demo script (first load, edit, Apply to 6, before/after, rollback with no render, persistence across reload) ran in Chromium with no console errors. Safari was not checked in the spike; Task 15 covers it.

## Global Constraints

- Repo `weeeha/Film-Tools---Look-Tokens`, local path `/Users/nickv/ClaudeCode Projects/Film Tool - Look Tokens`. Work on branch `feat/phase-1`. Never commit to or push `main`.
- `lib/engine/` imports only `zod`, `@noble/hashes` and other `lib/engine/` files. Enforced by ESLint from Task 1.
- The repo is public. No spoiler text and no spoiler-revealing ids, ever. Spoiler primitives are `prim/director-only-1` and `prim/director-only-2` with redacted values.
- Phase 1 runs end to end with no environment variables. Every render is a mock with a visible STUB badge.
- Model names live only in adapter files (`gen4_image` appears only in `lib/engine/adapters/image-gen.ts`).
- UI copy and docs prose: no exclamation marks, no em dashes.
- Run `me:unslop` before building UI (Task 11) and before calling it done (Task 14).
- Done means verified on the deployed preview in Chrome and Safari, not a green build.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, except Nick's own [HAND] commit.

## Deviations from the spec

Each was needed to make the spec work in code. None changes a decision Nick made.

1. **`renderKey` is synchronous** (`@noble/hashes` SHA-256 instead of Web Crypto). Same hash, same inputs; removes async from the engine and the React state flow.
2. **`Shot.proposedFields`** lists which shot fields are `[PROPOSED]` (spec section 4 tags them in prose; the interface had no field for it).
3. **image-gen prompts lead with the shot size**, then the action line. A still needs its framing; the spec's "action line first" meant action before tokens. Nick can reverse this in the [HAND] task by editing one test.
4. **`loc/restaurant` keeps its third sentence** as a doc-only `occupant` value, so the paragraph stays verbatim.
5. **The session also stores `shown`, `appliedThrough` and `lastApply`** next to the edit log and render map (spec section 7 lists only the first two). They drive stale display, the pending-edit panel and the before/after rows.

## File map

```
app/layout.tsx, app/page.tsx, app/globals.css      Next shell (Task 1, 12)
data/seed/tokens.json, data/seed/shots.json         seed (Task 3)
lib/engine/types.ts                                 Zod schemas, types, path helpers (Task 2)
lib/engine/validate.ts                              seed rules (Task 2)
lib/engine/edits.ts                                 applyEdits, makeEdit, valueHistory, exportSeed (Task 4)
lib/engine/adapters/types.ts                        Adapter interface (Task 5)
lib/engine/resolve.ts, compose.ts, key.ts           refs → prompt → renderKey (Task 5)
lib/engine/test-fixtures.ts                         shared test fixtures (Task 5)
lib/engine/usage.ts                                 USED BY (Task 6)
lib/engine/adapters/image-gen.ts                    [HAND] (Task 10)
lib/seed.ts                                         loads + validates the seed (Task 3)
lib/session.ts                                      per-viewer state, pure (Task 7)
lib/providers/mock.ts                               STUB SVG renderer (Task 8)
lib/store/browser-store.ts                          IndexedDB with memory fallback (Task 9)
components/useLookTokens.ts                         the one state hook (Task 12)
components/TokenTable.tsx, HistoryDrawer.tsx        token side (Task 12)
components/Toolbar.tsx                              reset, export, notices (Task 12)
components/ShotCard.tsx, EditPanel.tsx, BeforeAfter.tsx   shot side (Task 13)
components/LookTokensApp.tsx                        page layout (Task 12, completed in 13)
docs/ui-constraints.md                              unslop output (Task 11)
```

---

### Task 1: Scaffold and tooling

**Files:**
- Delete: `README.md` (26 bytes; `create-next-app` refuses a folder that contains one)
- Create: Next.js scaffold (`app/`, `public/`, `package.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `pnpm-workspace.yaml`)
- Create: `vitest.config.mts`, `.claude/launch.json`, `README.md`
- Modify: `package.json` (scripts), `eslint.config.mjs` (engine boundary)

**Interfaces:**
- Produces: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm dev`; the `@/*` import alias; a launch config named `look-tokens` on port 3107.

- [ ] **Step 1: Branch from the spec branch**

```bash
cd "/Users/nickv/ClaudeCode Projects/Film Tool - Look Tokens"
git checkout docs/look-tokens-spec
git checkout -b feat/phase-1
```

- [ ] **Step 2: Scaffold into the repo**

```bash
git rm -q README.md
npx -y create-next-app@latest . --ts --tailwind --eslint --app --import-alias "@/*" --use-pnpm --yes --disable-git
pnpm add zod @noble/hashes idb-keyval
pnpm add -D vitest
```

Expected: `Success! Created ...`, then `+ zod 4.x`, `+ @noble/hashes 2.x`, `+ idb-keyval 6.x`, `+ vitest 5.x`. `docs/` is left untouched.

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.mts` (the `.mts` extension avoids Vite's CommonJS config warning):

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    passWithNoTests: true,
  },
});
```

- [ ] **Step 4: Add scripts**

In `package.json`, replace `"lint": "eslint"` with:

```json
    "lint": "eslint",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
```

- [ ] **Step 5: Add the engine boundary rule**

Replace `eslint.config.mjs` with:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["lib/engine/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["react", "react/*", "react-dom", "react-dom/*", "next", "next/*", "fs", "fs/*", "node:*", "idb-keyval", "@/*", "**/providers/**", "**/store/**", "**/components/**", "**/app/**", "**/session"],
          message: "lib/engine is pure: it may import only zod, @noble/hashes and other lib/engine files.",
        }],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
```

- [ ] **Step 6: Prove the boundary rule fires, then remove the probe**

```bash
mkdir -p lib/engine
printf 'import { useState } from "react";\nexport const probe = useState;\n' > lib/engine/boundary-probe.ts
pnpm lint
```

Expected: FAIL with `'react' import is restricted from being used by a pattern. lib/engine is pure: ...`

```bash
rm lib/engine/boundary-probe.ts
pnpm lint
```

Expected: no output, exit 0.

- [ ] **Step 7: Add the launch config**

Create `.claude/launch.json`:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "look-tokens",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["dev", "--port", "3107"],
      "port": 3107
    }
  ]
}
```

- [ ] **Step 8: Write the README**

Create `README.md`:

````markdown
# Look Tokens

Cinematography as a design token system. A film's look lives in one table of tokens. Shots reference tokens instead of repeating adjectives, and each shot's prompt is composed at render time by a per-tool adapter. Edit one value and every shot that uses it re-renders, with the old value kept for rollback.

Demo content is Scene 15 of Post-Collapse Montreal, transcribed from the film's token file. Values tagged `proposed` have no citation in the source recordings.

## Run

```bash
pnpm install
pnpm dev
```

Tests: `pnpm test` · Types: `pnpm typecheck` · Lint: `pnpm lint`

Phase 1 needs no environment variables. Every render is a labeled mock (STUB).

## Design

- Spec: `docs/superpowers/specs/2026-09-26-look-tokens-design.md`
- Plan: `docs/superpowers/plans/2026-09-26-look-tokens-phase-1.md`
- `lib/engine/` is pure TypeScript with no React, Next or I/O imports. ESLint enforces it.
````

- [ ] **Step 9: Verify the scaffold**

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
```

Expected: Vitest finds no test files and exits 0; `tsc` and `eslint` print nothing; `next build` ends with `○ /` listed as Static.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js app with Vitest, Zod and the engine boundary rule

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Token model and validation

**Files:**
- Create: `lib/engine/types.ts`, `lib/engine/validate.ts`
- Test: `lib/engine/validate.test.ts`

**Interfaces:**
- Produces (`types.ts`): `TIERS`, `Tier`, `NAMESPACE_TIER`, `TokenValueSchema`, `TokenGroupSchema`, `ShotSchema`, `SeedSchema`, `EditSchema`; types `TokenValue`, `TokenGroup`, `Shot`, `Seed`, `Edit`; helpers `namespaceOf(id): string`, `valuePath(groupId, key): string`, `parsePath(path): { groupId, key } | null`, `promptValues(group): [string, TokenValue][]` (prompt-eligible values in key order; empty for spoilers).
- Produces (`validate.ts`): `validate(input: unknown): { ok: true; seed: Seed } | { ok: false; errors: string[] }`.

- [ ] **Step 1: Write the failing test**

Create `lib/engine/validate.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run lib/engine/validate.test.ts`
Expected: FAIL, `Failed to resolve import "./validate"`.

- [ ] **Step 3: Write the types**

Create `lib/engine/types.ts`:

```ts
import { z } from "zod";

export const TIERS = ["prim", "semantic", "entity"] as const;
export type Tier = (typeof TIERS)[number];

// Which tier each namespace belongs to. Mirrors film-tokens.md.
export const NAMESPACE_TIER: Record<string, Tier> = {
  prim: "prim",
  world: "semantic",
  look: "semantic",
  audio: "semantic",
  voice: "semantic",
  move: "semantic",
  bot: "entity",
  prop: "entity",
  loc: "entity",
};

const HistoryEntrySchema = z.object({
  value: z.string(),
  at: z.string(), // when this value was replaced
});

export const TokenValueSchema = z.object({
  current: z.string().min(1),
  prompt: z.literal(false).optional(), // documentation only, never composed
  proposed: z.literal(true).optional(), // no citation in the source docs
  citations: z.array(z.string()).optional(),
  history: z.array(HistoryEntrySchema).optional(), // oldest first
});

export const TokenGroupSchema = z.object({
  id: z.string().regex(/^[a-z]+\/[a-z0-9-]+$/),
  tier: z.enum(TIERS),
  values: z.record(z.string(), TokenValueSchema), // key order is compose order
  citations: z.array(z.string()),
  proposed: z.literal(true).optional(),
  spoiler: z.literal(true).optional(),
});

export const ShotSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  scene: z.number().int().positive(),
  label: z.string().min(1),
  shotSize: z.string().min(1),
  action: z.string().min(1),
  actionCitations: z.array(z.string()),
  era: z.enum(["pre", "post"]),
  ratio: z.literal("16:9"),
  refs: z.array(z.string()).min(1),
  proposedFields: z
    .array(z.enum(["shotSize", "action", "ratio", "refs"]))
    .default([]),
});

export const SeedSchema = z.object({
  groups: z.array(TokenGroupSchema),
  shots: z.array(ShotSchema),
});

export const EditSchema = z.object({
  path: z.string(),
  from: z.string(),
  to: z.string(),
  at: z.string(),
});

export type TokenValue = z.infer<typeof TokenValueSchema>;
export type TokenGroup = z.infer<typeof TokenGroupSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type Seed = z.infer<typeof SeedSchema>;
export type Edit = z.infer<typeof EditSchema>;

export function namespaceOf(id: string): string {
  return id.split("/")[0];
}

export function valuePath(groupId: string, key: string): string {
  return `${groupId}.${key}`;
}

// Group ids never contain a dot, so the first dot splits group from key.
export function parsePath(path: string): { groupId: string; key: string } | null {
  const dot = path.indexOf(".");
  if (dot <= 0 || dot === path.length - 1) return null;
  return { groupId: path.slice(0, dot), key: path.slice(dot + 1) };
}

// Values an adapter is allowed to put into a prompt.
export function promptValues(group: TokenGroup): [string, TokenValue][] {
  if (group.spoiler) return [];
  return Object.entries(group.values).filter(([, v]) => v.prompt !== false);
}
```

- [ ] **Step 4: Write validate**

Create `lib/engine/validate.ts`:

```ts
import { NAMESPACE_TIER, SeedSchema, namespaceOf, type Seed } from "./types";

export type ValidationResult =
  | { ok: true; seed: Seed }
  | { ok: false; errors: string[] };

// Parses and checks a seed. Returns every violation, never only the first.
export function validate(input: unknown): ValidationResult {
  const parsed = SeedSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    };
  }

  const seed = parsed.data;
  const errors: string[] = [];

  const groupIds = new Set<string>();
  for (const g of seed.groups) {
    if (groupIds.has(g.id)) errors.push(`duplicate group id ${g.id}`);
    groupIds.add(g.id);

    const ns = namespaceOf(g.id);
    const tier = NAMESPACE_TIER[ns];
    if (!tier) errors.push(`${g.id}: unknown namespace "${ns}"`);
    else if (tier !== g.tier) {
      errors.push(`${g.id}: namespace "${ns}" belongs to tier ${tier}, not ${g.tier}`);
    }
    if (g.spoiler && g.tier !== "prim") errors.push(`${g.id}: only prim groups can be spoilers`);
    if (Object.keys(g.values).length === 0) errors.push(`${g.id}: has no values`);
  }

  const shotIds = new Set<string>();
  for (const s of seed.shots) {
    if (shotIds.has(s.id)) errors.push(`duplicate shot id ${s.id}`);
    shotIds.add(s.id);

    for (const ref of s.refs) {
      if (!groupIds.has(ref)) errors.push(`${s.id}: ref ${ref} does not exist`);
      if (namespaceOf(ref) === "prim") {
        errors.push(`${s.id}: ref ${ref} is a primitive; shots may reference only semantic and entity tokens`);
      }
    }
    const looks = s.refs.filter((r) => namespaceOf(r) === "look");
    if (looks.length > 1) {
      errors.push(`${s.id}: references ${looks.length} looks; at most one is allowed`);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, seed };
}
```

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm vitest run lib/engine/validate.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/engine
git commit -m "Add token model schemas and seed validation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Seed data

Transcribed from `My Films/film-tokens.md` and spec section 4. The spec review approved the six shots and `look/overgrown-interior` as written.

**Files:**
- Create: `data/seed/tokens.json`, `data/seed/shots.json`, `lib/seed.ts`
- Test: `lib/seed.test.ts`

**Interfaces:**
- Consumes: `validate`, `Seed` (Task 2).
- Produces: `seed: Seed` from `lib/seed.ts`. It throws at import time on an invalid seed, which fails `next build` and every test.

- [ ] **Step 1: Write the failing test**

Create `lib/seed.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run lib/seed.test.ts`
Expected: FAIL, `Failed to resolve import "./seed"`.

- [ ] **Step 3: Write the token groups**

Create `data/seed/tokens.json`:

```json
[
  {
    "id": "look/overgrown-interior",
    "tier": "semantic",
    "proposed": true,
    "citations": [],
    "values": {
      "light": { "current": "soft overcast daylight through overgrown windows, in green-tinted shafts", "proposed": true },
      "air": { "current": "dust hangs in the still air", "proposed": true },
      "palette": { "current": "muted desaturated palette, cool greens against warm dust", "proposed": true },
      "capture": { "current": "modern digital cinema", "proposed": true },
      "lens": { "current": "35mm lens, shallow depth of field", "proposed": true }
    }
  },
  {
    "id": "look/rain-reveal",
    "tier": "semantic",
    "proposed": true,
    "citations": ["[J27 14:29]", "[A11 16:29]"],
    "values": {
      "light": { "current": "soft grey overcast light" },
      "weather": { "current": "active rain" },
      "surface": { "current": "wet reflective surfaces" },
      "colour": { "current": "muted colour" },
      "use": { "current": "For the rooftop wake and slow world reveals.", "prompt": false }
    }
  },
  {
    "id": "look/pre-collapse-clean",
    "tier": "semantic",
    "proposed": true,
    "citations": ["[J27 12:37]", "[J27 05:35]", "[A01 12:26]"],
    "values": {
      "grade": { "current": "bright, ordinary, functional present-day-plus grade" },
      "use": {
        "current": "For era/pre flashbacks: offices, phones, cameras and colourful outfits in the street, the coffee maker morning. Its ordinariness is the contrast engine against era/post.",
        "prompt": false
      }
    }
  },
  {
    "id": "world/overgrown-not-destroyed",
    "tier": "semantic",
    "citations": ["[J27 02:00]"],
    "values": {
      "use": { "current": "Every exterior. Vegetation reclaims intact structures. Nature won by growth, not by fire." },
      "antiUse": {
        "current": "Rubble fields, bomb craters, burned-out blocks. Reason: the collapse was systemic and biological, not military. The city was abandoned, not attacked.",
        "prompt": false
      }
    }
  },
  {
    "id": "world/degraded-lesser-ai",
    "tier": "semantic",
    "citations": ["[J27 00:59]"],
    "values": {
      "use": {
        "current": "Machines run leftover routines at different levels of degradation. Behaviour is loyal to a dead purpose (the restaurant robot still serving).",
        "citations": ["[J27 29:41]"]
      },
      "antiUse": {
        "current": "Coordinated robot armies, a hidden mastermind, networked swarm behaviour. Reason: nothing of the sentient AI remains. What is left lost its controls, it did not gain a leader.",
        "prompt": false,
        "citations": ["[J27 00:00]"]
      }
    }
  },
  {
    "id": "world/most-people-died",
    "tier": "semantic",
    "citations": ["[J27 02:29]"],
    "values": {
      "use": {
        "current": "Empty streets, no crowds, single figures. Bodies concentrate where animals live, the park of skeletons. Dead diners still at set tables.",
        "citations": ["[J27 22:31]", "[J27 30:25]"]
      },
      "antiUse": {
        "current": "Background pedestrians, traffic, lit occupied windows as default. Reason: survivors are rare and localised (a guest house is lived in).",
        "prompt": false,
        "citations": ["[A11 36:37]"]
      }
    }
  },
  {
    "id": "voice/restaurant-robot",
    "tier": "semantic",
    "citations": ["[J27 29:41]", "[A01 08:16]", "[A01 09:13]"],
    "values": {
      "register": { "current": "French, service-polite, unaware anything is wrong, still working its shift for dead customers" },
      "colour": { "current": "warm and unhurried", "proposed": true },
      "lines": {
        "current": "\"Okay sir, come in, welcome. Mon ami.\" \"Would you like some more water?\" (to a dead diner)",
        "prompt": false
      }
    }
  },
  {
    "id": "bot/restaurant",
    "tier": "entity",
    "citations": [
      "[J27 29:41]", "[J27 30:25]", "[J27 30:53]", "[J27 31:24]", "[A01 08:16]",
      "[A01 09:13]", "[A01 10:13]", "[A11 02:40]", "[A11 31:33]"
    ],
    "values": {
      "identity": { "current": "A simple general-purpose service robot in an abandoned restaurant, still working its shift." },
      "context": { "current": "The diners at the set tables are dead." },
      "design": {
        "current": "slim humanoid service unit, worn cream-white chassis, a serving tray arm, smooth precise movement",
        "proposed": true
      },
      "behaviour": {
        "current": "It welcomes guests in French, polite and warm, and pours from a broken empty carafe into cups; nothing comes out. When tripped by a cable it falls, tries to get up, and tries to hold its batteries in.",
        "prompt": false
      },
      "signifier": { "current": "a cover on its back that opens to its batteries" }
    }
  },
  {
    "id": "loc/restaurant",
    "tier": "entity",
    "citations": ["[J27 29:41]", "[J27 30:25]", "[A01 08:16]", "[A11 02:40]"],
    "values": {
      "exterior": { "current": "A restaurant on the street with movement visible inside.", "prompt": false },
      "occupant": { "current": "A service robot still working its shift.", "prompt": false },
      "interior": { "current": "Set tables with dead diners." },
      "signifier": { "current": "set tables, dead diners, live robot" }
    }
  },
  {
    "id": "prop/carafe",
    "tier": "entity",
    "citations": ["[J27 30:53]", "[A01 09:13]"],
    "values": {
      "identity": { "current": "A broken, empty carafe." },
      "behaviour": { "current": "The restaurant robot pours from it into cups and nothing comes out.", "prompt": false },
      "signifier": { "current": "the pour that delivers nothing" }
    }
  },
  {
    "id": "prop/cable",
    "tier": "entity",
    "citations": ["[A01 10:13]"],
    "values": {
      "identity": { "current": "A cable, thrown to trip the restaurant robot." }
    }
  },
  {
    "id": "prim/director-only-1",
    "tier": "prim",
    "spoiler": true,
    "citations": [],
    "values": {
      "text": { "current": "[director-only, kept in My Films]", "prompt": false }
    }
  },
  {
    "id": "prim/director-only-2",
    "tier": "prim",
    "spoiler": true,
    "citations": [],
    "values": {
      "text": { "current": "[director-only, kept in My Films]", "prompt": false }
    }
  }
]
```

- [ ] **Step 4: Write the shots**

Create `data/seed/shots.json`:

```json
[
  {
    "id": "s15-welcome",
    "scene": 15,
    "label": "The welcome",
    "shotSize": "medium shot, eye level from the doorway",
    "action": "The service robot turns to the doorway and welcomes a guest who stays out of frame.",
    "actionCitations": ["[J27 29:41]", "[A01 08:16]"],
    "era": "post",
    "ratio": "16:9",
    "refs": ["look/overgrown-interior", "bot/restaurant", "loc/restaurant"],
    "proposedFields": ["shotSize", "ratio", "refs"]
  },
  {
    "id": "s15-room",
    "scene": 15,
    "label": "The room",
    "shotSize": "wide establishing shot",
    "action": "The service robot works between set tables of dead diners.",
    "actionCitations": ["[J27 30:25]"],
    "era": "post",
    "ratio": "16:9",
    "refs": ["look/overgrown-interior", "loc/restaurant", "bot/restaurant"],
    "proposedFields": ["shotSize", "ratio", "refs"]
  },
  {
    "id": "s15-pour-wide",
    "scene": 15,
    "label": "The pour, wide",
    "shotSize": "wide shot",
    "action": "The service robot lifts the broken carafe from its tray and walks toward a seated dead diner.",
    "actionCitations": ["[A01 09:13]"],
    "era": "post",
    "ratio": "16:9",
    "refs": ["look/overgrown-interior", "bot/restaurant", "prop/carafe", "loc/restaurant"],
    "proposedFields": ["ratio", "refs"]
  },
  {
    "id": "s15-pour-medium",
    "scene": 15,
    "label": "The pour, medium",
    "shotSize": "medium shot",
    "action": "The robot leans over the diner's cup and tilts the carafe. Nothing comes out.",
    "actionCitations": ["[J27 30:53]", "[A01 09:13]"],
    "era": "post",
    "ratio": "16:9",
    "refs": ["look/overgrown-interior", "bot/restaurant", "prop/carafe", "loc/restaurant"],
    "proposedFields": ["ratio", "refs"]
  },
  {
    "id": "s15-pour-close",
    "scene": 15,
    "label": "The pour, close",
    "shotSize": "close-up on the carafe's mouth above the empty cup",
    "action": "The carafe tilts over an empty cup. Nothing comes out.",
    "actionCitations": ["[J27 30:53]"],
    "era": "post",
    "ratio": "16:9",
    "refs": ["look/overgrown-interior", "prop/carafe", "bot/restaurant"],
    "proposedFields": ["ratio", "refs"]
  },
  {
    "id": "s15-trip",
    "scene": 15,
    "label": "The trip",
    "shotSize": "wide shot, low angle",
    "action": "The service robot lies fallen beside a cable on the floor, trying to get up.",
    "actionCitations": ["[A01 10:13]"],
    "era": "post",
    "ratio": "16:9",
    "refs": ["look/overgrown-interior", "bot/restaurant", "prop/cable", "loc/restaurant"],
    "proposedFields": ["shotSize", "ratio", "refs"]
  }
]
```

- [ ] **Step 5: Write the loader**

Create `lib/seed.ts`:

```ts
import groups from "../data/seed/tokens.json";
import shots from "../data/seed/shots.json";
import { validate } from "./engine/validate";
import type { Seed } from "./engine/types";

// Runs at import time, so an invalid seed fails `next build` and every test.
function loadSeed(): Seed {
  const result = validate({ groups, shots });
  if (!result.ok) throw new Error(`Invalid seed:\n${result.errors.join("\n")}`);
  return result.seed;
}

export const seed: Seed = loadSeed();
```

- [ ] **Step 6: Run the test to see it pass**

Run: `pnpm vitest run lib/seed.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 7: Commit**

```bash
git add data lib/seed.ts lib/seed.test.ts
git commit -m "Add Scene 15 seed transcribed from film-tokens.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Edit log

**Files:**
- Create: `lib/engine/edits.ts`
- Test: `lib/engine/edits.test.ts`

**Interfaces:**
- Consumes: `parsePath`, `Edit`, `Seed`, `TokenGroup`, `TokenValue` (Task 2).
- Produces: `applyEdits(groups, edits): { groups: TokenGroup[]; conflicts: Edit[] }` (pure; records replaced values in `value.history`); `makeEdit(groups, path, to, at): Edit | null`; `valueHistory(value): { value: string; replacedAt: string | null }[]` (oldest first, current last with `replacedAt: null`); `exportSeed(seed, edits): Seed`.

- [ ] **Step 1: Write the failing test**

Create `lib/engine/edits.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run lib/engine/edits.test.ts`
Expected: FAIL, `Failed to resolve import "./edits"`.

- [ ] **Step 3: Write the implementation**

Create `lib/engine/edits.ts`:

```ts
import { parsePath, type Edit, type Seed, type TokenGroup, type TokenValue } from "./types";

export interface ApplyResult {
  groups: TokenGroup[];
  conflicts: Edit[]; // edits whose path is gone or whose `from` no longer matches
}

// State is a pure fold of the edit log over the seed. History is recorded
// on each value as it is replaced, so rollback is just another edit.
export function applyEdits(groups: TokenGroup[], edits: Edit[]): ApplyResult {
  const next: TokenGroup[] = structuredClone(groups);
  const byId = new Map(next.map((g) => [g.id, g]));
  const conflicts: Edit[] = [];

  for (const edit of edits) {
    const parsed = parsePath(edit.path);
    const group = parsed ? byId.get(parsed.groupId) : undefined;
    const value = parsed && group ? group.values[parsed.key] : undefined;
    if (!group || !value || group.spoiler || value.current !== edit.from) {
      conflicts.push(edit);
      continue;
    }
    value.history = [...(value.history ?? []), { value: value.current, at: edit.at }];
    value.current = edit.to;
  }

  return { groups: next, conflicts };
}

// Builds the edit the UI should append, or null when there is nothing to do.
export function makeEdit(groups: TokenGroup[], path: string, to: string, at: string): Edit | null {
  const parsed = parsePath(path);
  const group = parsed ? groups.find((g) => g.id === parsed.groupId) : undefined;
  const value = parsed && group ? group.values[parsed.key] : undefined;
  const next = to.trim();
  if (!group || !value || group.spoiler || next === "" || next === value.current) return null;
  return { path, from: value.current, to: next, at };
}

export interface HistoryItem {
  value: string;
  replacedAt: string | null; // null for the current value
}

// Oldest first, current value last.
export function valueHistory(value: TokenValue): HistoryItem[] {
  return [
    ...(value.history ?? []).map((h) => ({ value: h.value, replacedAt: h.at })),
    { value: value.current, replacedAt: null },
  ];
}

// The seed with edits applied and history kept, ready to commit as the new seed.
export function exportSeed(seed: Seed, edits: Edit[]): Seed {
  return { groups: applyEdits(seed.groups, edits).groups, shots: seed.shots };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm vitest run lib/engine/edits.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/engine/edits.ts lib/engine/edits.test.ts
git commit -m "Add edit log with history, conflicts and export

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Resolve, compose and render key

**Files:**
- Create: `lib/engine/adapters/types.ts`, `lib/engine/resolve.ts`, `lib/engine/compose.ts`, `lib/engine/key.ts`, `lib/engine/test-fixtures.ts`
- Test: `lib/engine/compose.test.ts`

**Interfaces:**
- Consumes: `parsePath`, `promptValues`, `Shot`, `TokenGroup` (Task 2).
- Produces:
  - `Adapter { id: "image-gen" | "seedance"; target: { model: string }; compose(shot, groups): { prompt: string; reads: string[] } }` and `AdapterOutput`.
  - `resolve(shot, groups): { groups: TokenGroup[]; unresolved: string[] }`. Prim refs count as unresolved.
  - `compose(shot, groups, adapter): Composition`, where `Composition = { ok: true; prompt: string; reads: string[] } | { ok: false; unresolved: string[] }`. Throws if an adapter reads a doc-only value, a spoiler, or an unreferenced group.
  - `renderKey({ model, ratio, seed, prompt }): string` (64-char SHA-256 hex); `shotSeed(shotId): number` (unsigned 32-bit FNV-1a).
  - Test-only: `fixtureGroups`, `fixtureShot(id, refs)`, `echoAdapter`.

- [ ] **Step 1: Write the fixtures and the failing test**

Create `lib/engine/test-fixtures.ts`:

```ts
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
```

Create `lib/engine/adapters/types.ts` (the fixtures import it):

```ts
import type { Shot, TokenGroup } from "../types";

export interface AdapterOutput {
  prompt: string;
  reads: string[]; // every value path placed in the prompt, e.g. "look/overgrown-interior.light"
}

export interface Adapter {
  id: "image-gen" | "seedance";
  target: { model: string }; // model names live only in adapter files
  // `groups` are the shot's resolved refs, in ref order. Never prim groups.
  compose(shot: Shot, groups: TokenGroup[]): AdapterOutput;
}
```

Create `lib/engine/compose.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run lib/engine/compose.test.ts`
Expected: FAIL, `Failed to resolve import "./compose"`.

- [ ] **Step 3: Write resolve**

Create `lib/engine/resolve.ts`:

```ts
import type { Shot, TokenGroup } from "./types";

export interface Resolved {
  groups: TokenGroup[]; // in ref order
  unresolved: string[];
}

// Prim refs count as unresolved even though validate() already rejects them,
// so a spoiler can never reach an adapter through a skipped validation.
export function resolve(shot: Shot, groups: TokenGroup[]): Resolved {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const found: TokenGroup[] = [];
  const unresolved: string[] = [];
  for (const ref of shot.refs) {
    const g = byId.get(ref);
    if (!g || g.tier === "prim") unresolved.push(ref);
    else found.push(g);
  }
  return { groups: found, unresolved };
}
```

- [ ] **Step 4: Write compose**

Create `lib/engine/compose.ts`:

```ts
import { resolve } from "./resolve";
import { parsePath, type Shot, type TokenGroup } from "./types";
import type { Adapter } from "./adapters/types";

export type Composition =
  | { ok: true; prompt: string; reads: string[] }
  | { ok: false; unresolved: string[] };

// Resolves refs, runs the adapter, and checks the adapter kept the rules.
// An unresolved ref stops composition: a quietly dropped token is the drift
// this tool exists to prevent.
export function compose(shot: Shot, groups: TokenGroup[], adapter: Adapter): Composition {
  const r = resolve(shot, groups);
  if (r.unresolved.length) return { ok: false, unresolved: r.unresolved };

  const out = adapter.compose(shot, r.groups);
  const byId = new Map(r.groups.map((g) => [g.id, g]));
  for (const path of out.reads) {
    const parsed = parsePath(path);
    const group = parsed ? byId.get(parsed.groupId) : undefined;
    const value = parsed && group ? group.values[parsed.key] : undefined;
    if (!group || !value) throw new Error(`${adapter.id} read ${path}, which the shot does not reference`);
    if (value.prompt === false || group.spoiler) {
      throw new Error(`${adapter.id} read ${path}, which is documentation-only`);
    }
  }
  return { ok: true, prompt: out.prompt, reads: out.reads };
}
```

- [ ] **Step 5: Write the render key**

Create `lib/engine/key.ts`:

```ts
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export interface RenderKeyInput {
  model: string;
  ratio: string;
  seed: number;
  prompt: string;
}

// One key for staleness, the browser render map, and (phase 2) the Blob path.
// Synchronous SHA-256, so the browser and the server compute the same key.
export function renderKey(input: RenderKeyInput): string {
  const text = [input.model, input.ratio, String(input.seed), input.prompt].join("|");
  return bytesToHex(sha256(utf8ToBytes(text)));
}

// FNV-1a over the shot id: fixed per shot, so before and after differ only
// by the token change. Unsigned 32-bit.
export function shotSeed(shotId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < shotId.length; i++) {
    h ^= shotId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}
```

- [ ] **Step 6: Run the test to see it pass**

Run: `pnpm vitest run lib/engine/compose.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 7: Commit**

```bash
git add lib/engine
git commit -m "Add resolve, compose with rule checks, and render key

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: USED BY

**Files:**
- Create: `lib/engine/usage.ts`
- Test: `lib/engine/usage.test.ts`

**Interfaces:**
- Consumes: `compose` (Task 5), fixtures (Task 5).
- Produces: `usage(groups, shots, adapter): Map<string, string[]>`, value path → shot ids, built from `reads`.

- [ ] **Step 1: Write the failing test**

Create `lib/engine/usage.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run lib/engine/usage.test.ts`
Expected: FAIL, `Failed to resolve import "./usage"`.

- [ ] **Step 3: Write the implementation**

Create `lib/engine/usage.ts`:

```ts
import { compose } from "./compose";
import type { Shot, TokenGroup } from "./types";
import type { Adapter } from "./adapters/types";

// USED BY: value path -> ids of shots whose composed prompt contains it.
// Built from `reads`, so a value counts only where the adapter used it.
export function usage(groups: TokenGroup[], shots: Shot[], adapter: Adapter): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const shot of shots) {
    const c = compose(shot, groups, adapter);
    if (!c.ok) continue;
    for (const path of new Set(c.reads)) map.set(path, [...(map.get(path) ?? []), shot.id]);
  }
  return map;
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm vitest run lib/engine/usage.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/engine/usage.ts lib/engine/usage.test.ts
git commit -m "Add USED BY built from adapter reads

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Session state

**Files:**
- Create: `lib/session.ts`
- Test: `lib/session.test.ts`

**Interfaces:**
- Consumes: `compose`, `Composition`, `renderKey`, `shotSeed`, `Adapter` (Task 5); `promptValues`, `Edit`, `Shot`, `TokenGroup` (Task 2); `applyEdits` (Task 4, tests only).
- Produces:
  - Types `RenderEntry { kind: "mock" | "live"; url; prompt; at }`, `ApplyPair { shotId; beforeKey: string | null; afterKey }`, `ApplyRecord { edits; pairs; at }`, `Session { log; renders; shown; appliedThrough; lastApply }`, `ShotView { shot; composition; key: string | null; display: RenderEntry | null; fresh; needsFirstRender }`, `NewRender { shotId; key; entry }`.
  - `emptySession()`, `addEdit(session, edit)`, `pendingEdits(session)`, `dismissApply(session)`, `shotViews(groups, shots, adapter, session)`, `staleViews(views)`, `recordRenders(session, renders, { apply, at })`, `settle(session, views)` (returns the same object when nothing changes), `lookText(shot, groups)`, `lookId(shot)`.

- [ ] **Step 1: Write the failing test**

Create `lib/session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyEdits } from "./engine/edits";
import { echoAdapter, fixtureGroups, fixtureShot } from "./engine/test-fixtures";
import type { Edit } from "./engine/types";
import {
  addEdit,
  emptySession,
  lookText,
  pendingEdits,
  recordRenders,
  settle,
  shotViews,
  staleViews,
  type NewRender,
  type Session,
  type ShotView,
} from "./session";

const shots = [fixtureShot("s1", ["look/test", "bot/test"]), fixtureShot("s2", ["look/test", "bot/nope"])];
const toSodium: Edit = { path: "look/test.light", from: "grey light", to: "sodium light", at: "t1" };
const backToGrey: Edit = { path: "look/test.light", from: "sodium light", to: "grey light", at: "t2" };

const viewsFor = (session: Session) =>
  shotViews(applyEdits(fixtureGroups, session.log).groups, shots, echoAdapter, session);
const mock = (v: ShotView, at: string): NewRender => ({
  shotId: v.shot.id,
  key: v.key as string,
  entry: { kind: "mock", url: `mock:${v.key}`, prompt: "p", at },
});
const firstRender = (session: Session) => {
  const first = viewsFor(session).filter((v) => v.needsFirstRender).map((v) => mock(v, "t0"));
  return recordRenders(session, first, { apply: false, at: "t0" });
};

describe("shotViews", () => {
  it("marks a never-rendered shot for its first render, and a broken shot for none", () => {
    const [s1, s2] = viewsFor(emptySession());
    expect(s1).toMatchObject({ fresh: false, needsFirstRender: true, display: null });
    expect(s1.key).toMatch(/^[0-9a-f]{64}$/);
    expect(s2).toMatchObject({ key: null, needsFirstRender: false, display: null });
    expect(s2.composition).toEqual({ ok: false, unresolved: ["bot/nope"] });
  });

  it("goes stale after an edit and keeps showing the last render", () => {
    const rendered = firstRender(emptySession());
    const [before] = viewsFor(rendered);
    const [after] = viewsFor(addEdit(rendered, toSodium));
    expect(before.fresh).toBe(true);
    expect(after.fresh).toBe(false);
    expect(after.needsFirstRender).toBe(false);
    expect(after.display).toEqual(before.display);
    expect(staleViews(viewsFor(addEdit(rendered, toSodium))).map((v) => v.shot.id)).toEqual(["s1"]);
  });

  it("stays fresh when an edit touches a value the adapter did not read", () => {
    const rendered = firstRender(emptySession());
    const docEdit: Edit = { path: "bot/test.behaviour", from: "It falls over.", to: "It sits.", at: "t1" };
    const [after] = viewsFor(addEdit(rendered, docEdit));
    expect(after.key).toBe(rendered.shown.s1);
    expect(after.fresh).toBe(true);
  });
});

describe("recordRenders", () => {
  it("records before/after pairs and the edits an Apply covered", () => {
    const rendered = firstRender(emptySession());
    const beforeKey = rendered.shown.s1;
    const edited = addEdit(rendered, toSodium);
    const stale = staleViews(viewsFor(edited)).map((v) => mock(v, "t1"));
    const applied = recordRenders(edited, stale, { apply: true, at: "t1" });
    expect(applied.lastApply).toEqual({
      edits: [toSodium],
      pairs: [{ shotId: "s1", beforeKey, afterKey: stale[0].key }],
      at: "t1",
    });
    expect(applied.shown.s1).toBe(stale[0].key);
    expect(pendingEdits(applied)).toEqual([]);
    expect(viewsFor(applied)[0].fresh).toBe(true);
  });

  it("does not touch lastApply on a first render", () => {
    expect(firstRender(emptySession()).lastApply).toBeNull();
  });
});

describe("settle", () => {
  it("catches up after a rollback that needs no render", () => {
    const rendered = firstRender(emptySession());
    const edited = addEdit(rendered, toSodium);
    const applied = recordRenders(edited, staleViews(viewsFor(edited)).map((v) => mock(v, "t1")), {
      apply: true,
      at: "t1",
    });
    const rolledBack = addEdit(applied, backToGrey);
    const views = viewsFor(rolledBack);
    expect(views[0].fresh).toBe(true); // the grey render is still in the map
    const settled = settle(rolledBack, views);
    expect(settled.shown.s1).toBe(rendered.shown.s1);
    expect(pendingEdits(settled)).toEqual([]);
  });

  it("returns the same object when nothing changes", () => {
    const rendered = firstRender(emptySession());
    expect(settle(rendered, viewsFor(rendered))).toBe(rendered);
  });

  it("waits while any shot is stale", () => {
    const edited = addEdit(firstRender(emptySession()), toSodium);
    expect(settle(edited, viewsFor(edited))).toBe(edited);
  });
});

describe("lookText", () => {
  it("joins the shot's look values", () => {
    expect(lookText(shots[0], fixtureGroups)).toBe("grey light");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run lib/session.test.ts`
Expected: FAIL, `Failed to resolve import "./session"`.

- [ ] **Step 3: Write the implementation**

Create `lib/session.ts`:

```ts
import { compose, type Composition } from "./engine/compose";
import { renderKey, shotSeed } from "./engine/key";
import { promptValues, type Edit, type Shot, type TokenGroup } from "./engine/types";
import type { Adapter } from "./engine/adapters/types";

// Per-viewer session state. Pure functions only; the React hook wires them up.

export interface RenderEntry {
  kind: "mock" | "live";
  url: string;
  prompt: string;
  at: string;
}

export interface ApplyPair {
  shotId: string;
  beforeKey: string | null;
  afterKey: string;
}

export interface ApplyRecord {
  edits: Edit[]; // the edits this Apply rendered
  pairs: ApplyPair[];
  at: string;
}

export interface Session {
  log: Edit[];
  renders: Record<string, RenderEntry>; // renderKey -> image
  shown: Record<string, string>; // shotId -> renderKey last displayed as fresh
  appliedThrough: number; // log index up to which edits have been rendered
  lastApply: ApplyRecord | null;
}

export function emptySession(): Session {
  return { log: [], renders: {}, shown: {}, appliedThrough: 0, lastApply: null };
}

export function addEdit(session: Session, edit: Edit): Session {
  return { ...session, log: [...session.log, edit] };
}

export function pendingEdits(session: Session): Edit[] {
  return session.log.slice(session.appliedThrough);
}

export function dismissApply(session: Session): Session {
  return { ...session, lastApply: null };
}

export interface ShotView {
  shot: Shot;
  composition: Composition;
  key: string | null; // null when the shot does not compose
  display: RenderEntry | null; // the fresh render, else the last one shown
  fresh: boolean;
  needsFirstRender: boolean;
}

export function shotViews(groups: TokenGroup[], shots: Shot[], adapter: Adapter, session: Session): ShotView[] {
  return shots.map((shot) => {
    const composition = compose(shot, groups, adapter);
    const key = composition.ok
      ? renderKey({ model: adapter.target.model, ratio: shot.ratio, seed: shotSeed(shot.id), prompt: composition.prompt })
      : null;
    const current = key ? session.renders[key] : undefined;
    const shownKey = session.shown[shot.id];
    const previous = shownKey ? session.renders[shownKey] : undefined;
    return {
      shot,
      composition,
      key,
      display: current ?? previous ?? null,
      fresh: Boolean(current),
      needsFirstRender: key !== null && !current && !shownKey,
    };
  });
}

export function staleViews(views: ShotView[]): ShotView[] {
  return views.filter((v) => v.key !== null && !v.fresh);
}

export interface NewRender {
  shotId: string;
  key: string;
  entry: RenderEntry;
}

// `apply: true` is the "Apply to N shots" path and records before/after.
// `apply: false` is the first render of a never-rendered shot.
export function recordRenders(session: Session, renders: NewRender[], opts: { apply: boolean; at: string }): Session {
  const nextRenders = { ...session.renders };
  const nextShown = { ...session.shown };
  const pairs: ApplyPair[] = [];
  for (const r of renders) {
    nextRenders[r.key] = r.entry;
    pairs.push({ shotId: r.shotId, beforeKey: session.shown[r.shotId] ?? null, afterKey: r.key });
    nextShown[r.shotId] = r.key;
  }
  if (!opts.apply) return { ...session, renders: nextRenders, shown: nextShown };
  return {
    ...session,
    renders: nextRenders,
    shown: nextShown,
    appliedThrough: session.log.length,
    lastApply: { edits: pendingEdits(session), pairs, at: opts.at },
  };
}

// When every shot is fresh without a render (a rollback to rendered values),
// catch `shown` and `appliedThrough` up. Returns the same object when
// nothing changes, so a React effect calling it settles.
export function settle(session: Session, views: ShotView[]): Session {
  if (views.some((v) => v.key !== null && !v.fresh)) return session;
  let changed = session.appliedThrough !== session.log.length;
  const shown = { ...session.shown };
  for (const v of views) {
    if (v.key !== null && shown[v.shot.id] !== v.key) {
      shown[v.shot.id] = v.key;
      changed = true;
    }
  }
  return changed ? { ...session, shown, appliedThrough: session.log.length } : session;
}

// The shot's look values as one line, for the mock renderer and alt text.
export function lookText(shot: Shot, groups: TokenGroup[]): string {
  const look = groups.find((g) => g.id.startsWith("look/") && shot.refs.includes(g.id));
  return look ? promptValues(look).map(([, v]) => v.current).join(", ") : "";
}

export function lookId(shot: Shot): string | null {
  return shot.refs.find((r) => r.startsWith("look/")) ?? null;
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm vitest run lib/session.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/session.ts lib/session.test.ts
git commit -m "Add session state: views, staleness, apply records, settle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Mock renderer

**Files:**
- Create: `lib/providers/mock.ts`
- Test: `lib/providers/mock.test.ts`

**Interfaces:**
- Produces: `mockSvg({ label, shotSize, lookText, key }): string` (an SVG data URL with a STUB badge); `hueFor(lookText): number`.

- [ ] **Step 1: Write the failing test**

Create `lib/providers/mock.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run lib/providers/mock.test.ts`
Expected: FAIL, `Failed to resolve import "./mock"`.

- [ ] **Step 3: Write the implementation**

Create `lib/providers/mock.ts`:

```ts
// Zero-key renderer. Draws a labeled frame whose colour follows the look,
// so a look edit visibly changes the before/after grid. Every frame says STUB.

export interface MockInput {
  label: string;
  shotSize: string;
  lookText: string;
  key: string;
}

// The earliest colour word in the look text wins; tuned so the demo edit
// (green-tinted daylight -> sodium streetlight) reads as green -> amber.
const HUE_WORDS: [string, number][] = [
  ["sodium", 32],
  ["amber", 38],
  ["gold", 45],
  ["red", 0],
  ["green", 140],
  ["teal", 180],
  ["blue", 215],
  ["grey", 210],
  ["gray", 210],
];

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function hueFor(lookText: string): number {
  const text = lookText.toLowerCase();
  let best: { index: number; hue: number } | null = null;
  for (const [word, hue] of HUE_WORDS) {
    const index = text.indexOf(word);
    if (index !== -1 && (!best || index < best.index)) best = { index, hue };
  }
  return best ? best.hue : fnv1a(text) % 360;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Comma-form hsl() and plain rgb fills: the forms Safari and Chrome both
// render inside SVG attributes.
export function mockSvg(input: MockInput): string {
  const hue = hueFor(input.lookText);
  const font = 'font-family="ui-monospace, Menlo, monospace"';
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180">`,
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="hsl(${hue}, 38%, 32%)"/>`,
    `<stop offset="1" stop-color="hsl(${(hue + 25) % 360}, 30%, 10%)"/>`,
    `</linearGradient></defs>`,
    `<rect width="320" height="180" fill="url(#g)"/>`,
    `<text x="16" y="30" ${font} font-size="13" fill="rgb(255,255,255)">${esc(clip(input.label, 34))}</text>`,
    `<text x="16" y="48" ${font} font-size="10" fill="rgb(255,255,255)" fill-opacity="0.7">${esc(clip(input.shotSize, 46))}</text>`,
    `<text x="16" y="164" ${font} font-size="9" fill="rgb(255,255,255)" fill-opacity="0.7">${esc(clip(input.lookText, 58))}</text>`,
    `<rect x="262" y="12" width="46" height="18" rx="3" fill="rgb(0,0,0)" fill-opacity="0.6"/>`,
    `<text x="285" y="25" text-anchor="middle" ${font} font-size="10" fill="rgb(255,255,255)">STUB</text>`,
    `<text x="304" y="176" text-anchor="end" ${font} font-size="7" fill="rgb(255,255,255)" fill-opacity="0.5">${input.key.slice(0, 8)}</text>`,
    `</svg>`,
  ].join("");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm vitest run lib/providers/mock.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/providers
git commit -m "Add mock renderer with look-driven colour and STUB badge

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Browser store

**Files:**
- Create: `lib/store/browser-store.ts`
- Test: `lib/store/browser-store.test.ts`

**Interfaces:**
- Consumes: `Session`, `emptySession` (Task 7).
- Produces: `Backend { get(key); set(key, value) }`, `SessionStore { readonly persistent: boolean; load(): Session | null; save(session): Promise<void> }`, `openStore(backend): Promise<SessionStore>`, `idbBackend`.

- [ ] **Step 1: Write the failing test**

Create `lib/store/browser-store.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run lib/store/browser-store.test.ts`
Expected: FAIL, `Failed to resolve import "./browser-store"`.

- [ ] **Step 3: Write the implementation**

Create `lib/store/browser-store.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm vitest run lib/store/browser-store.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the whole suite and lint**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: 8 test files, 52 tests pass; `tsc` and `eslint` print nothing.

- [ ] **Step 6: Commit**

```bash
git add lib/store
git commit -m "Add IndexedDB session store with memory fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: [HAND] The image-gen adapter

**This task is Nick's.** He writes `compose()` with no agent, as live-coding rehearsal. **An agent executing this plan stops after Step 2 and hands over.** It does not write the implementation and does not open Appendix A.

**Files:**
- Create: `lib/engine/adapters/image-gen.ts` (the agent writes the stub; Nick writes `compose`)
- Test: `lib/engine/adapters/image-gen.test.ts`

**Interfaces:**
- Consumes: `Adapter` (Task 5), `promptValues`, `valuePath` (Task 2), `seed` (Task 3), `resolve` (Task 5), `usage` (Task 6).
- Produces: `imageGen: Adapter` with `id: "image-gen"`, `target: { model: "gen4_image" }`. Tasks 12 and 13 import it.

- [ ] **Step 1 (agent): Write the tests**

Create `lib/engine/adapters/image-gen.test.ts`:

```ts
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
```

- [ ] **Step 2 (agent): Write the stub, run the tests, hand over**

Create `lib/engine/adapters/image-gen.ts`:

```
import type { Adapter } from "./types";

// [HAND] Nick writes compose() with no agent. Rule and tests: plan Task 10.
export const imageGen: Adapter = {
  id: "image-gen",
  target: { model: "gen4_image" },
  compose() {
    throw new Error("image-gen compose() is the [HAND] task in plan Task 10");
  },
};
```

Run: `pnpm vitest run lib/engine/adapters/image-gen.test.ts`
Expected: 6 failed, 1 passed (`targets gen4_image`). Commit the tests and the stub:

```bash
git add lib/engine/adapters
git commit -m "Add image-gen adapter tests and stub for the [HAND] task

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then stop and tell Nick the task is ready.

- [ ] **Step 3 (Nick): Write `compose(shot, groups)`**

The rule, from film-tokens.md Tier 3: "entity paragraph + one look/* token + the signifier line, nothing else".

What you get: `groups` holds the shot's resolved refs in ref order, never prims. `promptValues(group)` gives `[key, value]` pairs that may enter a prompt, in seed key order, already skipping `prompt: false` and spoilers. `valuePath(group.id, key)` builds a `reads` entry.

What the tests hold you to:
- The prompt opens with `shot.shotSize`, then `shot.action`.
- Every prompt value of every referenced entity (`bot/`, `prop/`, `loc/`) and of the one look appears exactly once. Case and a trailing period may change.
- No doc-only value, no `world/*` or `voice/*` value, and no spoiler text appears.
- `reads` lists exactly the paths you used.
- The exact `s15-pour-medium` string. It encodes the suggested order below. If you choose another order, rewrite that one expected string, and the rest of the suite still checks you.
- USED BY counts from spec section 4.

Suggested order: shot size as a sentence, action, entity values in ref order (holding each `signifier` back), the look's values joined with `", "` as one sentence, then `Signifiers: a; b; c.`

Decisions that are yours: whether signifiers get their own line or stay with their entity; whether `design` (a proposed value) belongs in a still at all; how a lowercase fragment becomes a sentence. Each changes what Runway sees on every render, so say why in a comment.

- [ ] **Step 4 (Nick): Run the tests**

Run: `pnpm vitest run lib/engine/adapters/image-gen.test.ts`
Expected: PASS, 7 tests. Then `pnpm test`: 9 files, 59 tests.

- [ ] **Step 5 (Nick): Commit**

```bash
git add lib/engine/adapters/image-gen.ts lib/engine/adapters/image-gen.test.ts
git commit -m "Write the image-gen adapter"
```

---

### Task 11: UI constraints (unslop, before building)

**Files:**
- Create: `docs/ui-constraints.md`

- [ ] **Step 1: Run unslop's constraint phase**

This repo has no `.claude/skills/unslop/`, so invoke `me:unslop`. Give it these inputs:
- the board wireframe, FigJam file `f4RmKqEECb90gfNdsGJOt7`, node `5-2` (three panels: token table with TOKEN / VALUE / USED BY, a shot card with reference chips and composed prompt, and change one value → Apply to 6 shots → before/after);
- spec section 8;
- the component list in Tasks 12 and 13.

- [ ] **Step 2: Save the constraints**

Write the output to `docs/ui-constraints.md`. Tasks 12 and 13 give structure, props and behaviour, which stay as written. Their Tailwind classes are a neutral starting point: where a class conflicts with a constraint, the constraint wins.

- [ ] **Step 3: Commit**

```bash
git add docs/ui-constraints.md
git commit -m "Record UI constraints from unslop

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: State hook and the token side

**Files:**
- Create: `components/useLookTokens.ts`, `components/TokenTable.tsx`, `components/HistoryDrawer.tsx`, `components/Toolbar.tsx`, `components/LookTokensApp.tsx`
- Modify: `app/page.tsx`, `app/layout.tsx:15-18` (metadata), `app/globals.css` (body font)

**Interfaces:**
- Consumes: everything in Tasks 2 to 10.
- Produces: `useLookTokens()` returning `{ ready, groups, conflicts, views, usedBy, pending, staleCount, lastApply, renders, persistent, edit(path, to), apply(), dismiss(), reset(), download() }`. `LookTokensApp` is the page.

The hook has two effects only, load and save. Every state change runs through `normalize()` inside the `setSession` updater. It renders never-rendered shots and then settles after rollbacks. This keeps React 19's `set-state-in-effect` lint rule quiet and the data flow in one place.

- [ ] **Step 1: Write the hook**

Create `components/useLookTokens.ts`:

```ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { imageGen } from "@/lib/engine/adapters/image-gen";
import { applyEdits, exportSeed, makeEdit } from "@/lib/engine/edits";
import { usage } from "@/lib/engine/usage";
import { mockSvg } from "@/lib/providers/mock";
import { seed } from "@/lib/seed";
import {
  addEdit,
  dismissApply,
  emptySession,
  lookText,
  pendingEdits,
  recordRenders,
  settle,
  shotViews,
  staleViews,
  type NewRender,
  type Session,
  type ShotView,
} from "@/lib/session";
import { idbBackend, openStore, type SessionStore } from "@/lib/store/browser-store";

const adapter = imageGen;

function derive(session: Session) {
  const { groups, conflicts } = applyEdits(seed.groups, session.log);
  const views = shotViews(groups, seed.shots, adapter, session);
  return { groups, conflicts, views };
}

function mockRender(view: ShotView, groups: ReturnType<typeof derive>["groups"], at: string): NewRender[] {
  if (!view.key || !view.composition.ok) return [];
  const url = mockSvg({
    label: view.shot.label,
    shotSize: view.shot.shotSize,
    lookText: lookText(view.shot, groups),
    key: view.key,
  });
  return [{ shotId: view.shot.id, key: view.key, entry: { kind: "mock", url, prompt: view.composition.prompt, at } }];
}

// Every state change passes through here: render never-rendered shots,
// then settle after rollbacks. Keeps effects out of the data flow.
function normalize(session: Session): Session {
  const at = new Date().toISOString();
  const { groups, views } = derive(session);
  const first = views.filter((v) => v.needsFirstRender).flatMap((v) => mockRender(v, groups, at));
  const rendered = first.length ? recordRenders(session, first, { apply: false, at }) : session;
  return settle(rendered, derive(rendered).views);
}

export function useLookTokens() {
  const [session, setSession] = useState<Session | null>(null);
  const [persistent, setPersistent] = useState(true);
  const storeRef = useRef<SessionStore | null>(null);

  useEffect(() => {
    let cancelled = false;
    openStore(idbBackend).then((store) => {
      if (cancelled) return;
      storeRef.current = store;
      setPersistent(store.persistent);
      setSession(normalize(store.load() ?? emptySession()));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const store = storeRef.current;
    if (!store || !session) return;
    store.save(session).then(() => setPersistent(store.persistent));
  }, [session]);

  const derived = useMemo(() => (session ? derive(session) : null), [session]);
  const usedBy = useMemo(
    () => (derived ? usage(derived.groups, seed.shots, adapter) : new Map<string, string[]>()),
    [derived],
  );

  const edit = useCallback((path: string, to: string) => {
    setSession((s) => {
      if (!s) return s;
      const e = makeEdit(applyEdits(seed.groups, s.log).groups, path, to, new Date().toISOString());
      return e ? normalize(addEdit(s, e)) : s;
    });
  }, []);

  const apply = useCallback(() => {
    setSession((s) => {
      if (!s) return s;
      const at = new Date().toISOString();
      const { groups, views } = derive(s);
      const renders = staleViews(views).flatMap((v) => mockRender(v, groups, at));
      return renders.length ? normalize(recordRenders(s, renders, { apply: true, at })) : s;
    });
  }, []);

  const dismiss = useCallback(() => setSession((s) => (s ? dismissApply(s) : s)), []);
  const reset = useCallback(() => setSession(normalize(emptySession())), []);

  const download = useCallback(() => {
    if (!session) return;
    const data = exportSeed(seed, session.log);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "look-tokens-seed.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [session]);

  return {
    ready: session !== null && derived !== null,
    groups: derived?.groups ?? [],
    conflicts: derived?.conflicts ?? [],
    views: derived?.views ?? [],
    usedBy,
    pending: session ? pendingEdits(session) : [],
    staleCount: derived ? staleViews(derived.views).length : 0,
    lastApply: session?.lastApply ?? null,
    renders: session?.renders ?? {},
    persistent,
    edit,
    apply,
    dismiss,
    reset,
    download,
  };
}
```

- [ ] **Step 2: Write the token table**

Create `components/TokenTable.tsx`:

```tsx
"use client";

import { useState } from "react";
import { valuePath, type Tier, type TokenGroup } from "@/lib/engine/types";

const SECTIONS: { tier: Tier; label: string }[] = [
  { tier: "semantic", label: "Semantic" },
  { tier: "entity", label: "Entities" },
  { tier: "prim", label: "Primitives" },
];

interface Props {
  groups: TokenGroup[];
  usedBy: Map<string, string[]>;
  selectedGroup: string | null;
  onEdit(path: string, to: string): void;
  onShowUsers(shotIds: string[]): void;
  onOpenHistory(path: string): void;
}

export function TokenTable({ groups, usedBy, selectedGroup, onEdit, onShowUsers, onOpenHistory }: Props) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">
          <th scope="col" className="py-2 pr-3 font-medium">Token</th>
          <th scope="col" className="py-2 pr-3 font-medium">Value</th>
          <th scope="col" className="py-2 font-medium">Used by</th>
        </tr>
      </thead>
      {SECTIONS.map(({ tier, label }) => (
        <tbody key={tier}>
          <tr>
            <th colSpan={3} scope="colgroup" className="pt-6 pb-1 text-left text-xs font-medium text-zinc-500">
              {label}
            </th>
          </tr>
          {groups
            .filter((g) => g.tier === tier)
            .map((g) => (
              <GroupRows
                key={g.id}
                group={g}
                usedBy={usedBy}
                selected={g.id === selectedGroup}
                onEdit={onEdit}
                onShowUsers={onShowUsers}
                onOpenHistory={onOpenHistory}
              />
            ))}
        </tbody>
      ))}
    </table>
  );
}

function GroupRows({
  group,
  usedBy,
  selected,
  onEdit,
  onShowUsers,
  onOpenHistory,
}: Omit<Props, "groups" | "selectedGroup"> & { group: TokenGroup; selected: boolean }) {
  const rowTone = selected ? "bg-amber-50" : "";
  return (
    <>
      <tr className={`border-t border-zinc-200 ${rowTone}`}>
        <th colSpan={3} scope="rowgroup" className="py-2 text-left font-mono text-[13px] font-medium">
          {group.id}
          {group.proposed ? <Tag>proposed</Tag> : null}
          {group.spoiler ? <Tag>director-only</Tag> : null}
          {group.citations.length ? (
            <span className="ml-2 font-sans text-xs font-normal text-zinc-400" title={group.citations.join(" ")}>
              {group.citations.length} {group.citations.length === 1 ? "citation" : "citations"}
            </span>
          ) : null}
        </th>
      </tr>
      {group.spoiler
        ? null
        : Object.entries(group.values).map(([key, v]) => {
            const path = valuePath(group.id, key);
            const users = usedBy.get(path) ?? [];
            const doc = v.prompt === false;
            return (
              <tr key={path} className={`align-top ${rowTone}`}>
                <td className="py-1.5 pr-3 font-mono text-xs text-zinc-500">.{key}</td>
                <td className="py-1.5 pr-3">
                  <ValueEditor path={path} value={v.current} editable={!doc} onEdit={onEdit} />
                  {v.proposed ? <Tag>proposed</Tag> : null}
                  {doc ? <Tag>doc only</Tag> : null}
                  {v.history?.length ? (
                    <button
                      type="button"
                      onClick={() => onOpenHistory(path)}
                      className="ml-2 text-xs text-zinc-500 underline underline-offset-2"
                    >
                      {v.history.length + 1} versions
                    </button>
                  ) : null}
                </td>
                <td className="py-1.5 whitespace-nowrap">
                  {users.length ? (
                    <button
                      type="button"
                      onClick={() => onShowUsers(users)}
                      className="tabular-nums underline underline-offset-2"
                    >
                      {users.length} {users.length === 1 ? "shot" : "shots"}
                    </button>
                  ) : (
                    <span className="text-zinc-400">0</span>
                  )}
                </td>
              </tr>
            );
          })}
    </>
  );
}

function ValueEditor({
  path,
  value,
  editable,
  onEdit,
}: {
  path: string;
  value: string;
  editable: boolean;
  onEdit(path: string, to: string): void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (!editable) return <span className="text-zinc-400">{value}</span>;
  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => setDraft(value)}
        aria-label={`Edit ${path}: ${value}`}
        className="text-left hover:underline hover:underline-offset-2"
      >
        {value}
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onEdit(path, draft);
        setDraft(null);
      }}
    >
      <input
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setDraft(null);
        }}
        onBlur={() => setDraft(null)}
        aria-label={`New value for ${path}`}
        className="w-full rounded border border-zinc-300 px-2 py-1"
      />
      <p className="mt-1 text-xs text-zinc-500">Enter to save, Esc to cancel</p>
    </form>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-2 rounded border border-zinc-300 px-1 py-px font-sans text-[10px] font-normal uppercase tracking-wide text-zinc-500">
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Write the history drawer and toolbar**

Create `components/HistoryDrawer.tsx`:

```tsx
"use client";

import { valueHistory } from "@/lib/engine/edits";
import type { TokenValue } from "@/lib/engine/types";

interface Props {
  path: string;
  value: TokenValue;
  onRollback(to: string): void;
  onClose(): void;
}

export function HistoryDrawer({ path, value, onRollback, onClose }: Props) {
  const items = valueHistory(value).reverse(); // newest first
  return (
    <aside
      role="dialog"
      aria-label={`History of ${path}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className="fixed inset-y-0 right-0 z-10 w-full max-w-sm overflow-y-auto border-l border-zinc-200 bg-white p-5 shadow-xl"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-mono text-sm font-medium">{path}</h2>
        <button type="button" onClick={onClose} autoFocus className="text-sm underline underline-offset-2">
          Close
        </button>
      </div>
      <ol className="mt-4 space-y-3">
        {items.map((item, i) => (
          <li key={`${i}-${item.value}`} className="border-t border-zinc-200 pt-3 text-sm">
            <p>{item.value}</p>
            <p className="mt-1 text-xs text-zinc-500">
              {item.replacedAt === null ? "Current" : `Replaced ${new Date(item.replacedAt).toLocaleString()}`}
            </p>
            {item.replacedAt !== null && item.value !== value.current ? (
              <button
                type="button"
                onClick={() => onRollback(item.value)}
                className="mt-2 text-xs underline underline-offset-2"
              >
                Roll back to this
              </button>
            ) : null}
          </li>
        ))}
      </ol>
    </aside>
  );
}
```

Create `components/Toolbar.tsx`:

```tsx
"use client";

interface Props {
  persistent: boolean;
  conflictCount: number;
  onReset(): void;
  onExport(): void;
}

export function Toolbar({ persistent, conflictCount, onReset, onExport }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <button type="button" onClick={onReset} className="rounded border border-zinc-300 px-3 py-1">
        Reset to seed
      </button>
      <button type="button" onClick={onExport} className="rounded border border-zinc-300 px-3 py-1">
        Export JSON
      </button>
      {persistent ? null : (
        <p className="text-zinc-500">This browser is not saving edits. They last until you close the tab.</p>
      )}
      {conflictCount ? (
        <p className="text-red-700">
          {conflictCount} saved {conflictCount === 1 ? "edit no longer matches" : "edits no longer match"} the seed.
          Reset to clear {conflictCount === 1 ? "it" : "them"}.
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Write a first page with the token side only**

Create `components/LookTokensApp.tsx`:

```
"use client";

import { useState } from "react";
import { parsePath } from "@/lib/engine/types";
import { HistoryDrawer } from "./HistoryDrawer";
import { TokenTable } from "./TokenTable";
import { Toolbar } from "./Toolbar";
import { useLookTokens } from "./useLookTokens";

// First version: the token side only. Task 13 replaces this file.
export function LookTokensApp() {
  const t = useLookTokens();
  const [historyPath, setHistoryPath] = useState<string | null>(null);

  if (!t.ready) return <main className="p-6 text-sm text-zinc-500">Loading tokens…</main>;

  const parsed = historyPath ? parsePath(historyPath) : null;
  const historyValue = parsed ? t.groups.find((g) => g.id === parsed.groupId)?.values[parsed.key] : undefined;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold">Look Tokens</h1>
          <p className="text-sm text-zinc-500">Post-Collapse Montreal · Scene 15 · image-gen adapter</p>
        </div>
        <Toolbar
          persistent={t.persistent}
          conflictCount={t.conflicts.length}
          onReset={t.reset}
          onExport={t.download}
        />
      </header>

      <section aria-label="Tokens" className="mt-6 max-w-3xl">
        <TokenTable
          groups={t.groups}
          usedBy={t.usedBy}
          selectedGroup={null}
          onEdit={t.edit}
          onShowUsers={() => {}}
          onOpenHistory={setHistoryPath}
        />
      </section>

      {historyPath && historyValue ? (
        <HistoryDrawer
          path={historyPath}
          value={historyValue}
          onRollback={(to) => {
            t.edit(historyPath, to);
            setHistoryPath(null);
          }}
          onClose={() => setHistoryPath(null)}
        />
      ) : null}
    </main>
  );
}
```

Replace `app/page.tsx`:

```tsx
import { LookTokensApp } from "@/components/LookTokensApp";

export default function Page() {
  return <LookTokensApp />;
}
```

In `app/layout.tsx`, set the metadata:

```tsx
export const metadata: Metadata = {
  title: "Look Tokens",
  description: "Cinematography as design tokens: edit one value, every shot that uses it re-renders.",
};
```

In `app/globals.css`, in the `body` rule, replace `font-family: Arial, Helvetica, sans-serif;` with:

```css
  font-family: var(--font-sans), system-ui, sans-serif;
```

- [ ] **Step 5: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: no output from `tsc` or `eslint`; the build lists `○ /` as Static.

Start the `look-tokens` preview (`.claude/launch.json`). Front the tab and set the viewport to 1440 × 900 before reading anything. Check:
- the table shows three sections, and `look/overgrown-interior` values show `6 shots`;
- `look/rain-reveal` values show `0`; doc-only values are greyed and not editable; the two `prim/director-only-*` rows show no values;
- clicking `.light` opens an input with the text selected; Esc cancels; typing a new value and Enter saves it and shows `2 versions`;
- `2 versions` opens the drawer; `Roll back to this` restores the old value;
- after a reload, the edit is still there; `Reset to seed` clears it.

- [ ] **Step 6: Commit**

```bash
git add app components
git commit -m "Add state hook, token table, history drawer and toolbar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: The shot side

**Files:**
- Create: `components/ShotCard.tsx`, `components/EditPanel.tsx`, `components/BeforeAfter.tsx`
- Modify: `components/LookTokensApp.tsx` (full replacement)

**Interfaces:**
- Consumes: `useLookTokens()` (Task 12); `ShotView`, `ApplyRecord`, `RenderEntry`, `lookId` (Task 7); `Edit`, `Shot` (Task 2).

- [ ] **Step 1: Write the shot card**

Create `components/ShotCard.tsx`:

```tsx
"use client";

import { lookId, type ShotView } from "@/lib/session";

interface Props {
  view: ShotView;
  highlighted: boolean;
  onChip(groupId: string): void;
}

export function ShotCard({ view, highlighted, onChip }: Props) {
  const { shot, composition, display, fresh } = view;
  const unresolved = composition.ok ? [] : composition.unresolved;
  return (
    <article
      className={`rounded-md border p-3 ${highlighted ? "border-zinc-900 ring-2 ring-zinc-900" : "border-zinc-200"}`}
    >
      <div className="relative aspect-video overflow-hidden rounded bg-zinc-100">
        {display ? (
          // Renders are data URLs (mock) or Blob URLs (phase 2); next/image adds nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={display.url}
            alt={`${shot.shotSize}, ${shot.label}: ${lookId(shot) ?? "no look"}`}
            className={`h-full w-full object-cover ${fresh ? "" : "opacity-40"}`}
          />
        ) : null}
        <div className="absolute left-2 top-2 flex gap-1">
          {!fresh && composition.ok ? <Badge>Stale</Badge> : null}
          {unresolved.length ? <Badge>Unresolved</Badge> : null}
        </div>
      </div>
      <h3 className="mt-2 text-sm font-medium">{shot.label}</h3>
      <p className="text-xs text-zinc-500">
        {shot.shotSize}
        {shot.proposedFields.includes("shotSize") ? " (proposed)" : ""}
      </p>
      <ul className="mt-2 flex flex-wrap gap-1" aria-label="Token references">
        {shot.refs.map((ref) => (
          <li key={ref}>
            <button
              type="button"
              onClick={() => onChip(ref)}
              className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${
                unresolved.includes(ref) ? "border-red-400 text-red-700" : "border-zinc-300 text-zinc-700"
              }`}
            >
              {ref}
            </button>
          </li>
        ))}
      </ul>
      {composition.ok ? (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-zinc-500">Composed prompt</summary>
          <p className="mt-1 leading-relaxed">{composition.prompt}</p>
        </details>
      ) : (
        <p className="mt-2 text-xs text-red-700">Does not compose: {unresolved.join(", ")} not found.</p>
      )}
    </article>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-zinc-900/80 px-1.5 py-0.5 text-[10px] font-medium text-white">{children}</span>;
}
```

- [ ] **Step 2: Write the edit panel and before/after rows**

Create `components/EditPanel.tsx`:

```tsx
"use client";

import type { Edit } from "@/lib/engine/types";

interface Props {
  pending: Edit[];
  staleCount: number;
  onApply(): void;
}

export function EditPanel({ pending, staleCount, onApply }: Props) {
  if (!pending.length && !staleCount) return null;
  return (
    <section aria-live="polite" className="rounded-md border border-zinc-200 p-4">
      <h2 className="text-sm font-medium">Changed values</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {pending.map((e) => (
          <li key={`${e.at}-${e.path}`}>
            <code className="font-mono text-xs">{e.path}</code>{" "}
            <span className="text-zinc-400 line-through">{e.from}</span> → <span>{e.to}</span>
          </li>
        ))}
      </ul>
      {staleCount ? (
        <button
          type="button"
          onClick={onApply}
          className="mt-3 rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          Apply to {staleCount} {staleCount === 1 ? "shot" : "shots"}
        </button>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">Every shot already has a render for these values.</p>
      )}
    </section>
  );
}
```

Create `components/BeforeAfter.tsx`:

```tsx
"use client";

import type { Shot } from "@/lib/engine/types";
import type { ApplyRecord, RenderEntry } from "@/lib/session";

interface Props {
  record: ApplyRecord;
  renders: Record<string, RenderEntry>;
  shots: Shot[];
  onDismiss(): void;
}

export function BeforeAfter({ record, renders, shots, onDismiss }: Props) {
  const label = (id: string) => shots.find((s) => s.id === id)?.label ?? id;
  const rows: { name: string; keyOf(p: ApplyRecord["pairs"][number]): string | null }[] = [
    { name: "Before", keyOf: (p) => p.beforeKey },
    { name: "After", keyOf: (p) => p.afterKey },
  ];
  return (
    <section className="rounded-md border border-zinc-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium">
            {record.pairs.length} {record.pairs.length === 1 ? "shot" : "shots"} re-rendered
          </h2>
          <ul className="mt-1 text-xs text-zinc-500">
            {record.edits.map((e) => (
              <li key={`${e.at}-${e.path}`}>
                <code className="font-mono">{e.path}</code>: {e.from} → {e.to}
              </li>
            ))}
          </ul>
        </div>
        <button type="button" onClick={onDismiss} className="text-sm underline underline-offset-2">
          Dismiss
        </button>
      </div>
      {rows.map((row) => (
        <div key={row.name} className="mt-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">{row.name}</h3>
          <ul className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {record.pairs.map((p) => {
              const key = row.keyOf(p);
              const entry = key ? renders[key] : undefined;
              return (
                <li key={p.shotId}>
                  <div className="aspect-video overflow-hidden rounded bg-zinc-100">
                    {entry ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.url} alt={`${row.name}: ${label(p.shotId)}`} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500">{label(p.shotId)}</p>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 3: Replace the page layout**

Replace `components/LookTokensApp.tsx`:

```tsx
"use client";

import { useState } from "react";
import { parsePath } from "@/lib/engine/types";
import { seed } from "@/lib/seed";
import { BeforeAfter } from "./BeforeAfter";
import { EditPanel } from "./EditPanel";
import { HistoryDrawer } from "./HistoryDrawer";
import { ShotCard } from "./ShotCard";
import { TokenTable } from "./TokenTable";
import { Toolbar } from "./Toolbar";
import { useLookTokens } from "./useLookTokens";

export function LookTokensApp() {
  const t = useLookTokens();
  const [highlighted, setHighlighted] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [historyPath, setHistoryPath] = useState<string | null>(null);

  if (!t.ready) return <main className="p-6 text-sm text-zinc-500">Loading tokens…</main>;

  const parsed = historyPath ? parsePath(historyPath) : null;
  const historyValue = parsed ? t.groups.find((g) => g.id === parsed.groupId)?.values[parsed.key] : undefined;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold">Look Tokens</h1>
          <p className="text-sm text-zinc-500">Post-Collapse Montreal · Scene 15 · image-gen adapter</p>
        </div>
        <Toolbar
          persistent={t.persistent}
          conflictCount={t.conflicts.length}
          onReset={t.reset}
          onExport={t.download}
        />
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-label="Tokens" className="min-w-0">
          <TokenTable
            groups={t.groups}
            usedBy={t.usedBy}
            selectedGroup={selectedGroup}
            onEdit={t.edit}
            onShowUsers={(ids) => {
              setHighlighted(ids);
              setSelectedGroup(null);
            }}
            onOpenHistory={setHistoryPath}
          />
        </section>

        <section aria-label="Shots" className="min-w-0 space-y-6">
          <EditPanel pending={t.pending} staleCount={t.staleCount} onApply={t.apply} />
          {t.lastApply ? (
            <BeforeAfter record={t.lastApply} renders={t.renders} shots={seed.shots} onDismiss={t.dismiss} />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {t.views.map((view) => (
              <ShotCard
                key={view.shot.id}
                view={view}
                highlighted={highlighted.includes(view.shot.id)}
                onChip={(groupId) => {
                  setSelectedGroup(groupId);
                  setHighlighted([]);
                }}
              />
            ))}
          </div>
        </section>
      </div>

      {historyPath && historyValue ? (
        <HistoryDrawer
          path={historyPath}
          value={historyValue}
          onRollback={(to) => {
            t.edit(historyPath, to);
            setHistoryPath(null);
          }}
          onClose={() => setHistoryPath(null)}
        />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 4: Verify with the demo script**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`
Expected: 59 tests pass; no output from `tsc` or `eslint`; the build succeeds.

In the `look-tokens` preview (front the tab, 1440 × 900), start with `Reset to seed`, then:
1. Six green STUB frames load, all fresh. `look/overgrown-interior.light` shows `6 shots`.
2. Click `6 shots`: all six cards get a ring. Click a `prop/carafe` chip: the carafe rows highlight.
3. Edit `.light` to `sodium streetlight through the windows at dusk`. All six cards show `Stale`; the panel reads `Apply to 6 shots`.
4. Apply. The panel reads `6 shots re-rendered`; the Before row is green and the After row is amber.
5. Open `2 versions`, roll back. All six are fresh and green at once, with no Apply button and no Stale badge.
6. `read_console_messages` with `onlyErrors: true` returns nothing.

- [ ] **Step 5: Commit**

```bash
git add components
git commit -m "Add shot cards, apply panel and before/after rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: unslop audit

**Files:**
- Modify: whatever the audit finds in `components/`, `app/globals.css`

- [ ] **Step 1: Run the audit**

Invoke `me:unslop` in audit mode against the running preview and `docs/ui-constraints.md`.

- [ ] **Step 2: Fix what it finds**

Fix every finding without changing props, behaviour or copy meaning. Check the fixes in both light and dark mode, because the scaffold's `globals.css` follows `prefers-color-scheme`.

- [ ] **Step 3: Re-run the Task 13 demo script and the full checks**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`, then demo steps 1 to 6.
Expected: the same results as Task 13.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Apply unslop audit fixes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Deploy the preview and verify it across browsers

Pushing and deploying are outward-facing. **Ask Nick first** and state the target:
- the repo and branch (`weeeha/Film-Tools---Look-Tokens`, `feat/phase-1`);
- which Vercel team the project goes under (ask; do not guess).

- [ ] **Step 1: Push and deploy a preview (after Nick's go)**

```bash
git push -u origin feat/phase-1
vercel link
vercel deploy
```

Or run `me:ship`, which does the same and returns a short link. The deploy must be a preview, not production. If Vercel Deployment Protection blocks logged-out viewers, tell Nick and ask before changing any project setting.

- [ ] **Step 2: Verify in Chrome**

Open the preview URL in the Browser pane (front the tab, 1440 × 900) and run the Task 13 demo script, steps 1 to 6.

- [ ] **Step 3: Verify in Safari**

`open -a Safari <preview URL>`, then take a screenshot. Computer use grants browsers read-only access, so it can confirm that the page and the SVG stubs render but cannot click. Ask Nick to run demo steps 3 to 5 in Safari and report. Record which checks were seen and which were reported.

- [ ] **Step 4: Report**

Give Nick the preview link, the Chrome result, and the Safari result, with any gap stated plainly.

---

## Phase 2 (separate plan)

Phase 2 gets its own plan after the phase 1 checkpoint. Its first task checks `gen4_image` credits per image, the prompt length limit, and seed support against Runway's docs before any paid call. The code can't be written until those are known. Scope, from spec section 9:
- Vercel Blob provisioning, `POST /api/render` with the `RENDER_LIVE` gate and a server-computed key, a cost estimate, and manual retry;
- the first real batch of about 12 renders;
- the Seedance adapter side by side;
- the weighted budget trim, only if a prompt exceeds the verified limit.

## Appendix A: reference image-gen implementation

For comparison **after** Nick's own version passes Task 10. It produces the exact `s15-pour-medium` string in the tests.

```
import { promptValues, valuePath } from "../types";
import type { Adapter } from "./types";

// Reference implementation (plan appendix). Nick writes his own in Task 10.
const sentence = (s: string) => {
  const t = s.trim();
  const c = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(c) ? c : `${c}.`;
};

export const imageGen: Adapter = {
  id: "image-gen",
  target: { model: "gen4_image" },
  compose(shot, groups) {
    const parts = [sentence(shot.shotSize), shot.action];
    const reads: string[] = [];
    const signifiers: string[] = [];

    for (const g of groups.filter((x) => x.tier === "entity")) {
      for (const [key, v] of promptValues(g)) {
        reads.push(valuePath(g.id, key));
        if (key === "signifier") signifiers.push(v.current);
        else parts.push(sentence(v.current));
      }
    }

    const look = groups.find((g) => g.id.startsWith("look/"));
    if (look) {
      const values = promptValues(look);
      parts.push(sentence(values.map(([, v]) => v.current).join(", ")));
      for (const [key] of values) reads.push(valuePath(look.id, key));
    }

    if (signifiers.length) parts.push(`Signifiers: ${signifiers.join("; ")}.`);
    return { prompt: parts.join(" "), reads };
  },
};
```

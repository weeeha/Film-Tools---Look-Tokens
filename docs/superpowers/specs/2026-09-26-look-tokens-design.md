# Look Tokens: design

Status: approved by Nick · 2026-09-26 · Repo: `weeeha/Film-Tools---Look-Tokens` · Build 02 on the "20 builds for Runway Labs" board

Supersedes `Runaway/builds/09-look-tokens/spec.md` (2026-09-19), which placed this build inside Film Analyzer.

## TL;DR

Look Tokens treats a film's look as a design token system. Tokens and shots come from `My Films/film-tokens.md`, the Post-Collapse Montreal token file. A shot holds references to tokens and one action line. Its prompt is composed at render time by a per-tool adapter. Edit one value, such as `look/overgrown-interior.light`, and the table offers "Apply to 6 shots". The six stills re-render, and a before/after grid shows the change. Every value keeps its history, and rolling back restores the old images without a new render.

It is a standalone Next.js app. The engine is a pure TypeScript module, so build 08 can import it later. Phase 1 (4 to 5 h) runs entirely on a mock renderer and ships as an unlisted preview link. Phase 2 (4 to 5 h) adds real Runway `gen4_image` renders, a shared render cache in Vercel Blob, and a second adapter (Seedance) shown side by side.

## 1. Why this build

Board card 02 describes it as "the only-you build: a design systems practice pointed at cinematography". The claim to show: a look has one source of truth and a visible dependency graph, the same way a component library has. Prompt-based film work keeps a look as adjectives copied across many prompts, and those copies drift apart. Here the adjectives live in one table, shots point at them, and the USED BY column shows what an edit will touch before it is applied.

The token file already exists and already follows design-token structure: primitives, semantic tokens, entity tokens, and per-tool adapters, with a one-way rule between tiers. This app makes those rules executable.

## 2. Decisions

Numbered so any one can be overridden by number.

1. **Standalone repo**, not a tab in Film Analyzer. The repo was created after the Sep 19 spec, Film Analyzer has been frozen mid-refactor since April, and a standalone app can deploy as a preview link.
2. **Two phases.** Phase 1 is a checkpoint that ends in a recordable clip in stub mode. Phase 2 adds real renders and the second adapter.
3. **Seed data is committed JSON. Edits live in the browser.** Each viewer gets an edit log in IndexedDB over the seed. Nothing a visitor does changes the demo for anyone else.
4. **Mock renderer by default.** Real renders run only where `RENDER_LIVE=1` is set on the server, which is Nick's machine. A public visitor never spends credits.
5. **Stills only.** Runway `gen4_image` through the image-gen adapter.
6. **Adapters come from film-tokens.md Tier 3.** Image-gen in phase 1, Seedance (text only) in phase 2.
7. **Demo content is Scene 15, the restaurant.** Six interior shots, drafted from canon and tagged `[PROPOSED]` wherever no citation exists. Nick reviews them in this spec (section 4).
8. **A new proposed look, `look/overgrown-interior`, carries the six shots.** The four looks in film-tokens.md cover exteriors and flashbacks only, which the Scene 15 spec already notes (Open list item 11). The v1 Scene 15 prompt carries its interior grade inline. film-tokens.md says a missing word becomes a new semantic token, so this build promotes that inline text to a token. Accepted 2026-09-26.
9. **Spoiler text never enters this repo.** The repo is public. The two SPOILER primitives appear as redacted rows with neutral ids, enough to exercise the rule and show a locked row in the UI.
10. **One render key.** `renderKey = sha256(model | ratio | seed | prompt)` drives staleness, the browser render map, and the Blob pathname.

## 3. Token model

```ts
type Tier = "prim" | "semantic" | "entity";

interface TokenValue {
  current: string;
  prompt?: false;       // documentation only, never composed
  proposed?: true;      // no citation in the source docs
  citations?: string[];
}

interface TokenGroup {
  id: string;           // "look/overgrown-interior"; namespace is the part before "/"
  tier: Tier;
  values: Record<string, TokenValue>;  // key order in the seed file is compose order
  citations: string[];  // "[J27 14:29]", kept from film-tokens.md
  proposed?: true;
  spoiler?: true;       // prim only
}

interface Shot {
  id: string;           // "s15-pour-medium"
  scene: number;
  label: string;
  shotSize: string;
  action: string;       // one line, action only, never look words
  actionCitations: string[];
  era: "pre" | "post";
  ratio: "16:9";
  refs: string[];       // group ids
}

interface Edit {
  path: string;         // "look/overgrown-interior.light"
  from: string;
  to: string;
  at: string;           // ISO timestamp
}
```

Namespaces: `prim`, `world`, `look`, `audio`, `voice`, `move` (prim and semantic tiers), `bot`, `prop`, `loc` (entity tier).

`prompt: false` is how a paragraph from film-tokens.md stays verbatim in the seed without every sentence landing in every prompt. The v1 Scene 15 prompt set the precedent: it pasted the identity and signifier sentences of `bot/restaurant` and left out the welcome and trip sentences, because stating them in setup "risks the model enacting them". Those sentences are kept as `behaviour` values with `prompt: false`. The UI shows them greyed.

## 4. Seed data

### Token groups

Transcribed from film-tokens.md unless marked. Values marked "doc" have `prompt: false`.

| Group | Values | Source |
|---|---|---|
| `look/overgrown-interior` **[PROPOSED, new]** | `light`: soft overcast daylight through overgrown windows, in green-tinted shafts · `air`: dust hangs in the still air · `palette`: muted desaturated palette, cool greens against warm dust · `capture`: modern digital cinema · `lens`: 35mm lens, shallow depth of field | Scene 15 spec Open items 5 and 11, v1 prompt setup paragraph |
| `look/rain-reveal` [PROPOSED in source] | `light`: soft grey overcast light · `weather`: active rain · `surface`: wet reflective surfaces · `colour`: muted colour · `use` (doc): for the rooftop wake and slow world reveals | 2b, [J27 14:29] [A11 16:29]. The four-way split is [PROPOSED] |
| `look/pre-collapse-clean` [PROPOSED in source] | `grade`: bright, ordinary, functional present-day-plus grade · `use` (doc): for era/pre flashbacks | 2b |
| `world/overgrown-not-destroyed` | `use`, `antiUse` (doc) | [J27 02:00] |
| `world/degraded-lesser-ai` | `use`, `antiUse` (doc) | [J27 00:59] |
| `world/most-people-died` | `use`, `antiUse` (doc) | [J27 02:29] |
| `voice/restaurant-robot` | `register`: French, service-polite, unaware anything is wrong · `colour` [PROPOSED]: warm and unhurried · `lines` (doc): canonical lines | 2c |
| `bot/restaurant` | `identity`: A simple general-purpose service robot in an abandoned restaurant, still working its shift. · `context`: The diners at the set tables are dead. · `design` [PROPOSED]: slim humanoid service unit, worn cream-white chassis, a serving tray arm, smooth precise movement · `behaviour` (doc): the welcome, pour and trip sentences · `signifier`: a cover on its back that opens to its batteries | Entity block, Scene 15 spec Open item 1 |
| `loc/restaurant` | `exterior` (doc): A restaurant on the street with movement visible inside. · `interior`: Set tables with dead diners. · `signifier`: set tables, dead diners, live robot | Entity block. `exterior` is doc-only because all six shots are interior |
| `prop/carafe` | `identity`: A broken, empty carafe. · `behaviour` (doc): pours into cups, nothing comes out · `signifier`: the pour that delivers nothing | [J27 30:53] [A01 09:13] |
| `prop/cable` | `identity`: A cable, thrown to trip the restaurant robot. | [A01 10:13] |
| `prim/director-only-1`, `prim/director-only-2` | one redacted value each, `spoiler: true` | Real text stays in My Films |

### The six shots

All six are interior, `era: "post"`, ratio 16:9 [PROPOSED, Open item 9], and reference `look/overgrown-interior` [PROPOSED]. The protagonist stays out of frame in every shot, following Open item 7. Beat 1 (the approach, an exterior) and beat 6 ("Sorry, buddy", hands on the battery cover, close to the scene/16 boundary) are left out.

| Id | Label | Shot size | Action | Refs besides the look |
|---|---|---|---|---|
| `s15-welcome` | The welcome | medium, eye level from the doorway [PROPOSED] | The service robot turns to the doorway and welcomes a guest who stays out of frame. [J27 29:41] [A01 08:16] | bot/restaurant, loc/restaurant |
| `s15-room` | The room | wide establishing [PROPOSED] | The service robot works between set tables of dead diners. [J27 30:25] | loc/restaurant, bot/restaurant |
| `s15-pour-wide` | The pour, wide | wide, locked-off (v1 prompt) | The service robot lifts the broken carafe from its tray and walks toward a seated dead diner. [A01 09:13] | bot/restaurant, prop/carafe, loc/restaurant |
| `s15-pour-medium` | The pour, medium | medium (v1 prompt) | The robot leans over the diner's cup and tilts the carafe. Nothing comes out. [J27 30:53] [A01 09:13] | bot/restaurant, prop/carafe, loc/restaurant |
| `s15-pour-close` | The pour, close | close-up on the carafe's mouth above the empty cup (v1 prompt) | The carafe tilts over an empty cup. Nothing comes out. [J27 30:53] | prop/carafe, bot/restaurant |
| `s15-trip` | The trip | wide, low angle [PROPOSED] | The service robot lies fallen beside a cable on the floor, trying to get up. [A01 10:13] | bot/restaurant, prop/cable, loc/restaurant |

Resulting USED BY under the image-gen adapter: every `look/overgrown-interior` value 6, `bot/restaurant.identity` 6, `loc/restaurant.interior` 5, `prop/carafe.identity` 3, `prop/cable.identity` 1, every `world/*` and `voice/*` value 0 (image-gen does not read them; Seedance will).

## 5. Engine

`lib/engine/` imports nothing from React, Next, `fs`, or the rest of the app. An ESLint `no-restricted-imports` rule enforces it. Every function is pure. `renderKey` is async because it uses Web Crypto, which exists in both the browser and Node.

| Function | Does |
|---|---|
| `validate(seed)` | Zod parse, then rules: unique ids; every shot ref exists; no shot refs a `prim/*` group; `spoiler` only on prim; at most one `look/*` ref per shot. Fails loudly with every violation listed. |
| `applyEdits(seed, edits)` | Returns the current state. History is the edit log itself. Rollback appends an edit back to an older value. Reset clears the log. |
| `resolve(shot, state)` | Returns the referenced groups plus `unresolved` ids. An unresolved ref shows as an "unresolved" chip, and the shot does not compose. Nothing is dropped silently. |
| `compose(shot, state, adapter)` | Returns `{ prompt, reads }`. `reads` lists every value path the adapter placed in the prompt. |
| `usage(state, shots, adapter)` | Map from value path to shot ids, built from `reads`. This is the USED BY column. |
| `renderKey(shot, prompt, target)` | `sha256(model | ratio | seed | prompt)`. |

**One-way rule.** Adapters read only semantic and entity groups. Validation rejects a shot that references `prim/*`, so spoiler groups cannot reach any prompt. Tests assert both.

**Staleness.** A shot is fresh when the render map holds an entry for its current `renderKey`. Otherwise it shows its most recent render with a stale badge. No stored dirty flag exists. Rolling a value back restores the old prompt, the old key, and the old render, with no new render.

## 6. Adapters

```ts
interface Adapter {
  id: "image-gen" | "seedance";
  target?: { model: string; ratio: string };  // model names live only here
  compose(shot: Shot, groups: TokenGroup[]): { prompt: string; reads: string[] };
}
```

**image-gen** (phase 1). film-tokens.md Tier 3: "entity paragraph + one look/* token + the signifier line, nothing else". This is Nick's **[HAND]** task: he writes `compose` for this adapter with no agent, as live-coding rehearsal. Tests are written first and check properties: the action line comes first; every prompt-eligible value of every referenced entity and the one look appears exactly once; no `prompt: false` or spoiler value appears; `reads` matches what appears. One exact-output test for `s15-pour-medium` is filled in after Nick picks the order.

Suggested default order: action, entity values in ref order, look values joined with commas, signifier line. With that order, `s15-pour-medium` composes to about 600 characters.

**seedance** (phase 2). Tier 3 rule: Subject (entity values) + Scene (look, world, audio values) + beat line (action only, never restated style). This adapter reads `world/*` and `voice/*`, so their USED BY changes from 0 to 6 when it is active. Shown as text next to the image-gen prompt. No Seedance rendering.

## 7. Storage and renders

- **Seed.** `data/seed/tokens.json` and `data/seed/shots.json`. `validate` runs in a Vitest test and at build time, so an invalid seed fails the build.
- **Browser.** IndexedDB holds the edit log and the render map (`renderKey → { kind: "mock" | "live", url?, prompt, at }`). If IndexedDB is unavailable, for example in a private window, the app runs from memory and shows one line saying edits will not persist.
- **Toolbar.** Reset to seed clears the log. Export JSON downloads the seed with edits applied and history included, ready to commit.
- **First load.** A shot with no entry in the render map gets one automatically: from the Blob cache when a real render exists (phase 2), otherwise from the mock provider, which is free. A first visit therefore opens with six fresh shots.
- **Mock provider** (phase 1, client side). Draws an SVG from the shot's label and shot size and the current look values. Its colour wash is derived from a hash of the look values, so before and after differ visibly. Every mock frame carries a STUB badge.
- **Live route** (phase 2). `POST /api/render { prompt, ratio, seed, model }`.
  1. The server computes `renderKey` itself from the posted fields. It never accepts a key from the client.
  2. If `renders/{renderKey}.png` exists in Vercel Blob, it returns that URL. This makes a shared cache: a visitor on the preview sees any real render Nick already made for the same prompt.
  3. Else, if `RENDER_LIVE=1`, it calls Runway `gen4_image`, polls, downloads the image at once (output URLs expire in 24 to 48 h), stores it in Blob, and returns the URL and `cost.credits`.
  4. Else it returns 403, and the client keeps the mock.
- **Seed per shot.** Derived from the shot id and fixed, so only the token change differs between before and after. Depends on `gen4_image` accepting a seed (unverified).
- **Cost.** Before a live Apply: shots × credits per image, labeled "estimate" until verified.
- **Failure.** The shot keeps its previous image and shows an error badge with a retry button. Retry is manual, because `ASSET.INVALID` failures are billed.

## 8. UI

One page, laid out after the board's three panels.

- **Token table.** TOKEN / VALUE / USED BY, grouped by tier. Proposed values carry a tag. Citations show on hover. `prompt: false` values are greyed. Spoiler rows show "director-only" and cannot be expanded. Clicking a USED BY count highlights those shots.
- **Shot strip.** Six cards: image, ref chips, expandable composed prompt, badges for stale, stub, unresolved and error. Clicking a chip highlights that group in the table.
- **Edit panel.** Opens on a value edit. Shows old → new and "Apply to N shots". After Apply, before and after appear as two labeled rows and stay until dismissed.
- **History drawer** per value: past values with timestamps and a rollback button each.
- **Adapter switch** (phase 2): image-gen, Seedance, or both side by side.
- **Accessibility.** Every action works from the keyboard. Before/after uses rows, so no drag interaction exists. Alt text comes from the shot record: "{shotSize}, {label}: {look id}".
- **Visual direction** is set at build time. `unslop` runs before the UI is built (constraints) and before it is called done (audit). The board wireframe is the layout reference. Checked in Chrome and Safari on the deployed preview.

## 9. Phases

### Phase 1: 4 to 5 h, the checkpoint

1. Scaffold: Next.js (current stable, App Router), TypeScript, Tailwind, Vitest, Zod, the ESLint boundary rule.
2. Seed JSON from section 4, after Nick's review.
3. Engine test-first: validate, applyEdits, resolve, usage, renderKey. Image-gen `compose` is the [HAND] task.
4. Mock SVG provider.
5. UI: table, shot strip, edit → apply → before/after, history and rollback, reset and export.
6. Deploy as an unlisted Vercel preview.

Done when the demo script below runs on the preview URL in Chrome and Safari with no environment variables set.

### Phase 2: 4 to 5 h

1. Verify the `gen4_image` facts in section 11 against Runway's docs before any paid call.
2. Provision a Vercel Blob store. Build `/api/render`, the live gate, the cost estimate, and retry.
3. First real batch: the six shots before and after the demo edit, about 12 images. They land in the Blob cache, so the preview shows real renders.
4. Seedance adapter and the side-by-side view.
5. Weighted budget trim with visible dropped tokens, **only if** a composed prompt exceeds the verified length limit. Otherwise this task is cut.

### Demo script, 20 seconds

- 0:00 to 0:04. The page loads: token table on one side, six Scene 15 stills on the other. `look/overgrown-interior` shows USED BY 6.
- 0:04 to 0:09. Edit `look/overgrown-interior.light` from the seed value to "sodium streetlight through the windows at dusk". The panel shows "Apply to 6 shots".
- 0:09 to 0:15. Apply. The six shots re-render, and the before/after rows fill.
- 0:15 to 0:20. Open the value's history and roll back. All six return at once with no render.

The edit in the demo is an example, not canon. It nods to `world/electricity-in-places`, where pockets of power still run.

## 10. Testing

- **Engine (Vitest):** unknown ref gives `unresolved`; a prim ref fails validation; a spoiler group is unreachable from any shot; image-gen properties from section 6 plus one exact output; `reads` and USED BY counts for the seed match section 4; the key changes when a value in `reads` changes and does not change for any other edit; rollback restores the previous key; export parses through `validate`.
- **Seed:** both files parse, and every shot ref resolves.
- **Route (phase 2):** with `RENDER_LIVE` unset, `/api/render` on a cache miss returns 403 and never calls the provider (provider mocked). A posted key is ignored.
- **UI:** the demo script, by hand, on the deployed preview, in Chrome and Safari. A green build does not count as done.

## 11. Risks and unverified facts

Unverified, all phase 2, checked before any paid call:

1. Credits per `gen4_image` image.
2. The `promptText` length limit.
3. Whether `gen4_image` accepts a seed.
4. Whether reference images are accepted, how many, and whether they take tags (not used in this build, noted for later).
5. Whether any negative prompt field exists. If one does, `world/*` `antiUse` values are a natural source for it.

Risks:

- **Public repo.** The seed quotes Montreal canon (no spoilers) from a film whose own repo is private. Nick chose to keep this repo public (section 12).
- **Blob store on a public link.** Renders are publicly readable by URL. Acceptable for stills of a demo scene; worth knowing.
- **Stills of one scene can look alike.** If the mock wash is too subtle, the before/after beat reads weakly. The mock provider's colour mapping is tuned against the demo edit specifically.

## 12. Review decisions (2026-09-26)

1. **Repo visibility: public.** The seed and this spec quote non-spoiler Montreal canon. Decision 9 still holds: no spoiler text or spoiler-revealing ids, ever.
2. **`look/overgrown-interior`: accepted.** Still open: adding it to film-tokens.md 2b as `[PROPOSED]`, so the source file stays the single source of truth. That edit is in the My Films repo and waits for Nick's go.
3. **The six shots: approved as written in section 4.**

## 13. Out of scope

Auth. Multiple films or projects. Video renders. Parsing film-tokens.md automatically (the seed is a one-time transcription). Entity states such as `bot/restaurant@tripped`. The `era/pre` prop lint, which belongs to build 08. LLM-suggested tokens. Swipe compare.

## 14. Impact on other builds

- **Build 08, Continuity supervisor** planned to live in Film Analyzer and reuse `render-still.ts` and `seeded-errors.json` from the Sep 19 plan. Those no longer exist. Build 08 should import this repo's engine, or move here, and its plan needs updating before it starts.
- **`Runaway/builds/README.md`** still lists build 09 as living in Film Analyzer. A pointer line is added to the old spec. The README itself is not changed without a go.

## 15. File layout

```
app/
  page.tsx
  api/render/route.ts        phase 2
components/                  TokenTable, ShotCard, EditPanel, BeforeAfter, HistoryDrawer
lib/
  engine/                    pure: types, validate, edits, resolve, compose, usage, key
    adapters/                image-gen.ts, seedance.ts (phase 2)
  providers/                 mock.ts, runway.ts (phase 2)
  store/                     idb.ts
data/seed/                   tokens.json, shots.json
```

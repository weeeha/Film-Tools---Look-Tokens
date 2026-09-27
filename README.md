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

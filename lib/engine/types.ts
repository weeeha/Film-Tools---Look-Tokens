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

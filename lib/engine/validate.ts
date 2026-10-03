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

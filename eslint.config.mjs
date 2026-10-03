import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// lib/engine is pure. Bare imports are an allowlist, and source files may not
// import upward out of lib/engine. Tests may also use vitest and load the seed.
function engineBoundary({ files, ignores = [], upward = null, allowed, label }) {
  const patterns = [
    {
      regex: `^(?!(${allowed.join("|")})$)[^.]`,
      message: `lib/engine is pure: bare imports are limited to ${label}.`,
    },
  ];
  if (upward) {
    patterns.push({
      regex: upward,
      message: "lib/engine is pure: source files may not import from outside lib/engine.",
    });
  }
  return { files, ignores, rules: { "no-restricted-imports": ["error", { patterns }] } };
}

const SOURCE = { allowed: ["zod", "@noble/hashes/.+"], label: "zod and @noble/hashes" };

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Files one folder down (lib/engine/adapters): "../.." leaves lib/engine.
  engineBoundary({
    ...SOURCE,
    files: ["lib/engine/**/*.ts"],
    ignores: ["lib/engine/**/*.test.ts"],
    upward: "^\\.\\./\\.\\.(/|$)",
  }),
  // Files directly in lib/engine: one ".." already leaves it. Overrides the block above.
  engineBoundary({
    ...SOURCE,
    files: ["lib/engine/*.ts"],
    ignores: ["lib/engine/*.test.ts"],
    upward: "^\\.\\.(/|$)",
  }),
  engineBoundary({
    files: ["lib/engine/**/*.test.ts"],
    allowed: [...SOURCE.allowed, "vitest"],
    label: "zod, @noble/hashes and vitest",
  }),
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

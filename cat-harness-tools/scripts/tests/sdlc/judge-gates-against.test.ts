/**
 * Every judge-mode gate of bean `oqe3` passes `--against main` in its own
 * package script.
 *
 * A gate in judge mode decides NEW against inherited findings from a baseline.
 * Without `--against` it has no baseline and reports UNKNOWN, which is not
 * gated. So a script missing the flag can never fail on a new finding when it
 * runs locally or through `bun run cat gates`. Before this test,
 * `check:term-mapping`, `check:reference-direction:check` and
 * `check:harness-state:check` all took the flag but none of their scripts
 * passed it. Only the index's CI passed it, and only for reference-direction.
 * This is where to add the next one.
 *
 * @module scripts/tests/judge-gates-against
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PKG = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "..", "package.json"), "utf-8")) as {
  checkoutScripts?: Record<string, string>;
  scripts?: Record<string, string>;
};
const SCRIPTS = { ...PKG.scripts, ...PKG.checkoutScripts };

/** The bean's gates that judge against a `qa-reports` baseline. */
const JUDGE_GATES = [
  "lsi:skills:check",
  "kg:detangle:check",
  "kg:audit:check",
  "kg:audit:all:check",
  "translation:block-qa:check",
  "audit:coverage:require-all",
  "audit:coverage:strict",
  "readme:subgraphs:check",
  "root-scan-census:check",
  "check:viewer-nav",
  "check:term-mapping",
  "check:reference-direction:check",
  "check:harness-state:check",
] as const;

describe("bean oqe3: judge gates name their baseline", () => {
  test.each([...JUDGE_GATES])("%s passes --against main", (gate) => {
    const cmd = SCRIPTS[gate];
    expect(cmd, `${gate} is not a script in cat-harness-tools/package.json`).toBeString();
    expect(cmd!.split(/\s+/).join(" ")).toMatch(/(?:--check|\bcheck\b)/);
    expect(cmd!.split(/\s+/).join(" ")).toContain("--against main");
  });
});

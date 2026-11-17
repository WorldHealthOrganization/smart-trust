/**
 * `partition-names` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/kg/partition-names.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each reads every staged layer's
 * declaration in the checkout, which only the checkout holds. Standing alone,
 * cat-harness has none of it, and `check:cat-harness-standalone` collects
 * every test in that layer. The rest of that file's tests stay there; every
 * path here is composed from ORIGIN_DIR, the directory they were written in,
 * so nothing they read changed.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { REPOS } from "../../scripts/partition/instance-rules.js";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const ROOT = join(ORIGIN_DIR, "..", "..", "..");

/** The `name` a layer declares for itself, or `undefined` if it has no declaration. */
function declaredName(instance: string): string | undefined {
  const path = join(ROOT, instance, `${instance}.json`);
  if (!existsSync(path)) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  const name = (parsed as { name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
}

/**
 * The entries that name a staging layer, narrowed so `instance` is a string.
 *
 * `REPOS.filter(r => r.instance !== undefined)` does NOT narrow the type —
 * TypeScript keeps `string | undefined` through a plain predicate — so every
 * use below would need a `!`, which is an assertion the compiler cannot check
 * and which this file exists to avoid making. One type predicate, used
 * everywhere, is checkable once.
 */
const STAGED = REPOS.filter((r): r is typeof r & { instance: string } => r.instance !== undefined);

describe("every staged target repo agrees with its instance's declaration", () => {
  test.each(STAGED.map((r): [string, string, (typeof STAGED)[number]] => [r.id, r.instance, r]))("%s: `%s` is declared under that name", (_id, _instance, repo) => {
    const declared = declaredName(repo.instance);
    expect(
      declared,
      `REPOS says target \`${repo.id}\` is staged in \`${repo.instance}/\`, but no ` +
        `\`${repo.instance}/${repo.instance}.json\` declares a name. Either the ` +
        `directory moved, or \`instance\` should be dropped because nothing stages ` +
        `this target yet — do not leave it pointing at nothing.`,
    ).toBeDefined();
    expect(
      declared,
      `\`${repo.instance}/\` declares itself \`${declared}\`, which is not ` +
        `\`${repo.instance}\`. The DECLARATION wins: update REPOS[].instance, ` +
        `never the declaration, to match it.`,
    ).toBe(repo.instance);
  });
});

/**
 * The committed bean store holds only states the CLI can produce.
 *
 * Found 2026-09-18 while auditing bean references (#203): one bean carried
 * `status: done`, which is not in the CLI's vocabulary —
 * `draft | todo | in-progress | completed | scrapped`. Nothing rejected it,
 * so it sat in the shared work plan reading as a status while matching none
 * of the filters an agent uses to find work. `beans list --ready` and every
 * status query silently skipped it.
 *
 * The store is committed and read by every sibling session, so a malformed
 * entry is not a local mess — it is a hole in the shared plan.
 *
 * Moved here from `cat-harness/scripts/tests/` (bean `ho66`), as
 * `merge-guard-workflows.test.ts` was: every test in it reads the aggregate
 * repository's own root — the root-declared `beans/` store — which a
 * standalone cat-harness layer does not have, and
 * `check:cat-harness-standalone` collects every test in that layer.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRootFor } from "../../schemas/kg/cat-harness.js";

/** The directory this test was written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

// The `bean-defs` node of the bean graph (schemas/sdlc/bean-graph.ts), not the
// graph root — `beans/` itself holds only `beans.json`.
//
// The REPOSITORY's, reached from this layer. `beans/` is declared
// `scope: "repository"` because the work plan belongs to the checkout rather
// than to any layer in it; `"../../beans/defs"` was written when the two
// roots were one directory, and after the move it named a path that has never
// existed — so `beanFiles()` returned `[]` and every hygiene assertion below
// passed over an empty set. The emptiness guard is the only reason that was
// visible at all, which is what it is for.
const BEANS = join(repoRootFor(join(ORIGIN_DIR, "../..")), "beans/defs");

/** Exactly what `beans update --status` accepts. */
const VALID = new Set(["draft", "todo", "in-progress", "completed", "scrapped"]);

function beanFiles(): string[] {
  if (!existsSync(BEANS)) return [];
  // `README.md` is the directory's own page, written by `readme:subgraphs`
  // since `bean-defs` became a resolved declared directory (#2094). It is not
  // a bean, and the `beans` CLI does not read it as one.
  return readdirSync(BEANS).filter((f) => f.endsWith(".md") && f !== "README.md");
}

describe("bean store hygiene", () => {
  test("the store is not empty — otherwise these tests prove nothing", () => {
    // A guard against the suite passing because it found no beans to check.
    expect(beanFiles().length).toBeGreaterThan(10);
  });

  test("every bean's status is one the CLI can produce", () => {
    const bad: string[] = [];
    for (const f of beanFiles()) {
      const m = readFileSync(join(BEANS, f), "utf-8").match(/^status:\s*(.+)$/m);
      if (!m) {
        bad.push(`${f}: no status line`);
        continue;
      }
      const status = m[1].trim();
      if (!VALID.has(status)) bad.push(`${f}: "${status}"`);
    }
    expect(bad).toEqual([]);
  });

  test("every bean has a title", () => {
    const untitled = beanFiles().filter(
      (f) => !/^title:\s*\S/m.test(readFileSync(join(BEANS, f), "utf-8")),
    );
    expect(untitled).toEqual([]);
  });
});

/**
 * `check-bean-parents` tests that read the aggregate repository's own root —
 * the root-declared `beans/` store — moved here from
 * `cat-harness/scripts/tests/check-bean-parents.test.ts` (bean `ho66`), as
 * `merge-guard-workflows.test.ts` was: a standalone cat-harness layer has no
 * such root, and `check:cat-harness-standalone` collects every test in that
 * layer. The rest of that file's tests stay there.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { checkBeanParents } from "../../scripts/check-bean-parents.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";

/**
 * The directory this test was written in (`cat-harness/scripts/tests/`): every path below
 * is composed from it exactly as it was before the move, so nothing it reads changed.
 */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("every open bean belongs to an epic", () => {

  test("the real corpus passes", () => {
    const r = checkBeanParents(repoRootFor(join(ORIGIN_DIR, "../..")));
    expect({ orphans: r.problems }).toEqual({ orphans: [] });
    // The real corpus was FOUND and READ, not passed vacuously. This was
    // `r.open > 50`, a floor that held the count of one day's corpus and broke
    // when beans were closed. The same guarantee, independent of how many
    // beans are open: the store resolved, it holds open work, and the check
    // counted every open non-root bean in it — tallied here straight from the
    // files' front matter, not through the reader the check itself uses.
    expect(r.store).not.toBeNull();
    const independent = readdirSync(r.store!)
      .filter((n) => n.endsWith(".md"))
      .map((n) => /^---\n([\s\S]*?)\n---/.exec(readFileSync(join(r.store!, n), "utf-8"))?.[1])
      .filter((fm): fm is string => fm !== undefined)
      .filter((fm) => /^status:\s*["']?(?:todo|in-progress)["']?\s*$/m.test(fm))
      .filter((fm) => !/^type:\s*["']?(?:milestone|epic)["']?\s*$/m.test(fm)).length;
    expect(independent).toBeGreaterThan(0);
    expect(r.open).toBe(independent);
  });
});

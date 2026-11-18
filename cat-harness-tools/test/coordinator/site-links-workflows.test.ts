/**
 * `site-links` tests that read the aggregate repository's own root —
 * `.github/workflows/docs-site.yml` — moved here from
 * `cat-harness-tools/scripts/tests/ui/site-links.test.ts` (bean `ho66`), as
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
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRootFor } from "../../schemas/kg/cat-harness.ts";

/**
 * The directory this test was written in (`cat-harness/scripts/tests/`): every path below
 * is composed from it exactly as it was before the move, so nothing it reads changed.
 */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

describe("both publishing workflows check their own tiles", () => {
  const ROOT = join(ORIGIN_DIR, "..", "..");

  test("`docs-site.yml` and `feature-staging.yml` each verify the links", () => {
    // Missing it in ONE workflow is the worse failure. Both publish the same
    // tiles, so a gate on only the production site leaves the branches/
    // preview — the place a reviewer actually checks — free to ship a dead
    // knowledge-graph tile while main stays green. Same argument the QA
    // witness copy already carries, and the same shape of test.
    for (const wf of ["docs-site.yml", "feature-staging.yml"]) {
      const text = readFileSync(join(repoRootFor(ROOT), ".github", "workflows", wf), "utf-8");
      // Asserted as two facts rather than one exact command line: that the
      // checker RUNS, and that it is pointed at the built site. Pinning the
      // whole string made this fail when `--root ./cat-harness` was added —
      // a correct change, rejected for the shape of its argument list.
      expect(text).toContain("scripts/site-links.ts");
      expect(text).toContain("--site ./_site");
    }
  });
});

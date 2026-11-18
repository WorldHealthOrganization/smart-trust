/**
 * `qa-results` tests that read the aggregate repository's own root —
 * `.github/workflows/docs-site.yml` — moved here from
 * `cat-harness/scripts/tests/qa-results.test.ts` (bean `ho66`), as
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
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRootFor } from "../../schemas/kg/cat-harness.js";

/** The directory this test was written in (`cat-harness-tools/scripts/tests/`): every path below is composed from it exactly as it was before the move to the checkout's test home (bean `7zz1`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness-tools/scripts/tests");

const ROOT = join(ORIGIN_DIR, "..", "..");

describe("the witnesses are committed in one place and published in another", () => {

  it("BOTH publishing workflows copy them into the site", () => {
    // The failure this exists to prevent is silent and asymmetric. Jekyll
    // builds only `docs/`, so a workflow missing this copy publishes a site
    // where every `data-qa-src` 404s — and an empty QA panel looks exactly
    // like "nothing has been audited", which is the false pass the badges
    // were built to remove. Missing it in ONE workflow is worse still: the
    // docs site and the staging preview would disagree, and the preview is
    // where a reviewer checks.
    for (const wf of ["docs-site.yml", "feature-staging.yml"]) {
      const text = readFileSync(join(repoRootFor(ROOT), ".github", "workflows", wf), "utf-8");
      // Two facts rather than one command line: `-T` so the CONTENTS land in
      // `assets/qa/`, and the destination both workflows must agree on. The
      // SOURCE path moved with the layer and is not what this is about —
      // pinning the whole string made it fail on a correct relocation, the
      // same way `site-links.test.ts` did an hour earlier.
      expect(text).toContain("cp -rT ");
      expect(text).toContain("test/results/witnesses ./_site/assets/qa");
      // The RESULTS too, since bean `2634` took the findings out of the
      // published graph: this file is now the only place a consumer can see
      // what the QA pass found about the document it just fetched.
      expect(text).toContain("*.qa-results.json");
    }
  });
});

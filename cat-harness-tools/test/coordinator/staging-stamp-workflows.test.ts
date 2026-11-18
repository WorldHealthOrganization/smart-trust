/**
 * `staging-stamp` tests that read the aggregate repository's own root —
 * `.github/workflows/feature-staging.yml` — moved here from
 * `cat-harness-tools/scripts/tests/sdlc/staging-stamp.test.ts` (bean `ho66`), as
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

describe("the workflow no longer stamps out of band", () => {
  it("feature-staging.yml does not rewrite the export after writing it", () => {
    const wf = readFileSync(join(repoRootFor(ROOT), ".github", "workflows", "feature-staging.yml"), "utf-8");
    // The inline rewrite reached the JSON-LD and nothing else. If it comes
    // back, the schema documents go unstamped again and the two stamps can
    // disagree.
    expect(wf).not.toMatch(/d\.staging\s*=/);
  });
});

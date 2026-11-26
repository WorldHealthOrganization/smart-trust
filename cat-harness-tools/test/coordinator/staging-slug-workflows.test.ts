/**
 * `staging-slug` tests that read the aggregate repository's own root —
 * `.github/workflows/feature-staging.yml` — moved here from
 * `cat-harness-tools/scripts/tests/sdlc/staging-slug.test.ts` (bean `ho66`), as
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
import { join, resolve } from "node:path";

import { repoRootFor } from "../../schemas/kg/cat-harness.js";

/**
 * The directory this test was written in (`cat-harness/scripts/tests/`): every path below
 * is composed from it exactly as it was before the move, so nothing it reads changed.
 */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const REPO = repoRootFor(resolve(ORIGIN_DIR, "..", ".."));
const WORKFLOW = join(REPO, ".github", "workflows", "feature-staging.yml");

describe("the sanitiser, run rather than described", () => {
  test("it is the SAME pipeline the workflow runs — or this whole file is fiction", () => {
    // The literal above is copied. If the workflow's changes, this fails here
    // rather than leaving these tests quietly measuring something else.
    const yml = readFileSync(WORKFLOW, "utf-8");
    expect(yml).toContain(`sed 's|[^a-zA-Z0-9._-]|-|g'`);
    expect(yml).toContain(`sed 's|--*|-|g'`);
  });
});

/**
 * `checks` tests that read the aggregate repository's own root —
 * `.github/workflows/feature-staging.yml` — moved here from
 * `cat-harness/test/health/checks.test.ts` (bean `ho66`), as
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
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";

import { describe, expect, it } from "bun:test";

import { stagingSlug } from "../health/checks.ts";

/**
 * The directory this test was written in (`cat-harness/test/health/`): every path below
 * is composed from it exactly as it was before the move, so nothing it reads changed.
 */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/test/health");

describe("staging-preview-orphans", () => {

  it("agrees with `feature-staging.yml`'s own sed pipeline, branch for branch", () => {
    // A CHECKED duplication, in the idiom `check:harness-dirs` uses for
    // `.beans.yml`: the rule is written in sed inside the workflow and in
    // TypeScript here, and it cannot be written once because one runs in a
    // shell step and the other in this process. What can be avoided is an
    // UNCHECKED duplication — a drift here would make the orphan check name
    // the wrong preview, on a finding whose action invites removal.
    const wf = readFileSync(resolve(repoRootFor(resolve(ORIGIN_DIR, "..", "..")), ".github/workflows/feature-staging.yml"), "utf-8");
    const pipelines = [...wf.matchAll(/SLUG=\$\(echo "\$BRANCH" \| (.+)\)$/gm)].map((m) => m[1]);
    // Both occurrences, so a fix applied to one of them is caught.
    expect(pipelines.length).toBeGreaterThanOrEqual(2);
    expect(new Set(pipelines).size).toBe(1);

    for (const branch of [
      "claude/health-checks",
      "feat/a//b",
      "-lead-and-trail-",
      "release/v1.2.3",
      // ASCII only, deliberately: `sed`'s `[^a-zA-Z0-9._-]` is byte-oriented
      // or character-oriented depending on the locale, so a non-ASCII branch
      // name would make this test's verdict a fact about `LC_ALL` rather than
      // about either implementation. A failure nobody can act on is worse
      // than a gap.
      "a__b--c",
    ]) {
      const r = spawnSync("bash", ["-c", `echo "$1" | ${pipelines[0]}`, "_", branch], { encoding: "utf-8" });
      expect(r.status).toBe(0);
      expect(stagingSlug(branch)).toBe(r.stdout.trim());
    }
  });
});

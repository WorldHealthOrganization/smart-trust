/**
 * `merge-guard.ts`'s deploy-only step, held against the staging workflow (bean `gnnj`).
 *
 * Check 5 does not refuse a Feature Staging run whose ONLY failed step is
 * `DEPLOY_ONLY_STEP`, so that string must be the name of the deploy step the
 * workflow really runs: renamed there and not here, the exemption would
 * silently stop matching and every give-up would block merges again. It lives
 * here rather than in `cat-harness-tools/scripts/tests/sdlc/merge-guard.test.ts` because a
 * standalone cat-harness layer has no workflows, and
 * `check:cat-harness-standalone` collects every test in that layer.
 *
 * Check 5's dispatch parser joined it on 2026-10-06 for the same reason: it
 * is held against today's `merge-main.yml` (bean `ho66`).
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

import { DEPLOY_ONLY_STEP, parseMergeMainDispatches } from "../../scripts/merge-guard.ts";

/** The directory this test was written in (`cat-harness-tools/scripts/tests/`): every path below is composed from it exactly as it was before the move to the checkout's test home (bean `7zz1`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness-tools/scripts/tests");


const ROOT = join(ORIGIN_DIR, "..", "..", "..");

test("the deploy-only step name is the one the staging workflow runs", () => {
  const wf = readFileSync(join(ROOT, ".github/workflows/feature-staging.yml"), "utf8");
  expect(wf).toContain(`- name: ${DEPLOY_ONLY_STEP}\n`);
});

/** What today's `merge-main.yml` dispatches — the same fixed list `merge-guard.test.ts` judges its fixtures against. */
const DISPATCHED = ["code-quality-gates.yml", "jsonld-gen-check.yml"] as const;

describe("check 5 — a held run on a bot-merged head is judged by its dispatch", () => {
  test("parseMergeMainDispatches reads today's merge-main.yml, and refuses a line it cannot read", () => {
    const yml = readFileSync(join(ROOT, ".github", "workflows", "merge-main.yml"), "utf8");
    expect(parseMergeMainDispatches(yml)).toEqual([...DISPATCHED]);
    expect(parseMergeMainDispatches('for wf in a.yml b.yml; do\n  gh workflow run "$wf" --ref x\ndone')).toEqual(["a.yml", "b.yml"]);
    expect(parseMergeMainDispatches('for wf in $WORKFLOWS; do gh workflow run "$wf"; done')).toBeUndefined();
    expect(parseMergeMainDispatches("gh workflow run code-quality-gates.yml")).toBeUndefined();
  });
});

/**
 * A gate must be able to PASS on every event its workflow declares.
 *
 * Issue #823, bean `sddf`. `code-quality-gates.yml` declares four triggers —
 * `pull_request`, `merge_group`, `push` and `workflow_dispatch` — and one of
 * its steps read `CATALOGUE_BASE_SHA: ${{ github.event.pull_request.base.sha }}`.
 * Outside a pull-request event that is the empty string, and the fallback then
 * ran a three-dot range against an `origin/main` the same fetch had just
 * created as a shallow graft. A shallow graft has no merge base, so the script
 * exited 2 — "could not determine" — on every dispatched run.
 *
 * ## Why that is a trap rather than a nuisance
 *
 * `check-head-has-run.ts` tells an operator to dispatch this workflow when a
 * head has no run. So following the repository's own advice attached a red
 * HARD gate to a pull request that had not earned it, and the red is
 * indistinguishable at a glance from one the branch caused.
 *
 * Measured on #1633, 2026-10-01: run 36789391040, `workflow_dispatch`,
 * `Repository gates (hard)` the ONLY red among twelve checks. The branch was
 * green; the advice was not.
 *
 * ## The general rule, which is what this file tests
 *
 * The specific fix is one `--base`. The rule it belongs to is: **a step whose
 * input comes from one event's payload must say what it does on the others**,
 * because a workflow that declares a trigger is promising that trigger can
 * succeed. So the second test does not look for `--base` at all — it finds
 * every env var fed from `github.event.pull_request.*` and asserts the step
 * branches on it being empty.
 *
 * **And that second test is the weaker one — measured, not assumed.** Run
 * against the pre-fix workflow it PASSES, because the broken version did
 * branch on `-n "$CATALOGUE_BASE_SHA"`; it branched to a fallback that could
 * not succeed. Only the two specific tests above fail there (2 of 4). So the
 * general test catches "no branch at all", never "a branch that cannot work" —
 * which is the defect that actually shipped. It is kept because the absent
 * branch is a real and cheaper-to-catch failure, not because it would have
 * caught this one. Proving a fallback CAN pass needs the event, which is CI's
 * job, not a unit test's.
 *
 * Moved here from `cat-harness/scripts/tests/` (bean `ho66`), as
 * `merge-guard-workflows.test.ts` was: every test in it reads the aggregate
 * repository's own root — `.github/workflows/code-quality-gates.yml` — which a
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
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** The directory this test was written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const REPO = resolve(ORIGIN_DIR, "..", "..", "..");
const WF = join(REPO, ".github", "workflows", "code-quality-gates.yml");
const text = (): string => readFileSync(WF, "utf-8");

describe("the catalogue gate can pass on a non-pull_request event", () => {
  test("the no-base branch names a base instead of falling back to three dots", () => {
    const wf = text();
    // The fix: deepen until a merge base exists, then pass it. `--base` is the
    // script's two-dot path, which needs no merge base of its own.
    expect(wf).toContain('bun run cat translation:catalogue:check -- --base "$base"');
    expect(wf).toContain("git merge-base origin/main HEAD");
    // And in that order, with no catalogue run between them: the base is
    // found FIRST and then handed over, so the no-base branch never reaches a
    // call that falls back to the script's own three-dot range.
    const found = wf.indexOf("git merge-base origin/main HEAD");
    const passed = wf.indexOf('bun run cat translation:catalogue:check -- --base "$base"');
    expect(found).toBeLessThan(passed);
    expect(wf.slice(found, passed)).not.toContain("translation:catalogue:check");
  });

  test("a base that still cannot be found stays exit 2, never a pass", () => {
    const wf = text();
    // `dh4f`. The one thing this path must not do is turn "I could not look"
    // into "nothing is wrong" — which is exactly what making it exit 0 would
    // do, and is the tempting way to make a dispatched run go green.
    const idx = wf.indexOf("no merge base against origin/main after deepening");
    expect(idx, "the could-not-determine message is gone").toBeGreaterThan(-1);
    expect(wf.slice(idx, idx + 200)).toContain("exit 2");
  });

  test("every trigger the workflow declares is still declared", () => {
    // The lazy fix for "a dispatch cannot pass" is to stop accepting
    // dispatches. That would remove the remedy `check-head-has-run` points at
    // and leave a head with no run unreachable, so it is refused here.
    const wf = text();
    for (const t of ["pull_request:", "merge_group:", "workflow_dispatch:"]) {
      expect(wf, `${t} was removed rather than made to work`).toContain(t);
    }
  });
});

describe("the general rule: a pull_request-only input declares its other events", () => {
  test("each env var fed from github.event.pull_request.* is branched on", () => {
    const wf = text();
    // e.g. `CATALOGUE_BASE_SHA: ${{ github.event.pull_request.base.sha }}`
    const re = /^\s*([A-Z_][A-Z0-9_]*):\s*\$\{\{\s*github\.event\.pull_request\./gm;
    const names = [...wf.matchAll(re)].map((m) => m[1]!);
    // If this ever finds nothing the test is vacuous, which is its own defect.
    expect(names.length, "no pull_request-fed env var found — has the shape changed?").toBeGreaterThan(0);
    for (const n of new Set(names)) {
      const branched = wf.includes(`-n "$${n}"`) || wf.includes(`-z "$${n}"`);
      expect(
        branched,
        `${n} comes from the pull_request payload but no step branches on it being empty, ` +
          `so a workflow_dispatch or merge_group run gets "" and cannot pass`,
      ).toBe(true);
    }
  });
});

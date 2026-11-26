/**
 * `.gitattributes` — `-merge` may only cover a file its producer OWNS OUTRIGHT.
 *
 * Bean `oxka`. Three generated files conflicted on nearly every concurrent merge
 * (106, 45 and 18 commits in three days), so they are marked
 * `linguist-generated=true -diff -merge`: git stops attempting a line-by-line
 * merge on a file no human edits, and GitHub collapses it in review.
 *
 * ## The line this file exists to hold
 *
 * The test of whether a file belongs there is **not** "is it generated" — it is
 * **"does its producer carry anything forward from the existing file"**.
 *
 * `kg-audit` reads its prior judgements back (`readAttestations`), so the
 * file holding them carries adjudications an earlier run or a person recorded.
 * `-merge` on one would discard an attestation with nothing said. Since bean
 * `2gst` that file is the attestation store (`test/attestations/kg-qa/`), not
 * the `kg-qa` sidecar — and BOTH stay textually mergeable here. 840 generated
 * files live under `test/results/`, which makes a glob there the obvious and
 * wrong widening — and the reason this test exists rather than a comment.
 *
 * Moved here from `cat-harness/scripts/tests/` (bean `ho66`), as
 * `merge-guard-workflows.test.ts` was: every test in it reads the aggregate
 * repository's own root — `.gitattributes` and the CI workflow that gates it —
 * which a standalone cat-harness layer does not have, and
 * `check:cat-harness-standalone` collects every test in that layer.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 *
 * ## The `test/results/` entries are retired (bean `7mwa`)
 *
 * cat-harness (cat-harness#857) and folio-assistant-core
 * (folio-assistant-core#482) no longer commit `test/results/`: the derived
 * verdicts live on the `qa-reports` store, keyed by commit. A path that is not
 * committed cannot conflict, so the `oxka` entry for
 * `audit-coverage.qa-results.json`, the `eqxp` entry for the `lsi-index` run
 * record, the two refused `eqxp` candidates and the "no glob over the results
 * tree" rule are gone from here (owner, 2026-11-01: "A. Retire in that tools
 * PR"). What stays is what is still committed: the generated pages marked
 * `-merge`, and the attestation store and `harness.json`, which must not be.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** The directory this test was written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const REPO = resolve(ORIGIN_DIR, "..", "..", "..");
const ATTRS = join(REPO, ".gitattributes");

/** What git itself resolves for a path — not what the file appears to say. */
function mergeAttr(path: string): string {
  const out = execFileSync("git", ["check-attr", "merge", "--", path], { cwd: REPO, encoding: "utf-8" });
  return out.trim().split(": ").pop() ?? "";
}

describe(".gitattributes exists and is read by git", () => {
  test("the high-churn generated files are marked", () => {
    expect(existsSync(ATTRS)).toBe(true);
    for (const p of [
      // The English glossary page under the page locale since 2026-10-16
      // (owner, "c"), and at its old address for branches still carrying it.
      "cat-harness/docs/en/folio-assistant-core/glossary/index.md",
      "cat-harness/docs/folio-assistant-core/glossary/index.md",
      "cat-harness/docs/cat-harness/auto-docs/index/index.html",
      // Added 2026-09-27, bean `5gqn`. Rewritten whole by `gen-docs-pages.ts`; reads
      // nothing back and is gated by `docs:pages:check`.
      "cat-harness/docs/assets/beans/index.json",
    ]) {
      // Asked of GIT, not matched against the file's text: a pattern that looks
      // right and does not apply is the failure mode this guards.
      expect(mergeAttr(p), `${p} is not marked -merge`).toBe("unset");
    }
  });
});

describe("a file whose producer reads it back is NOT marked", () => {
  test("the attestation store stays textually mergeable", () => {
    // `readAttestations` in `kg-audit.ts` is the fact. If that ever stops
    // being true this test should be revisited deliberately, not deleted
    // because it became inconvenient.
    const audit = readFileSync(join(REPO, "cat-harness-tools", "scripts", "kg-audit.ts"), "utf-8");
    expect(audit, "kg-audit no longer reads its attestations back — re-examine this rule").toContain("readAttestations");
    for (const p of [
      // The judgement half (bean `2gst`) — the file that must never be `-merge`.
      "cat-harness/test/attestations/kg-qa/processes/ci-health-watch.attestations.json",
    ]) {
      expect(mergeAttr(p), `${p} is marked -merge, which would discard an attestation`).not.toBe("unset");
    }
  });

  test("`harness.json` stays textually mergeable because its producer carries state forward", () => {
    // Bean `5gqn`. `sync-docs-harness.ts:173-185` (and lines 220-240) carries
    // the previous repo URL forward when git remote is unknown, so marking it
    // `-merge` would discard a carried-forward URL silently in the one case
    // where nothing else can supply it.
    expect(
      mergeAttr("cat-harness/docs/_data/harness.json"),
      "cat-harness/docs/_data/harness.json is marked -merge, but sync-docs-harness carries previous state forward",
    ).not.toBe("unset");
  });
});

describe("every -merge path is gated in CI", () => {
  test("each path git marks -merge has its covering gate named in CI", () => {
    // This is what makes the whole entry safe rather than clever. The files
    // are covered by `check:glossary`, `auto:docs:check` and
    // `docs:pages:check`, so taking the wrong side cannot ship. (The gates of
    // the retired `test/results/` entries, `audit:coverage:require-all` and
    // `lsi:skills:check`, guarded files nobody commits now; bean `7mwa`.)
    const wf = readFileSync(join(REPO, ".github", "workflows", "code-quality-gates.yml"), "utf-8");
    const gateOf: Record<string, string> = {
      "cat-harness/docs/en/folio-assistant-core/glossary/index.md": "check:glossary",
      "cat-harness/docs/folio-assistant-core/glossary/index.md": "check:glossary",
      "cat-harness/docs/cat-harness/auto-docs/index/index.html": "auto:docs:check",
      "cat-harness/docs/assets/beans/index.json": "docs:pages:check",
    };
    for (const [p, gate] of Object.entries(gateOf)) {
      // Each path really is `-merge` (asked of git), so its gate is load-bearing.
      expect(mergeAttr(p), `${p} is not marked -merge`).toBe("unset");
      expect(wf, `${gate} is not in CI, so ${p}, marked -merge, is unguarded`).toContain(gate);
    }
  });
});

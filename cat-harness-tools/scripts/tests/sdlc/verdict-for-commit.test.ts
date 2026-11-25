/**
 * `verdictForCommit` — was the check set COMPLETE, not just clean?
 *
 * @module scripts/tests/verdict-for-commit
 *
 * Issue #1646, bean `6lre`. `ci:watch` reported `PASS — 1 check(s) completed
 * clean`, exit 0, twice on 2026-09-30, against `total_count: 1`, while thirteen
 * checks ran on neighbouring commits of the same branch. The second time the
 * owner had authorised merging on a verified green, so the tool would have
 * merged an unverified tree.
 *
 * ## Why these fixtures are synthetic, and why the LIVE reproduction could not be
 *
 * The two real heads (`29b10a68923`, `0d714756f3d`) **cannot be replayed**. Both
 * were PR heads when they failed; the PR has merged, so `mergeStateForHead` now
 * answers `not-a-pr-head`, the owed event becomes `push`, and the one
 * push-triggered workflow did run. Re-running the fixed tool against them
 * correctly reports `pass`. Measured 2026-09-30 18:45 — so the historical shape
 * is gone and only a fresh push can produce it live.
 *
 * That is why the precedence is pinned here rather than only demonstrated: a
 * live check that can only be performed in a ten-second window after a push is
 * not a regression test.
 *
 * ## What must not drift
 *
 * The four states stay four, and a would-be `pass` is the ONLY one re-examined.
 * Re-deciding `fail` would let a completeness question soften a real failure —
 * the collapse #1624 was written to stop, arriving from the other direction.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import {
  verdictForCommit,
  verdictOf,
  type CheckRun,
  type OwedSummary,
} from "../../../src/workflow/check-verdict.js";

const done = (name: string, conclusion: string): CheckRun => ({ name, status: "completed", conclusion });
const clean = verdictOf([done("a", "success")]);
const satisfied: OwedSummary = { missing: [], unreadable: 0 };

describe("a would-be pass is the only state re-examined", () => {
  test("a FAILURE is returned untouched — a completeness question never softens it", () => {
    const failed = verdictOf([done("a", "failure")]);
    expect(verdictForCommit(failed, undefined, undefined)).toEqual(failed);
    expect(verdictForCommit(failed, satisfied, "conflicted").state).toBe("fail");
  });

  test("pending and undetermined pass through unchanged", () => {
    const pending = verdictOf([{ name: "a", status: "in_progress", conclusion: null }]);
    expect(verdictForCommit(pending, undefined, undefined)).toEqual(pending);
    const empty = verdictOf([]);
    expect(verdictForCommit(empty, undefined, undefined)).toEqual(empty);
  });
});

describe("the defect: a clean PARTIAL set is not a pass", () => {
  test("a required workflow with no run refuses, and NAMES it", () => {
    const v = verdictForCommit(clean, { missing: ["Code-quality gates"], unreadable: 0 }, "mergeable");
    expect(v.state).toBe("undetermined");
    expect(v.names).toContain("Code-quality gates");
    expect(v.because).toContain("partial check set");
  });

  test("the complete set passes, and says so", () => {
    const v = verdictForCommit(clean, satisfied, "mergeable");
    expect(v.state).toBe("pass");
    expect(v.because).toContain("every workflow owed for this event ran");
  });

  test("`not-a-pr-head` is a normal state, not a finding", () => {
    // Watching a `main` commit: `pull_request` workflows are not owed, so the
    // caller scans `push` triggers and a satisfied set is a real pass.
    expect(verdictForCommit(clean, satisfied, "not-a-pr-head").state).toBe("pass");
  });
});

describe("a conflicted head gets its own story, not the generic one", () => {
  test("it refuses, and says the checks will NEVER arrive", () => {
    const v = verdictForCommit(clean, satisfied, "conflicted");
    expect(v.state).toBe("undetermined");
    // Bean `52cz`. "Slow" and "never going to run" are different instructions.
    expect(v.because).toContain("CONFLICTED");
    expect(v.because).toContain("52cz");
    expect(v.because).not.toContain("partial check set");
  });

  test("NO runs on a conflicted head gets the conflict story too — re-told, not re-decided", () => {
    // `ci:watch --pr 1677`, 2026-09-30: REST said `dirty`, and the tool printed
    // the generic "no check runs". Still undetermined; only the story changes.
    const empty = verdictOf([]);
    const v = verdictForCommit(empty, undefined, "conflicted");
    expect(v.state).toBe("undetermined");
    expect(v.because).toContain("CONFLICTED");
    expect(v.because).toContain("no check has run");
    // Without the conflict, the generic story stands.
    expect(verdictForCommit(empty, undefined, "mergeable")).toEqual(empty);
  });

  test("conflicted is checked BEFORE missing, so the better message wins", () => {
    // A conflicted head has no pull_request runs, so `missing` would also fire.
    const v = verdictForCommit(clean, { missing: ["Code-quality gates"], unreadable: 0 }, "conflicted");
    expect(v.because).toContain("CONFLICTED");
  });
});

describe("could-not-determine is never green (bean `dh4f`)", () => {
  test("an unscanned tree is not a satisfied required set", () => {
    const v = verdictForCommit(clean, undefined, "mergeable");
    expect(v.state).toBe("undetermined");
    expect(v.because).toContain("not scanned");
  });

  test("an unprobed merge state is not a mergeable one", () => {
    const v = verdictForCommit(clean, satisfied, undefined);
    expect(v.state).toBe("undetermined");
    expect(v.because).toContain("not probed");
  });

  test("an unreadable workflow file means the required set is NOT established", () => {
    // `TriggerScan` says this in its own docblock: while any file is unreadable
    // the `required` list is incomplete, so an empty `missing` proves nothing.
    const v = verdictForCommit(clean, { missing: [], unreadable: 2 }, "mergeable");
    expect(v.state).toBe("undetermined");
    expect(v.because).toContain("could not be read");
  });
});

describe("nothing here reconciles anything", () => {
  test("the module IMPORTS nothing — the inputs are given, not fetched", () => {
    // Resolved from THIS file, not from the working directory: a path
    // written from the checkout root ("cat-harness/src/…") names nothing when
    // cat-harness runs alone, where the working directory is the layer itself
    // (`check:cat-harness-standalone`). The module read is unchanged.
    return Bun.file(join(import.meta.dir, "../../../src/workflow/check-verdict.ts"))
      .text()
      .then((src) => {
        // Two earlier designs for #1646 were wrong: one did not work, the other
        // duplicated `check:head-has-run`. A scan or a fetch appearing here is
        // the second mistake returning.
        //
        // ASSERTED ON THE IMPORTS, not on substrings. A first draft of this test
        // grepped for `scanTriggers` and failed on the docblock that explains
        // scanTriggers is the caller's job — "a docblock that documents a tag
        // necessarily contains the tag", which this repository has already paid
        // for once in `audit:coverage`.
        const imports = src.split("\n").filter((l) => /^\s*import\b/.test(l));
        expect(imports).toEqual([]);
        // ...and no runtime reach-out, wherever it might hide.
        expect(src).not.toMatch(/\bawait\s+fetch\s*\(/);
        expect(src).not.toMatch(/\brequire\s*\(/);
      });
  });
});

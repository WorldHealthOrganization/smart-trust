/**
 * The unattended sweep's verdict — is a head with runs that never RAN clean?
 *
 * Bean `1acg`. `check:prs-have-runs` asked "is there a run on this head", and
 * a `pull_request` run that completes `action_required` is one: created, never
 * started, no job run, no gate evaluated. So the sweep whose whole purpose is
 * that **a pull request with zero checks is invisible because nobody is
 * looking** marked two such heads `✓ has-run` and returned `clean`.
 *
 * Measured 2026-10-03 on #1819 (`9c3d0efad8f`) and #1808 (`ead7c138ab9`):
 * three `pull_request` runs each, every one `action_required`.
 *
 * These tests pin the FOURTH state. `blocked` must be a finding, must not be
 * folded into `no-run` (whose remedy is the opposite), and must not reappear
 * as `has-run` the moment somebody simplifies the classifier.
 *
 * @module scripts/tests/prs-have-runs
 */
import { describe, expect, test } from "bun:test";

import { type PrRow, render, verdictFor } from "../check-prs-have-runs.js";

const row = (state: PrRow["state"], number = 1): PrRow => ({
  number,
  title: `PR ${number}`,
  sha: "0".repeat(40),
  headAt: "2026-10-03T00:00:00Z",
  state,
  detail: state === "blocked" ? "3 run(s), none executed" : undefined,
});

describe("verdictFor — blocked is a finding", () => {
  test("a head whose runs all failed to execute is NOT clean", () => {
    // The defect in one assertion: this returned `clean` before bean `1acg`.
    expect(verdictFor([row("blocked")])).toBe("findings");
  });

  test("an executed run is still clean, so the fix discriminates", () => {
    expect(verdictFor([row("has-run")])).toBe("clean");
  });

  test("blocked beside a clean head still makes the sweep a finding", () => {
    expect(verdictFor([row("has-run", 1), row("blocked", 2)])).toBe("findings");
  });

  test("`unknown` still outranks a blocked finding", () => {
    // Same rule as `ci-health` and the repository health sweep: a sweep blind
    // on one pull request has not cleared the others.
    expect(verdictFor([row("blocked", 1), row("unknown", 2)])).toBe("unknown");
  });

  test("a too-new head is not a finding, blocked or otherwise", () => {
    expect(verdictFor([row("too-new")])).toBe("clean");
  });

  test("no rows at all is not a finding — there was nothing to judge", () => {
    expect(verdictFor([])).toBe("clean");
  });
});

describe("render — the blocked section says what to do and what NOT to", () => {
  const out = (rows: PrRow[]) => render(rows, { minAge: 15 });

  test("blocked heads get their own section, not the `no run` one", () => {
    const s = out([row("blocked")]);
    expect(s).toContain("whose runs EXIST and did not execute");
    expect(s).not.toContain("## 1 with no run");
  });

  test("it forbids clearing them by dispatch — that is what masked this", () => {
    const s = out([row("blocked")]);
    expect(s).toContain("Do NOT dispatch these to clear them");
    expect(s).toContain("#1829");
  });

  test("the run count is carried through, so `existed` is visible", () => {
    expect(out([row("blocked")])).toContain("3 run(s), none executed");
  });

  test("a no-run head keeps its own advice, unchanged", () => {
    const s = out([row("no-run")]);
    expect(s).toContain("with no run");
    expect(s).not.toContain("whose runs EXIST and did not execute");
  });

  test("both kinds together produce both sections", () => {
    const s = out([row("no-run", 1), row("blocked", 2)]);
    expect(s).toContain("with no run");
    expect(s).toContain("whose runs EXIST and did not execute");
  });

  test("a clean sweep names neither — an empty section would read as a finding", () => {
    const s = out([row("has-run")]);
    expect(s).not.toContain("whose runs EXIST and did not execute");
    expect(s).not.toContain("## 1 with no run");
  });
});

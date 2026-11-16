/**
 * `tool-coverage-uncovered-by-design` tests about the WHOLE CHECKOUT, moved
 * here from
 * `cat-harness-tools/scripts/tests/tools/tool-coverage-uncovered-by-design.test.ts` (bean
 * `7zz1`, owner ruling 2026-10-06 "Top-level instance"): each triages the
 * skills of every layer in the checkout, which only the checkout holds.
 * Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, expect, test } from "bun:test";

import {
  UNCOVERED_BY_DESIGN,
  staleAnnotations,
  triage,
} from "../../scripts/tool-coverage.js";

describe("the real corpus", () => {
  test("no annotation is stale", async () => {
    const stale = staleAnnotations(await triage());
    expect(stale.map((s) => `${s.entry.skill}: ${s.why}`)).toEqual([]);
  });

  /**
   * The vacuity guard. If `triage()` returned nothing the test above would pass
   * while checking nothing, which is the zero-subject trap this repository has
   * paid for more than once. A floor rather than a count, because a count in a
   * test goes stale exactly as a count in prose does.
   */
  test("the triage found skills — otherwise the check above proves nothing", async () => {
    const rows = await triage();
    expect(rows.length).toBeGreaterThan(20);
    expect(rows.filter((r) => r.tier === "A").length).toBeGreaterThan(5);
  });

  test("every annotated skill really is in tier A right now", async () => {
    const rows = await triage();
    for (const u of UNCOVERED_BY_DESIGN) {
      expect(rows.find((r) => r.skill === u.skill)?.tier).toBe("A");
    }
  });
});

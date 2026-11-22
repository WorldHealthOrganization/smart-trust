/**
 * `glossary-export` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/glossary-export.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each reads roles another layer
 * (folio-assistant-core) draws, which only the checkout holds. Standing alone,
 * cat-harness has none of it, and `check:cat-harness-standalone` collects
 * every test in that layer. The rest of that file's tests stay there; every
 * path here is composed from ORIGIN_DIR, the directory they were written in,
 * so nothing they read changed.
 */
import { describe, expect, test } from "bun:test";

import { buildGlossary } from "../../scripts/glossary-export.ts";

describe("the corpus it is actually run against", () => {
  const { report } = buildGlossary({ today: () => "2026-09-21" });

  test("an undrawn role another instance draws is told apart from one drawn nowhere (bean nafz)", () => {
    // The walk is per layer, so "no swimlane draws" is a fact about the
    // walk. deep-researcher's lane is in folio-assistant-core, bound by
    // <folio:role ref>; the report must say where rather than list it beside
    // roles no diagram in the repository draws.
    const dr = report.drawnElsewhere.find((d) => d.role === "deep-researcher");
    expect(dr?.files.some((f) => f.startsWith("folio-assistant-core/"))).toBe(true);
    for (const d of report.drawnElsewhere) {
      expect(report.undrawn).toContain(d.role);
      for (const f of d.files) expect(f.startsWith("cat-harness/")).toBe(false);
    }
  });
});

/**
 * `UNCOVERED_BY_DESIGN` — a tier-A skill that is uncovered and should stay so.
 *
 * `tools:coverage` is a report and is in no workflow, so its own non-zero exit
 * reaches only a person who runs it. This file is what makes CI enforce the
 * table, which is the whole point of declaring it rather than writing the
 * reasons into prose: an annotation that says "do not bother" over work that has
 * since become real is worse than no annotation, because it is believed.
 *
 * The test that matters is {@link staleAnnotations} over the REAL corpus. The
 * synthetic ones exist so a failure there can be read — they prove the checker
 * discriminates, so a green real-corpus run is not green by vacuity.
 *
 * @module scripts/tests/tool-coverage-uncovered-by-design
 *
 * The tests of this file that read the whole checkout (triages the skills of
 * every layer in the checkout) live in
 * `test/tool-coverage-uncovered-by-design-checkout.test.ts` (bean `7zz1`):
 * standing alone, cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";

import {
  UNCOVERED_BY_DESIGN,
  type SkillTriage,
  staleAnnotations,
  uncoveredByDesign,
} from "../../tool-coverage.js";

describe("the table is well formed", () => {
  test("every entry carries a non-trivial reason", () => {
    for (const u of UNCOVERED_BY_DESIGN) {
      // A bare "folio-side" is the failure this table exists to replace: it
      // states the conclusion and not the evidence, so the next reader
      // re-derives it — which is what `w5h0` cost.
      expect(u.reason.length).toBeGreaterThan(80);
      expect(u.reason).toMatch(/bean|`/);
    }
  });

  test("no skill is annotated twice", () => {
    const names = UNCOVERED_BY_DESIGN.map((u) => u.skill);
    expect(names.length).toBe(new Set(names).size);
  });

  test("every state is one the type admits", () => {
    for (const u of UNCOVERED_BY_DESIGN) {
      expect(["folio-mechanism", "contract-unsatisfied"]).toContain(u.state);
    }
  });

  /**
   * `contract-unsatisfied` is deliberately empty. `latex-authoring` and
   * `proof-verification` are its candidates (bean `jh2j`), and the owner ruled
   * on `folio-mechanism` only. Asserted rather than left implicit so that
   * populating it is a decision somebody takes on purpose.
   */
  test("contract-unsatisfied is still empty, and that is deliberate", () => {
    expect(UNCOVERED_BY_DESIGN.filter((u) => u.state === "contract-unsatisfied")).toEqual([]);
  });
});

describe("staleAnnotations discriminates", () => {
  const rows = (...r: [string, "A" | "B" | "C" | "D"][]): SkillTriage[] =>
    r.map(([skill, tier]) => ({ skill, tier, evidence: [] }));

  test("an annotated skill that is uncovered and tier A is not stale", () => {
    const only = UNCOVERED_BY_DESIGN[0].skill;
    expect(staleAnnotations(rows([only, "A"])).map((s) => s.entry.skill)).not.toContain(only);
  });

  test("an annotated skill absent from the uncovered set is stale — it gained a Tool", () => {
    const stale = staleAnnotations([]);
    expect(stale.length).toBe(UNCOVERED_BY_DESIGN.length);
    expect(stale[0].why).toContain("Tool now");
  });

  test("an annotated skill that moved off tier A is stale, and says which tier", () => {
    const only = UNCOVERED_BY_DESIGN[0].skill;
    const stale = staleAnnotations(rows([only, "C"]));
    expect(stale.map((s) => s.entry.skill)).toContain(only);
    expect(stale.find((s) => s.entry.skill === only)!.why).toContain("tier C");
  });
});

describe("uncoveredByDesign", () => {
  test("returns the entry for an annotated skill and undefined otherwise", () => {
    expect(uncoveredByDesign(UNCOVERED_BY_DESIGN[0].skill)?.state).toBe(
      UNCOVERED_BY_DESIGN[0].state,
    );
    expect(uncoveredByDesign("a-skill-that-does-not-exist")).toBeUndefined();
  });
});

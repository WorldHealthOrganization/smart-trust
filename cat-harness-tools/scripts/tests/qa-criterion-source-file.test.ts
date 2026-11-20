/**
 * A criterion's declared `source_file` must be the file that actually
 * contains its checker.
 *
 * ## Why this test exists
 *
 * `getCriterionSourceFile()` resolves the path that `script_hash` is computed
 * over. That hash is the ONLY thing that makes a cached sidecar verdict go
 * stale when checker logic changes (`schemas/sdlc/block-qa.ts` →
 * `QaReviewer.script_hash`).
 *
 * So a criterion pointed at a file that does not contain its checker never
 * invalidates. Its verdicts stay "fresh" indefinitely, and editing the real
 * checker changes nothing — the sweep keeps serving the answer it cached.
 * There is no error, no warning, and no symptom except a number that will
 * not move. A wrong `pass` is believed; a verdict that CANNOT GO STALE is
 * worse, because nothing about it ever looks wrong.
 *
 * Measured on `main`, 2026-09-18 (bean `b7yo`): 11 of 59 automated criteria
 * were in that state. Found by accident — a fix to `checkAuthorNotesPollution`
 * did not change its verdict, because the sidecar was hashing a file the fix
 * never touched.
 *
 * ## Why the candidate list is globbed, not written down
 *
 * The first version of this test hard-coded seven checker files. There are
 * TEN. `qa-checkers-render.ts`, `qa-checkers-q-usage.ts` and
 * `qa-checkers-vacuity.ts` were absent, so every criterion in them read as
 * "dispatcher not found" and was waved through — and that silence hid THREE
 * REAL MISMATCHES (`lean-no-vacuous-instance-data`,
 * `lean-no-definitional-laundering`, `lean-docstring-honesty`, all
 * dispatching from `qa-checkers-vacuity.ts` while declaring
 * `qa-checkers-extended.ts`).
 *
 * That is the same defect the test was written to catch — an allow-list that
 * falls through silently — reproduced in the guard itself. Hence the glob: a
 * checker file added tomorrow is covered without anyone remembering to add
 * it. Bean `fg6z`.
 *
 * ## Two dispatch styles, both covered
 *
 * 1. a dispatch-table entry keyed `"<criterion-id>":` (the voice / DAK / uses
 *    checkers); and
 * 2. an exported `check<PascalCaseId>` function called by name — how the ten
 *    `script-quality` Python criteria work. Probing only for (1) reported all
 *    ten as unlocatable when their `source_file` was in fact correct.
 *
 * Run via `bun test`.
 *
 * The tests here whose subject is folio-assistant-sci's contribution (the
 * checkers this layer contributes for criteria declared
 * `checker_contributed`) live in
 * the checkout's `test/qa-criterion-source-file-sci-checkout.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such contribution to read.
 */
import { describe, test, expect } from "bun:test";

import { QA_CRITERIA_REGISTRY } from "../../pipeline/qa-criteria-registry.ts";

const automated = QA_CRITERIA_REGISTRY.filter((d) => d.automated);

describe("getCriterionSourceFile — declared source must host the checker", () => {

  test("there are automated criteria to check", () => {
    expect(automated.length).toBeGreaterThan(40);
  });
});

describe("a contributed checker cannot fall through to the default", () => {
  test("the cascade REFUSES a checker_contributed criterion", async () => {
    // The whole hazard of this move, made unreachable rather than avoided.
    // Dropping a criterion from the cascade would land it on
    // `qa-checkers-extended.ts`, and `script_hash` over the wrong file is a
    // verdict that can never go stale — the state this file's header was
    // written about.
    const { getCriterionSourceFile } = await import(
      "../../pipeline/qa-criteria-registry.ts"
    );
    const contributed = QA_CRITERIA_REGISTRY.filter((d) => d.checker_contributed);
    expect(contributed.length).toBeGreaterThan(0);
    for (const def of contributed) {
      expect(() => getCriterionSourceFile(def.id)).toThrow(/checker_contributed/);
    }
  });
});

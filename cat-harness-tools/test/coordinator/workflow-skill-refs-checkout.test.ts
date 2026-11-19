/**
 * `workflow-skill-refs` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness-tools/scripts/tests/process/workflow-skill-refs.test.ts` (bean `7zz1`, owner
 * ruling 2026-10-06 "Top-level instance"): each resolves every layer's
 * declared diagrams, which only the checkout holds. Standing alone,
 * cat-harness has none of it, and `check:cat-harness-standalone` collects
 * every test in that layer. The rest of that file's tests stay there. Each path
 * resolves from the layer that declares it, down its `needs` chain
 * (`resolveTranslationPath`), so no root is composed here.
 */
import { describe, expect, test } from "bun:test";

describe("declared diagram paths resolve", () => {
  test("every bpmnDiagrams entry names a file that exists", async () => {
    // Same failure one layer over. `schemas/library/translation-tools.ts` listed
    // `processes/publication-workflow.bpmn`, which has never existed —
    // `docs/process/publication-workflow.md` is a PAGE embedding three diagrams. The
    // re-render skipped it silently, and a skipped diagram is
    // indistinguishable from one that needed no work.
    const { CONTENT_TYPE_TRANSLATIONS, resolveTranslationPath } = await import("../../schemas/library/translation-tools.ts");
    const missing: string[] = [];
    for (const ct of CONTENT_TYPE_TRANSLATIONS) {
      for (const rel of ct.bpmnDiagrams ?? []) {
        if (resolveTranslationPath(ct, rel) === undefined) missing.push(`${ct.contentType} → ${rel}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

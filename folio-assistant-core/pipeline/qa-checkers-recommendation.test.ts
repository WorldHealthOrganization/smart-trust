/**
 * The `recommendation-strength-resolves` checker over real manifests, written
 * to a temporary directory (bean `55ao`).
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkRecommendationStrengthResolves, RECOMMENDATION_CHECKERS, strengthOf } from "./qa-checkers-recommendation.js";

describe("the recommendation-strength-resolves checker", () => {
  const block = (body: string) => {
    const dir = mkdtempSync(join(tmpdir(), "rec-"));
    const ts = join(dir, "rec-a.ts");
    writeFileSync(ts, `export default recommendation({\n  label: "who:rec-a",\n${body}});\n`);
    return { dir, ts };
  };

  it("readsStrengthAsText", () => {
    expect(strengthOf('x({ label: "a", strength: { list: "l", code: "c" } })')).toMatchObject({ list: "l", code: "c", line: 1 });
    expect(strengthOf('x({ label: "a" })')).toBeUndefined();
    expect(strengthOf("x({ strength: { list: L, code: \"c\" } })")).toBeNull();
    // A `strength:` inside a string or comment is not the field.
    expect(strengthOf('x({ title: "strength: { list: \\"l\\" }" }) // strength: {}')).toBeUndefined();
  });

  it("passesKnownCodeFailsUnknown", () => {
    const ok = block('  strength: { list: "grade-recommendation-strength", code: "strong" },\n');
    const bad = block('  strength: { list: "grade-recommendation-strength", code: "weak" },\n');
    try {
      expect(checkRecommendationStrengthResolves({ ts: ok.ts }).result).toBe("pass");
      const r = checkRecommendationStrengthResolves({ ts: bad.ts });
      expect(r.result).toBe("fail");
      expect(r.hits[0]).toMatchObject({ line: 3 });
      expect(r.hits[0]!.text).toMatch(/"weak"/);
    } finally {
      rmSync(ok.dir, { recursive: true, force: true });
      rmSync(bad.dir, { recursive: true, force: true });
    }
  });

  it("noStrengthNaComputedWarns", () => {
    const none = block("");
    const computed = block("  strength: { list: LIST, code: \"strong\" },\n");
    try {
      expect(checkRecommendationStrengthResolves({ ts: none.ts }).result).toBe("n/a");
      expect(checkRecommendationStrengthResolves({ ts: computed.ts }).result).toBe("warn");
    } finally {
      rmSync(none.dir, { recursive: true, force: true });
      rmSync(computed.dir, { recursive: true, force: true });
    }
  });

  it("folioOwnCodeListResolves", () => {
    const b = block('  strength: { list: "house-grading", code: "tier-1" },\n');
    try {
      expect(checkRecommendationStrengthResolves({ ts: b.ts }).result).toBe("fail");
      mkdirSync(join(b.dir, "code-lists"));
      writeFileSync(
        join(b.dir, "code-lists", "house-grading.json"),
        JSON.stringify({ $schema: "folio-code-list/v1", id: "house-grading", title: "House", description: "A folio's own grading scheme.", source: { note: "test" }, codes: [{ code: "tier-1", label: "Tier 1", definition: "The strongest tier of this house scheme." }] }),
      );
      expect(checkRecommendationStrengthResolves({ ts: b.ts }).result).toBe("pass");
    } finally {
      rmSync(b.dir, { recursive: true, force: true });
    }
  });

  it("dispatchTableHoldsChecker", () => {
    expect(Object.keys(RECOMMENDATION_CHECKERS)).toEqual(["recommendation-strength-resolves"]);
  });
});

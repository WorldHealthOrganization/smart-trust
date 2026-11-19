/**
 * `gen-lsi-viz` tests about the WHOLE CHECKOUT (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): the evidence chain is read from every
 * layer's methodologies, skills, Tools and processes, which only the
 * checkout holds. Standing alone, cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";
import { evidenceModel, INDEXING_METHODS } from "../../scripts/gen-lsi-viz.ts";

describe("the Indexing evidence page over the checkout (cat-harness#1144)", () => {
  const model = evidenceModel();

  test("every indexing method this layer declares has its section, with held evidence", () => {
    expect(model.methods.map((m) => m.name)).toEqual([...INDEXING_METHODS]);
    for (const m of model.methods) expect(m.evidence.length).toBeGreaterThan(0);
  }, 60_000);

  test("lsi is applied by lsi-indexing, which its Tools satisfy", () => {
    const lsi = model.methods.find((m) => m.name === "lsi")!;
    const skill = lsi.skills.find((s) => s.name === "lsi-indexing")!;
    expect(skill.tools).toContain("lsi-index");
    expect(skill.tools).toContain("lsi-query");
  });

  test("an indexing skill is either under a method or listed as unbacked, never both", () => {
    const backed = new Set(model.methods.flatMap((m) => m.skills.map((s) => s.name)));
    for (const s of model.unbacked) expect(backed.has(s.name)).toBe(false);
    expect(model.unbacked.map((s) => s.name)).toContain("corpus-grep");
  });
});

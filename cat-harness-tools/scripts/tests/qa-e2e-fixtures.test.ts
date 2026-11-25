/**
 * The e2e QA fixtures keep the SHAPE the generator writes.
 *
 * `qa-badge.e2e.ts` and `qa-panel.e2e.ts` read `test/results/witnesses/…` at
 * load until bean `cxcn` (reader audit R72/R73). That tree is derived and is
 * leaving `main` (bean `5hox`), so the specs now read committed copies under
 * `test/support/fixtures/qa-e2e/`. Their headers argued for the live corpus on
 * one ground: a hand-made fixture can agree with the code while the code
 * disagrees with what the generator writes. This test is what answers that for
 * a copy — it holds each fixture to the declared contract, so a change to the
 * generator's output shape fails here rather than leaving the specs testing a
 * format nothing produces any more.
 *
 * Verdicts in the fixtures are NOT asserted, here or in the specs: the specs
 * pin the ones they assert through `test/support/` helpers.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { QA_FAMILIES } from "../../pipeline/qa-witness.ts";
import { QaIndexSchema } from "../../schemas/ui/site-indexes.ts";

const DIR = join(import.meta.dir, "..", "..", "test", "support", "fixtures", "qa-e2e");
const read = (name: string): Record<string, unknown> => JSON.parse(readFileSync(join(DIR, name), "utf8"));

// The keys `QaWitnessDoc`, `QaCriterionView` and `QaWitness` declare in
// `pipeline/qa-witness.ts`. A key outside these is a shape the
// generator does not write.
const DOC_KEYS = ["$schema", "family", "subject", "sidecars", "state", "counts", "criteria"];
const CRITERION_KEYS = ["id", "result", "severity", "locale", "block", "evidence", "metrics", "score", "witnesses"];
const WITNESS_KEYS = [
  "kind", "id", "version", "at", "sha", "scriptHash", "scriptCommitSha", "depsHash", "model", "session",
  "skill", "method", "freshness", "changed", "notCompared", "notes",
];
const COUNT_KEYS = ["fail", "warn", "pass", "na", "unknown"];

function witnessDocDefects(doc: Record<string, unknown>): string[] {
  const out: string[] = [];
  if (doc.$schema !== "qa-witness/v1") out.push(`$schema ${String(doc.$schema)}`);
  if (!(QA_FAMILIES as readonly string[]).includes(String(doc.family))) out.push(`family ${String(doc.family)}`);
  for (const k of DOC_KEYS) if (!(k in doc)) out.push(`missing ${k}`);
  for (const k of Object.keys(doc)) if (!DOC_KEYS.includes(k)) out.push(`unknown key ${k}`);
  const counts = doc.counts as Record<string, unknown>;
  if (Object.keys(counts ?? {}).sort().join() !== [...COUNT_KEYS].sort().join()) out.push("counts keys");
  const criteria = doc.criteria as Array<Record<string, unknown>>;
  if (!Array.isArray(criteria) || criteria.length === 0) out.push("no criteria");
  for (const c of criteria ?? []) {
    for (const k of Object.keys(c)) if (!CRITERION_KEYS.includes(k)) out.push(`criterion ${String(c.id)}: unknown key ${k}`);
    for (const w of (c.witnesses as Array<Record<string, unknown>>) ?? []) {
      for (const k of Object.keys(w)) if (!WITNESS_KEYS.includes(k)) out.push(`criterion ${String(c.id)}: witness key ${k}`);
      if (!("freshness" in w)) out.push(`criterion ${String(c.id)}: witness without freshness`);
    }
  }
  return out;
}

describe("e2e QA fixtures — the generator's shape, not the corpus's verdicts", () => {
  test("badge-index.json is a valid folio-qa-index/v1", () => {
    const r = QaIndexSchema.safeParse(read("badge-index.json"));
    expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)).toEqual([]);
  });

  test("badge-index.json is the CURRENT shape: it says the corpus was present and which keys are unswept", () => {
    // Since bean `4l4d` the page carries a uniform placeholder and the index
    // alone decides "not swept"; a fixture without `unswept` would leave the
    // never-swept spec painting `could not determine` instead.
    const doc = read("badge-index.json");
    expect(doc.corpus).toBe("present");
    expect(Array.isArray(doc.unswept) && (doc.unswept as unknown[]).length > 0).toBe(true);
  });

  test("block-witness.json is a block qa-witness/v1 doc", () => {
    const doc = read("block-witness.json");
    expect(witnessDocDefects(doc)).toEqual([]);
    expect(doc.family).toBe("block");
  });

  test("kg-witness.json is a kg qa-witness/v1 doc", () => {
    const doc = read("kg-witness.json");
    expect(witnessDocDefects(doc)).toEqual([]);
    expect(doc.family).toBe("kg");
  });

  test("the checker is not vacuous: an unknown key is reported", () => {
    const doc = { ...read("kg-witness.json"), stray: 1 };
    expect(witnessDocDefects(doc)).toContain("unknown key stray");
  });
});

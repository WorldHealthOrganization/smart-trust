/**
 * Recommendation candidates: mechanical candidates, an agent's curation, and
 * the verbatim and shape gates over it.
 *
 * Calibrated: dropping the verbatim check makes `refusesParaphrase` fail;
 * letting a remark name an undeclared key makes `refusesRemarkOfUndeclared`
 * fail; counting an unsigned exclusion as excluded makes
 * `unsignedExclusionNotAccountedFor` fail; emitting a wrong contentHash makes the
 * L1 3.0 validator refuse the graph, which `writesValidL1Graph` sees.
 */
import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check } from "../schemas/validate.ts";
import { CurationSchema, hintsFor, proposedIdentifiers, readEntry, RefusalError, run, type Curation } from "./l1-recommendation-candidates.ts";

const page = (n: number, text: string) =>
  `---\ndoc_id: test-entry\nsection_id: page-${String(n).padStart(3, "0")}\npdf_page: ${n}\ngranularity: page\n---\n${text}\n`;

function entry(): string {
  const dir = mkdtempSync(join(tmpdir(), "l1-cand-"));
  mkdirSync(join(dir, "sections"));
  // A real `pdf-structure/v1` (page granularity), because readEntry reads it
  // through the platform's readStructure, which refuses an untagged structure.
  const section = (n: number) => {
    const id = `page-${String(n).padStart(3, "0")}`;
    return { id, number: null, title: `Page ${n}`, level: 1, page_start: n, page_end: n, n_chars: 0, n_words: 0 };
  };
  writeFileSync(
    join(dir, "structure.json"),
    JSON.stringify({
      _schema: "pdf-structure/v1",
      doc_id: "test-entry",
      source: { file: "test-entry.pdf", sha256: "a".repeat(64), bytes: 0, mtime: null, mimetype_sniffed: "application/pdf", mimetype_source: "magic-bytes" },
      toc_source: "none",
      granularity: "page",
      sections: [section(1), section(2)],
    }),
  );
  writeFileSync(join(dir, "sections", "page-001.md"), page(1, "ISBN 978-92-4-011619-1 (electronic version)\nSome rights reserved. You must license your work under the same licence."));
  writeFileSync(
    join(dir, "sections", "page-002.md"),
    page(2, "Products should be identified by a national code. Best practices: • Codes should be numeric. • Attributes should be linked to the code.\nThis matters because codes must be stable over time."),
  );
  return dir;
}

const curation = (decisions: Curation["decisions"]): Curation =>
  CurationSchema.parse({ $schema: "l1-recommendation-curation/v1", entry: "e", decisions });

describe("the mechanical half", () => {
  it("findsNormativeSentencesDecidesNone", () => {
    const r = run(readEntry(entry()), undefined, "lib/test-entry", "2026-10-12T00:00:00Z");
    expect(r.candidates.map((c) => c.location)).toEqual(["p1:s2", "p2:s1", "p2:s2", "p2:s3"]);
    expect(r.counts.undecided).toBe(4);
    expect(r.graph).toBeUndefined();
  });

  it("proposesPublicationFromIsbn", () => {
    const e = readEntry(entry());
    expect(proposedIdentifiers(e).identifiers).toEqual([{ type: "isbn", value: "978-92-4-011619-1" }]);
    const r = run(e, undefined, "lib/test-entry", "2026-10-12T00:00:00Z");
    expect(r.publication.iri).toBe("https://smart.who.int/kg/l1/publication/isbn-9789240116191");
    expect(r.warnings.some((w) => w.code === "publication-proposed")).toBe(true);
  });

  it("hintsAndProposesUnsignedExclusion", () => {
    expect(hintsFor("You must license your work under the same licence.", "")).toContain("licence-or-imprint");
    expect(hintsFor("• Codes should be numeric", "")).toContain("layout-fragment");
    const r = run(readEntry(entry()), undefined, "lib/test-entry", "2026-10-12T00:00:00Z");
    expect(r.exclusions).toEqual([{ location: "p1:s2", reason: "editorial", signerRole: { role: "l1-extraction-reviewer" } }]);
    expect(r.coverage.excluded).toBe(0);
  });
});

describe("the curation gates", () => {
  const good = curation({
    "p1:s2": { as: "exclude", reason: "editorial", basis: "licence" },
    "p2:s1": { as: "recommendation", key: "R1", basis: "a should on products" },
    "p2:s2": [
      { as: "recommendation", key: "R2", statement: "Codes should be numeric.", basis: "one bullet" },
      { as: "recommendation", key: "R3", statement: "Attributes should be linked to the code.", basis: "the next bullet" },
    ],
    "p2:s3": { as: "remark", of: "R1", remarkType: "implementation", basis: "why R1" },
  });

  it("writesValidL1Graph", () => {
    const r = run(readEntry(entry()), good, "lib/test-entry", "2026-10-12T00:00:00Z");
    expect(r.counts).toEqual({ statementClass: "recommendation", recommendations: 3, remarks: 1, partOf: 0, excluded: 1, undecided: 0 });
    const v = check(r.graph);
    expect(v.errors).toEqual([]);
    const types = (r.graph!.nodes as { type: string }[]).map((n) => n.type);
    expect(types.filter((t) => t === "recommendation")).toHaveLength(3);
    expect(types).toContain("remark");
    expect((r.graph!.nodes as { derivation: string }[]).every((n) => n.derivation === "inferred")).toBe(true);
  });

  it("implementationGuidanceEmitsPractices", () => {
    const { "p2:s3": _remark, ...rest } = good.decisions;
    const c: Curation = { ...curation(rest), publication: { identifiers: [{ type: "isbn", value: "978-92-4-011619-1" }], publicationType: "implementation-guidance", basis: "x" } };
    const r = run(readEntry(entry()), c, "lib/test-entry", "2026-10-12T00:00:00Z");
    expect(r.counts.statementClass).toBe("implementation-practice");
    const types = (r.graph!.nodes as { type: string }[]).map((n) => n.type);
    expect(types.filter((t) => t === "implementation-practice")).toHaveLength(3);
    expect(types).not.toContain("recommendation");
    expect(r.graph!["@context"]).toBe("http://smart.who.int/kg/l1-library.context.jsonld");
    expect(check(r.graph).errors).toEqual([]);
    expect(refused({ ...c, decisions: { ...c.decisions, "p2:s3": { as: "remark", of: "R1", basis: "x" } } }).join()).toMatch(/remark attaches only to a recommendation/);
    expect(refused({ ...c, decisions: { ...c.decisions, "p2:s1": { as: "recommendation", key: "R1", kind: "good-practice-statement", basis: "x" } } }).join()).toMatch(/makes no recommendations of its own/);
  });

  it("validatorRefusesRecommendationInGuidance", () => {
    const r = run(readEntry(entry()), good, "lib/test-entry", "2026-10-12T00:00:00Z");
    const g = structuredClone(r.graph!) as { nodes: { type: string; properties: Record<string, unknown> }[] };
    g.nodes.find((n) => n.type === "publication")!.properties.publicationType = "implementation-guidance";
    expect(check(g).errors.join()).toMatch(/makes no recommendations of its own/);
  });

  it("unsignedExclusionNotAccountedFor", () => {
    const r = run(readEntry(entry()), good, "lib/test-entry", "2026-10-12T00:00:00Z");
    expect(r.coverage).toMatchObject({ normative: 4, captured: 3, excluded: 0, unaccounted: 1 });
    expect(r.warnings.some((w) => w.code === "exclusion-unsigned")).toBe(true);
    const signed = curation({ ...good.decisions, "p1:s2": { as: "exclude", reason: "editorial", basis: "licence", signedOffBy: "a-person" } });
    expect(run(readEntry(entry()), signed, "lib/test-entry", "2026-10-12T00:00:00Z").coverage.accountedForPct).toBe(100);
  });

  const refused = (c: Curation): string[] => {
    try {
      run(readEntry(entry()), c, "lib/test-entry", "2026-10-12T00:00:00Z");
    } catch (e) {
      if (e instanceof RefusalError) return e.problems;
      throw e;
    }
    return [];
  };

  it("refusesParaphrase", () => {
    expect(refused(curation({ "p2:s1": { as: "recommendation", key: "R1", statement: "Products should be identified by a national code, always.", basis: "x" } })).join()).toMatch(/not verbatim/);
  });

  it("refusesRemarkOfUndeclared", () => {
    expect(refused(curation({ "p2:s3": { as: "remark", of: "R9", basis: "x" } })).join()).toMatch(/no recommendation decision declares/);
  });

  it("refusesUnknownLocationAndReusedKey", () => {
    const p = refused(curation({ "p9:s1": { as: "exclude", reason: "editorial", basis: "x" }, "p2:s1": { as: "recommendation", key: "R1", basis: "x" }, "p2:s3": { as: "recommendation", key: "R1", basis: "x" } }));
    expect(p.join()).toMatch(/no normative sentence at this location/);
    expect(p.join()).toMatch(/already used/);
  });
});

describe("the worked example", () => {
  it("workedExampleIsCurrent", () => {
    // The sections live in who-iris since 2026-10-30 (who-iris#107); the
    // extraction is smart-base's own and stays here.
    const X = "who-iris/library/9789240116191-eng";
    const E = "smart-base/l1-extractions/9789240116191-eng";
    const r = spawnSync("bun", ["run", "smart-base/L1/scripts/l1-recommendation-candidates.ts", "--entry", X, "--curation", `${E}/curation.yaml`, "--out", E, "--check"], {
      cwd: join(import.meta.dir, "..", "..", ".."),
      encoding: "utf8",
    });
    expect(r.stderr + r.stdout).toMatch(/current — 48 candidates: 22 implementation practices/);
    expect(r.status).toBe(0);
  });

  it("workedExampleScenariosCurrent", () => {
    const X = "smart-base/l1-extractions/9789240116191-eng";
    const r = spawnSync(
      "bun",
      ["run", "smart-base/scripts/l1-recommendation-scenarios.ts", "--l1", `${X}/l1.json`, "--vocabulary", `${X}/dth-npc-vocabulary.json`,
        "--generic", "smart-base/scripts/fixtures/l1-recommendation-scenarios/smart-base-generic-personas.json", "--mapping", `${X}/scenario-mapping.yaml`, "--out", `${X}/scenarios`, "--check"],
      { cwd: join(import.meta.dir, "..", "..", ".."), encoding: "utf8" },
    );
    expect(r.stderr + r.stdout).toMatch(/current — 22 scenario candidates, 26 warning/);
    expect(r.status).toBe(0);
  });
});

/**
 * The outcome set for leg 1 of bean `2i5f`: what is refused, and why.
 *
 * @module schemas/term-adjudication.test
 * @graphNode none — a test
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { adjudications } from "../scripts/check-term-mapping.ts";
import {
  OUTCOMES,
  OUTCOME_WRITES,
  TERM_ADJUDICATIONS_SCHEMA_ID,
  TermAdjudicationSchema,
  TermAdjudicationsFileSchema,
  adjudicationStatus,
  type TermAdjudication,
} from "./content/term-adjudication.ts";

const subject = (over: Record<string, unknown> = {}) => ({
  scheme: "kg-tools",
  term: "participant",
  target: "skos",
  observed: { exact: "unmapped", concept: "mapped" },
  ...over,
});
const base = { subject: subject(), decidedBy: "owner", decidedAt: "2026-10-02" };
const prose = { ...base, outcome: "change-prose", concept: "http://ex.org/actor", authorisedLabel: "Actor", changed: ["cat-harness/tools/x.json"] };
const local = { ...base, outcome: "local-term", localTerm: { glossary: "g.glossary.json", id: "participant" }, reason: "narrower here", relation: "narrowMatch", concept: "http://ex.org/actor" };
const wrong = { ...base, outcome: "vocabulary-wrong", vocabulary: "who-smart-base@v1.0.0", domain: "agent tooling", reason: "a clinical IG has no word for this" };

const ok = (x: unknown) => TermAdjudicationSchema.safeParse(x).success;

describe("three outcomes, each saying what is written and where", () => {
  test("every outcome has its row, and the table has no extra rows", () => {
    expect(Object.keys(OUTCOME_WRITES).sort()).toEqual([...OUTCOMES].sort());
    for (const o of OUTCOMES) {
      expect(OUTCOME_WRITES[o].writes.length).toBeGreaterThan(0);
      expect(OUTCOME_WRITES[o].where.length).toBeGreaterThan(0);
    }
  });

  test("a well-formed record of each outcome parses", () => {
    expect(ok(prose)).toBe(true);
    expect(ok(local)).toBe(true);
    expect(ok(wrong)).toBe(true);
  });
});

describe("what is refused", () => {
  test("an undetermined subject: a terminology nobody reached has not disagreed (dh4f)", () => {
    expect(ok({ ...wrong, subject: subject({ observed: { exact: "undetermined", concept: "undetermined" } }) })).toBe(false);
  });

  test("an exact match: that is agreement, with nothing to decide", () => {
    expect(ok({ ...wrong, subject: subject({ observed: { exact: "mapped", concept: "mapped" } }) })).toBe(false);
  });

  test("a local term that is exactly the authority's concept: that outcome is change-prose", () => {
    expect(ok({ ...local, relation: "exactMatch" })).toBe(false);
  });

  test("relatedMatch: an authored term cannot carry it, so the outcome could not be written", () => {
    expect(ok({ ...local, relation: "relatedMatch" })).toBe(false);
  });

  test("a relation with no concept, and a concept with no relation", () => {
    const { concept: _c, ...noConcept } = local;
    expect(ok(noConcept)).toBe(false);
    expect(ok({ ...local, relation: "none" })).toBe(false);
    expect(ok({ ...noConcept, relation: "none" })).toBe(true);
  });

  test("a decision with no reason, or a blank one", () => {
    const { reason: _r, ...noReason } = wrong;
    expect(ok(noReason)).toBe(false);
    expect(ok({ ...wrong, reason: "   " })).toBe(false);
  });

  test("an in-repo `<scheme>:<id>` where an IRI is required", () => {
    expect(ok({ ...prose, concept: "platform:actor" })).toBe(false);
  });

  test("change-prose that names no changed asset", () => {
    expect(ok({ ...prose, changed: [] })).toBe(false);
  });

  test("two outcomes for one disagreement in a file", () => {
    const f = { $schema: TERM_ADJUDICATIONS_SCHEMA_ID, adjudications: [prose, wrong] };
    expect(TermAdjudicationsFileSchema.safeParse(f).success).toBe(false);
    const other = { ...wrong, subject: subject({ target: "fhir" }) };
    expect(TermAdjudicationsFileSchema.safeParse({ ...f, adjudications: [prose, other] }).success).toBe(true);
  });
});

describe("a record set against the check's current answer", () => {
  const p = TermAdjudicationSchema.parse(prose) as TermAdjudication;
  const w = TermAdjudicationSchema.parse(wrong) as TermAdjudication;
  const observed = { exact: "unmapped", concept: "mapped" };

  test("change-prose is applied once the term maps exactly or is gone, pending while unchanged", () => {
    expect(adjudicationStatus(p, { exact: "mapped", concept: "mapped" })).toBe("applied");
    expect(adjudicationStatus(p, undefined)).toBe("applied");
    expect(adjudicationStatus(p, observed)).toBe("pending");
    expect(adjudicationStatus(p, { exact: "unmapped", concept: "unmapped" })).toBe("stale");
  });

  test("vocabulary-wrong holds while the observed pair holds, and is stale otherwise", () => {
    expect(adjudicationStatus(w, observed)).toBe("holds");
    expect(adjudicationStatus(w, { exact: "mapped", concept: "mapped" })).toBe("stale");
    expect(adjudicationStatus(w, undefined)).toBe("stale");
  });
});

describe("check:term-mapping reads the files beside the schemes", () => {
  // The glossary is found through its DECLARATION, as in a real checkout: a
  // layer that declares a `glossary` graph. The fixture used to plant files
  // at the literal `folio-assistant-core/glossary`, the upward path the reader
  // no longer follows (bean `0r7u` step 0).
  const GLOSSARY = join("acme", "glossary");
  const root = () => {
    const r = mkdtempSync(join(tmpdir(), "adj-"));
    mkdirSync(join(r, GLOSSARY), { recursive: true });
    writeFileSync(
      join(r, "acme", "acme.json"),
      JSON.stringify({ name: "acme", version: "0.1.0", directories: [{ id: "glossary", path: "glossary/", graphTypologies: ["glossary"] }] }),
    );
    return r;
  };

  test("no file is zero files, not a failure", () => {
    expect(adjudications(root(), [])).toEqual({ files: 0, invalid: [], status: [] });
  });

  test("an invalid record is reported with its path", () => {
    const r = root();
    writeFileSync(
      join(r, GLOSSARY, "x.term-adjudications.json"),
      JSON.stringify({ $schema: TERM_ADJUDICATIONS_SCHEMA_ID, adjudications: [{ ...wrong, reason: "" }] }),
    );
    const got = adjudications(r, []);
    expect(got.invalid.length).toBe(1);
    expect(got.invalid[0]).toContain("x.term-adjudications.json");
  });

  test("a valid record is set against the mappings this run produced", () => {
    const r = root();
    writeFileSync(
      join(r, GLOSSARY, "x.term-adjudications.json"),
      JSON.stringify({ $schema: TERM_ADJUDICATIONS_SCHEMA_ID, adjudications: [wrong] }),
    );
    const got = adjudications(r, [
      { term: "participant", instance: "cat-harness", scheme: "kg-tools", target: "skos", exact: "unmapped", concept: "mapped", matches: [{ uri: "http://ex.org/actor", predicate: "skos:closeMatch", via: "Participant", scheme: "platform" }] },
    ]);
    expect(got).toEqual({ files: 1, invalid: [], status: [{ key: "kg-tools/participant on skos", status: "holds" }] });
  });
});

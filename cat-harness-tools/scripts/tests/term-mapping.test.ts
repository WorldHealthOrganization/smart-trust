/**
 * The mapping check, and the guard against it silently always saying zero.
 *
 * @module scripts/tests/term-mapping.test
 * @graphNode none — a test
 *
 * Bean `7wou`. Run against the real corpus 2026-09-30 the check reports
 * **0 mapped of 2 594** — the 7 authored concepts and the extracted
 * candidates are disjoint vocabularies. That is a true finding and it is also
 * exactly the shape that rots unnoticed: an index that stopped working would
 * report the same zero. So the positive cases below run on fixtures with
 * deliberate collisions, and the corpus case asserts the SCOPE rather than
 * the count.
 *
 * The tests of this file that read the whole checkout (maps the real glossary
 * onto fhir-harness's terminology) live in
 * `test/term-mapping-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";

import {
  MAPPING_TARGETS,
  TermMappingSchema,
  TermMappingsFileSchema,
  normaliseLabel,
} from "../../schemas/content/term-mapping.ts";

import {
  candidates,
  perScheme,
  resolveFhir,
  resolveSkos,
  skosIndex,
  termState,
  type SchemeState,
} from "../check-term-mapping.ts";

const scheme = (id: string, terms: unknown[], instance = "i") => ({ id, terms, instance }) as never;
const authored = (prefLabel: string, over: Record<string, unknown> = {}) => ({
  id: prefLabel.toLowerCase().replace(/\s+/g, "-"),
  prefLabel,
  status: "authored",
  ...over,
});
const candidate = (prefLabel: string) => ({
  id: prefLabel.toLowerCase().replace(/\s+/g, "-"),
  prefLabel,
  status: "candidate",
});

describe("the index matches when it should — the non-vacuity guard", () => {
  const schemes = [
    scheme("platform", [
      authored("Policy", { exactMatch: ["http://www.w3.org/ns/odrl/2/Policy"] }),
      authored("Actor", { altLabel: ["Participant"] }),
    ]),
    scheme("kg-skills", [candidate("policy"), candidate("Participant"), candidate("Wombat")]),
  ];
  const results = resolveSkos(candidates(schemes), skosIndex(schemes));
  const by = new Map(results.map((r) => [r.term, r]));

  test("a prefLabel match is `exact: mapped`, and carries the external URI", () => {
    const r = by.get("policy")!;
    expect(r.exact).toBe("mapped");
    expect(r.concept).toBe("mapped");
    expect(r.matches?.[0]?.uri).toBe("http://www.w3.org/ns/odrl/2/Policy");
    expect(r.matches?.[0]?.predicate).toBe("skos:exactMatch");
  });

  test("an altLabel match is `concept: mapped` but NOT `exact`", () => {
    // The whole reason the two are a pair: the right idea under another name.
    const r = by.get("participant")!;
    expect(r.exact).toBe("unmapped");
    expect(r.concept).toBe("mapped");
    expect(r.matches?.[0]?.predicate).toBe("skos:closeMatch");
  });

  test("a genuine miss is `unmapped` on both, with no matches", () => {
    const r = by.get("wombat")!;
    expect(r.exact).toBe("unmapped");
    expect(r.concept).toBe("unmapped");
    expect(r.matches).toBeUndefined();
  });

  test("an authored term is not a candidate, so it never maps to itself", () => {
    expect(results.some((r) => r.term === "actor")).toBe(false);
  });

  test("normalisation is substance, not typography", () => {
    expect(normaliseLabel("  Policy. ")).toBe(normaliseLabel("policy"));
    expect(normaliseLabel("task   run")).toBe("task run");
  });

  test("the committed projection KEEPS the pair: exact and concept-only stay apart (bean 5yhm)", () => {
    const [row] = perScheme(results, "skos", [{ target: "skos", consulted: ["platform"], via: "local" }]);
    expect(row!.mappedTerms).toEqual([
      { term: "participant", exact: false, concepts: ["platform:actor"], exactConcepts: [] },
      {
        term: "policy",
        exact: true,
        concepts: ["http://www.w3.org/ns/odrl/2/Policy"],
        exactConcepts: ["http://www.w3.org/ns/odrl/2/Policy"],
      },
    ]);
    // Not mixed, so no per-term undetermined list: the counts already say it.
    expect(row!.undeterminedTerms).toBeUndefined();
  });
});

describe("exactConcepts names WHICH concept was exact (bean 5yhm, SKOS publish)", () => {
  // One candidate, two concepts: A by prefLabel, B by altLabel. `exact` is
  // true, and publishing exactMatch to B would assert an equivalence nothing
  // measured — so the record must say A alone was exact.
  const schemes = [
    scheme("platform", [
      authored("Ledger", { exactMatch: ["http://example.org/A"] }),
      authored("Journal", { exactMatch: ["http://example.org/B"], altLabel: ["Ledger"] }),
    ]),
    scheme("kg-tools", [candidate("Ledger")]),
  ];
  const results = resolveSkos(candidates(schemes), skosIndex(schemes));

  test("only the prefLabel hit is in exactConcepts; both are in concepts", () => {
    const [row] = perScheme(results, "skos", [{ target: "skos", consulted: ["platform"], via: "local" }]);
    expect(row!.mappedTerms).toEqual([
      {
        term: "ledger",
        exact: true,
        concepts: ["http://example.org/A", "http://example.org/B"],
        exactConcepts: ["http://example.org/A"],
      },
    ]);
  });
});

describe("termState — the one place the record becomes a per-term answer (bean 5yhm)", () => {
  const S = { instance: "i", scheme: "s" };
  const row = (over: Record<string, unknown> = {}): SchemeState =>
    ({ instance: "i", scheme: "s", target: "fhir", mapped: 0, unmapped: 0, undetermined: 0, mappedTerms: [], ...over }) as SchemeState;

  test("mapped carries exact and the concepts", () => {
    const st = [row({ mapped: 1, mappedTerms: [{ term: "a", exact: false, concepts: ["u"], exactConcepts: [] }] })];
    expect(termState(st, S, "fhir", "a")).toEqual({ state: "mapped", exact: false, concepts: ["u"] });
  });

  test("an all-undetermined row answers undetermined with its reason — never unmapped", () => {
    const st = [row({ undetermined: 3, reason: "host refused" })];
    expect(termState(st, S, "fhir", "z")).toEqual({ state: "undetermined", reason: "host refused" });
  });

  test("a mixed row reads its list; without one it answers unknown", () => {
    expect(termState([row({ unmapped: 1, undetermined: 1, undeterminedTerms: ["b"] })], S, "fhir", "b").state).toBe(
      "undetermined",
    );
    expect(termState([row({ unmapped: 1, undetermined: 1, undeterminedTerms: ["b"] })], S, "fhir", "a").state).toBe(
      "unmapped",
    );
    expect(termState([row({ unmapped: 1, undetermined: 1 })], S, "fhir", "a").state).toBe("unknown");
  });

  test("no row, or two rows, is unknown", () => {
    expect(termState([], S, "fhir", "a").state).toBe("unknown");
    expect(termState([row({ unmapped: 1 }), row({ unmapped: 1 })], S, "fhir", "a").state).toBe("unknown");
  });

  test("perScheme names undetermined terms ONLY when a row is mixed", () => {
    const ms = [
      { term: "a", instance: "i", scheme: "s", target: "fhir", exact: "unmapped", concept: "unmapped" },
      { term: "b", instance: "i", scheme: "s", target: "fhir", exact: "undetermined", concept: "undetermined", undetermined_reason: "r" },
    ] as never;
    const [mixed] = perScheme(ms, "fhir", []);
    expect(mixed!.undeterminedTerms).toEqual(["b"]);
    expect(termState([mixed!], S, "fhir", "a").state).toBe("unmapped");
    expect(termState([mixed!], S, "fhir", "b").state).toBe("undetermined");
  });
});

describe("rows are keyed by (instance, scheme) (beans wvzp, q3n9)", () => {
  // `kg-tools` is the id of every layer's Tool extraction. Two layers
  // whose schemes share an id AND a term id must still get one answer each
  // (owner ruling A on q3n9, 2026-10-24: the layer is the scheme's owner).
  const schemes = [
    scheme("platform", [authored("Policy")]),
    scheme("kg-tools", [candidate("policy")], "cat-harness"),
    scheme("kg-tools", [candidate("Policy"), candidate("Wombat")], "fhir-harness"),
  ];
  const results = resolveSkos(candidates(schemes), skosIndex(schemes));
  const rows = perScheme(results, "skos", [{ target: "skos", consulted: ["platform"], via: "local" }]);
  const CH = { instance: "cat-harness", scheme: "kg-tools" };
  const FH = { instance: "fhir-harness", scheme: "kg-tools" };

  test("one shared scheme id gives one row per instance", () => {
    const tools = rows.filter((r) => r.scheme === "kg-tools");
    expect(tools.map((r) => r.instance)).toEqual(["cat-harness", "fhir-harness"]);
    expect(tools.map((r) => [r.mapped, r.unmapped])).toEqual([[1, 0], [1, 1]]);
  });

  test("a term id in two instances' schemes is resolved, not unknown", () => {
    expect(termState(rows, CH, "skos", "policy").state).toBe("mapped");
    expect(termState(rows, FH, "skos", "policy").state).toBe("mapped");
    expect(termState(rows, FH, "skos", "wombat").state).toBe("unmapped");
    expect(termState(rows, CH, "skos", "wombat").state).toBe("unmapped");
  });

  test("an instance with no such scheme has no row, so it is unknown rather than borrowing another's", () => {
    expect(termState(rows, { instance: "who-iris", scheme: "kg-tools" }, "skos", "policy").state).toBe("unknown");
  });

  test("every mapping names its scheme's instance and still satisfies the record schema", () => {
    for (const m of results) expect(TermMappingSchema.safeParse(m).success).toBe(true);
    expect(results.map((m) => m.instance)).toEqual(["cat-harness", "fhir-harness", "fhir-harness"]);
  });

  test("a mapping with no instance is refused: the key is not optional", () => {
    const { instance: _, ...bare } = results[0]!;
    expect(TermMappingSchema.safeParse(bare).success).toBe(false);
  });
});

describe("the fhir half resolves against a PUBLISHED IG AT A VERSION", () => {
  // Owner, 2026-09-30, choosing between two assertions that can disagree:
  // "this code is in the published base IG at version X", not "this code is
  // in the collection somebody curates today".
  const pinned = {
    version: "v1.0.0",
    concepts: [
      { system: "CDHIv1", code: "1.1", display: "Targeted client communication" },
      { system: "CoreDataElementType", code: "valueset", display: "ValueSet" },
    ],
  };

  test("a display match is `concept: mapped` and cites system#code at the version", () => {
    const [m] = resolveFhir(
      [{ term: candidate("targeted client communication") as never, instance: "i", scheme: "s" }],
      pinned,
    );
    expect(m!.concept).toBe("mapped");
    expect(m!.matches?.[0]?.uri).toBe("CDHIv1#1.1");
    expect(m!.matches?.[0]?.scheme).toBe("who-smart-base@v1.0.0");
  });

  test("it is closeMatch, never exactMatch — and `exact` stays unmapped", () => {
    // A glossary label matching a code's display means the two are ABOUT the
    // same thing, not that the term IS that code. Claiming exactness across
    // vocabularies is the overreach `vocabulary-authority` prevents.
    const [m] = resolveFhir([{ term: candidate("ValueSet") as never, instance: "i", scheme: "s" }], pinned);
    expect(m!.matches?.[0]?.predicate).toBe("skos:closeMatch");
    expect(m!.exact).toBe("unmapped");
  });

  test("a miss against a PRESENT snapshot is `unmapped`, not undetermined", () => {
    // The pin is here and was consulted, so the answer is a real negative.
    const [m] = resolveFhir([{ term: candidate("wombat") as never, instance: "i", scheme: "s" }], pinned);
    expect(m!.concept).toBe("unmapped");
    expect(m!.undetermined_reason).toBeUndefined();
  });
});

describe("undetermined is never unmapped", () => {
  test("no pinned snapshot yields undetermined WITH a reason", () => {
    const [m] = resolveFhir([{ term: candidate("x") as never, instance: "i", scheme: "s" }], "host refused");
    expect(m!.exact).toBe("undetermined");
    expect(m!.concept).toBe("undetermined");
    expect(m!.undetermined_reason).toBe("host refused");
    expect(TermMappingSchema.safeParse(m).success).toBe(true);
  });

  test("undetermined with NO reason is refused by the schema", () => {
    const r = TermMappingSchema.safeParse({
      term: "t", instance: "i", scheme: "s", target: "fhir", exact: "undetermined", concept: "undetermined",
    });
    expect(r.success).toBe(false);
  });

  test("`mapped` with nothing named is refused", () => {
    const r = TermMappingSchema.safeParse({
      term: "t", instance: "i", scheme: "s", target: "skos", exact: "mapped", concept: "mapped",
    });
    expect(r.success).toBe(false);
  });

  test("exact-mapped with concept-unmapped is unreachable and refused", () => {
    const r = TermMappingSchema.safeParse({
      term: "t", instance: "i", scheme: "s", target: "skos", exact: "mapped", concept: "unmapped",
      matches: [{ uri: "u", predicate: "skos:exactMatch", via: "t", scheme: "s" }],
    });
    expect(r.success).toBe(false);
  });
});

describe("a file must say what it did NOT ask", () => {
  const body = {
    $schema: "folio-term-mappings/v1",
    checked_at: "2026-09-30",
    mappings: [],
  };

  test("a scope missing a target is refused", () => {
    const r = TermMappingsFileSchema.safeParse({
      ...body,
      scope: [{ target: "skos", consulted: [], via: "local" }],
    });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r)).toContain("fhir");
  });

  test("both targets, one of them with an empty consulted list, parses", () => {
    // An empty list is a DETERMINED finding — nothing is declared for that
    // target — not a missing field.
    expect(
      TermMappingsFileSchema.safeParse({
        ...body,
        scope: MAPPING_TARGETS.map((target) => ({ target, consulted: [], via: "local" })),
      }).success,
    ).toBe(true);
  });
});

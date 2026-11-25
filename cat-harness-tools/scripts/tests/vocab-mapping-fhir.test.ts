/**
 * Vocabulary mapping tables, relationship and SKOS correspondence, the
 * `vocab-map` Tool applier, and the `vocab-mappings:check` gate (bean `k74z`,
 * owner 2026-10-02; FHIR ConceptMap ι/π round-trip tests moved with
 * `vocab-mapping-fhir.ts` under bean `f8wp`).
 */
import { describe, expect, test } from "bun:test";

import {
  R4_EQUIVALENCES,
  R4_TO_R5_RELATIONSHIP,
  R5_TO_R4_EQUIVALENCE,
  RELATIONSHIPS,
  RELATIONSHIP_FOR_SKOS,
  SKOS_MATCH_FOR,
  STANDARD_PREFIXES,
  VOCAB_MAPPING_SCHEMA,
  VocabMappingSchema,
  applyVocabMapping,
  expandCurie,
  type VocabMapping,
} from "../../schemas/content/vocab-mapping.ts";
import { ownPrefixTable } from "../../schemas/kg/graph-typology-registry.js";
import { tableFindings } from "../vocab-mappings";

/** The `sl9u` scheme row: one label, SKOS authoritative, DC a derived copy. */
const SCHEME: VocabMapping = VocabMappingSchema.parse({
  $schema: VOCAB_MAPPING_SCHEMA,
  id: "test-scheme",
  status: "draft",
  group: [
    {
      source: "cat-harness:GlossaryScheme",
      target: "skos:",
      element: [
        { code: "label", target: [{ code: "prefLabel", relationship: "equivalent" }] },
        { code: "definition", target: [{ code: "definition", relationship: "equivalent" }] },
        { code: "retired", target: [{ code: "deprecated", relationship: "equivalent", transform: "flag" }] },
      ],
    },
    {
      source: "cat-harness:GlossaryScheme",
      target: "dcterms:",
      element: [
        { code: "label", target: [{ code: "title", relationship: "equivalent", authority: "derived", derivedFrom: "prefLabel" }] },
        { code: "usages", target: [{ code: "hasLaneUsage", key: "usage", relationship: "equivalent" }] },
      ],
    },
  ],
});

describe("relationship tables", () => {
  test("R5 → R4 → R5 is the identity on every R5 code", () => {
    for (const r of RELATIONSHIPS) expect(R4_TO_R5_RELATIONSHIP[R5_TO_R4_EQUIVALENCE[r]]).toBe(r);
  });
  test("every R4 code has an R5 relationship", () => {
    for (const e of R4_EQUIVALENCES) expect(RELATIONSHIPS).toContain(R4_TO_R5_RELATIONSHIP[e]);
  });
  test("SKOS: each match property reads back as the relationship that writes it", () => {
    for (const r of RELATIONSHIPS) {
      const p = SKOS_MATCH_FOR[r];
      if (p !== undefined) expect(RELATIONSHIP_FOR_SKOS[p]).toBe(r);
    }
    expect(SKOS_MATCH_FOR["not-related-to"]).toBeUndefined();
    expect(RELATIONSHIP_FOR_SKOS["skos:closeMatch"]).toBe("related-to");
  });
});

describe("expandCurie", () => {
  test("expands a known CURIE and leaves IRIs, URNs and unknown prefixes as written", () => {
    expect(expandCurie("skos:prefLabel", STANDARD_PREFIXES)).toBe("http://www.w3.org/2004/02/skos/core#prefLabel");
    expect(expandCurie("http://example.org/a", STANDARD_PREFIXES)).toBe("http://example.org/a");
    expect(expandCurie("urn:ietf:rfc:3986", STANDARD_PREFIXES)).toBe("urn:ietf:rfc:3986");
    expect(expandCurie("unknown:term", STANDARD_PREFIXES)).toBe("unknown:term");
  });
});

describe("applying a table (the vocab-map Tool)", () => {
  test("a derived target sits after its source and copies its value; absent values write nothing", () => {
    expect(applyVocabMapping(SCHEME, { label: "L", definition: "D", retired: false, usages: [] })).toEqual({ prefLabel: "L", title: "L", definition: "D" });
    expect(Object.keys(applyVocabMapping(SCHEME, { label: "L", definition: "D", retired: 1, usages: ["u"] }))).toEqual(["prefLabel", "title", "definition", "deprecated", "usage"]);
    expect(applyVocabMapping(SCHEME, { definition: "D" })).toEqual({ definition: "D" });
  });
  test("two rows writing one key is refused", () => {
    const twice = VocabMappingSchema.parse({ ...SCHEME, group: [SCHEME.group[0], SCHEME.group[0]] });
    expect(() => applyVocabMapping(twice, { label: "L" })).toThrow(/two rows write "prefLabel"/);
  });
  test("a derived target must name its source, and only a derived one may", () => {
    const bad = { ...SCHEME, group: [{ ...SCHEME.group[1], element: [{ code: "label", target: [{ code: "title", relationship: "equivalent", authority: "derived" }] }] }] };
    expect(VocabMappingSchema.safeParse(bad).success).toBe(false);
  });
});

describe("the vocab-mappings:check gate's own judgements", () => {
  test("a clean table passes; a derived target with no authoritative source, and an undeclared prefix, are each a finding", () => {
    const prefixes = { ...STANDARD_PREFIXES, ...ownPrefixTable() };
    expect(tableFindings(SCHEME, prefixes)).toEqual([]);
    const orphan = VocabMappingSchema.parse({
      ...SCHEME,
      group: [{ ...SCHEME.group[1], element: [{ code: "label", target: [{ code: "title", relationship: "equivalent", authority: "derived", derivedFrom: "prefLabel" }] }] }],
    });
    expect(tableFindings(orphan, prefixes).join("\n")).toMatch(/derives from "prefLabel", which no authoritative target/);
    const unknown = VocabMappingSchema.parse({ ...SCHEME, group: [{ ...SCHEME.group[0], target: "nope:" }] });
    expect(tableFindings(unknown, prefixes).join("\n")).toMatch(/"nope:" uses an undeclared prefix/);
  });
});

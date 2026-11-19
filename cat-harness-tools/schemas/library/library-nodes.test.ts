/**
 * The library's JSON-LD nodes are routed to the class they instantiate and
 * parsed by its schema. The block fixture is one aai-programme held for a day
 * with no `@type` (2026-10-21), and what regeneration made of it.
 */
import { describe, expect, test } from "bun:test";

import { familyBody, nodeFamilyTag, resolveNodeSchemas } from "../kg/kind-validator.ts";
import { LIBRARY_NODE_FAMILIES, LibraryBlockSchema, LibrarySectionSchema, LibrarySourceDocumentSchema, libraryNodeClass } from "./library-nodes.ts";

import { requireHarnessRoot } from "../harness-root.ts";
const HARNESS = requireHarnessRoot();
const ctx = ["https://example.org/ns/context/v1.jsonld", { "@base": "https://example.org/" }];
const doc = "https://example.org/library/d/manifest.jsonld";
const untyped = { "@context": ctx, "@id": "library/d/blocks/prose-s024", kind: "prose", title: "11. Automation", text: "../sections/s024.md", derivedFrom: doc, sourceDocument: doc, provenance: "ingested" };
const block = { ...untyped, "@type": ["folio-assistant-core:Prose", "doco:Section"] };
const section = { "@context": ctx, "@id": "library/d/sections/s024", "@type": ["doco:Section"], title: "11. Automation", contains: [block["@id"]], derivedFrom: doc, sourceDocument: doc, provenance: "ingested" };
const manifest = { "@context": ctx, "@id": doc, "@type": [LIBRARY_NODE_FAMILIES.sourceDocument], title: "A source", contains: [section["@id"]], provenance: "ingested", meta: { doc_id: "d" }, license: "CC-BY-4.0" };

describe("library JSON-LD node families", () => {
  test("each class resolves to a runnable schema", async () => {
    const fams = new Map((await resolveNodeSchemas("library", HARNESS)).map((f) => [f.tag, f.state]));
    for (const tag of Object.values(LIBRARY_NODE_FAMILIES)) expect(fams.get(tag)).toBe("resolved");
  });

  test("a node is routed by the class it instantiates: a prose block, which is also doco:Section, is a block", () => {
    expect(nodeFamilyTag(manifest)).toBe(LIBRARY_NODE_FAMILIES.sourceDocument);
    expect(nodeFamilyTag(section)).toBe(LIBRARY_NODE_FAMILIES.section);
    expect(nodeFamilyTag(block)).toBe(LIBRARY_NODE_FAMILIES.block);
    expect(nodeFamilyTag(untyped)).toBe(LIBRARY_NODE_FAMILIES.block);
    expect(libraryNodeClass({ kind: "prose" })).toBeUndefined(); // not JSON-LD
    expect(nodeFamilyTag({ $schema: "a/v1", "@context": ctx, kind: "x" })).toBe("a/v1");
  });

  test("each parses what the generator writes", () => {
    expect(LibrarySourceDocumentSchema.safeParse(familyBody(manifest)).success).toBe(true);
    expect(LibrarySectionSchema.safeParse(familyBody(section)).success).toBe(true);
    expect(LibraryBlockSchema.safeParse(familyBody(block)).success).toBe(true);
  });

  test("a block with no @type, or a key nobody declared, is invalid", () => {
    expect(LibraryBlockSchema.safeParse(familyBody(untyped)).success).toBe(false);
    expect(LibraryBlockSchema.safeParse({ ...block, extra: 1 }).success).toBe(false);
    expect(LibrarySectionSchema.safeParse({ ...section, "@type": ["doco:Section", "x:Y"] }).success).toBe(false);
    expect(LibrarySourceDocumentSchema.safeParse({ ...manifest, "@type": ["doco:Section"] }).success).toBe(false);
  });
});

describe("a Stage B requirement block (cat-harness-tools#1356)", () => {
  const req = {
    ...untyped,
    "@id": "library/d/blocks/indicator-s024-01",
    kind: "indicator",
    title: "Density of health workers per 10 000 population",
    text: "indicator-s024-01.md",
    derivedFrom: "library/d/sections/s024",
  };

  test("a kind with no DoCO co-type has one @type, and its meta is the source's facts", () => {
    const typed = { ...req, "@type": ["layer:Indicator"], meta: { source_number: "1-01", source_kind: "nhwa-indicator" } };
    expect(LibraryBlockSchema.safeParse(familyBody(typed)).success).toBe(true);
    // The generic class, when no mounted layer types the kind.
    expect(LibraryBlockSchema.safeParse(familyBody({ ...req, "@type": [LIBRARY_NODE_FAMILIES.block] })).success).toBe(true);
  });

  test("meta holds strings only, and a third type is still refused", () => {
    expect(LibraryBlockSchema.safeParse(familyBody({ ...req, "@type": ["layer:Indicator"], meta: { n: 1 } })).success).toBe(false);
    expect(LibraryBlockSchema.safeParse(familyBody({ ...block, "@type": ["a:B", "doco:Section", "c:D"] })).success).toBe(false);
  });
});

describe("candidates.json (ingest-candidates/v1)", () => {
  test("what extract-candidates writes, and a hand-written record without whole-document fields, both parse", async () => {
    const { IngestCandidatesSchema } = await import("./ingest-candidates.ts");
    const cand = { kind: "indicator", number: "1-01", name: "Density", statement: "Density …", section_file: "sections/sec-023-x.md", pages: "51-53", formalization_candidate: false, route_to: "l2-dak-authoring" };
    expect(IngestCandidatesSchema.safeParse({ _schema: "ingest-candidates/v1", doc_id: "d", candidates: [cand] }).success).toBe(true);
    expect(
      IngestCandidatesSchema.safeParse({
        _schema: "ingest-candidates/v1", doc_id: "d", document_class: "who-l1", validated: false, aspects: ["requirements"],
        disposition: "proposals only", summary: { candidates: 1, by_kind: { indicator: 1 }, formalization_candidates: 0 },
        candidates: [{ ...cand, aspect: "requirements", grade_nearby: false }],
      }).success,
    ).toBe(true);
    expect(IngestCandidatesSchema.safeParse({ _schema: "ingest-candidates/v1", candidates: [{ ...cand, section_file: "x.md" }] }).success).toBe(false);
  });

  test("the family resolves for the library kind", async () => {
    const fams = new Map((await resolveNodeSchemas("library", HARNESS)).map((f) => [f.tag, f.state]));
    expect(fams.get("ingest-candidates/v1")).toBe("resolved");
  });
});

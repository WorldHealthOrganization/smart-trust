/**
 * The vocabulary-mapping applier and the context derivation, on the two
 * findings they close: D1 (the `sl9u` condition, declared once) and D2
 * (fsh-guts mapping `name` and `description` "exactly as the main export").
 * Bean `lodp`; findings in `docs/proposals/vocabulary-mappings-2026-10-02.md`.
 *
 * D3, the role node named two ways, is asserted in `kg-export.test.ts`, which
 * already holds the built export it needs.
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import jsonld from "jsonld";

import { ownPrefixTable } from "../../../schemas/kg/graph-typology-registry.js";
import { STANDARD_PREFIXES, applyVocabMapping, contextBindings, vocabMapping } from "../../../schemas/content/vocab-mapping.ts";
import { buildFshGutsExport } from "../../fsh-guts-export.ts";
import { buildContext } from "../../kg-export.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
const prefixes = { ...STANDARD_PREFIXES, ...ownPrefixTable() };

/** What `key` expands to under `context`, as a JSON-LD processor reads it. */
async function predicateOf(context: unknown, key: string): Promise<string | undefined> {
  const [node] = (await jsonld.expand({ "@context": context, "@id": "urn:x", [key]: "v" } as never)) as Array<Record<string, unknown>>;
  return Object.keys(node ?? {}).find((k) => !k.startsWith("@"));
}

describe("D1: a concept scheme that is also a document carries a derived dcterms:title", () => {
  const naming = vocabMapping(ROOT, "concept-scheme-naming");

  test("the condition is declared on the row, as a ConceptMap dependsOn on a declared attribute", () => {
    const declared = new Set((naming.additionalAttribute ?? []).map((a) => a["code"]));
    const conditioned = naming.group.flatMap((g) => g.element.flatMap((e) => (e.target ?? []).filter((t) => t.dependsOn !== undefined)));
    expect(conditioned.map((t) => [t.code, t.authority, t.derivedFrom])).toEqual([["title", "derived", "prefLabel"]]);
    for (const t of conditioned) for (const d of t.dependsOn!) expect(declared.has(d.attribute)).toBe(true);
  });

  test("a scheme that is a document gets the title, copied from the label", () => {
    expect(applyVocabMapping(naming, { label: "x glossary", isDocument: true })).toEqual({ prefLabel: "x glossary", title: "x glossary" });
  });

  test("a scheme that is not a document gets the label only", () => {
    // Rows 24 and 30 of the inventory: a code list's `<doc>#<list>` and an
    // authored glossary's `<ns>glossary/<id>` are schemes, not documents.
    expect(applyVocabMapping(naming, { label: "x", isDocument: false })).toEqual({ prefLabel: "x" });
  });

  test("an emitter that does not answer the condition is refused, not defaulted", () => {
    // The whole point of declaring it: the next emitter cannot skip the
    // question by leaving the attribute out.
    expect(() => applyVocabMapping(naming, { label: "x" })).toThrow(/isDocument/);
  });
});

describe("D2: fsh-guts maps name and description exactly as the main export does", () => {
  test("both documents expand name and description to the same predicates", async () => {
    const fsh = buildFshGutsExport(ROOT)["@context"];
    const kg = buildContext();
    for (const key of ["name", "description"]) {
      expect([key, await predicateOf(fsh, key)]).toEqual([key, await predicateOf(kg, key)]);
    }
    // And those are the standard ones, not a prefix nobody declared: the
    // literal "rdfs:label" fsh-guts carried expanded to an IRI whose scheme
    // was `rdfs`.
    expect(await predicateOf(fsh, "name")).toBe("http://www.w3.org/2000/01/rdf-schema#label");
    expect(await predicateOf(fsh, "description")).toBe("http://purl.org/dc/terms/description");
  });
});

describe("contextBindings", () => {
  const kgNaming = vocabMapping(ROOT, "kg-node-naming");

  test("keeps a CURIE whose prefix the document declares, and expands one it does not", () => {
    expect(contextBindings([kgNaming], { inContext: { rdfs: "x" }, prefixes })).toEqual({
      name: "rdfs:label",
      title: "http://purl.org/dc/terms/title",
      description: "http://purl.org/dc/terms/description",
      summary: "rdfs:comment",
    });
  });

  test("`only` keeps the named keys and refuses one no row writes", () => {
    expect(Object.keys(contextBindings([kgNaming], { inContext: {}, prefixes, only: ["name"] }))).toEqual(["name"]);
    expect(() => contextBindings([kgNaming], { inContext: {}, prefixes, only: ["nope"] })).toThrow(/nope/);
  });

  test("one key bound to two predicates by two tables is refused", () => {
    const clash = { ...kgNaming, id: "clash", group: [{ target: "skos:", element: [{ code: "title", target: [{ code: "prefLabel", key: "title", relationship: "equivalent" as const }] }] }] };
    expect(() => contextBindings([kgNaming, clash], { inContext: {}, prefixes })).toThrow(/two predicates/);
  });

  test("the role-naming row agrees with kg-node-naming on `title`", () => {
    // Both bind `title`; were they to disagree, kg-export's context could not
    // be built at all.
    expect(contextBindings([kgNaming, vocabMapping(ROOT, "role-naming")], { inContext: {}, prefixes })).toMatchObject({
      title: "http://purl.org/dc/terms/title",
      prefLabel: "http://www.w3.org/2004/02/skos/core#prefLabel",
      notation: "http://www.w3.org/2004/02/skos/core#notation",
    });
  });
});

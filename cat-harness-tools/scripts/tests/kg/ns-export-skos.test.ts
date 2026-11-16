/**
 * The vocabulary emits SKOS — bean `fd6i`, and `lqo9` slice 1.
 *
 * @module scripts/tests/ns-export-skos
 * @graphNode none — a test
 *
 * `skos:` has been bound in the published `@context` since it was written
 * (`schemas/kg/jsonld.ts:551`, and the shipped `ns/content/v1.jsonld`), and
 * `schemas/library/tabular-csvw.ts` states in prose that this graph "already speaks
 * eight published vocabularies — doco, deo, cito, oa, prov, **skos**, dcterms,
 * fhir". Measured while holding the `lqo9` roast, `skos:` was emitted by
 * **zero** nodes. The claim was false, and nothing broke, which is exactly why
 * it survived — the `dh4f` shape one level up, in the vocabulary rather than
 * in a directory.
 *
 * ## Why these assertions are shaped the way they are
 *
 * **Every count is checked against zero before it is checked against anything
 * else.** A suite that asserted "every concept has a definition" would pass
 * perfectly over a document containing no concepts — which is the state this
 * file exists to make impossible, so it is the state the tests have to be
 * unable to sit in. That is `6tkl`, and it has already been introduced here
 * once by a change whose own tests were meant to guard it.
 *
 * **The schemes are checked for members, not merely for existence.** An
 * emitted `skos:ConceptScheme` that nothing is `inScheme` of is a declaration
 * whose consumer scans nothing and reports a clean run — `dh4f` again.
 */
import { describe, expect, test } from "bun:test";

import { buildVocabulary } from "../../ns-export.ts";
import { CONTENT_CONTEXT, DCTERMS_NS, SKOS_NS } from "../../../schemas/kg/jsonld.ts";

type Node = Record<string, unknown>;
interface Doc {
  "@context": Record<string, unknown>;
  "@id": string;
  "@type": string | string[];
  "@graph": Node[];
}

const typesOf = (n: Node | Doc): string[] => {
  const t = (n as Node)["@type"];
  return Array.isArray(t) ? (t as string[]) : typeof t === "string" ? [t] : [];
};
const build = (layer?: "bootstrap" | "harness" | "core", exact = false): Doc =>
  buildVocabulary(undefined, layer, exact).doc as Doc;

const conceptsOf = (d: Doc): Node[] =>
  d["@graph"].filter((n) => typesOf(n).includes("skos:Concept") && !typesOf(n).includes("skos:ConceptScheme"));
const schemesOf = (d: Doc): Node[] => d["@graph"].filter((n) => typesOf(n).includes("skos:ConceptScheme"));

describe("the folio vocabulary emits SKOS", () => {
  test("it emits concepts AT ALL — the zero `fd6i` measured must not pass", () => {
    // The load-bearing assertion in this file. Everything below is about the
    // SHAPE of the emission and would pass over an empty graph.
    const concepts = conceptsOf(build());
    expect(concepts.length).toBeGreaterThan(0);
    // ...and not a token handful. 110 terms are authored in `vocabulary.ts`
    // plus the graph typologies' own summaries, so a collapse to a stub is caught
    // rather than read as a refactor.
    expect(concepts.length).toBeGreaterThan(100);
  });

  test("every concept carries prefLabel, definition, notation and inScheme", () => {
    const concepts = conceptsOf(build());
    expect(concepts.length).toBeGreaterThan(0);

    const missing = concepts
      .filter((c) => !c.prefLabel || !c.definition || !c.notation || !c.inScheme)
      .map((c) => String(c["@id"]));
    expect(missing).toEqual([]);
  });

  test("the SKOS labels AGREE with the RDFS ones rather than drifting", () => {
    // `skos:prefLabel` is a declared sub-property of `rdfs:label`, so the two
    // agreeing is the spec's expectation, not a duplication invented here.
    // Asserted because they are written at two keys and could diverge in one
    // careless edit.
    const concepts = conceptsOf(build());
    expect(concepts.length).toBeGreaterThan(0);

    const disagreeing = concepts
      .filter((c) => c.prefLabel !== c.label || c.definition !== c.comment)
      .map((c) => String(c["@id"]));
    expect(disagreeing).toEqual([]);
  });

  test("`notation` is the CODE — unique across the whole vocabulary", () => {
    // The owner's "coded" ask. It is the prefixed name rather than a field
    // somebody types, so uniqueness is structural; this pins that the prefix
    // really does separate two layers that mint the same local name.
    const concepts = conceptsOf(build());
    expect(concepts.length).toBeGreaterThan(0);

    const seen = new Map<string, string[]>();
    for (const c of concepts) {
      const n = String(c.notation);
      seen.set(n, [...(seen.get(n) ?? []), String(c["@id"])]);
    }
    expect([...seen].filter(([, ids]) => ids.length > 1)).toEqual([]);
  });

  test("every `inScheme` resolves to a scheme IN THIS DOCUMENT", () => {
    // A dangling `inScheme` is a link-shaped value that does not resolve —
    // bean `blv9`, and the reason `ns-export.ts` exists at all.
    for (const layer of [undefined, "bootstrap", "harness", "core"] as const) {
      const doc = build(layer);
      const concepts = conceptsOf(doc);
      expect(concepts.length).toBeGreaterThan(0);

      const ids = new Set(schemesOf(doc).map((s) => String(s["@id"])));
      const dangling = concepts.filter((c) => !ids.has(String(c.inScheme))).map((c) => String(c["@id"]));
      expect({ layer: layer ?? "all", dangling }).toEqual({ layer: layer ?? "all", dangling: [] });
    }
  });

  test("a scheme is emitted only where it has members — never an empty one", () => {
    // `dh4f`: a declared-but-empty set whose consumer scans nothing and calls
    // it clean. The bootstrap slice is the discriminating case — it must carry
    // exactly ONE scheme, not the three layers that happen to exist.
    const boot = build("bootstrap");
    expect(schemesOf(boot)).toHaveLength(1);

    for (const layer of [undefined, "bootstrap", "harness", "core"] as const) {
      const doc = build(layer);
      const members = new Set(conceptsOf(doc).map((c) => String(c.inScheme)));
      const empty = schemesOf(doc)
        .map((s) => String(s["@id"]))
        .filter((id) => !members.has(id));
      expect({ layer: layer ?? "all", empty }).toEqual({ layer: layer ?? "all", empty: [] });
    }
  });

  test("the scheme set GROWS with the slice — derived, not hardcoded", () => {
    const counts = (["bootstrap", "harness", "core"] as const).map((l) => schemesOf(build(l)).length);
    expect(counts).toEqual([1, 2, 3]);
  });

  test("in --exact mode the DOCUMENT is the scheme, with no duplicate @id", () => {
    for (const layer of ["bootstrap", "harness", "core"] as const) {
      const doc = build(layer, true);
      expect(typesOf(doc)).toContain("skos:ConceptScheme");
      // ...and it does not also appear inside its own `@graph`.
      const dupes = doc["@graph"].filter((n) => n["@id"] === doc["@id"]).map((n) => String(n["@id"]));
      expect({ layer, dupes }).toEqual({ layer, dupes: [] });

      const ids = new Set([doc["@id"], ...schemesOf(doc).map((s) => String(s["@id"]))]);
      const dangling = conceptsOf(doc).filter((c) => !ids.has(String(c.inScheme)));
      expect({ layer, dangling: dangling.length }).toEqual({ layer, dangling: 0 });
    }
  });

  test("the document's @context binds skos:, and so does the content context", () => {
    // Both halves, because the false claim `fd6i` records lives in the CONTENT
    // context while the emission lands in this one. A binding in one and terms
    // in the other would leave the claim exactly as false as it was.
    const ctx = build()["@context"];
    expect(ctx.skos).toBe("http://www.w3.org/2004/02/skos/core#");
    expect(CONTENT_CONTEXT.skos).toBe("http://www.w3.org/2004/02/skos/core#");
  });

  test("the locally-declared namespaces EQUAL the ones in jsonld.ts", () => {
    // `ns-export.ts` is `agentic-harness` and `schemas/kg/jsonld.ts` is
    // `folio-assist-core`, so importing the constants there would be a
    // wrong-direction edge `check:partition` refuses. They are therefore
    // declared twice — and this is what makes that duplicate a CHECKED one.
    // A test may cross the boundary where source may not.
    const ctx = build()["@context"];
    expect(ctx.skos).toBe(SKOS_NS);
    expect(ctx.dcterms).toBe(DCTERMS_NS);
  });

  test("the RDFS facts are UNTOUCHED — this adds, it does not replace", () => {
    // Every existing consumer reads `label`/`comment`/`isDefinedBy`. A SKOS
    // emission that quietly dropped them would be a breaking change wearing a
    // feature's clothes.
    const concepts = conceptsOf(build());
    expect(concepts.length).toBeGreaterThan(0);

    const broken = concepts
      .filter((c) => !c.label || !c.comment || !c.isDefinedBy || !c.layer)
      .map((c) => String(c["@id"]));
    expect(broken).toEqual([]);

    // A term is a class or a property — or, since bootstrap's vocabulary names
    // its Graph Typologies (2026-09-30), a named INDIVIDUAL typed by its class,
    // `bootstrap:GraphTypology`: `skills` is a Graph Typology, not a class of things.
    const rdfsTyped = concepts.filter((c) =>
      typesOf(c).some((t) => t === "rdfs:Class" || t === "rdf:Property" || t === "bootstrap:GraphTypology"),
    );
    expect(rdfsTyped).toHaveLength(concepts.length);
  });
});

describe("bootstrap's terms have ONE source (owner, 2026-09-30: how can it not drift?)", () => {
  test("every bootstrap node the harness build holds IS bootstrap's own file's node", async () => {
    const { bootstrapVocabulary } = await import("../../ns-export.ts");
    const file = bootstrapVocabulary()["@graph"];
    const built = (buildVocabulary().doc as { "@graph": Record<string, unknown>[] })["@graph"].filter((n) =>
      String(n["@id"]).startsWith("bootstrap:"),
    );
    expect(built.map(({ layer: _layer, ...n }) => n)).toEqual(file);
  });
});

/**
 * Automated matches in a scheme's SKOS JSON-LD are LINKS, and are marked as
 * a program's work. Owner, 2026-10-02 (issue #1836).
 *
 * @module scripts/glossary-skos-automated.test
 * @graphNode none — a test
 *
 * The falsifier is a real processor, as the `linked-data` voice asks: the
 * emitted document is expanded and converted to quads by jsonld.js, with
 * every context served from the copy held in the repository, and these tests
 * read the QUADS rather than the JSON we wrote. A match that came out as
 * `{"@value": …}`, landed in the default graph, or lost its provenance chain
 * fails here even if the JSON looks right.
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import jsonld from "jsonld";

import { localLoader } from "@litlfred/cat-harness-tools/scripts/publish-verify.ts";
import type { SchemeState } from "@litlfred/cat-harness-tools/scripts/check-term-mapping.ts";
import { AUTOMATED_RUN, automatedGraphIri, termIri, toSkos, type Glossary } from "../schemas/glossary.ts";
import { MATCHING_AGENT, automatedMatches, matchingAgentIri, sourceKey, type GlossarySource } from "./glossary-page.ts";
import { checkoutRootFor } from "./lib/checkout-root.ts";

const REPO = checkoutRootFor(resolve(import.meta.dir, ".."));
const SKOS = "http://www.w3.org/2004/02/skos/core#";
const PROV = "http://www.w3.org/ns/prov#";
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const NS_A = "https://example.org/a/v0/ns#";
const NS_B = "https://example.org/b/v0/ns#";
const ODRL = "http://www.w3.org/ns/odrl/2/Policy";

const glossary = (id: string, terms: unknown[]): Glossary =>
  ({ $schema: "folio-glossary/v1", id, title: id, terms }) as unknown as Glossary;
const source = (instance: string, ns: string, g: Glossary): GlossarySource => ({ instance, ns, file: `${g.id}.json`, glossary: g });

// Two layers each hold an authored `platform` scheme, which is the real
// layout: `platform:actor` therefore names two terms and has no single IRI.
const platformA = source("a", NS_A, glossary("platform", [
  { id: "policy", prefLabel: "Policy", status: "authored", exactMatch: [ODRL] },
  { id: "actor", prefLabel: "Actor", status: "authored" },
  { id: "ledger", prefLabel: "Ledger", status: "authored" },
]));
const platformB = source("b", NS_B, glossary("platform", [{ id: "actor", prefLabel: "Actor", status: "authored" }]));
const tools = source("a", NS_A, glossary("kg-tools", [
  { id: "policy", prefLabel: "Policy", status: "candidate" },
  { id: "participant", prefLabel: "Participant", status: "candidate" },
  { id: "book", prefLabel: "Book", status: "candidate" },
  { id: "wombat", prefLabel: "Wombat", status: "candidate" },
]));
const sources = [platformA, platformB, tools];

const row = (target: string, mappedTerms: SchemeState["mappedTerms"]): SchemeState => ({
  instance: "a",
  scheme: "kg-tools",
  target,
  mapped: mappedTerms.length,
  unmapped: 4 - mappedTerms.length,
  undetermined: 0,
  mappedTerms,
});
const states: SchemeState[] = [
  row("skos", [
    // exact: the prefLabel of a concept with an external URI
    { term: "policy", exact: true, concepts: [ODRL], exactConcepts: [ODRL] },
    // concept-only, via an in-repo id that two layers hold: unresolvable
    { term: "participant", exact: false, concepts: ["platform:actor"], exactConcepts: [] },
    // concept-only, via an in-repo id exactly one layer holds
    { term: "book", exact: false, concepts: ["platform:ledger"], exactConcepts: [] },
  ]),
  row("fhir", [{ term: "book", exact: false, concepts: ["http://example.org/cs#book"], exactConcepts: [] }]),
];

const AGENT = "https://example.org/a/v0/scenarios/actors/ci-pipeline";
const { bySource, unresolved } = automatedMatches(states, sources);
const doc = toSkos(tools.glossary, tools.ns, { matches: bySource.get(sourceKey(tools))!, agent: AGENT });

interface Quad {
  subject: { termType: string; value: string };
  predicate: { value: string };
  object: { termType: string; value: string };
  graph: { termType: string; value: string };
}
const loader = localLoader(REPO);
const quads = async (d: object): Promise<Quad[]> =>
  (await jsonld.toRDF(d as never, { documentLoader: loader } as never)) as unknown as Quad[];

describe("automatedMatches — the record, resolved to links or left out", () => {
  test("exactAndCloseMatches", () => {
    const got = bySource.get(sourceKey(tools))!;
    expect(got.find((m) => m.term === "policy")).toEqual({ term: "policy", exactMatch: [ODRL], closeMatch: [] });
    // merged across targets: skos gave the in-repo concept, fhir the code
    expect(got.find((m) => m.term === "book")).toEqual({
      term: "book",
      exactMatch: [],
      closeMatch: [termIri(NS_A, { id: "platform" }, "ledger"), "http://example.org/cs#book"],
    });
  });

  test("twoInstanceIdNotPublished", () => {
    expect(bySource.get(sourceKey(tools))!.some((m) => m.term === "participant")).toBe(false);
    expect(unresolved.some((u) => u.includes("platform:actor") && u.includes("2 authored terms"))).toBe(true);
  });

  test("otherInstanceOwnKey", () => {
    const other = source("b", NS_B, glossary("kg-tools", [{ id: "policy", prefLabel: "Policy", status: "candidate" }]));
    const r = automatedMatches(states, [...sources, other]);
    expect(r.bySource.get(sourceKey(tools))!.some((m) => m.term === "policy")).toBe(true);
    expect(r.bySource.has(sourceKey(other))).toBe(false);
    expect(r.unresolved.some((u) => u.includes("candidate entries"))).toBe(false);
  });

  test("sharedCandidateKeyReported", () => {
    const twin = { ...source("a", NS_A, glossary("kg-tools", [{ id: "policy", prefLabel: "Policy", status: "candidate" }])), file: "twin.json" };
    const r = automatedMatches(states, [...sources, twin]);
    expect([...r.bySource.values()].flat().some((m) => m.term === "policy")).toBe(false);
    expect(r.unresolved.some((u) => u.includes("`policy`") && u.includes("2 candidate entries"))).toBe(true);
  });

  test("noResultPublishesNothing", () => {
    expect(automatedMatches(undefined, sources).bySource.size).toBe(0);
  });
});

describe("the emitted SKOS, read through jsonld.js", () => {
  const graph = automatedGraphIri(NS_A, { id: "kg-tools" });
  const policy = termIri(NS_A, { id: "kg-tools" }, "policy");
  const book = termIri(NS_A, { id: "kg-tools" }, "book");

  const eventsOf = async (d: object) => {
    const events: string[] = [];
    const ex = await jsonld.expand(d as never, {
      documentLoader: loader,
      eventHandler: ({ event }: { event: { code: string } }) => events.push(event.code),
    } as never);
    return { ex, events };
  };
  // The shape `outputs()` writes: `_generated` second.
  const published = (d: Record<string, unknown>) => {
    const { "@context": context, ...rest } = d;
    return { "@context": context, _generated: "generated — do not hand-edit", ...rest };
  };

  test("provAddsNoWarning", async () => {
    // `_generated` is an unmapped key, dropped by design (see `outputs()`),
    // and jsonld.js reports the drop as "invalid property" under the plain
    // context today. The PROV context must not add anything to that.
    const before = await eventsOf(published(toSkos(tools.glossary, tools.ns)));
    const after = await eventsOf(published(doc));
    expect(after.events).toEqual(before.events);
  });

  test("expandsWithoutWarning", async () => {
    const { ex, events } = await eventsOf(doc);
    expect(events).toEqual([]);
    const text = JSON.stringify(ex);
    for (const p of ["exactMatch", "closeMatch"]) {
      const re = new RegExp(`"${SKOS}${p}":\\[([^\\]]*)\\]`, "g");
      const vals = [...text.matchAll(re)].map((m) => m[1]!);
      expect(vals.length).toBeGreaterThan(0);
      for (const v of vals) {
        expect(v).toContain('"@id"');
        expect(v).not.toContain('"@value"');
      }
    }
  });

  test("matchesInNamedGraph", async () => {
    const q = await quads(doc);
    const matches = q.filter((x) => x.predicate.value === `${SKOS}exactMatch` || x.predicate.value === `${SKOS}closeMatch`);
    expect(matches.length).toBe(3);
    for (const m of matches) {
      expect(m.object.termType).toBe("NamedNode");
      expect(m.graph.value).toBe(graph);
    }
    expect(matches.find((m) => m.subject.value === policy && m.predicate.value === `${SKOS}exactMatch`)?.object.value).toBe(ODRL);
    expect(matches.filter((m) => m.subject.value === book).map((m) => m.predicate.value)).toEqual([
      `${SKOS}closeMatch`,
      `${SKOS}closeMatch`,
    ]);
  });

  test("namedGraphProvChain", async () => {
    const q = (await quads(doc)).filter((x) => x.graph.termType === "DefaultGraph");
    const obj = (s: string, p: string) => q.filter((x) => x.subject.value === s && x.predicate.value === p).map((x) => x.object);
    expect(obj(graph, RDF_TYPE).map((o) => o.value)).toContain(`${PROV}Entity`);
    const gen = obj(graph, `${PROV}qualifiedGeneration`);
    expect(gen.length).toBe(1);
    const run = obj(gen[0]!.value, `${PROV}activity`);
    expect(run.length).toBe(1);
    expect(run[0]!.termType).toBe("BlankNode");
    expect(obj(run[0]!.value, RDF_TYPE).map((o) => o.value)).toContain(`${PROV}Activity`);
    const assoc = obj(run[0]!.value, `${PROV}qualifiedAssociation`);
    expect(assoc.length).toBe(1);
    const agent = obj(assoc[0]!.value, `${PROV}agent`);
    expect(agent.map((a) => [a.termType, a.value])).toEqual([["NamedNode", AGENT]]);
    expect(obj(AGENT, RDF_TYPE).map((o) => o.value)).toEqual([`${PROV}SoftwareAgent`]);
  });

  test("agentWithoutAddressBlank", async () => {
    const d = toSkos(tools.glossary, tools.ns, { matches: bySource.get(sourceKey(tools))!, agent: undefined });
    const q = (await quads(d)).filter((x) => x.predicate.value === `${PROV}agent`);
    expect(q.length).toBe(1);
    expect(q[0]!.object.termType).toBe("BlankNode");
  });

  test("runIsBlankNode", () => {
    expect(AUTOMATED_RUN.startsWith("_:")).toBe(true);
  });

  test("noMatchesUnchanged", () => {
    const plain = toSkos(tools.glossary, tools.ns);
    expect(toSkos(tools.glossary, tools.ns, { matches: [], agent: AGENT })).toEqual(plain);
    expect(Array.isArray(plain["@context"])).toBe(false);
  });
});

describe("the matching agent is a declared actor with a release address", () => {
  test("matchingAgentResolves", () => {
    const iri = matchingAgentIri(REPO);
    expect(iri).toBeDefined();
    expect(iri!).toMatch(new RegExp(`/scenarios/actors/${MATCHING_AGENT}$`));
  });
});

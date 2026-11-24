/**
 * A term about an architecture element (owner, 2026-11-01, smart-ra#166:
 * the whole model from the graph, relationships on each glossary term). The
 * concept keeps the words; `foaf:focus` points at the element, which carries
 * its ArchiMate type and its relationships to other terms' elements.
 */
import { describe, expect, test } from "bun:test";

import { GlossarySchema, termIri, toSkos } from "./glossary.ts";

const NS = "https://example.org/v0/ns#";

const raw = {
  $schema: "folio-glossary/v1",
  id: "ra",
  title: "RA",
  terms: [
    {
      id: "client-registry",
      prefLabel: "Client Registry",
      status: "candidate",
      focus: { archimate: "ApplicationComponent", relationships: [{ type: "Realization", target: "client-identification" }] },
    },
    { id: "client-identification", prefLabel: "Client identification", status: "candidate", focus: { archimate: "ApplicationService" } },
    {
      id: "point-of-service",
      prefLabel: "Point of service",
      status: "candidate",
      focus: { archimate: "ApplicationComponent", relationships: [{ type: "Serving", target: "client-identification" }, { type: "Access", target: "client-record", accessType: "read" }] },
    },
    { id: "client-record", prefLabel: "Client record", status: "candidate", focus: { archimate: "DataObject" } },
  ],
};

describe("foaf:focus on an ArchiMate element", () => {
  const glossary = GlossarySchema.parse(raw);
  const doc = toSkos(glossary, NS) as { "@context": Record<string, string>; "@graph": Array<Record<string, unknown>> };
  const byId = new Map(doc["@graph"].map((n) => [n["@id"] as string, n]));
  const el = (id: string) => `${termIri(NS, glossary, id)}/_focus`;

  test("conceptFocusesArchimateElement", () => {
    expect(byId.get(termIri(NS, glossary, "client-registry"))!["foaf:focus"]).toEqual({ "@id": el("client-registry") });
    expect(byId.get(el("client-registry"))!["@type"]).toBe("archimate:ApplicationComponent");
    expect(doc["@context"].archimate).toBe("http://www.opengroup.org/xsd/archimate/3.1/");
    expect(doc["@context"].org).toBeUndefined();
  });

  test("relationshipIsElementPredicate", () => {
    expect(byId.get(el("client-registry"))!["archimate:realization"]).toEqual([{ "@id": el("client-identification") }]);
    expect(byId.get(el("point-of-service"))!["archimate:serving"]).toEqual([{ "@id": el("client-identification") }]);
    expect(byId.get(el("point-of-service"))!["archimate:access"]).toEqual([{ "@id": el("client-record") }]);
  });

  test("relationshipTargetMustBeElement", () => {
    const withTarget = (target: string) => ({ ...raw, terms: [{ ...raw.terms[0]!, focus: { archimate: "ApplicationComponent", relationships: [{ type: "Serving", target }] } }, ...raw.terms.slice(1), { id: "plain", prefLabel: "Plain", status: "candidate" }] });
    expect(GlossarySchema.safeParse(withTarget("plain")).error?.message).toContain("whose focus is no ArchiMate element");
    expect(GlossarySchema.safeParse(withTarget("nowhere")).error?.message).toContain("neither a term in this glossary nor an absolute IRI");
    expect(GlossarySchema.safeParse(withTarget("https://example.org/el")).success).toBe(true);
    const badAccess = { ...raw, terms: [{ ...raw.terms[0]!, focus: { archimate: "ApplicationComponent", relationships: [{ type: "Serving", target: "client-identification", accessType: "read" }] } }, ...raw.terms.slice(1)] };
    expect(GlossarySchema.safeParse(badAccess).success).toBe(false);
  });
});

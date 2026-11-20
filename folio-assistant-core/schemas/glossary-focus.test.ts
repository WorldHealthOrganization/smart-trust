/**
 * A term about an organization (owner, 2026-10-31, option B: SKOS plus W3C
 * ORG). The concept carries the labels and the acronym; `foaf:focus` points
 * at the organization, which carries its ORG type, homepage and parent.
 */
import { describe, expect, test } from "bun:test";

import { GlossarySchema, focusIri, termIri, toSkos } from "./glossary.ts";

const NS = "https://example.org/v0/ns#";

const glossary = GlossarySchema.parse({
  $schema: "folio-glossary/v1",
  id: "organizations",
  title: "Organizations",
  terms: [
    {
      id: "un",
      prefLabel: "United Nations",
      notation: "UN",
      status: "authored",
      definition: "An intergovernmental organization.",
      focus: { type: "FormalOrganization", homepage: "https://www.un.org/" },
    },
    {
      id: "who",
      prefLabel: "World Health Organization",
      notation: "WHO",
      altLabel: ["WHO"],
      status: "authored",
      definition: "The United Nations agency for health.",
      focus: { type: "FormalOrganization", homepage: "https://www.who.int/", subOrganizationOf: ["un"], sameAs: ["https://ror.org/example"] },
    },
  ],
});

describe("foaf:focus", () => {
  const doc = toSkos(glossary, NS) as { "@context": Record<string, string>; "@graph": Array<Record<string, unknown>> };
  const byId = new Map(doc["@graph"].map((n) => [n["@id"] as string, n]));
  const who = termIri(NS, glossary, "who");
  const whoOrg = `${who}/_focus`;

  test("conceptPointsAtOrganization", () => {
    expect(byId.get(who)!["@type"]).toBe("skos:Concept");
    expect(byId.get(who)!["foaf:focus"]).toEqual({ "@id": whoOrg });
    expect(byId.get(who)!["skos:notation"]).toBe("WHO");
  });

  test("organizationCarriesOrgData", () => {
    const org = byId.get(whoOrg)!;
    expect(org["@type"]).toBe("org:FormalOrganization");
    expect(org["foaf:homepage"]).toEqual({ "@id": "https://www.who.int/" });
    expect(org["org:subOrganizationOf"]).toEqual([{ "@id": `${termIri(NS, glossary, "un")}/_focus` }]);
    expect(org["owl:sameAs"]).toEqual([{ "@id": "https://ror.org/example" }]);
  });

  test("prefixesBoundOnlyWithFocus", () => {
    expect(doc["@context"].org).toBe("http://www.w3.org/ns/org#");
    expect(doc["@context"].foaf).toBe("http://xmlns.com/foaf/0.1/");
    const plain = toSkos(GlossarySchema.parse({ $schema: "folio-glossary/v1", id: "x", title: "X", terms: [] }), NS) as { "@context": Record<string, string> };
    expect(plain["@context"].org).toBeUndefined();
  });

  test("ownIriUsedForOrganization", () => {
    expect(focusIri("https://a/b", { iri: "https://ror.org/x" })).toBe("https://ror.org/x");
    expect(focusIri("https://a/b", {})).toBe("https://a/b/_focus");
  });

  test("subOrganizationNeedsFocusOrIri", () => {
    const bad = (ref: string, withFocus = false) =>
      GlossarySchema.safeParse({
        $schema: "folio-glossary/v1",
        id: "x",
        title: "X",
        terms: [
          { id: "plain", prefLabel: "Plain", status: "candidate", ...(withFocus ? { focus: { type: "Organization" } } : {}) },
          { id: "child", prefLabel: "Child", status: "candidate", focus: { type: "OrganizationalUnit", subOrganizationOf: [ref] } },
        ],
      }).success;
    expect(bad("plain")).toBe(false);
    expect(bad("nowhere")).toBe(false);
    expect(bad("plain", true)).toBe(true);
    expect(bad("https://example.org/org")).toBe(true);
  });

  test("unknownOrgTypeRefused", () => {
    const r = GlossarySchema.safeParse({
      $schema: "folio-glossary/v1",
      id: "x",
      title: "X",
      terms: [{ id: "a", prefLabel: "A", status: "candidate", focus: { type: "Company" } }],
    });
    expect(r.success).toBe(false);
  });
});

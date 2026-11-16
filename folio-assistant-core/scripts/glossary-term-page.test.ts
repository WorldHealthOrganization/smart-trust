/**
 * One page per authored term (folio-assistant-core#498, owner 2026-11-01,
 * Q-GLO-2 A): its glossary row is the defining site (Q-GLO-3 C), and the
 * narrative passages that explain or use it are listed as provenance.
 */
import { describe, expect, test } from "bun:test";

import { renderAuthoredPage, renderTermPage, setProvenance, termPagesOf, termPermalink, type GlossarySource } from "./glossary-page.ts";
import type { Passage } from "./term-passages.ts";

const ns = "https://example.org/hb/v0/ns#";
const hb: GlossarySource = {
  instance: "hb",
  ns,
  file: "glossary/hb.glossary.json",
  declaredBy: "hb",
  glossary: {
    $schema: "folio-glossary/v1",
    id: "hb",
    title: "Handbook",
    terms: [
      { id: "component", prefLabel: "Application Component", notation: "AC", status: "authored", definition: "A piece of software.", source: "folio/doc/glossary/t-gloss.md", broader: ["element"], related: ["service"] },
      { id: "element", prefLabel: "Element", status: "authored", definition: "A thing in the model." },
      { id: "service", prefLabel: "Application Service", status: "candidate" },
    ],
  } as GlossarySource["glossary"],
};
const c = { glossaries: [hb] } as never;
const passage = (kind: Passage["kind"], label: string): Passage => ({
  kind,
  document: "doc",
  section: `Section ${label}`,
  label,
  href: `en/doc/index.html#${label}`,
  source: `folio/doc/${label}.md`,
  excerpt: `words around ${label}`,
});

describe("term pages", () => {
  setProvenance(
    new Map([["hb--hb--component", [passage("explains", "p-c1"), passage("mentions", "p-3")]]]),
    new Map([["folio/doc/glossary/t-gloss", "en/doc/index.html#tbl:glossary"]]),
  );
  const page = renderTermPage(c, hb, hb.glossary.terms[0]!);

  test("onePagePerTerm", () => {
    expect(termPermalink(hb, "component")).toMatch(/\/instance\/hb\/hb\/component\/$/);
    expect([...termPagesOf(c).keys()].map((p) => p.split("/").slice(-3, -1).join("/"))).toEqual(["hb/component", "hb/element", "hb/service"]);
    expect(page).toContain(`permalink: ${termPermalink(hb, "component")}`);
    expect(page).toContain("nav_exclude: true");
  });

  test("definingSiteIsRow", () => {
    expect(page).toContain("<h2>Defined in</h2>");
    expect(page).toContain("{{ '/en/doc/index.html#tbl:glossary' | relative_url }}");
    expect(page).toContain("#hb--hb--component' | relative_url }}\">glossary entry</a>");
  });

  test("broaderNarrowerRelatedLink", () => {
    expect(page).toContain("<h2>Broader</h2>");
    expect(page).toContain(`{{ '${termPermalink(hb, "element")}' | relative_url }}`);
    expect(page).toContain("<h2>Related</h2>");
    const element = renderTermPage(c, hb, hb.glossary.terms[1]!);
    expect(element).toContain("<h2>Narrower</h2>");
    expect(element).toContain(`{{ '${termPermalink(hb, "component")}' | relative_url }}`);
  });

  test("passagesAsProvenance", () => {
    expect(page.indexOf("Explained in:")).toBeLessThan(page.indexOf("Used in:"));
    expect(page).toContain("{{ '/en/doc/index.html#p-c1' | relative_url }}");
    expect(page).toContain('"prov:wasDerivedFrom"');
    expect(page).toContain('"dcterms:isReferencedBy"');
    expect(page).toContain(`"@id": "${ns}glossary/hb/component"`);
  });

  test("noPassageSaysSo", () => {
    expect(renderTermPage(c, hb, hb.glossary.terms[2]!)).toContain("No passage of a document in this folio names this term.");
  });

  test("glossaryRowLinksTermPage", () => {
    expect(renderAuthoredPage(c, "@hb")).toContain(`<a href="{{ '${termPermalink(hb, "component")}' | relative_url }}">Term page</a>`);
  });
});

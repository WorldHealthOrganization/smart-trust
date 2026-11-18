import { describe, expect, test } from "bun:test";

import { externalGlossaryNote, withExternalGlossaries } from "./external-glossaries.ts";

const g = [{ id: "hrhis-registry-2015", url: "https://example.org/ns/glossary/hrhis-registry-2015/", title: "HRHIS registry glossary (2015)" }];

describe("external glossaries", () => {
  test("noteLinksNotDefinitional", () => {
    const n = externalGlossaryNote(g);
    expect(n).toContain('<a href="https://example.org/ns/glossary/hrhis-registry-2015/" rel="external">HRHIS registry glossary (2015)</a>');
    expect(n).toContain("not as definitions");
    expect(externalGlossaryNote([])).toBe("");
  });
  test("noteBeforeFirstEntry", () => {
    const html = '<h2>Glossary</h2>\n<p><a id="prose:gloss-a"></a>\nA.</p>';
    const out = withExternalGlossaries(html, "prose:gloss-a", g);
    expect(out.indexOf("fa-ext-glossaries")).toBeGreaterThan(out.indexOf("</h2>"));
    expect(out.indexOf("fa-ext-glossaries")).toBeLessThan(out.indexOf('<a id="prose:gloss-a">'));
    expect(withExternalGlossaries(html, undefined, g)).toBe(html);
    expect(withExternalGlossaries(html, "prose:gloss-a", [])).toBe(html);
  });
});

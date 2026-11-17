import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  passageText,
  provenanceSectionFor,
  withEmphasis,
  provenanceLogFor,
  readProvenanceLog,
  renderProvenanceFooter,
  writeProvenanceListing,
} from "../provenance-footer.ts";

const log = (doc: string, entries: Array<Record<string, unknown>>) => ({
  "@context": { prov: "http://www.w3.org/ns/prov#" },
  "@graph": [
    { "@id": doc, "@type": "prov:Entity", "prov:wasInfluencedBy": entries.map((_, i) => ({ "@id": `${doc}#provenance-${i + 1}` })) },
    ...entries.map((e, i) => ({ "@id": `${doc}#provenance-${i + 1}`, "@type": "prov:Entity", ...e })),
  ],
});

function fixture(): { root: string; site: string; md: string } {
  const root = mkdtempSync(join(tmpdir(), "prov-footer-"));
  const site = join(root, "docs");
  mkdirSync(join(site, "guides"), { recursive: true });
  const md = join(site, "guides", "a.md");
  writeFileSync(md, "# A\n");
  writeFileSync(
    provenanceLogFor(md),
    JSON.stringify(
      log("docs/guides/a.md", [
        { "cat-harness:section": "Why", "cat-harness:provenanceKind": "bean", "prov:value": "Bean `oz5w` <b>decided</b> {{ x }}.", "cat-harness:refs": ["bean `oz5w`"] },
        { "cat-harness:section": "Why", "cat-harness:provenanceKind": "pr", "prov:value": "See #12.", "cat-harness:refs": "#12" },
        { "cat-harness:section": "How", "cat-harness:provenanceKind": "owner-decision", "prov:value": "<!--\n  Owner, 2026-11-05.\n-->" },
      ]),
    ),
  );
  return { root, site, md };
}

describe("provenance footer", () => {
  test("the log of a document sits beside it", () => {
    expect(provenanceLogFor("/x/skills/a.md")).toBe("/x/skills/a.prov.jsonld");
    expect(provenanceLogFor("/x/processes/p.bpmn")).toBe("/x/processes/p.prov.jsonld");
  });

  test("reads every entry and skips the document node; a missing or foreign file is no log", () => {
    const { md, root } = fixture();
    const entries = readProvenanceLog(provenanceLogFor(md))!;
    expect(entries.map((e) => e.kind)).toEqual(["bean", "pr", "owner-decision"]);
    expect(entries[1]!.refs).toEqual(["#12"]);
    expect(readProvenanceLog(join(root, "none.prov.jsonld"))).toBeUndefined();
    const foreign = join(root, "trace.prov.jsonld");
    writeFileSync(foreign, "[]");
    expect(readProvenanceLog(foreign)).toBeUndefined();
  });

  test("a passage cut from an HTML comment loses the markers and the indent", () => {
    expect(passageText("<!--\n  one\n    two\n-->")).toBe("one\n  two");
    expect(passageText("<!-- one --!>")).toBe("one");
    expect(passageText("library/&lt;slug&gt;/ &amp;lt;")).toBe("library/<slug>/ &lt;");
  });

  test("emphasis becomes tags outside code spans only", () => {
    expect(withEmphasis("a **b** and *c* <code>**d**</code>")).toBe("a <strong>b</strong> and <em>c</em> <code>**d**</code>");
    expect(withEmphasis("2 * 3 * 4")).toBe("2 * 3 * 4");
  });

  test("renders collapsed, grouped by section, escaped, inside a raw block", () => {
    const { md } = fixture();
    const html = renderProvenanceFooter(readProvenanceLog(provenanceLogFor(md))!);
    expect(html).toContain('<details class="fa-provenance"');
    expect(html).not.toContain("<details open");
    expect(html).toContain("Provenance (3)");
    expect(html.match(/fa-provenance-section/g)!.length).toBe(2);
    expect(html.indexOf(">Why<")).toBeLessThan(html.indexOf(">How<"));
    expect(html).toContain("&lt;b&gt;decided&lt;/b&gt;");
    expect(html).toContain("<code>oz5w</code>");
    expect(html).toContain("<code>bean oz5w</code>");
    expect(html.startsWith("{% raw %}")).toBe(true);
    expect(html).not.toContain("<!--");
  });

  test("writes a fragment and an index entry only for pages with entries, and prunes stale fragments", () => {
    const { md, site } = fixture();
    const pages = new Map([
      ["guides/a", [md]],
      ["guides/b", [join(site, "guides", "b.md")]],
    ]);
    const r = writeProvenanceListing({ siteDir: site, producer: "test", pages, check: false });
    expect(r).toEqual({ pages: 1, entries: 3, stale: [] });
    const index = JSON.parse(readFileSync(join(site, "_data", "provenance", "test.json"), "utf-8"));
    expect(index).toEqual({ pages: { "guides/a": "generated/provenance/test/guides__a.html" } });
    const frag = join(site, "_includes", "generated", "provenance", "test", "guides__a.html");
    expect(existsSync(frag)).toBe(true);

    const again = writeProvenanceListing({ siteDir: site, producer: "test", pages: new Map(), check: false });
    expect(again.stale).toEqual(["guides__a.html"]);
    expect(existsSync(frag)).toBe(false);
  });

  test("under check, nothing is written and a stale fragment is reported, not deleted", () => {
    const { md, site } = fixture();
    writeProvenanceListing({ siteDir: site, producer: "test", pages: new Map([["guides/a", [md]]]), check: false });
    const frag = join(site, "_includes", "generated", "provenance", "test", "guides__a.html");
    const r = writeProvenanceListing({ siteDir: site, producer: "test", pages: new Map(), check: true });
    expect(r.stale).toEqual(["guides__a.html"]);
    expect(existsSync(frag)).toBe(true);
  });

  test("a page Jekyll never reads gets the section without raw tags; no log gives nothing", () => {
    const { md, site } = fixture();
    const plain = provenanceSectionFor(md, { liquid: false });
    expect(plain.startsWith("<details")).toBe(true);
    expect(plain).not.toContain("{% raw");
    expect(provenanceSectionFor(md, { liquid: true }).startsWith("{% raw %}")).toBe(true);
    expect(provenanceSectionFor(join(site, "none.bpmn"), { liquid: false })).toBe("");
  });
});

import { describe, expect, test } from "bun:test";

import { identifierKeys, linkCitations, type LibraryLink } from "./citation-links.ts";

const list = (...items: string[]) => `<p><a id="chap:references"></a></p>\n<h2>References</h2>\n<p><a id="refs-block"></a></p>\n<ol>\n${items.map((i) => `<li>${i}</li>`).join("\n")}\n</ol>\n`;
const doc = (prose: string, ...items: string[]) => `<p>${prose}</p>\n${list(...items)}`;
const one = (html: string, library?: readonly LibraryLink[]) => linkCitations([{ html }], { library })[0]!;

describe("linkCitations", () => {
  test("citationLinksToReference", () => {
    const out = one(doc("Text.<sup>2</sup>", "A.", "B.", "C."));
    expect(out).toContain('<sup class="fa-cite" id="cite-1"><a href="#ref-2">2</a></sup>');
    expect(out).toContain('<li id="ref-2">B. <a class="fa-cite-back" href="#cite-1"');
  });

  test("backLinksLetterEachCitation", () => {
    const out = one(`<p>One.<sup>1</sup></p>\n${doc("Two.<sup>1</sup>", "A.")}`);
    expect(out).toContain('↩ <a href="#cite-1" aria-label="Back to citation a">a</a> <a href="#cite-2" aria-label="Back to citation b">b</a>');
  });

  test("listsAndRangesExpand", () => {
    const out = one(doc("Text.<sup>1,3–4</sup>", "A.", "B.", "C.", "D."));
    expect(out).toContain('<a href="#ref-1">1</a>,<a href="#ref-3">3</a>–<a href="#ref-4">4</a>');
    for (const n of [1, 3, 4]) expect(out).toMatch(new RegExp(`<li id="ref-${n}">[^<]*<a class="fa-cite-back" href="#cite-1"`));
    expect(out).toContain('<li id="ref-2">B.</li>');
  });

  test("outOfRangeLeftAsWritten", () => {
    const out = one(doc("Text.<sup>9</sup>", "A.", "B.", "C."));
    expect(out).toContain("Text.<sup>9</sup>");
    expect(out).not.toContain("fa-cite-back");
  });

  test("acrossLazyParts", () => {
    const parts = [
      { label: "prose:a", html: "<p>Cited.<sup>2</sup></p>" },
      { label: "prose:refs", html: "<ol>\n<li>A.</li>\n<li>B.</li>\n</ol>" },
    ];
    const [a, refs] = linkCitations(parts, { refBlock: "prose:refs" });
    expect(a).toBe('<p>Cited.<sup class="fa-cite" id="cite-1"><a href="#ref-2">2</a></sup></p>');
    expect(refs).toContain('<li id="ref-2">B. <a class="fa-cite-back" href="#cite-1"');
  });

  test("noReferenceListNoChange", () => {
    const html = "<h2>Notes</h2>\n<p>x<sup>2</sup></p>\n<ol><li>A.</li><li>B.</li></ol>";
    expect(one(html)).toBe(html);
  });

  test("bibliographyEntryWhenOneMatches", () => {
    const library = [
      { href: "../bib/references/full-stac/", keys: ["doi:10.1093/oodh/oqad018"] },
      { href: "../bib/references/other/", keys: ["url:example.org/other"] },
    ];
    const out = one(doc("x<sup>1</sup>", "Full STAC. doi:10.1093/oodh/oqad018.", "Unmatched (https://example.org/none)."), library);
    expect(out).toContain('<li id="ref-1">Full STAC. doi:10.1093/oodh/oqad018. <a class="fa-cite-lib" href="../bib/references/full-stac/"');
    expect(out).toMatch(/<li id="ref-2">Unmatched \(https:\/\/example\.org\/none\)\.<\/li>/);
  });
});

describe("bracketed citations", () => {
  test("whoStyleBracketLinks", () => {
    const out = one(doc("Use cases matter (2). Both (1, 3).", "A.", "B.", "C."));
    expect(out).toContain('cases matter <span class="fa-cite" id="cite-1">(<a href="#ref-2">2</a>)</span>.');
    expect(out).toContain('Both <span class="fa-cite" id="cite-2">(<a href="#ref-1">1</a>, <a href="#ref-3">3</a>)</span>.');
    expect(out).toContain('<li id="ref-2">B. <a class="fa-cite-back" href="#cite-1"');
  });

  test("enumerationLeftAlone", () => {
    const out = one(doc("Steps: (1) plan; (2) build.", "A.", "B."));
    expect(out).toContain("Steps: (1) plan; (2) build.");
  });

  test("inlineEnumerationLeftAlone", () => {
    const out = one(doc("Tiers are raised; and (2) the registry is added. It is typed. (3) Names are coded.", "A.", "B.", "C."));
    expect(out).toContain("; and (2) the registry");
    expect(out).toContain("typed. (3) Names");
    expect(one(doc("Reports; and (2) <strong>Phase 2</strong>.", "A.", "B."))).toContain("; and (2) <strong>");
    expect(one(doc("Both A and (2).", "A.", "B."))).toContain('and <span class="fa-cite" id="cite-1">');
    expect(out).not.toContain("fa-cite-back");
  });

  test("noSpaceIsACode", () => {
    const out = one(doc("doi.org/10.1016/S2589-7500(2)00038-8 and more (1).", "A.", "B."));
    expect(out).toContain("S2589-7500(2)00038-8");
    expect(out).toContain('more <span class="fa-cite" id="cite-1">(<a href="#ref-1">1</a>)</span>.');
  });

  test("notInsideLinksOrCode", () => {
    const out = one(doc('See <a href="x">item (1)</a> and <code>f(2)</code>.', "A.", "B."));
    expect(out).toContain('<a href="x">item (1)</a> and <code>f(2)</code>');
  });
});

describe("identifierKeys", () => {
  test("doiHandleAndUrlNormalised", () => {
    expect(identifierKeys("doi:10.1093/OODH/oqad018.")).toContain("doi:10.1093/oodh/oqad018");
    expect(identifierKeys("https://doi.org/10.1093/oodh/oqad018")).toContain("doi:10.1093/oodh/oqad018");
    expect(identifierKeys("http://hdl.handle.net/10986/41527")).toContain("hdl:10986/41527");
    expect(identifierKeys("https://iris.who.int/handle/10986/41527")).toContain("hdl:10986/41527");
    expect(identifierKeys("https://www.Example.org/a/")).toContain("url:example.org/a");
  });
});

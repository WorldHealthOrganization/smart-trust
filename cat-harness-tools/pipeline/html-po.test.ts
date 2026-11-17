/**
 * Tests for gettext over finished HTML (`html-po.ts`).
 *
 * The falsifier: **a page with no translation must come back byte for byte**,
 * and a translation must change only the words. Everything else here is what a
 * translator is handed (the msgids) and what is refused.
 */
import { describe, expect, it } from "bun:test";

import { extractHtml, injectHtml, isRtl, isWords, parseHtml, serializeHtml } from "./html-po.ts";

const PAGE = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Journeys &amp; workshops</title>
<script>var x = "<b>not words</b>";</script><style>.a{content:"no"}</style></head>
<body>
<nav aria-label="Breadcrumb"><a href="../">Journeys</a></nav>
<p>Start with <a href="k/">Khamla</a>, not the <em>technology</em>.</p>
<a class="tab" href="o/"><svg viewBox="0 0 1 1"><path d="M0 0"/></svg><span><b>Overview</b><small>The story &amp; the cast</small></span></a>
<ul><li><b>J1:</b> Records Hep B<br>and BCG</li></ul>
<pre>keep as written</pre><code>TrustDemoJ41Access</code>
<div translate="no">Never this</div>
<img src="a.png" alt="A paper card">
<span>TrustDemoJ41Access</span>
</body>
</html>
`;

describe("parseHtml", () => {
  it("serializes back to the same bytes", () => {
    expect(serializeHtml(parseHtml(PAGE))).toBe(PAGE);
  });
});

describe("extractHtml", () => {
  it("gives one msgid per run of text, with inline elements as numbered placeholders", () => {
    const ids = extractHtml(PAGE);
    expect(ids).toContain("Start with <0>Khamla</0>, not the <1>technology</1>.");
    expect(ids).toContain("<0>J1:</0> Records Hep B<1/>and BCG");
    expect(ids).toContain("Journeys & workshops");
  });

  it("walks into a run with no words of its own instead of making a sentence of placeholders", () => {
    const ids = extractHtml(PAGE);
    expect(ids).toContain("Overview");
    expect(ids).toContain("The story & the cast");
    expect(ids.some((m) => m.includes("<0>Overview"))).toBe(false);
  });

  it("reads the attributes a reader sees or hears", () => {
    const ids = extractHtml(PAGE);
    expect(ids).toContain("Breadcrumb");
    expect(ids).toContain("A paper card");
  });

  it("never reads scripts, styles, drawings, code, pre or translate=no", () => {
    const ids = extractHtml(PAGE).join("\n");
    for (const s of ["not words", "no", "keep as written", "Never this", "TrustDemoJ41Access"]) expect(ids.split("\n")).not.toContain(s);
  });
});

describe("isWords", () => {
  it("takes words and leaves identifiers and numbers", () => {
    expect(isWords("Overview")).toBe(true);
    expect(isWords("TrustDemoJ41Access")).toBe(false);
    expect(isWords("12 · 3")).toBe(false);
  });
});

describe("injectHtml", () => {
  it("returns the page unchanged, but for its lang, when nothing is translated", () => {
    const r = injectHtml(PAGE, new Map(), "fr");
    expect(r.html).toBe(PAGE.replace('<html lang="en">', '<html lang="fr">'));
    expect(r.translated).toBe(0);
  });

  it("puts a translation back with its placeholders moved, keeping each element's attributes", () => {
    const cat = new Map([["Start with <0>Khamla</0>, not the <1>technology</1>.", "Commencez par <0>Khamla</0>, pas par la <1>technologie</1>."]]);
    const r = injectHtml(PAGE, cat, "fr");
    expect(r.html).toContain('<p>Commencez par <a href="k/">Khamla</a>, pas par la <em>technologie</em>.</p>');
  });

  it("refuses a translation whose placeholders differ, leaving the English", () => {
    const cat = new Map([["Start with <0>Khamla</0>, not the <1>technology</1>.", "Commencez par Khamla."]]);
    const r = injectHtml(PAGE, cat, "fr");
    expect(r.rejected).toEqual(["Start with <0>Khamla</0>, not the <1>technology</1>."]);
    expect(r.html).toContain("<p>Start with <a href=\"k/\">Khamla</a>");
  });

  it("escapes what a translator writes, so a msgstr cannot inject markup", () => {
    const r = injectHtml(PAGE, new Map([["Overview", "<script>x</script> & co"]]), "fr");
    expect(r.html).toContain("<b>&lt;script&gt;x&lt;/script&gt; &amp; co</b>");
  });

  it("translates an attribute in place", () => {
    const r = injectHtml(PAGE, new Map([["A paper card", "Une carte papier"]]), "fr");
    expect(r.html).toContain('alt="Une carte papier"');
  });

  it("marks a right-to-left locale on <html>", () => {
    expect(injectHtml(PAGE, new Map(), "ar").html).toContain('<html dir="rtl" lang="ar">');
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("zh")).toBe(false);
  });
});

/**
 * The IG site's search box and its index (owner, 2026-10-15, layout "C": "add
 * a search box to the IG top bar", searching the IG's pages and artefacts),
 * and the language picker's block on the built pages (owner, same day: "what
 * happened to search/language select at top of display window?").
 *
 * @module fhir-harness/scripts/ig-search.test
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";

import { composeIgSite, IG_TOPBAR_CSS, igSearchAt, igTopBar } from "./build-ig-site";
import {
  artifactSearchEntries,
  IG_LOCALE_SLOT,
  IG_SEARCH_CSS,
  IG_SEARCH_ARTIFACTS_NODE,
  IG_SEARCH_FORMAT,
  IG_SEARCH_INDEX_FILE,
  IG_SEARCH_SCRIPT_FILE,
  IG_SEARCH_SCRIPT_SOURCE,
  igSearchBox,
  igSearchIndex,
  pageSearchEntries,
  plainText,
  withIgBar,
} from "./ig-search.ts";
import { THIN_PAGE_STYLE, thinArtifactView, thinIndexPage } from "./ig-thin-pages.ts";
import { stampIgBar, stampTranslationMeta, writeSearch } from "./ig-repo-site.ts";
import { artifactIndexJsonLd } from "./ig-artifact-jsonld.ts";
import type { FhirArtifact, FhirArtifactIndex } from "../schemas/fhir-artifact-index.js";

const tmp = (p: string) => mkdtempSync(join(tmpdir(), p));
const put = (root: string, rel: string, text: string) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};

const REF = { index: "../assets/ig-search.json", script: "../assets/ig-search.js" };

describe("the box", () => {
  const box = igSearchBox(REF, "ACME IG");

  test("boxHasLabelledInput", () => {
    expect(box).toContain('id="search-input"');
    expect(box).toContain('<label class="ig-search-label" for="search-input">Search ACME IG</label>');
    expect(box).toContain('data-ig-search-index="../assets/ig-search.json"');
  });

  test("boxIsNotSearchClass", () => {
    expect(box).not.toMatch(/class="search\b|id="search"/);
  });

  test("boxHoldsNoDiv", () => {
    expect(box).not.toContain("<div");
  });

  test("boxFollowedByLocaleSlot", () => {
    expect(IG_LOCALE_SLOT).toBe('<span class="ig-locale-slot" data-fa-slot="locale"></span>');
    expect(box.endsWith(`</form>${IG_LOCALE_SLOT}`)).toBe(true);
  });
});

describe("the top bar carries the box and its script only when the site serves the search", () => {
  const menu = { groups: [{ label: "Home", items: [{ label: "Summary", href: "index.html" }] }] };

  test("barWithSearchCarriesBox", () => {
    const bar = igTopBar(menu, "/b/acme-ig", "ACME IG", igSearchAt("/b/acme-ig"));
    expect(bar).toContain('data-ig-search-index="/b/acme-ig/assets/ig-search.json"');
    expect(bar).toContain('<script src="/b/acme-ig/assets/ig-search.js" defer></script>');
    expect(bar.endsWith("</div>")).toBe(true);
    expect(bar.indexOf('id="search-input"')).toBeLessThan(bar.lastIndexOf("</div>"));
    // The picker's slot is inside the bar too, after the box.
    expect(bar.indexOf('data-fa-slot="locale"')).toBeGreaterThan(bar.indexOf('id="search-input"'));
    expect(bar.indexOf('data-fa-slot="locale"')).toBeLessThan(bar.lastIndexOf("</div>"));
  });

  test("barWithoutSearchUnchanged", () => {
    expect(igTopBar(menu, "/b/acme-ig", "ACME IG")).not.toContain("search");
  });

  test("composedLayoutLiftsBar", () => {
    const bar = igTopBar(menu, "/b/acme-ig", "ACME IG", igSearchAt("/b/acme-ig"));
    const staged = tmp("ig-search-staged-");
    put(staged, "_config.yml", 'title: "ACME IG"\n');
    put(staged, "_layouts/default.html", `<html><body>\n${bar}\n<main>{{ content }}</main></body></html>\n`);
    put(staged, "index.md", "---\ntitle: Home\n---\nHello\n");
    const docs = tmp("ig-search-docs-");
    composeIgSite(staged, docs, "acme", { atRoot: true });
    // Thin (the default): the bar is the composed pages' layout's, above the content column.
    const layout = readFileSync(join(docs, "_layouts/ig-thin-acme.html"), "utf-8");
    expect(layout).toContain('id="search-input"');
    expect(layout).toContain('data-fa-slot="locale"');
    expect(layout).toContain("assets/ig-search.js");
  });

  test("barStylesheetStylesBox", () => {
    expect(IG_TOPBAR_CSS).toContain(IG_SEARCH_CSS.trim());
  });
});

describe("the thin pages' header", () => {
  const a = { key: "StructureDefinition/acme-patient", resourceType: "StructureDefinition", id: "acme-patient", title: "ACME Patient", published: {}, materialization: { state: "referenced" } } as unknown as FhirArtifact;
  const ix = { count: 1, artifacts: [a] } as unknown as FhirArtifactIndex;
  const base = { label: "ACME IG", home: "../index.html", all: "../artifacts.html" };

  test("artefactPageHeaderHasBox", () => {
    const html = thinArtifactView(ix, a, "content", { ...base, search: REF });
    const header = /<header class="iga-top fa-page-bar">[\s\S]*?<\/header>/.exec(html)![0];
    expect(header).toContain('id="search-input"');
    expect(header).toContain(IG_LOCALE_SLOT);
    expect(html).toContain('<script src="../assets/ig-search.js" defer></script>');
  });

  test("artefactPageNoSearch", () => {
    expect(thinArtifactView(ix, a, "content", base)).not.toContain("search-input");
  });

  test("indexPagesHaveBox", () => {
    const html = thinIndexPage({ view: "artifacts", heading: "Artifacts", label: "ACME IG", canonical: "artifacts.html", index: "artifact/index.jsonld", pagesHref: "artifact/", assets: "", home: "index.html", artifacts: "artifacts.html", toc: "toc.html", search: { index: "assets/ig-search.json", script: "assets/ig-search.js" } });
    expect(/<header class="iga-top fa-page-bar">[\s\S]*?<\/header>/.exec(html)![0]).toContain('data-ig-search-index="assets/ig-search.json"');
    expect(html).toContain('<script src="assets/ig-search.js" defer></script>');
  });

  test("thinStylesheetStylesBox", () => {
    const css = readFileSync(join(import.meta.dir, "templates", "ig-pages", "ig-artifact.css"), "utf-8");
    expect(THIN_PAGE_STYLE).toBe("assets/ig-artifact.css");
    expect(css).toContain(IG_SEARCH_CSS.trim());
  });

  test("oneStylesheetFullWidth", () => {
    const css = readFileSync(join(import.meta.dir, "templates", "ig-pages", "ig-artifact.css"), "utf-8");
    for (const line of IG_TOPBAR_CSS.trim().split("\n")) expect(css).toContain(line);
    expect(css).not.toMatch(/max-width:\s*60rem/);
    expect(IG_TOPBAR_CSS).not.toMatch(/max-width:\s*60rem/);
    expect(css).not.toMatch(/margin:0 auto/);
    // The body is the page layout's, so a page linked for the bar alone (an OpenAPI page) keeps its own.
    expect(css).not.toMatch(/(^|\n)body\{/);
  });

  test("thinPagesLinkSharedLayout", () => {
    const html = thinArtifactView(ix, a, "content", { ...base, search: REF });
    expect(html.indexOf('href="../assets/page-layout.css"')).toBeGreaterThan(0);
    expect(html.indexOf("page-layout.css")).toBeLessThan(html.indexOf("ig-artifact.css"));
    expect(html).toContain('<header class="iga-top fa-page-bar">');
    expect(html).toContain('<main class="iga fa-page-main"');
    expect(html).toContain('<footer id="ig-footer" class="fa-page-foot">');
    const list = thinIndexPage({ view: "toc", heading: "Table of Contents", label: "ACME IG", canonical: "toc.html", index: "artifact/index.jsonld", pagesHref: "artifact/", assets: "", home: "index.html", artifacts: "artifacts.html", toc: "toc.html" });
    expect(list).toContain('href="assets/page-layout.css"');
    expect(list).toContain('<main class="iga igi fa-page-main">');
  });

  test("clientBindsOnce", () => {
    expect(readFileSync(IG_SEARCH_SCRIPT_SOURCE, "utf-8")).toContain('if (form.hasAttribute("data-ig-search-ready")) return;');
  });
});

describe("the index", () => {
  test("plainTextStripsMarkup", () => {
    expect(plainText('---\ntitle: x\n---\n## Hello {{ site.title }}\n{% include x.md %}\n<p class="a">A [link](b.html) and **bold** &amp; more</p>')).toBe("Hello A link and bold & more");
  });

  test("ownPagesIndexed", () => {
    const s = tmp("ig-search-pages-");
    put(s, "index.md", "---\ntitle: \"ACME: home\"\n---\nWelcome to the guide.\n");
    put(s, "sub/page.html", "---\ntitle: Nested\n---\n<p>Nested text</p>\n");
    put(s, "hidden.md", "---\ntitle: Hidden\nsearch_exclude: true\n---\nno\n");
    put(s, "artifact/StructureDefinition-x.html", "---\ntitle: X\n---\nartefact\n");
    put(s, "_includes/inc.md", "---\ntitle: Inc\n---\ninc\n");
    put(s, "assets/x.html", "---\ntitle: Asset\n---\nasset\n");
    put(s, "plain.html", "<p>no front matter</p>");
    expect(pageSearchEntries(s)).toEqual([
      { t: "ACME: home", h: "index.html", k: "page", x: "Welcome to the guide." },
      { t: "Nested", h: "sub/page.html", k: "page", x: "Nested text" },
    ]);
  });

  test("longPageWholeText", () => {
    const s = tmp("ig-search-long-");
    const long = "lorem ipsum dolor sit amet ".repeat(2000);
    put(s, "long.md", `---\ntitle: Long\n---\n${long}\nzanzibar\n`);
    const [e] = pageSearchEntries(s);
    expect(e!.x!.length).toBeGreaterThan(50000);
    expect(e!.x!.endsWith("zanzibar")).toBe(true);
  });

  test("artefactsIndexedWithIds", () => {
    const e = artifactSearchEntries([
      { key: "ValueSet/acme-vs", resourceType: "ValueSet", id: "acme-vs", name: "AcmeVS", title: "ACME Codes", canonical: "http://acme.org/ValueSet/acme-vs", description: "The **codes**\nACME uses." },
      { key: "Patient/p1", resourceType: "Patient", id: "p1" },
    ]);
    expect(e).toEqual([
      { t: "ACME Codes", h: "artifact/ValueSet-acme-vs.html", k: "ValueSet", i: "acme-vs AcmeVS ValueSet/acme-vs http://acme.org/ValueSet/acme-vs", d: "The codes ACME uses." },
      { t: "p1", h: "artifact/Patient-p1.html", k: "Patient", i: "p1 Patient/p1" },
    ]);
  });

  test("indexFileFormat", () => {
    const ix = igSearchIndex([{ t: "Home", h: "index.html", k: "page" }], [{ t: "A", h: "artifact/X-a.html", k: "X" }]);
    expect(ix).toEqual({ format: IG_SEARCH_FORMAT, base: "../", entries: [{ t: "Home", h: "index.html", k: "page" }, { t: "A", h: "artifact/X-a.html", k: "X" }] });
  });

  test("indexNamesNodeInsteadOfCopy", () => {
    const ix = igSearchIndex([{ t: "Home", h: "index.html", k: "page" }], IG_SEARCH_ARTIFACTS_NODE);
    expect(ix).toEqual({ format: IG_SEARCH_FORMAT, base: "../", artifacts: "../artifact/index.jsonld", entries: [{ t: "Home", h: "index.html", k: "page" }] });
  });
});

/** The client's scorer, run as a browser would load it, with no page to bind to. */
function client(): { search: (entries: unknown[], q: string) => { e: { t: string; href: string } }[]; prep: (e: unknown, base: URL) => unknown; fromNode: (node: unknown) => unknown[] } {
  const window: Record<string, unknown> = {};
  const document = { readyState: "complete", querySelectorAll: () => [], addEventListener: () => {} };
  runInNewContext(readFileSync(IG_SEARCH_SCRIPT_SOURCE, "utf-8"), { window, document, URL, console });
  return window.__igSearch as ReturnType<typeof client>;
}

describe("the client searches the index", () => {
  const c = client();
  const base = new URL("https://o.github.io/acme/");
  const entries = [
    { t: "Home", h: "index.html", k: "page", x: "The ACME guide describes immunization records." },
    { t: "ACME Patient", h: "artifact/StructureDefinition-acme-patient.html", k: "StructureDefinition", i: "acme-patient AcmePatient", d: "A patient in ACME." },
    { t: "Immunization Codes", h: "artifact/ValueSet-immz.html", k: "ValueSet", i: "immz", d: "Codes for vaccines." },
  ].map((e) => c.prep(e, base));

  test("titleOutranksText", () => {
    const hits = c.search(entries, "immunization");
    expect(hits.map((h) => h.e.t)).toEqual(["Immunization Codes", "Home"]);
    expect(hits[0]!.e.href).toBe("https://o.github.io/acme/artifact/ValueSet-immz.html");
  });

  test("artefactFoundById", () => {
    expect(c.search(entries, "acme-patient").map((h) => h.e.t)).toEqual(["ACME Patient"]);
  });

  test("everyTermMustMatch", () => {
    expect(c.search(entries, "patient vaccines")).toEqual([]);
    expect(c.search(entries, "codes vaccines").map((h) => h.e.t)).toEqual(["Immunization Codes"]);
  });

  test("emptyQueryFindsNothing", () => {
    expect(c.search(entries, "  ")).toEqual([]);
  });
});

describe("the client reads the artefacts from the index node", () => {
  const c = client();
  const artifacts = [
    { key: "ValueSet/acme-vs", resourceType: "ValueSet", id: "acme-vs", name: "AcmeVS", title: "ACME Codes", canonical: "http://acme.org/ValueSet/acme-vs", description: "The **codes**\nACME uses, see [the list](list.html)." },
    { key: "StructureDefinition/acme-patient", resourceType: "StructureDefinition", id: "acme-patient", name: "AcmePatient", canonical: "http://acme.org/StructureDefinition/acme-patient", description: "x".repeat(200) },
    { key: "Patient/p1", resourceType: "Patient", id: "p1" },
  ] as unknown as FhirArtifact[];
  const node = artifactIndexJsonLd({ artifacts } as unknown as FhirArtifactIndex);
  // The order of the node's rows (the Publisher's, by category), for comparison.
  const byKey = (es: { i?: string }[]) => [...es].sort((a, b) => String(a.i).localeCompare(String(b.i)));

  test("sameEntriesAsTheCopy", () => {
    // What v1 copied into ig-search.json, with each href beside the node rather
    // than the docs root, and no name among the identifiers when the title is
    // that name: the title finds it, and outranks an identifier.
    const copy = artifactSearchEntries(artifacts).map((e) => ({ ...e, h: e.h.replace(/^artifact\//, ""), i: e.i!.split(" ").filter((w, n) => n === 0 || w !== e.t).join(" ") }));
    expect(byKey(c.fromNode(JSON.parse(JSON.stringify(node))) as { i?: string }[])).toEqual(byKey(copy));
  });

  test("nameOnlyWhenTitleDoesNotSayIt", () => {
    const rows = node["schema:hasPart"];
    expect(rows.find((r) => r["dcterms:identifier"] === "ValueSet/acme-vs")!["schema:name"]).toBe("AcmeVS");
    // Its title is its name: the row repeats nothing.
    expect(rows.find((r) => r["dcterms:identifier"] === "StructureDefinition/acme-patient")!["schema:name"]).toBeUndefined();
  });

  test("foundByNameAndLinkedBesideNode", () => {
    const at = new URL("https://o.github.io/acme/artifact/index.jsonld");
    const es = (c.fromNode(JSON.parse(JSON.stringify(node))) as unknown[]).map((e) => c.prep(e, at));
    const hits = c.search(es, "acmevs");
    expect(hits.map((h) => h.e.t)).toEqual(["ACME Codes"]);
    expect(hits[0]!.e.href).toBe("https://o.github.io/acme/artifact/ValueSet-acme-vs.html");
  });

  test("absoluteNodeIdsStillLinkThisSite", () => {
    const abs = artifactIndexJsonLd({ artifacts } as unknown as FhirArtifactIndex, { base: "https://published.example/ig/" });
    const at = new URL("https://o.github.io/acme/branches/x/artifact/index.jsonld");
    const es = (c.fromNode(JSON.parse(JSON.stringify(abs))) as unknown[]).map((e) => c.prep(e, at));
    expect(c.search(es, "p1")[0]!.e.href).toBe("https://o.github.io/acme/branches/x/artifact/Patient-p1.html");
  });
});

describe("compose writes the search; publisher-pages writes the language picker's block", () => {
  test("writeSearchRefusesExisting", () => {
    const docs = tmp("ig-search-write-");
    const staged = tmp("ig-search-staged2-");
    put(staged, "index.md", "---\ntitle: Home\n---\nHello\n");
    const r = writeSearch(docs, staged, { artifacts: [{ key: "X/a", resourceType: "X", id: "a" } as FhirArtifact] });
    expect(r).toMatchObject({ pages: 1, artifacts: 1 });
    const ix = JSON.parse(readFileSync(join(docs, IG_SEARCH_INDEX_FILE), "utf-8"));
    expect(ix.format).toBe(IG_SEARCH_FORMAT);
    expect(ix.entries.map((e: { h: string }) => e.h)).toEqual(["index.html", "artifact/X-a.html"]);
    expect(readFileSync(join(docs, IG_SEARCH_SCRIPT_FILE), "utf-8")).toBe(readFileSync(IG_SEARCH_SCRIPT_SOURCE, "utf-8"));
    expect(() => writeSearch(docs, staged, { artifacts: [] })).toThrow(/already holds/);
  });

  test("writeSearchReadsArtefactsFromNode", () => {
    const docs = tmp("ig-search-node-");
    const staged = tmp("ig-search-staged3-");
    put(staged, "index.md", "---\ntitle: Home\n---\nHello\n");
    put(staged, "artifact/index.jsonld", "{}\n");
    const r = writeSearch(docs, staged, { artifacts: [{ key: "X/a", resourceType: "X", id: "a" } as FhirArtifact] });
    expect(r).toMatchObject({ pages: 1, artifacts: 1, fromNode: true });
    const ix = JSON.parse(readFileSync(join(docs, IG_SEARCH_INDEX_FILE), "utf-8"));
    expect(ix.artifacts).toBe("../artifact/index.jsonld");
    expect(ix.entries.map((e: { h: string }) => e.h)).toEqual(["index.html"]);
  });

  test("stampsTranslationMeta", () => {
    const site = tmp("ig-search-site-");
    const ig = tmp("ig-search-ig-");
    put(site, "index.html", "<html><head><title>a</title></head><body></body></html>");
    put(site, "artifact/X-a.html", "<html><head><title>b</title></head><body></body></html>");
    const own = '<html><head><script type="application/json" id="fa-translation-meta">{"lang":"fr"}</script></head><body></body></html>';
    put(site, "fr.html", own);
    put(site, "data.json", "{}");
    expect(stampTranslationMeta(site, ig)).toBe(2);
    const meta = /<script type="application\/json" id="fa-translation-meta">([^<]*)<\/script>/.exec(readFileSync(join(site, "artifact/X-a.html"), "utf-8"))![1]!;
    expect(JSON.parse(meta)).toMatchObject({ lang: "en", supportedLocales: ["ar", "zh", "en", "fr", "ru", "es"] });
    expect(readFileSync(join(site, "fr.html"), "utf-8")).toBe(own);
    expect(stampTranslationMeta(site, ig)).toBe(0);
    expect(existsSync(join(site, "data.json"))).toBe(true);
  });
});

describe(`publisher-pages gives every built page the IG's one bar and the shared layout (owner, 2026-10-15: "please consolidate behaviours/appearance")`, () => {
  const REF2 = { index: "../assets/ig-search.json", script: "../assets/ig-search.js" };
  const PAGE = '<!doctype html><html><head><title>Hub</title></head>\n<body><script type="application/json" id="x">{}</script><main><h1>Hub</h1></main>\n</body>\n</html>\n';
  const BAR = '<div class="ig-topbar fa-page-bar" role="navigation" aria-label="ACME IG menu"><a class="ig-topbar-home" href="/b/index.html">ACME IG</a><details class="ig-topbar-group"><summary>Home</summary><ul><li><a href="/b/x.html">X</a></li></ul></details><form class="ig-search" role="search" data-ig-search-index="/b/assets/ig-search.json"><input type="search" id="search-input"></form><span class="ig-locale-slot" data-fa-slot="locale"></span><script src="/b/assets/ig-search.js" defer></script></div>';
  const o = { ref: REF2, label: "ACME IG", home: "../index.html", up: "../" };

  test("noBarGetsSearchBar", () => {
    const out = withIgBar(PAGE, o);
    const body = out.slice(out.indexOf("<body>") + 6);
    expect(body.startsWith('\n<header class="ig-search-top fa-page-bar"><a class="ig-search-home" href="../index.html">ACME IG</a><form class="ig-search"')).toBe(true);
    expect(body).toContain(IG_LOCALE_SLOT);
    const head = out.slice(0, out.indexOf("</head>"));
    expect(head).toContain('<link rel="stylesheet" href="../assets/page-layout.css" data-fa-page-layout>');
    expect(head).toContain('<script src="../assets/page-layout.js" defer data-fa-page-layout></script>');
    expect(head.indexOf("page-layout.css")).toBeLessThan(head.indexOf('href="../assets/ig-artifact.css"'));
    expect(out).not.toContain("<style");
    expect(out).toMatch(/<script src="\.\.\/assets\/ig-search\.js" defer><\/script>\n<\/body>/);
    expect(out.match(/id="search-input"/g)!.length).toBe(1);
  });

  test("igBarUsedWhenGiven", () => {
    const out = withIgBar(PAGE, { ...o, bar: BAR });
    expect(out).toContain('<div class="ig-topbar fa-page-bar" role="navigation"');
    expect(out).toContain('<summary>Home</summary>');
    expect(out).not.toContain('<script src="/b/assets/ig-search.js"');
    expect(out.match(/assets\/ig-search\.js"/g)!.length).toBe(1);
  });

  test("thinPageHeaderReplaced", () => {
    const a = { key: "StructureDefinition/acme-patient", resourceType: "StructureDefinition", id: "acme-patient", title: "ACME Patient", published: {}, materialization: { state: "referenced" } } as unknown as FhirArtifact;
    const thin = thinArtifactView({ count: 1, artifacts: [a] } as unknown as FhirArtifactIndex, a, "content", { label: "ACME IG", home: "../index.html", all: "../artifacts.html", search: REF2 });
    const out = withIgBar(thin, { ...o, bar: BAR });
    expect(out).not.toContain('class="iga-top');
    expect(out).toContain('<div class="ig-topbar fa-page-bar"');
    expect(out.indexOf('<div class="ig-topbar')).toBeLessThan(out.indexOf('<main class="iga fa-page-main"'));
    expect(out.match(/id="search-input"/g)!.length).toBe(1);
    expect(out.match(/assets\/ig-search\.js"/g)!.length).toBe(1);
    expect(out.match(/page-layout\.css/g)!.length).toBe(1);
    expect(out.match(/ig-artifact\.css/g)!.length).toBe(1);
  });

  test("alreadyBarredUnchanged", () => {
    const once = withIgBar(PAGE, { ...o, bar: BAR });
    expect(withIgBar(once, { ...o, bar: BAR })).toBe(once);
    const own = PAGE.replace("<main>", '<main><input id="search-input">');
    expect(withIgBar(own, o)).toBe(own);
    expect(withIgBar("<p>fragment</p>", o)).toBe("<p>fragment</p>");
  });

  test("stampIgBarNeedsIndex", () => {
    const site = tmp("ig-search-stamp-");
    put(site, "index.html", PAGE.replace("<body>", `<body>\n${BAR}\n`));
    put(site, "hub.html", PAGE);
    put(site, "openapi/index.html", PAGE);
    put(site, "assets/vendor/viewer.html", PAGE);
    put(site, "boxed.html", PAGE.replace("<main>", '<main><input id="search-input">'));
    expect(stampIgBar(site, "ACME IG")).toEqual({ pages: 0 });
    put(site, IG_SEARCH_INDEX_FILE, "{}");
    expect(stampIgBar(site, "ACME IG")).toEqual({ pages: 2 });
    const hub = readFileSync(join(site, "hub.html"), "utf-8");
    expect(hub).not.toContain('<summary>Home</summary>');
    expect(hub).toContain('class="ig-search-home" href="index.html">ACME IG</a>');
    expect(hub).toContain('<script src="assets/ig-search.js" defer>');
    expect(hub).toContain('href="assets/page-layout.css"');
    const api = readFileSync(join(site, "openapi/index.html"), "utf-8");
    expect(api).toContain('<script src="../assets/ig-search.js" defer>');
    expect(api).toContain('href="../assets/ig-artifact.css"');
    expect(readFileSync(join(site, "assets/vendor/viewer.html"), "utf-8")).toBe(PAGE);
    expect(stampIgBar(site, "ACME IG")).toEqual({ pages: 0 });
  });
});

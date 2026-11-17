/**
 * build-document-site (bean fyu2) over a folio `init-folio` actually
 * scaffolds, with the platform linked the way a folio links it. Not a
 * hand-made fixture: the point is that the command a new folio's staging
 * workflow runs works on what that folio starts as.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { LAZY_OPEN, afterTitle, buildDocumentSite, downloadLinks, citationsToHtml, documentManifests, katexMacros, renderDocumentHtml, splitBlocks, type Outline } from "./build-document-site.js";
import { readPositions } from "../schemas/changeset.js";
import { initFolio } from "@litlfred/cat-harness-tools/scripts/init-folio.js";

const REPO_ROOT = resolve(import.meta.dir, "../..");

let roots: string[] = [];
afterEach(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
  roots = [];
});

function scaffold(): string {
  const d = mkdtempSync(join(tmpdir(), "docsite-"));
  roots.push(d);
  initFolio({ targetDir: d, slug: "handbook", title: "Handbook", authors: ["A"], contentType: "document", skipVcs: true, link: "submodule" } as Parameters<typeof initFolio>[0]);
  symlinkSync(REPO_ROOT, join(d, "folio-assistant"));
  return d;
}

describe("build-document-site", () => {
  test("scaffoldedFolioBuilds", async () => {
    const d = scaffold();
    const out = join(d, "_site");
    const r = await buildDocumentSite(d, out);
    expect(r.errors).toEqual([]);
    expect(r.documents.map((x) => x.slug)).toEqual(["handbook"]);
    expect(existsSync(join(out, "index.html"))).toBe(true);
    const html = readFileSync(join(out, "en", "handbook", "index.html"), "utf-8");
    // The anchors the review page and the ChangeSet link to, by label.
    expect(html).toContain('<a id="prose:overview"></a>');
    expect(html).toContain('<a id="chap:introduction"></a>');
    const landing = readFileSync(join(out, "index.html"), "utf-8");
    expect(landing).toContain('href="en/handbook/index.html"');
    expect(landing).toContain('href="en/review/index.html"');
    // Listed by its title, not its folder name or a block count.
    expect(r.documents.map((x) => x.title)).toEqual(["Handbook"]);
    expect(landing).toContain('<a href="en/handbook/index.html">Handbook</a>');
    expect(landing).not.toContain("blocks)");
  });

  test("statusInTitle", async () => {
    const d = scaffold();
    const manifest = join(d, "folio", "handbook", "handbook.ts");
    writeFileSync(manifest, readFileSync(manifest, "utf-8").replace('title: "Handbook",', 'title: "Handbook",\n  meta: { status: "Working Draft" },'));
    const out = join(d, "_site");
    const r = await buildDocumentSite(d, out);
    expect(r.errors).toEqual([]);
    expect(r.documents.map((x) => x.title)).toEqual(["Handbook - Working Draft"]);
    const html = readFileSync(join(out, "en", "handbook", "index.html"), "utf-8");
    expect(html).toMatch(/<h1[^>]*>\s*Handbook - Working Draft\s*<\/h1>/);
    expect(html).toContain("<title>Handbook - Working Draft");
  });

  test("downloadLinks", async () => {
    const d = scaffold();
    const out = join(d, "_site");
    const r = await buildDocumentSite(d, out, { downloads: true });
    expect(r.errors).toEqual([]);
    const html = readFileSync(join(out, "en", "handbook", "index.html"), "utf-8");
    // Under the title, relative to the page, by the export's stable names.
    expect(html).toMatch(/<\/h1>\s*<p class="fa-downloads">/);
    expect(html).toContain('href="export/handbook-public-comment-latest.docx" download');
    expect(html).toContain('href="export/handbook-public-comment-latest.pdf" download');
    expect(html).toContain('href="export/">all formats</a>');
    expect(r.documents[0]!.downloads).toEqual({
      docx: "en/handbook/export/handbook-public-comment-latest.docx",
      pdf: "en/handbook/export/handbook-public-comment-latest.pdf",
    });
    const landing = readFileSync(join(out, "index.html"), "utf-8");
    expect(landing).toContain('href="en/handbook/export/handbook-public-comment-latest.docx" download');
    expect(landing).toContain('href="en/handbook/export/handbook-public-comment-latest.pdf" download');
  });

  test("noDownloadLinksByDefault", async () => {
    const d = scaffold();
    const out = join(d, "_site");
    const r = await buildDocumentSite(d, out);
    expect(r.errors).toEqual([]);
    // The element, not the class name: the page's stylesheet carries a
    // `.fa-downloads` rule whether or not the line is emitted.
    expect(readFileSync(join(out, "en", "handbook", "index.html"), "utf-8")).not.toMatch(/class="fa-downloads"/);
    expect(readFileSync(join(out, "index.html"), "utf-8")).not.toContain("public-comment-latest");
    expect(r.documents[0]!.downloads).toBeUndefined();
  });

  test("downloadLinksFromAnyPage", () => {
    expect(downloadLinks("handbook", "en/handbook/assets")).toContain('href="../export/handbook-public-comment-latest.pdf"');
    expect(afterTitle("<h1>T</h1><p>x</p>", "<p>L</p>")).toBe("<h1>T</h1>\n<p>L</p><p>x</p>");
    expect(afterTitle("<p>x</p>", "<p>L</p>")).toBe("<p>L</p><p>x</p>");
  });

  test("kgNodesPublished", async () => {
    const d = scaffold();
    const out = join(d, "_site");
    const r = await buildDocumentSite(d, out);
    expect(r.errors).toEqual([]);
    const node = JSON.parse(readFileSync(join(out, "handbook", "kg", "introduction", "overview.jsonld"), "utf-8")) as { label: string };
    expect(node.label).toBe("prose:overview");
    const graph = JSON.parse(readFileSync(join(out, "handbook", "graph.jsonld"), "utf-8")) as { "@graph": Array<{ label: string }> };
    expect(graph["@graph"].map((n) => n.label)).toEqual(["prose:overview"]);
  });

  test("editRuntimeAndValues", async () => {
    const d = scaffold();
    const out = join(d, "_site");
    const r = await buildDocumentSite(d, out, { actions: { repo: "o/r" } });
    expect(r.errors).toEqual([]);
    const html = readFileSync(join(out, "en", "handbook", "index.html"), "utf-8");
    expect(html).toContain('id="fa-edit-cfg"');
    expect(html).toContain('"values":"../../values.jsonld"');
    expect(html).toContain("fa-suggest");
    const values = JSON.parse(readFileSync(join(out, "values.jsonld"), "utf-8")) as { "@graph": unknown[] };
    expect(values["@graph"]).toEqual([]);
  });

  test("editorCheckerBundled", async () => {
    const d = scaffold();
    // A layer beside the folio declaring a ✍ suggest profile for documents (bean 4dx7).
    const prof = join(d, "prof");
    mkdirSync(join(prof, "editor-checkers"), { recursive: true });
    writeFileSync(join(prof, "prof.json"), JSON.stringify({ name: "prof", directories: [{ id: "prof-editor-checkers", path: "editor-checkers/", graphTypologies: ["editor-checkers"] }] }));
    writeFileSync(join(prof, "check.ts"), "export function checkIt(before: string, after: string) { return []; }\n");
    writeFileSync(join(prof, "editor-checkers", "doc.json"), JSON.stringify({ $schema: "folio-editor-checker/v1", id: "doc-check", contentType: "document", check: "check.ts#checkIt" }));
    const out = join(d, "_site");
    const r = await buildDocumentSite(d, out, { actions: { repo: "o/r" } });
    expect(r.errors).toEqual([]);
    expect(existsSync(join(out, "assets", "suggest", "doc-check.js"))).toBe(true);
    const html = readFileSync(join(out, "en", "handbook", "index.html"), "utf-8");
    expect(html).toContain('"graph":"../../handbook/graph.jsonld"');
    expect(html).toContain('"profiles":[{"id":"doc-check","module":"../../assets/suggest/doc-check.js"}]');
  });

  test("missingOrStaleKgNodeFails", async () => {
    const d = scaffold();
    const nodePath = join(d, "folio", "handbook", "introduction", "overview.jsonld");
    const committed = readFileSync(nodePath, "utf-8");
    rmSync(nodePath);
    const missing = await buildDocumentSite(d, join(d, "_site"));
    expect(missing.errors).toEqual(["handbook: introduction/overview.jsonld: no KG node (run gen-block-jsonld.ts)"]);

    writeFileSync(nodePath, committed.replace('"Overview"', '"An older title"'));
    const stale = await buildDocumentSite(d, join(d, "_site2"));
    expect(stale.errors).toEqual(["handbook: introduction/overview.jsonld: KG node is stale (run gen-block-jsonld.ts)"]);
  });

  test("pagesUnderLocale", async () => {
    const d = scaffold();
    const out = join(d, "_site");
    const r = await buildDocumentSite(d, out, { lazy: "always" });
    expect(r.documents.map((x) => x.page)).toEqual(["en/handbook/index.html"]);
    for (const page of ["en/handbook/index.html", "en/handbook/index.hydrated.html", "en/review/index.html", "index.html"]) expect(existsSync(join(out, page))).toBe(true);
    // The old addresses hold no page: nothing at them forwards, and nothing is left behind.
    for (const gone of ["handbook/index.html", "handbook/index.hydrated.html", "review/index.html"]) expect(existsSync(join(out, gone))).toBe(false);
    // Data stays where it was.
    expect(existsSync(join(out, "handbook", "blocks", "000.json"))).toBe(true);
    expect(existsSync(join(out, "outline.json"))).toBe(true);
    const outline = JSON.parse(readFileSync(join(out, "outline.json"), "utf-8")) as Outline;
    expect(outline.documents[0]!.page).toBe("en/handbook/index.html");
    // The shell fetches its chunks from where they are, relative to itself.
    const shell = readFileSync(join(out, "en", "handbook", "index.html"), "utf-8");
    expect(shell).toContain('fetch("../../handbook/blocks/" + String(n)');
  });

  test("markdownTableRenders", async () => {
    const d = scaffold();
    appendFileSync(join(d, "folio", "handbook", "introduction", "overview.md"), "\n\n| Role | who |\n|---|---|\n| Bootstrapping Agent | you |\n");
    const out = join(d, "_site");
    await buildDocumentSite(d, out);
    const html = readFileSync(join(out, "en", "handbook", "index.html"), "utf-8");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>Bootstrapping Agent</td>");
    expect(html).not.toContain("| Bootstrapping Agent |");
  });

  test("outlineInManifestOrder", async () => {
    const d = scaffold();
    const out = join(d, "_site");
    await buildDocumentSite(d, out);
    const outline = JSON.parse(readFileSync(join(out, "outline.json"), "utf-8")) as Outline;
    expect(outline.$schema).toBe("folio-outline/v1");
    const sections = outline.documents.flatMap((doc) => doc.chapters.flatMap((c) => c.sections));
    expect(sections.map((s) => s.blocks)).toEqual([["prose:overview"]]);
    // The join the review page relies on: every section the ChangeSet can name is in the outline.
    const csKeys = new Set([...readPositions(join(d, "folio")).values()].map((p) => p.section));
    expect(new Set(sections.map((s) => s.key))).toEqual(csKeys);
  });

  test("noDocumentIsError", async () => {
    const d = mkdtempSync(join(tmpdir(), "docsite-empty-"));
    roots.push(d);
    expect(documentManifests(d)).toEqual([]);
    const r = await buildDocumentSite(d, join(d, "_site"));
    expect(r.errors[0]).toContain("no document manifest");
    expect(existsSync(join(d, "_site", "index.html"))).toBe(false);
  });
});

describe("the harness rail lands in the page, not in its stylesheet (owner, 2026-10-05)", () => {
  test("bodyAndMainAfterStyle", async () => {
    // The rail injector finds a page's first body and main tags BY TEXT. A
    // CSS comment that named them put the whole navigation inside <style>,
    // and the published page lost both its rail and its gutters.
    const d = scaffold();
    const out = join(d, "_site");
    await buildDocumentSite(d, out);
    for (const f of [join(out, "index.html"), join(out, "en", "handbook", "index.html"), join(out, "en", "review", "index.html")]) {
      const html = readFileSync(f, "utf-8");
      const styleEnd = html.indexOf("</style>");
      expect({ f, body: html.indexOf("<body") > styleEnd, main: html.indexOf("<main") > styleEnd }).toEqual({ f, body: true, main: true });
    }
  });
});

describe("paper content: math, glossary directives and citations (owner, 2026-10-05)", () => {
  test("mathClaimedBeforeEmphasis", async () => {
    const html = await renderDocumentHtml("Let $a_i * b_j$ hold, and\n\n$$\\sum_i x_i$$\n", { math: true });
    expect(html).toContain('class="language-math math-inline">a_i * b_j</code>');
    expect(html).toContain("math-display");
    expect(html).not.toContain("<em>");
  });

  test("mathOffDollarsStayProse", async () => {
    const html = await renderDocumentHtml("It cost $5 million and $3 more.", { math: false });
    expect(html).not.toContain("math-inline");
    expect(html).toContain("$5 million and $3 more.");
  });

  test("deftermAndRefterm", async () => {
    const html = await renderDocumentHtml("A :defterm[braid]{#braid-group} is here; see :refterm[braids]{#braid-group}.", { math: false });
    expect(html).toContain('<dfn class="defterm" id="term-braid-group">braid</dfn>');
    expect(html).toContain('<a class="refterm" href="#term-braid-group">braids</a>');
  });

  test("otherDirectiveKeptAsText", async () => {
    const html = await renderDocumentHtml("Ratio note:alpha stays.", { math: false });
    expect(html).toContain("note:alpha stays.");
  });

  test("citeOutsideFences", () => {
    const md = "As in \\cite{a, b}.\n```tex\n\\cite{c}\n```\n";
    const out = citationsToHtml(md);
    expect(out).toContain('<span class="cite" data-keys="a b">[a, b]</span>');
    expect(out).toContain("\\cite{c}");
  });

  test("citedKeysLinkBibliography", () => {
    const url = "https://litlfred.github.io/folio-assistant/folio-assistant-core/bibliography/references/";
    const out = citationsToHtml("As in \\cite[p.~3]{garoufalidis2004, a:b}.", { bibliographyUrl: url });
    expect(out).toContain('data-keys="garoufalidis2004 a:b"');
    expect(out).toContain(`<a href="${url}garoufalidis2004/">garoufalidis2004</a>`);
    // The entry's own page, a slash address (referenceSegment): `a:b` → `a-b/`, no `#`.
    expect(out).toContain(`<a href="${url}a-b/">a:b</a>`);
    expect(out).not.toContain("#ref-");
    expect(out).toContain("</a>, p. 3]</span>");
  });

  test("citationsUnlinkedWithoutBibliography", () => {
    expect(citationsToHtml("\\cite{x}")).toBe('<span class="cite" data-keys="x">[x]</span>');
  });

  test("renderPassesBibliography", async () => {
    const html = await renderDocumentHtml("See \\cite{x}.", { math: false, bibliographyUrl: "/bib/" });
    expect(html).toContain('<a href="/bib/x/">x</a>');
  });

  test("macroTableFromManifest", () => {
    expect(katexMacros({ qou: { tex: "\\mathbf{Q}" } })["\\qou"]).toBe("\\mathbf{Q}");
    expect(katexMacros(undefined)["\\bigbowtie"]).toBe("\\bowtie");
  });
});

describe("lazy pages: the block text as data (bean v433)", () => {
  test("splitBlocksKeepsShell", () => {
    const md = [
      "# Chapter", "", '<a id="chap:one"></a>', "", "## Section", "",
      '<a id="prose:a"></a>', "Block A text.", "", "```", '<a id="prose:not-an-anchor"></a>', "# not a heading", "```", "",
      '<a id="prose:b"></a>', "Block B text.", "", "## Next",
    ].join("\n");
    const s = splitBlocks(md, new Set(["prose:a", "prose:b", "prose:not-an-anchor"]));
    expect(s.blocks.map((b) => b.label)).toEqual(["prose:a", "prose:b"]);
    expect(s.blocks[0]!.markdown).toContain("# not a heading");
    expect(s.blocks[0]!.markdown).toContain("Block A text.");
    expect(s.shell).toContain('<a id="chap:one"></a>');
    expect(s.shell).toContain('<div class="fa-blk" data-blk="prose:a"></div>');
    expect(s.shell).not.toContain("Block A text.");
    expect(s.shell).toContain("## Next");
  });

  test("splitBlocksMovesFrameOpener", () => {
    // The frame opens before the anchor and closes after the text; an opener
    // left in the shell put every later block inside it (smart-ra, 2026-11-02).
    const md = [
      "## Glossary", "", '<a id="sec:g"></a>', "", '<div class="fa-numbered fa-numbered-table" markdown="1">', "",
      '<a id="tbl:g"></a>', "**Table.**", "", "| a | b |", "|---|---|", "| 1 | 2 |", "", "</div>", "",
      '<a id="prose:after"></a>', "After.",
    ].join("\n");
    const s = splitBlocks(md, new Set(["tbl:g", "prose:after"]));
    expect(s.shell).not.toContain("fa-numbered");
    expect(s.shell).toContain('<a id="tbl:g"></a>');
    expect(s.blocks[0]!.markdown.startsWith('<div class="fa-numbered fa-numbered-table" markdown="1">')).toBe(true);
    expect(s.blocks[0]!.markdown).toContain("</div>");
    for (const b of s.blocks) expect(b.markdown.split("<div").length).toBe(b.markdown.split("</div>").length);
  });

  test("lazyAlwaysShellChunksHydrated", async () => {
    const d = scaffold();
    appendFileSync(join(d, "folio", "handbook", "introduction", "overview.md"), "\n\n| Role | who |\n|---|---|\n| Bootstrapping Agent | you |\n");
    const out = join(d, "_site");
    const r = await buildDocumentSite(d, out, { lazy: "always", actions: { repo: "o/r" } });
    expect(r.errors).toEqual([]);
    const shell = readFileSync(join(out, "en", "handbook", "index.html"), "utf-8");
    expect(shell).toContain('<a id="prose:overview"></a>');
    expect(shell).toContain('<div class="fa-blk" data-blk="prose:overview"></div>');
    expect(shell).not.toContain("<td>Bootstrapping Agent</td>");
    expect(shell).toContain('id="fa-blocks"');
    expect(shell).toContain('href="index.hydrated.html"');
    // Opened at a link, it lands there at once and stays: the text above is
    // folded, empty blocks draw at no height from the first paint, and the
    // comment notes keep the place (dth-hrh, owner 2026-10-31).
    expect(shell.indexOf(LAZY_OPEN)).toBeGreaterThan(-1);
    expect(shell.indexOf(LAZY_OPEN)).toBeLessThan(shell.indexOf('<div class="fa-blk"'));
    expect(shell).toContain('setAttribute("hidden", "until-found")');
    expect(shell).toContain("Show this chapter's text");
    expect(shell).toContain("window.faKeepPlace = keep");
    // compact links on the shell, full links on the one-page version
    expect(shell).toContain('data-src="folio/handbook/introduction/overview.md"');
    const chunk = JSON.parse(readFileSync(join(out, "handbook", "blocks", "000.json"), "utf-8")) as Record<string, string>;
    expect(chunk["prose:overview"]).toContain("<td>Bootstrapping Agent</td>");
    const full = readFileSync(join(out, "en", "handbook", "index.hydrated.html"), "utf-8");
    expect(full).toContain("<td>Bootstrapping Agent</td>");
    expect(full).toContain("https://github.com/o/r/edit/main/folio/handbook/introduction/overview.md");
    // Feedback is coded with the document's slug, on both pages (owner, 2026-10-06).
    expect(full).toContain("Feedback+%5Bhandbook%5D");
    expect(shell).toContain('"content":"handbook"');
    // The outline says the page is lazy and where each block's text is (rendered impact, bean bnjs).
    const outline = JSON.parse(readFileSync(join(out, "outline.json"), "utf-8"));
    expect(outline.documents[0].lazy).toMatchObject({ hydrated: "en/handbook/index.hydrated.html", chunks: 1 });
    expect(outline.documents[0].lazy.of["prose:overview"]).toBe(0);
  });

  test("autoStaysOnePage", async () => {
    const d = scaffold();
    const out = join(d, "_site");
    await buildDocumentSite(d, out);
    expect(existsSync(join(out, "en", "handbook", "index.hydrated.html"))).toBe(false);
    expect(existsSync(join(out, "handbook", "blocks"))).toBe(false);
  });
});

describe("pageContents — the document's index for the harness rail", () => {
  test("pageContentsChaptersRows", async () => {
    const { pageContents } = await import("./build-document-site.js");
    const html =
      `<h1>T</h1>\n<p><a id="chap:a"></a></p>\n<h2>Intro &amp; scope</h2>\n<p><a id="sec:1-1"></a></p>\n<h3>1.1 About</h3>\n` +
      `<h2>No anchor</h2>\n<p><a id="chap:b"></a></p>\n<h2>Second</h2>\n`;
    const decl = pageContents(html);
    const json = JSON.parse(/<script[^>]*data-fa-visualiser-nav[^>]*>([\s\S]*?)<\/script>/.exec(decl)![1]!);
    expect(json).toEqual([
      { label: "Intro & scope", href: "#chap:a", items: [{ label: "1.1 About", href: "#sec:1-1" }] },
      { label: "Second", href: "#chap:b" },
    ]);
    expect(pageContents(`<p><a id="chap:a"></a></p>\n<h2>Only</h2>`)).toBe("");
  });
});

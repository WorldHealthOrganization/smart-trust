/**
 * `--document-layout`: a document's page as a Jekyll page in the site's
 * layout, so it wears the theme's chrome, over a folio `init-folio` scaffolds.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { buildDocumentSite, DOC_CLASS, headingIds, themedDocumentPage } from "./build-document-site.js";
import { scopeCss } from "./scope-css.js";
import { DOCUMENT_END_MARKER } from "./document-site-route.js";
import { atDocumentEnd } from "./public-comment-site.js";
import { initFolio } from "@litlfred/cat-harness-tools/scripts/init-folio.js";
import { unescapeRaw } from "@litlfred/cat-harness-tools/scripts/lib/liquid-raw.ts";

const REPO_ROOT = resolve(import.meta.dir, "../..");

let roots: string[] = [];
afterEach(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
  roots = [];
});

function scaffold(): string {
  const d = mkdtempSync(join(tmpdir(), "doclayout-"));
  roots.push(d);
  initFolio({ targetDir: d, slug: "handbook", title: "Handbook", authors: ["A"], contentType: "document", skipVcs: true, link: "submodule" } as Parameters<typeof initFolio>[0]);
  symlinkSync(REPO_ROOT, join(d, "folio-assistant"));
  return d;
}

/** What Liquid renders of a themed page's body: front matter off, the raw block opened. */
function rendered(p: string): string {
  const m = /^---\n[\s\S]*?\n---\n\{% raw %\}\n([\s\S]*)\n\{% endraw %\}\n$/.exec(p);
  if (!m) throw new Error("not a themed page");
  return unescapeRaw(m[1]!);
}

/**
 * Every selector in the page's `<style>` blocks not under `wrapper`: ported
 * from `themed-page.ts`'s `unscopedSelectors`, for a page that must restyle
 * nothing of the theme's. `[]` is the pass.
 */
function unscopedSelectors(html: string, wrapper: string): string[] {
  const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]!).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const out: string[] = [];
  for (const m of css.matchAll(/([^{}]+)\{/g)) {
    const sel = m[1]!.trim();
    if (sel === "" || sel.startsWith("@")) continue;
    for (const part of sel.split(",").map((p) => p.trim())) {
      // The block panel lives on body, outside the page; a root state class keeps the page scope after it.
      if (/(^|\s)\.fa-block-panel(?![\w-])/.test(part)) continue;
      const rest = part.replace(/^(?::root|html|body)[.:[][^\s>+~]*\s+/, "");
      if (!(rest === wrapper || [" ", ".", ":", "[", ">"].some((c) => rest.startsWith(wrapper + c)))) out.push(part);
    }
  }
  return out;
}

const page = (d: string, f = "index.html") => readFileSync(join(d, "_site", "en", "handbook", f), "utf-8");

describe("--document-layout", () => {
  test("jekyllPageRawBody", async () => {
    const d = scaffold();
    appendFileSync(join(d, "folio", "handbook", "introduction", "overview.md"), "\n\nLiteral {{ not.liquid }} and {% endraw %} here.\n");
    const r = await buildDocumentSite(d, join(d, "_site"), { documentLayout: "default", actions: { repo: "o/r" }, lazy: "never" });
    expect(r.errors).toEqual([]);
    const p = page(d);
    expect(p.startsWith('---\nlayout: default\ntitle: "Handbook"\nsearch_exclude: true\n---\n{% raw %}\n')).toBe(true);
    const body = rendered(p);
    expect(body).toContain("Literal {{ not.liquid }} and {% endraw %} here.");
    expect(body).toContain('<a id="prose:overview"></a>');
    expect(body).toContain(`<div class="${DOC_CLASS}">`);
    expect(body.endsWith(DOCUMENT_END_MARKER)).toBe(true);
    // No document of its own inside the layout's.
    for (const tag of ["<!doctype", "<html", "<head>", "<body>", "<main>", "<title>"]) expect(body).not.toContain(tag);
    // [edit]/[feedback] were injected before the page was taken apart.
    expect(body).toContain("https://github.com/o/r/edit/main/folio/handbook/introduction/overview.md");
  });

  test("rulesScopedUnderPageClass", async () => {
    const d = scaffold();
    await buildDocumentSite(d, join(d, "_site"), { documentLayout: "default", actions: { repo: "o/r" }, math: true, lazy: "never" });
    const body = rendered(page(d));
    expect(body).toContain("katex.min.js");
    expect(body).toContain(".block-actions");
    expect(unscopedSelectors(body, `.${DOC_CLASS}`)).toEqual([]);
    expect(body).not.toContain("prefers-color-scheme");
  });

  test("headingIdsForOnThisPage", async () => {
    const d = scaffold();
    await buildDocumentSite(d, join(d, "_site"), { documentLayout: "default", lazy: "never" });
    const body = rendered(page(d));
    expect(body).toMatch(/<a id="chap:introduction"><\/a><\/p>\s*<h\d id="h-chap:introduction">/);
    // The rail's declared contents are the theme sidebar's job here.
    expect(body).not.toContain("data-fa-visualiser-nav");
  });

  test("headingIdsUniqueStable", () => {
    const html = '<p><a id="s"></a></p>\n<h2>A</h2><span id="h-s"></span><p><a id="t"></a></p>\n<h3 id="mine">B</h3>';
    const out = headingIds(html);
    expect(out).toContain('<h2 id="h-s-2">A</h2>');
    expect(out).toContain('<h3 id="mine">B</h3>');
    expect(headingIds(html)).toBe(out);
  });

  test("lazyKeepsDataHooks", async () => {
    const d = scaffold();
    await buildDocumentSite(d, join(d, "_site"), { documentLayout: "default", lazy: "always", actions: { repo: "o/r" } });
    const body = rendered(page(d));
    expect(body).toContain('id="fa-blocks"');
    expect(body).toContain('<div class="fa-blk" data-blk="prose:overview"></div>');
    // Relative to the page, whose address is unchanged.
    expect(body).toContain('"../../handbook/blocks/"');
    expect(body).toContain('href="index.hydrated.html"');
    expect(page(d, "index.hydrated.html").startsWith("<!doctype html>")).toBe(true);
  });

  test("noFlagStandalone", async () => {
    const d = scaffold();
    await buildDocumentSite(d, join(d, "_site"), { lazy: "never" });
    const p = page(d);
    expect(p.startsWith("<!doctype html>")).toBe(true);
    expect(p).not.toContain(DOCUMENT_END_MARKER);
    expect(p).not.toContain('id="h-');
  });

  test("badLayoutRefused", async () => {
    const d = scaffold();
    await expect(buildDocumentSite(d, join(d, "_site"), { documentLayout: "default\nx: y" })).rejects.toThrow(/not a layout name/);
    expect(() => themedDocumentPage("a b", "T", "")).toThrow(/not a layout name/);
  });

  test("scopeCssEverything", () => {
    const css = scopeCss(".a, b:hover { x:1 } :root { y:2 } @media (max-width: 1px) { .c { z:3 } }", ".s");
    expect(css).toContain(".s .a, .s b:hover { x:1 }");
    expect(css).toContain(".s { y:2 }");
    expect(css).toContain(".s .c { z:3 }");
    expect(unscopedSelectors(`<style>${css}</style>`, ".s")).toEqual([]);
  });

  test("scopeCssRootStateAndPanel", () => {
    // `.s html.fa-bp .block-actions` matched nothing, so on a themed page the
    // block panel's rules never applied and the panel opened unstyled at the
    // foot of the page (smart-ra, 2026-11-02).
    const css = scopeCss("html.fa-bp .block-actions, html.fa-bp p:hover + .block-actions { a:1 } .fa-block-panel { b:1 } html.fa-bp .fa-block-panel .block-actions > a { c:1 } .fa-block-panelx { d:1 }", ".s");
    expect(css).toContain("html.fa-bp .s .block-actions, html.fa-bp .s p:hover + .block-actions { a:1 }");
    expect(css).toContain(".fa-block-panel { b:1 }");
    expect(css).toContain("html.fa-bp .fa-block-panel .block-actions > a { c:1 }");
    expect(css).toContain(".s .fa-block-panelx { d:1 }");
    expect(css).not.toContain(".s html");
  });
});

describe("public-comment notes land on either kind of document page", () => {
  test("standaloneNotesBeforeBody", () => {
    expect(atDocumentEnd("<html><body><main>x</main></body></html>", "<i>n</i>")).toBe("<html><body><main>x</main><i>n</i></body></html>");
  });

  test("themedNotesBeforeMarker", () => {
    const p = `---\nlayout: default\n---\n{% raw %}\n<div>x</div>\n${DOCUMENT_END_MARKER}\n{% endraw %}\n`;
    const out = atDocumentEnd(p, "<i>{% endraw %} $& n</i>");
    expect(rendered(out)).toBe(`<div>x</div>\n<i>{% endraw %} $& n</i>${DOCUMENT_END_MARKER}`);
  });

  test("neitherIsError", () => {
    expect(() => atDocumentEnd("<div>x</div>", "<i>n</i>")).toThrow(/nowhere to add/);
  });

  test("realThemedBuildNotes", async () => {
    const d = scaffold();
    await buildDocumentSite(d, join(d, "_site"), { documentLayout: "default", lazy: "never" });
    const out = atDocumentEnd(page(d), "<style>.pc-note { x:1 }</style><script>notes</script>");
    expect(rendered(out).endsWith(`<script>notes</script>${DOCUMENT_END_MARKER}`)).toBe(true);
    expect(unscopedSelectors(rendered(out), `.${DOC_CLASS}`)).toEqual([]);
  });
});

/**
 * build-folio-site (owner, 2026-10-05): lightweight static shells at
 * <route>/<paper>/<chapter>/<section>/ that load KG content dynamically. Run
 * over a folio `init-folio` actually scaffolds, as build-document-site's tests are.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { blockSlug, buildFolioSite, resolveRefs, sectionSlug, shellHtml, type SiteChapterOutline, type SiteLabels, type SiteOutline } from "./build-folio-site.js";
import { initFolio } from "@litlfred/cat-harness-tools/scripts/init-folio.js";

const REPO_ROOT = resolve(import.meta.dir, "../..");
let roots: string[] = [];
afterEach(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
  roots = [];
});

function scaffold(): string {
  const d = mkdtempSync(join(tmpdir(), "folsite-"));
  roots.push(d);
  initFolio({ targetDir: d, slug: "handbook", title: "Handbook", authors: ["A"], contentType: "document", skipVcs: true, link: "submodule" } as Parameters<typeof initFolio>[0]);
  symlinkSync(REPO_ROOT, join(d, "folio-assistant"));
  return d;
}

describe("build-folio-site", () => {
  test("tinyShellsPerLevel", async () => {
    const d = scaffold();
    const out = join(d, "_site");
    const r = await buildFolioSite(d, out);
    expect(r.errors).toEqual([]);
    const base = join(out, "cat-harness", "folio");
    const outline = JSON.parse(readFileSync(join(base, "handbook", "outline.json"), "utf-8")) as SiteOutline;
    expect(outline.$schema).toBe("folio-site-outline/v2");
    // The top-level outline carries chapters only; a chapter's tree is its own file.
    expect("sections" in outline.chapters[0]!).toBe(false);
    expect("labels" in outline).toBe(false);
    const ch = JSON.parse(readFileSync(join(base, "handbook", "outline", `${outline.chapters[0]!.slug}.json`), "utf-8")) as SiteChapterOutline;
    expect(ch.$schema).toBe("folio-site-chapter/v1");
    const sec = ch.sections[0]!;
    for (const p of [[], ["handbook"], ["handbook", ch.slug], ["handbook", ch.slug, sec.slug]]) {
      const f = join(base, ...p, "index.html");
      expect(existsSync(f)).toBe(true);
      expect(statSync(f).size).toBeLessThan(2048);
    }
    expect(existsSync(join(base, "assets", "folio-site.js"))).toBe(true);
  });

  test("blockPayloadAndLabelMap", async () => {
    const d = scaffold();
    const out = join(d, "_site");
    await buildFolioSite(d, out);
    const base = join(out, "cat-harness", "folio", "handbook");
    const outline = JSON.parse(readFileSync(join(base, "outline.json"), "utf-8")) as SiteOutline;
    const chSlug = outline.chapters[0]!.slug;
    const sec = (JSON.parse(readFileSync(join(base, "outline", `${chSlug}.json`), "utf-8")) as SiteChapterOutline).sections[0]!;
    const node = JSON.parse(readFileSync(join(base, "blocks", chSlug, `${sec.blocks[0]!}.json`), "utf-8")) as { html: string; label?: string; page: string };
    expect(node.html).toContain('<a id="prose:overview"></a>');
    const shard = JSON.parse(readFileSync(join(base, "labels", `${chSlug}.json`), "utf-8")) as SiteLabels;
    expect(shard.labels["prose:overview"]).toBe(`${chSlug}/${sec.slug}`);
    // Every block has its own page, which names the block and stays a tiny shell.
    expect(node.page).toBe("b/prose-overview");
    const shell = readFileSync(join(base, node.page, "index.html"), "utf-8");
    expect(shell).toContain(`data-block="${chSlug}/${sec.blocks[0]!}"`);
    expect(shell).toContain('src="../../../assets/folio-site.js"');
    expect(shell.length).toBeLessThan(2048);
  });

  test("crossRefCarriesTargetAndNumber", () => {
    const html = '<p>see <a href="#prop:x">prop:x</a>, <a href="#prop:x">this</a> and <a href="#nowhere">nowhere</a></p>';
    const out = resolveRefs(html, { "prop:x": "ch/sec" }, { "prop:x": "2.3.1" });
    expect(out).toContain('<a href="#prop:x" data-at="ch/sec">2.3.1</a>');
    expect(out).toContain('<a href="#prop:x" data-at="ch/sec">this</a>');
    expect(out).toContain('<a href="#nowhere">nowhere</a>');
  });

  test("blockSlugsKeepKindPrefix", () => {
    const taken = new Set<string>();
    expect(blockSlug({ label: "prop:foo", root: "foo" }, taken)).toBe("prop-foo");
    expect(blockSlug({ label: "def:foo", root: "foo" }, taken)).toBe("def-foo");
    expect(blockSlug({ root: "prop-foo" }, taken)).toBe("prop-foo-2");
  });

  test("routeConfigurableRelativeLinks", async () => {
    const d = scaffold();
    const out = join(d, "_site");
    await buildFolioSite(d, out, { route: "docs/x" });
    expect(existsSync(join(out, "docs", "x", "handbook", "index.html"))).toBe(true);
    expect(shellHtml("T", 3, { paper: "p", path: "a/b" })).toContain('src="../../../assets/folio-site.js"');
    expect(shellHtml("T", 0, {})).toContain('data-root="./"');
  });

  test("sectionSlugsDropPrefix", () => {
    const taken = new Set<string>();
    expect(sectionSlug({ label: "sec:braid-group", title: "x" }, taken)).toBe("braid-group");
    expect(sectionSlug({ title: "Braid group" }, taken)).toBe("braid-group-2");
    expect(sectionSlug({ title: "$q$-Langlands" }, taken)).toBe("q-langlands");
  });
});

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { preambleMacros, texFences } from "./build-folio-site.js";
import { qaBlockHtml } from "./folio-site-qa.js";
import { citationsToHtml, renderDocumentHtml, texInMarkdown } from "./build-document-site.js";

describe("rendered-content handling and QA (owner, 2026-10-05)", () => {
  test("texFenceSvgOnHashMatch", () => {
    const md = "```tex\n\\begin{tikzcd} A \\ar[r] & B \\end{tikzcd}\n```\n";
    const real = createHash("sha256").update("\\begin{tikzcd} A \\ar[r] & B \\end{tikzcd}").digest("hex").slice(0, 12);
    const hit = texFences(md, { math: true, rendered: [{ hash: real, url: "rendered/x-0.svg" }], asset: () => "rendered/ch/x-0.svg" });
    expect(hit).toContain('<img data-src="rendered/ch/x-0.svg"');
    const stale = texFences(md, { math: true, rendered: [{ hash: "000000000000", url: "rendered/x-0.svg" }], asset: () => "rendered/ch/x-0.svg" });
    expect(stale).not.toContain("<img");
    expect(stale).toContain("[Diagram]");
  });

  test("equationFenceBecomesDisplayMath", () => {
    const out = texFences("```tex\n\\begin{equation}\\label{eq:a} x = 1 \\end{equation}\n```\n", { math: true, rendered: [], asset: () => undefined });
    expect(out).toContain("$$\nx = 1\n$$");
  });

  test("preambleMacrosToKatex", () => {
    const d = mkdtempSync(join(tmpdir(), "pre-"));
    roots.push(d);
    mkdirSync(join(d, "latex"));
    writeFileSync(join(d, "latex", "p.tex"), "\\newcommand{\\pp}{p} % prime\n\\newcommand{\\ip}[2]{\\langle #1,#2\\rangle}\n\\DeclareMathOperator{\\Hom}{Hom}\n");
    expect(preambleMacros(d)).toEqual({ "\\pp": "p", "\\ip": "\\langle #1,#2\\rangle", "\\Hom": "\\operatorname{Hom}" });
  });

  test("texRewrittenForKatex", () => {
    expect(texInMarkdown("$\\text{$n$-body}$")).toBe("$\\text{\\(n\\)-body}$");
    expect(texInMarkdown("| $\\langle a | b\\rangle$ | x |")).toContain("\\langle a \\vert  b\\rangle");
    expect(texInMarkdown("$a$$b$")).toBe("$a$ $b$");
    expect(texInMarkdown("see \\ref{eq:x}")).toBe('see <a href="#eq:x">eq:x</a>');
    expect(texInMarkdown("$\\begin{psmallmatrix} a \\end{psmallmatrix}$")).toBe("$\\left(\\begin{smallmatrix} a \\end{smallmatrix}\\right)$");
  });

  test("wrappedCitationIsOne", () => {
    expect(citationsToHtml("as in \\cite{a,\n  b}; done")).toBe('as in <span class="cite" data-keys="a b">[a, b]</span>; done');
    const fenced = "```tex\n\\cite{x}\n```\n\n\\cite{y}";
    expect(citationsToHtml(fenced)).toBe('```tex\n\\cite{x}\n```\n\n<span class="cite" data-keys="y">[y]</span>');
    expect(citationsToHtml("a\n\nb")).toBe("a\n\nb");
  });

  test("qaReadsReaderHtml", async () => {
    const html = await renderDocumentHtml("Fine $x^2$ and bad $\\frac{1$ and raw \\begin{foo} text.", { math: true });
    const { findings } = await qaBlockHtml("b", html, { math: true, macros: {} });
    const classes = findings.map((f) => f.class).sort();
    expect(classes).toContain("raw-tex");
    expect(classes).toContain("katex");
    const clean = await qaBlockHtml("c", await renderDocumentHtml("A $\\langle a, b\\rangle$ & $x<y$.", { math: true }), { math: true, macros: {} });
    expect(clean.findings).toEqual([]);
  });
});

import { leanStatus } from "./build-folio-site.js";
test("leanSorryOutsideComments", () => {
  expect(leanStatus("theorem t : 1 = 1 := rfl")).toBe("proved");
  expect(leanStatus("theorem t : P := by\n  sorry")).toBe("sorry");
  expect(leanStatus("-- sorry was here\n/- sorry -/\ntheorem t : 1 = 1 := rfl")).toBe("proved");
});

#!/usr/bin/env bun
/**
 * build-folio-site — a folio as lightweight static pages that load their
 * content from the knowledge graph. Owner, 2026-10-05:
 *
 * > there should be a static page like <base_url>/cat-harness/folio/<paper>,
 * > <base_url>/cat-harness/folio/<paper>/<chapter> and
 * > <base_url>/cat-harness/folio/<paper>/<chapter>/<section> etc... these
 * > should be super light weight and use dynamic loading of KG content.
 *
 * ## Why not one page per document
 *
 * `build-document-site.ts` writes each document as one page. For qou that page
 * is 12 MB with ~83,000 equations: usable, but only after a long download, and
 * a link to one section still fetches the whole paper. Here every page is the
 * same small shell, and what it shows is fetched:
 *
 *   <route>/index.html                               the folio's documents
 *   <route>/<paper>/index.html                       the paper: chapters load as you scroll
 *   <route>/<paper>/<chapter>/index.html             the chapter: sections load as you scroll
 *   <route>/<paper>/<chapter>/<section>/…/index.html one section (subsections nest)
 *   <route>/<paper>/b/<block>/index.html             one block, breadcrumbed chapter › section › block
 *   <route>/<paper>/outline.json                     the paper and its chapters, nothing deeper
 *   <route>/<paper>/outline/<chapter>.json           one chapter's sections and blocks, in manifest order
 *   <route>/<paper>/labels/<chapter>.json            one chapter's label → page and label → number
 *   <route>/<paper>/blocks/<chapter>/<block>.json    one block's KG node, its rendered HTML, its QA summary and Lean
 *   <route>/<paper>/qa/<chapter>/<block>.json        one block's full QA report, fetched when a reader opens it
 *   <route>/assets/folio-site.{js,css}               the one loader every shell shares
 *
 * `<route>` defaults to `cat-harness/folio`.
 *
 * ## What a page fetches, and why the outline is sharded (outline v2)
 *
 * The v1 outline carried every chapter's tree and two paper-wide maps (label →
 * page, label → number) in one file, and every page fetched it. Measured on qou
 * 2026-10-10 it was 736 KB — labels 334 KB, chapters 305 KB, numbers 119 KB —
 * against 0.2% of a section page's bytes being the content itself. Now:
 *
 * - every page fetches the TOP-LEVEL outline (the chapters, no sections);
 * - a chapter, section or block page fetches its ONE chapter's outline; the
 *   paper page fetches each chapter's as the reader scrolls to it;
 * - a cross-reference needs no index at all: its target page and printed number
 *   are written into the block HTML at build time (`data-at`, and the link
 *   text), so the label maps are read only to resolve a `#label` that arrived
 *   in the URL, and then only per chapter.
 *
 * ## The block payload IS the KG node
 *
 * Every block already has a JSON-LD node beside it (`<block>.jsonld`, written
 * by `gen-block-jsonld.ts`: `@id`, `@type`, kind, label, title, `uses`). The
 * payload is that node, unchanged, with added properties: `html`, the body
 * rendered by `renderDocumentHtml`, so math, glossary directives and
 * citations behave exactly as on the document site; `qa`, the badge's counts;
 * and `lean`, the resolved formalisation (`folio-site-blocks.ts`). A block with
 * no `.jsonld` still gets a payload built from its manifest, so a folio whose
 * graph has not been generated is not a blank site.
 *
 * ## Links work from any depth, and under a staging prefix
 *
 * A shell names its own depth (`data-root`, relative), so the same tree works
 * at `/`, under `/branches/<branch>/` and from a local file server. Nothing
 * absolute is baked in.
 */
import { editLinksAsset } from "@litlfred/cat-harness-tools/src/core/edit-links.js";
import { createHash } from "node:crypto";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { readHarnessConfig } from "@litlfred/cat-harness-tools/schemas/kg/harness-config.js";
import { CONFIG_SUFFIX, isReservedIndexFile } from "@litlfred/cat-harness-tools/schemas/kg/instance-roots.js";
import type { FormalTreeCache } from "@litlfred/cat-harness-tools/schemas/formal-ref.js";
import type { Block, Chapter, Paper, Section, SectionRef } from "@litlfred/cat-harness-tools/schemas/types.js";
import { kindHeading } from "@litlfred/cat-harness-tools/schemas/content/translation.js";
import { resolveLiquidValues } from "@litlfred/cat-harness-tools/pipeline/liquid-values.js";
import { bundleEditorProfiles, type SuggestProfile } from "@litlfred/cat-harness-tools/pipeline/editor-profiles.js";
import { documentManifests, katexMacros, renderDocumentHtml } from "./build-document-site.js";
import { blockLean, blockQaReport, configureFolioLeanPackages, loadLeanStatus, qaSummary, textHasSorry, type LeanStatusIndex } from "./folio-site-blocks.js";
import { addToReport, emptyReport, imageExistsUnder, qaBlockHtml, type SiteQaReport } from "./folio-site-qa.js";

export const SITE_OUTLINE_SCHEMA = "folio-site-outline/v2" as const;

export interface SiteSection {
  slug: string;
  /** `2.3`, `2.3.1`: the section's number, as a paper prints it. */
  number: string;
  title: string;
  label?: string;
  /** The section's own blocks, by manifest root: the payload is `blocks/<chapter>/<root>.json`. */
  blocks: string[];
  sections: SiteSection[];
  /**
   * Lean under this entry, its subsections included: formalisations with no
   * sorry / with a sorry, and blocks whose kind expects Lean but none resolves.
   */
  lean: { proved: number; sorry: number; absent: number };
}
/** A chapter as the TOP-LEVEL outline lists it: no sections — those are in `outline/<slug>.json`. */
export interface SiteChapter {
  slug: string;
  number: string;
  title: string;
  label?: string;
  lean: { proved: number; sorry: number; absent: number };
}
/** `outline/<chapter>.json`: one chapter's tree. */
export interface SiteChapterOutline extends SiteChapter {
  $schema: "folio-site-chapter/v1";
  sections: SiteSection[];
}
/** `labels/<chapter>.json`: a label → its page below the paper, and its printed number. */
export interface SiteLabels {
  labels: Record<string, string>;
  numbers: Record<string, string>;
}
export interface SiteOutline {
  $schema: typeof SITE_OUTLINE_SCHEMA;
  slug: string;
  title: string;
  math: boolean;
  macros: Record<string, string>;
  chapters: SiteChapter[];
  /** Where the sources live, for each block's edit / feedback / Lean links. Absent when undeclared. */
  source?: { repository: string; ref: string };
  /** Whether Lean compile status was measured for this build, and how; absent when it was not. */
  leanStatus?: { measuredAt?: string; method?: string; toolchain?: string };
  /**
   * The ✍ suggest editor's profiles for this content type (editor-checker
   * nodes, bundled by `bundleEditorProfiles`), each `module` relative to the
   * route base; the viewer hands them, with `macros`, to the edit-links runtime.
   */
  suggest?: { profiles: SuggestProfile[] };
}

const isRef = (s: Section | SectionRef): s is SectionRef => !("blocks" in s);

/** The kinds a paper numbers (amsthm's theorem-like environments). Proofs, prose, equations and figures are not. */
const NUMBERED_KINDS = new Set(["definition", "theorem", "lemma", "proposition", "corollary", "conjecture", "example", "remark", "algorithm"]);

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** `sec:commutative-formal-group` -> `commutative-formal-group`; a title is slugified. */
export function sectionSlug(sec: { label?: string; title: string }, taken: Set<string>): string {
  const base = slugify(sec.label ? sec.label.replace(/^[a-z]+:/i, "") : sec.title) || "section";
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  taken.add(slug);
  return slug;
}

/**
 * A block page's slug: its label with the kind prefix kept (`prop:foo` →
 * `prop-foo`, so a definition and a proposition of one name do not collide),
 * else its manifest root. Unique within the paper.
 */
export function blockSlug(block: { label?: string; root: string }, taken: Set<string>): string {
  const base = slugify(block.label ?? block.root) || "block";
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  taken.add(slug);
  return slug;
}

/** How deep below `<route>` a shell sits, as a relative prefix back to `<route>`. */
const up = (depth: number) => (depth === 0 ? "./" : "../".repeat(depth));

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * The shell every page is: a title, a scope, and the shared loader. A block
 * page names its block (`data-block`, `<chapter>/<root>`) as well as the
 * section that holds it (`data-path`).
 */
export function shellHtml(title: string, depth: number, scope: { paper?: string; path?: string; block?: string }): string {
  const root = up(depth);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="fa-render-regions" content="1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<link rel="stylesheet" href="${root}assets/folio-site.css">
<script defer src="${root}assets/kg-render.js"></script>
<script defer src="${root}assets/edit-links.js"></script>
<script defer src="${root}assets/folio-site.js"></script>
</head>
<body data-root="${root}" data-paper="${esc(scope.paper ?? "")}" data-path="${esc(scope.path ?? "")}"${scope.block ? ` data-block="${esc(scope.block)}"` : ""}>
<div class="folio-page"><nav id="toc" aria-label="Contents"></nav>
<main><p class="crumbs" id="crumbs"></p><h1>${esc(title)}</h1><div id="content"><p class="muted">Loading…</p></div></main></div>
</body>
</html>
`;
}

/**
 * A block's fenced ```tex blocks, made readable. The paper pipeline has no
 * HTML for raw TeX environments, so on the site they were code listings.
 *
 * 1. A PRE-RENDERED SVG, when the block manifest's `rendered[]` lists one whose
 *    `hash` equals this fence's — sha256 of the trimmed source, first 12 hex,
 *    exactly as `render-tex-blocks.ts` computes it. Matched by HASH, never by
 *    position: a manifest can list an asset for a fence that has since changed
 *    or gone, and showing it would show the wrong picture.
 * 2. Display MATH, when the fence is an environment KaTeX renders (anything but
 *    `tikzcd` / `tikzpicture` / `tabular`), with `equation` unwrapped and
 *    `\label` dropped. Only when math is on.
 * 3. Otherwise a labelled placeholder with the source behind a disclosure, as
 *    the viewer does.
 *
 * An SVG is emitted as `<img data-src="rendered/<chapter>/<file>">`, a path
 * below the paper, and the loader resolves it against the paper's base: the
 * same block is shown on pages at different depths.
 */
export function texFences(
  md: string,
  opts: { math: boolean; rendered: Array<{ hash?: string; url: string; mime?: string }>; asset: (url: string) => string | undefined },
): string {
  return md.replace(/^([ \t]*)```tex[^\n]*\n([\s\S]*?)^[ \t]*```[ \t]*$/gm, (_m, indent: string, body: string) => {
    const source = body.trim();
    const hash = createHash("sha256").update(source).digest("hex").slice(0, 12);
    const hit = opts.rendered.find((r) => r.hash === hash && (r.mime ?? "image/svg+xml").startsWith("image/"));
    const src = hit ? opts.asset(hit.url) : undefined;
    const escSrc = source.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    if (src) return `${indent}<figure class="tex-svg"><img data-src="${src}" alt="${escSrc}" loading="lazy"></figure>`;
    const diagram = /\\begin\{(tikzcd|tikzpicture|tabular)\}/.exec(source);
    if (opts.math && !diagram) {
      const inner = source
        .replace(/\\label\{[^}]*\}/g, "")
        .replace(/\\begin\{equation\*?\}|\\end\{equation\*?\}/g, "")
        .replace(/^\\\[|\\\]$/g, "")
        .trim();
      return `${indent}$$\n${inner}\n$$`;
    }
    const label = diagram?.[1] === "tabular" ? "Table" : "Diagram";
    return `${indent}<div class="tex-ph"><strong>[${label}]</strong><details><summary>LaTeX source</summary><pre>${escSrc}</pre></details></div>`;
  });
}


/** The brace-balanced group starting at `s[i] === "{"`; returns its body and the index after it. */
function group(s: string, i: number): [string, number] | undefined {
  if (s[i] !== "{") return undefined;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "\\") { j++; continue; }
    if (s[j] === "{") depth++;
    else if (s[j] === "}" && --depth === 0) return [s.slice(i + 1, j), j + 1];
  }
  return undefined;
}

/**
 * KaTeX macros from a paper's own LaTeX preamble (`folio/<paper>/latex/*.tex`):
 * `\newcommand` / `\renewcommand` / `\providecommand` (with or without an
 * argument count) and `\DeclareMathOperator`. qou defines `\pp` there and
 * deliberately NOT in the manifest's `macros`, so without this 46 equations
 * reached the reader as "undefined control sequence". The manifest wins on a
 * name both define. A definition this cannot parse is skipped, not guessed.
 */
export function preambleMacros(paperDir: string): Record<string, string> {
  const dir = join(paperDir, "latex");
  const out: Record<string, string> = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".tex")).sort()) {
    const src = readFileSync(join(dir, f), "utf-8").replace(/(^|[^\\])%.*$/gm, "$1");
    const re = /\\(newcommand|renewcommand|providecommand|DeclareMathOperator)\*?\s*\{?\s*(\\[A-Za-z]+)\s*\}?/g;
    for (let m = re.exec(src); m; m = re.exec(src)) {
      let i = re.lastIndex;
      while (src[i] === " ") i++;
      if (src[i] === "[") i = src.indexOf("]", i) + 1; // argument count: KaTeX infers #1… from the body
      while (src[i] === " ") i++;
      if (src[i] === "[") break; // an optional-argument default: not representable, skip the rest safely
      const g = group(src, i);
      if (!g) continue;
      out[m[2]!] = m[1] === "DeclareMathOperator" ? `\\operatorname{${g[0]}}` : g[0];
      re.lastIndex = g[1];
    }
  }
  return out;
}

/**
 * The layer's declared repository (`<name>.json` → `repository`,
 * `owner/repo`), for the edit and feedback links. The declaration is the
 * file whose stem equals its own `name`, the rule `findDeclarationFile`
 * applies. Absent when there is none: then the links are not drawn, rather
 * than drawn at a guessed URL.
 */
export function declaredRepository(repoRoot: string): { repository: string; ref: string } | undefined {
  // Not a config, and not a reserved `index.*` file (`index.config.json`,
  // `index.lock.json`): `CONFIG_SUFFIX` and `isReservedIndexFile` are the
  // shared rule, so a root scan here cannot read either as a declaration.
  for (const f of readdirSync(repoRoot).filter((n) => n.endsWith(".json") && !n.endsWith(CONFIG_SUFFIX) && !isReservedIndexFile(n))) {
    try {
      const d = JSON.parse(readFileSync(join(repoRoot, f), "utf-8")) as { name?: string; repository?: string };
      if (d.name && `${d.name}.json` === f && typeof d.repository === "string" && /^[\w.-]+\/[\w.-]+$/.test(d.repository)) {
        return { repository: d.repository, ref: "main" };
      }
    } catch {
      /* not a declaration */
    }
  }
  return undefined;
}

/**
 * `sorry` when a `sorry` term remains outside comments, else `proved`. A
 * text-level reading of the sibling, not an elaboration: it does not see a
 * sorry inherited from an import, so the site labels it "no sorry here", and
 * the Lean build (L3's baseline) stays the authority on whether it compiles.
 */
export function leanStatus(src: string): "proved" | "sorry" {
  return textHasSorry(src) ? "sorry" : "proved";
}


/**
 * Cross-references, resolved at build time. A `\ref` renders as
 * `<a href="#label">label</a>`; each one whose label the paper defines gets
 * `data-at` (the page below the paper that holds it) and, when its text is the
 * bare label, the label's printed number. That is what lets a page resolve a
 * reference without fetching any label index.
 */
export function resolveRefs(html: string, labels: Record<string, string>, numbers: Record<string, string>): string {
  return html.replace(/<a href="#([^"]+)"([^>]*)>([^<]*)<\/a>/g, (m, href: string, rest: string, text: string) => {
    let label = href;
    try {
      label = decodeURIComponent(href);
    } catch {
      /* not encoded */
    }
    const at = labels[label];
    if (at === undefined || /data-at=/.test(rest)) return m;
    const shown = text === label && numbers[label] ? numbers[label] : text;
    return `<a href="#${href}"${rest} data-at="${esc(at)}">${shown}</a>`;
  });
}

/**
 * The shared client renderer (`kg-render.js`: the three-state fetch, failure
 * notes, and `data-fa-render` for print), with its documentation stripped:
 * the source is ~70% comment, and every page loads it.
 */
export function kgRenderAsset(): string {
  // declared-path-literal: one specific published asset of the harness layer, read as a
  // sibling layer the way this file imports its modules; absent, the loader works without it.
  const src = join(import.meta.dir, "../../cat-harness/docs/assets/js/kg-render.js");
  if (!existsSync(src)) return "/* kg-render.js not found in this checkout; folio-site.js works without it */\n";
  return (
    "// kg-render.js — cat-harness/docs/assets/js/kg-render.js, comments stripped (its source carries the documentation).\n" +
    readFileSync(src, "utf-8")
      .replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*\n/gm, "")
      .replace(/^[ \t]*\/\/.*\n/gm, "")
      .replace(/\n{2,}/g, "\n")
  );
}

export interface FolioSiteResult {
  papers: {
    slug: string;
    blocks: number;
    pages: number;
    qa: SiteQaReport;
    /** Blocks with a QA verdict, and Lean found / expected-but-absent / found through `lean.ref` only. */
    meta: { qaReports: number; leanFound: number; leanAbsent: number; leanViaRef: number; leanCompile: Record<string, number> };
  }[];
  errors: string[];
  /** Where the Lean packages came from, or `undefined` when the folio declares none. */
  leanPackages?: { from?: string; count: number };
}

interface PendingBlock {
  rel: string;
  node: Record<string, unknown>;
}

export async function buildFolioSite(
  repoRoot: string,
  outDir: string,
  opts: { route?: string; math?: boolean; repository?: string; ref?: string; leanStatus?: string; leanPackages?: string } = {},
): Promise<FolioSiteResult> {
  // declared-path-literal: this is the published URL ROUTE the owner named
  // (2026-10-05: "<base_url>/cat-harness/folio/<paper>/<chapter>/<section>"),
  // under the OUTPUT directory — not cat-harness's declared `folio/` graph, and
  // nothing is read from that directory. Resolving the declaration here would
  // tie a URL to wherever a layer keeps its sources. `--route` overrides it.
  const route = (opts.route ?? "cat-harness/folio").replace(/^\/+|\/+$/g, "");
  const base = join(outDir, route);
  const math = opts.math ?? readHarnessConfig(repoRoot)?.contentType === "paper";
  const result: FolioSiteResult = { papers: [], errors: [] };
  const docs = documentManifests(repoRoot);
  if (docs.length === 0) {
    result.errors.push(`no document manifest under ${repoRoot} (expected folio/<slug>/<slug>.ts)`);
    return result;
  }
  mkdirSync(join(base, "assets"), { recursive: true });
  cpSync(join(import.meta.dir, "folio-site-assets"), join(base, "assets"), { recursive: true });
  // The platform's one recipe for edit and feedback links (bean v433).
  writeFileSync(join(base, "assets", "edit-links.js"), editLinksAsset());
  writeFileSync(join(base, "assets", "kg-render.js"), kgRenderAsset());
  // The ✍ suggest editor's checks and Crepe settings for this content type (bean 4dx7).
  const contentType = readHarnessConfig(repoRoot)?.contentType;
  const suggestProfiles = contentType ? await bundleEditorProfiles(repoRoot, contentType, join(base, "assets", "suggest"), "assets/suggest/") : [];

  result.leanPackages = await configureFolioLeanPackages(repoRoot, opts.leanPackages);
  const status: LeanStatusIndex = loadLeanStatus(opts.leanStatus);
  const leanCache: FormalTreeCache = new Map();

  const papers: { slug: string; title: string }[] = [];
  const sourceRepo = opts.repository ? { repository: opts.repository, ref: opts.ref ?? "main" } : declaredRepository(repoRoot);
  for (const d of docs) {
    const paper = (await import(d.path)).default as Paper;
    const docDir = dirname(d.path);
    const paperOut = join(base, d.slug);
    const outline: SiteOutline = {
      $schema: SITE_OUTLINE_SCHEMA,
      slug: d.slug,
      title: paper.title ?? d.slug,
      math,
      macros: math ? { ...preambleMacros(docDir), ...katexMacros(paper.macros) } : {},
      chapters: [],
      ...(sourceRepo ? { source: sourceRepo } : {}),
      ...(status.meta ? { leanStatus: status.meta } : {}),
      ...(suggestProfiles.length ? { suggest: { profiles: suggestProfiles } } : {}),
    };
    // Paper-wide while building (a reference may cross chapters); written out per chapter.
    const labels: Record<string, string> = {};
    const numbers: Record<string, string> = {};
    const labelChapter: Record<string, string> = {};
    const pending: PendingBlock[] = [];
    const chapterOutlines: SiteChapterOutline[] = [];
    const blockSlugs = new Set<string>();
    const meta = { qaReports: 0, leanFound: 0, leanAbsent: 0, leanViaRef: 0, leanCompile: {} as Record<string, number> };
    let blockCount = 0;
    const qa = emptyReport();
    let pages = 1;
    const writeShell = (path: string, title: string, block?: string) => {
      const depth = path ? path.split("/").length + 1 : 1;
      const dir = join(paperOut, path);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "index.html"), shellHtml(title, depth, { paper: d.slug, path: block ? undefined : path, block }));
      pages++;
    };
    const setLabel = (label: string, path: string, chapter: string, number?: string) => {
      labels[label] = path;
      labelChapter[label] = chapter;
      if (number) numbers[label] = number;
    };

    let chIndex = 0;
    for (const chRef of paper.chapters) {
      const chDir = join(docDir, chRef.dir);
      const chPath = join(chDir, `${chRef.dir}.ts`);
      if (!existsSync(chPath)) {
        result.errors.push(`${d.slug}: chapter manifest not found: ${relative(repoRoot, chPath)}`);
        continue;
      }
      const chapter = (await import(chPath)).default as Chapter;
      const chNum = String(++chIndex);
      const ch: SiteChapterOutline = {
        $schema: "folio-site-chapter/v1",
        slug: chRef.dir,
        number: chNum,
        title: chapter.title,
        ...(chapter.label ? { label: chapter.label } : {}),
        lean: { proved: 0, sorry: 0, absent: 0 },
        sections: [],
      };
      if (chapter.label) setLabel(chapter.label, chRef.dir, chRef.dir, chNum);

      // amsthm numbering: theorem-like blocks share ONE counter per top-level
      // section, so a statement prints as `Proposition <chapter>.<section>.<n>`;
      // a subsection's blocks continue its section's counter.
      const walk = async (
        secs: Array<Section | SectionRef>,
        parentPath: string,
        taken: Set<string>,
        parentNum: string,
        counter: { section: string; n: number } | null,
      ): Promise<SiteSection[]> => {
        const out: SiteSection[] = [];
        let secIndex = 0;
        for (const sec of secs) {
          if (isRef(sec)) continue;
          const slug = sectionSlug(sec, taken);
          const path = `${parentPath}/${slug}`;
          const number = `${parentNum}.${++secIndex}`;
          const count = counter ?? { section: number, n: 0 };
          const s: SiteSection = { slug, number, title: sec.title, ...(sec.label ? { label: sec.label } : {}), blocks: [], sections: [], lean: { proved: 0, sorry: 0, absent: 0 } };
          if (sec.label) setLabel(sec.label, path, chRef.dir, number);
          for (const root of sec.blocks) {
            const ts = join(chDir, `${root}.ts`);
            if (!existsSync(ts)) {
              result.errors.push(`${d.slug}: block manifest not found: ${relative(repoRoot, ts)}`);
              continue;
            }
            const block = (await import(ts)).default as Block;
            const mdPath = join(chDir, `${root}.md`);
            const mdContent = existsSync(mdPath) ? readFileSync(mdPath, "utf-8") : "";
            const rendered = (block as { rendered?: Array<{ hash?: string; url: string; mime?: string }> }).rendered ?? [];
            const body = texFences(mdContent, {
              math,
              rendered,
              asset: (url) => {
                const from = join(chDir, url);
                if (!existsSync(from)) return undefined;
                const rel = `rendered/${chRef.dir}/${url.replace(/^rendered\//, "")}`;
                mkdirSync(dirname(join(paperOut, rel)), { recursive: true });
                copyFileSync(from, join(paperOut, rel));
                return rel;
              },
            });
            // The heading (kind, number, title) is the loader's to typeset; the payload carries it as data.
            const label = "label" in block && typeof block.label === "string" ? block.label : undefined;
            const anchor = label ? `<a id="${esc(label)}"></a>` : "";
            const html = anchor + (await renderDocumentHtml(resolveLiquidValues(body).trim(), { math })); // witnessed values, as render-markdown.ts resolves them
            const jsonld = join(chDir, `${root}.jsonld`);
            const node: Record<string, unknown> = existsSync(jsonld)
              ? JSON.parse(readFileSync(jsonld, "utf-8"))
              : { kind: block.kind, ...(label ? { label } : {}), ...("title" in block && block.title ? { title: block.title } : {}) };
            node.html = html;
            node.kind = block.kind;
            // Repo-relative paths, so the loader can link the edit page and the Lean file.
            node.source = relative(repoRoot, mdPath);
            node.heading = block.kind === "prose" ? "" : kindHeading(block.kind, "en");
            if ("title" in block && typeof block.title === "string") node.title = block.title;
            if (NUMBERED_KINDS.has(block.kind)) node.number = `${count.section}.${++count.n}`;
            if (label) setLabel(label, path, chRef.dir, node.number as string | undefined);
            // Its own page, and its QA and Lean.
            const page = blockSlug({ label, root }, blockSlugs);
            node.page = `b/${page}`;
            const report = blockQaReport(existsSync(mdPath) ? mdPath : ts, repoRoot);
            if (report) {
              node.qa = qaSummary(report);
              const qrel = join("qa", chRef.dir, `${root}.json`);
              mkdirSync(dirname(join(paperOut, qrel)), { recursive: true });
              writeFileSync(join(paperOut, qrel), JSON.stringify(report) + "\n");
              meta.qaReports++;
            }
            const leanRef = (block as { lean?: { ref?: unknown } }).lean?.ref;
            const lean = blockLean({
              kind: block.kind,
              ref: typeof leanRef === "string" ? leanRef : undefined,
              sibling: join(chDir, `${root}.lean`),
              repoRoot,
              status,
              cache: leanCache,
            });
            if (lean.expected || lean.path) node.lean = lean;
            if (lean.path) {
              meta.leanFound++;
              if (lean.via === "ref") meta.leanViaRef++;
              meta.leanCompile[lean.compiles!] = (meta.leanCompile[lean.compiles!] ?? 0) + 1;
              s.lean[lean.sorry ? "sorry" : "proved"]++;
            } else if (lean.expected) {
              meta.leanAbsent++;
              s.lean.absent++;
            }
            const q = await qaBlockHtml(`${chRef.dir}/${root}`, html, { math, macros: outline.macros, imageExists: imageExistsUnder(paperOut) });
            addToReport(qa, q.findings, q.katexUnknown);
            pending.push({ rel: `blocks/${chRef.dir}/${root}.json`, node });
            s.blocks.push(root);
            blockCount++;
            const name = node.number ? `${node.heading} ${node.number}` : (node.heading as string) || (node.title as string) || root;
            writeShell(node.page as string, name + (node.number && node.title ? ` (${node.title})` : ""), `${chRef.dir}/${root}`);
          }
          if (sec.subsections) {
            s.sections = await walk(sec.subsections, path, new Set(), number, count);
            for (const sub of s.sections) for (const k of ["proved", "sorry", "absent"] as const) s.lean[k] += sub.lean[k];
          }
          writeShell(path, sec.title);
          out.push(s);
        }
        return out;
      };
      ch.sections = await walk(chapter.sections, chRef.dir, new Set(), chNum, null);
      for (const s of ch.sections) for (const k of ["proved", "sorry", "absent"] as const) ch.lean[k] += s.lean[k];
      writeShell(chRef.dir, chapter.title);
      chapterOutlines.push(ch);
      outline.chapters.push({ slug: ch.slug, number: ch.number, title: ch.title, ...(ch.label ? { label: ch.label } : {}), lean: ch.lean });
    }

    // Now that every label is known, the block payloads go out with their references resolved.
    for (const { rel, node } of pending) {
      node.html = resolveRefs(node.html as string, labels, numbers);
      mkdirSync(dirname(join(paperOut, rel)), { recursive: true });
      writeFileSync(join(paperOut, rel), JSON.stringify(node) + "\n");
    }
    mkdirSync(join(paperOut, "outline"), { recursive: true });
    mkdirSync(join(paperOut, "labels"), { recursive: true });
    for (const ch of chapterOutlines) {
      writeFileSync(join(paperOut, "outline", `${ch.slug}.json`), JSON.stringify(ch) + "\n");
      const shard: SiteLabels = { labels: {}, numbers: {} };
      for (const [l, c] of Object.entries(labelChapter)) {
        if (c !== ch.slug) continue;
        shard.labels[l] = labels[l]!;
        if (numbers[l]) shard.numbers[l] = numbers[l]!;
      }
      writeFileSync(join(paperOut, "labels", `${ch.slug}.json`), JSON.stringify(shard) + "\n");
    }
    writeFileSync(join(paperOut, "outline.json"), JSON.stringify(outline) + "\n");
    // The rendered-content QA, beside the site it judges (folio-site-qa.ts).
    writeFileSync(join(paperOut, "qa.json"), JSON.stringify(qa, null, 1) + "\n");
    writeFileSync(join(paperOut, "index.html"), shellHtml(outline.title, 1, { paper: d.slug, path: "" }));
    papers.push({ slug: d.slug, title: outline.title });
    result.papers.push({ slug: d.slug, blocks: blockCount, pages, qa, meta });
  }
  writeFileSync(join(base, "papers.json"), JSON.stringify({ papers }) + "\n");
  writeFileSync(join(base, "index.html"), shellHtml("Folio", 0, {}));
  return result;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  if (args.includes("--help")) {
    console.log(
      "usage: bun run folio-assistant-core/scripts/build-folio-site.ts [--repo <folio root>] [--out _site] [--route cat-harness/folio] [--math | --no-math] [--strict] " +
        "[--source-repo owner/repo] [--source-ref main] [--lean-status <qou-lean-status/v1 json>] [--lean-packages <module exporting LEAN_PACKAGES>]",
    );
    process.exit(0);
  }
  const repo = resolve(opt("repo") ?? process.cwd());
  const out = resolve(repo, opt("out") ?? "_site");
  const math = args.includes("--math") ? true : args.includes("--no-math") ? false : undefined;
  const leanStatusPath = opt("lean-status");
  const r = await buildFolioSite(repo, out, {
    route: opt("route"),
    math,
    repository: opt("source-repo"),
    ref: opt("source-ref"),
    leanStatus: leanStatusPath ? resolve(leanStatusPath) : undefined,
    leanPackages: opt("lean-packages"),
  });
  let qaTotal = 0;
  console.error(
    r.leanPackages?.count
      ? `  Lean packages: ${r.leanPackages.count} from ${r.leanPackages.from}`
      : "  Lean packages: none declared — a lean.ref cannot be resolved, only a sibling .lean",
  );
  for (const p of r.papers) {
    const c = p.qa.counts;
    const m = p.meta;
    qaTotal += p.qa.findings.length;
    console.error(
      `  ${p.slug}: ${p.blocks} block(s), ${p.pages} page(s); rendered QA: raw-tex ${c["raw-tex"]}, raw-directive ${c["raw-directive"]}, ` +
        `stray-dollar ${c["stray-dollar"]}, katex ${c.katex}, missing-image ${c["missing-image"]}` +
        (p.qa.unknown.length ? `; UNKNOWN: ${p.qa.unknown.join(", ")}` : "") +
        `; block QA reports ${m.qaReports}; Lean found ${m.leanFound} (${m.leanViaRef} via lean.ref only), expected-but-absent ${m.leanAbsent}; ` +
        `compile ${Object.entries(m.leanCompile).map(([k, v]) => `${k} ${v}`).join(", ") || "—"}`,
    );
  }
  if (!leanStatusPath) console.error("  Lean compile status: NOT MEASURED (pass --lean-status); every Lean link reads 'unchecked'");
  if (args.includes("--strict") && (qaTotal > 0 || r.papers.some((p) => p.qa.unknown.length))) {
    console.error(`✗ rendered QA: ${qaTotal} finding(s) (--strict); see <route>/<paper>/qa.json`);
    process.exit(1);
  }
  if (r.errors.length > 0) {
    for (const e of r.errors) console.error(`✗ ${e}`);
    process.exit(1);
  }
  console.error(`✓ ${r.papers.length} paper(s) → ${relative(repo, out) || "."}`);
}

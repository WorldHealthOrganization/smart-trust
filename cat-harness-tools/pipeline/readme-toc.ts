#!/usr/bin/env bun
/**
 * readme-toc.ts — the folio's table of contents, as Markdown for a README.
 *
 * One table per **paper in the folio**, not one table for the paper somebody
 * happened to hardcode. `scripts/generate-readme.sh` previously composed this
 * section inline with `quantum-observable-universe` and
 * `https://litlfred.github.io/qou` baked into it, which is content living in
 * the platform (AGENTS.md, "folio-assistant is the platform, not the
 * content") and wrong for every other folio.
 *
 * ## Links are resolved, never composed
 *
 * The section this replaces built PDF URLs by convention —
 * `${PAGES}/papers/<paper>/chapters/<dir>.pdf` — and checked nothing. The
 * `gh-pages` branch of the folio it was written for has no `chapters/`
 * directory at all, so all twenty-three chapter links were 404 *and had
 * always been*; three of six appendix links happened to resolve. A generated
 * table that cannot tell a live link from a dead one is worse than no table,
 * because it reads as verified.
 *
 * So every PDF cell here is checked against a real listing of the publish ref
 * (`git ls-tree -r --name-only gh-pages`) before it becomes a link. A chapter
 * whose PDF has not been published renders `—`.
 *
 * ## Link style, and why `raw` is not the private-repo answer
 *
 * A GitHub Pages URL only resolves when the Pages site is public. A private
 * folio's README full of `github.io` links is unreachable for exactly the
 * people who have access to the repository.
 *
 * `raw.githubusercontent.com` does not fix that: it returns 404 for a private
 * repository unless the request carries a token, and a browser session cookie
 * does not authenticate it. It is offered here as `linkStyle: "raw"` for
 * public folios that want hotlinkable asset URLs, and documented as
 * public-only, so the question does not have to be re-derived.
 *
 * What works for a private repository is `blob` — the default:
 * `https://github.com/<owner>/<repo>/blob/<ref>/<path>` honours the viewer's
 * GitHub session, and GitHub renders a PDF inline. Because the publish ref is
 * a branch in the same repository, the artefacts already have such a URL.
 *
 * @module pipeline/readme-toc
 */

import { folioDir } from "../schemas/kg/cat-harness.js";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { findPapers } from "./repo-root";
import { readEffectiveConfig } from "../schemas/kg/harness-config.ts";
// The git facts and the publish targets are generic and live in harness
// (bean `cp3l`). Re-exported because this module's callers have always got
// them from here, and moving a file should not break a folio's tooling.
import { DEFAULT_PUBLISH_REF, detectRepoUrl, ownerRepo, publishTargets, publishedPaths } from "../src/core/git-refs";
export { detectRepoUrl, publishedPaths } from "../src/core/git-refs";

// ── Configuration ───────────────────────────────────────────────────────────

/** How a published artefact is turned into a URL. */
export type LinkStyle = "blob" | "pages" | "raw";

export interface ReadmeTocConfig {
  /**
   * `blob` (default) — `github.com/<owner>/<repo>/blob/<ref>/<path>`. Works
   * for a private repo: it follows the viewer's session, and PDFs render
   * inline.
   *
   * `pages` — `<pagesBaseUrl>/<path>`. Public Pages sites only.
   *
   * `raw` — `raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>`. Public
   * repositories only; 404s on a private one without a token.
   */
  linkStyle: LinkStyle;
  /** Repo web URL, e.g. `https://github.com/owner/repo`. Auto-detected from `origin`. */
  repoUrl?: string;
  /** Git ref holding the published build. Default `gh-pages` when it exists. */
  publishRef: string;
  /** Base URL of the Pages site, for `linkStyle: "pages"`. */
  pagesBaseUrl?: string;
  /** Marker name delimiting the generated region of the README. */
  marker: string;
  /**
   * Where a chapter's standalone PDF lands in the published tree.
   * `{paper}` and `{chapter}` are substituted; the first path that exists in
   * the publish ref wins. Every folio's publish layout differs, and guessing
   * one is what produced the dead links this module exists to prevent.
   */
  pdfPathPatterns: string[];
  /** Where a whole paper's PDF lands. Same substitution, same first-hit rule. */
  paperPdfPathPatterns: string[];
}

const DEFAULT_CONFIG: ReadmeTocConfig = {
  linkStyle: "blob",
  publishRef: DEFAULT_PUBLISH_REF,
  marker: "folio:toc",
  pdfPathPatterns: [
    "papers/{paper}/chapters/{chapter}.pdf",
    "papers/{paper}/{chapter}.pdf",
    "{paper}/chapters/{chapter}.pdf",
    "chapters/{chapter}.pdf",
    "{chapter}.pdf",
  ],
  paperPdfPathPatterns: [
    "papers/{paper}/{paper}.pdf",
    "papers/{paper}.pdf",
    "{paper}.pdf",
  ],
};

/**
 * Read the `readme` block of `harness.config.json`, over the defaults.
 *
 * Absent config is not an error: a folio that has never thought about this
 * gets `blob` links against `gh-pages`, which is the option that works
 * whether or not the repository is public.
 */
export function loadReadmeConfig(root: string): ReadmeTocConfig {
  const eff = readEffectiveConfig(root);
  let fromFile: Partial<ReadmeTocConfig> = {};
  // The index entry when one lists the layer, else `<name>.config.json`.
  if (eff.state === "ok") {
    try {
      const parsed = eff.config as {
        readme?: Partial<ReadmeTocConfig>;
      };
      fromFile = parsed.readme ?? {};
    } catch {
      // A harness.config.json that will not parse is reported by the tools that
      // own it; the TOC falling back to defaults is better than refusing.
    }
  }
  // The three publish targets come from `publishTargets`, which reads the
  // SAME `readme` block — one file, one key, so the harness-level reader and
  // this one cannot drift. What is layered on here is the genuinely
  // README-shaped part: link style, marker, PDF path patterns.
  return { ...DEFAULT_CONFIG, ...publishTargets(root), ...fromFile };
}

// ── Folio structure ─────────────────────────────────────────────────────────

export interface PaperInfo {
  /** Directory under `folio/`. */
  dir: string;
  /** Title from the paper manifest, falling back to the folio entry, then the dir. */
  title: string;
}

export interface ChapterInfo {
  dir: string;
  title: string;
  kind: "chapter" | "appendix" | "index";
}

/**
 * A `title:` value, tolerating an apostrophe inside a double-quoted string
 * (`title: "Bring's Surface"`) via a backreferenced quote.
 */
function matchTitle(src: string): string | undefined {
  return src.match(/title:\s*("|')((?:\\.|(?!\1).)*)\1/)?.[2];
}

/**
 * The folio's papers, in authored order.
 *
 * Order comes from `paperRef` calls in `content/folio.ts`, because `readdir`
 * order is arbitrary and made the generated README churn between runs. A
 * folio with no `folio.ts` falls back to the sorted directory scan in
 * {@link findPapers} — enough for a single-paper folio, which is what such a
 * folio almost always is.
 */
export function discoverPapers(root: string): PaperInfo[] {
  const folioRoot = folioDir(root);
  const folioPath = join(folioRoot, "folio.ts");
  let entries: { dir: string; folioTitle?: string }[] = [];

  if (existsSync(folioPath)) {
    const src = readFileSync(folioPath, "utf-8");
    for (const m of src.matchAll(/paperRef\(\s*\{(.*?)\}\s*\)/gs)) {
      const body = m[1];
      const dir = body.match(/dir:\s*["']([^"']+)["']/)?.[1];
      if (dir) entries.push({ dir, folioTitle: matchTitle(body) });
    }
  }
  if (entries.length === 0) entries = findPapers(root).map((dir) => ({ dir }));

  const papers: PaperInfo[] = [];
  for (const { dir, folioTitle } of entries) {
    const manifest = join(folioRoot, dir, `${dir}.ts`);
    if (!existsSync(manifest)) continue;
    const manifestTitle = matchTitle(readFileSync(manifest, "utf-8"));
    papers.push({ dir, title: manifestTitle ?? folioTitle ?? dir });
  }
  return papers;
}

/**
 * A paper's chapters, in manifest order.
 *
 * `kind` is derived from the directory prefix, matching the convention the
 * builders already enforce: `appendix-*` is back matter, `index-*` is neither
 * numbered nor an appendix.
 */
export function chaptersOf(root: string, paper: string): ChapterInfo[] {
  const manifest = join(folioDir(root),  paper, `${paper}.ts`);
  if (!existsSync(manifest)) return [];
  const src = readFileSync(manifest, "utf-8");
  const dirs = [...src.matchAll(/chapterRef\(\s*\{\s*dir:\s*["']([^"']+)["']/g)].map((m) => m[1]);

  return dirs.map((dir) => {
    const chapterTs = join(folioDir(root),  paper, dir, `${dir}.ts`);
    let title = dir;
    if (existsSync(chapterTs)) title = matchTitle(readFileSync(chapterTs, "utf-8")) ?? dir;
    const kind = dir.startsWith("appendix-")
      ? ("appendix" as const)
      : dir.startsWith("index-")
        ? ("index" as const)
        : ("chapter" as const);
    return { dir, title, kind };
  });
}

// ── Rendering ───────────────────────────────────────────────────────────────

/** Escape the cell separator so a title containing `|` cannot break the table. */
function cell(text: string): string {
  return text.replace(/[\\|]/g, "\\$&");
}

function urlFor(path: string, cfg: ReadmeTocConfig, repoUrl: string | undefined): string | undefined {
  switch (cfg.linkStyle) {
    case "pages":
      return cfg.pagesBaseUrl ? `${cfg.pagesBaseUrl.replace(/\/$/, "")}/${path}` : undefined;
    case "raw": {
      const slug = repoUrl && ownerRepo(repoUrl);
      return slug ? `https://raw.githubusercontent.com/${slug}/${cfg.publishRef}/${path}` : undefined;
    }
    case "blob":
      return repoUrl ? `${repoUrl.replace(/\/$/, "")}/blob/${cfg.publishRef}/${path}` : undefined;
  }
}

function firstPublished(
  patterns: string[],
  vars: Record<string, string>,
  published: Set<string> | undefined,
): string | undefined {
  if (!published) return undefined;
  for (const pattern of patterns) {
    const path = pattern.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
    if (published.has(path)) return path;
  }
  return undefined;
}

export interface TocResult {
  markdown: string;
  /** Chapters whose PDF was not found in the publish ref. */
  missingPdfs: { paper: string; chapter: string }[];
  /** True when the publish ref could not be listed, so no PDF column is trustworthy. */
  publishRefUnavailable: boolean;
}

/**
 * Render the folio's contents: one `###` section and one table per paper.
 *
 * The caller owns the enclosing heading, so the same block can sit under
 * `## Contents` in one folio and `## Chapters` in another.
 */
export function renderToc(root: string, cfg: ReadmeTocConfig, fetch = false): TocResult {
  const repoUrl = cfg.repoUrl ?? detectRepoUrl(root);
  const published = publishedPaths(root, cfg.publishRef, fetch);
  const papers = discoverPapers(root);
  const missingPdfs: TocResult["missingPdfs"] = [];
  const out: string[] = [];

  for (const paper of papers) {
    const chapters = chaptersOf(root, paper.dir);
    out.push(`### ${paper.title}`, "");

    const paperPdf = firstPublished(cfg.paperPdfPathPatterns, { paper: paper.dir }, published);
    const paperPdfUrl = paperPdf && urlFor(paperPdf, cfg, repoUrl);
    const source = `[\`folio/${paper.dir}/\`](folio/${paper.dir}/)`;
    out.push(
      paperPdfUrl
        ? `${source} · [full PDF](${paperPdfUrl})`
        : source,
      "",
    );

    if (chapters.length === 0) {
      out.push("_No chapters in this paper's manifest yet._", "");
      continue;
    }

    out.push("| # | Chapter | Source | PDF |", "|---|---------|--------|-----|");
    let number = 0;
    for (const ch of chapters) {
      const label = ch.kind === "chapter" ? String(number++) : ch.kind === "appendix" ? "App" : "—";
      const pdfPath = firstPublished(
        cfg.pdfPathPatterns,
        { paper: paper.dir, chapter: ch.dir },
        published,
      );
      const pdfUrl = pdfPath && urlFor(pdfPath, cfg, repoUrl);
      // Only when we could actually read the publish ref: "not published" and
      // "we could not look" are different answers, and reporting the second as
      // the first is what a stale table looks like from the outside.
      if (!pdfPath && published) missingPdfs.push({ paper: paper.dir, chapter: ch.dir });
      const pdfCell = pdfUrl ? `[${ch.dir}.pdf](${pdfUrl})` : "—";
      out.push(
        `| ${label} | ${cell(ch.title)} | [\`${ch.dir}/\`](folio/${paper.dir}/${ch.dir}/) | ${pdfCell} |`,
      );
    }
    out.push("");
  }

  out.push(accessNote(cfg, published));
  return {
    markdown: out.join("\n").trimEnd() + "\n",
    missingPdfs,
    publishRefUnavailable: published === undefined,
  };
}

/**
 * One line saying what the PDF column points at and who can follow it.
 *
 * Present so a reader hitting a 404 learns *why* from the README rather than
 * from a support thread — the failure mode that started this: a private folio
 * whose README linked exclusively to a Pages site nobody could reach.
 */
function accessNote(cfg: ReadmeTocConfig, published: Set<string> | undefined): string {
  if (published === undefined) {
    return (
      `> **PDF links unavailable.** The publish ref \`${cfg.publishRef}\` could not be read in ` +
      `this checkout — regenerate with \`--fetch\` to make it available — so no PDF link could ` +
      `be verified. The **Source** column is unaffected.\n`
    );
  }
  switch (cfg.linkStyle) {
    case "blob":
      return (
        `> PDF links point at the published build on the \`${cfg.publishRef}\` branch through ` +
        `github.com, so they resolve for anyone with access to this repository — public or ` +
        `private — and GitHub renders them inline. A chapter with no published PDF shows \`—\`.\n`
      );
    case "pages":
      return (
        `> PDF links point at the GitHub Pages site, which resolves **only while Pages is ` +
        `public**. For a private folio set \`readme.linkStyle\` to \`blob\` in ` +
        `\`<name>.config.json\`. A chapter with no published PDF shows \`—\`.\n`
      );
    case "raw":
      return (
        `> PDF links point at \`raw.githubusercontent.com\`, which serves **public ` +
        `repositories only** — it returns 404 for a private repo unless the request carries a ` +
        `token, and a browser session does not supply one. For a private folio set ` +
        `\`readme.linkStyle\` to \`blob\` in \`<name>.config.json\`.\n`
      );
  }
}

// ── README injection ────────────────────────────────────────────────────────

export interface InjectResult {
  content: string;
  changed: boolean;
}

/**
 * Replace one marked region of a README with `body`.
 *
 * Marker-delimited rather than whole-file, so a folio keeps its own prose and
 * only the generated block is owned by the generator. This is the whole
 * safety property of the mechanism: the predecessor, `generate-readme.sh`,
 * ended in `cp "$OUT" README.md` and would replace any folio's README with
 * one particular folio's title, badges and tables.
 *
 * Absent markers are an error rather than an append or a no-op: both hide a
 * misconfiguration behind a clean exit.
 */
export function injectSection(readme: string, body: string, marker: string): InjectResult {
  const begin = `<!-- ${marker}:begin -->`;
  const end = `<!-- ${marker}:end -->`;
  const start = readme.indexOf(begin);
  const stop = readme.indexOf(end);
  if (start === -1 || stop === -1 || stop < start) {
    throw new Error(
      `README has no \`${begin}\` … \`${end}\` region. Add the two marker comments ` +
        `where the contents table should go, then re-run.`,
    );
  }
  const next =
    readme.slice(0, start + begin.length) + "\n\n" + body.trimEnd() + "\n\n" + readme.slice(stop);
  return { content: next, changed: next !== readme };
}

// The CLI and the MCP surface live in `readme-sections.ts`, which drives this
// renderer and the other generated sections through one registry. Two entry
// points writing the same README is how a "contents table" ends up disagreeing
// with a "sections" run.

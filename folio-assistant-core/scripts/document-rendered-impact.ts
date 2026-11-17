#!/usr/bin/env bun
/**
 * The DOCUMENT folio's answer to the rendered-impact contract
 * (`cat-harness/schemas/rendered-impact.ts`, bean `bnjs`, issue #971): from a
 * Change Set, the rendered files of the folio's site it alters.
 *
 * ## Loaded from the graph and the published assets, never from source
 *
 * Owner, 2026-10-06: *"use dynamic loading from the json(ld) KG and existing
 * assets"*. So nothing here imports a manifest, pattern-matches TypeScript or
 * walks the folio tree. It reads two JSON documents the staging build already
 * publishes beside the preview:
 *
 * | asset | written by | gives |
 * |---|---|---|
 * | `changeset.json` (`folio-changeset/v1`) | `changeset.ts`, the ChangeSet Tool | every changed block: its LABEL and its manifest FILE on each side |
 * | `outline.json` (`folio-outline/v1`) | `build-document-site.ts` | the documents, by slug, and their blocks' labels |
 *
 * A block's rendered cone is its own document's page, anchored at its label:
 * a document page assembles its blocks and no block renders inside another
 * document. The editorial `uses[]` relation is a link, not a rendering edge,
 * so it is not followed. The slug is the first segment of the block's file,
 * which is how `build-document-site` names the page.
 *
 * When no published `changeset.json` is given, the ChangeSet is computed by
 * the same Tool that publishes it (`computeChangeSet`), so the answer is the
 * one a reviewer would see, not a second derivation.
 *
 * ## The renderers of a document site
 *
 * | renderer | writes | reached by |
 * |---|---|---|
 * | `document-site` | `en/<slug>/index.html`, `en/<slug>/media/*`, `outline.json`, `index.html` | a changed block, a document/chapter/section manifest, a media file |
 * | `public-comment-site` | each document's dashboard, `en/folio-assistant-core/public-comments/<folio>/<slug>/index.html`, and the comment notes on each `en/<slug>/index.html` | the public-comment store |
 * | `library-site` | each library entry's Document view, `en/folio-assistant-core/<library>/<entry>/index.html`, its data `folio-assistant-core/<library>/<entry>/entries/<entry>.doc.json`, and the library's `en/…/index.html` | a file in a declared library entry, or a folio's `review-anchors.json` naming one (its [edit] links) |
 *
 * Pages are under the page locale and data is not (issue #2527); where each
 * goes is `document-site-route.ts`. A document's page is the one
 * `outline.json` names (`page`), so an outline from before the locale still
 * names the page it was published with.
 *
 * A large document's page is LAZY (bean v433), and `outline.json` says so
 * (`lazy`): `index.html` is then a shell of headings and placeholders, the
 * text is in `<slug>/blocks/NNN.json`, and the whole document is in
 * `en/<slug>/index.hydrated.html`. A block's text edit changes its chunk and the
 * hydrated page, not the shell; a block added, removed, renamed or moved
 * changes the shell and every chunk from its position on, since the chunks
 * after it shift. Comment notes on a lazy page are in `<slug>/pc-notes.json`.
 *
 * Every file is pinned (`hash`) to the blobs of the changed inputs that
 * reach it, at head, so a page verdict counts only for the version reviewed.
 *
 * ## What it cannot place, and says so
 *
 * A changed file that is neither a block the ChangeSet names, a media file,
 * a manifest under a known document, nor the comment store can change any
 * page: `undetermined`, `scope: all`, never "no change".
 *
 * ## …and what it can say reaches nothing
 *
 * Except a file the site's builders cannot read (bean `ehh6`). On the first
 * real run (smart-ra#26) the work-plan bean the branch carried was reported
 * "may change any page", and an undetermined input holds the coverage gate
 * shut, so every PR that touches a bean would wait on a false alarm.
 *
 * What a builder reads is the BUILDER's to say, not a list here and not the
 * layer's declaration: the second run showed why. smart-ra declared
 * `beans/` and `todos/`, so "declared" read as "read", yet the site renders
 * todos and never beans. So each builder exports `siteReads(repoRoot, args)`
 * (`build-document-site`: the folio; `public-comment-site`: the comment store
 * and the folio; `gen-node-kind-pages`: every directory of a typology holding
 * a kind it renders), and {@link siteReadsOf} asks every builder the folio's
 * build command runs. A file outside all of their directories, the
 * submodules (the platform builds every page), `.github/` and the root's
 * non-Markdown files (declaration, config, lockfiles) is an input that
 * reaches no page ({@link siteMayRead}).
 *
 * Any doubt carries: a step in the command that is not a builder exporting
 * `siteReads` excludes nothing, and with no command the layer's declared
 * directories stand in. The claim is checked, not trusted: the staging
 * build's diff counts any page it changed that the list did not name.
 *
 * Usage:
 *   bun run folio-assistant-core/scripts/document-rendered-impact.ts --root <folio repo>
 *     (--changed a,b | --base <ref> [--head <ref>]) [--changeset changeset.json]
 *     [--outline outline.json] [--site <prefix>] [--build-command "<the folio's build command>"]
 *     [--out impact.json]
 *
 * @module folio-assistant-core/scripts/document-rendered-impact
 */
import { HANDLER, KIND } from "./public-comment-route.js";
import { documentDataDir, documentPage, localisedPage } from "./document-site-route.js";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  pinImpact,
  RENDERED_IMPACT_TAG,
  RenderedImpactSchema,
  type RenderedFile,
  type RenderedImpact,
} from "@litlfred/cat-harness-tools/schemas/ui/rendered-impact.js";
import { STRUCTURE_FILENAME } from "@litlfred/cat-harness-tools/schemas/content/document-structure.js";
import { declarationPathIn } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";
import { gitBlobs } from "@litlfred/cat-harness-tools/scripts/git-blobs.js";
import { ChangeSetSchema, computeChangeSet, type ChangeSet } from "../schemas/changeset.js";

export const DOCUMENT_RENDERER = "document-site";
export const PUBLIC_COMMENT_RENDERER = "public-comment-site";
export const LIBRARY_RENDERER = "library-site";

/** Where the public-comment store lives, relative to the repository root. */
const COMMENT_STORE = /^review\/public-comment\//;

/** The part of `outline.json` this reads: the documents, by slug, and each one's page. */
export interface OutlineLike {
  documents: Array<{ slug: string; page?: string; lazy?: { hydrated: string; chunks: number; of: Record<string, number> } }>;
}

/** A lazy page's chunk file, as `build-document-site` names it: data, so not under the locale. */
const chunkFile = (slug: string, n: number) => `${documentDataDir(slug)}/blocks/${String(n).padStart(3, "0")}.json`;

interface Acc {
  files: Map<string, RenderedFile>;
  undetermined: RenderedImpact["undetermined"];
}

function add(acc: Acc, f: RenderedFile): void {
  const had = acc.files.get(f.path);
  if (!had) {
    acc.files.set(f.path, { ...f, ...(f.anchors ? { anchors: [...f.anchors] } : {}) });
    return;
  }
  if (f.anchors?.length) {
    had.anchors = had.anchors ?? [];
    for (const a of f.anchors) if (!had.anchors.includes(a)) had.anchors.push(a);
  }
  if (had.via.length === 0) had.via = f.via;
}

function finish(renderer: string, inputs: string[], acc: Acc, opts: { base?: string; head?: string; site?: string }): RenderedImpact {
  const files = [...acc.files.values()]
    .map((f) => (f.anchors?.length ? { ...f, anchors: [...f.anchors].sort() } : { path: f.path, change: f.change, role: f.role, via: f.via }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return RenderedImpactSchema.parse({
    $schema: RENDERED_IMPACT_TAG,
    renderer,
    method: "cone",
    ...(opts.site ? { site: opts.site } : {}),
    ...(opts.base ? { base: opts.base } : {}),
    ...(opts.head ? { head: opts.head } : {}),
    inputs: [...inputs].sort(),
    files,
    undetermined: acc.undetermined,
  });
}

/** What the document site's builders can read. */
export interface SiteReads {
  /** Directories the builders read (their `siteReads`), or the layer's declared ones; repo-relative. */
  reads: string[];
  /** Submodule paths (`.gitmodules`): the platform, whose code builds every page. */
  submodules: string[];
}

const under = (f: string, dir: string) => {
  const d = dir.replace(/\/+$/, "");
  return d === "" || d === "." || f === d || f.startsWith(`${d}/`);
};

/**
 * Whether a document site's builders can read `f`: under a directory they
 * read, a submodule, or `.github/`, or a root file that is not Markdown (the
 * declaration, config, lockfiles). `undefined` reads means every file may be.
 */
export function siteMayRead(f: string, reads: SiteReads | undefined): boolean {
  if (!reads) return true;
  if (reads.reads.some((d) => under(f, d)) || reads.submodules.some((d) => under(f, d))) return true;
  if (under(f, ".github")) return true;
  return !f.includes("/") && !/\.md$/i.test(f);
}

export interface DocImpactOptions {
  /** Changed files, relative to the repository root. */
  changed: string[];
  /** The ChangeSet between the same two refs (published `changeset.json`, or computed). */
  changeset: ChangeSet;
  /** The published `outline.json`; when absent, documents are read off the ChangeSet. */
  outline?: OutlineLike;
  base?: string;
  head?: string;
  /** Where the site's pages sit in the built output ("" for its root). */
  site?: string;
  /** What the site's builders can read; absent, every file may be read. */
  reads?: SiteReads;
  /**
   * The declared library directories, repository-relative (`library`), and
   * for each changed `review-anchors.json` the library entry it names, as
   * `<library dir>/<entry>`. Absent: no library pages are placed.
   */
  library?: { dirs: string[]; anchors?: Record<string, string> };
}

/** The first path segment under the folio root: the document's slug. */
const slugOf = (fileInFolio: string) => fileInFolio.split("/")[0];

/**
 * Both renderers' impacts, from the ChangeSet and the outline. The document
 * renderer owns the site, so an input neither renderer maps is reported
 * undetermined by it.
 */
export function documentRenderedImpact(opts: DocImpactOptions): RenderedImpact[] {
  const pre = opts.site ? `${opts.site.replace(/\/+$/, "")}/` : "";
  const folio = opts.changeset.folio.replace(/\/+$/, "");
  const inFolio = (f: string) => (folio === "." || folio === "" ? f : f.startsWith(`${folio}/`) ? f.slice(folio.length + 1) : undefined);
  const slugs = new Set(opts.outline?.documents.map((d) => d.slug) ?? []);
  // Every block file the ChangeSet names, either side, to the change it is part of.
  const byFile = new Map<string, { label: string; slug: string }>();
  for (const c of opts.changeset.changes) {
    for (const at of [c.change === "added" ? undefined : c.base, c.change === "removed" ? undefined : c.head]) {
      if (!at) continue;
      const slug = slugOf(at.file);
      if (!opts.outline) slugs.add(slug);
      byFile.set(at.file, { label: c.label, slug });
    }
  }

  const lazy = new Map((opts.outline?.documents ?? []).flatMap((d) => (d.lazy ? [[d.slug, d.lazy] as const] : [])));
  // The page the outline names, else where build-document-site puts it now.
  const pages = new Map((opts.outline?.documents ?? []).flatMap((d) => (d.page ? [[d.slug, d.page] as const] : [])));
  const pageOf = (slug: string) => pages.get(slug) ?? documentPage(slug);
  const pageDirOf = (slug: string) => pageOf(slug).replace(/\/[^/]*$/, "");
  /** Where a block's text renders on its document's site: the page, or a lazy page's chunk and hydrated page. */
  const blockFiles = (acc: Acc, slug: string, label: string, via: string[]) => {
    const lz = lazy.get(slug);
    if (!lz) return add(acc, { path: `${pre}${pageOf(slug)}`, change: "changed", role: "content", via, anchors: [label] });
    add(acc, { path: `${pre}${lz.hydrated}`, change: "changed", role: "content", via, anchors: [label] });
    const n = lz.of[label];
    if (n !== undefined) add(acc, { path: `${pre}${chunkFile(slug, n)}`, change: "changed", role: "data", via });
  };
  /** Every chunk of a lazy document from `from` on: what a structural change shifts. */
  const chunksFrom = (acc: Acc, slug: string, from: number, via: string[]) => {
    const lz = lazy.get(slug);
    if (!lz) return;
    for (let n = Math.max(0, from); n < lz.chunks; n++) add(acc, { path: `${pre}${chunkFile(slug, n)}`, change: "changed", role: "data", via });
  };

  const doc: Acc = { files: new Map(), undetermined: [] };
  const pc: Acc = { files: new Map(), undetermined: [] };
  const lib: Acc = { files: new Map(), undetermined: [] };
  const docInputs: string[] = [];
  const pcInputs: string[] = [];
  const libInputs: string[] = [];
  /** An entry's Document view (build-library-site.ts): its data, and with `page` its page and the library's index. */
  const libraryFiles = (dir: string, entry: string, via: string[], page: boolean) => {
    const route = `${HANDLER}/${dir.split("/").pop()}`;
    add(lib, { path: `${pre}${route}/${entry}/entries/${entry}.doc.json`, change: "changed", role: "data", via });
    if (!page) return;
    add(lib, { path: `${pre}${localisedPage(route)}/${entry}/index.html`, change: "changed", role: "content", via });
    add(lib, { path: `${pre}${localisedPage(route)}/index.html`, change: "changed", role: "index", via });
  };

  for (const f of opts.changed) {
    // A library entry's own file. Its structure carries the title, the
    // sections the page declares to the rail and the counts the index lists;
    // anything else in the entry reaches only its data.
    const libDir = opts.library?.dirs.find((d) => f.startsWith(`${d}/`));
    if (libDir) {
      const [entry, ...rest] = f.slice(libDir.length + 1).split("/");
      if (entry && rest.length) {
        libInputs.push(f);
        libraryFiles(libDir, entry, [f], rest.join("/") === STRUCTURE_FILENAME);
        continue;
      }
    }
    // A folio's review anchors say where a library entry was materialised:
    // they are the entry's [edit] links, and the document's title is its title.
    const named = opts.library?.anchors?.[f];
    if (named) {
      const cut = named.lastIndexOf("/");
      libInputs.push(f);
      libraryFiles(named.slice(0, cut), named.slice(cut + 1), [f], true);
      continue;
    }
    if (COMMENT_STORE.test(f)) {
      pcInputs.push(f);
      // A comment's note sits beside its block on its document's page; which
      // document a comment targets is in the comment, not the path, so every
      // document page is listed: safe, and with one document, exact.
      for (const slug of [...slugs].sort()) {
        // The document's dashboard, at the handler route (public-comment-route.ts).
        add(pc, { path: `${pre}${localisedPage(`${HANDLER}/${KIND}/${folio || "folio"}/${slug}`)}/index.html`, change: "changed", role: "content", via: [f] });
        add(pc, { path: `${pre}${pageOf(slug)}`, change: "changed", role: "content", via: [f] });
        const lz = lazy.get(slug);
        if (lz) {
          add(pc, { path: `${pre}${lz.hydrated}`, change: "changed", role: "content", via: [f] });
          add(pc, { path: `${pre}${documentDataDir(slug)}/pc-notes.json`, change: "changed", role: "data", via: [f] });
        }
      }
      continue;
    }
    docInputs.push(f);
    const rel = inFolio(f);
    // A block's `.md` is named in the ChangeSet by its manifest, `<stem>.ts`.
    const block = rel ? byFile.get(rel) ?? byFile.get(rel.replace(/\.md$/, ".ts")) : undefined;
    if (block) {
      blockFiles(doc, block.slug, block.label, [f, block.label]);
      continue;
    }
    const slug = rel ? slugOf(rel) : undefined;
    if (rel && slug && slugs.has(slug)) {
      const page = `${pre}${pageOf(slug)}`;
      const sub = rel.slice(slug.length + 1);
      if (sub.startsWith("media/")) {
        // Copied beside the page, which links it relative to itself.
        add(doc, { path: `${pre}${pageDirOf(slug)}/${sub}`, change: "changed", role: "data", via: [f] });
        add(doc, { path: page, change: "changed", role: "content", via: [f] });
        // Which block shows the figure is in the block, not the path: every chunk.
        const lz = lazy.get(slug);
        if (lz) add(doc, { path: `${pre}${lz.hydrated}`, change: "changed", role: "content", via: [f] });
        chunksFrom(doc, slug, 0, [f]);
        continue;
      }
      if (sub.endsWith(".ts")) {
        // Not a block the ChangeSet names: a document, chapter or section
        // manifest. Titles and order live there, so the outline and the
        // document list move with the page.
        add(doc, { path: page, change: "changed", role: "content", via: [f] });
        const lz = lazy.get(slug);
        if (lz) add(doc, { path: `${pre}${lz.hydrated}`, change: "changed", role: "content", via: [f] });
        add(doc, { path: `${pre}outline.json`, change: "changed", role: "index", via: [f] });
        if (sub === `${slug}.ts`) add(doc, { path: `${pre}index.html`, change: "changed", role: "index", via: [f] });
        continue;
      }
    }
    // Read by no builder of the site: an input, and no page (see the module doc).
    if (!siteMayRead(f, opts.reads)) continue;
    doc.undetermined.push({ input: f, reason: "not a block the ChangeSet names, a media file, a manifest of a known document, or the comment store: may change any page", scope: "all" });
  }

  // A block added, removed, renamed or moved on a lazy page reshapes the shell
  // and shifts every chunk from its position on, whichever file carried it.
  // Only for the inputs given: the block's own file, or a manifest of its document.
  for (const c of opts.changeset.changes) {
    const structural = c.change !== "changed" || c.aspects.some((a) => a === "renamed" || a === "moved");
    const at = c.change === "removed" ? c.base : c.head;
    const slug = slugOf(at.file);
    const lz = lazy.get(slug);
    if (!structural || !lz) continue;
    const input = opts.changed.find((f) => {
      const r = inFolio(f);
      return !!r && (r === at.file || r === at.file.replace(/\.ts$/, ".md") || (slugOf(r) === slug && r.endsWith(".ts") && !byFile.has(r)));
    });
    if (!input) continue;
    const via = [input, c.label];
    add(doc, { path: `${pre}${pageOf(slug)}`, change: "changed", role: "content", via });
    add(doc, { path: `${pre}${lz.hydrated}`, change: "changed", role: "content", via, ...(c.change === "removed" ? {} : { anchors: [c.label] }) });
    chunksFrom(doc, slug, c.change === "removed" ? 0 : lz.of[c.label] ?? 0, via);
  }

  const out = [finish(DOCUMENT_RENDERER, docInputs, doc, opts)];
  if (pcInputs.length) out.push(finish(PUBLIC_COMMENT_RENDERER, pcInputs, pc, opts));
  if (libInputs.length) out.push(finish(LIBRARY_RENDERER, libInputs, lib, opts));
  return out;
}

const readJson = (p: string) => JSON.parse(readFileSync(p, "utf-8"));

/** One step of a build command: the script it runs and the arguments after it; `undefined` when it runs no `.ts`. */
export function buildSteps(command: string): Array<{ script: string; args: string[] } | undefined> {
  return command
    .split(/&&|\|\||;|\|/)
    .map((seg) => seg.trim().split(/\s+/).filter(Boolean))
    .filter((t) => t.length)
    .map((t) => {
      const i = t.findIndex((x) => x.endsWith(".ts"));
      return i < 0 ? undefined : { script: t[i]!, args: t.slice(i + 1) };
    });
}

/** The layer's declared directories and its submodules, or `undefined` when either cannot be read. */
function declaredReads(root: string): SiteReads | undefined {
  const decl = declarationPathIn(root);
  if (!decl) return undefined;
  let reads: string[];
  try {
    const dirs = (readJson(decl) as { directories?: Array<{ path?: unknown }> }).directories;
    if (!Array.isArray(dirs)) return undefined;
    reads = dirs.map((d) => d.path).filter((p): p is string => typeof p === "string");
  } catch {
    return undefined;
  }
  let submodules: string[] = [];
  if (existsSync(join(root, ".gitmodules"))) {
    try {
      submodules = execFileSync("git", ["-C", root, "config", "-f", ".gitmodules", "--get-regexp", "^submodule\\..*\\.path$"], { encoding: "utf-8" })
        .split("\n").map((l) => l.split(" ").slice(1).join(" ")).filter(Boolean);
    } catch {
      // A .gitmodules git cannot read: every submodule is unknown, so nothing is excluded.
      return undefined;
    }
  }
  return { reads, submodules };
}

/**
 * The repository's {@link SiteReads}: with a build command, what its builders
 * say they read; without one, the declared directories. `undefined` (nothing
 * excluded) when there is no declaration, or a step is not a builder that
 * exports `siteReads`.
 */
export async function siteReadsOf(root: string, buildCommand?: string): Promise<SiteReads | undefined> {
  const base = declaredReads(root);
  if (!base || buildCommand === undefined) return base;
  const reads = new Set<string>();
  for (const step of buildSteps(buildCommand)) {
    if (!step) return undefined;
    const path = resolve(root, step.script);
    if (!existsSync(path)) return undefined;
    const fn = ((await import(path)) as { siteReads?: (r: string, a: string[]) => string[] | Promise<string[]> }).siteReads;
    if (typeof fn !== "function") return undefined;
    for (const d of await fn(root, step.args)) reads.add(d);
  }
  return { reads: [...reads].sort(), submodules: base.submodules };
}

/**
 * The repository's declared library directories, and the entry each changed
 * `review-anchors.json` names (`folio-review-anchors/v1`, its `library`).
 * `undefined` when no library is declared.
 */
export function libraryOf(root: string, changed: string[]): DocImpactOptions["library"] {
  const decl = declarationPathIn(root);
  if (!decl) return undefined;
  let dirs: string[];
  try {
    const all = (readJson(decl) as { directories?: Array<{ path?: unknown; graphTypologies?: unknown }> }).directories ?? [];
    dirs = all
      .filter((d) => Array.isArray(d.graphTypologies) && d.graphTypologies.includes("library") && typeof d.path === "string")
      .map((d) => (d.path as string).replace(/^\.\//, "").replace(/\/+$/, ""));
  } catch {
    return undefined;
  }
  if (!dirs.length) return undefined;
  const anchors: Record<string, string> = {};
  for (const f of changed) {
    if (!f.endsWith("/review-anchors.json") || !existsSync(join(root, f))) continue;
    try {
      const a = readJson(join(root, f)) as { $schema?: string; library?: string };
      const dir = a.$schema === "folio-review-anchors/v1" && a.library ? dirs.find((d) => existsSync(join(root, d, a.library!))) : undefined;
      if (dir) anchors[f] = `${dir}/${a.library}`;
    } catch {
      // Unreadable: not placed here, so it stays undetermined below.
    }
  }
  return { dirs, anchors };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (k: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const root = resolve(arg("--root") ?? ".");
  const base = arg("--base");
  const head = arg("--head") ?? (base ? "HEAD" : undefined);
  const changed = arg("--changed")?.split(",").filter(Boolean)
    ?? (base ? execFileSync("git", ["-C", root, "diff", "--name-only", `${base}...${head}`], { encoding: "utf-8" }).split("\n").filter(Boolean) : undefined);
  if (!changed) {
    console.error("usage: document-rendered-impact.ts --root <folio repo> (--changed a,b | --base <ref> [--head <ref>]) [--changeset f] [--outline f] [--site p] [--out f]");
    process.exit(2);
  }
  const csPath = arg("--changeset");
  const changeset = csPath
    ? ChangeSetSchema.parse(readJson(csPath))
    : computeChangeSet({ repoRoot: root, folio: arg("--folio") ?? "folio", base: base ?? "origin/main", head: head ?? "HEAD" });
  const olPath = arg("--outline");
  const outline = olPath && existsSync(olPath) ? (readJson(olPath) as OutlineLike) : undefined;
  // Pinned to the inputs' blobs at head, so a page verdict is about this version (see rendered-impact.ts, "A PIN").
  let impacts = documentRenderedImpact({ changed, changeset, outline, base, head, site: arg("--site"), reads: await siteReadsOf(root, arg("--build-command")), library: libraryOf(root, changed) });
  try {
    const blobs = gitBlobs(root, head ?? "HEAD", changed);
    impacts = impacts.map((i) => pinImpact(i, (p) => blobs.get(p)));
  } catch (e) {
    console.error(`not pinned: ${(e as Error).message.split("\n")[0]}`);
  }
  const json = JSON.stringify(impacts, null, 2) + "\n";
  const out = arg("--out");
  if (out) writeFileSync(out, json);
  else process.stdout.write(json);
}

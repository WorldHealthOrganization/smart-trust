#!/usr/bin/env bun
/**
 * The DOCS SITE's answer to the rendered-impact contract
 * (`cat-harness/schemas/ui/rendered-impact.ts`): from the files a change
 * touched, the pages of the just-the-docs site it alters.
 *
 * ## How the site is made, and so how a file reaches a page
 *
 * The Jekyll source is COMPOSED (`compose-docs.ts`): the declared `docs`
 * layers (`docsLayers`, base first, overlay last) at its root, and every
 * layer directory declared `composed` under its layer's name
 * (`composedInstances`). Jekyll renders that tree. So:
 *
 * | changed file | rendered |
 * |---|---|
 * | a page in the composed tree (`.md`, `.markdown`, `.html` with front matter) | its `permalink`, or the same path with `.html` |
 * | any other file in it (CSS, JS, images, JSON, a static `.html`) | the same path, as data |
 * | `_includes/<x>` | every page that includes it, through other includes; ANY page when a layout does, when the THEME may (see below), or when nothing in the tree does |
 * | `_data/<name>.*` | every page whose Liquid reads `site.data.<name>`, and every page an include that reads it reaches |
 * | `_layouts/`, `_sass/`, `_config.yml`, another `_` directory | any page: `undetermined`, `scope: all` |
 * | `payload/` (excluded from Jekyll, copied verbatim after the build) | the same path, as data |
 * | a file outside the composed tree | through the branches/ CONE (`staging-cone.ts`) |
 *
 * ## An include the theme may call is reached by every page
 *
 * just-the-docs includes `head_custom.html`, `title.html` and others from its
 * own layouts, so no file in OUR tree names them. An include is therefore
 * site-wide when its name is one the theme defines (read from the installed
 * theme gem), when the theme cannot be read (then EVERY include is), or when
 * nothing in the tree includes it.
 *
 * ## Outside the composed tree: the staging cone is the authority
 *
 * A script, a skill, a schema reaches the site only through a writer, whose
 * output is either committed (and mapped above) or built (`derive:publish`,
 * the KG viewer, the layer mounts) and so cannot be mapped file by file
 * before the build. A file the cone carries somewhere is `undetermined`
 * (`scope: unknown`) with the directories named, never a guess at pages; a
 * file it reaches nowhere renders no page. The staging build's measurement
 * against main's site (`measure-rendered-impact`) then says which pages
 * actually moved.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/docs-rendered-impact.ts (--changed a,b | --changed-from <file> | --base <ref> [--head <ref>])
 *     [--site <prefix>] [--out impact.json]
 *
 * @module cat-harness/scripts/docs-rendered-impact
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  pinImpact,
  RENDERED_IMPACT_TAG,
  RenderedImpactSchema,
  type RenderedFile,
  type RenderedImpact,
} from "../schemas/ui/rendered-impact.ts";
import { judge, readTree, renderingOrder } from "./check-derived-from.ts";
import { composedInstances, docsLayers } from "./compose-docs.ts";
import { gitBlobs } from "./git-blobs.ts";
import { cone, type Closure, type ConeDecision, type ConeDir, importClosure } from "./staging-cone.ts";

export const DOCS_RENDERER = "docs-site";

/** Where a repo-relative source directory lands in the composed Jekyll tree. */
export interface Mount {
  /** Repo-relative, ending in `/`. */
  from: string;
  /** Composed-tree prefix: `""` for a docs layer, `<instance>/` for a composed layer. */
  to: string;
}

/** The composed tree's mounts, from the declarations `compose-docs` reads. */
export function docsMounts(repo: string): Mount[] {
  const rel = (abs: string) => `${relative(repo, abs).split("\\").join("/")}/`;
  return [
    ...docsLayers(repo).layers.map((l) => ({ from: rel(l.dir), to: "" })),
    ...composedInstances(repo).map((c) => ({ from: rel(c.dir), to: `${c.under}/` })),
  ];
}

/** A changed file's path in the composed tree, or undefined when it is not in it. */
export function composedPath(file: string, mounts: readonly Mount[]): string | undefined {
  // Longest mount first: a composed layer can sit inside nothing else, but a layer could be nested.
  const m = [...mounts].sort((a, b) => b.from.length - a.from.length).find((x) => file.startsWith(x.from));
  return m ? m.to + file.slice(m.from.length) : undefined;
}

/** The YAML front matter's `permalink`, or undefined; `null` when the file has no front matter at all. */
export function frontMatter(text: string | undefined): { permalink?: string } | null {
  if (text === undefined) return {};
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  const p = m[1]!.match(/^permalink:\s*["']?([^"'\n]+?)["']?\s*$/m);
  return p ? { permalink: p[1]! } : {};
}

/** The rendered path of a page at `rel` in the composed tree (no leading slash). */
export function pagePath(rel: string, permalink?: string): string {
  if (permalink) {
    const p = permalink.replace(/^\//, "");
    return p === "" || p.endsWith("/") ? `${p}index.html` : /\.[a-z0-9]+$/i.test(p) ? p : `${p}/index.html`;
  }
  return rel.replace(/\.(md|markdown)$/i, ".html");
}

/** Change the frame every page is drawn in. */
const SITE_WIDE = /^(_layouts|_sass)\/|^_config\.yml$/;
/**
 * The theme's search index: every page's text, so any page change moves it.
 * just-the-docs writes it here; a build diff marks it `index` by the same path
 * (`isGenericIndex`).
 */
export const SEARCH_INDEX = "assets/js/search-data.json";

/** Excluded from Jekyll and copied verbatim after the build (`feature-staging.yml`, bean `f233`). */
const POST_BUILD_COPIED = /^payload\//;

/** What the composed tree says about who uses what: read once, only when a template or data file changed. */
export interface SiteIndex {
  /** Composed path -> its rendered page, for every page in the tree. */
  pages: Map<string, string>;
  /** Include name (relative to `_includes/`) -> composed paths that include it. */
  includers: Map<string, string[]>;
  /** `site.data` path read -> composed paths that read it. */
  dataReaders: Map<string, string[]>;
  /** Composed asset path hashed by `| fa_asset_version` -> composed paths that hash it. */
  assetReaders?: Map<string, string[]>;
  /** Include names the theme defines; undefined when the theme cannot be read, which makes every include site-wide. */
  themeIncludes?: Set<string>;
}

const DATA_REF = /site\.data\.([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*)/g;
const INCLUDE = /\{%-?\s*include\s+([^\s%{}]+)/g;
const ASSET_VERSION = /['"]\/?([^'"\s|]+)['"]\s*\|\s*fa_asset_version\b/g;

/** Index composed sources (composed path, text). */
export function indexSite(files: Iterable<[string, string]>, themeIncludes?: Set<string>): SiteIndex {
  const assetReaders = new Map<string, string[]>();
  const ix: SiteIndex = { pages: new Map(), includers: new Map(), dataReaders: new Map(), assetReaders, ...(themeIncludes ? { themeIncludes } : {}) };
  const push = (m: Map<string, string[]>, k: string, v: string) => {
    const l = m.get(k) ?? [];
    if (!l.includes(v)) l.push(v);
    m.set(k, l);
  };
  for (const [rel, text] of files) {
    if (!rel.startsWith("_")) {
      const fm = frontMatter(text);
      if (/\.(md|markdown)$/i.test(rel) || fm !== null) ix.pages.set(rel, pagePath(rel, fm?.permalink));
    }
    for (const m of text.matchAll(INCLUDE)) push(ix.includers, m[1]!, rel);
    for (const m of text.matchAll(DATA_REF)) push(ix.dataReaders, m[1]!, rel);
    for (const m of text.matchAll(ASSET_VERSION)) push(assetReaders, m[1]!, rel);
  }
  return ix;
}

/**
 * The pages a set of composed files reaches through includes: `"all"` when a
 * layout is on the way, when an include may be the theme's, or when an
 * include is called from nowhere in the tree.
 */
export function reachedPages(from: readonly string[], ix: SiteIndex): string[] | "all" {
  const pages = new Set<string>();
  const seen = new Set<string>();
  const queue = [...from];
  while (queue.length) {
    const rel = queue.shift()!;
    if (seen.has(rel)) continue;
    seen.add(rel);
    if (/^_layouts\//.test(rel)) return "all";
    if (rel.startsWith("_includes/")) {
      const name = rel.slice("_includes/".length);
      if (!ix.themeIncludes || ix.themeIncludes.has(name)) return "all";
      const by = ix.includers.get(name) ?? [];
      if (!by.length) return "all";
      queue.push(...by);
      continue;
    }
    const page = ix.pages.get(rel);
    if (page) pages.add(page);
  }
  return [...pages].sort();
}

/** `_data/a/b.yml` → `a.b`; a read of `site.data.a.b.c` is a read of it. */
const dataName = (rel: string) => rel.replace(/^_data\//, "").replace(/\.[^./]+$/, "").split("/").join(".");
const reads = (ref: string, name: string) => ref === name || ref.startsWith(`${name}.`);

export interface DocsImpactOptions {
  /** Changed files, repo-relative. */
  changed: string[];
  mounts: readonly Mount[];
  /** A changed file's text at head, repo-relative; undefined when it was removed. */
  read: (file: string) => string | undefined;
  /** The composed tree's index; computed only if an include or data file changed. */
  index: () => SiteIndex;
  /** The cone's carried directories for one changed file outside the composed tree. */
  coneOf: (file: string) => ConeDecision[];
  base?: string;
  head?: string;
  /** Where the site's pages sit in the built output ("" for its root). */
  site?: string;
}

export function docsRenderedImpact(o: DocsImpactOptions): RenderedImpact {
  const pre = o.site ? `${o.site.replace(/\/+$/, "")}/` : "";
  const files = new Map<string, RenderedFile>();
  const undetermined: RenderedImpact["undetermined"] = [];
  const add = (f: RenderedFile) => {
    if (!files.has(f.path)) files.set(f.path, f);
  };
  for (const f of o.changed) {
    const rel = composedPath(f, o.mounts);
    if (rel === undefined) {
      const carried = o.coneOf(f).filter((d) => d.carry);
      if (carried.length) {
        undetermined.push({
          input: f,
          reason: `the staging cone carries ${carried.map((d) => d.node).join(", ")} (${carried[0]!.why}); the pages rendered from them are not mapped file by file`,
          scope: "unknown",
        });
      }
      continue;
    }
    const text = o.read(f);
    const change = text === undefined ? "removed" : "changed";
    if (rel.startsWith("_includes/") || rel.startsWith("_data/")) {
      const ix = o.index();
      const label = rel.startsWith("_data/") ? `site.data.${dataName(rel)}` : rel;
      const from = rel.startsWith("_data/") ? [...ix.dataReaders].filter(([r]) => reads(r, dataName(rel))).flatMap(([, by]) => by) : [rel];
      const reach = reachedPages(from, ix);
      if (reach === "all") {
        undetermined.push({ input: f, reason: `${label} reaches a layout, a theme include, or an include nothing in the tree calls: can change any page`, scope: "all" });
      } else {
        for (const p of reach) add({ path: `${pre}${p}`, change: "changed", role: /\.html$/i.test(p) ? "content" : "data", via: [f, label] });
      }
      continue;
    }
    if (SITE_WIDE.test(rel) || /^_[^/]+\//.test(rel)) {
      undetermined.push({ input: f, reason: "a layout, style, site configuration or collection: can change any page", scope: "all" });
      continue;
    }
    if (POST_BUILD_COPIED.test(rel)) {
      add({ path: `${pre}${rel}`, change, role: "data", via: [f] });
      continue;
    }
    const fm = text !== undefined ? frontMatter(text) : /\.(md|markdown|html)$/i.test(rel) ? {} : null;
    const isPage = /\.(md|markdown)$/i.test(rel) || fm !== null;
    if (isPage) {
      const p = pagePath(rel, fm?.permalink);
      add({ path: `${pre}${p}`, change, role: /\.html$/i.test(p) ? "content" : "data", via: [f] });
    } else {
      add({ path: `${pre}${rel}`, change, role: /\.html$/i.test(rel) ? "content" : "data", via: [f] });
      const ix = o.index();
      const by = ix.assetReaders?.get(rel) ?? [];
      if (by.length) {
        const reach = reachedPages(by, ix);
        if (reach === "all") {
          undetermined.push({ input: f, reason: `${rel} is hashed by fa_asset_version in a layout, a theme include, or an include nothing in the tree calls: can change any page`, scope: "all" });
        } else {
          for (const p of reach) add({ path: `${pre}${p}`, change: "changed", role: /\.html$/i.test(p) ? "content" : "data", via: [f, `fa_asset_version:${rel}`] });
        }
      }
    }
  }
  if ([...files.values()].some((f) => f.role === "content")) add({ path: `${pre}${SEARCH_INDEX}`, change: "changed", role: "index", via: [] });
  return RenderedImpactSchema.parse({
    $schema: RENDERED_IMPACT_TAG,
    renderer: DOCS_RENDERER,
    method: "cone",
    ...(o.site ? { site: o.site } : {}),
    ...(o.base ? { base: o.base } : {}),
    ...(o.head ? { head: o.head } : {}),
    inputs: [...o.changed].sort(),
    files: [...files.values()].sort((a, b) => a.path.localeCompare(b.path)),
    undetermined,
  });
}

/** Every text file under the composed tree's mounts, as composed-tree paths. */
function* composedSources(repo: string, mounts: readonly Mount[]): Generator<[string, string]> {
  const TEXT = /\.(md|markdown|html|liquid|scss|yml|yaml|json|js)$/i;
  for (const m of mounts) {
    const root = join(repo, m.from);
    if (!existsSync(root)) continue;
    const stack = [root];
    while (stack.length) {
      const dir = stack.pop()!;
      for (const name of readdirSync(dir)) {
        if (name === "node_modules" || name === ".git") continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) stack.push(p);
        else if (TEXT.test(name)) yield [m.to + relative(root, p).split("\\").join("/"), readFileSync(p, "utf-8")];
      }
    }
  }
}

/**
 * The include names the installed just-the-docs theme defines, from the gem
 * on this machine. Undefined when it cannot be found, which makes every
 * include site-wide: the safe answer, never "no page".
 */
export function themeIncludes(): Set<string> | undefined {
  try {
    const dir = execFileSync("gem", ["contents", "just-the-docs"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .find((l) => l.includes("/_includes/"));
    if (!dir) return undefined;
    const root = dir.slice(0, dir.indexOf("/_includes/") + "/_includes/".length);
    const out = new Set<string>();
    const stack = [root];
    while (stack.length) {
      const d = stack.pop()!;
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) stack.push(p);
        else out.add(relative(root, p).split("\\").join("/"));
      }
    }
    return out;
  } catch {
    return undefined;
  }
}

/** The cone, one changed file at a time, over this checkout's declarations, with one closure memo. */
export function coneByFile(repo: string): (file: string) => ConeDecision[] {
  const tree = readTree(repo);
  const { edges } = judge(tree, (p) => existsSync(join(repo, p)));
  const dirs: ConeDir[] = tree.flatMap((i) =>
    i.dirs.map((d) => ({ node: `${i.name}/${d.id}`, path: d.path ?? "", ...(d.writer ? { writer: d.writer } : {}) })),
  );
  const order = renderingOrder(tree, edges);
  const memo = new Map<string, Closure>();
  const closureOf = (w: string) => {
    if (!memo.has(w)) memo.set(w, importClosure(w, repo));
    return memo.get(w)!;
  };
  return (file) => cone([file], dirs, order, edges, closureOf);
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (k: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const repo = resolve(arg("--root") ?? ".");
  const base = arg("--base");
  const head = arg("--head") ?? (base ? "HEAD" : undefined);
  // `--changed-from <file>`, one path per line: a re-pinned mount expands to
  // thousands of paths, past what one argument may hold (E2BIG).
  const from = arg("--changed-from");
  const changed = (from ? readFileSync(from, "utf-8").split("\n").map((l) => l.trim()).filter(Boolean) : undefined)
    ?? arg("--changed")?.split(",").filter(Boolean)
    ?? (base ? execFileSync("git", ["-C", repo, "diff", "--name-only", `${base}...${head}`], { encoding: "utf-8" }).split("\n").filter(Boolean) : undefined);
  if (!changed) {
    console.error("usage: docs-rendered-impact.ts (--changed a,b | --changed-from <file> | --base <ref> [--head <ref>]) [--root <repo>] [--site <prefix>] [--out file]");
    process.exit(2);
  }
  const mounts = docsMounts(repo);
  let index: SiteIndex | undefined;
  let impact = docsRenderedImpact({
    changed,
    mounts,
    read: (f) => (existsSync(join(repo, f)) ? readFileSync(join(repo, f), "utf-8") : undefined),
    index: () => (index ??= indexSite(composedSources(repo, mounts), themeIncludes())),
    coneOf: coneByFile(repo),
    base,
    head,
    site: arg("--site"),
  });
  try {
    const blobs = gitBlobs(repo, head ?? "HEAD", changed);
    impact = pinImpact(impact, (p) => blobs.get(p));
  } catch (e) {
    console.error(`not pinned: ${(e as Error).message.split("\n")[0]}`);
  }
  const json = JSON.stringify(impact, null, 2) + "\n";
  const out = arg("--out");
  if (out) writeFileSync(out, json);
  else process.stdout.write(json);
}

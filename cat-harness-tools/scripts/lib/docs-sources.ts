/**
 * Every DOCS SOURCE the checkout declares: the base layer's, then each
 * layer above it that declares one of its own.
 *
 * Owner, 2026-10-23 ("A1"): ONE docs-page build run that reads the
 * docs-source directory EVERY mounted layer declares — not one run per
 * layer. Until then `gen-docs-pages.ts` took its one root from
 * `HARNESS_ROOT`, so a page about a higher layer's process could only be
 * authored here, in the layer below it, which is the wrong direction.
 *
 * ## Where a docs source is declared, and where its pages land
 *
 * The same place the base layer declares its own: a `docs-source` entry
 * in the `docs.json` of a directory the layer declares with graph typology
 * `docs`. Its pages render into THAT directory (`<docs dir>/<slug>.md`),
 * exactly as the base layer's render into its site directory. So a
 * layer publishes its pages wherever that directory is published — for a
 * `composed` one, inside the one Jekyll site, under the layer's own name.
 *
 * ## Which layers, and in what order
 *
 * The base first, then the checkout's layers that DEPEND on it, deepest
 * first ({@link checkoutDependentsOf}) — the order `scenario-overlay` reads
 * higher layers' scenarios in. This file names no layer: which ones exist
 * is the checkout's answer, never a list written down here.
 *
 * ## Every key a source above the base publishes is qualified by its layer
 *
 * A page's slug is unique only WITHIN its source. Its route already carries
 * the layer (a source above the base is composed into the site under the
 * layer's name), and so does every key derived from it
 * ({@link qualifiedKey}): the page key todos attach to and the listing they
 * are grouped under, the address of its QA witnesses
 * (`/assets/qa/<instance>/<slug>/`, which the site build copies each
 * layer's witness tree into) and its block labels. The base layer's keys
 * are its own, unqualified, so what it publishes is unchanged.
 *
 * So the same page in two layers is two distinct pages with two distinct
 * IRIs, and nothing collides. Owner, 2026-10-23: that is never a failure,
 * only a warning ({@link warnSamePages}), naming both files — it is usually a
 * move in flight (the higher layer has added the page and the lower layer has
 * not removed it yet), which the warning says how to finish.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { declarationPathIn, docsSourceDirFor, repoRootFor, siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { siteNodeSitePath } from "../../schemas/kg/jsonld.ts";
import { checkoutDependentsOf } from "../../schemas/kg/harness-config.ts";

/** One declared docs source: where its pages are authored and where they render. */
export interface DocsSource {
  /** The declaring layer's name. */
  instance: string;
  /** The declaring layer's root, absolute. */
  root: string;
  /** The docs source directory, absolute. */
  srcDir: string;
  /** The docs directory its pages render into, absolute. */
  outDir: string;
  /** True for the base layer — the one the site is built from. */
  base: boolean;
}

interface RawEntry {
  id?: string;
  path?: string;
  graphTypologies?: string[];
  scope?: string;
}

/** The `docs-source` entry of the `docs.json` in `docsDir`, if it declares one. */
function declaredSourceIn(docsDir: string): string | undefined {
  const file = join(docsDir, "docs.json");
  if (!existsSync(file)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(file, "utf-8")) as { directories?: RawEntry[] };
    const entry = (raw.directories ?? []).find((d) => d.id === "docs-source");
    return entry?.path ? join(docsDir, entry.path.replace(/\/+$/, "")) : undefined;
  } catch {
    // Unparseable is `check:declared-dirs`' finding, not this reader's.
    return undefined;
  }
}

/**
 * The docs sources ONE layer declares, read RAW from its declaration (a
 * validating read throws on a typology this layer does not register, and a
 * higher layer is free to register its own). Only instance-scoped `docs`
 * directories, and only a source that exists on disk: a declared-but-absent
 * one is `check:declared-dirs`' to report.
 */
export function declaredDocsSources(root: string, fallbackName = root): DocsSource[] {
  const declPath = declarationPathIn(root);
  if (declPath === undefined) return [];
  let decl: { name?: string; directories?: RawEntry[] };
  try {
    decl = JSON.parse(readFileSync(declPath, "utf-8"));
  } catch {
    return [];
  }
  const out: DocsSource[] = [];
  for (const d of decl.directories ?? []) {
    if (!d.path || d.scope === "repository" || !(d.graphTypologies ?? []).includes("docs")) continue;
    const outDir = resolve(root, d.path.replace(/\/+$/, ""));
    const srcDir = declaredSourceIn(outDir);
    if (srcDir === undefined || !existsSync(srcDir)) continue;
    out.push({ instance: decl.name ?? fallbackName, root: resolve(root), srcDir: resolve(srcDir), outDir, base: false });
  }
  return out;
}

/**
 * The base layer's docs source — {@link docsSourceDirFor} and
 * {@link siteDirFor}, unchanged, so its pages keep the routes they have.
 */
export function baseDocsSource(root: string): DocsSource {
  let instance = root;
  try {
    const p = declarationPathIn(root);
    if (p) instance = (JSON.parse(readFileSync(p, "utf-8")) as { name?: string }).name ?? root;
  } catch {
    // named by path
  }
  return {
    instance,
    root: resolve(root),
    srcDir: resolve(docsSourceDirFor(root)),
    outDir: resolve(join(root, siteDirFor(root))),
    base: true,
  };
}

/**
 * Every docs source in the checkout: the base layer's first, then each
 * dependent's, deepest first. `dependents` is injectable for tests; by
 * default it is the checkout's own answer.
 */
export function docsSources(
  baseRoot: string,
  dependents: ReadonlyArray<{ name: string; root: string }> = checkoutDependentsOf(baseRoot),
): DocsSource[] {
  const base = baseDocsSource(baseRoot);
  const out = [base];
  const seen = new Set([base.srcDir]);
  for (const dep of dependents) {
    for (const s of declaredDocsSources(dep.root, dep.name)) {
      if (seen.has(s.srcDir)) continue;
      seen.add(s.srcDir);
      out.push(s);
    }
  }
  warnSamePages(out);
  return out;
}

/**
 * `key` — a page slug, a flattened slug, a label — as the whole checkout
 * names it: unchanged for the base layer, prefixed with the layer's
 * name (`<instance>/<key>`) for a source above it, the prefix its pages are
 * composed under. Two sources holding one key therefore never share one.
 */
export function qualifiedKey(src: DocsSource, key: string): string {
  return src.base ? key : `${src.instance}/${key}`;
}

/**
 * Where a page's site JSON-LD (or one of its nodes') is published,
 * SITE-relative, which is also its `@id` against the site base:
 * `site/<slug>[/nodes/<id>].jsonld`, under `<instance>/` for a source above
 * the base, because that source is composed into the site under its
 * layer's name. `gen-site-jsonld.ts` writes it at this address, so
 * anything that links a node (a todo's `target`) asks here rather than
 * prefixing `site/` to a qualified key — which named
 * `site/<instance>/<slug>/…`, a file nothing publishes.
 */
export function sourceSiteNodePath(src: DocsSource, slug: string, nodeId?: string): string {
  return `${src.base ? "" : `${src.instance}/`}${siteNodeSitePath(slug, nodeId)}`;
}

/**
 * A page named by its QUALIFIED key ({@link qualifiedKey}), resolved to the
 * source that holds it: its site-relative node path
 * ({@link sourceSiteNodePath}) and the file `gen-site-jsonld.ts` writes it
 * to. A key is a source's above the base when it starts with that layer's
 * name and the source holds the page; otherwise it is the base's.
 */
export function siteNodeOf(sources: readonly DocsSource[], key: string, nodeId?: string): { sitePath: string; file: string } {
  const holds = (src: DocsSource, slug: string): boolean => existsSync(join(src.srcDir, slug.replace(/\//g, "-")));
  const src = sources.find((s) => !s.base && key.startsWith(`${s.instance}/`) && holds(s, key.slice(s.instance.length + 1)))
    ?? sources.find((s) => s.base);
  if (src === undefined) return { sitePath: siteNodeSitePath(key, nodeId), file: siteNodeSitePath(key, nodeId) };
  const slug = src.base ? key : key.slice(src.instance.length + 1);
  return { sitePath: sourceSiteNodePath(src, slug, nodeId), file: join(src.outDir, siteNodeSitePath(slug, nodeId)) };
}

/**
 * The rendered page of `slug` (unqualified, as its manifest declares it),
 * from whichever docs source holds it: the source, the page's qualified key
 * ({@link qualifiedKey}), and the file `gen-docs-pages.ts` writes it to,
 * `<outDir>/<slug>.md`. Sources are asked in {@link docsSources} order, so
 * while a page is in two layers (a move in flight) the lower copy answers,
 * as it keeps the plain label. `undefined` when no source holds the page.
 * A reader of a generated page asks here rather than spelling one layer's
 * site directory, which goes stale the day the page moves up a layer.
 */
export function docsPageOf(sources: readonly DocsSource[], slug: string): { source: DocsSource; key: string; file: string } | undefined {
  const flat = slug.replace(/\//g, "-");
  const source = sources.find((s) => existsSync(join(s.srcDir, flat)));
  return source === undefined ? undefined : { source, key: qualifiedKey(source, slug), file: join(source.outDir, `${slug}.md`) };
}

const warned = new Set<string>();

/**
 * Warn, once per process, for each page directory (flattened slug) that more
 * than one source holds — never fail (owner, 2026-10-23): with every key
 * qualified ({@link qualifiedKey}) they are distinct pages. Each warning names
 * both files. Returns the duplicates, for a caller or a test to inspect.
 */
export function warnSamePages(sources: readonly DocsSource[]): Array<{ page: string; files: string[] }> {
  const holders = new Map<string, string[]>();
  for (const src of sources) {
    if (!existsSync(src.srcDir)) continue;
    for (const d of readdirSync(src.srcDir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const file = relative(repoRootFor(src.root), join(src.srcDir, d.name)).split(sep).join("/");
      holders.set(d.name, [...(holders.get(d.name) ?? []), `${src.instance} (${file})`]);
    }
  }
  const out: Array<{ page: string; files: string[] }> = [];
  for (const [page, files] of [...holders].sort(([a], [b]) => a.localeCompare(b))) {
    if (files.length < 2) continue;
    out.push({ page, files });
    const msg =
      `⚠ docs page "${page}" is in more than one docs source: ${files.join(" and ")}. ` +
      `Each is published as its own page, at its own instance's address. ` +
      `If this is a move in flight, finish it by removing the lower copy.`;
    if (warned.has(msg)) continue;
    warned.add(msg);
    console.warn(msg);
  }
  return out;
}

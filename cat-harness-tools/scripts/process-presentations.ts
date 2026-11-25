/**
 * Which docs page sections present which BPMN process — read from the PAGES.
 *
 * A page section that shows a diagram already says so: `WebPageNode.asset`
 * with `kind: "bpmn"` and `source: "processes/x.bpmn"`. That is the dependent
 * pointing at the general node (data-modelling step 8), so the index is built
 * from it and nothing is authored on the process.
 *
 * Two readers use this index: `render-bpmn.ts` (where a subprocess box
 * links) and `gen-processes-viz.ts` (the "Presented on" line of a process
 * page).
 *
 * @module scripts/process-presentations
 */
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { loadManifestValue, manifestPath } from "../pipeline/json-manifest.ts";

import { publishedPagePath } from "./lib/jekyll-permalink.ts";
import { PAGE_LOCALE, visualiserSitePath } from "./viewer-declarations.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { baseDocsSource, declaredDocsSources, docsSources, type DocsSource } from "./lib/docs-sources.ts";

/**
 * The part of a `WebPage` manifest this reads, declared here rather than
 * imported: `schemas/ui/webpage.ts` is a core module and this one is harness,
 * which may not depend on core. A real manifest satisfies it structurally.
 */
interface PageManifest {
  slug: string;
  title: string;
  nodes: ReadonlyArray<{ id: string; title?: string; asset?: { kind: string; source: string } }>;
}

/** One page section that presents a process. */
export interface Presentation {
  /** The page's slug, e.g. `guides/who-smart-ig` — its SOURCE path without `.md`. */
  page: string;
  /**
   * Where the page is PUBLISHED, site-relative, e.g.
   * `docs/cat-harness/guides/who-smart-ig.html` — Jekyll's answer, read from
   * the site's permalink defaults (`lib/jekyll-permalink.ts`). Not the slug:
   * the docs-folder pages publish under `docs/<instance>/` (bean `kc7k`).
   */
  href: string;
  /** The section's pinned anchor id. */
  node: string;
  /** The section's heading, when it has one. */
  title?: string;
  /** The page's title. */
  pageTitle: string;
}

/**
 * The docs sources ONE layer holds, as `gen-docs-pages.ts` reads them: the
 * base layer's own (`docsSourceDirFor`), or the ones a layer above it
 * declares (`lib/docs-sources.ts`).
 */
function sourcesOf(instanceRoot: string): DocsSource[] {
  if (resolve(instanceRoot) === resolve(HARNESS_ROOT)) return [baseDocsSource(instanceRoot)];
  return declaredDocsSources(instanceRoot);
}

/** The manifests of one docs source: `<source>/<slug>/<slug>.ts`. */
function manifestsIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    // `<slug>.json` since y9r6 step 4b (cat-harness#751), else `<slug>.ts`,
    // chosen as gen-docs-pages.ts chooses it.
    .map((d) => manifestPath(join(dir, d.name), d.name))
    .filter((f) => existsSync(f))
    .sort();
}

/** The docs manifests, as `gen-docs-pages.ts` finds them: `docs/source/<slug>/<slug>.ts`. */
export function docsManifests(instanceRoot: string): string[] {
  return sourcesOf(instanceRoot).flatMap((s) => manifestsIn(s.srcDir));
}

/**
 * Where a page of `src` is published, site-relative. The base layer's
 * pages are the site's own; a layer above it is COMPOSED into the site
 * under its own name (`compose-docs.ts`), so its pages sit under that.
 */
function publishedHref(src: DocsSource, slug: string): string {
  const own = publishedPagePath(src.outDir, slug);
  return src.base ? own : `${src.instance}/${own}`;
}

async function presentationsIn(src: DocsSource, out: Map<string, Presentation[]>, key: (source: string) => string): Promise<void> {
  for (const manifest of manifestsIn(src.srcDir)) {
    const page = (await loadManifestValue(manifest)) as PageManifest;
    for (const node of page.nodes) {
      if (node.asset?.kind !== "bpmn") continue;
      const k = key(node.asset.source);
      const list = out.get(k) ?? [];
      // The same page and section from a second docs source — one page in two
      // layers, which `docsSources` has warned about (a move in flight, as a
      // rule). It is listed once, from the source read first, so a diagram's
      // link does not turn into "presented more than once" — and what the
      // base renders does not change — merely because the copy above exists.
      if (list.some((x) => x.page === page.slug && x.node === node.id)) continue;
      list.push({
        page: page.slug,
        href: publishedHref(src, page.slug),
        node: node.id,
        pageTitle: page.title,
        ...(node.title ? { title: node.title } : {}),
      });
      out.set(k, list);
    }
  }
}

/**
 * Every BPMN presentation, keyed by the diagram's source path as the page
 * spells it (`processes/x.bpmn`) — relative to the page's OWN layer — in
 * page then section order.
 */
export async function processPresentations(instanceRoot: string): Promise<Map<string, Presentation[]>> {
  const out = new Map<string, Presentation[]>();
  for (const src of sourcesOf(instanceRoot)) await presentationsIn(src, out, (s) => s);
  return out;
}

/**
 * Every presentation in the checkout — the base layer's pages and every
 * docs source above it — keyed relative to `baseRoot`, so a reader rooted
 * there (`render-bpmn.ts`) finds a diagram whichever layer's page shows it.
 */
export async function checkoutProcessPresentations(baseRoot: string = HARNESS_ROOT): Promise<Map<string, Presentation[]>> {
  const out = new Map<string, Presentation[]>();
  for (const src of docsSources(baseRoot)) {
    await presentationsIn(src, out, (s) => relative(baseRoot, join(src.root, s)).split(sep).join("/"));
  }
  return out;
}

/**
 * Where a link to a process should land, relative to the site root.
 *
 * Exactly one section presents it → that section. None → the process's own
 * generated page. MORE than one → also the process page, which lists every
 * section: choosing one would be a silent pick between pages that each say
 * something about it, and the process page is where they are all named.
 */
export function processTarget(home: string, presentations: readonly Presentation[] | undefined): string {
  if (presentations?.length === 1) {
    const p = presentations[0]!;
    return `${p.href}#${p.node}`;
  }
  return `${processesRoute()}/${home}.html`;
}

let route: string | undefined;
/**
 * Where the process pages are: the route of the visualiser cat-harness
 * DECLARES rendered by `processes-viewer` — `en/cat-harness/processes` (owner,
 * 2026-10-09: `<base>/<harness>/<visualizer>`). Read once, never spelled.
 */
function processesRoute(): string {
  if (route !== undefined) return route;
  const harness = join(HARNESS_ROOT);
  try {
    route = dirname(visualiserSitePath(harness, "processes-viewer").rel);
  } catch {
    route = `${PAGE_LOCALE}/cat-harness/processes`;
  }
  return route;
}

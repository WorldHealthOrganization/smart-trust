/**
 * Which visualiser renders a declared directory — read from the HARNESS
 * declarations, never from the pages.
 *
 * A visualiser is declared in `<instance>.json` (`visualisers`,
 * `HarnessVisualiserSchema`), its URL is
 * `visualiserRoute({ harness, visualiser })` (`schemas/kg/visualiser-route.ts`),
 * and a page is found because the declaration says where it is — so no two
 * pages can contend for one URL.
 *
 * ## What a page still carries
 *
 * `rendered-by` — `<meta name="rendered-by">` or the front-matter scalar —
 * names the Tool that drew it. Provenance only: nothing resolves a directory
 * through it. `check:visualiser-routes` uses it to refuse a generator that
 * wrote OUTSIDE the routes its Tool is declared to render.
 *
 * ## The locale segment
 *
 * A visualiser's pages are written at
 * `<site>/<locale>/<harness>/<visualiser>/…`, and {@link pageParts} is the ONE
 * place the locale is supplied: every helper here that answers "where is this
 * page" goes through it, and so does every generator that builds its own
 * route parts.
 *
 * The address without the locale, `<harness>/<visualiser>/…`, keeps working:
 * `compose-docs.ts` writes a forwarding page there for every page under the
 * localised route ({@link forwardingParts}).
 *
 * A page committed at that unlocalised address and not yet regenerated is
 * still READ where it is ({@link existingPageDir}), so a tile keeps opening a
 * page that exists while its writer has not run.
 *
 * @module scripts/viewer-declarations
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

import {
  declarationPathIn,
  directoriesForGraph,
  instanceDirectoryForGraph,
  layerRootsIn,
  readDeclaration,
  repoRootFor,
  siteDir,
  siteDirFor,
  visualisationsOf,
  type HarnessVisualiser,
  type Tile,
  type Visualisation,
} from "../schemas/kg/cat-harness.js";
import { checkoutDirectories, corpusDirectoriesForGraph, implementingRootFor, resolveLandingInstance } from "../schemas/kg/harness-config.js";
import { mountedInstanceRoots } from "../schemas/kg/remote-mount.js";
import { DEFAULT_LOCALE } from "../schemas/content/translation.js";
import { scriptTable } from "../schemas/sdlc/script-table.ts";
import { siteRootFrom, visualiserRoute, type VisualiserRouteParts } from "../schemas/kg/visualiser-route.js";
import { overlayPath } from "./lib/layer-output.ts";

// ── Provenance: which Tool drew a page ────────────────────────────────────

const RENDERS_META = /<meta\s+name="renders"\s+content="([^"]*)"\s*\/?>/;
const BY_META = /<meta\s+name="rendered-by"\s+content="([^"]*)"\s*\/?>/;

/** A directory as a repository-relative, `/`-separated path with no trailing slash. */
export function renderedPath(repoRoot: string, absDir: string): string {
  return relative(repoRoot, absDir).split(sep).join("/").replace(/\/+$/, "");
}

/**
 * Put `<meta name="rendered-by">` into a page's `<head>`, replacing any
 * earlier one — and REMOVING any `<meta name="renders">`, the page-derived
 * declaration this module no longer reads. A page with no `<head>` is
 * returned unchanged.
 */
export function withRenderedBy(html: string, tool: string): string {
  const stripped = html.replace(new RegExp(`\\s*${RENDERS_META.source}`), "").replace(new RegExp(`\\s*${BY_META.source}`), "");
  return stripped.replace(/<head([^>]*)>/i, (h) => `${h}\n<meta name="rendered-by" content="${tool}">`);
}

/**
 * The same for a generated markdown or themed page: `rendered-by:` in its
 * front matter, any `renders:` list removed. A page with no front matter is
 * returned unchanged.
 */
export function withRenderedByFrontMatter(md: string, tool: string): string {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(md);
  if (!m) return md;
  const kept = m[1]!
    .replace(/^renders:\n(?:\s+-\s.*\n?)*/m, "")
    .replace(/^rendered-by:.*\n?/m, "")
    .replace(/\n+$/, "");
  return `---\n${[kept, `rendered-by: ${tool}`].filter(Boolean).join("\n")}\n---\n${md.slice(m[0].length)}`;
}

/**
 * @deprecated The page no longer declares what it renders. Kept, ignoring
 * `paths`, so a generator in another repository keeps compiling until it moves
 * to {@link withRenderedBy}; it writes provenance only.
 */
export function withRenders(html: string, _paths: readonly string[], tool: string): string {
  return withRenderedBy(html, tool);
}

/** @deprecated See {@link withRenders}; use {@link withRenderedByFrontMatter}. */
export function withRendersFrontMatter(md: string, _paths: readonly string[], tool: string): string {
  return withRenderedByFrontMatter(md, tool);
}

/** @deprecated A page declares no `renders:` list any more; this returns none. */
export function rendersFrontMatter(_paths: readonly string[]): string[] {
  return [];
}

/** Which Tool drew a page, from its `<meta name="rendered-by">` or front matter. `undefined` when it does not say. */
export function renderedByOf(text: string): string | undefined {
  if (text.startsWith("---\n")) {
    const fm = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
    const m = /^rendered-by:\s*(.+)$/m.exec(fm);
    return m ? m[1]!.trim() : undefined;
  }
  return BY_META.exec(text)?.[1] || undefined;
}

/** Whether a page still carries the retired page-derived declaration (`renders:` or `<meta name="renders">`). */
export function carriesRenders(text: string): boolean {
  if (text.startsWith("---\n")) {
    const fm = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
    return /^renders:/m.test(fm);
  }
  return RENDERS_META.test(text);
}

// ── The declarations ──────────────────────────────────────────────────────

/** One declared visualiser, with the harness that declares it. */
export interface DeclaredVisualiser extends HarnessVisualiser {
  /** The declaring layer's `name` — the `<harness>` route segment. */
  harness: string;
  /** Its root, absolute. */
  harnessRoot: string;
}

/** A declaration read raw: generators must not throw on a layer whose other fields a newer schema refuses. */
interface RawDecl {
  name?: string;
  visualisers?: HarnessVisualiser[];
  directories?: { id: string; path?: string; graphTypologies?: string[] }[];
  builtAtPublish?: { path: string; writer: string[] }[];
}

function readRaw(root: string): RawDecl | undefined {
  const p = declarationPathIn(root);
  if (p === undefined || !existsSync(p)) return undefined;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as RawDecl;
  } catch {
    return undefined;
  }
}

/**
 * The script FILES behind a `builtAtPublish` entry's writer NAMES, repository-
 * relative — or `undefined` when any name does not resolve to a file on disk.
 *
 * A writer is declared by its script name (`processes:viz`), and a
 * visualisation's `writer` is a file (`visualisationResolves` checks each one
 * exists). The name is resolved through `scriptTable`, the table `bun run cat`
 * itself runs from: the command's first argument with a script extension is
 * the file.
 */
export function writerFilesFor(repoRoot: string, names: readonly string[]): string[] | undefined {
  let table: Map<string, { command: string }>;
  try {
    table = scriptTable(repoRoot);
  } catch {
    return undefined;
  }
  const files: string[] = [];
  for (const name of names) {
    const file = (table.get(name)?.command ?? "").split(/\s+/).find((t) => /\.(ts|js|mjs|py|sh)$/.test(t));
    if (file === undefined || !existsSync(join(repoRoot, file))) return undefined;
    files.push(file);
  }
  return files;
}

/**
 * The writer of a visualiser page its HARNESS builds at publish, or `undefined`.
 *
 * A page under the harness's `builtAtPublish` (bean 0b8c) is never committed:
 * it exists only after `derive:publish`. Without its writer the visualisation
 * looked absent on every checkout that had not built the site, and the navbar
 * said "no viewer yet" over viewers the deploy serves — processes, tools,
 * schemas and the rest (owner, 2026-10-15). The writer is read from the entry
 * the harness already declares for that route, not restated on the visualiser.
 */
export function builtAtPublishWriter(repoRoot: string, harnessRoot: string, ref: string): string[] | undefined {
  const rel = relative(harnessRoot, join(repoRoot, ref)).split(sep).join("/");
  if (rel.startsWith("..")) return undefined;
  const entry = (readRaw(harnessRoot)?.builtAtPublish ?? []).find((e) =>
    e.path.endsWith("/") ? rel.startsWith(e.path) : rel === e.path,
  );
  return entry === undefined ? undefined : writerFilesFor(repoRoot, entry.writer);
}

/** Every layer root in the checkout: top level, and every remote mount wherever it landed. */
export function checkoutInstanceRoots(repoRoot: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of [...layerRootsIn(repoRoot), ...mountedInstanceRoots(repoRoot).values()]) {
    const abs = resolve(r);
    if (seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
  }
  return out;
}

const declaredCache = new Map<string, DeclaredVisualiser[]>();

/**
 * Every visualiser every layer in the checkout declares, in layer order.
 *
 * Read from the declarations as written — the `visualisers` array of each
 * `<instance>.json` — so this answers the same in a standalone repository and
 * in the composed checkout, with no mount-path rewriting: a route is
 * `<harness>/<id>/` wherever the harness's files happen to sit.
 */
export function declaredVisualisers(repoRoot: string): DeclaredVisualiser[] {
  const key = resolve(repoRoot);
  const hit = declaredCache.get(key);
  if (hit !== undefined) return hit;
  const out: DeclaredVisualiser[] = [];
  for (const root of checkoutInstanceRoots(repoRoot)) {
    const d = readRaw(root);
    if (d?.name === undefined) continue;
    for (const v of d.visualisers ?? []) out.push({ ...v, harness: d.name, harnessRoot: root });
  }
  declaredCache.set(key, out);
  return out;
}

/**
 * A `<harness>/<visualiser>/` route a SITE holds a generated page at, and the
 * Tool its page says drew it.
 */
export interface RecordedRoute {
  harness: string;
  visualiser: string;
  /** `rendered-by`, or the basename (no extension) of the script `generated:` names. */
  renderedBy: string;
}

/**
 * The routes a built site records, read from the generated pages in it — for a
 * checkout where the layer that DECLARES a visualiser is not mounted.
 *
 * A layer standing alone (`check-standalone`) still carries the harness site,
 * and that site still holds pages a higher layer's generator wrote there; only
 * the declaration that placed them is absent. {@link declaredVisualisers}
 * stays the authority whenever it can be read. This answers the narrower
 * question "which pages here say which Tool drew them", from the page's own
 * front matter (`rendered-by:`, or `generated: <path>/<tool>.ts`) at
 * `<site>/<locale>/<harness>/<visualiser>/index.{md,html}` (or, on a site drawn
 * before the pages moved under the page locale, without it) — the same self-declaration
 * `check:reference-direction` trusts when it skips generator output. It
 * resolves no directory, so the module rule above is untouched.
 */
export function routesRecordedInSite(site: string): RecordedRoute[] {
  const out: RecordedRoute[] = [];
  const dirs = (p: string): string[] => {
    try {
      return readdirSync(p, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith(".") && !d.name.startsWith("_"))
        .map((d) => d.name)
        .sort();
    } catch {
      return [];
    }
  };
  const seen = new Set<string>();
  // A page is at `<locale>/<harness>/<visualiser>/` since the pages moved
  // under the page locale (the glossary on 2026-10-16), and at
  // `<harness>/<visualiser>/` on a site drawn before; both are read, so the
  // record does not go blind on a current site.
  for (const base of [join(site, PAGE_LOCALE), site]) {
    for (const harness of dirs(base)) {
      for (const visualiser of dirs(join(base, harness))) {
        for (const file of ["index.md", "index.html"]) {
          const p = join(base, harness, visualiser, file);
          if (!existsSync(p)) continue;
          const by = recordedRenderer(readFileSync(p, "utf-8"));
          if (by !== undefined && !seen.has(`${harness}/${visualiser}`)) {
            seen.add(`${harness}/${visualiser}`);
            out.push({ harness, visualiser, renderedBy: by });
          }
          break;
        }
      }
    }
  }
  return out;
}

/** The Tool a page's front matter says drew it, or `undefined` when it says none. */
function recordedRenderer(text: string): string | undefined {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
  if (fm === undefined) return undefined;
  const rendered = /^rendered-by:\s*["']?([A-Za-z0-9._-]+)/m.exec(fm)?.[1];
  if (rendered !== undefined) return rendered;
  const generated = /^generated:\s*["']?(\S+?)\.(?:ts|js|py)\b/m.exec(fm)?.[1];
  return generated === undefined ? undefined : generated.split("/").pop();
}

/** Forget what {@link declaredVisualisers} read — for a test that rewrites a declaration mid-process. */
export function clearDeclaredVisualisers(): void {
  declaredCache.clear();
  heldCache.clear();
}

/** The visualisers one Tool is declared to draw. */
export function visualisersRenderedBy(repoRoot: string, tool: string): DeclaredVisualiser[] {
  return declaredVisualisers(repoRoot).filter((v) => v.renderedBy === tool);
}

/**
 * The ONE visualiser a Tool draws for one harness — what a generator that
 * writes a single page per harness asks. Throws when the harness declares
 * none or several for that Tool, rather than taking the first: a generator
 * writing to a route nobody declared is the defect this module exists to end.
 */
export function visualiserFor(harnessRoot: string, tool: string, repoRoot: string = repoRootFor(harnessRoot)): DeclaredVisualiser {
  const mine = visualisersRenderedBy(repoRoot, tool).filter((v) => resolve(v.harnessRoot) === resolve(harnessRoot));
  if (mine.length === 0) {
    // The harness may not be under `repoRoot` (a standalone repository): read it directly.
    const d = readRaw(harnessRoot);
    const own = (d?.visualisers ?? []).filter((v) => v.renderedBy === tool);
    if (d?.name !== undefined && own.length === 1) return { ...own[0]!, harness: d.name, harnessRoot: resolve(harnessRoot) };
    throw new Error(
      `${harnessRoot}: declares ${own.length === 0 ? "no" : own.length} visualiser(s) rendered by \`${tool}\` — ` +
        "declare exactly one in its `visualisers` (cat-harness/schemas/kg/cat-harness.ts, HarnessVisualiserSchema)",
    );
  }
  if (mine.length > 1) {
    throw new Error(`${harnessRoot}: declares ${mine.length} visualisers rendered by \`${tool}\` (${mine.map((v) => v.id).join(", ")}); ask by covered directory instead`);
  }
  return mine[0]!;
}

/**
 * The SITE directory every visualiser page is written into: the docs layer
 * of the layer that owns the site — cat-harness's, the Jekyll source
 * every deploy builds (`compose-docs.ts`'s base layer). A page of ANY
 * harness lives at `<site>/<harness>/<visualiser>/…`, which is the route, so
 * the file and the URL cannot disagree.
 */
export function siteOwnerDir(repoRoot: string): string {
  const owner = checkoutInstanceRoots(repoRoot).find((r) => readRaw(r)?.name === "cat-harness");
  // A checkout with no cat-harness layer is a folio standing alone: its own
  // root's site directory is the site.
  const root = owner ?? resolve(repoRoot);
  try {
    return join(root, siteDirFor(root));
  } catch {
    // No declaration there at all (a fixture, a bare directory): the
    // conventional answer `siteDir` gives every layer — asked of it, not
    // spelled here.
    const name = basename(root);
    return join(root, siteDir({ name, stub: name }));
  }
}

/**
 * A visualiser page its OWN harness commits, in that harness's site
 * directory, rather than in the site owner's.
 *
 * Every visualiser page used to be written into {@link siteOwnerDir}, so a
 * page drawn by a content layer above the platform sat in the platform's
 * tree and the platform named that layer (`check:reference-direction`). A
 * harness may instead commit the page in its own site directory at
 * `<site>/<visualiser>/` — the declared route with its own name dropped,
 * which is also where the page lands on that harness's OWN site, whose root is
 * the harness itself (wrong-direction move M1, 2026-10-20).
 *
 * Only the page its declared Tool drew counts: the index page there must say
 * `rendered-by: <renderedBy>`. Anything else at that path is the harness's own
 * docs, and `check:visualiser-routes` reports it as a collision.
 *
 * `route` is the UNLOCALISED address `<harness>/<visualiser>/`: the page is
 * drawn for that depth (its relative links say so), and it is the address
 * such a page was published at while it sat in the site owner's tree, so the
 * URL does not change. `compose-docs.ts` lays the directory there; the mount
 * of the harness's docs leaves it out ({@link heldVisualiserPaths}).
 */
export interface HeldVisualiserPage {
  visualiser: DeclaredVisualiser;
  /** The directory holding the page, absolute. */
  dir: string;
  /** Its index page, `index.html` or `index.md`, absolute. */
  page: string;
  /** Where the site publishes it, site-relative with a trailing slash. */
  route: string;
}

const heldCache = new Map<string, HeldVisualiserPage[]>();

export function heldVisualiserPages(repoRoot: string): HeldVisualiserPage[] {
  // Cached beside `declaredVisualisers` and cleared with it: `viewersOf` asks
  // for every directory and sub-graph it resolves, and a whole-checkout audit
  // makes thousands of such calls.
  const key = resolve(repoRoot);
  const hit = heldCache.get(key);
  if (hit !== undefined) return hit;
  const site = resolve(siteOwnerDir(repoRoot));
  const out: HeldVisualiserPage[] = [];
  for (const v of declaredVisualisers(repoRoot)) {
    let own: string;
    try {
      own = resolve(v.harnessRoot, siteDirFor(v.harnessRoot));
    } catch {
      continue;
    }
    if (own === site) continue;
    const dir = join(own, v.id);
    const index = ["index.html", "index.md"].map((f) => join(dir, f)).find((p) => existsSync(p));
    if (index === undefined || renderedByOf(readFileSync(index, "utf-8")) !== v.renderedBy) continue;
    out.push({ visualiser: v, dir, page: index, route: visualiserRoute(forwardingParts({ harness: v.harness, visualiser: v.id })) });
  }
  heldCache.set(key, out);
  return out;
}

/**
 * The held page a visualiser's ref is published FROM, repository-relative, as
 * a one-file `writer`: the page is not on disk at its route until compose lays
 * it there, and a tile that read that absence as "no viewer" would grey a page
 * the site serves — the same reasoning as a page built at publish.
 */
function heldPageWriter(repoRoot: string, v: DeclaredVisualiser): string[] | undefined {
  const h = heldVisualiserPages(repoRoot).find((x) => x.visualiser.harness === v.harness && x.visualiser.id === v.id);
  return h === undefined ? undefined : [renderedPath(repoRoot, h.page)];
}

/**
 * The paths, relative to `mountedDir`, of the held visualiser pages inside it
 * — what a mount of that directory leaves out, because the site publishes them
 * at their declared route instead ({@link heldVisualiserPages}). Without this
 * the same page would also go out raw, front matter and all, under the docs
 * mount, which copies after Jekyll and renders nothing.
 */
export function heldVisualiserPaths(repoRoot: string, mountedDir: string): string[] {
  const base = resolve(mountedDir);
  return heldVisualiserPages(repoRoot)
    .map((h) => relative(base, h.dir).split(sep).join("/"))
    .filter((rel) => rel !== "" && !rel.startsWith(".."));
}

// ── Where a page is ───────────────────────────────────────────────────────

/**
 * The locale the platform's visualiser pages are written in: today only
 * `DEFAULT_LOCALE` (`en`), because the pages' chrome is English and a locale
 * segment with nothing translated behind it would claim a translation that
 * does not exist.
 */
export const PAGE_LOCALE: string = DEFAULT_LOCALE;

/**
 * A view's route parts WITH its locale — `parts` as given when they name one,
 * else under {@link PAGE_LOCALE}. The one place a page's locale is supplied
 * (see the module comment); `visualiserRoute` of the result is
 * `en/<harness>/<visualiser>/…`.
 */
export function pageParts<T extends VisualiserRouteParts>(parts: T): T & { locale: string } {
  return { ...parts, locale: parts.locale ?? PAGE_LOCALE };
}

/**
 * The same view's route WITHOUT the locale: the address its page had before
 * the locale segment, `<harness>/<visualiser>/…`, where `compose-docs.ts`
 * writes a forwarding page so that address keeps working (bean `t4xb`).
 */
export function forwardingParts<T extends VisualiserRouteParts>(parts: T): Omit<T, "locale"> {
  const { locale: _locale, ...rest } = parts;
  return rest;
}

/** The absolute directory a visualiser view is written into: `<site>/<route>`, the route exactly as `parts` give it. */
export function visualiserPageDir(site: string, parts: VisualiserRouteParts): string {
  return join(site, ...visualiserRoute(parts).split("/").filter(Boolean));
}

// Over the layer overlay: a mounted layer's pages are written at its output
// root (bean `cat-tools-sm8r`, item 4), so a page there is held too.
const holdsPage = (dir: string): boolean => existsSync(overlayPath(join(dir, "index.html"))) || existsSync(overlayPath(join(dir, "index.md")));

/**
 * The directory a view's page IS in under `site`: its localised directory
 * ({@link pageParts}) when that holds an index page, else the directory at its
 * old address ({@link forwardingParts}) when THAT does — a page committed
 * before the locale segment whose writer has not run since. `undefined` when
 * neither holds one.
 */
export function existingPageDir(site: string, parts: VisualiserRouteParts): string | undefined {
  const at = visualiserPageDir(site, pageParts(parts));
  if (holdsPage(at)) return at;
  const old = visualiserPageDir(site, forwardingParts(parts));
  return holdsPage(old) ? old : undefined;
}

/**
 * The page file of a view, REPOSITORY-relative — `index.html`, or `index.md`
 * when that is what is on disk (Jekyll builds both to the same URL).
 * `index.html` when neither is there, which is what a publish-time page
 * (`writer`, bean `0b8c`) will be. Under the localised route
 * ({@link pageParts}), unless only the old address holds the page
 * ({@link existingPageDir}).
 */
export function visualiserPageRef(repoRoot: string, parts: VisualiserRouteParts, site: string = siteOwnerDir(repoRoot)): string {
  // A page its own harness holds is published where compose lays it, at its
  // held route under this site: that is the ref, so the URL a reader is given
  // is read off it like any other. `viewersOf` names the held file as its writer.
  const held = parts.subgraph === undefined && existingPageDir(site, parts) === undefined
    ? heldVisualiserPages(repoRoot).find((h) => h.visualiser.harness === parts.harness && h.visualiser.id === parts.visualiser)
    : undefined;
  if (held !== undefined) return renderedPath(repoRoot, join(site, ...held.route.split("/").filter(Boolean), basename(held.page)));
  const dir = existingPageDir(site, parts) ?? visualiserPageDir(site, pageParts(parts));
  const file = existsSync(overlayPath(join(dir, "index.md"))) && !existsSync(overlayPath(join(dir, "index.html"))) ? "index.md" : "index.html";
  return renderedPath(repoRoot, join(dir, file));
}

/**
 * The directories of a kind the handler layer declares, as a page names
 * them. `corpus`: the handler AND every layer stacked on it.
 */
export function handledDirectories(
  repoRoot: string,
  handlerRoot: string,
  kind: string,
  scope: "instance" | "corpus" = "instance",
): string[] {
  const dirs = scope === "corpus" ? corpusDirectoriesForGraph(handlerRoot, kind) : directoriesForGraph(handlerRoot, kind);
  return dirs.map((d) => renderedPath(repoRoot, d));
}

/**
 * The directory a one-page viewer writes into, for the visualiser `tool`
 * draws for this harness: `<site>/<locale>/<harness>/<id>/`. Replaces the old
 * `conventionalPage`, which composed `<directory basename>/index.md` from the
 * handled directory — a URL the generator chose rather than the declaration.
 */
export function visualiserPageFor(harnessRoot: string, tool: string, site: string): { dir: string; visualiser: DeclaredVisualiser } {
  const v = visualiserFor(harnessRoot, tool);
  return { dir: visualiserPageDir(site, pageParts({ harness: v.harness, visualiser: v.id })), visualiser: v };
}

/**
 * Where a one-page viewer writes, RELATIVE TO THE SITE DIRECTORY, and the
 * relative path back to the site root from there: the visualiser `tool`
 * draws for the harness at `harnessRoot`, at `<locale>/<harness>/<id>/<file>`.
 * `up` counts the locale segment, so it is `../../../` for the full view.
 */
export function visualiserSitePath(harnessRoot: string, tool: string, file = "index.md"): { rel: string; up: string; visualiser: DeclaredVisualiser } {
  const v = visualiserFor(harnessRoot, tool);
  const parts = pageParts({ harness: v.harness, visualiser: v.id });
  return { rel: visualiserRoute({ ...parts, asset: file }), up: siteRootFrom(parts), visualiser: v };
}

/**
 * The SITE-RELATIVE route prefix of the visualiser `tool` draws for the
 * harness at `harnessRoot`, WITHOUT the locale: `<harness>/<id>`. That is the
 * address its forwarding page sits at, and what a writer that lays its pages
 * out per locale itself prefixes with each locale (core's `glossary-page.ts`
 * writes `<locale>/<route>/` for every locale it has). A generator writing the
 * platform's pages asks {@link declaredPageRoute}. `undefined` when the
 * harness declares none.
 */
export function declaredRoute(harnessRoot: string, tool: string): string | undefined {
  try {
    const v = visualiserFor(harnessRoot, tool);
    return visualiserRoute({ harness: v.harness, visualiser: v.id }).replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

/**
 * The SITE-RELATIVE route prefix a generator writes the visualiser `tool`
 * draws for the harness at `harnessRoot` under, `<locale>/<harness>/<id>` — for
 * a generator that places a full view and per-sub-graph views beneath it
 * (`viewerPlacement(site, route)`, `${route}/${subject}`). `undefined` when
 * the harness declares none: a generator then writes nothing, because no
 * declaration means no route.
 */
export function declaredPageRoute(harnessRoot: string, tool: string): string | undefined {
  try {
    const v = visualiserFor(harnessRoot, tool);
    return visualiserRoute(pageParts({ harness: v.harness, visualiser: v.id })).replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

/** @deprecated Retained for one release: the kind's declared directory basename. Use {@link visualiserSitePath}. */
export function conventionalPage(handlerRoot: string, kind: string): string | undefined {
  const dir = instanceDirectoryForGraph(handlerRoot, kind);
  return dir === undefined ? undefined : `${basename(dir)}/index.md`;
}

// ── Reading a directory's viewers ─────────────────────────────────────────

/** The part of a declared directory {@link viewersOf} reads. */
export interface ViewedDirectory {
  id: string;
  path: string;
  scope?: string;
  graphTypologies?: readonly string[];
  coverage?: Parameters<typeof visualisationsOf>[0];
  tile?: Tile;
}

/**
 * Does visualiser `v` cover directory `d` of the layer named `owner`?
 *
 * - `covers`: only the declaring harness's own directories, by id;
 * - `coversKinds`: every declared directory of those kinds in the checkout —
 *   the "full KG" the owner's rule names, which is what a corpus-wide viewer
 *   (the library, schemas, processes) draws: it lists bootstrap's processes
 *   as readily as a content layer's.
 */
export function covers(v: DeclaredVisualiser, d: ViewedDirectory, owner: string, absDir?: string, repoRoot?: string): boolean {
  if (v.harness === owner && (v.covers ?? []).includes(d.id)) return true;
  // The SAME directory declared by another layer (`beans/`, scope
  // `repository`, is one directory however many layers name it): a
  // visualiser of it is a visualiser of it, whoever declared the entry.
  if (absDir !== undefined && repoRoot !== undefined && (v.covers ?? []).length > 0) {
    const mine = readRaw(v.harnessRoot)?.directories ?? [];
    for (const id of v.covers ?? []) {
      const e = mine.find((x) => x.id === id) as { path?: string; scope?: string } | undefined;
      if (e?.path && resolve(join(e.scope === "repository" ? repoRoot : v.harnessRoot, e.path)) === resolve(absDir)) return true;
    }
  }
  return (v.coversKinds ?? []).some((k) => (d.graphTypologies ?? []).includes(k));
}

/**
 * Every visualisation of a declared directory, normalised: one per declared
 * visualiser that covers it, the page being that visualiser's route.
 *
 * The page a tile opens is the SUB-GRAPH view when the visualiser draws
 * per-sub-graph pages (`subgraphs: "instance" | "directory"`) and that page
 * exists, else the full view. Dressed in the visualiser's tile fields, then
 * the directory's own {@link Tile} — a directory's presentation is its own
 * business. `[]` when nothing covers it.
 *
 * @param instanceRoot the root of the layer whose declaration `d` is from
 */
export function viewersOf(
  d: ViewedDirectory,
  instanceRoot: string,
  repoRoot: string = repoRootFor(instanceRoot),
  /** The site directory the routes are under; default the site owner's (`siteOwnerDir`). */
  siteDir?: string,
): Array<Visualisation & { title: string }> {
  // The OWNER is the layer whose declaration carries the entry: this one,
  // or — for an entry `siteDirectories` presented from the checkout root —
  // the root. A `repository`-scoped path resolves from the checkout either way.
  const own = readRaw(instanceRoot);
  //
  // Only a REPOSITORY-scoped entry can be the root's: a directory declared
  // inside this layer's own tree by a nested declaration (`beans/beans.json`'s
  // `defs/`, `notes/`, `workflows/`) is absent from `own.directories` too, and
  // was handed to the root — core's and tools' work items then opened
  // `beans/dth-hrh/`, the site owner's page, under a second name
  // (check:nav-names, dth-hrh run 42343581318).
  const owner =
    (own?.directories ?? []).some((x) => x.id === d.id) || d.scope !== "repository"
      ? own?.name
      : (readRaw(repoRoot)?.name ?? own?.name);
  if (owner === undefined) return [];
  const absDir = join(d.scope === "repository" ? repoRoot : instanceRoot, d.path);
  let site: string | undefined = siteDir;
  const out: Array<Visualisation & { title: string }> = [];
  for (const v of declaredVisualisers(repoRoot)) {
    if (!covers(v, d, owner, absDir, repoRoot)) continue;
    site ??= siteOwnerDir(repoRoot);
    const full = pageParts({ harness: v.harness, visualiser: v.id });
    // The sub-graph a directory's tile opens. `instance`: the owner's name.
    // `directory`: the directory id — qualified by its layer first when
    // another harness owns the visualiser, because a corpus-wide view keeps
    // ids unique that way (`folio-assistant-sci-skills` beside `skills`).
    const under = (d.graphTypologies ?? []).map((k) => v.subgraphUnder?.[k]).find((u) => u !== undefined);
    const at = (seg: string): string => (under ? `${under}/${seg}` : seg);
    // A bare id is taken for another layer's directory only when the
    // declaring harness does not hold a directory of that id itself: a bare
    // `skills` is cat-harness's own, `core-skills` can only be core's.
    const harnessIds = new Set((readRaw(v.harnessRoot)?.directories ?? []).map((x) => x.id));
    // `subgraphUnder` nests either kind of sub-graph: the glossary's
    // per-instance pages sit at `glossary/instance/<instance>/` (owner,
    // 2026-10-15, "3a") so a layer name cannot meet an asset-type page.
    const subs =
      v.subgraphs === "instance"
        ? [at(owner)]
        : v.subgraphs === "directory"
          ? owner === v.harness
            ? [at(d.id)]
            : [at(`${owner}-${d.id}`), ...(harnessIds.has(d.id) ? [] : [at(d.id)])]
          : [];
    // A sub-graph page counts when it is on disk (over the layer overlay: a
    // mounted layer's pages are at its output root, bean `cat-tools-sm8r`) OR when the declaring harness
    // builds it at publish (`writer` or `builtAtPublish`): a page that is
    // deliberately not committed is not missing, and its writer is named on the
    // tile instead.
    const subRef = subs
      .map((sub) => visualiserPageRef(repoRoot, { ...full, subgraph: sub }, site!))
      .find((r) => existsSync(overlayPath(join(repoRoot, r))) || v.writer !== undefined || builtAtPublishWriter(repoRoot, v.harnessRoot, r) !== undefined);
    // Covered BY KIND, a visualiser that draws per-sub-graph views covers a
    // directory only where it drew that directory's view: the full KG page of
    // a viewer that never reached this layer is not its viewer.
    //
    // A directory the visualiser ALSO names by id (`covers`) keeps its full
    // view when no sub-graph page was drawn for it (bean
    // `folio-assistant-1nu0`): `beans` draws cat-harness's own repository
    // store as the full board and every other layer's store as a page of
    // its own, so the declarer's row must not lose the board it already had.
    const byId =
      (v.harness === owner && (v.covers ?? []).includes(d.id)) ||
      !(v.coversKinds ?? []).some((k) => (d.graphTypologies ?? []).includes(k));
    if (subs.length > 0 && subRef === undefined && !byId) continue;
    // A directory the visualiser NAMES by id keeps its full view even when a
    // sub-graph page of the same layer exists (bean `folio-assistant-750a`):
    // `beans` draws the repository store as the board AND as `beans/cat-harness/`,
    // the page its parts (`defs/`, `notes/`, `workflows/`) open, and the store's
    // own row must still open the board.
    const named = v.harness === owner && (v.covers ?? []).includes(d.id);
    const ref = (named ? undefined : subRef) ?? visualiserPageRef(repoRoot, full, site);
    const { id: _id, renderedBy: _by, covers: _c, coversKinds: _k, subgraphs: _s, subgraphUnder: _u, alias: _a, harness: _h, harnessRoot: _r, ...tile } = v;
    // `writer` is declared relative to the HARNESS (its own scripts), and read
    // repository-relative like `ref`, so a mount path is never written down.
    // ...where it is IMPLEMENTED: the harness's scripts live in cat-harness-tools (bean 70lx).
    //
    // A writer neither the declaring layer nor its implementers hold may be
    // spelled from the CHECKOUT root, where the layers are mounted: smart-ra
    // declares `cat-harness-tools/archimate/scripts/gen-archimate-pages.ts`,
    // which resolves when smart-ra is the checkout but, read against its mount
    // (`dpi-h-ra/`), named `dpi-h-ra/cat-harness-tools/…` and failed
    // check:derived-from in dth-hrh (run 42343581318). Taken only when the
    // file is there, so a genuinely dangling writer is still reported.
    const writerAt = (w: string): string => {
      const at = join(implementingRootFor(v.harnessRoot, w), w);
      return !existsSync(at) && existsSync(join(repoRoot, w)) ? join(repoRoot, w) : at;
    };
    const writer =
      v.writer?.map((w) => renderedPath(repoRoot, writerAt(w))) ??
      (existsSync(overlayPath(join(repoRoot, ref))) ? undefined : (builtAtPublishWriter(repoRoot, v.harnessRoot, ref) ?? heldPageWriter(repoRoot, v)));
    // The directory's tile is the DEFAULT dress; what a visualiser that NAMES
    // the directory declares about itself wins, since a directory drawn twice
    // needs two names, whereas a kind-covering visualiser's generic title
    // must not override the directory's own title or row label.
    out.push({ ...d.tile, ...tile, ...(writer ? { writer } : {}), ref, title: (named ? v.title : undefined) ?? d.tile?.title ?? d.id });
  }
  return out;
}

/**
 * Declared directories with their viewers RESOLVED — `coverage.visualiser`
 * filled in from {@link viewersOf}, in memory, for the readers written
 * against that field (`graph-tiles.ts`, `harness-tiles.ts`). The declaration
 * on disk is untouched, and carries no such field.
 */
export function siteDirectories<T extends ViewedDirectory>(
  own: readonly T[],
  instanceRoot: string,
  repoRoot: string = repoRootFor(instanceRoot),
): T[] {
  // The site this layer builds draws the CHECKOUT, and since placement PR0
  // (bean `ejye`) the checkout's own directories — `beans/`, `todos/`,
  // `fsh-guts/`, `memory/`, the root docs overlay — are declared by the
  // checkout's ROOT layer. They are read from there and presented as
  // repository-scoped entries of this site, ids unchanged. An id this
  // layer already declares wins.
  if (resolve(repoRoot) === resolve(instanceRoot)) return [...own];
  const shared = checkoutSharedDirectories<T>(repoRoot);
  if (shared === undefined || shared.root === resolve(instanceRoot)) return [...own];
  // An own entry wins only when it GOES somewhere — the rule `navbarRow` in
  // `sync-docs-harness.ts` applies to the icon row (cat-harness#31). core
  // declares a `beans` of its own with no viewer, and letting it shadow the
  // checkout's viewed one dropped the Beans tile from the index site
  // (`beans-count-agrees.e2e.ts`, 2026-10-09).
  const viewed = (d: T) => viewersOf(d, instanceRoot, repoRoot).length > 0;
  const replaced = new Set(
    own.filter((d) => !viewed(d) && shared.directories.some((c) => c.id === d.id && viewed(c))).map((d) => d.id),
  );
  const kept = own.filter((d) => !replaced.has(d.id));
  const ids = new Set(kept.map((d) => d.id));
  return [...kept, ...shared.directories.filter((d) => !ids.has(d.id))];
}

/**
 * The checkout's own directories, as repository-scoped entries, and the
 * layer root that declares them: the checkout ROOT's layer when it has
 * one, else — the index checkout, whose root declares nothing (owner,
 * 2026-10-08) — the layer that declares the repository-scoped directories
 * (cat-harness, decision (b)), the same answer `checkoutGraphOwner` gives
 * the navbar. `undefined` when neither is readable.
 */
function checkoutSharedDirectories<T extends ViewedDirectory>(
  repoRoot: string,
): { root: string; directories: T[] } | undefined {
  const read = (p: string): { directories?: T[] } | undefined => {
    try {
      return JSON.parse(readFileSync(p, "utf-8")) as { directories?: T[] };
    } catch {
      return undefined;
    }
  };
  const p = declarationPathIn(repoRoot);
  if (p !== undefined) {
    const root = read(p);
    if (root === undefined) return undefined;
    return { root: resolve(repoRoot), directories: (root.directories ?? []).map((d) => ({ ...d, scope: "repository" })) };
  }
  let owner: string | undefined;
  try {
    owner = checkoutDirectories(repoRoot).find((d) => d.scope === "repository" && d.own)?.declaredBy;
  } catch {
    return undefined; // an unreadable declaration is `check:harness-dirs`'s to report
  }
  const ownerRoot = owner === undefined ? undefined : layerRootsIn(repoRoot).find((r) => readDeclaration(r)?.name === owner);
  const q = ownerRoot === undefined ? undefined : declarationPathIn(ownerRoot);
  const decl = q === undefined ? undefined : read(q);
  if (ownerRoot === undefined || decl === undefined) return undefined;
  return { root: resolve(ownerRoot), directories: (decl.directories ?? []).filter((d) => d.scope === "repository") };
}

/**
 * The landing harness's own directory: where the declaration whose
 * directories become the site's tiles lives (issue #1904).
 *
 * `instance` is that harness's root. A hub, or a checkout where nothing can
 * be decided, falls back to the checkout root when it declares a layer,
 * else to `fallback`. `sync-docs-harness.ts` refuses an ambiguous or invalid
 * landing before it gets here; a generator only needs the same answer when
 * there is one.
 */
export function landingRoot(repoRoot: string, fallback: string): string {
  const choice = resolveLandingInstance(repoRoot);
  if (choice.kind === "instance") {
    const r = layerRootsIn(repoRoot).find((x) => readDeclaration(x)?.name === choice.name);
    if (r !== undefined) return r;
  }
  return readDeclaration(repoRoot) !== undefined ? repoRoot : fallback;
}

/**
 * THE DIRECTORIES THE SITE'S TILES ARE MADE FROM, with their viewers
 * resolved: the landing harness's declaration plus the checkout's shared
 * directories, exactly what `sync-docs-harness.ts` hands `graphTiles`.
 *
 * A generator that declares a tile count must key it by an id from THIS
 * list, or the count names a directory that is not a tile and the badge is
 * silently absent (litlfred/folio-assistant#931). Reading `ROOT`'s own
 * declaration was right while `ROOT` was the landing harness; since the
 * landing moved to the core content layer it keyed every scoped count by a
 * cat-harness id, and the core tiles over the same pages drew no badge.
 */
export function tileDirectories<T extends ViewedDirectory>(repoRoot: string, fallback: string): T[] {
  const root = landingRoot(repoRoot, fallback);
  const own = (readDeclaration(root)?.directories ?? []) as unknown as T[];
  return withViewers(siteDirectories(own, root, repoRoot), root, repoRoot);
}

/**
 * A tile count for each page a generator wrote that is a TILE's page, keyed
 * by that tile's directory id, in the shape `tileCounts` takes.
 *
 * `pages` holds each page's repository-relative path and its own count:
 * the number computed FOR that page, the rule #889 set. A page no tile
 * opens contributes nothing, so there is no badge rather than a wrong one.
 *
 * Pages are matched by their DIRECTORY, not their file name: a declaration
 * spells a tile's page `…/index.html` while a Jekyll source is
 * `…/index.md`, and both are the one page at that directory. A ref declared
 * by two tiles keeps the first, as `directoryByVisualisationRef` does.
 */
export function tileCountsForPages(
  pages: Readonly<Array<{ page: string; count: number; unit: readonly [string, string] }>>,
  repoRoot: string,
  fallback: string,
): Record<string, readonly [number, string]> {
  const dirOf = (ref: string): string => ref.split("/").slice(0, -1).join("/");
  const byDir = new Map<string, string>();
  for (const d of tileDirectories(repoRoot, fallback)) {
    for (const v of visualisationsOf(d.coverage, d.id)) {
      const k = dirOf(v.ref);
      if (!byDir.has(k)) byDir.set(k, d.id);
    }
  }
  const out: Record<string, readonly [number, string]> = {};
  for (const p of pages) {
    const id = byDir.get(dirOf(p.page.split(sep).join("/")));
    if (id !== undefined && !(id in out)) out[id] = [p.count, p.count === 1 ? p.unit[0] : p.unit[1]];
  }
  return out;
}

export function withViewers<T extends ViewedDirectory>(
  dirs: readonly T[],
  instanceRoot: string,
  repoRoot: string = repoRootFor(instanceRoot),
  siteDir?: string,
): T[] {
  return dirs.map((d) => {
    const v = viewersOf(d, instanceRoot, repoRoot, siteDir);
    if (v.length === 0) return d;
    return { ...d, coverage: { ...d.coverage, visualiser: v as [Visualisation, ...Visualisation[]] } };
  });
}

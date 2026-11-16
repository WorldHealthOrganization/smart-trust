#!/usr/bin/env bun
/**
 * An IG repository's OWN site, from its checkout and its cached AST alone:
 * the three steps the platform's site build runs for a repository that holds
 * an implementation guide and no layer declaration of its own.
 *
 * @module fhir-harness/scripts/ig-repo-site
 * @covers none — a build step: it composes an IG into a site and judges no declared graph
 *
 * ```sh
 * bun run fhir-harness/scripts/ig-repo-site.ts ast [--ig <checkout>] [--work <dir>]
 * bun run fhir-harness/scripts/ig-repo-site.ts compose <site source> [--ig <checkout>] [--baseurl <base>] [--plantuml-jar <jar>] [--work <dir>]
 * bun run fhir-harness/scripts/ig-repo-site.ts publisher-pages <built site> [--ig <checkout>] [--work <dir>]
 * ```
 *
 * The checkout scripts `ig-site:ast`, `ig-site:compose` and
 * `ig-site:publisher-pages` (`package.json` `checkoutScripts`) are these
 * three, and that is how the platform finds them: it asks the mounted layers'
 * script table for those names and never names this layer. `--work` is the
 * site build's work directory, `SITE_WORK` when the build runs the step.
 *
 * ## The site is built from the cached AST (`ig-build-pipeline` rule 1)
 *
 * Owner, 2026-10-14: *"i want AST to be used. it should be in cache
 * branch"*, and, on this route, *"Yes, fix in platform"*. Nothing here runs
 * the IG Publisher or reads its `output/`. `ast` restores the AST from the
 * IG's cache branch (`ig-cache.sh restore`) and judges it
 * (`ig-ast.ts` `astValidity`); a stale, cannot-tell or absent AST is refused
 * (rule 2), and `SITE_ACCEPT_STALE_AST=1` accepts a stale one for a preview
 * only, never for the root. `compose` derives the artefact index from that
 * AST (`ast-to-artifact-index.ts`) and `publisher-pages` serves the AST's
 * resources as the data the thin pages draw.
 *
 * ## What a layer above leaves for this one: the IG API sidecars
 *
 * An IG's per-artefact JSON sidecars (JSON Schema, JSON-LD, displays) are
 * written by post-processing this layer does not know (`ig-build-pipeline`
 * §"What this layer refuses to know about"). A layer above that produces them
 * runs before `compose` and leaves them in the work directory:
 * `<work>/ig-api/sidecars/` the files, `<work>/ig-api/ig-api.json` what the
 * IG calls them (`{ "label": "..." }`). This layer binds whatever is there to
 * the artefacts by the Publisher's file names, labels them as the descriptor
 * says (`gen-ig-pages --sidecar-label`) and serves them at
 * `fhir-artifact-index/sidecars/`. Nothing there, nothing is bound, and the
 * pages say "IG API". Files it leaves in `<work>/ig-api/site/` (its own pages
 * over the sidecars, such as an OpenAPI page) are served verbatim at the site
 * root, never over a path the site already holds, and the Publisher-chrome
 * guard judges them like every other page. The one exception: a page of the
 * IG's own that holds the marker the descriptor names (`"placeholder"`) is a
 * shell around the layer's content, and the layer's page at that path
 * replaces it.
 *
 * ## Why there is no layer here
 *
 * Owner, 2026-10-14: an IG repository "doesn't need its own harness. It can
 * just define index.config.json and reference [its base harness] as a
 * dependency." So nothing here reads a declaration of the IG. What the earlier
 * route (`stage-ig-sites --only <instance> --source .`) read from one, it now
 * reads from the IG itself:
 *
 * - the **menu** from `sushi-config.yaml` `menu:`, at build time
 *   (`buildMenu`, the same reader `ingest-ig-menu` commits with). Never
 *   committed: a committed copy is one more file to drift from the config it
 *   was read from;
 * - the **palette** from the webpage theme of the layer the repository mounts
 *   at the top of its `index.config.json` closure ({@link topMounts}): the
 *   layers it lists that no other listed layer `needs`. That is the
 *   `needs` the repository would have declared;
 * - the **edit links** from the checkout's own `origin`.
 *
 * ## `compose`: the IG's pages, at the site root
 *
 * The IG's `input/` and `sushi-config.yaml` are staged as one just-the-docs
 * source (`stageIgSite`) and composed at the ROOT of the host source the
 * platform's chrome step wrote (`composeIgSite --at-root`): the IG IS the site.
 * A path both write is refused, never overwritten.
 *
 * The IG's ARTEFACT pages are thin pages built from the AST
 * ({@link astArtefactPages}: the artefact index derived from the AST, the
 * grouping kept from the IG's committed `fhir-artifact-index/index.json`
 * when it holds one, then `gen-ig-pages.ts --ig-site`), so `artifacts.html`,
 * `toc.html` and `artifact/<Type>-<id>.html` are the site's own pages over
 * JSON-LD nodes, and the narrative's links to `<Type>-<id>.html` are pointed
 * at them (`relinkArtifacts`). `ig-render-jekyll` §"Thin pages, the default".
 *
 * Each artefact's TAB VIEWS are thin pages too (owner, 2026-10-14, answering
 * whether the Publisher's per-artefact tabs are rendered: "3. Render them
 * too"): `artifact/<Type>-<id>-definitions.html`, `-mappings.html`, the JSON
 * view (`.json.html`, a profile's `.profile.json.html`) and `-examples.html`
 * where an artefact claims the profile, at the Publisher's file names beside
 * the artefact's page, drawn from the AST's copy of the resource the site
 * serves at its root as `<Type>-<id>.json`. The narrative's links to those names are pointed at them
 * as its links to the artefact pages are. The Publisher's `comparison-v*`
 * directories are not rendered and not published.
 *
 * ## `publisher-pages`: the AST's data, never the Publisher's HTML
 *
 * Each resource is served ONCE, at the root under the Publisher's name,
 * `<Type>-<id>.json`, unless the site already holds the path: the thin
 * artefact pages draw it from there (`gen-ig-pages --compiled-data .`) and
 * the narrative links it by that name. No `ast-data/` mirror of the AST tree
 * is published (owner, 2026-11-08). The artefact index is served at
 * `fhir-artifact-index/index.json`, and the IG API sidecars a layer above
 * left at `fhir-artifact-index/sidecars/`. The Publisher's finished HTML is
 * never published (owner, 2026-10-14: "I DO NOT WANT THE IG PUBLISHER
 * HTML"): no step here copies it, and the guard below refuses a site that
 * carries its chrome, whoever put it there. Then the repeated element ids the
 * composition produces are repaired (`dedupeSiteIds`), and the site's
 * `folio-build.json` is written at its root ({@link igSiteStamp}), as every
 * folio site carries one.
 *
 * ## The IG's search and the language picker (owner, 2026-10-15)
 *
 * Layout "C": the folio rail stands in for the theme's side menu, and the
 * IG's top bar carries a search box over the IG's pages and artefacts. So
 * `compose` writes the search index and its client under the docs root
 * (`ig-search.ts`), and both the composed pages' top bar and the thin pages'
 * header carry the box. And the language picker the live pages had (*"what
 * happened to search/language select at top of display window?"*): docs-ui
 * draws it from a page's `fa-translation-meta` block, which only a page the
 * theme laid out carried. `publisher-pages` writes the block the platform
 * writes on a page Jekyll never laid out (cat-harness-tools
 * `lib/translation-meta.ts`, as `mount-instance-docs.ts` does) into every
 * built page that lacks one, from the IG checkout's own translation
 * declaration; the site build's `set-html-lang.ts` then reads it. The
 * same step gives every other built page the IG's slim bar ({@link stampIgBar}),
 * whose box is followed by the slot docs-ui puts the language picker in, so
 * the picker sits in the bar beside it.
 *
 * ## One layout (owner, 2026-10-15)
 *
 * The owner asked for the full width of the overlay's hub page *"on the other
 * pages as well... also can you make it match how folio-assistnat does with
 * the scrollnig and such. please consolidate behaviours/appearance"*.
 * Every page of the site links the shared page layout (cat-harness-tools
 * `page-layout.ts`: full width beside the rail, the window the one scroller,
 * the bar sticky above it on a wide screen and scrolling away on a phone,
 * anchors landing below it) and then the IG's one
 * stylesheet, `ig-artifact.css`. The composed pages carry the IG's full bar,
 * and every other page carries its slim bar (`stampIgBar`; owner, "keep slim").
 *
 * ## Whose dead links
 *
 * Both steps list the built pages they put in the site in the file the site
 * build names in `FOLIO_SITE_UPSTREAM_PAGES`. Those pages carry the IG's OWN
 * links: a dead one is the IG's to fix (the Publisher's output alone holds
 * thousands, measured on one IG), so the site build reports it and does not
 * refuse the publish over it, while a dead link in the chrome still refuses.
 */
import { IG_API_HUB_CONFIG_ID, IG_API_HUB_DEFAULT_PAGE, hasIgApi, hubEntries, igApiHubPageOf, writeIgApiHubSite } from "./ig-api-hub.ts";
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";

import { parse as parseYaml } from "yaml";
import { igVersionFacts, stampIgVersionChrome } from "./ig-version-chrome.ts";

import { conceptOf, profilesOf } from "./ast-to-artifact-index.ts";
import { astValidity, type AstValidity, buildKind, readAst } from "./ig-ast.ts";
import { composeIgSite, dedupeSiteIds, describeStage, IG_THIN_CSS_FILE, stageIgSite, type SitePalette } from "./build-ig-site";
import { artifactSearchEntries, IG_SEARCH_ARTIFACTS_NODE, IG_SEARCH_INDEX_FILE, IG_SEARCH_SCRIPT_FILE, IG_SEARCH_SCRIPT_SOURCE, igSearchIndex, pageSearchEntries, withIgBar } from "./ig-search.ts";
import { translationMetaBlock, withTranslationMeta } from "../../cat-harness-tools/scripts/lib/translation-meta.ts";
import { declaredEntries, type ResolvedEntry, type Served, servedDirectories } from "../../cat-harness-tools/scripts/mount-instance-docs.ts";
import { igOpenapiGraph, OPENAPI_DIR } from "../../cat-harness-tools/openapi/scripts/ig-site-openapi.ts";
import type { FhirArtifactIndex } from "../schemas/fhir-artifact-index.js";
import { buildMenu } from "./ingest-ig-menu.ts";
import { THIN_INDEX_CONFIG_ID, THIN_PAGE_CONFIG_ID, isArtifactPage } from "./ig-thin-pages.ts";
import { ARTIFACT_DIR, ARTIFACT_INDEX_FILE, COMPILED_BY_NAME, rootResourceName } from "./ig-artifact-jsonld.ts";
import { AST_HISTORY_FILE, readAstHistory } from "./ig-ast-history.ts";
import { copyDeclared, igReadScope, type IgReadScope } from "./ig-read-scope.ts";
import { siteBuild, type SiteBuild, STAMP_FILE } from "./site-build-stamp.ts";
import { buildQaPage, publishQaAssets } from "./ig-qa-page.ts";
import { pageLocales } from "./ig-page-translations.ts";
import { ACCEPT_UNREVIEWED_ENV, runGate, type ContentQaVerdict } from "./ig-content-qa.ts";
import { annexesFor, artifactsFor, copyDocsInto, footerFor, githubEditBase, instanceNeeds, webpagePalette } from "./stage-ig-sites.ts";
// The preview directories (cat-harness-tools `schemas/sdlc/preview-prefix.ts`):
// `branches/` since 2026-11-05, and the legacy `STAGING/` still read. Named
// here, not imported, so this layer does not wait on that module's release.
const PREVIEW_PREFIX_ALT = "(?:branches|STAGING)";

/**
 * The file, named by the site build in this variable, in which a step lists
 * the built pages whose links are the IG's own: their dead links are the IG's
 * to fix, and the site build reports them rather than refusing the publish.
 * Unset (the script run by hand), nothing is listed.
 */
export const UPSTREAM_PAGES_ENV = "FOLIO_SITE_UPSTREAM_PAGES";

function listUpstream(pages: readonly string[]): void {
  const f = process.env[UPSTREAM_PAGES_ENV];
  if (f && pages.length) appendFileSync(f, `${pages.join("\n")}\n`);
}

/** The page a Jekyll source file builds to, by Jekyll's default permalink; undefined for a file that is not a page. */
export function builtPage(sourcePath: string): string | undefined {
  if (/(^|\/)_/.test(sourcePath)) return undefined;
  const m = /^(.*)\.(md|markdown|html)$/.exec(sourcePath);
  return m ? `${m[1]}.html` : undefined;
}

/** The thin pages' stylesheet, beside the generator that writes it for a layer's artefact pages. */
const THIN_CSS_SOURCE = join(import.meta.dir, "templates", "ig-pages", "ig-artifact.css");

/** The checkout scripts this module provides, by the names the platform asks for. */
export const IG_SITE_SCRIPTS = { ast: "ig-site:ast", compose: "ig-site:compose", publisherPages: "ig-site:publisher-pages", bar: "ig-site:bar" } as const;

/**
 * The layers a repository mounts that nothing else it mounts needs: the
 * top of its `index.config.json` closure. Pure over the listed names and each
 * one's `needs`.
 */
export function topMounts(listed: readonly string[], needs: (name: string) => readonly string[]): string[] {
  const needed = new Set(listed.flatMap((n) => needs(n)));
  return listed.filter((n) => !needed.has(n));
}

/** The layer names `index.config.json` lists, in its order; empty without one. */
export function listedInstances(root: string): string[] {
  const f = join(root, "index.config.json");
  if (!existsSync(f)) return [];
  const c = JSON.parse(readFileSync(f, "utf-8")) as { instances?: { name?: unknown }[] };
  return (c.instances ?? []).map((i) => i.name).filter((n): n is string => typeof n === "string");
}

/**
 * The palette the IG's site wears: the one webpage theme the top mounts
 * declare, each inheriting along its own `needs`. Two tops with a theme each
 * is refused, as two themes in one layer are: nothing says which.
 */
export function topMountPalette(root: string): { palette?: SitePalette; note: string } {
  const tops = topMounts(listedInstances(root), (n) => instanceNeeds(root, n));
  if (tops.length === 0) return { note: "index.config.json lists no instance: no webpage theme" };
  const found = tops.map((t) => ({ t, ...webpagePalette(root, t) }));
  const hits = found.filter((f) => f.palette !== undefined);
  if (hits.length > 1) throw new Error(`the mounted layers ${hits.map((h) => h.t).join(" and ")} each give a webpage theme — nothing says which dresses this IG's site`);
  return hits[0] ? { palette: hits[0].palette!, note: hits[0].note } : { note: found.map((f) => f.note).join("; ") };
}

/** The name the composition files the IG's includes and data under: the repository's own. */
export function siteName(ig: string): string {
  const r = spawnSync("git", ["-C", ig, "config", "--get", "remote.origin.url"], { encoding: "utf-8" });
  const m = r.status === 0 ? /([^/:]+?)(?:\.git)?\/?$/.exec(r.stdout.trim()) : null;
  return m?.[1] ?? basename(resolve(ig));
}

/** The IG's title, from `sushi-config.yaml`; undefined when it states none. */
export function igTitle(ig: string): string | undefined {
  const f = join(ig, "sushi-config.yaml");
  if (!igReadScope(ig).declares("sushi-config.yaml") || !existsSync(f)) return undefined;
  const y = (parseYaml(readFileSync(f, "utf-8")) ?? {}) as { title?: unknown; name?: unknown };
  const t = typeof y.title === "string" ? y.title : typeof y.name === "string" ? y.name : undefined;
  return t?.trim() || undefined;
}

/** `https://github.com/<o>/<r>` from the checkout's origin, or undefined. */
function githubRepo(ig: string): string | undefined {
  const r = spawnSync("git", ["-C", ig, "config", "--get", "remote.origin.url"], { encoding: "utf-8" });
  const m = r.status === 0 ? /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(r.stdout.trim()) : null;
  return m ? `https://github.com/${m[1]}/${m[2]}` : undefined;
}

/**
 * Top-level paths of the checkout that are not the IG's source: the mounts
 * `index.lock.json` lays down, git's own directory, the Publisher's build
 * products (its `.gitignore` names them too) and the restored AST. Copying them would stage the
 * platform as if it were the IG.
 */
export function notSource(root: string): Set<string> {
  const out = new Set([".git", "node_modules", "output", "output-ast", "temp", "template", "input-cache", "fsh-generated"]);
  const lock = join(root, "index.lock.json");
  if (existsSync(lock)) {
    for (const i of (JSON.parse(readFileSync(lock, "utf-8")) as { instances?: { path?: unknown }[] }).instances ?? []) {
      if (typeof i.path === "string" && i.path !== "" && i.path !== ".") out.add(i.path.split("/")[0]!);
    }
  }
  return out;
}

/** Where `ig-cache.sh restore` lays the AST down, in the IG checkout. */
export const AST_DIR = "output-ast";
/**
 * How the thin pages find the AST's resources (`gen-ig-pages --compiled-data`):
 * each is served once at the site root under the Publisher's name,
 * `<Type>-<id>.json`. No `ast-data/` mirror of the AST tree is published
 * (owner, 2026-11-08: "we dont need ast-data/resources published").
 */
export const AST_DATA = COMPILED_BY_NAME;
/** Where the site serves the artefact index: the graph's own name. */
export const INDEX_SERVED = "fhir-artifact-index";
/** Where the site serves the IG API sidecars, the `localPath` each is bound at. */
export const SIDECARS_SERVED = `${INDEX_SERVED}/sidecars`;
/**
 * Under the site build's work directory: what a layer above leaves for this
 * one (module doc, §"What a layer above leaves"). `sidecars/` the files,
 * {@link IG_API_DESCRIPTOR} what the IG calls them.
 */
export const IG_API_WORK = "ig-api";
export const IG_API_DESCRIPTOR = "ig-api.json";
/** Under `ig-api/`: files the layer above wrote for the site root, served verbatim (its own pages over the sidecars). */
export const IG_API_SITE = "site";
/** Under the work directory: the artefact index `compose` derived, for `publisher-pages` to serve. */
export const INDEX_WORK = "ig-site-index";
/**
 * A preview accepts a stale AST by default (`ig-build-pipeline` rule 2; owner,
 * 2026-11-05: "preview/staging (non release) builds can be on stale cache").
 * Set to `0` to make a preview refuse one too. The root never accepts one.
 */
export const ACCEPT_STALE_ENV = "SITE_ACCEPT_STALE_AST";

/** Whether a preview may use a stale AST: yes unless {@link ACCEPT_STALE_ENV} is `0`. Pure. */
export function acceptStaleFromEnv(v: string | undefined): boolean {
  return v !== "0";
}
/** The validity verdict `ast` writes under the work directory. */
export const VALIDITY_FILE = "ig-ast-validity.json";
/** Under the work directory: the cache commit `ast` restored and its remote (`ig-cache.sh restore --record`). */
export const AST_SOURCE_FILE = "ig-ast-source.json";
/** `0` keeps the old route: the resources copied to the site root, not read by URL. */
export const AST_BY_URL_ENV = "SITE_AST_BY_URL";
/**
 * `0` serves no root `<Type>-<id>.json` when the pages read the resources by
 * URL (as before fhir-harness#359). By default the site carries every
 * resource at its root, reduced ({@link reduceForSite}), as FHIR's convention
 * and the IG Publisher do (owner, 2026-11-10, card "C"). Without a cache
 * commit to read by URL the root copies are the pages' own, full, either way.
 */
export const ROOT_RESOURCES_ENV = "SITE_ROOT_RESOURCES";

/** Whether the site serves the reduced root copies: yes unless {@link ROOT_RESOURCES_ENV} is `0`. Pure. */
export function rootResourcesFromEnv(env: Record<string, string | undefined> = process.env): boolean {
  return env[ROOT_RESOURCES_ENV] !== "0";
}

/**
 * Where the pages read the AST's resources from, when they read them by URL
 * (owner, 2026-11-10, card "A": a site points at a branch cache by
 * raw.githubusercontent.com URL pinned to a commit, and does not copy it into
 * gh-pages; fhir-harness#325): the cache branch's tree at the commit `ast`
 * restored, `https://raw.githubusercontent.com/<owner>/<repo>/<sha>`.
 *
 * Undefined, and the resources are copied to the site root as before, when
 * `ast` recorded no commit (an AST already in the checkout was used), the
 * remote is not on github.com, or {@link AST_BY_URL_ENV} is `0`. The commit
 * stays readable because each seed is a child of the branch's previous tip
 * (`ig-cache.sh seed`, fhir-harness#326).
 */
export function astRawBase(work: string | undefined, env: Record<string, string | undefined> = process.env): string | undefined {
  const s = astSource(work, env);
  return s ? `https://raw.githubusercontent.com/${s.repository}/${s.commit}` : undefined;
}

/** The cache commit `ast` restored and the `owner/repo` it is on, as {@link astRawBase} reads them; undefined as it is. */
export function astSource(work: string | undefined, env: Record<string, string | undefined> = process.env): { repository: string; commit: string } | undefined {
  if (!work || env[AST_BY_URL_ENV] === "0") return undefined;
  const f = join(work, AST_SOURCE_FILE);
  if (!existsSync(f)) return undefined;
  let rec: { commit?: unknown; remote?: unknown };
  try {
    rec = JSON.parse(readFileSync(f, "utf-8")) as typeof rec;
  } catch {
    return undefined;
  }
  const commit = typeof rec.commit === "string" && /^[0-9a-f]{40}$/.test(rec.commit) ? rec.commit : undefined;
  const repo = typeof rec.remote === "string" ? /github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(rec.remote)?.[1] : undefined;
  return commit && repo ? { repository: repo, commit } : undefined;
}

/** In the AST cache commit (and so under a restored AST): the artefact index `ig-cache.sh seed` wrote (`ig-index-cache.ts`). */
export const INDEX_CACHED = `${INDEX_SERVED}/index.json`;
/** Served beside where the index was: where the IG's artefact index is read from. */
export const INDEX_REF_FILE = "index.ref.json";
export const INDEX_REF_SCHEMA = "fhir-artifact-index-ref/v1";

/**
 * The pointer a site serves at `fhir-artifact-index/index.ref.json` (owner,
 * 2026-11-10, card "A": the index is served from the AST cache, not the site).
 * `index` is where the IG's artefact index is: the raw URL of the cache
 * commit's copy, or `index.json` beside the pointer when the site serves it
 * (an older cache that holds none). `base`, with a cache copy, is what that
 * index's `localPath`s are relative to: the cache commit's tree. Pure.
 */
export function indexRef(o: { raw?: string; repository?: string; commit?: string }): Record<string, string> {
  return o.raw
    ? { $schema: INDEX_REF_SCHEMA, index: `${o.raw}/${INDEX_CACHED}`, base: `${o.raw}/`, ...(o.repository ? { repository: o.repository } : {}), ...(o.commit ? { commit: o.commit } : {}) }
    : { $schema: INDEX_REF_SCHEMA, index: "index.json" };
}

/**
 * Where a reader finds an IG's artefact index from the IG's published site:
 * the pointer's `index`, resolved against the pointer; with no readable
 * pointer (a site built before it), `<site>/fhir-artifact-index/index.json`
 * as before. Returns the URL; fetching it is the caller's.
 */
export async function locateArtefactIndex(site: string, fetchJson: (url: string) => Promise<unknown> = async (u) => (await fetch(u)).json()): Promise<string> {
  const dir = new URL(`${INDEX_SERVED}/`, site.endsWith("/") ? site : `${site}/`);
  const fallback = new URL("index.json", dir).href;
  try {
    const ref = (await fetchJson(new URL(INDEX_REF_FILE, dir).href)) as { $schema?: unknown; index?: unknown };
    return ref?.$schema === INDEX_REF_SCHEMA && typeof ref.index === "string" ? new URL(ref.index, dir).href : fallback;
  } catch {
    return fallback;
  }
}

/** Under the work directory: the AST versions `compose` read for the History view, which `publisher-pages` serves. */
export const AST_HISTORY_WORK = "ig-ast-history.json";

/** The Swagger page the IG API generator writes among the site files (`ig-api-gen.ts`). */
export const SWAGGER_PAGE = "openapi/index.html";

/**
 * The Swagger page with each spec it lists at the address the site serves it
 * from. The generator lists each wrapper as `../<file>` from `openapi/`, the
 * site root, where no sidecar is served: they are at
 * `fhir-artifact-index/sidecars/` or, read from the AST cache commit, at its
 * raw URL. Only a listed name that is one of `files` is rewritten. Pure.
 */
export function rebaseSwaggerSpecs(html: string, files: ReadonlySet<string>, href: (file: string) => string): string {
  return html.replace(/"\.\.\/([^"\/]+\.openapi\.json)"/g, (m, f: string) => (files.has(f) ? JSON.stringify(href(f)) : m));
}

/** The IG API sidecars a layer above left, and what it calls them. */
export interface IgApi {
  sidecars: string;
  files: number;
  label?: string;
  /** Files to serve at the site root, at the paths they hold under this directory. */
  site?: string;
  /**
   * The marker a page of the IG's own holds where the layer above's page goes
   * (the IG's hub page is a shell around it). A site page holding it is
   * replaced by the layer's file at the same path; no other page ever is.
   */
  placeholder?: string;
  /**
   * Set when the files are read from the AST cache commit rather than served
   * by the site ({@link siteIgApi}): the raw URL of this directory there,
   * `https://raw.githubusercontent.com/<owner>/<repo>/<sha>/ig-api`.
   */
  rawBase?: string;
}

/**
 * The IG API sidecars under `work`, or undefined when no layer left any. A
 * descriptor that is there and says nothing usable is refused, not ignored:
 * the pages would otherwise carry a label nobody chose.
 */
export function readIgApi(work: string | undefined): IgApi | undefined {
  return work ? readIgApiDir(join(work, IG_API_WORK)) : undefined;
}

/**
 * The IG API the site binds: the one the AST cache commit holds, read by raw
 * URL at that commit, when `ast` recorded the commit and the cache holds one
 * (`ig-cache.sh seed` writes it, {@link seedIgApi}); else the one a layer
 * above left in the work directory, served by the site (an older cache, a
 * cache off github.com, or {@link AST_BY_URL_ENV} `0`).
 */
export function siteIgApi(work: string | undefined, ast: string, env: Record<string, string | undefined> = process.env): IgApi | undefined {
  const raw = astRawBase(work, env);
  const cached = raw ? readIgApiDir(join(ast, IG_API_WORK)) : undefined;
  return cached ? { ...cached, rawBase: `${raw}/${IG_API_WORK}` } : readIgApi(work);
}

/** {@link readIgApi} over the `ig-api` directory itself. */
export function readIgApiDir(dir: string): IgApi | undefined {
  const sidecars = join(dir, "sidecars");
  if (!existsSync(sidecars) || !statSync(sidecars).isDirectory()) return undefined;
  const files = readdirSync(sidecars).filter((f) => statSync(join(sidecars, f)).isFile()).length;
  if (files === 0) return undefined;
  const siteDir = join(dir, IG_API_SITE);
  const site = existsSync(siteDir) && statSync(siteDir).isDirectory() ? { site: siteDir } : {};
  const desc = join(dir, IG_API_DESCRIPTOR);
  if (!existsSync(desc)) return { sidecars, files, ...site };
  const d = JSON.parse(readFileSync(desc, "utf-8")) as { label?: unknown; placeholder?: unknown };
  if (d.label !== undefined && (typeof d.label !== "string" || d.label.trim() === "")) throw new Error(`${desc}: "label" must be a non-empty string`);
  if (d.placeholder !== undefined && (typeof d.placeholder !== "string" || d.placeholder.trim().length < 8)) throw new Error(`${desc}: "placeholder" must be a marker string of at least 8 characters`);
  return {
    sidecars,
    files,
    ...(typeof d.label === "string" ? { label: d.label.trim() } : {}),
    ...(typeof d.placeholder === "string" ? { placeholder: d.placeholder } : {}),
    ...site,
  };
}

/**
 * Whether the build may go on with an AST of this verdict (`ig-build-pipeline`
 * rule 2). Valid goes on. Anything else is refused, except that a stale or
 * cannot-tell AST is accepted for a PREVIEW unless the caller refuses it; the
 * root never is. Pure.
 */
export function astGate(verdict: string, o: { acceptStale: boolean; preview: boolean }): { ok: boolean; said: string } {
  if (verdict === "valid") return { ok: true, said: "the AST is valid for this checkout" };
  if (o.acceptStale && o.preview) return { ok: true, said: `the AST is ${verdict}; accepted for this preview (a preview may use a stale AST; ${ACCEPT_STALE_ENV}=0 refuses it)` };
  const why = o.preview ? `${ACCEPT_STALE_ENV}=0 makes this preview refuse a stale AST` : `a stale AST is accepted for a preview only, and this build is the root: refresh the cache (the IG's Site publish, or fhir-harness/scripts/ig-ast-build.sh then ig-cache.sh seed --push)`;
  return { ok: false, said: `the AST is ${verdict}: the site is not built from it (${why}). It does not fall back to a Publisher run or the Publisher's HTML` };
}

/** Whether the site build is building a preview: its base path is `/<repo>/branches/<branch>` (or the old `/<repo>/branches/<branch>`). */
export function isPreviewBase(baseurl: string | undefined): boolean {
  return baseurl !== undefined && new RegExp(`/${PREVIEW_PREFIX_ALT}/`).test(`${baseurl}/`);
}

/**
 * `ast`: restore the IG's AST from its cache branch into the checkout, and
 * judge it. Throws, saying why, when there is no cache or the gate refuses.
 */
export function restoreAst(o: { ig: string; work?: string; acceptStale: boolean; preview: boolean; log?: (s: string) => void }): AstValidity {
  const log = o.log ?? ((s: string) => console.error(s));
  const ig = resolve(o.ig);
  if (!existsSync(igReadScope(ig, { warn: log }).path("sushi-config.yaml"))) throw new Error(`${ig} holds no sushi-config.yaml: not an IG checkout`);
  // The commit restored, for pages that read the AST by URL ({@link astRawBase}).
  // Cleared first: a restore that keeps an AST already in the checkout records none.
  const record = o.work ? join(o.work, AST_SOURCE_FILE) : undefined;
  if (record) mkdirSync(o.work!, { recursive: true });
  const restore = (): AstValidity => {
    if (record) rmSync(record, { force: true });
    const r = spawnSync("bash", [join(import.meta.dir, "ig-cache.sh"), "restore", "--ig-root", ig, ...(record ? ["--record", record] : [])], { cwd: ig, stdio: ["ignore", "inherit", "inherit"] });
    if (r.status !== 0) {
      throw new Error(`no AST to build from: ig-cache.sh restore exited ${r.status}${r.status === 1 ? " (no cache branch for this IG; run its Site publish, whose `ast` job seeds it)" : ""}. The site is never built from the Publisher's HTML`);
    }
    return astValidity(readAst(join(ig, AST_DIR)), ig);
  };
  const had = existsSync(join(ig, AST_DIR));
  let v = restore();
  // `restore` keeps an AST already in the checkout. One that is not valid may be
  // an older restore or a local build, not the cache branch: judge the branch's.
  if (had && v.verdict !== "valid") {
    log(`ast: the AST already in the checkout is ${v.verdict}; restoring the cache branch's in its place`);
    rmSync(join(ig, AST_DIR), { recursive: true, force: true });
    v = restore();
  }
  if (o.work) {
    mkdirSync(o.work, { recursive: true });
    writeFileSync(join(o.work, VALIDITY_FILE), `${JSON.stringify(v, null, 2)}\n`);
  }
  const g = astGate(v.verdict, o);
  if (!g.ok) throw new Error(g.said);
  log(`ast: ${g.said} (built from ${v.recorded?.sourceRevision?.slice(0, 7) ?? "an unrecorded revision"} by ${v.recorded?.toolchain ?? "an unrecorded toolchain"})`);
  return v;
}

/**
 * What each artefact's own JSON states about itself — its `meta.profile` and
 * its `code` concept — copied into the index from the Publisher's
 * `<Type>-<id>.json` in `output/`, as `ast-to-artifact-index` copies them
 * from the AST. Nothing is looked up. The index node carries them
 * (`statedFacts`), so the artifacts page can show an instance's profile and
 * code, and a profile's examples view (owner, 2026-10-14: "3. Render them
 * too") can list what claims it. Returns how many artefacts state either.
 */
export function stateFromOutput(indexFile: string, output: string): number {
  const ix = JSON.parse(readFileSync(indexFile, "utf-8")) as { artifacts: { resourceType: string; id: string; canonical?: string; profiles?: string[]; code?: unknown }[] };
  let stated = 0;
  for (const a of ix.artifacts) {
    const f = join(output, `${a.resourceType}-${a.id}.json`);
    if (!existsSync(f)) continue;
    let r: Parameters<typeof profilesOf>[0];
    try {
      r = JSON.parse(readFileSync(f, "utf-8")) as Parameters<typeof profilesOf>[0];
    } catch {
      continue;
    }
    const profiles = a.profiles ?? profilesOf(r);
    const code = a.code ?? conceptOf(r);
    if (profiles) a.profiles = profiles;
    if (code) a.code = code;
    if (profiles || code) stated += 1;
  }
  writeFileSync(indexFile, `${JSON.stringify(ix, null, 2)}\n`);
  return stated;
}

/**
 * The IG's artefact pages, THIN (`ig-render-jekyll` §"Thin pages, the
 * default"), from the AST — never the Publisher's output or its finished HTML
 * (owner, 2026-10-14: "I DO NOT WANT THE IG PUBLISHER HTML"). The artefact
 * index is derived from the AST (`ast-to-artifact-index.ts`), keeping the
 * grouping of the IG's committed `fhir-artifact-index/index.json` when it holds
 * one (the AST stops before the Publisher assigns categories), with the IG API
 * sidecars bound when a layer above left any. Then `gen-ig-pages.ts` writes one
 * thin page and one JSON-LD node per artefact plus the index node the site's
 * thin `artifacts.html` and `toc.html` draw. Returns the layer directory the
 * pages and the index are in.
 */
export function astArtefactPages(o: { ig: string; ast: string; work: string; siteWork?: string; name: string; label: string; igApi?: IgApi; log: (s: string) => void }): string {
  if (!existsSync(join(o.ast, "manifest.json"))) {
    throw new Error(`${o.ast}: no AST — run ${IG_SITE_SCRIPTS.ast} first. The site is never built from the Publisher's output`);
  }
  const inst = join(o.work, "artefacts", o.name);
  const index = join(inst, INDEX_SERVED, "index.json");
  mkdirSync(dirname(index), { recursive: true });
  const bun = (script: string, args: string[]): void => {
    const r = spawnSync("bun", ["run", join(import.meta.dir, script), ...args], { cwd: o.ig, encoding: "utf-8" });
    if (r.status !== 0) throw new Error(`${script} failed (exit ${r.status}):\n${`${r.stderr}\n${r.stdout}`.trim().split("\n").slice(-15).join("\n")}`);
    for (const l of `${r.stdout}`.trim().split("\n").filter(Boolean).slice(0, 12)) o.log(`  ${l}`);
  };
  // Relative to the IG: each artefact's `localPath` is then `output-ast/resources/...`;
  // the pages point at the resource's root name instead (`AST_DATA`).
  const args = ["--ast", relative(o.ig, o.ast) || ".", "--instance-id", o.name, "--out", index];
  const published = join(o.ig, INDEX_SERVED, "index.json");
  if (existsSync(published)) args.push("--compare", published, "--keep-published-grouping", "--report", join(o.work, "ast-parity.json"));
  if (o.igApi) args.push("--sidecars", o.igApi.sidecars, "--sidecars-local", SIDECARS_SERVED, ...(o.igApi.rawBase ? ["--sidecars-base", `${o.igApi.rawBase}/sidecars`] : []));
  bun("ast-to-artifact-index.ts", args);
  // The resources by raw URL at the restored cache commit when `ast` recorded
  // one (fhir-harness#325), else each copied to the site root (`AST_DATA`).
  // The SITE BUILD's work directory, where `ast` recorded the commit, not
  // compose's own scratch `work` (the first preview build read the scratch one,
  // found no record, and pointed the pages at root copies publisher-pages never wrote).
  const raw = astRawBase(o.siteWork);
  // The JSON-LD nodes name the root `<Type>-<id>.json` publisher-pages serves (fhir-harness#359).
  const rootResources = rootResourcesFromEnv();
  // The AST versions behind that commit, for each resource's History view
  // (#329), left in the site build's work directory for publisher-pages to serve.
  const src = astSource(o.siteWork);
  const history = src ? readAstHistory({ ig: o.ig, ...src }) : undefined;
  if (o.siteWork) {
    if (history) writeFileSync(join(o.siteWork, AST_HISTORY_WORK), `${JSON.stringify(history, null, 2)}\n`);
    else rmSync(join(o.siteWork, AST_HISTORY_WORK), { force: true });
  }
  if (src) o.log(history ? `artefact pages: ${history.versions.length} AST version(s) for the History view, ${history.versions.filter((v) => v.tags).length} of them tagged` : `artefact pages: the AST versions could not be read; no History view`);
  o.log(raw ? `artefact pages: the resources are read from ${raw} (the AST cache commit), not copied into the site` : `artefact pages: the resources are served at the site root as <Type>-<id>.json`);
  bun("gen-ig-pages.ts", [
    "--instance", inst, "--index", index, "--label", o.label, "--ig-site", "--compiled-data", raw ?? AST_DATA, "--search",
    ...(rootResources ? ["--root-resources"] : []),
    ...(history ? ["--ast-history", `../${AST_HISTORY_FILE}`, "--ast-repository", src!.repository] : []),
    ...(o.igApi ? ["--ig-api-served", ...(o.igApi.label ? ["--sidecar-label", o.igApi.label] : [])] : []),
  ]);
  return inst;
}

/**
 * The PlantUML jar `compose` renders `input/images-source/*.plantuml` with:
 * the one given, else `PLANTUML_JAR`, else the cached copy of the pinned
 * release, when it is there. Undefined: the diagrams carry a visible "not
 * rendered" marker, as `stageIgSite` reports.
 */
export const PLANTUML_VERSION = "1.2026.9";
export function plantumlJarFor(given: string | undefined, env: Record<string, string | undefined>, home: string): string | undefined {
  for (const j of [given, env.PLANTUML_JAR, join(home, ".cache", "plantuml", `plantuml-${PLANTUML_VERSION}.jar`)]) {
    if (j && existsSync(j) && statSync(j).size > 0) return j;
  }
  return undefined;
}

/** Fetch the pinned PlantUML release into the cache, as the IG repository recipe did; undefined when it cannot. */
function fetchPlantuml(home: string, log: (s: string) => void): string | undefined {
  const jar = join(home, ".cache", "plantuml", `plantuml-${PLANTUML_VERSION}.jar`);
  mkdirSync(dirname(jar), { recursive: true });
  const url = `https://repo1.maven.org/maven2/net/sourceforge/plantuml/plantuml/${PLANTUML_VERSION}/plantuml-${PLANTUML_VERSION}.jar`;
  const r = spawnSync("curl", ["-sSfL", "--retry", "3", "-o", jar, url], { stdio: ["ignore", "ignore", "pipe"] });
  if (r.status === 0 && existsSync(jar) && statSync(jar).size > 0) return jar;
  rmSync(jar, { force: true });
  log(`plantuml: could not fetch ${url} (${r.stderr?.toString().trim() || `exit ${r.status}`}); diagrams are marked "not rendered"`);
  return undefined;
}

/**
 * Copy the IG's source into `src` for staging, and return what was copied.
 *
 * A repository that declares `contentTypes.ig` gets exactly its `include`
 * entries that exist, and its `index.config.json`, so the staged copy keeps
 * the declaration every later reader checks. One that declares none is
 * copied whole, less {@link notSource}, as before.
 */
export function copyIgSource(ig: string, src: string, scope: IgReadScope = igReadScope(ig)): string[] {
  if (!scope.legacy) return copyDeclared(scope, src);
  const skip = notSource(ig);
  const top = readdirSync(ig).filter((e) => !skip.has(e));
  for (const e of top) cpSync(join(ig, e), join(src, e), { recursive: true });
  return top;
}

/**
 * The injection gate for one compose (`ig-content-qa.ts`). A missing or stale
 * review refuses every publish, previews included (owner, 2026-11-10, card
 * Q-INJ-1 "B: previews refuse too"). `IG_CONTENT_QA_ACCEPT_UNREVIEWED=1`
 * accepts one for a local build only (`stage-local-ig`), and the QA page says
 * so. Nothing accepts a pattern hit or an open finding. Throws on a refusal,
 * naming each text.
 */
export function contentQaGate(o: { ig: string; ast: string; scope: IgReadScope; work?: string; env?: Record<string, string | undefined>; log: (s: string) => void }): ContentQaVerdict {
  const accept = (o.env ?? process.env)[ACCEPT_UNREVIEWED_ENV] === "1";
  return runGate({ ig: o.ig, ast: o.ast, scope: o.scope, acceptUnreviewed: accept, ...(o.work ? { work: o.work } : {}), log: o.log });
}

/** Whether the IG has PlantUML sources to render. */
function hasPlantuml(ig: string): boolean {
  const d = join(ig, "input", "images-source");
  const scope = igReadScope(ig);
  return scope.reaches("input/images-source") && existsSync(d) && readdirSync(d).some((f) => f.endsWith(".plantuml") && scope.declares(`input/images-source/${f}`));
}

export function compose(o: { docs: string; ig: string; baseurl: string; ast?: string; work?: string; plantumlJar?: string; log?: (s: string) => void }): void {
  const log = o.log ?? ((s: string) => console.error(s));
  const ig = resolve(o.ig);
  const scope = igReadScope(ig, { warn: log });
  if (!existsSync(scope.path("sushi-config.yaml"))) throw new Error(`${ig} holds no sushi-config.yaml: not an IG checkout`);
  if (!existsSync(o.docs)) throw new Error(`${o.docs}: no host site source to compose into`);
  const name = siteName(ig);
  const work = mkdtempSync(join(tmpdir(), "ig-repo-site-"));
  try {
    const src = join(work, "src");
    mkdirSync(src, { recursive: true });
    const copied = copyIgSource(ig, src, scope);
    log(`${name}: ${scope.legacy ? `source copied whole (no contentTypes.ig), ${copied.length} top-level entr${copied.length === 1 ? "y" : "ies"}` : `source copied from contentTypes.ig.include: ${copied.join(", ")}`}`);
    const menu = buildMenu(ig, new Date().toISOString().slice(0, 10));
    log(`${name}: menu read from sushi-config.yaml at build time — ${menu.groups.length} group(s)`);
    const theme = topMountPalette(ig);
    log(theme.note);
    const gh = githubRepo(ig);
    const editBase = gh ? githubEditBase(gh) : undefined;
    const site = join(work, "site");
    const baseurl = o.baseurl.replace(/\/$/, "");
    const label = igTitle(ig) ?? name;
    const ast = resolve(o.ast ?? join(ig, AST_DIR));
    // The injection gate (fhir-harness#330), before anything is staged: a
    // pattern hit, an open finding, or a missing or stale agent review refuses.
    const content = contentQaGate({ ig, ast, scope, ...(o.work ? { work: o.work } : {}), log });
    const igApi = siteIgApi(o.work, ast);
    log(
      igApi
        ? `${name}: ${igApi.files} IG API sidecar file(s) ${igApi.rawBase ? `read from the AST cache commit (${igApi.rawBase}), not copied into the site` : "left by a layer above"}${igApi.label ? `, called "${igApi.label}"` : ""}`
        : `${name}: no IG API sidecars in the AST cache or the work directory — none bound`,
    );
    const inst = astArtefactPages({ ig, ast, work, ...(o.work ? { siteWork: o.work } : {}), name, label, ...(igApi ? { igApi } : {}), log });
    if (o.work) {
      // For `publisher-pages`, which serves the index the pages were drawn from.
      mkdirSync(join(o.work, INDEX_WORK), { recursive: true });
      cpSync(join(inst, INDEX_SERVED, "index.json"), join(o.work, INDEX_WORK, "index.json"));
    }
    const plantumlJar = plantumlJarFor(o.plantumlJar, process.env, homedir()) ?? (hasPlantuml(ig) ? fetchPlantuml(homedir(), log) : undefined);
    const annexes = annexesFor(ig, log);
    // The QA report the footer's "QA Report" links: the FHIR QA the build
    // holds and the knowledge graph's, on one page (`ig-qa-page.ts`).
    // In each locale the IG translates its pages into, the Publisher's messages
    // in its own translations first, then this layer's (`ig-publisher-i18n.ts`).
    const qaLocales = pageLocales(join(ig, "translations")).map((l) => l.locale);
    const qa = buildQaPage({
      root: ig,
      ast,
      content,
      ...(o.work ? { validity: join(o.work, VALIDITY_FILE) } : {}),
      ...(qaLocales.length ? { i18n: { locales: qaLocales, cache: join(homedir(), ".fhir", "publisher-i18n") } } : {}),
    });
    if (qa.i18n) log(`${name}: QA report languages — ${qa.i18n}`);
    const astRaw = astRawBase(o.work);
    const r = stageIgSite(src, site, {
      baseurl,
      menu,
      // The IG's pages loop site.data.canonicals and site.data["<Type>-<id>"]: drawn from the same AST.
      ast,
      // The form pages read each Questionnaire's AST file at the cache commit, as the artefact pages do.
      ...(astRaw ? { astRaw } : {}),
      artifacts: artifactsFor(inst, "artifact/"),
      footer: footerFor(inst, ""),
      ...(theme.palette ? { palette: theme.palette } : {}),
      ...(plantumlJar ? { plantumlJar } : {}),
      ...(editBase ? { editBase } : {}),
      // The IG's own annexes (`ig-annex` directories it declares), as an
      // index's IG site places them (stage-ig-sites.ts).
      ...(annexes ? { annexes } : {}),
      // A checkout with an OpenAPI graph gets its `openapi/` pages from
      // `ig-site:openapi`, a later step that refuses a path the site holds,
      // so the IG's own `input/images/openapi/` (the Publisher's Swagger UI)
      // is not published over them.
      ...(igOpenapiGraph(ig) ? { reservedPaths: [{ prefix: `${OPENAPI_DIR}/`, by: "ig-site:openapi" }] } : {}),
      search: true,
      qaPage: qa.page,
      qaPages: qa.pages,
    });
    log(`${name}:\n${describeStage(r)}`);
    if (r.qa === "written") {
      const n = publishQaAssets(qa, site);
      log(`${name}: QA report — FHIR QA ${qa.fhir.publisher ? "with" : "without"} the Publisher's summary; KG QA over ${qa.kg.instances.length} instance(s), ${n} record(s)`);
    }
    // The artefact pages draw the footer from JSON after load: the same
    // footer as every other page, links decided once (`igSiteFooter`).
    const footerData = join(inst, "docs", "assets", "ig-footer.json");
    if (existsSync(footerData)) {
      const { stylesheets: _s, scope: _c, ...data } = r.footer;
      writeFileSync(footerData, `${JSON.stringify(data, null, 2)}\n`);
    }
    if (r.siteData.refused.length) throw new Error(`${name}: the IG's site data was refused (${r.siteData.refused.join(", ")})`);
    const d = copyDocsInto(join(inst, "docs"), site);
    log(`${name}: ${d.copied} artefact page and node file(s) built into the site${d.merged.length ? `; front matter laid onto ${d.merged.join(", ")}` : ""}`);
    if (d.collisions.length) throw new Error(`${name}: ${d.collisions.length} artefact file(s) the IG's own pages already write — refusing two answers for one URL:\n  ${d.collisions.slice(0, 20).join("\n  ")}`);
    const before = new Set(filesUnder(resolve(o.docs)));
    const c = composeIgSite(site, resolve(o.docs), name, { atRoot: true, siteBase: baseurl });
    listUpstream(filesUnder(resolve(o.docs)).filter((f) => !before.has(f)).map(builtPage).filter((p): p is string => p !== undefined));
    log(`${name}: composed at the site root — ${c.pages} page(s), ${c.files - c.pages} other file(s), ${c.includes} include(s)`);
    // The thin layout links the shared thin-page stylesheet, which the artefact
    // page generator writes when a layer has one; here nothing else does.
    const thinCss = join(resolve(o.docs), IG_THIN_CSS_FILE);
    if (!existsSync(thinCss)) {
      mkdirSync(join(thinCss, ".."), { recursive: true });
      cpSync(THIN_CSS_SOURCE, thinCss);
    }
    if (c.collisions.length) throw new Error(`${name}: ${c.collisions.length} path(s) the host source already holds — refusing two answers for one URL:\n  ${c.collisions.slice(0, 20).join("\n  ")}`);
    const s = writeSearch(resolve(o.docs), site, JSON.parse(readFileSync(join(inst, INDEX_SERVED, "index.json"), "utf-8")) as FhirArtifactIndex);
    log(`${name}: search over ${s.pages} page(s) and ${s.artifacts} artefact(s) at ${IG_SEARCH_INDEX_FILE} (${Math.round(s.bytes / 1024)} KB, fetched on the first search)${s.fromNode ? `; the artefacts are read from ${ARTIFACT_DIR}/${ARTIFACT_INDEX_FILE}, not copied` : ""}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/**
 * The IG's search under the docs root: the index of the staged site's pages
 * and the artefact index's artefacts, and the client every box loads
 * (`ig-search.ts`). When the site serves the artefact index node
 * (`artifact/index.jsonld`, in the staged site or the docs root), the search
 * index names it and the client reads the artefacts from it, rather than a
 * second list of them being written here (`fromNode`). A path the host
 * source already holds is refused, as every other file `compose` writes is.
 */
export function writeSearch(docs: string, staged: string, ix: Pick<FhirArtifactIndex, "artifacts">): { pages: number; artifacts: number; bytes: number; fromNode: boolean } {
  const pages = pageSearchEntries(staged);
  const node = join(ARTIFACT_DIR, ARTIFACT_INDEX_FILE);
  const fromNode = existsSync(join(staged, node)) || existsSync(join(docs, node));
  const artifacts = fromNode ? IG_SEARCH_ARTIFACTS_NODE : artifactSearchEntries(ix.artifacts);
  const body = `${JSON.stringify(igSearchIndex(pages, artifacts))}\n`;
  for (const [rel, text] of [[IG_SEARCH_INDEX_FILE, body], [IG_SEARCH_SCRIPT_FILE, readFileSync(IG_SEARCH_SCRIPT_SOURCE, "utf-8")]] as const) {
    const to = join(docs, rel);
    if (existsSync(to)) throw new Error(`${rel}: the host source already holds it — refusing two answers for one URL`);
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, text);
  }
  return { pages: pages.length, artifacts: ix.artifacts.length, bytes: Buffer.byteLength(body), fromNode };
}

/**
 * The language picker's block (`fa-translation-meta`) on every page of the
 * built site that lacks one: the block the platform writes on a page Jekyll
 * never laid out (cat-harness-tools `lib/translation-meta.ts`), from the IG
 * checkout's translation declaration (the six UN languages, source `en`,
 * when it declares none). A page with its own block, or with no `<head>`, is
 * left as it is. Returns how many pages were given one.
 */
export function stampTranslationMeta(site: string, ig: string): number {
  const block = translationMetaBlock(ig);
  let n = 0;
  for (const f of filesUnder(site)) {
    if (!/\.html?$/i.test(f)) continue;
    const abs = join(site, f);
    const html = readFileSync(abs, "utf-8");
    if (isRedirectStub(html)) continue;
    const after = withTranslationMeta(html, block);
    if (after !== html) {
      writeFileSync(abs, after);
      n++;
    }
  }
  return n;
}

/**
 * The IG's SLIM bar on every page of the built site that does not carry the
 * composed pages' full bar (`ig-search.ts` {@link withIgBar}): the IG's name
 * linked home, the search box and the language picker's slot
 * ({@link igFallbackBar}). It replaces the thin artefact and list pages' own
 * header and is given to pages that a layer above or below wrote with none
 * (an IG API hub page, the OpenAPI pages), with the shared page layout and
 * the IG's stylesheet linked. Owner, 2026-10-15: "please consolidate
 * behaviours/appearance", then "keep slim". The full menu, inlined, would
 * cost every one of some two thousand pages about 2.5 KB. Paths are relative
 * to each page, so it works under any base. Nothing is stamped under
 * `assets/` (vendored tools' own pages), and nothing at all when the site
 * serves no search index, so no page names a file the site does not hold.
 * Returns how many pages were changed.
 */
export function stampIgBar(site: string, label: string): { pages: number } {
  if (!existsSync(join(site, IG_SEARCH_INDEX_FILE))) return { pages: 0 };
  let n = 0;
  for (const f of filesUnder(site)) {
    if (!/\.html?$/i.test(f) || f.startsWith("assets/")) continue;
    const up = "../".repeat(f.split("/").length - 1);
    const abs = join(site, f);
    const html = readFileSync(abs, "utf-8");
    if (isRedirectStub(html)) continue;
    const after = withIgBar(html, { ref: { index: `${up}${IG_SEARCH_INDEX_FILE}`, script: `${up}${IG_SEARCH_SCRIPT_FILE}` }, label, home: `${up}index.html`, up });
    if (after !== html) {
      writeFileSync(abs, after);
      n++;
    }
  }
  return { pages: n };
}

/**
 * An immediate meta-refresh redirect stub (a view's old file name,
 * `ig-thin-pages.ts` `thinViewRedirect`): not a page a reader stays on, so
 * it gets no bar and no language block, as the platform gives it no rail.
 */
export function isRedirectStub(html: string): boolean {
  return /<meta\s[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*content\s*=\s*["']?\s*0\s*[;,]\s*url\s*=/i.test(html);
}

/** The config block ids of the IG's thin pages: an artefact's page, the artifacts/toc lists, the IG API hub. */
export const IG_THIN_CONFIG_IDS: readonly string[] = [THIN_PAGE_CONFIG_ID, THIN_INDEX_CONFIG_ID, IG_API_HUB_CONFIG_ID];
const TOC_NAV_RE = /<script type="application\/json" data-fa-visualiser-nav>[\s\S]*?<\/script>/;
const TOC_LABEL_RE = /<meta name="fa-visualiser-label" content="[^"]*">/;

/**
 * The IG's TOC in the rail on its THIN pages too (owner, 2026-11-02: "the LHS
 * navbar should have TOC ... some pages have it but not artifact. why?").
 *
 * The rail's IG section is DECLARED (`igTocNav`), and only the layout the
 * IG's narrative pages wear writes it. The thin pages (`artifacts.html`,
 * `toc.html`, every `artifact/*.html`, the IG API hub) are finished HTML that
 * never pass through that layout, and they draw their content by script, so
 * the rail found no section on them and drew none.
 *
 * This copies the declaration and its label, read off a built page that has
 * them (`index.html` first), into each thin page that lacks one, before the
 * rail pass reads it. Only pages carrying one of {@link IG_THIN_CONFIG_IDS},
 * or an artefact page that declares its node ({@link isArtifactPage}), are touched: a page of anybody else's keeps its own section. No page with
 * the declaration, nothing to copy and nothing stamped.
 */
export function stampIgTocNav(site: string): { pages: number } {
  const all = filesUnder(site).filter((f) => /\.html?$/i.test(f) && !f.startsWith("assets/"));
  let nav: string | undefined;
  let label: string | undefined;
  for (const f of ["index.html", ...all.filter((x) => x !== "index.html")]) {
    if (!existsSync(join(site, f))) continue;
    const html = readFileSync(join(site, f), "utf-8");
    const m = TOC_NAV_RE.exec(html);
    if (!m) continue;
    nav = m[0];
    label = TOC_LABEL_RE.exec(html)?.[0];
    break;
  }
  if (!nav) return { pages: 0 };
  const thin = new RegExp(`<script type="application/json" id="(?:${IG_THIN_CONFIG_IDS.join("|")})">`);
  let n = 0;
  for (const f of all) {
    const abs = join(site, f);
    const html = readFileSync(abs, "utf-8");
    if (!(thin.test(html) || isArtifactPage(html)) || TOC_NAV_RE.test(html)) continue;
    const at = html.search(/<\/head>/i);
    if (at < 0) continue;
    const add = `${label && !TOC_LABEL_RE.test(html) ? `${label}\n` : ""}${nav}\n`;
    writeFileSync(abs, html.slice(0, at) + add + html.slice(at));
    n++;
  }
  return { pages: n };
}

/** Every file under `dir`, relative to it, `/`-separated. */
function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out.push(relative(dir, p).split(sep).join("/"));
    }
  };
  walk(dir);
  return out;
}

/**
 * The platform commit a site was built with: the `cat-harness-tools` mount
 * `index.lock.json` pins (the toolset that draws the chrome), else the first
 * mount it pins. A checkout that only mounts layers has no platform checkout
 * of its own to ask `git` about.
 */
export function platformCommit(root: string): string | undefined {
  const lock = join(root, "index.lock.json");
  if (!existsSync(lock)) return undefined;
  const mounts = ((JSON.parse(readFileSync(lock, "utf-8")) as { mounts?: { harness?: unknown; ref?: unknown }[] }).mounts ?? []).filter((m) => typeof m.ref === "string" && m.ref !== "");
  return (mounts.find((m) => m.harness === "cat-harness-tools") ?? mounts[0])?.ref as string | undefined;
}

/**
 * The site's `folio-build.json` (`site-build-stamp.ts`): what built it, read
 * from the runner's environment and, where that is silent (an agent's own
 * run), from the checkout. Every folio site carries one at its root, and the
 * publisher's root guard recognises a folio site by it, so a bare IG deploy
 * never overwrites this one.
 */
export function igSiteStamp(ig: string, env: Record<string, string | undefined> = process.env, now = new Date()): SiteBuild {
  const git = (...a: string[]): string | undefined => {
    const r = spawnSync("git", ["-C", ig, ...a], { encoding: "utf-8" });
    return r.status === 0 ? r.stdout.trim() || undefined : undefined;
  };
  const platform = platformCommit(ig) ?? git("rev-parse", "HEAD");
  if (!platform) throw new Error(`${ig}: no index.lock.json pin and no git commit to name the platform this site was built with`);
  const repo = /github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(git("config", "--get", "remote.origin.url") ?? "")?.[1];
  return siteBuild(siteName(ig), platform, {
    GITHUB_REPOSITORY: env.GITHUB_REPOSITORY ?? repo,
    GITHUB_REF_NAME: env.GITHUB_REF_NAME ?? git("rev-parse", "--abbrev-ref", "HEAD"),
    GITHUB_SHA: env.GITHUB_SHA ?? git("rev-parse", "HEAD"),
  }, now);
}

/**
 * The IG Publisher's page chrome: its stylesheets (`fhir.css`,
 * `bootstrap-fhir.css`) and its "Generated <date>" footer. A page carrying
 * any of them is the Publisher's finished HTML, which this site never
 * publishes (owner, 2026-10-14).
 */
export const PUBLISHER_CHROME: readonly RegExp[] = [
  /<link\b[^>]*href="(?:[^"]*\/)?fhir\.css"/i,
  /bootstrap-fhir\.css/i,
  /Generated <span title="/,
];

/** The built pages that carry the Publisher's chrome, relative to the site. */
export function publisherChromePages(site: string): string[] {
  return filesUnder(site).filter((p) => /\.html?$/i.test(p) && PUBLISHER_CHROME.some((re) => re.test(readFileSync(join(site, p), "utf-8"))));
}

/** What `publisher-pages` put in the site. */
export interface ServedData {
  /** Resources served at the root under the Publisher's name, `<Type>-<id>.json`, the one copy the pages draw. */
  named: number;
  /** Root paths the site already held, so the AST's copy was not laid over them (the pages show the site's file). */
  kept: number;
  /** IG API sidecar files served under `fhir-artifact-index/sidecars/`. */
  sidecars: number;
  /** Files the layer above wrote for the site root, served; and those the site already held, not laid over. */
  siteFiles: number;
  siteKept: string[];
  /** Pages of the IG's own that held the layer's placeholder, replaced by the layer's file. */
  siteFilled: string[];
  /** Whether the artefact index is served at `fhir-artifact-index/index.json`. */
  index: boolean;
  /** Libraries served with their CQL by URL and no ELM ({@link libraryByUrl}). */
  librariesByUrl?: number;
  /** Whether the AST versions are served for the History view ({@link AST_HISTORY_FILE}). */
  history?: boolean;
  /** Whether the root copies are reduced ({@link reduceForSite}): the pages read the full ones by URL. */
  reduced?: boolean;
  /** The bytes of the reduced root copies written. */
  rootBytes?: number;
  /** Root names that differ from another only by case: one file on a case-insensitive file system, as with the IG Publisher. */
  caseCollisions?: string[];
}

/** Whether an attachment's content type is compiled logic (ELM), by its name. */
const isElm = (contentType: unknown): boolean => typeof contentType === "string" && /elm/i.test(contentType);

/**
 * A resource as the site serves it at its root (owner, 2026-11-10, card "C";
 * fhir-harness#359): its generated narrative (`text`, also of each contained
 * resource) removed, since the artefact pages render it from the full copy,
 * and each Library attachment of compiled logic (a contentType naming `elm`)
 * without its `data`. The attachment entry stays, with `url` set to `fullUrl`,
 * the AST cache's full copy of the resource, when there is one, so the ELM is
 * still reachable. The CQL (`text/cql`) is a link too (owner, 2026-11-10: "Cql
 * link"): its `data` goes and `url` is `cqlUrl`, the IG's own `.cql` source,
 * or else `fullUrl`; with neither, the CQL stays inline, never dropped.
 * Written minified by the caller. The full copy is the AST cache's and the
 * release's `package.tgz`. Pure.
 */
export function reduceForSite(resource: Record<string, unknown>, fullUrl?: string, cqlUrl?: string): Record<string, unknown> {
  const strip = (r: Record<string, unknown>): Record<string, unknown> => {
    const { text: _text, ...rest } = r;
    return rest;
  };
  const out = strip(resource);
  if (Array.isArray(out["contained"])) out["contained"] = (out["contained"] as unknown[]).map((c) => (c && typeof c === "object" ? strip(c as Record<string, unknown>) : c));
  if (out["resourceType"] === "Library" && Array.isArray(out["content"])) {
    out["content"] = (out["content"] as Record<string, unknown>[]).map((c) => {
      if (!c || typeof c !== "object" || c["data"] === undefined) return c;
      if (isElm(c["contentType"])) {
        const { data: _data, ...rest } = c;
        return fullUrl ? { ...rest, url: fullUrl } : rest;
      }
      const link = cqlUrl ?? fullUrl;
      if (c["contentType"] === "text/cql" && link) {
        const { data: _data, ...rest } = c;
        return { ...rest, url: link };
      }
      return c;
    });
  }
  return out;
}

/** Copy a file into the site unless the site already holds that path. */
function serve(from: string, site: string, rel: string): boolean {
  const to = join(site, rel);
  if (existsSync(to)) return false;
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
  return true;
}

/** Where a Library's CQL is read from: the IG's `input/cql/` and the URL each file is published at. */
export interface CqlSource {
  dir: string;
  url: (file: string) => string;
}

/** The compiled-logic content types a docs-site Library leaves out: the ELM ships in the release package. */
export const ELM_CONTENT_TYPES: ReadonlySet<string> = new Set(["application/elm+xml", "application/elm+json"]);

/** The IG's `.cql` source of a Library, by its name or id, when the IG holds it. */
function cqlFileOf(r: { name?: unknown; id?: unknown }, cql: CqlSource): string | undefined {
  return [r.name, r.id].filter((x): x is string => typeof x === "string" && /^[A-Za-z0-9._-]+$/.test(x)).map((n) => `${n}.cql`).find((f) => existsSync(join(cql.dir, f)));
}

/** The URL of a Library's `.cql` source, when the IG holds it. */
export function cqlFileUrl(r: { name?: unknown; id?: unknown }, cql: CqlSource): string | undefined {
  const file = cqlFileOf(r, cql);
  return file === undefined ? undefined : cql.url(file);
}

/**
 * A Library as the docs site serves it (owner, 2026-11-08, card "ELM", option
 * A: reference the CQL from the KG). The compiled ELM (`application/elm+xml`,
 * `application/elm+json`, about 80% of each file as base64) is left out, and
 * the CQL is an `Attachment.url` to the CQL source the IG holds instead of
 * base64 `data`, so a viewer loads it on demand. CQL whose source file the IG
 * does not hold is kept inline, never dropped. Undefined: not a Library, or
 * nothing to change.
 */
export function libraryByUrl(resource: unknown, cql: CqlSource): object | undefined {
  const r = resource as { resourceType?: string; id?: string; name?: string; content?: Array<{ contentType?: string; data?: string; url?: string }> };
  if (r?.resourceType !== "Library" || !Array.isArray(r.content)) return undefined;
  const file = cqlFileOf(r, cql);
  let changed = false;
  const content = r.content.flatMap((c) => {
    if (c.contentType && ELM_CONTENT_TYPES.has(c.contentType)) {
      changed = true;
      return [];
    }
    if (c.contentType === "text/cql" && c.data !== undefined && file !== undefined) {
      changed = true;
      const { data: _data, ...rest } = c;
      return [{ ...rest, url: cql.url(file) }];
    }
    return [c];
  });
  return changed ? { ...r, content } : undefined;
}

/**
 * Serve the AST's data in the built site: each resource once, by the
 * Publisher's name at the root, the artefact index, and the IG API sidecars.
 * Never the Publisher's HTML, and never a path the site already holds. When
 * the pages read the resources by URL (`byUrl`), each root copy is reduced
 * ({@link reduceForSite}) and minified (fhir-harness#359). Otherwise it is
 * the pages' own copy, as the AST holds it; with `cql`, a Library is then
 * served by {@link libraryByUrl}: its CQL by URL, no ELM.
 */
export function serveAstData(o: {
  site: string;
  ast: string;
  index?: string;
  igApi?: IgApi;
  cql?: CqlSource;
  byUrl?: boolean;
  /** With `byUrl`: `false` serves no root copy ({@link ROOT_RESOURCES_ENV}); otherwise each is served reduced. */
  rootResources?: boolean;
  /** The AST cache commit's tree by raw URL: a reduced Library's ELM attachments point at the full copy there. */
  rawBase?: string;
  history?: string;
  indexRef?: Record<string, string>;
  warn?: (s: string) => void;
}): ServedData {
  const manifest = join(o.ast, "manifest.json");
  if (!existsSync(manifest)) throw new Error(`${o.ast}: no AST to serve — run ${IG_SITE_SCRIPTS.ast} first`);
  const out: ServedData = { named: 0, kept: 0, sidecars: 0, siteFiles: 0, siteKept: [], siteFilled: [], index: false };
  const m = JSON.parse(readFileSync(manifest, "utf-8")) as { resources?: { resourceType?: string; id?: string; file?: string }[] };
  // Read by URL from the AST cache commit ({@link astRawBase}): the root copy
  // is reduced, or with `rootResources: false` not served at all.
  const reduce = o.byUrl === true;
  if (reduce) out.reduced = true;
  const lower = new Map<string, string>();
  for (const r of reduce && o.rootResources === false ? [] : (m.resources ?? [])) {
    if (!r.file) continue;
    const src = join(o.ast, r.file);
    if (!existsSync(src)) continue;
    // The name from the resource itself, not the cache's file name (which may change, fhir-ig-publisher#13).
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(readFileSync(src, "utf-8")) as Record<string, unknown>;
    } catch {
      o.warn?.(`publisher pages: ${r.file} is not JSON; not served at the root`);
      continue;
    }
    const resourceType = typeof json["resourceType"] === "string" ? json["resourceType"] : r.resourceType;
    const id = typeof json["id"] === "string" ? json["id"] : r.id;
    if (!resourceType || !id) continue;
    const rel = rootResourceName({ resourceType, id });
    const seen = lower.get(rel.toLowerCase());
    if (seen !== undefined && seen !== rel) {
      (out.caseCollisions ??= []).push(`${seen} / ${rel}`);
      o.warn?.(`publisher pages: ${rel} and ${seen} differ only by case — one file on a case-insensitive file system (the IG Publisher has the same clash); both are served`);
    }
    lower.set(rel.toLowerCase(), rel);
    if (existsSync(join(o.site, rel))) {
      out.kept += 1;
      continue;
    }
    if (reduce) {
      const text = JSON.stringify(reduceForSite(json, o.rawBase ? `${o.rawBase}/${r.file.split("/").map(encodeURIComponent).join("/")}` : undefined, o.cql && resourceType === "Library" ? cqlFileUrl(json, o.cql) : undefined));
      writeFileSync(join(o.site, rel), text);
      out.named += 1;
      out.rootBytes = (out.rootBytes ?? 0) + Buffer.byteLength(text);
      continue;
    }
    serve(src, o.site, rel);
    out.named += 1;
    if (o.cql && resourceType === "Library") {
      const slim = libraryByUrl(JSON.parse(readFileSync(src, "utf-8")), o.cql);
      if (slim) {
        writeFileSync(join(o.site, rel), `${JSON.stringify(slim, null, 2)}\n`);
        out.librariesByUrl = (out.librariesByUrl ?? 0) + 1;
      }
    }
  }
  // With a pointer to the AST cache commit's copy (`indexRef.base`), the index
  // is read there and not served; the pointer is served either way.
  const cachedIndex = o.indexRef?.["base"] !== undefined;
  if (!cachedIndex && o.index && existsSync(o.index)) out.index = serve(o.index, o.site, join(INDEX_SERVED, "index.json"));
  if (o.indexRef && (cachedIndex || out.index)) {
    mkdirSync(join(o.site, INDEX_SERVED), { recursive: true });
    writeFileSync(join(o.site, INDEX_SERVED, INDEX_REF_FILE), `${JSON.stringify(o.indexRef, null, 2)}\n`);
  }
  if (o.history && existsSync(o.history)) out.history = serve(o.history, o.site, AST_HISTORY_FILE);
  if (o.igApi) {
    // Read by raw URL from the AST cache commit (`rawBase`): no sidecar is copied.
    const files = readdirSync(o.igApi.sidecars).filter((f) => statSync(join(o.igApi!.sidecars, f)).isFile()).sort();
    for (const f of o.igApi.rawBase ? [] : files) {
      if (serve(join(o.igApi.sidecars, f), o.site, join(SIDECARS_SERVED, f))) out.sidecars += 1;
    }
    const specHref = (f: string): string => (o.igApi!.rawBase ? `${o.igApi!.rawBase}/sidecars/${f}` : `../${SIDECARS_SERVED}/${f}`);
    if (o.igApi.site) {
      for (const f of filesUnder(o.igApi.site)) {
        // The documents beside the pages (the enumeration schemas) are read
        // from the cache commit too; the pages over them are the site's.
        if (o.igApi.rawBase && !/\.html?$/i.test(f)) continue;
        if (serve(join(o.igApi.site, f), o.site, f)) {
          out.siteFiles += 1;
          if (f === SWAGGER_PAGE) writeFileSync(join(o.site, f), rebaseSwaggerSpecs(readFileSync(join(o.site, f), "utf-8"), new Set(files), specHref));
        }
        else if (o.igApi.placeholder && /\.html?$/i.test(f) && readFileSync(join(o.site, f), "utf-8").includes(o.igApi.placeholder)) {
          // The IG's page is a shell around the layer's marker: the layer's page is its content.
          cpSync(join(o.igApi.site, f), join(o.site, f));
          out.siteFilled.push(f);
        } else out.siteKept.push(f);
      }
    }
  }
  return out;
}

/**
 * The CQL a docs-site Library links (card "ELM", option A): the IG's
 * `input/cql/` file at the commit being built, on the repository the site
 * step names (`SITE_REPOSITORY`, `SITE_COMMIT`). Undefined without either, or
 * with no `input/cql/`: the Libraries are then served as the AST holds them.
 */
export function cqlSourceOf(ig: string | undefined, env: Record<string, string | undefined> = process.env): CqlSource | undefined {
  const repo = env.SITE_REPOSITORY;
  const commit = env.SITE_COMMIT;
  if (!ig || !repo || !commit || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[0-9a-f]{7,40}$/.test(commit)) return undefined;
  const dir = join(ig, CQL_DIR);
  if (!existsSync(dir)) return undefined;
  return { dir, url: (file) => `https://raw.githubusercontent.com/${repo}/${commit}/${CQL_DIR}/${encodeURIComponent(file)}` };
}

/** Where an IG keeps its CQL. */
export const CQL_DIR = "input/cql";

export function publisherPages(o: { site: string; ast: string; work?: string; ig?: string; cql?: CqlSource; log?: (s: string) => void }): ServedData {
  const log = o.log ?? ((s: string) => console.error(s));
  if (!existsSync(o.site) || !statSync(o.site).isDirectory()) throw new Error(`${o.site}: no built site`);
  const igApi = siteIgApi(o.work, o.ast);
  const index = o.work ? join(o.work, INDEX_WORK, "index.json") : undefined;
  const raw = astRawBase(o.work);
  const history = o.work && raw ? join(o.work, AST_HISTORY_WORK) : undefined;
  // The artefact index is read from the AST cache commit when the commit holds one (`ig-cache.sh seed`).
  const src = astSource(o.work);
  const ref = indexRef(raw && existsSync(join(o.ast, INDEX_CACHED)) ? { raw, ...src } : {});
  const served = serveAstData({
    site: o.site,
    ast: o.ast,
    ...(index ? { index } : {}),
    ...(igApi ? { igApi } : {}),
    ...(o.cql ? { cql: o.cql } : {}),
    byUrl: raw !== undefined,
    rootResources: rootResourcesFromEnv(),
    ...(raw ? { rawBase: raw } : {}),
    ...(history ? { history } : {}),
    indexRef: ref,
    warn: log,
  });
  if (ref["base"]) log(`publisher pages: the artefact index is read from ${ref["index"]}, not served; ${INDEX_SERVED}/${INDEX_REF_FILE} points there`);
  if (served.history) log(`publisher pages: the AST versions at ${AST_HISTORY_FILE}`);
  if (raw) log(`publisher pages: the pages read each resource from ${raw}`);
  if (served.librariesByUrl) log(`publisher pages: ${served.librariesByUrl} Library resource(s) link their CQL in ${CQL_DIR}/ by URL; their ELM is left to the release package`);
  log(
    `publisher pages: from the AST, ${
      served.reduced && served.named
        ? `${served.named} reduced resource(s) as <Type>-<id>.json at the root, ${((served.rootBytes ?? 0) / 1e6).toFixed(1)} MB (no narrative, no ELM data; the pages read the full copy by URL)`
        : raw
          ? `no resource copied (read by URL; ${ROOT_RESOURCES_ENV}=0)`
          : `${served.named} resource(s) as <Type>-<id>.json at the root (no ast-data/ mirror)`
    }` +
      `${served.kept ? ` (${served.kept} the site already held were kept)` : ""}; ` +
      `${served.index ? `the artefact index at ${INDEX_SERVED}/index.json` : "no artefact index served"}; ` +
      `${igApi?.rawBase ? `the IG API sidecars read from ${igApi.rawBase} (none copied)` : `${served.sidecars} IG API sidecar(s) at ${SIDECARS_SERVED}/`}; ${served.siteFiles} file(s) the layer above wrote for the site root. The Publisher's HTML is not taken`,
  );
  if (served.siteFilled.length) log(`publisher pages: ${served.siteFilled.length} page(s) of the IG's own held the layer above's placeholder and are its page now: ${served.siteFilled.join(", ")}`);
  // The IG API hub, drawn from the index's bound sidecars (bean `h7ap`): at the
  // IG's page holding the placeholder, or `ig-api.html`. Laid over a page the
  // site holds only when that page is the placeholder's shell or the layer's own.
  if (igApi && index && existsSync(index)) {
    const ix = JSON.parse(readFileSync(index, "utf-8")) as FhirArtifactIndex;
    if (hasIgApi(ix)) {
      const page = o.ig !== undefined ? igApiHubPageOf(o.ig, igApi.placeholder) : IG_API_HUB_DEFAULT_PAGE;
      const at = join(o.site, page);
      const mine = !existsSync(at) || (igApi.site !== undefined && existsSync(join(igApi.site, page))) || (igApi.placeholder !== undefined && readFileSync(at, "utf-8").includes(igApi.placeholder));
      if (mine) {
        const openapi = existsSync(join(o.site, "openapi", "index.html"));
        const documents = (igApi.site ? readdirSync(igApi.site).filter((f) => f.endsWith(".schema.json") && statSync(join(igApi.site!, f)).isFile()) : []).map((f) => (igApi.rawBase ? `${igApi.rawBase}/${IG_API_SITE}/${f}` : f));
        writeIgApiHubSite({ site: o.site, ix, label: igApi.label ?? "IG API", page, openapi, documents });
        log(`publisher pages: the ${igApi.label ?? "IG API"} hub at ${page}, drawn from the index (${hubEntries(ix).length} sidecar(s))`);
      } else log(`publisher pages: ${page} is a page of the IG's own without the hub's placeholder; no hub written over it`);
    }
  }
  if (served.siteKept.length) log(`publisher pages: the site already held ${served.siteKept.length} path(s) the layer above also wrote, kept as the site built them: ${served.siteKept.slice(0, 10).join(", ")}`);
  // The guard: whatever put it there, a page wearing the Publisher's chrome is not published.
  const chrome = publisherChromePages(o.site);
  if (chrome.length) throw new Error(`${chrome.length} page(s) of the built site carry the IG Publisher's chrome (fhir.css, bootstrap-fhir.css or its "Generated" footer) — the Publisher's HTML is not published:\n  ${chrome.slice(0, 20).join("\n  ")}`);
  const renamed = dedupeSiteIds(o.site);
  if (renamed.size) log(`publisher pages: repeated element ids repaired on ${renamed.size} page(s)`);
  if (o.ig !== undefined) {
    const stamped = stampTranslationMeta(o.site, o.ig);
    log(`publisher pages: the language picker's block (fa-translation-meta) written on ${stamped} page(s) that lacked one`);
    const barred = stampIgBar(o.site, igTitle(o.ig) ?? basename(resolve(o.ig)));
    log(`publisher pages: the IG's slim bar given to ${barred.pages} page(s) that had another or none, with the shared page layout`);
    const facts = igVersionFacts(o.ig);
    if (facts) {
      const v = stampIgVersionChrome(o.site, facts);
      log(`publisher pages: the IG's version (${facts.version ?? "none stated"}), its version banner and the home page's metadata table laid over ${v.pages} page(s)`);
    } else log("publisher pages: no sushi-config.yaml in the read scope, so no version chrome");
    const tocd = stampIgTocNav(o.site);
    log(`publisher pages: the IG's TOC declared for the rail on ${tocd.pages} thin page(s) that lacked it`);
    const stamp = igSiteStamp(o.ig);
    const validity = o.work ? join(o.work, VALIDITY_FILE) : undefined;
    if (validity && existsSync(validity)) {
      const v = JSON.parse(readFileSync(validity, "utf-8")) as AstValidity;
      stamp.ast = { commit: v.recorded?.sourceRevision, verdict: v.verdict };
      // P4: which kind of build made the AST. Read from the manifest alone, so
      // a manifest the stamp cannot read leaves the kind out rather than guessing.
      try {
        stamp.ast.kind = buildKind({ manifest: JSON.parse(readFileSync(join(o.ast, "manifest.json"), "utf-8")) });
      } catch {
        // no kind: the stamp says only what it knows
      }
      if (v.verdict !== "valid") log(`publisher pages: the artefact pages come from an AST that is ${v.verdict} (built from ${v.recorded?.sourceRevision?.slice(0, 7) ?? "an unrecorded revision"}), not from ${stamp.source.commit?.slice(0, 7) ?? "the source"}; ${STAMP_FILE} says so`);
    }
    writeFileSync(join(o.site, STAMP_FILE), `${JSON.stringify(stamp, null, 2)}\n`);
    log(`publisher pages: stamped ${STAMP_FILE} — ${stamp.instance}, platform ${stamp.platform.commit.slice(0, 9)}`);
  }
  return served;
}

/**
 * `ig-site:bar`, a FINAL step of the site build (cat-harness-tools
 * `build-instance-site.ts` `finalSteps`): the language picker's block and the
 * IG's slim bar ({@link stampIgBar}) on the pages the platform writes AFTER
 * `publisher-pages` — the identifier lookup page and the mounted layer
 * docs. Owner, 2026-10-15: those pages get the search box too. Both stamps
 * leave a page that already carries them as it was, so the pages
 * `publisher-pages` stamped are untouched. The step also leaves out the other
 * IG layers' artefact indexes the mount of served directories copied in
 * ({@link dropForeignIndexes}).
 */
export function lateBar(site: string, ig: string): { lang: number; pages: number; versioned: number } {
  const lang = stampTranslationMeta(site, ig);
  const { pages } = stampIgBar(site, igTitle(ig) ?? basename(resolve(ig)));
  // The late pages get the version chrome too; a page that carries it is left as it was.
  const facts = igVersionFacts(ig);
  const versioned = facts ? stampIgVersionChrome(site, facts).pages : 0;
  return { lang, pages, versioned };
}

/**
 * The served artefact indexes of OTHER IG layers that the platform's mount of
 * served directories (cat-harness-tools `mount-instance-docs.ts`) copies into
 * this IG's site: every directory a layer other than the checkout's own
 * declares `served` with the `fhir-artifact-index` kind, with the route it was
 * copied to. Pure over `entries` (`declaredEntries` of the checkout).
 *
 * Owner, 2026-11-10: another layer's content is not copied into an IG's site,
 * only cross-referenced. That index (the base IG's `index.json`, `package.tgz`
 * and IG API sidecars, 2.9 MB on one IG) is built at publish for the
 * build-time readers of the mounted layer (its artefact-index visualiser,
 * which links that IG's own published pages), and nothing on this site
 * fetches it: this site's pages read their own index at
 * `fhir-artifact-index/`. That IG publishes the index on its own site.
 */
export function foreignArtefactIndexes(root: string, entries: readonly ResolvedEntry[]): Served[] {
  const own = resolve(root);
  return servedDirectories(entries.filter((e) => e.entry.served === true && resolve(e.instanceDir) !== own && (e.entry.graphTypologies ?? []).includes(INDEX_SERVED)));
}

/**
 * Remove from the built site the other IG layers' artefact indexes the mount
 * of served directories copied there ({@link foreignArtefactIndexes}). Run by
 * the final step `ig-site:bar`, after that mount. Returns each route removed
 * and its size.
 */
export function dropForeignIndexes(site: string, root: string, entries: readonly ResolvedEntry[] = declaredEntries(resolve(root))): { route: string; bytes: number }[] {
  const out: { route: string; bytes: number }[] = [];
  for (const sv of foreignArtefactIndexes(root, entries)) {
    const at = join(site, sv.route);
    if (!existsSync(at)) continue;
    const size = (p: string): number => (statSync(p).isDirectory() ? readdirSync(p).reduce((n, f) => n + size(join(p, f)), 0) : statSync(p).size);
    out.push({ route: sv.route, bytes: size(at) });
    rmSync(at, { recursive: true, force: true });
  }
  return out;
}

if (import.meta.main) {
  const [cmd, target, ...rest] = process.argv.slice(2);
  const args = cmd === "ast" ? [target, ...rest].filter((x): x is string => x !== undefined) : rest;
  const opt = (k: string): string | undefined => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const ig = resolve(opt("ig") ?? ".");
  // The site build's work directory: where a layer above leaves the IG API sidecars, and `compose` the index.
  const work = opt("work") ?? process.env.SITE_WORK;
  try {
    if (cmd === "ast") {
      restoreAst({ ig, ...(work ? { work } : {}), acceptStale: acceptStaleFromEnv(process.env[ACCEPT_STALE_ENV]), preview: isPreviewBase(process.env.SITE_BASEURL ?? process.env.FOLIO_SITE_BASEURL) });
    } else if (cmd === "compose" && target) {
      const baseurl = opt("baseurl") ?? process.env.FOLIO_SITE_BASEURL;
      if (baseurl === undefined) throw new Error("compose needs --baseurl, or FOLIO_SITE_BASEURL from the site build");
      compose({ docs: resolve(target), ig, baseurl, ...(work ? { work } : {}), ...(opt("plantuml-jar") ? { plantumlJar: opt("plantuml-jar")! } : {}) });
    } else if (cmd === "publisher-pages" && target) {
      const cql = cqlSourceOf(ig);
      publisherPages({ site: resolve(target), ast: join(ig, AST_DIR), ...(work ? { work } : {}), ig, ...(cql ? { cql } : {}) });
    } else if (cmd === "bar" && target) {
      const r = lateBar(resolve(target), ig);
      console.log(`bar: the language picker's block on ${r.lang}, the IG's slim bar on ${r.pages} and its version chrome on ${r.versioned} page(s) the platform wrote after publisher-pages`);
      const dropped = dropForeignIndexes(resolve(target), ig);
      for (const d of dropped) console.log(`bar: ${d.route}/ left out (${(d.bytes / 1e6).toFixed(2)} MB), another IG layer's artefact index: that IG publishes it on its own site, and no page here reads it`);
    } else {
      console.error(
        "usage: ig-repo-site.ts ast [--ig <checkout>] [--work <dir>]\n" +
          "       ig-repo-site.ts compose <site source> [--ig <checkout>] [--baseurl <base>] [--plantuml-jar <jar>] [--work <dir>]\n" +
          "       ig-repo-site.ts publisher-pages <built site> [--ig <checkout>] [--work <dir>]\n" +
          "       ig-repo-site.ts bar <built site> [--ig <checkout>]",
      );
      process.exit(2);
    }
  } catch (e) {
    console.error(`✗ ig-repo-site ${cmd}: ${(e as Error).message}`);
    process.exit(1);
  }
}

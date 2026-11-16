#!/usr/bin/env bun
/**
 * Render ANY FHIR IG layer's reader-facing pages from its artefact index.
 *
 * @module fhir-harness/scripts/gen-ig-pages
 * @covers fhir-artifact-index, ig-pages — it reads the index and its `--check` grades every page it writes
 *
 * ## Why it lives in fhir-harness
 *
 * This was the WHO SMART Trust IG's `scripts/gen-smart-trust-pages.ts`. Nothing in it was
 * about the WHO SMART Trust IG except the layer directory, a display label and the
 * layer that owns the template chrome: it reads `fhir-artifact-index/`
 * (`index.json`, optionally `menu.json`), which every ingested IG holds in the
 * same shape. Owner, 2026-10-01 (#1767): *"push generic stuff as much as
 * possible into fhir-harness first"* — so the second IG to want pages
 * (the WHO SMART Base IG, for its own landing page) reuses this rather than
 * copying it, and the generator travels with the layer that owns the index's
 * pipeline when the smart-* layers leave for their own repositories.
 *
 * ## Why this exists
 *
 * `fhir-artifact-index` is registered `renderable: false`, so a layer
 * whose only declared graph of that kind is the index publishes its artefacts
 * at no URL. The owner found it by asking where the WHO SMART Trust IG's page was. Only two
 * of this repository's graph typologies are renderable (`docs` and `folio`); this
 * generator writes a layer's `docs/` from its index.
 *
 * **The URL the owner expected is the right one.** `withRoutes` in
 * `cat-harness/scripts/mount-instance-docs.ts` publishes a layer at
 * `/<kind>/<instance>/` for every renderable kind AND once at `/<instance>/`,
 * its themed root.
 *
 * ## Generated from the index, never transcribed
 *
 * Every artefact, count, canonical URL and link on these pages is read out of
 * `<instance>/fhir-artifact-index/index.json`. Hand-writing them would produce
 * pages that agree with the index exactly once. `--check` keeps that from
 * happening quietly, and it is wired into the gate set per layer.
 *
 * ## What the pages say, and what they refuse to imply
 *
 * **A referenced artefact is not a broken one.** Following `gen-iris-pages.ts`,
 * no row is greyed out: a row stating **referenced** reads as "upstream, not
 * here", which is the actual state and the whole point of cataloguing by
 * reference.
 *
 * **Two link targets, never conflated.** An artefact's canonical URL is its
 * IDENTITY; its published URL is where bytes are served. A WHO IG is canonical
 * at one host and published at another, so composing either from the other
 * would write a link that resolves for nobody. Both come from the index.
 *
 * **The banner's identity is the INDEX's, never the chrome's.** `chrome.json`
 * is ingested once, at the chrome owner, from ONE IG's template chain; its
 * tokens and rules are the TEMPLATE's and hold for every IG built on it, but
 * its `id`/`version`/`status` are that one IG's. Bean `bamf` found the WHO SMART Base IG's
 * chrome describing `smart.who.int.trust` 1.8.0. So the banner names the
 * index's `packageId`, `version` and `canonicalBase`, and takes `status` from
 * the chrome ONLY when the chrome's `id` is this IG's — otherwise the status
 * is not determined and no watermark is drawn, rather than another IG's draft
 * status being asserted of this one.
 *
 * **No WHO logo.** Same instruction the who-iris pages follow: until published
 * under WHO, colour carries the identity and the wordmark is set in type.
 *
 * Usage:
 *   bun run fhir-harness/scripts/gen-ig-pages.ts --instance <dir> --label "<IG display name>"
 *     [--chrome-owner <instance>] [--summary] [--check]
 *   bun run fhir-harness/scripts/gen-ig-pages.ts --instance <dir> --site <site dir> [--label "<name>"] [--check]
 *
 * `--site <dir>` is a site being built (`visualiser-writers.ts`, cat-harness-tools):
 * the run writes ONLY the route pages of the visualisers declared `renderedBy:
 * ig-pages` — `<locale>/<harness>/<id>/` and, for a `subgraphs: "instance"`
 * view, `…/<instance>/` — under that directory, and nothing in the layer or
 * its `docs/`. Each page opens the IG's artefact index where the site carries
 * it, and is that index (every artefact, linked upstream) where it does not.
 *
 * THIN IS THE DEFAULT (owner, 2026-10-11, option A: "tiny html w/ dynamic
 * load from json(ld) KG"; 2026-10-12: "make thin default"). Each ARTEFACT page
 * is a thin shell: `artifact/<Type>-<id>.html`, a few KB of identity and a
 * pointer, with the artefact's JSON-LD node beside it (`<Type>-<id>.jsonld`,
 * `ig-artifact-jsonld.ts`) and one shared renderer (`assets/ig-artifact.js`)
 * that draws the page from the node and the resource; and the index node
 * (`artifact/index.jsonld`) that the IG site's thin `artifacts` and `toc`
 * pages draw (`build-ig-site.ts`). The address is the full page's, so every
 * link to it holds. `--jsonld-base <url>` makes the nodes' IRIs absolute
 * under the docs root's published URL.
 *
 * THE TAB VIEWS ARE THIN TOO (owner, 2026-10-14: "3. Render them too"; "I DO
 * NOT WANT THE IG PUBLISHER HTML"). Where this site serves the artefact's
 * JSON — a compiled copy (`--compiled-data`), or the Publisher's own
 * `<Type>-<id>.json` carried as data (`--publisher-data <path from the docs
 * root>`, which an IG repository's site passes) — each artefact gets thin
 * pages for its views beside its own, at the Publisher's tab file names:
 * `-definitions` and `-mappings` for a StructureDefinition, the JSON view
 * (`.profile.json` for a StructureDefinition, else `.json`), and `-examples`
 * for every StructureDefinition, saying so where no instance claims it
 * (owner, 2026-10-14: "1a"). The artefact's page links
 * them in a tab bar, and they are drawn by the same renderer
 * (`ig-thin-pages.ts` `thinArtifactView`). A full tab page of the same
 * address is replaced. The IG API view pages stay full pages.
 *
 * `--full-pages` is the opt-out: the full just-the-docs artefact pages, as
 * before 2026-10-12, and no JSON-LD. It is kept reachable, not removed —
 * removing it is a separate decision. `--thin` is still accepted and changes
 * nothing; the two together are refused.
 *
 * `--summary` puts the layer's own declaration — its description and every
 * declared graph with its viewer — above the artefact index, via the
 * `harness_details.html` include (with `instance=`), which reads `site.data.harness` at build
 * time. It is how a layer that holds MORE than an IG's artefacts (the WHO SMART Base IG:
 * a library, methodologies, voices) gets a landing page that says so without a
 * word of it being typed here.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, posix, relative, resolve, sep } from "node:path";
import { compareRoute } from "../../cat-harness-tools/scripts/route-authority.ts";
import { IG_API_HUB_DEFAULT_PAGE, IG_API_HUB_NODE, IG_API_HUB_NODE_LOADER, IG_API_HUB_NODE_SCRIPT, hasIgApi, igApiHubBody, igApiHubNodeJson, sidecarHref } from "./ig-api-hub.ts";
import { IG_API_VIEW_SCRIPT, igApiServed, igApiViewData, igApiViews } from "./ig-api-views.ts";
import { IG_CHROME_SCOPE, igFooterData } from "./ig-footer.ts";
import { JSON_VIEW_SCRIPT, VIEW_PAGE, examplesPage, hasJsonView, historyPage, jsonViewData, mappingsPage, mdText, packageEntries, rebaseDescriptionLinks, profileJsonViewData, resourceFacts, resourceTabs, testingPage, type TabPageData } from "./resource-views.ts";
import { isDirectoryReadme } from "@litlfred/cat-harness-tools/schemas/kg/kg-node.js";
import { ARTIFACT_INDEX_FILE, artifactJsonLdFiles, localResourceHref } from "./ig-artifact-jsonld.ts";
import { THIN_PAGE_RENDERER, THIN_PAGE_SCRIPT, THIN_PAGE_STYLE, artifactTabs, thinArtifactPath, thinArtifactView, thinViewRedirect, type SidecarView } from "./ig-thin-pages.ts";
import { PAGE_LAYOUT_CSS_FILE, PAGE_LAYOUT_CSS_SOURCE, PAGE_LAYOUT_JS_FILE, PAGE_LAYOUT_JS_SOURCE } from "../../cat-harness-tools/scripts/page-layout.ts";
import { kgRenderScript } from "../../cat-harness-tools/scripts/thin-page.ts";
import { IG_SEARCH_INDEX_FILE, IG_SEARCH_SCRIPT_FILE } from "./ig-search.ts";

import { IgMenuSchema, type IgMenu, type IgMenuGroup, menuHref, menuItemCount } from "../schemas/ig-menu.js";
import {
  IgChromeSchema,
  chromeCss,
  chromeFileFor,
  tokenOf,
  type IgChrome,
} from "../schemas/ig-chrome.js";
import { declaredVisualisers, pageParts, siteOwnerDir, visualiserPageDir, withRenderedBy, withRenderedByFrontMatter } from "../../cat-harness-tools/scripts/viewer-declarations.js";
import { siteArg, sitePageAt } from "../../cat-harness-tools/scripts/lib/site-target.ts";
import { siteRootFrom, visualiserRoute } from "@litlfred/cat-harness-tools/schemas/kg/visualiser-route.js";
import {
  declarationPathIn,
  directoriesForGraph,
  instanceRootsIn,
  checkoutRootFor,
  readDeclaration,
} from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";

import {
  FhirArtifactIndexSchema,
  materializationCensus,
  sidecarCensus,
  byCategory,
  type FhirArtifact,
  type FhirArtifactIndex,
} from "../schemas/fhir-artifact-index.js";
import { indexReadPath, layerFileReadPath } from "./lib/ig-index-at.ts";

/** `--name value`, or undefined. */
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const INSTANCE_ARG = arg("--instance");
if (!INSTANCE_ARG) {
  console.error("usage: gen-ig-pages.ts --instance <dir> --label <name> [--chrome-owner <instance>] [--index <index.json>] [--out <dir>] [--summary] [--full-pages | --jsonld-base <url>] [--publisher-data <dir>] [--ig-site] [--ig-api-served] [--site <dir>] [--check]");
  process.exit(2);
}
const INSTANCE = resolve(process.cwd(), INSTANCE_ARG);
/**
 * The layer's IDENTITY: the `name` its declaration gives, and only
 * without one the directory's name. The two differ in a separated IG
 * repository, where every IG keeps its data under the DAK layer's directory name (owner,
 * 2026-10-02, choosing the plan's layout) but must still publish under its
 * own name. Keyed on the directory, every such IG would publish under
 * that one directory's URL and collide once one site subscribes to several (bean
 * `rbz3`, measured on the rehearsal in the WHO SMART Trust IG's fork: 2,153 pages
 * changed by the rename alone).
 */
const INSTANCE_NAME = readDeclaration(INSTANCE)?.name ?? basename(INSTANCE);
/**
 * `--index` renders from an index OTHER than the layer's committed one,
 * e.g. one derived from a restored IG Publisher AST by
 * `ast-to-artifact-index.ts`. The layer still supplies the menu and the
 * chrome; only the artefact list comes from the named file.
 */
const INDEX_ARG = arg("--index");
const INDEX = INDEX_ARG ? resolve(process.cwd(), INDEX_ARG) : indexReadPath(INSTANCE, "index.json");
/**
 * The IG's OWN navigation, ingested from its `sushi-config.yaml`.
 *
 * OPTIONAL, and its absence is a third state rather than "this IG has no
 * menu": `ingest-ig-menu.ts` needs the upstream source checkout, which is not
 * on every machine. Absent → the menu sections are not written and the build
 * SAYS so; it does not quietly render a site with no navigation and call it
 * complete.
 */
const MENU = indexReadPath(INSTANCE, "menu.json");
/**
 * `--compiled-data <dir>`: where a COMPILED index's files are served, as a
 * path from the docs root (e.g. `../ast-data` beside `docs/`), or `.`
 * (`COMPILED_BY_NAME`) when each is served once at the docs root as
 * `<Type>-<id>.json`, as the IG site does. When set, each
 * artefact page whose materialization is a compiled copy gets a resource
 * section its browser fills from that file: the narrative and the JSON, by
 * the shared loader `assets/ast-resource.js` (skill `visualizer-loading`).
 * The page keeps identity, layout and the pointer; the content is fetched,
 * never baked in. Absent means the files are not served, so no page points
 * at them.
 */
const COMPILED_DATA = arg("--compiled-data")?.replace(/\/+$/, "");
/**
 * `--root-resources`: the site serves each compiled resource at its root as
 * `<Type>-<id>.json`, a reduced copy (`ig-repo-site.ts` `reduceForSite`), so
 * each JSON-LD node lists that file first and the `--compiled-data` copy as
 * its mirror (fhir-harness#359). The pages still draw the `--compiled-data` copy.
 */
const ROOT_RESOURCES = process.argv.includes("--root-resources");
const AST_LOADER = join(import.meta.dir, "templates", "ig-pages", "ast-resource.js");
/** Thin unless `--full-pages` (see the module doc). `--thin`, the old opt-in, is accepted and is the default. */
const FULL_PAGES = process.argv.includes("--full-pages");
if (FULL_PAGES && process.argv.includes("--thin")) {
  console.error("gen-ig-pages: --thin and --full-pages together — pick one (thin is the default)");
  process.exit(2);
}
const THIN = !FULL_PAGES;
/**
 * `--search`: the site serves the IG's search under the docs root
 * (`ig-search.ts`: `assets/ig-search.json` and `assets/ig-search.js`, which
 * `ig-repo-site.ts compose` writes), so every thin artefact page's header
 * carries the search box. Absent, no page names files the site may not hold.
 */
const SEARCH = THIN && process.argv.includes("--search");
/**
 * `--ast-history <href> --ast-repository <owner/repo>`: the AST versions the
 * site serves (`ig-ast-history.ts`), relative to an artefact page, and the
 * repository whose cache branch holds them. Each artefact whose resource the
 * pages read gets a History view (fhir-harness#329). Thin pages only.
 */
const AST_HISTORY = THIN ? arg("--ast-history") : undefined;
const AST_REPOSITORY = arg("--ast-repository");
if (AST_HISTORY !== undefined && (AST_REPOSITORY === undefined || !/^[\w.-]+\/[\w.-]+$/.test(AST_REPOSITORY))) {
  console.error("gen-ig-pages: --ast-history needs --ast-repository <owner/repo>");
  process.exit(2);
}
const JSONLD_BASE = (() => {
  const b = arg("--jsonld-base");
  return b === undefined ? undefined : b.endsWith("/") ? b : `${b}/`;
})();
/**
 * `--publisher-data <dir>`: the Publisher's own data files — each artefact's
 * `<Type>-<id>.json` — are served at this path from the docs root (`.` for an
 * IG repository's site, which carries them at its root). The thin artefact
 * page and its tab views draw the resource from there when no compiled copy
 * is served. Absent: only a compiled copy is drawn.
 */
const PUBLISHER_DATA = arg("--publisher-data")?.replace(/\/+$/, "");
const THIN_RENDERER = join(import.meta.dir, "templates", "ig-pages", "ig-artifact.js");
const THIN_STYLE = join(import.meta.dir, "templates", "ig-pages", "ig-artifact.css");

/** `--out` writes the pages somewhere other than the layer's committed `docs/`. */
const OUT_ARG = arg("--out");
const OUT = OUT_ARG ? resolve(process.cwd(), OUT_ARG) : join(INSTANCE, "docs");
/**
 * `--site <dir>`: a site being built (`visualiser-writers.ts`, which reads the
 * flag off this Tool's `site` input). The run writes ONLY the declared route
 * pages, at `<locale>/<harness>/<id>/` under that directory — never `docs/`,
 * never anything in the layer, which in a repository's own site build is a
 * pinned mount. See {@link declaredRoutePages}.
 */
const SITE = siteArg();
if (SITE !== undefined && OUT_ARG !== undefined) {
  console.error("gen-ig-pages: --site and --out together — --site writes only the declared route pages, --out the docs; pick one");
  process.exit(2);
}
/**
 * Whether these pages build INTO the layer's own IG site, served at
 * `/<instance>/` (`igSite` on the docs directory, bean `mftp`), rather than
 * composed into the main site. Read off the declaration, never inferred.
 */
const IG_SITE =
  // `--ig-site`: said by the caller, for a checkout with no declaration to read it
  // from — an IG repository's own site (`ig-repo-site.ts compose`), which IS its IG site.
  process.argv.includes("--ig-site") ||
  readDeclaration(INSTANCE)?.directories?.find((d) => resolve(INSTANCE, d.path).replace(/\/+$/, "") === OUT.replace(/\/+$/, ""))?.igSite === true;
/**
 * The site-absolute path of this layer's docs root, for `relative_url`:
 * the layer's own route in the main site, or the IG site's root, whose
 * `baseurl` already ends in `/<instance>`.
 */
const SITE_PREFIX = IG_SITE ? "" : sitePrefixArg() ?? `/${INSTANCE_NAME}`;
/**
 * `--site-prefix <path>`: where the caller publishes this docs root, when it
 * is not `/<instance>/`. The staging workflow copies an IG's AST-built pages
 * to `/<instance>/ast/`, so their links to the shared `assets/` must say so,
 * or every page links a stylesheet and footer loader that are not there.
 * Site-absolute, one leading slash, no trailing one.
 */
function sitePrefixArg(): string | undefined {
  const v = arg("--site-prefix");
  if (v === undefined) return undefined;
  if (!/^\/[A-Za-z0-9._~/-]*[A-Za-z0-9._~-]$/.test(v) || v.includes("//") || v.split("/").includes("..")) {
    console.error(`gen-ig-pages: --site-prefix ${JSON.stringify(v)}: expected a site-absolute path like /<instance>/ast`);
    process.exit(2);
  }
  return v;
}
/**
 * Where an artefact page's "all artefacts" link goes: the IG site's own
 * Artifact Index (`artifacts.html`, written by `build-ig-site`) when the pages
 * build into it, else this generator's index at the docs root.
 */
const ALL_ARTEFACTS_HREF = IG_SITE ? "../artifacts.html" : "../";
/**
 * The front-matter-only page an `igSite` layer commits so its artefact
 * index keeps a viewer declaration; its body is the IG site's own generated
 * `artifacts` page (`FRONT_MATTER_ONLY` in `stage-ig-sites.ts`).
 */
const ARTIFACTS_FRONT_MATTER_PAGE = "artifacts.md";
/** The pages' shared stylesheets, under the docs root (one copy each, linked from every page). */
const PAGES_CSS = "assets/ig-pages.css";
const CHROME_CSS = "assets/ig-chrome.css";
/**
 * The Publisher-style footer (#1901): one loader and one data file per IG,
 * linked from every page that wears the fixture, never copied into each.
 */
const IG_FOOTER_SCRIPT = "assets/ig-footer.js";
const IG_FOOTER_DATA = "assets/ig-footer.json";
const IG_FOOTER_LOADER = join(import.meta.dir, "templates", "ig-pages", "ig-footer.js");
/**
 * `--ig-api-served`: the caller serves the artefact-index graph, sidecars
 * included, at the docs root beside these pages, so `../<localPath>` from
 * `artifact/` reaches it. Said by the caller for a checkout with no
 * declaration to read `served` from: an IG repository's own site
 * (`ig-repo-site.ts`), whose `publisher-pages` step copies the sidecars to
 * the `localPath` they are bound at. Otherwise read off the declaration.
 */
const IG_API_SERVED_FLAG = process.argv.includes("--ig-api-served");
const igApiServable = (): ReturnType<typeof igApiServed> => (IG_API_SERVED_FLAG ? { ok: true } : igApiServed(INSTANCE));

/** The IG API view pages' Liquid template (`liquid-templates`: a file of this directory, beside its writer). */
const IG_API_VIEW_TEMPLATE = join(import.meta.dir, "templates", "ig-pages", "ig-api-view.liquid");
/** Their one shared loader, copied to `docs/assets/` (bean `680p`, `visualizer-loading`). */
const IG_API_VIEW_LOADER = join(import.meta.dir, "templates", "ig-pages", "ig-api-view.js");
/** The IG API hub page's template and loader — the Publisher's hub page, replicated. */
/** The JSON view pages' template and loader — the Publisher's `<Name>.json.html`. */
const JSON_VIEW_TEMPLATE = join(import.meta.dir, "templates", "ig-pages", "json-view.liquid");
const JSON_VIEW_LOADER = join(import.meta.dir, "templates", "ig-pages", "resource-json.js");
/** The text-only tab pages' template — history, testing, a logical model's examples. */
const TAB_PAGE_TEMPLATE = join(import.meta.dir, "templates", "ig-pages", "tab-page.liquid");
const MAPPINGS_TEMPLATE = join(import.meta.dir, "templates", "ig-pages", "mappings.liquid");
/** An artefact page's IG API section: its template and the loader that builds it from the OpenAPI sidecar. */
const IG_API_OPENAPI_BODY = readFileSync(join(import.meta.dir, "templates", "ig-pages", "ig-api-openapi.liquid"), "utf8");
const IG_API_OPENAPI_LOADER = join(import.meta.dir, "templates", "ig-pages", "ig-api-openapi.js");
const IG_API_OPENAPI_SCRIPT = "assets/ig-api-openapi.js";

/**
 * The layer that OWNS the template chrome, or none.
 *
 * Named rather than walked to, and `schemas/ig-chrome.ts` §`chromeFileFor`
 * carries why: the generator is generic, so the caller names the owner rather
 * than a walk picking one (the `needs` gap that first motivated this has closed;
 * the IG page sets now declare `derivedFrom: smart-base-themes`, bean `nama`).
 * A FLAG rather than a constant: fhir-harness has no business naming a WHO
 * layer.
 */
const CHROME_OWNER = arg("--chrome-owner");

/**
 * The IG's display name — `WHO SMART Trust`. Not in the index (whose `title`
 * is the package id plus "— artefact index"), so it is the one string a
 * caller supplies; the package id stands in when none is given.
 */
const LABEL_ARG = arg("--label");

/** Whether the index page opens with the layer's own declaration. */
const SUMMARY = process.argv.includes("--summary");

/**
 * The sentence the banner's publish box opens with. A FLAG, because which
 * publisher an IG mirrors is the caller's to say: fhir-harness knows no
 * particular one (`fhir-harness/AGENTS.md`), so the default names none.
 */
const PUBLISH_NOTE_ARG = arg("--publish-note");
/**
 * The publish box's sentence for an index. A page drawn from the IG Publisher
 * AST cache (`source.kind` `output`) does NOT mirror a published guide, so
 * the default says what it is instead; a caller's `--publish-note` still wins.
 */
const publishNoteFor = (ix: FhirArtifactIndex): string =>
  PUBLISH_NOTE_ARG ??
  (ix.source.kind === "output"
    ? "This page is built from an IG Publisher AST cache, provisional until a full Publisher run."
    : "This page mirrors a published FHIR Implementation Guide.");

/**
 * What the IG calls its per-artefact JSON sidecars (JSON Schema, displays,
 * OpenAPI, JSON-LD). Some publishers brand them; this layer does not, so the
 * label is the caller's and the default is plain.
 */
const SIDECAR_LABEL = arg("--sidecar-label") ?? "IG API";
/**
 * The hub page's name on this site: the Publisher's own, read from the URL the
 * hub was ingested from (whatever page its layer named), so the replica
 * keeps the published name without this layer writing any IG's name down.
 */
// The hub page's name: the index's hub link when it has one (the IG's page holding the
// placeholder, `build-ig-indexes`), else the generic default.
const hubPage = (ix: FhirArtifactIndex): string => basename(ix.igApiHub ? new URL(ix.igApiHub.url).pathname : IG_API_HUB_DEFAULT_PAGE).replace(/\.html$/, "");

/** The declaration's `name`, or `undefined` when a directory is not a layer. */
function declaredName(root: string): string | undefined {
  const decl = declarationPathIn(root);
  if (decl === undefined) return undefined;
  try {
    return (JSON.parse(readFileSync(decl, "utf8")) as { name?: string }).name;
  } catch {
    // Unparseable is "could not determine", never "not the chrome owner": returning
    // a name here would make a broken sibling silently supply the chrome.
    return undefined;
  }
}

/**
 * The IG's chrome, ingested from its template chain — OPTIONAL, like the menu.
 *
 * Absent is a third state rather than "this IG has no chrome":
 * `ingest-ig-chrome.ts` needs three upstream checkouts, which are on no CI
 * runner. Absent -> the pages render without WHO's palette and the build SAYS
 * so, rather than quietly shipping unstyled pages and calling them a mirror.
 */
function loadChrome(): IgChrome | undefined {
  if (CHROME_OWNER === undefined) return undefined;
  const file = chromeFileFor(checkoutRootFor(INSTANCE), CHROME_OWNER, {
    instanceRootsIn,
    declarationNameOf: declaredName,
    directoriesForGraph: (root, graph) => directoriesForGraph(root, graph),
    exists: existsSync,
    join,
  });
  if (file === undefined) return undefined;
  const parsed = IgChromeSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
  if (!parsed.success) {
    console.error(`the committed IG chrome does not validate — refusing to style from it:`);
    for (const i of parsed.error.issues.slice(0, 5)) console.error(`  ${i.path.join(".")}: ${i.message}`);
    process.exit(1);
  }
  return parsed.data;
}

const CHROME = loadChrome();

/**
 * Where the mirrored chrome applies.
 *
 * SCOPED, never `:root`. The IG Publisher can put WHO's palette on `:root`
 * because every document it builds is the IG's; ours are folio pages that
 * happen to carry a mirror, and a bare `:root` block would repaint the whole
 * site the moment one of these pages loaded.
 */
const CHROME_SCOPE = `.${IG_CHROME_SCOPE}`;

/**
 * The IG's own status banner — the blue bar and, while it is a draft, the
 * watermark.
 *
 * **The VALUES are WHO's; the MARKUP is ours, and the difference is the ask.**
 * The owner wanted our pages to mirror the WHO IG *"except navar menu is now
 * on LHS"* — so reproducing the template's Bootstrap `.navbar-inverse` would
 * rebuild the very top bar that was moved. What is mirrored is the palette and
 * the watermark; what is ours is a header element that consumes them.
 *
 * `#ig-status`'s class comes from the IG's OWN `status` (`draft` here), read
 * from `sushi-config.yaml` by the ingest, exactly as the template's
 * `fragment-pagebegin.html` does it. Nothing here decides that the WHO SMART Trust IG is
 * a draft.
 */
function igBanner(ix: FhirArtifactIndex): string {
  const title = ix.packageId ?? INSTANCE_NAME;
  const canonical = ix.canonicalBase ?? "";
  const status = statusFor(ix);
  const label = [ix.version, status].filter(Boolean).join(" — ");
  return [
    `<div class="${CHROME_SCOPE.slice(1)}">`,
    `  <div class="st-ig-bar"><a href="${esc(canonical)}">${esc(title)}</a></div>`,
    status !== undefined
      ? `  <div id="ig-status" class="ig-status-${esc(status)}">`
      : `  <div id="ig-status">`,
    `    <p><span class="st-ig-title">${esc(LABEL)}</span><br/><span>${esc(label)}</span></p>`,
    `  </div>`,
    `  <p id="publish-box">${esc(publishNoteFor(ix))} ` +
      `The authoritative version is at <a href="${esc(canonical)}">${esc(canonical)}</a>.</p>`,
    `</div>`,
  ].join("\n");
}

/**
 * The IG's publication status — its own ImplementationGuide's `status`, as
 * the artefact index records it beside its version. Absent -> `undefined`,
 * which draws no watermark rather than a wrong one.
 */
function statusFor(ix: FhirArtifactIndex): string | undefined {
  return ix.status;
}

/**
 * The chrome's stylesheet, plus the handful of rules OUR markup needs.
 *
 * `chromeCss` emits the ingested tokens and the mirrored rules. The three
 * added here style elements the template has no equivalent of, and every
 * colour in them is `var(--…)` off an ingested token rather than a literal —
 * a hex typed here would be exactly the transcription this whole pipeline
 * exists to avoid.
 */
function chromeStyles(chrome: IgChrome): string {
  const bar = tokenOf(chrome, "--navbar-bg-color") ? "var(--navbar-bg-color)" : "currentColor";
  const ink = tokenOf(chrome, "--ig-status-text-color") ? "var(--ig-status-text-color)" : "currentColor";
  return (
    chromeCss(chrome, CHROME_SCOPE) +
    `${CHROME_SCOPE} .st-ig-bar{background:${bar};padding:.5rem .8rem;border-radius:4px 4px 0 0}\n` +
    `${CHROME_SCOPE} .st-ig-bar a{color:#fff;font-weight:600;text-decoration:none}\n` +
    `${CHROME_SCOPE} .st-ig-title{font-size:12pt;font-weight:bold;color:${ink}}\n` +
    darkChrome()
  );
}

/**
 * THE INGESTED CHROME IS A LIGHT THEME, and this site is dark by default.
 *
 * Every token and mirrored rule above is the upstream template's, which paints
 * on white: `--publish-box-bg-color: yellow`, `#ig-status p { background-color:
 * white }`, `--ig-status-text-color: #00376d`. On the site's dark ground those
 * read as a glaring yellow bar and a white card with near-black text (owner,
 * 2026-10-10: "in dark mode, yellow and white backgrounds are harsh").
 *
 * So the light values stay exactly as ingested — they are what a light reader
 * gets, and what the drift checks compare — and a DARK reader gets this block on
 * top. Keyed on the site's scheme attribute (`<html data-fa-scheme>`, set before
 * first paint by the docs theme), dark unless it says `light`, matching that
 * script's own default. These are this site's colours, not a transcription of
 * the upstream's, which has no dark palette to transcribe; the yellow keeps its
 * meaning as an amber callout rather than vanishing.
 */
function darkChrome(): string {
  const dark = `html:not([data-fa-scheme="light"]) ${CHROME_SCOPE}`;
  return (
    `${dark}{` +
    `--publish-box-bg-color:#3b3415;--publish-box-border:1px solid #8a7524;` +
    `--ig-status-text-color:#a9c8f5;--ig-header-color:#2f2e35;--ig-header-container-color:#2f2e35;` +
    `--breadcrumb-bg-color:#2f2e35;--toc-box-bg-color:#2f2e35;--footer-nav-bg-color:#2f2e35;` +
    `--stu-note-background-color:#3a2a3a;--dragon-background-color:#35302a;--dragon-text-color:#e6e1d8;` +
    `--link-color:#7fb2ec;--link-hover-color:#a9c8f5}\n` +
    `${dark} #ig-status p{background-color:#2f2e35}\n` +
    `${dark} #publish-box{color:#efe3b0}\n` +
    `${dark} #publish-box a{color:#ffd866}\n`
  );
}

const CHECK = process.argv.includes("--check");

/** HTML-escape. Every string on these pages comes from an upstream IG, so none of it is trusted markup. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A filesystem-safe page name for an artefact key (`ValueSet/Actors` -> `ValueSet-Actors`). */
function pageName(a: FhirArtifact): string {
  return `${a.resourceType}-${a.id}`.replace(/[^A-Za-z0-9._-]/g, "_");
}

/**
 * What the uncategorised bucket is called — on its section
 * and, if it ever outgrows the index, its page. Never "Other": the IG HAS a
 * literal "Other" category (`byCategory`), and a coined second one put two
 * sections named "Other" on the WHO SMART Trust IG's index, the second holding the IG's
 * own ImplementationGuide resource.
 */
const UNCATEGORISED = "Uncategorised";

/**
 * A category's own page name, sanitised the same way an artefact's is.
 *
 * Categories are free text out of the IG (`Requirements: Formal Requirements`,
 * `Terminology: Value Sets`), so the colon and the spaces have to go before
 * this is a filename. Uses `pageName`'s character class rather than a second
 * one, because two sanitisers are two answers to "what is a safe name".
 */
function categoryName(label: string | undefined): string {
  return (label ?? UNCATEGORISED).replace(/[^A-Za-z0-9._-]/g, "_");
}

/**
 * The index's in-page anchor for a category: a stable fragment a link or the
 * rail's "On this page" can point at. (The in-page Contents box that once
 * linked here is gone — owner, 2026-10-02, #1901: the TOC lives only in the
 * left-hand rail.)
 *
 * The uncategorised bucket gets its own id rather than `Other`'s: the IG HAS a
 * literal "Other" category (see `byCategory`), and two sections answering to
 * one fragment would send a link to whichever came first.
 */
function categoryAnchor(label: string | undefined): string {
  return label === undefined ? "cat--uncategorised" : `cat-${categoryName(label)}`;
}

/**
 * Above this many artefacts a category is SUMMARISED and linked out rather
 * than listed inline.
 *
 * The owner's call, 2026-09-21, on measuring the first build: the index page
 * came to 524KB and one category was 90% of it.
 *
 * **The number is not load-bearing, and that is the point.** The WHO SMART Trust IG's
 * categories measure 604, 29, 15, 14, 5, 5, 1 — a 20x gap between the largest
 * and the next. Any threshold in 30..603 separates them identically, so 100 is
 * a round number inside a wide gap rather than a tuned constant. If a future
 * IG lands a category near the boundary, the right response is to look at that
 * distribution, not to nudge this.
 *
 * What makes linking out lossless HERE, checked rather than assumed: every one
 * of the WHO SMART Trust IG's 604 `Other` artefacts is an Endpoint or an Organization and
 * NONE carries an IG API sidecar, so none would have had an artefact page to link
 * to. The summary reports the sidecar count it actually finds, so a future
 * category that does carry sidecars says so instead of hiding them.
 */
const INLINE_LIMIT = 100;

/**
 * The ONLY styling these pages carry, and it is deliberately tiny.
 *
 * The first version shipped ~100 lines: body font, colours, a `--col` wrap
 * width, a full dark-mode variable set, table borders, link colours. Every one
 * of those duplicated or FOUGHT just-the-docs, which already supplies
 * typography, tables, links, the colour scheme and its dark mode. A page that
 * re-declares `body { ... }` inside a themed site is a standalone document
 * wearing front matter — which is exactly what the owner asked to stop:
 * *"i want the input/page(s)/ content to be rendered viajustthedocs
 * pipeline."*
 *
 * What is left is what the theme has no opinion about: the two
 * materialization tags, which carry MEANING in their colour (held vs
 * referenced) and would otherwise be two words a reader must hold in their
 * head, and the census grid.
 *
 * `currentColor` and the theme's own `--*` custom properties are used wherever
 * possible so these follow the reader's scheme instead of pinning a palette.
 */
const CSS = `
.st-tag{display:inline-block;padding:.05rem .4rem;border-radius:3px;font-size:.75rem;
  font-weight:600;white-space:nowrap;border:1px solid currentColor}
.st-held{color:#0d6e5e}
.st-ref{color:#6b5b95}
.st-grid{display:flex;flex-wrap:wrap;gap:.75rem;margin:1rem 0}
.st-stat{flex:1 1 8rem;border:1px solid rgba(128,128,128,.35);border-radius:6px;padding:.5rem .7rem}
.st-stat b{display:block;font-size:1.25rem;line-height:1.2}
.st-stat span{font-size:.75rem;opacity:.75}
#ig-footer{margin-top:1.5rem;font-size:.8rem}
#ig-footer p{margin:.1rem 0}
#ig-footer .ig-footer-band{background:var(--footer-container-bg-color,var(--footer-bg-color,transparent));color:var(--footer-text-color,inherit);padding:.3rem 1rem;border-top:1px solid rgba(128,128,128,.35)}
#ig-footer .ig-footer-band a{color:var(--footer-hyperlink-text-color,inherit)}
#ig-footer .ig-footer-band code{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);color:inherit}
#ig-footer a[rel~=external]::after{content:" \\2197"}
`;
// The footer's band reads the mirrored chrome's `--footer-*` tokens, the
// Publisher's own footer colours: the CONTAINER colour first, the dark band
// the Publisher's text sits on (#1901, the owner's "dark-blue band"), then the
// outer one. Without an ingested chrome it falls back to the theme's, never
// to a hand-typed palette. An off-site link is marked with the Publisher's
// arrow (U+2197), as its footer marks them.
/**
 * A page for the JUST-THE-DOCS pipeline: front matter, then the body.
 *
 * ## Why this stopped emitting finished HTML
 *
 * Owner, 2026-09-21: *"i want the input/page(s)/ content to be rendered
 * viajustthedocs pipeline. use metadataetc fro IG publisher to populate the
 * variables jekyl processes."*
 *
 * These pages were `<!doctype html>` documents with their own `<head>`,
 * copied into `_site` AFTER Jekyll by `mount-instance-docs.ts` — so they
 * inherited **nothing**: no sidebar, no language bar, no QA badges, no search.
 * `hw9g` had to inject a navigation rail into them precisely because the
 * pipeline never saw them. Composed instead, they are ordinary folio pages and
 * the rail is unnecessary here (it stays necessary for `who-iris`, which is a
 * deliberate replica of somebody else's site).
 *
 * ## The body is still HTML, and that is the MVP line
 *
 * kramdown passes raw HTML through, so front matter alone converts these into
 * real pages without rewriting every emitter in one go. What that buys is the
 * chrome; what it does not buy is markdown semantics — no automatic heading
 * anchors, no table-of-contents, and `{{ }}` in a body would be read as Liquid.
 * Converting each body to markdown is the parity work the owner asked to be
 * taken "until rendering parity-ish", and it can now happen page by page
 * against a site that already renders.
 *
 * ## Titles and description come from the INDEX
 *
 * "use metadata … to populate the variables jekyl processes" — `title` and
 * `description` are the index's own, never typed here, which is the same rule
 * the rest of this generator follows.
 */
/**
 * Where a page sits in the LEFT-HAND NAV — three roles, not a depth number.
 *
 * It was `depth = 0 | 1`, and one number was carrying two different facts: a
 * CATEGORY page and an ARTEFACT page both passed `1`, so the `nav_exclude`
 * written for the 674 leaves swept out the 7 category pages with them. The
 * sidebar showed exactly ONE row for the WHO SMART Trust IG — the index — and the structure
 * this index is grouped by was invisible in the one place a reader navigates
 * from.
 *
 * The comment that justified it was right about the leaves and wrong about the
 * sections: *"674 artefacts would bury the sidebar's real structure"* — the
 * categories ARE that structure. Two facts, two values, so the next person
 * cannot accidentally exclude one by describing the other.
 */
type NavRole =
  /** The front door. Carries the children. */
  | { kind: "index" }
  /** One of the 7 categories — a listed child of the index. */
  | { kind: "section"; order: number }
  /** One of the 674 artefacts. Excluded: a leaf per artefact buries the rest. */
  | { kind: "leaf" };

/**
 * The index page's title, and the string a section names as its `parent`.
 *
 * just-the-docs matches a child to its parent BY TITLE, so these two cannot be
 * written independently — one constant, referenced twice, or a re-titled index
 * silently orphans all 7 sections and the sidebar quietly flattens.
 */
let LABEL = LABEL_ARG ?? INSTANCE_NAME;
/**
 * With `--summary` the index page IS the layer's landing page, so it carries
 * the IG's name alone; without it, it is the artefact index and says so.
 */
const titleFor = (label: string): string => (SUMMARY ? label : `${label} — artefact index`);
let INDEX_TITLE = titleFor(LABEL);

function navFrontMatter(nav: NavRole): string[] {
  switch (nav.kind) {
    case "index":
      return ["has_children: true"];
    case "section":
      return [`parent: ${yamlScalar(INDEX_TITLE)}`, `nav_order: ${nav.order}`];
    case "leaf":
      // Still excluded, and for the reason the original comment gave: 674
      // leaves would bury the sidebar. Unchanged behaviour, now stated of the
      // case it was actually meant for.
      return ["nav_exclude: true"];
  }
}

/**
 * Whether a page carries the IG chrome.
 *
 * Owner, 2026-09-23, on the navbar: *"etc... common fixture unless explicty
 * removed in harness visualtion."* The same rule governs the chrome, and it is
 * a DEFAULT-ON parameter rather than a list of pages that opt in — the two are
 * not the same thing. A list of opted-in pages makes every page added later
 * silently bare, and nobody notices, because a missing fixture looks exactly
 * like a page that was never meant to have one. Default-on inverts that: a
 * page without the chrome had to say so.
 */
type ChromeChoice = "fixture" | "removed";

/** The footer's opening tag, up to where a page's prev/next attributes go. */
const FOOTER_TAG = `<footer id="ig-footer"`;
/**
 * The front-matter flag an IG site's layout draws its footer for (`ig_footer`
 * in `build-ig-site.ts`). On an `igSite` layer's pages it replaces the
 * `<footer>` + loader pair, so an artefact page and an IG site page are drawn
 * by ONE template from ONE `site.data.fhir.footer` (#1901 follow-up).
 */
const IG_FOOTER_FLAG = "ig_footer: true";

function shell(
  title: string,
  description: string,
  body: string,
  nav: NavRole = { kind: "index" },
  chrome: ChromeChoice = "fixture",
  data: Record<string, unknown> = {},
): string {
  const fm = [
    "---",
    `title: ${yamlScalar(title)}`,
    `description: ${yamlScalar(description)}`,
    ...navFrontMatter(nav),
    // Page variables for a Liquid template, as JSON flow mappings — YAML is a
    // superset of JSON, so one line per key needs no YAML emitter.
    ...Object.entries(data).map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
    ...(chrome === "fixture" && IG_SITE ? [IG_FOOTER_FLAG] : []),
    "---",
    "",
  ].join("\n");
  // The remaining styling — the handful of rules just-the-docs has no opinion
  // about, and the mirrored chrome — is LINKED, from one stylesheet each
  // under the layer's `assets/` (bean `680p`). It was inlined into every
  // page: 3.1 KB x 2,153 pages = 6.7 MB of the WHO SMART Trust IG's 12.2 MB of generated
  // pages (measured 2026-10-01), the same bytes 2,153 times. `relative_url`
  // keeps the link right under any baseurl, staging previews included.
  // The chrome is mirrored only when it was actually ingested. Absent, the
  // page renders as an ordinary folio page: a mirror nobody could build is
  // reported by the build, never faked with a hand-typed palette.
  const wearsChrome = chrome === "fixture" && CHROME !== undefined;
  // An igSite layer's pages all sit one level down (`artifact/`), and are
  // built either inside the host site at `/<instance>/` or as the IG's own
  // site at its root (bean `mftp`); a RELATIVE href is right in both, where a
  // site-absolute one is right in only one.
  const assetHref = (file: string) => (IG_SITE ? `../${file}` : `{{ '${SITE_PREFIX}/${file}' | relative_url }}`);
  const link = (file: string) => `<link rel="stylesheet" href="${assetHref(file)}">`;
  const links = `${link(PAGES_CSS)}${wearsChrome ? `\n${link(CHROME_CSS)}` : ""}`;
  const banner = wearsChrome ? `${igBanner(IX)}\n\n` : "";
  // The footer, on every fixture page, chrome or not: it is the IG's facts,
  // not the mirrored styling.
  //
  // In an IG site (`igSite`) the page only FLAGS it (`IG_FOOTER_FLAG`), and
  // the site's layout draws it with the include every IG site page uses, from
  // the same `site.data.fhir.footer` — the facts read from the IG's package
  // AND its source (the © year is only in `sushi-config.yaml`), and the
  // "Links:" row already narrowed to pages the site holds. A second renderer
  // here drew a footer that differed (no year; "Table of Contents" at the
  // root, not `toc.html`). The page's place in the reading order and its
  // depth below the site root are set later (`ig_prev`, `ig_next`, `ig_root`).
  //
  // Elsewhere there is no IG site and no IG source, so the loader draws it
  // from the package's facts alone: the page carries an empty <footer> and,
  // set later for the pages in reading order, its previous and next pages
  // (`FOOTER_TAG`). The data file and the index are found from the loader's
  // own URL, so ~3,200 pages do not each repeat two more URLs.
  const footer =
    chrome === "fixture" && !IG_SITE
      ? // In the chrome's scope when the page wears it, which is where the
        // mirrored `--footer-*` tokens are defined.
        `\n\n${FOOTER_TAG}${wearsChrome ? ` class="${CHROME_SCOPE.slice(1)}"` : ""}></footer>\n` +
        `<script src="${assetHref(IG_FOOTER_SCRIPT)}" defer></script>`
      : "";
  return `${fm}${links}\n\n${banner}${body.trim()}${footer}\n`;
}

/**
 * A YAML scalar that survives a colon, a quote or a leading dash in a title.
 *
 * Front matter is parsed before anything else reads the page, so an unquoted
 * `Foo: bar` does not render wrong — it fails the BUILD, with an error naming
 * YAML rather than the artefact whose name carried the colon.
 */
function yamlScalar(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function repLinks(a: FhirArtifact): string {
  // THIS SITE'S OWN COPIES FIRST (owner, 2026-10-10): "i dont want the html
  // link b/c this site is replace the WHO one. the json should point to the
  // current rendered KG … not WHO", and the JSON-LD and JSON Schema the IG's
  // post-processing publishes belong beside it. So: no html (this page IS the
  // html), the JSON this site serves when it holds the resource, and the
  // schema / JSON-LD sidecars from the served index. The upstream file is
  // linked only when nothing here holds it, and it says so.
  const out: string[] = [];
  const local = localResourceHref(a, COMPILED_DATA);
  if (local) out.push(`<a href="${esc(local)}">json</a>`);
  else if (a.published.json) out.push(`<a href="${esc(a.published.json.url)}" rel="external">json (upstream)</a>`);
  for (const [k, label] of [["schema", "JSON Schema"], ["jsonld", "JSON-LD"]] as const) {
    const r = a.sidecars?.[k];
    if (!r) continue;
    out.push(r.localPath && igApiServable().ok ? `<a href="${esc(sidecarHref(ix, r, "../")!)}">${label}</a>` : `<a href="${esc(r.url)}" rel="external">${label} (upstream)</a>`);
  }
  // Separated by a middot. The old stylesheet gave `.reps` a flex gap; with
  // that gone the links rendered as one word, which reads as a broken link
  // rather than as several working ones. A separator in the MARKUP survives
  // the stylesheet being deleted.
  return out.length ? out.join(" · ") : "—";
}

function indexPage(ix: FhirArtifactIndex): string {
  const census = materializationCensus(ix.artifacts);
  const sc = sidecarCensus(ix.artifacts);
  // The Publisher's order, as `byCategory` returns it — the same traversal the
  // sidebar's category pages are numbered by, so the two cannot disagree.
  const ordered = [...byCategory(ix.artifacts).entries()];

  const stat = (v: string | number, label: string) =>
    `<div class="st-stat"><b>${esc(String(v))}</b><span>${label}</span></div>`;

  const sections = ordered
    .map(([label, list]) => {
      const name = label ?? UNCATEGORISED;
      const id = ` id="${categoryAnchor(label)}"`;
      if (list.length > INLINE_LIMIT) {
        // Too many to inline; say so and say where they are, rather than
        // rendering a table nobody can read or silently dropping them.
        // OVER THE INLINE LIMIT — the category gets its own page.
        //
        // This block used to read "None carries a DAK API sidecar, so none has
        // an artefact page; they are reachable from the IG's own
        // `artifacts.html`." Both halves stopped being true when every
        // artefact started getting a page, and a sentence sending the reader
        // upstream for pages this site now publishes is worse than no
        // sentence. The owner's INLINE_LIMIT ruling still holds — the index
        // came to 524KB with one category 90% of it — so the list moves to a
        // page of its own rather than inline.
        return [
          `<details markdown="1"${id}>`,
          `<summary><strong>${esc(name)}</strong> — ${list.length}</summary>`,
          ``,
          `${list.length} artefacts — too many to list here without the index becoming`,
          `unreadable. Every one has its own page: **[browse all ${list.length}](./category/${categoryName(label)}.html)**.`,
          ``,
          `</details>`,
        ].join("\n");
      }
      // `markdown="1"`, or the table inside prints as rows of pipes. Kramdown
      // does not parse Markdown inside an HTML block unless told to, so the
      // whole artefact table shipped as raw text on the live index — found by
      // `check:escaped-markup`'s leaked-table scan (bean `7w1a`, 2026-09-24).
      return [
        `<details markdown="1"${id}>`,
        `<summary><strong>${esc(name)}</strong> — ${list.length}</summary>`,
        ``,
        ...artifactTable(list, "."),
        ``,
        `</details>`,
      ].join("\n");
    })
    .join("\n\n");

  const provRows = [
    ...Object.entries(ix.provenance).map(
      ([k, v]) => `| ${mdCell(k)} | \`${mdCell(Array.isArray(v) ? v.join(", ") : String(v))}\` |`,
    ),
    `| source | \`${mdCell(ix.source.kind)}\` — \`${mdCell(ix.source.of)}\` (read ${mdCell(ix.source.readAt)}) |`,
    `| canonical base | \`${mdCell(ix.canonicalBase ?? "not established")}\` |`,
  ];

  // An index derived from the IG Publisher's AST (`ast-to-artifact-index.ts`,
  // source kind `output`) is a BUILD's view, not the published IG's: say so
  // first, because a reader comparing it with the live IG will see artefacts
  // the published site does not have yet.
  const fromBuild = ix.source.kind === "output";
  const intro = fromBuild
    ? [
        // The anchor artefact pages link to instead of each printing the
        // revision (see `buildRevisionCell`).
        `<a id="${BUILD_REVISION_ID}"></a>`,
        ``,
        `> **Built from the IG Publisher AST cache**${ix.source.revision ? ` of \`${mdCell(ix.source.revision.slice(0, 12))}\`` : ""},`,
        `> not from the published IG. The AST is a cache: its indices, dependencies and`,
        `> versions are provisional until a full IG Publisher run, and it may list artefacts`,
        `> the published site does not have yet.`,
        ``,
        `The artefact index of the ${LABEL} Implementation Guide, derived from its build output.`,
        `Every artefact is held here as a compiled copy.`,
      ]
    : [
        `The artefact index of the ${LABEL} Implementation Guide, rebuilt from what the IG`,
        `publishes. Most of it is catalogued **by reference**: the index records where each artefact`,
        `lives and holds none of its bytes. An artefact page marked ${stateTag({ materialization: { state: "referenced" } } as FhirArtifact)}`,
        `is not a broken one — it means upstream, not here.`,
      ];
  const body = [
    ...intro,
    ``,
    `<div class="st-grid">`,
    stat(ix.count, "artefacts indexed"),
    stat(census.referenced, "referenced — bytes upstream"),
    stat(census.materialized, "materialized here"),
    stat(ix.version ?? "—", "IG version"),
    stat((ix.fhirVersion ?? []).join(", ") || "—", "FHIR version"),
    `</div>`,
    ``,
    `## Where this came from`,
    ``,
    ...(fromBuild
      ? [
          `This index was **derived** from the IG Publisher's AST, the build's own record of every`,
          `resource it produced, and each artefact records the AST file it came from. It was not read`,
          `back from the published IG, so where the two disagree, the published IG is the authority.`,
        ]
      : [
          `No FHIR IG publishes an artefact-index document. What looks like one —`,
          `\`ValueSets.schema.json\` at the published root — is a JSON *Schema* describing the shape of an`,
          `enumeration response, carrying an \`example\` that happens to hold the list. So this index was`,
          `**reconstructed**, and every part of it records which published file it came out of.`,
        ]),
    ``,
    `| | |`,
    `|---|---|`,
    ...provRows,
    ``,
    `## ${SIDECAR_LABEL} surface`,
    ``,
    // NOT DETERMINED is a third state, never a zero: an index that cannot see
    // the sidecars (an AST-derived one, `sidecarApi: "unknown"`) must not print
    // "0 of its artefacts", which reads as "the IG publishes none".
    ...(ix.sidecarApi === "unknown"
      ? [
          `Not determined: this index cannot see whether the IG publishes a ${SIDECAR_LABEL}`,
          `beside its artefacts${fromBuild ? " (the AST records the FHIR build only)" : ""}. Absent here does not mean absent.`,
        ]
      : [
          `The IG publishes its ${SIDECAR_LABEL} for ${sc.schema} of its artefacts. The four sidecars are issued`,
          `independently — every ValueSet gets all four, the logical models get two — which is why they`,
          `are counted separately rather than as one "has ${SIDECAR_LABEL}" tally.`,
          ``,
          `<div class="st-grid">`,
          stat(sc.schema, "JSON Schema"),
          stat(sc.displays, "displays"),
          stat(sc.openapi, "OpenAPI"),
          stat(sc.jsonld, "JSON-LD"),
          `</div>`,
        ]),
    ``,
    // Linked only when the hub page is written — the same two conditions.
    ...(hasIgApi(ix) && igApiServable().ok ? [`The [${SIDECAR_LABEL} hub](${hubPage(ix)}.html) lists them, each with its artefact and its view.`, ``] : []),
    `## Every artefact, by category`,
    ``,
    `Grouped and ordered as the IG's own \`artifacts.html\` groups them, with each artefact's name and`,
    `description. Its canonical URL, published representations and whether it is held here are on`,
    `its own page.`,
    ``,
    sections,
    ``,
  ].join("\n");

  // The layer's own declaration, ABOVE the index, when asked for. A Liquid
  // include rather than text written here: the description and the viewer
  // links are harness-tiles' answer (`site.data.harness`), and a second copy
  // of them in this page would be a second answer free to drift.
  const summary = SUMMARY
    ? `{% include harness_details.html instance=${yamlScalar(INSTANCE_NAME)} %}\n\n## Artefact index\n\n`
    : "";
  return shell(
    INDEX_TITLE,
    `All ${ix.count} artefacts of the ${LABEL} IG ${ix.version ?? ""}, ${fromBuild ? "derived from its IG Publisher AST cache" : "reconstructed from its published output"}.`,
    summary + body,
  );
}

/**
 * One artefact, as MARKDOWN.
 *
 * Headings are `##`, prose is prose, and the two fact tables are markdown
 * tables — so the theme's typography, its dark mode, its anchor links and its
 * table styling all apply, and the page is searchable by just-the-docs'
 * own index rather than being an opaque blob of HTML it copied through.
 *
 * `mdCell` is not fussiness: a markdown table row is delimited by `|`, so a
 * canonical URL or a description containing one silently splits the row into
 * an extra column. Escaping it is the difference between a table and a
 * corrupted one, and the corruption looks like a rendering bug rather than
 * like data.
 */
/**
 * The artefact table, shared by the index and by a category page.
 *
 * `base` is the prefix an `artifact/…` link needs from the page being written
 * — `.` from `index.md`, `..` from `category/X.md`. Passed rather than derived
 * so a third caller at a third depth cannot silently inherit the wrong one.
 *
 * **`.html`, never a trailing slash.** This site sets no `permalink`, so
 * Jekyll's default emits `artifact/Name.html`; a directory-style link 404s on
 * every row, and only once BUILT, which no check on the source can see. That
 * defect shipped once already (issue #824) and the only test that catches it
 * reads the href out of the page and resolves it back to a file.
 */
function artifactTable(list: FhirArtifact[], base: string): string[] {
  // The Publisher's two columns (#1901): the name, linked to the artefact's
  // page, and its description. The technical columns this table carried —
  // canonical URL, published representations, materialization — are on that
  // page already, so dropping them here loses nothing; the key stays under the
  // name because two artefacts can share a title and the key is what tells them apart.
  return [
    `| Artefact | Description |`,
    `|---|---|`,
    ...list.map((a) => {
      const nm = a.title ?? a.name ?? a.id;
      const linked = `[${mdCell(nm)}](${base}/artifact/${pageName(a)}.html)`;
      // `mdText`, not `mdCell`: a FHIR description is markdown, and a stray
      // `*` or `<` in one would otherwise restyle or swallow the row.
      const desc = a.description ? mdText(a.description).replace(/\r?\n+/g, " ") : "";
      return `| ${linked}<br>\`${mdCell(a.key)}\` | ${desc} |`;
    }),
  ];
}

/**
 * One category, listed in full, for a category too large to inline.
 *
 * Exists so that "too many to list here" can point somewhere instead of
 * pointing upstream. Before this, the 604-artefact `Other` bucket told the
 * reader to go to the IG's own `artifacts.html` — a sentence that was true
 * only while those artefacts had no pages here.
 */
/**
 * `order` is the category's position in `byCategory`, passed in rather than
 * derived here: the index page already iterates that map to build its own
 * sections, so the sidebar and the page body are ordered by ONE traversal and
 * cannot disagree about which category comes first.
 */
function categoryPage(ix: FhirArtifactIndex, label: string | undefined, list: FhirArtifact[], order: number): string {
  const name = label ?? UNCATEGORISED;
  const body = [
    `[← all ${ix.count} artefacts](${ALL_ARTEFACTS_HREF})`,
    ``,
    `## ${name}`,
    ``,
    `${list.length} of the ${ix.count} artefacts in this IG. Listed here rather than on the`,
    `index because a table this size makes the front page unreadable.`,
    ``,
    ...artifactTable(list, ".."),
    ``,
  ].join("\n");

  return shell(
    `${name} — ${LABEL}`,
    `The ${list.length} ${LABEL} artefacts in the ${name} category, with their descriptions.`,
    body,
    { kind: "section", order },
  );
}

function mdCell(v: string): string {
  return v.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/** The materialization state, as the one span whose COLOUR carries meaning. */
function stateTag(a: FhirArtifact): string {
  return a.materialization.state === "materialized"
    ? `<span class="st-tag st-held">materialized</span>`
    : `<span class="st-tag st-ref">referenced</span>`;
}

/**
 * The resource itself, for an artefact held as a compiled copy and served
 * under `--compiled-data`: a pointer the shared loader fills in the browser,
 * a visible loading state, and the raw file for a reader without JavaScript.
 * The served tree mirrors the AST directory, so the file's path is its
 * `localPath` with the AST directory's own name dropped.
 */
function compiledResourceSection(a: FhirArtifact): string[] {
  // `artifact/Name.html` → the docs root is `../` (`localResourceHref`).
  const src = localResourceHref(a, COMPILED_DATA);
  if (!src) return [];
  // The narrative is the Publisher's XHTML, whose relative links name the
  // Publisher's own pages. The loader keeps one that names a page THIS site has
  // (`ast-pages.json`, the same `Type-id` names) and sends the rest to the
  // published IG, read off this artefact's own published page.
  const html = a.published.html?.url;
  const published = html ? html.slice(0, html.lastIndexOf("/") + 1) : undefined;
  return [
    `## Resource`,
    ``,
    `<div class="ast-resource" data-ast-src="${esc(src)}" data-ast-pages="../assets/ast-pages.json"${published ? ` data-ast-published="${esc(published)}"` : ""}>`,
    `<p class="ast-state">Loading the resource from the IG Publisher AST cache…</p>`,
    `<noscript><p>This section loads in the browser. The resource is <a href="${esc(src)}">its JSON in the AST cache</a>.</p></noscript>`,
    `</div>`,
    `<script src="../assets/ast-resource.js" defer></script>`,
    ``,
  ];
}

/** The id of the index page's build-revision note, which artefact pages link to. */
const BUILD_REVISION_ID = "build-revision";

/**
 * What an artefact page says it was compiled from. The revision is printed
 * ONCE, on the index page, and an artefact built at that same revision links
 * to it: printed on every page, it made each commit rewrite all of them
 * (722 on the WHO SMART Immunizations IG, bean `c65n`), so an incremental re-render
 * redid every artefact page for a one-resource change. An artefact built at
 * a DIFFERENT revision than the index records still names its own, as does
 * every page when the index page carrying the note is not the one written
 * here (an `igSite` layer, whose index body is the IG site's own page).
 */
function buildRevisionCell(ix: FhirArtifactIndex, revision: string): string {
  return !IG_SITE && ix.source.kind === "output" && ix.source.revision === revision
    ? `the [build revision](${ALL_ARTEFACTS_HREF}#${BUILD_REVISION_ID})`
    : `\`${mdCell(revision.slice(0, 12))}\``;
}

function artifactPage(ix: FhirArtifactIndex, a: FhirArtifact): string {
  const name = a.title ?? a.name ?? a.id;
  // THE IG API SECTION — what the IG's post-processing appends to a
  // ValueSet's Publisher page ("API Information", "Endpoints"), built in the
  // browser from the OpenAPI sidecar in the served graph (bean `680p`). Only
  // for a ValueSet: the generator skips logical models, so the Publisher's
  // StructureDefinition pages carry none, and a section here would be a
  // difference from the standard render rather than a match.
  const openapi =
    a.resourceType === "ValueSet" && a.sidecars?.openapi?.localPath && igApiServable().ok
      ? { src: sidecarHref(ix, a.sidecars.openapi, "../")!, script: `../${IG_API_OPENAPI_SCRIPT}` }
      : undefined;

  const apiRows = (["schema", "displays", "openapi", "jsonld"] as const).map((k) => {
    const r = a.sidecars?.[k];
    const label = { schema: "JSON Schema", displays: "Displays", openapi: "OpenAPI", jsonld: "JSON-LD" }[k];
    if (!r) return `| ${label} | *not published for this artefact* | |`;
    // `view` only where the view page IS written: the same condition as the
    // IG API VIEW PAGES loop below. The WHO SMART Immunizations IG's index is not served,
    // so 388 of its artefact pages linked a page that did not exist.
    const view = (k === "schema" || k === "jsonld") && r.localPath && igApiServable().ok ? ` · [view](${mdCell(r.localPath.split("/").pop()!)}.html)` : "";
    const held = r.localPath ? `${ix.sidecarBase ? `<${mdCell(sidecarHref(ix, r)!)}>` : `\`${mdCell(r.localPath)}\``}${view}` : "*by reference*";
    return `| ${label} | <${mdCell(r.url)}> | ${held} |`;
  });

  const stats = [
    `<div class="st-stat"><b>${esc(a.resourceType)}</b><span>resource type</span></div>`,
    `<div class="st-stat"><b>${esc(a.version ?? "—")}</b><span>version</span></div>`,
    `<div class="st-stat"><b>${esc(a.category ?? "—")}</b><span>category</span></div>`,
    ...(a.sidecars?.codeCount !== undefined
      ? [`<div class="st-stat"><b>${a.sidecars.codeCount}</b><span>codes</span></div>`]
      : []),
    ...(a.sidecars?.propertyCount !== undefined
      ? [`<div class="st-stat"><b>${a.sidecars.propertyCount}</b><span>properties</span></div>`]
      : []),
  ].join("");

  const body = [
    // `../` from `artifact/Name.html` is the mount root, which the server
    // resolves to its `index.html`.
    `[← all ${ix.count} artefacts](${ALL_ARTEFACTS_HREF})`,
    ``,
    `## ${name}`,
    ``,
    `\`${a.key}\``,
    ``,
    // Rebased: the description's links name IG pages at the root, one level up.
    ...(a.description ? [rebaseDescriptionLinks(a.description, IG_SITE ? "../" : null), ``] : []),
    `<div class="st-grid">${stats}</div>`,
    ``,
    `## Identity and bytes are different questions`,
    ``,
    `| | |`,
    `|---|---|`,
    `| Canonical URL | ${a.canonical ? `\`${mdCell(a.canonical)}\`` : "*none — examples and instances have no canonical URL*"} |`,
    `| Published | ${mdCell(repLinks(a))} |`,
    `| Materialization | ${stateTag(a)} — ${
      a.materialization.state === "materialized"
        ? a.materialization.purpose === "compiled" && a.materialization.inputs
          ? // A compiled copy (an IG Publisher AST) is regenerated by the BUILD,
            // not by an ingest; and it is a cache, so it says what it was built
            // from and that it stands only until a full Publisher run.
            `compiled copy of ${buildRevisionCell(ix, a.materialization.inputs.sourceRevision)} by ${mdCell(a.materialization.inputs.toolchain)} — a cache, provisional until a full IG Publisher run`
          : `${mdCell(a.materialization.purpose ?? "")} copy, regenerable by re-running the ingest`
        : "upstream, not held here"
    } |`,
    ``,
    ...compiledResourceSection(a),
    // The sidecar table is worth a screen when there ARE sidecars. On the 655
    // artefacts with none it was four rows of "*not published for this
    // artefact*", which is noise dressed as information — so the absence is
    // stated in one line instead, and it is STATED rather than omitted,
    // because a missing section reads as "nobody looked".
    ...(a.sidecars
      ? [
          `## ${SIDECAR_LABEL}`,
          ``,
          `The four sidecars are published independently, so an absent one is a fact about the`,
          `IG rather than a gap in this index.`,
          ``,
          `| Sidecar | Published at | Held locally |`,
          `|---|---|---|`,
          ...apiRows,
          ``,
        ]
      : [
          `## ${SIDECAR_LABEL}`,
          ``,
          ...(ix.sidecarApi === "unknown"
            ? [`Not determined: this index cannot see whether a ${SIDECAR_LABEL} sidecar is published for this artefact.`]
            : [
                `No ${SIDECAR_LABEL} sidecar is published for this artefact. That is a fact about the IG,`,
                `not a gap in this index — sidecars are published per artefact, and`,
                `${ix.artifacts.filter((x) => x.sidecars).length} of ${ix.count} carry one.`,
              ]),
          ``,
        ]),
  ].join("\n");

  return shell(
    `${name} — ${LABEL} artefact`,
    `${a.key} in the ${LABEL} IG, with its canonical URL, published representations and ${SIDECAR_LABEL} sidecars.`,
    openapi ? `${body}\n\n${IG_API_OPENAPI_BODY}` : body,
    { kind: "leaf" },
    "fixture",
    openapi ? { ig_api_openapi: openapi } : {},
  );
}

/**
 * One page per top-level menu group — which is how the IG's TOP BAR becomes a
 * LEFT-HAND nav.
 *
 * The owner, 2026-09-23: *"navar menu is now on LHS"*. just-the-docs builds
 * its sidebar from the PAGES in the collection, so an entry in it has to be a
 * page; there is no per-folio hook for a bare external link. A page per group
 * is therefore the mechanism, not a workaround — and it is the honest one,
 * because each group genuinely has something to say: the list of its members
 * and where they are published.
 *
 * **Every link points UPSTREAM, and that is not a shortfall.** These pages are
 * published by the IG Publisher and this repository does not hold them — the
 * gh-pages harvest kept 674 FHIR artefacts and none of the narrative pages
 * (measured: 0 of 12 menu labels matched an artefact title). A page here that
 * pretended to hold `system-actors.html` would be fabricating content; one
 * that links to the canonical copy is a navigation aid, which is what a menu
 * is.
 */
function menuGroupPage(menu: IgMenu, group: IgMenuGroup, order: number): string {
  const rows = group.items.map((it) => `- [${mdCell(it.label)}](${menuHref(menu, it)})`);
  const body = [
    `[← all ${menu.groups.length} sections](../)`,
    ``,
    ...(group.items.length > 0
      ? rows
      : [
          // A group the config declares with no children. Stated, because an
          // empty list and a page that failed to render look the same.
          `*${mdCell(group.label)} carries no sub-items in \`sushi-config.yaml\`.*`,
        ]),
    ``,
    ...(group.href ? [`This section's own page: [${mdCell(group.label)}](${menuHref(menu, { href: group.href })}).`, ``] : []),
    `Published by the IG at \`${menu.canonical}\`. This repository holds the IG's`,
    `artefacts, not its narrative pages, so every link above leaves for the canonical copy.`,
  ].join("\n");
  return shell(
    `${group.label} — ${LABEL}`,
    `The ${group.items.length} page(s) the ${LABEL} IG publishes under ${group.label}.`,
    body,
    { kind: "section", order },
  );
}

/** A filename-safe slug, on the same rule `categoryName` uses. */
function menuName(label: string): string {
  return label.replace(/[^A-Za-z0-9._-]/g, "_");
}

// ── Build ──────────────────────────────────────────────────────────────
if (!existsSync(INDEX)) {
  console.error(`could not determine: no artefact index at ${INDEX}`);
  console.error("  Nothing was rendered, and this is NOT a clean run. Run `bun run cat ig-index:build` first.");
  process.exit(2);
}

const parsed = FhirArtifactIndexSchema.safeParse(JSON.parse(readFileSync(INDEX, "utf8")));
if (!parsed.success) {
  console.error("the committed artefact index does not validate — refusing to render pages from it:");
  for (const i of parsed.error.issues.slice(0, 5)) console.error(`  ${i.path.join(".")}: ${i.message}`);
  process.exit(1);
}
const ix = parsed.data;
const IX = ix;
if (LABEL_ARG === undefined && ix.packageId) {
  LABEL = ix.packageId;
  INDEX_TITLE = titleFor(LABEL);
}

// `--site`: THE ROUTE PAGES AND NOTHING ELSE. Before a single docs page is
// built, so nothing below can reach the layer or a committed docs tree.
if (SITE !== undefined) {
  const routes = declaredRoutePages(SITE);
  if (CHECK) {
    const stale = routes.filter((r) => !existsSync(r.abs) || readFileSync(r.abs, "utf8") !== r.html);
    for (const r of stale) console.error(`✗ ${relative(SITE, r.abs)} — a declared route's page — is stale or missing under ${SITE}.`);
    if (stale.length > 0) process.exit(1);
    console.log(`✓ ${routes.length} declared route page(s) current under ${SITE}`);
  } else {
    for (const r of routes) {
      mkdirSync(join(r.abs, ".."), { recursive: true });
      writeFileSync(r.abs, r.html);
      console.log(`  declared route → ${relative(SITE, r.abs)}`);
    }
    console.log(`${INSTANCE_NAME}: ${routes.length} declared route page(s) written into the site; docs/ not written (--site)`);
  }
  if (routes.length === 0) console.log(`  · ${INSTANCE_NAME} declares no visualiser rendered by ig-pages that covers it — nothing to write`);
  process.exit(0);
}

const pages = new Map<string, string>();
// WRITTEN AS `.md`, LINKED AS `.html` — and the mismatch is correct. Jekyll
// renders `index.md` to `index.html`, so every in-page href above keeps
// pointing at the URL that will exist. Writing `.html` here instead would ask
// Jekyll to copy the file verbatim, which is the behaviour this change exists
// to stop.
pages.set("index.md", indexPage(ix));
pages.set(PAGES_CSS, `${CSS.trim()}\n`);
if (CHROME !== undefined) pages.set(CHROME_CSS, `${chromeStyles(CHROME).trim()}\n`);

// PROVENANCE ONLY. Until 2026-10-09 the index page said which directory it
// rendered (`renders:`), and that was how a tile found it. The owner then
// ruled that the HARNESS declares each visualiser (`visualisers` in the
// layer's declaration, `renderedBy: ig-pages`) at
// `<base>/<harness>/<visualiser>/`, so a page claims nothing and names only
// the Tool that drew it.
pages.set("index.md", withRenderedByFrontMatter(pages.get("index.md")!, "ig-pages"));

// EVERY artefact, not only the sidecar-bearing ones. The owner's call,
// 2026-09-22: full parity with the Publisher's 673 artefact pages, against a
// recommendation to render only the 70 conformance artefacts and leave the 604
// Endpoint/Organization registry rows as index rows. Recorded because the
// trade-off is real and the reasoning should not have to be reconstructed:
// 454 of those 604 carry no `description`, so their pages are a title and four
// upstream links.
for (const a of ix.artifacts) {
  pages.set(join("artifact", `${pageName(a)}.md`), artifactPage(ix, a));
}
// The shared loader, published once beside the pages (never inlined in each)
// and only when a page points at it.
if ([...pages.values()].some((p) => p.includes("data-ast-src="))) {
  pages.set(join("assets", "ast-resource.js"), readFileSync(AST_LOADER, "utf8"));
  pages.set(
    join("assets", "ast-pages.json"),
    `${JSON.stringify(ix.artifacts.map((a) => `${pageName(a)}.html`).sort())}\n`,
  );
}

// THE IG API VIEW PAGES — the Publisher's `<Name>.schema.json.html` and
// `<Name>.jsonld.html` (bean `jut3`'s parity table: 33 on the WHO SMART Trust IG). Each is
// the raw file, published beside its page so Raw and Download resolve where
// the Publisher's do, plus a page that is the Liquid template over data
// `ig-api-views.ts` computed. The file's text is fetched in the browser by one
// shared loader, never copied into the page (bean `680p`). An IG with no IG API
// overlay writes none of these.
//
// The pages FETCH from the served artefact-index graph (owner, 2026-10-01:
// publish the graph directory rather than copy its files beside the pages).
// That needs two declarations, and without either the pages would link data
// that is not on the site — so they are not written, and the run says why.
const igApiViewTemplate = readFileSync(IG_API_VIEW_TEMPLATE, "utf8");
const igApiServing = igApiServable();
let igApiViewCount = 0;
if (igApiServing.ok === false && ix.artifacts.some((a) => igApiViews(a).length > 0)) {
  console.log(`  IG API view pages NOT written: ${igApiServing.why}`);
}
for (const a of igApiServing.ok ? ix.artifacts : []) {
  for (const v of igApiViews(a)) {
    const data = igApiViewData(a, v, "../", Boolean(ix.package?.localPath), ix.sidecarBase);
    igApiViewCount += 1;
    pages.set(
      join("artifact", `${v.file}.md`),
      shell(
        `${data.artifact.title} — ${v.label}`,
        `The ${v.label} sidecar of ${a.key}, from the IG's ${SIDECAR_LABEL}.`,
        igApiViewTemplate,
        { kind: "leaf" },
        "fixture",
        { ig_api: data },
      ),
    );
  }
}
if (igApiViewCount > 0) pages.set(IG_API_VIEW_SCRIPT, readFileSync(IG_API_VIEW_LOADER, "utf8"));

// THE JSON VIEW PAGES — the Publisher's `<Name>.json.html` (672 on
// the WHO SMART Trust IG). Each reads its resource out of the IG's package.tgz, held in
// the served graph, in the browser; no resource is copied (bean `680p`).
// Without a held package, or a served graph, none is written and the run says so.
let jsonViewCount = 0;
if (ix.artifacts.some(hasJsonView)) {
  if (!ix.package?.localPath) console.log("  JSON view pages NOT written: the index holds no package (re-ingest with --materialize-package)");
  else if (!igApiServing.ok) console.log(`  JSON view pages NOT written: ${igApiServing.why}`);
  else {
    const template = readFileSync(JSON_VIEW_TEMPLATE, "utf8");
    for (const a of ix.artifacts.filter(hasJsonView)) {
      const extra = igApiViews(a).map((v) => ({ label: v.label, href: `${v.file}.html`, active: false }));
      const data = jsonViewData(a, ix.package.localPath, extra);
      pages.set(
        join("artifact", `${pageName(a)}.json.md`),
        shell(`${a.title ?? a.name ?? a.id} — JSON`, `The JSON representation of ${a.key}.`, template, { kind: "leaf" }, "fixture", { json_view: data }),
      );
      jsonViewCount += 1;
    }
    pages.set(JSON_VIEW_SCRIPT, readFileSync(JSON_VIEW_LOADER, "utf8"));
  }
}

// THE TAB PAGES — `.change.history` (672 on the WHO SMART Trust IG), `-testing` (69) and a
// logical model's `.profile.history`, `.profile.json` and `-examples` — from
// the resource itself, read out of the same held package at generation time.
// Each states only what the Publisher's states; a page whose Publisher form
// would list data this build cannot (tests, examples) is not written.
const tabCounts = { history: 0, testing: 0, profileHistory: 0, profileJson: 0, examples: 0, mappings: 0 };
/** The THIN tab views written (`ig-thin-pages.ts` `thinArtifactView`), by view. */
const thinTabCounts = { definitions: 0, mappings: 0, json: 0, jsonld: 0, schema: 0, examples: 0 };
/**
 * The resource's JSON as this site serves it, relative to an artefact page,
 * when no compiled copy is: the Publisher's own file under `--publisher-data`,
 * by the name its published JSON has. Undefined otherwise.
 */
function servedResource(a: FhirArtifact): string | undefined {
  if (PUBLISHER_DATA === undefined || localResourceHref(a, COMPILED_DATA) !== undefined) return undefined;
  const url = a.published.json?.url;
  if (!url) return undefined;
  const file = decodeURIComponent(url.split(/[?#]/)[0]!.split("/").pop() ?? "");
  return file ? posix.normalize(`../${PUBLISHER_DATA}/${file}`) : undefined;
}
if (ix.package?.localPath && igApiServing.ok) {
  const entries = packageEntries(layerFileReadPath(INSTANCE, ix.package.localPath));
  const resources = [...entries.values()].map((b) => JSON.parse(b.toString("utf8")) as Record<string, unknown>);
  const hasTests = resources.some((r) => r.resourceType === "TestPlan" || r.resourceType === "TestScript");
  const claimed = new Set(resources.flatMap((r) => ((r.meta as { profile?: string[] } | undefined)?.profile ?? [])));
  const tabTemplate = readFileSync(TAB_PAGE_TEMPLATE, "utf8");
  const mappingsTemplate = readFileSync(MAPPINGS_TEMPLATE, "utf8");
  const igStructures = new Set(resources.filter((r) => r.resourceType === "StructureDefinition" && typeof r.url === "string").map((r) => r.url as string));
  const jsonTemplate = readFileSync(JSON_VIEW_TEMPLATE, "utf8");
  const tabPage = (file: string, title: string, p: TabPageData | undefined, count: keyof typeof tabCounts) => {
    if (!p) return;
    const data = { ...p, heading: mdText(p.heading), status: p.status, sections: p.sections.map((x) => ({ ...x, text: mdText(x.text) })) };
    pages.set(join("artifact", file), shell(title, `${p.heading}.`, tabTemplate, { kind: "leaf" }, "fixture", { tab_page: data }));
    tabCounts[count] += 1;
  };
  for (const a of ix.artifacts) {
    const raw = entries.get(`package/${a.resourceType}-${a.id}.json`);
    if (!raw) continue;
    const f = resourceFacts(JSON.parse(raw.toString("utf8")));
    const stem = pageName(a);
    const igApiTabs = igApiViews(a).map((v) => ({ label: v.label, href: `${v.file}.html`, active: false }));
    const name = a.title ?? a.name ?? a.id;
    if (a.resourceType === "StructureDefinition") {
      const tabs = resourceTabs(a, igApiTabs, true);
      // No link from a mapping row to an element's definition: that page is
      // the Publisher's `-definitions.html` (it needs hl7.fhir.r5.core's
      // base-type text, which this build cannot hold — bean wnhh), not written
      // here, so every such link was dead (owner, 2026-10-09).
      const m = mappingsPage(JSON.parse(raw.toString("utf8")), f, resourceTabs(a, igApiTabs, true, "Mappings"), igStructures);
      if (m) {
        const esc = (t: { rows: Array<{ label: string; value: string }> }) => ({ ...t, rows: t.rows.map((r) => ({ ...r, label: mdText(r.label), value: mdText(r.value) })) });
        const data = { ...m, heading: mdText(m.heading), intro: mdText(m.intro), inIg: m.inIg.map(esc), toOther: m.toOther.map(esc), other: m.other.map(esc) };
        pages.set(join("artifact", `${stem}-mappings.md`), shell(`${name} — mappings`, `${m.heading}.`, mappingsTemplate, { kind: "leaf" }, "fixture", { mappings: data }));
        tabCounts.mappings += 1;
      }
      tabPage(`${stem}.profile.history.md`, `${name} — change history`, historyPage(a, f, tabs), "profileHistory");
      tabPage(`${stem}-examples.md`, `${name} — examples`, examplesPage(f, tabs, f.url !== undefined && claimed.has(f.url)), "examples");
      const pj = profileJsonViewData(a, f, ix.package.localPath, resourceTabs(a, igApiTabs, true, "JSON"));
      if (pj) {
        pages.set(join("artifact", `${stem}.profile.json.md`), shell(`${name} — JSON profile`, `The JSON representation of ${a.key}.`, jsonTemplate, { kind: "leaf" }, "fixture", { json_view: { ...pj, heading: mdText(pj.heading), intro: pj.intro && mdText(pj.intro) } }));
        tabCounts.profileJson += 1;
      }
    } else if (hasJsonView(a)) {
      tabPage(`${stem}.change.history.md`, `${name} — change history`, historyPage(a, f, resourceTabs(a, igApiTabs, true)), "history");
    }
    tabPage(`${stem}-testing.md`, `${name} — testing`, testingPage(f, resourceTabs(a, igApiTabs, true), hasTests), "testing");
  }
}
if ([...pages.values()].some((p) => p.includes("data-ig-api-openapi-src"))) pages.set(IG_API_OPENAPI_SCRIPT, readFileSync(IG_API_OPENAPI_LOADER, "utf8"));

// THE IG API HUB (owner, 2026-10-01: "replicate dak-api.html seperately").
if (hasIgApi(ix) && igApiServing.ok) {
  // The hub from the index (bean `h7ap`): no Publisher fragment, the node the
  // index's bound sidecars make, drawn by one loader. In an IG site the IG's own
  // hub page holds the placeholder, and `stage-ig-sites` fills it from the same node.
  pages.set(IG_API_HUB_NODE, igApiHubNodeJson(ix, SIDECAR_LABEL));
  pages.set(IG_API_HUB_NODE_SCRIPT, readFileSync(IG_API_HUB_NODE_LOADER, "utf8"));
  pages.set(
    `${hubPage(ix)}.md`,
    shell(
      `${SIDECAR_LABEL} Documentation Hub`,
      `The ${LABEL} IG's ${SIDECAR_LABEL} hub: every sidecar, with its artefact and its view.`,
      igApiHubBody(SIDECAR_LABEL, ""),
      { kind: "leaf" },
      "fixture",
    ),
  );
}

// A page for each category too large to inline, so "too many to list here"
// points somewhere. Driven by the SAME `INLINE_LIMIT` comparison the index
// makes — one threshold, read twice, rather than two that can disagree.
// THE IG'S MENU, FIRST IN THE SIDEBAR — it is the IG's own ordering of itself,
// and the artefact categories are this repository's view on top of it.
let sectionOrder = 0;
let menu: IgMenu | undefined;
if (existsSync(MENU)) {
  const m = IgMenuSchema.safeParse(JSON.parse(readFileSync(MENU, "utf8")));
  if (!m.success) {
    console.error("the committed IG menu does not validate — refusing to render nav from it:");
    for (const i of m.error.issues.slice(0, 5)) console.error(`  ${i.path.join(".")}: ${i.message}`);
    process.exit(1);
  }
  menu = m.data;
  for (const group of menu.groups) {
    sectionOrder += 1;
    pages.set(join("menu", `${menuName(group.label)}.md`), menuGroupPage(menu, group, sectionOrder));
  }
}

// THE FOOTER'S DATA, once per IG, from the IG's own package when it is held
// (`ig-footer.ts` says which field comes from where), and the footer's
// <prev | next> through the index's reading order: the index, then every
// artefact page in the order the index lists them — the Publisher's own
// order through `artifacts.html`.
{
  // Held means ON DISK: an index can name a package its checkout does not
  // carry (a scratch copy, a sparse clone), and then the footer says less
  // rather than the run failing.
  const pkgPath = ix.package?.localPath ? layerFileReadPath(INSTANCE, ix.package.localPath) : undefined;
  const held = pkgPath && existsSync(pkgPath) ? packageEntries(pkgPath) : undefined;
  const json = (name: string | undefined) => (name && held?.has(name) ? (JSON.parse(held.get(name)!.toString("utf8")) as Record<string, unknown>) : undefined);
  const igEntry = held ? [...held.keys()].find((k) => /^package\/ImplementationGuide-[^/]+\.json$/.test(k)) : undefined;
  pages.set(IG_FOOTER_DATA, `${JSON.stringify(igFooterData(json("package/package.json"), json(igEntry), ix), null, 2)}\n`);
  // The loader only where no IG site draws the footer: an IG site's pages
  // flag it instead, and the data file stays as `stage-ig-sites`' input.
  if (!IG_SITE) pages.set(IG_FOOTER_SCRIPT, readFileSync(IG_FOOTER_LOADER, "utf8"));

  const order = ["index.md", ...[...byCategory(ix.artifacts).values()].flat().map((a) => join("artifact", `${pageName(a)}.md`))];
  const href = (from: string, to: string): string => {
    // `index.md` is served as its directory, so a link to it ends in `/`.
    const rel = posix.relative(posix.dirname(from), to.replace(/\.md$/, ".html"));
    return to === "index.md" ? rel.replace(/index\.html$/, "") || "./" : rel;
  };
  const position = new Map(order.map((page, i) => [page, i]));
  if (IG_SITE) {
    // Front matter the IG site's footer include reads: the page's previous
    // and next pages, relative to the page as an IG site page's are, and the
    // way up to the site root, which the include puts before every on-site
    // link it holds (`toc.html`, the stylesheets) — those are written once,
    // relative to the root, for every page of the site.
    for (const [page, text] of pages) {
      if (!text.startsWith("---\n") || !text.includes(`\n${IG_FOOTER_FLAG}\n`)) continue;
      const i = position.get(page);
      const up = posix.relative(posix.dirname(page.split(sep).join("/")), ".");
      const fm = [
        ...(up ? [`ig_root: ${yamlScalar(`${up}/`)}`] : []),
        ...(i !== undefined && i > 0 ? [`ig_prev: ${yamlScalar(href(page, order[i - 1]!))}`] : []),
        ...(i !== undefined && i < order.length - 1 ? [`ig_next: ${yamlScalar(href(page, order[i + 1]!))}`] : []),
      ];
      if (fm.length) pages.set(page, text.replace(`\n${IG_FOOTER_FLAG}\n`, `\n${IG_FOOTER_FLAG}\n${fm.join("\n")}\n`));
    }
  } else {
    order.forEach((page, i) => {
      const text = pages.get(page);
      if (text === undefined) return;
      const attrs = [
        i > 0 ? ` data-prev="${esc(href(page, order[i - 1]!))}"` : "",
        i < order.length - 1 ? ` data-next="${esc(href(page, order[i + 1]!))}"` : "",
      ].join("");
      pages.set(page, text.replace(FOOTER_TAG, `${FOOTER_TAG}${attrs}`));
    });
  }

  // THE THIN PAGES replace the full artefact pages built above, at the same
  // addresses and in the same reading order, so every link computed from the
  // full pages — the footer's, the narrative's, the IG site's artifacts
  // page — still lands. Built from the full pages' order rather than beside
  // it: one order, read once.
  if (THIN) {
    const astPages: string[] = [];
    let served = 0;
    for (const a of ix.artifacts) {
      const md = join("artifact", `${pageName(a)}.md`);
      const i = position.get(md);
      pages.delete(md);
      const resource = servedResource(a);
      // The IG API sidecars the page's JSON-LD and schema views draw, where the site serves them.
      const sidecars: Partial<Record<SidecarView, string>> = {};
      if (igApiServing.ok) for (const k of ["jsonld", "schema"] as const) if (a.sidecars?.[k]?.localPath) sidecars[k] = sidecarHref(ix, a.sidecars[k], "../")!;
      const reads = resource !== undefined || localResourceHref(a, COMPILED_DATA) !== undefined;
      const tabs = artifactTabs(a, { resource: reads, sidecars: Object.keys(sidecars) as SidecarView[], history: reads && AST_HISTORY !== undefined });
      const opts = {
        label: LABEL,
        home: IG_SITE ? "../index.html" : "../",
        all: ALL_ARTEFACTS_HREF,
        ...(IG_SITE ? { toc: "../toc.html" } : {}),
        ...(i !== undefined && i > 0 ? { prev: href(md, order[i - 1]!) } : {}),
        ...(i !== undefined && i < order.length - 1 ? { next: href(md, order[i + 1]!) } : {}),
        ...(COMPILED_DATA ? { compiledData: COMPILED_DATA } : {}),
        ...(resource ? { resource } : {}),
        ...(tabs.length ? { tabs, index: ARTIFACT_INDEX_FILE } : {}),
        ...(Object.keys(sidecars).length ? { sidecars } : {}),
        ...(AST_HISTORY !== undefined && AST_REPOSITORY !== undefined ? { history: { versions: AST_HISTORY, repository: AST_REPOSITORY } } : {}),
        ...(SEARCH ? { search: { index: `../${IG_SEARCH_INDEX_FILE}`, script: `../${IG_SEARCH_SCRIPT_FILE}` } } : {}),
      };
      if (resource) served += 1;
      pages.set(thinArtifactPath(a), thinArtifactView(ix, a, "content", opts));
      astPages.push(`${pageName(a)}.html`);
      // ONE PAGE PER ARTEFACT (owner, 2026-11-10, fhir-harness#325 step 3): the
      // artefact's page draws every view (`?view=`), and each view's old file
      // name, the Publisher's, is a redirect stub to it, replacing the full
      // tab page, the JSON view and the IG API view page written above.
      for (const t of tabs) {
        // The History view is new: no old file name to keep.
        if (t.view === "content" || t.view === "history") continue;
        pages.delete(join("artifact", t.file.replace(/\.html$/, ".md")));
        pages.set(join("artifact", t.file), thinViewRedirect(a, t.view));
        astPages.push(t.file);
        thinTabCounts[t.view as keyof typeof thinTabCounts] += 1;
      }
      // An IG API view page named for its sidecar file, where that differs from the view's name.
      for (const v of igApiViews(a)) {
        const view: SidecarView = v.file.endsWith(".jsonld") ? "jsonld" : "schema";
        pages.delete(join("artifact", `${v.file}.md`));
        if (!pages.has(join("artifact", `${v.file}.html`)) && tabs.some((t) => t.view === view)) pages.set(join("artifact", `${v.file}.html`), thinViewRedirect(a, view));
      }
    }
    // The AST loader, and the list of this site's own artefact pages it keeps
    // a narrative's link to, once any page draws a resource.
    if (astPages.length > ix.artifacts.length || served > 0) {
      pages.set(join("assets", "ast-resource.js"), readFileSync(AST_LOADER, "utf8"));
      pages.set(join("assets", "ast-pages.json"), `${JSON.stringify([...new Set(astPages)].sort())}\n`);
    }
    for (const [rel, text] of artifactJsonLdFiles(ix, { ...(JSONLD_BASE ? { base: JSONLD_BASE } : {}), ...(COMPILED_DATA ? { compiledData: COMPILED_DATA } : {}), ...(ROOT_RESOURCES ? { rootResources: true } : {}), title: LABEL })) {
      pages.set(rel, text);
    }
    pages.set(THIN_PAGE_SCRIPT, readFileSync(THIN_RENDERER, "utf8"));
    // The generic renderer the artefact pages declare their node for (cat-harness-tools#1830).
    pages.set(THIN_PAGE_RENDERER, kgRenderScript());
    pages.set(THIN_PAGE_STYLE, readFileSync(THIN_STYLE, "utf8"));
    // The shared page layout every thin page links before its own stylesheet
    // (cat-harness-tools `page-layout.ts`): one width, one bar, one scroll.
    pages.set(PAGE_LAYOUT_CSS_FILE, readFileSync(PAGE_LAYOUT_CSS_SOURCE, "utf8"));
    pages.set(PAGE_LAYOUT_JS_FILE, readFileSync(PAGE_LAYOUT_JS_SOURCE, "utf8"));
  }
}

for (const [label, list] of byCategory(ix.artifacts)) {
  if (list.length > INLINE_LIMIT) {
    sectionOrder += 1;
    pages.set(join("category", `${categoryName(label)}.md`), categoryPage(ix, label, list, sectionOrder));
  }
}

// AN IG-SITE LAYER'S OWN NAVIGATION IS THE IG'S (bean `mftp`). Its index,
// toc and artifacts pages, its menu sections and its IG API hub page are written
// by `build-ig-site` from the IG's source and menu, so the copies above would
// be a second index, a second menu and a second hub at the same URLs. Built
// above and dropped here, rather than not built, so the footer's reading
// order and every link computed from them are the same in both layouts.
// The CSS, scripts and artefact pages stay: the IG site carries them.
if (IG_SITE) {
  for (const k of [...pages.keys()]) {
    if (k === "index.md" || k.startsWith("menu/") || k.startsWith("category/") || (hasIgApi(ix) && k === `${hubPage(ix)}.md`)) pages.delete(k);
  }
  // THE PROVENANCE MOVES WITH THE INDEX. In the IG site the artefact index is
  // the IG's own `artifacts` page, which `build-ig-site` writes from data and
  // nothing commits. This writes its front matter only — title and
  // `rendered-by` — and `stage-ig-sites` lays it onto that generated page
  // (`copyDocsInto`). It no longer says what it renders: the layer's
  // declared `visualisers` do (owner, 2026-10-09).
  // Thin, the IG site's `artifacts.html` is a finished page with no front
  // matter to lay this on; it carries `rendered-by` itself (`build-ig-site`).
  if (!THIN && directoriesForGraph(INSTANCE, "fhir-artifact-index").length > 0) {
    pages.set(
      ARTIFACTS_FRONT_MATTER_PAGE,
      `${["---", `title: ${yamlScalar(`${LABEL} — artefact index`)}`, "rendered-by: ig-pages", "---"].join("\n")}\n`,
    );
  }
}

function committed(): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string, prefix = ""): void => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((x, y) => x.name.localeCompare(y.name))) {
      if (e.name.startsWith(".")) continue;
      const rel = prefix ? join(prefix, e.name) : e.name;
      // The directory's own README is written by `subgraph-readmes`, not by
      // this generator, so it is neither one of these pages nor an orphan.
      if (!e.isDirectory() && isDirectoryReadme(rel)) continue;
      if (e.isDirectory()) walk(join(dir, e.name), rel);
      else out.set(rel, readFileSync(join(dir, e.name), "utf8"));
    }
  };
  walk(OUT);
  return out;
}

/**
 * The declared id of the directory these pages are written to, or `undefined`
 * when `--out` points somewhere no declaration names. Keyed by ID so that moving
 * the pages to `cat/fhir-harness/ig-docs` (bean lbz8) is a declaration edit
 * (`storage: { branch, keyedBy: "route" }`), not a change here.
 */
function docsDirectoryId(): string | undefined {
  const norm = (p: string) => resolve(p).replace(/\/+$/, "");
  return readDeclaration(INSTANCE)?.directories?.find((d) => norm(join(INSTANCE, d.path)) === norm(OUT))?.id;
}

// EVERY SAME-DIRECTORY LINK A GENERATED PAGE MAKES IS TO A PAGE THIS RUN
// WRITES. A generator that links a page it decided not to write ships a dead
// link on every artefact page — 388 on the WHO SMART Immunizations IG, measured on its
// published site, 2026-10-05 — and nothing downstream says so: the IG's own
// pages are not this generator's, so only links within `artifact/` (and the
// root) are judged here, where every target is one of `pages`.
{
  const written = new Set([...pages.keys()].map((k) => k.split(sep).join("/").replace(/\.md$/, ".html")));
  const dangling: string[] = [];
  for (const [rel, text] of pages) {
    if (!/\.(md|html)$/.test(rel)) continue;
    const dir = rel.split(sep).slice(0, -1).join("/");
    for (const m of text.matchAll(/(?:\]\(|href=")([^)"#?\s]+\.html)(?:[#?][^)"\s]*)?[)"]/g)) {
      const target = m[1]!;
      if (/^[a-z]+:|^\/|^\.\.\//.test(target) || target.includes("{")) continue;
      const resolved = posix.normalize(dir ? `${dir}/${target}` : target);
      if (!written.has(resolved)) dangling.push(`${rel.split(sep).join("/")} → ${target}`);
    }
  }
  if (dangling.length > 0) {
    console.error(`✗ ${dangling.length} link(s) to a page this run does not write:`);
    for (const d of dangling.slice(0, 10)) console.error(`    ${d}`);
    if (dangling.length > 10) console.error(`    …and ${dangling.length - 10} more`);
    process.exit(1);
  }
}

// THE DECLARED ROUTE (owner, 2026-10-09: "<base URL>/<harness>/<visualizer>").
// A layer that declares a visualiser `renderedBy: ig-pages` gets a page at
// that route — `<site>/<instance>/<id>/` in the site's docs layer, from
// `visualiserRoute` and nothing else — which sends a reader to the artefact
// index this generator (or, for an IG site, the Publisher) draws: the IG's own
// `artifacts.html`, or this layer's index. The index stays where the IG
// puts it; the route is where the declaration says it is, and it always works.
const ROUTE_REPO = checkoutRootFor(INSTANCE);
const routePages = declaredRoutePages();

/**
 * The page at each declared route of a visualiser `renderedBy: ig-pages`.
 *
 * Without a site: under the checkout's own site directory, at the route as
 * declared, each a redirect to the artefact index this generator (or, for an
 * IG site, the Publisher) draws at `<instance>/`.
 *
 * With `site` (`--site`): under that site, at the route WITH its locale
 * (`pageParts`, the one place a page's locale is supplied), placed by the
 * shared `visualiserPageDir`. Each redirects to the IG's artefact index when
 * the site carries it; otherwise it IS the index — every artefact, linked to
 * where the IG publishes it — because a redirect to a page the site does not
 * hold is a dead link, and an unresolved link refuses the site's publish.
 */
function declaredRoutePages(site?: string): { abs: string; html: string }[] {
  const out: { abs: string; html: string }[] = [];
  // Resolved here, not read from `ROUTE_REPO`: the `--site` run calls this
  // before that constant is initialised.
  const repo = checkoutRootFor(INSTANCE);
  const here = IG_SITE ? "artifacts.html" : "";
  const title = `${LABEL} — artefact index`;
  const place = (parts: { harness: string; visualiser: string; subgraph?: string }): { abs: string; html: string } => {
    if (site === undefined) {
      return {
        abs: join(siteOwnerDir(repo), ...visualiserRoute(parts).split("/").filter(Boolean), "index.html"),
        html: routeRedirect(`${siteRootFrom(parts)}${INSTANCE_NAME}/${here}`, title),
      };
    }
    const local = pageParts(parts);
    const abs = join(visualiserPageDir(site, local), "index.html");
    const indexHref = `${INSTANCE_NAME}/${here}`;
    return { abs, html: sitePageAt(site, indexHref) ? routeRedirect(`${siteRootFrom(local)}${indexHref}`, title) : artefactIndexPage(IX, title) };
  };
  for (const v of declaredVisualisers(repo).filter((d) => d.renderedBy === "ig-pages")) {
    const parts = { harness: v.harness, visualiser: v.id };
    // Its own harness: the full view at `<base>/<harness>/<id>/` opens this
    // layer's artefact index.
    if (v.harness === INSTANCE_NAME) out.push(place(parts));
    // A harness covering the KIND per layer (`subgraphs: "instance"`):
    // this layer's sub-graph view, `<base>/<harness>/<id>/<instance>/`.
    // An IG layer declares no `fhir-artifact-index` directory since #124:
    // its index is built at publish (`ig-index:build`), so the index on disk
    // counts as well as a declared directory. The coverage gate counts it too,
    // and without this the site was refused for the missing page
    // (smart-base-clinical, 2026-10-30).
    const hasIndex = directoriesForGraph(INSTANCE, "fhir-artifact-index").length > 0 || existsSync(INDEX);
    if (v.subgraphs === "instance" && (v.coversKinds ?? []).includes("fhir-artifact-index") && hasIndex) {
      out.push(place({ ...parts, subgraph: INSTANCE_NAME }));
    }
  }
  return out;
}

/**
 * The IG's artefact index as one standalone page, for a site that does not
 * carry the index itself: every artefact by type, each linked to the page the
 * IG publishes it at (its canonical URL where it names none). Every link is
 * absolute and upstream, so the page holds no link the site must resolve.
 */
function artefactIndexPage(ix: FhirArtifactIndex, title: string): string {
  const e = (v: string): string => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const link = (href: string | undefined, text: string): string => (href !== undefined && /^https?:\/\//.test(href) ? `<a href="${e(href)}">${e(text)}</a>` : e(text));
  const rows = [...ix.artifacts]
    .sort((a, b) => a.resourceType.localeCompare(b.resourceType) || a.id.localeCompare(b.id))
    .map((a) => {
      const label = a.title ?? a.name ?? a.id;
      return `<tr><td>${e(a.resourceType)}</td><td>${link(a.published?.html?.url ?? a.canonical, label)}</td><td><code>${e(a.id)}</code></td><td>${e(a.materialization.state)}</td></tr>`;
    });
  const about = [
    ix.packageId === undefined ? undefined : `<code>${e(ix.packageId)}</code>${ix.version === undefined ? "" : ` ${e(ix.version)}`}`,
    ix.canonicalBase === undefined ? undefined : `canonical base ${link(ix.canonicalBase, ix.canonicalBase)}`,
  ].filter((x): x is string => x !== undefined);
  return withRenderedBy(
    `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(title)}</title></head>\n<body>\n` +
      `<h1>${e(title)}</h1>\n` +
      `<p>${ix.count} artefact(s)${about.length ? ` of ${about.join(", ")}` : ""}. Each links to where the IG publishes it; the state says whether this index holds its bytes or only refers to them.</p>\n` +
      `<table>\n<thead><tr><th>Type</th><th>Artefact</th><th>Id</th><th>State</th></tr></thead>\n<tbody>\n${rows.join("\n")}\n</tbody>\n</table>\n` +
      `</body></html>\n`,
    "ig-pages",
  );
}

/** A one-file redirect at the declared route, naming the Tool that drew it. */
function routeRedirect(target: string, title: string): string {
  const t = target.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const h = title.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return withRenderedBy(
    `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>${h}</title>\n` +
      `<link rel="canonical" href="${t}"><meta http-equiv="refresh" content="0; url=${t}">\n` +
      `</head><body><p><a href="${t}">${h}</a></p></body></html>\n`,
    "ig-pages",
  );
}

if (CHECK) {
  for (const routePage of routePages) {
    if (!existsSync(routePage.abs) || readFileSync(routePage.abs, "utf8") !== routePage.html) {
      console.error(`✗ ${relative(ROUTE_REPO, routePage.abs)} — a declared route's page — is stale or missing. Run \`bun run cat ${INSTANCE_NAME}:pages\`.`);
      process.exit(1);
    }
  }
  // Compared against whichever copy the declaration says is authoritative — the
  // checkout today, both while the same pages live on main and on
  // cat/fhir-harness/ig-docs, and the branch after the cutover (bean lbz8).
  // The resolver is the one `uml:overview:check` uses (`route-authority.ts`,
  // #2053). A branch it cannot reach is UNKNOWN: neither stale nor a pass.
  const repoRoot = checkoutRootFor(INSTANCE);
  const id = docsDirectoryId();
  const outRel = relative(repoRoot, OUT).split(sep).join("/");
  const verdict = id === undefined
    ? undefined
    : compareRoute(id, new Map([...pages].map(([rel, text]) => [`${outRel}/${rel.split(sep).join("/")}`, text])), repoRoot);
  if (verdict?.state === "unknown") {
    console.error(`COULD NOT DETERMINE whether ${INSTANCE_NAME}'s IG pages are current: ${verdict.reason}`);
    console.error(`  authority: ${verdict.authority} — nothing was compared, so this is not a pass.`);
    process.exit(4);
  }
  for (const d of verdict?.drift ?? []) console.error(`drift: ${d} differs between the checkout and the branch`);
  const have = committed();
  const stale: string[] = [];
  if (verdict?.authority === "branch") {
    // The branch is replaced wholesale by a publish, so an orphan is the
    // publisher's to sweep; only content is compared here.
    stale.push(...verdict.stale.map((p) => p.slice(outRel.length + 1)));
  } else {
    for (const [rel, html] of pages) if (have.get(rel) !== html) stale.push(rel);
    for (const rel of have.keys()) if (!pages.has(rel)) stale.push(`${rel} (orphan — no artefact produces it)`);
  }
  stale.push(...(verdict?.drift ?? []).map((p) => `${p} (drift between the checkout and the branch)`));
  if (stale.length > 0) {
    console.error(`✗ ${stale.length} page(s) stale or orphaned:`);
    for (const s of stale.slice(0, 10)) console.error(`    ${s}`);
    if (stale.length > 10) console.error(`    …and ${stale.length - 10} more`);
    console.error(`  Run \`bun run cat ${INSTANCE_NAME}:pages\`. These pages are generated; never edit them.`);
    process.exit(1);
  }
  console.log(`✓ ${INSTANCE_NAME} docs are current — ${pages.size} page(s) over ${ix.count} artefacts${verdict ? `, read from ${verdict.authority === "both" ? "both copies (the checkout decides)" : `the ${verdict.authority}`}` : ""}`);
} else {
  // Rebuilt wholesale so a removed artefact cannot leave a page behind — all
  // but the directory's README, which another generator owns and is carried
  // across the rebuild unchanged.
  const readme = join(OUT, "README.md");
  const keptReadme = existsSync(readme) ? readFileSync(readme, "utf8") : undefined;
  if (existsSync(OUT)) rmSync(OUT, { recursive: true });
  if (keptReadme !== undefined) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(readme, keptReadme);
  }
  for (const [rel, html] of pages) {
    const abs = join(OUT, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, html);
  }
  for (const routePage of routePages) {
    mkdirSync(join(routePage.abs, ".."), { recursive: true });
    writeFileSync(routePage.abs, routePage.html);
    console.log(`  declared route → ${relative(ROUTE_REPO, routePage.abs)}`);
  }
  const sc = sidecarCensus(ix.artifacts);
  console.log(`${INSTANCE_NAME}/docs: ${pages.size} page(s)`);
  console.log(`  index over ${ix.count} artefacts in ${byCategory(ix.artifacts).size} categories`);
  // Counted from the page map, never as `pages.size - 1`. That expression was
  // right while the index was the only non-artefact page and quietly became
  // wrong the moment a category page joined it — it reported 675 artefact
  // pages over a corpus of 674.
  // One per ARTEFACT: the IG API view pages and their raw files share the
  // directory and are counted on their own line.
  const artefactPages = THIN ? ix.artifacts.length : [...pages.keys()].filter((k) => k.startsWith("artifact/") && k.endsWith(".md") && !VIEW_PAGE.test(k)).length;
  const categoryPages = [...pages.keys()].filter((k) => k.startsWith("category/")).length;
  console.log(`  ${artefactPages} artefact page(s) — one per artefact${THIN ? ", THIN: each a shell over its JSON-LD node, drawn by assets/ig-artifact.js" : ""}; ${sc.schema} carry a ${SIDECAR_LABEL} schema`);
  console.log(`  ${igApiViewCount} IG API view page(s) — one per held JSON Schema or JSON-LD sidecar, file fetched client-side`);
  console.log(`  ${jsonViewCount} JSON view page(s) — resource read client-side from the held package.tgz`);
  if (THIN) console.log(`  thin tab views: ${thinTabCounts.definitions} definitions, ${thinTabCounts.mappings} mappings, ${thinTabCounts.json} JSON, ${thinTabCounts.jsonld} JSON-LD, ${thinTabCounts.schema} schema, ${thinTabCounts.examples} examples — each drawn on the artefact's one page by assets/ig-artifact.js (?view=); the old file names are redirect stubs`);
  console.log(`  tab pages: ${tabCounts.history} change history, ${tabCounts.testing} testing, ${tabCounts.profileHistory} profile history, ${tabCounts.profileJson} profile JSON, ${tabCounts.examples} examples, ${tabCounts.mappings} mappings`);
  console.log(`  ${categoryPages} category page(s) — categories over ${INLINE_LIMIT}, listed off the index`);
  // THE MENU IS REPORTED EITHER WAY. An unreported page is a page nothing
  // checks, and an absent menu reported as silence is indistinguishable from
  // an IG that publishes no navigation — which this one plainly does.
  if (menu) {
    console.log(
      `  ${menu.groups.length} menu section(s) — the IG's own top bar, ${menuItemCount(menu)} item(s), ` +
        `from ${menu.source.path} @ ${menu.source.ref.slice(0, 8)}`,
    );
  } else {
    console.log("  0 menu section(s) — COULD NOT DETERMINE: no menu.json.");
    console.log("    Run `ingest-ig-menu.ts --source <ig-repo>`; this is not an IG without navigation.");
  }
  // THE CHROME, SAID OUT LOUD EITHER WAY. Its absence is the same third state
  // the menu's is: unstyled pages and "we mirrored it" look identical from a
  // build log that only mentions the chrome when it is there.
  if (CHROME) {
    const conflicted = CHROME.conflicts.length;
    const status = statusFor(ix);
    console.log(
      status === undefined
        ? "  status NOT determined — the artefact index records none; no watermark drawn"
        : `  status "${status}" — from the artefact index (the IG's own ImplementationGuide)`,
    );
    console.log(
      `  chrome mirrored on every page — ${CHROME.tokens.length} token(s) over ` +
        `${CHROME.layers.length} template layer(s), ${CHROME.rules.length} rule(s); the chrome is ${CHROME.id} ${CHROME.version}`,
    );
    for (const l of CHROME.layers) console.log(`    ${l.package} ${l.version} @ ${l.ref.slice(0, 8)}`);
    if (conflicted > 0) {
      console.log(`    ${conflicted} upstream defect(s) mirrored verbatim and recorded, not corrected:`);
      for (const c of CHROME.conflicts) {
        console.log(`      ${c.kind} ${c.token} — ${c.sites.map((x) => `${x.package}="${x.value}"`).join(" vs ")}`);
      }
    }
  } else {
    console.log(
      CHROME_OWNER === undefined
        ? "  chrome NOT applied — no --chrome-owner given."
        : "  chrome NOT applied — COULD NOT DETERMINE: no chrome.json.",
    );
    console.log("    Run `ingest-ig-chrome.ts --layer <base> --layer <next> --out <dir>`; the pages are unstyled, not a mirror.");
  }
}

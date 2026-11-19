#!/usr/bin/env bun
/**
 * Compose the site's documentation tree from its declared layers.
 *
 * @module scripts/compose-docs
 *
 * Each harness's own `docs/` is mounted at its own path by
 * `mount-instance-docs.ts`. This file composes the repository-root `docs/`,
 * managed by `cat-harness`, which **overlays** the base layer rather than
 * replacing it.
 *
 * The layers come from the declarations, never from a list:
 * `cat-harness/harness.json` declares two directories whose graphs include
 * `docs`, told apart by `scope`:
 *
 * | entry | scope | resolves to | role |
 * |---|---|---|---|
 * | `docs` | layer (absent) | `cat-harness/docs/` | the BASE |
 * | `root-docs` | `repository` | `<repo>/docs/` | the OVERLAY |
 *
 * Base first, overlay last, so an overlay file SHADOWS the base file at the
 * same relative path (the same direction `resolveSkillDirs` composes skills).
 * Every shadowed path is REPORTED with both layers named; it is not an error
 * (unlike `mount-instance-docs`, where two peers colliding is refused).
 *
 * **An empty overlay produces a byte-identical tree**, so publishing from the
 * composed tree is a no-op until somebody authors an override.
 * `compose-docs.test.ts` pins it.
 *
 * ## `_config.yml` is MERGED
 *
 * Layouts, includes and other behaviour files compose as files. `_config.yml`
 * is all of Jekyll's configuration, so an overlay copy is merged rather than
 * shadowing it:
 *
 * > **Overlay keys win. Objects merge recursively. Lists REPLACE rather than
 * > concatenate.**
 *
 * Lists replace so an overlay can remove inherited entries. A YAML round trip
 * is not byte-preserving, so the merge fires ONLY when an overlay supplies a
 * config and a lower layer already did; otherwise the file is copied
 * untouched. `compose-docs.test.ts` pins both halves.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/compose-docs.ts --out <dir>
 *   bun run cat-harness-tools/scripts/compose-docs.ts --out <dir> --check
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { declarationPathIn, siteDirFor } from "../schemas/kg/cat-harness.js";

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { isDirectoryReadme } from "../schemas/kg/kg-node.ts";
import { coneForCheckout, type ConeDecision } from "./staging-cone.ts";
import { DOCS_SITE_BASE } from "../schemas/kg/jsonld.js";
import { foreignScopeFor, isHostProjection, scopeHarnessData, scopeSiteConfig, scopeStickies } from "./lib/foreign-site-scope.ts";
import { subscribedTrees } from "./subscribed-trees.ts";
import { aliasRoute, visualiserRoute } from "../schemas/kg/visualiser-route.ts";
import { declaredVisualisers, forwardingParts, heldVisualiserPages, pageParts } from "./viewer-declarations.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { declaredDocsSources } from "./lib/docs-sources.ts";
import { dirname } from "node:path";
import { expandGlobScopesInFile, type ExpandedScope } from "./lib/default-scope-globs.ts";
import { instanceRepositories } from "../schemas/kg/instance-repositories.ts";
import { mountedInstances, outputTwinOf } from "./lib/layer-output.ts";

const REPO = resolve(dirname(HARNESS_ROOT));

/** A declared documentation layer, in the order it is laid down. */
export interface DocsLayer {
  /** The declaration's id — what a report names. */
  readonly id: string;
  /** Absolute path to the directory. */
  readonly dir: string;
  /** Whether it resolved against the repository root rather than the layer. */
  readonly repositoryScoped: boolean;
}

interface DeclEntry {
  id?: string;
  path?: string;
  scope?: string;
  graphTypologies?: string[];
}

/**
 * The `docs` layers `cat-harness` declares, base first.
 *
 * Instance-scoped entries are the base; repository-scoped ones are the
 * overlay. Both are read from the declaration, so relocating either is a
 * one-line edit there rather than a change here.
 *
 * A declared layer whose directory is ABSENT is dropped and reported by the
 * caller rather than silently treated as empty — `dh4f` is a declaration whose
 * consumer scans nothing and calls it clean, and "the directory is not there"
 * and "the directory is empty" are different facts.
 */
/**
 * The INSTANCE-scoped `docs` layer's directory — the base layer a generator
 * writes its page into, as opposed to the repository overlay.
 *
 * This was copy-pasted IDENTICALLY into six callers until 2026-10-03
 * (`gen-external-schemas-viz`, `gen-fsh-guts-viz`, `gen-processes-viz`,
 * `gen-tools-viz`, `gen-methodologies-viz`, `lib/skill-pages`), each with this
 * exact body. It belongs beside `docsLayers` because it is a *reading* of that
 * resolver, and a reading of a declaration is the thing that must not have six
 * independent copies: bean `06e3`'s move of derived pages to `auto-docs/`
 * changes which layer a generator asks for, and six copies is six places to
 * miss.
 *
 * It throws rather than defaulting, and that is deliberate: a generator with
 * no declared docs layer has nowhere correct to write, and writing to a guessed
 * path is the `dh4f` defect — a consumer that scans nothing and reports clean.
 */
export function baseDocsDir(repo = REPO): string {
  // The layer a generator writes PAGES into is the layer's own site
  // directory (`siteDirFor`), not merely the first instance-scoped layer: since
  // slice 1 of the semantic subgraphs (owner, 2026-10-09) cat-harness declares
  // its just-the-docs CHROME, `site-chrome/`, as a `docs` layer BEFORE `docs/`,
  // so "the first" is the chrome, and a page written there would be a page in
  // the theme. Falls back to the first instance-scoped layer for a layer
  // whose site directory is not one of its declared layers.
  const harness = join(repo, "cat-harness");
  const instanceLayers = docsLayers(repo).layers.filter((l) => !l.repositoryScoped);
  const site = existsSync(harness) ? resolve(harness, siteDirFor(harness)) : undefined;
  const base = instanceLayers.find((l) => resolve(l.dir) === site) ?? instanceLayers[0];
  if (base === undefined) throw new Error("no instance-scoped docs layer is declared");
  return base.dir;
}

/**
 * The harness's CHROME layers: its instance-scoped `docs` layers other than
 * its site directory — `site-chrome/` since slice 1 of the semantic subgraphs,
 * the theme every shell carries — the same reading {@link baseDocsDir} makes
 * from the other side. A layer that is declared built at publish and not yet
 * built (`pending`) is still a chrome layer: it is exactly what a build must
 * write before it composes.
 *
 * The site build reads this to run the publish-time writers whose output
 * lands in the chrome (`avatars.css`): a folio's site composes the chrome
 * without ever running `derive:publish`, so a stylesheet the head links was
 * missing and the link check refused the publish (smart-ra, 2026-10-15).
 */
export function chromeLayers(repo = REPO): DocsLayer[] {
  const harness = join(repo, "cat-harness");
  const site = existsSync(harness) ? resolve(harness, siteDirFor(harness)) : undefined;
  const { layers, pending } = docsLayers(repo);
  // The site directory's output-root twin is the site too, not chrome.
  const siteTwin = site === undefined ? undefined : outputTwinOf(repo, site);
  const chrome = [...layers, ...pending].filter((l) => !l.repositoryScoped && resolve(l.dir) !== site && (siteTwin === undefined || resolve(l.dir) !== resolve(siteTwin)));
  // A chrome layer's output-root twin is that same layer, laid over it, not a
  // second chrome layer: once a writer has written there (`themes:css`), the
  // listing would otherwise name it twice. A twin whose base is absent stays,
  // since it carries the layer.
  const twins = new Set(chrome.flatMap((l) => outputTwinOf(repo, l.dir) ?? []).map((d) => resolve(d)));
  return chrome.filter((l) => !twins.has(resolve(l.dir)));
}

/**
 * The directories a layer declares it BUILDS AT PUBLISH (`builtAtPublish`,
 * cat-harness `schemas/kg/built-at-publish.ts`; owner, 2026-10-14, "B1"), as
 * absolute paths ending in the separator. Read as `check-declared-dirs.ts`
 * `builtAtPublishDirs` reads them.
 */
function builtAtPublishIn(instanceRoot: string): Set<string> {
  const p = declarationPathIn(instanceRoot);
  if (p === undefined || !existsSync(p)) return new Set();
  const decl = JSON.parse(readFileSync(p, "utf-8")) as { builtAtPublish?: Array<{ path?: string }> };
  return new Set((decl.builtAtPublish ?? []).flatMap((e) => (typeof e.path === "string" && e.path.endsWith("/") ? [resolve(instanceRoot, e.path) + sep] : [])));
}

/**
 * The declared docs layers, split three ways: on disk (`layers`); absent
 * (`missing`, a finding: the `dh4f` shape); and absent but declared BUILT AT
 * PUBLISH by the layer that declares them (`pending`). A `pending` layer is
 * correctly absent from a checkout whose build has not run the step that
 * writes it. That is `derive:publish`'s question, which refuses an entry that
 * came out empty. It is said and left out, never refused: an IG's own site
 * build, which makes its pages from the AST, never runs that step
 * (a DAK IG, 2026-10-15).
 */
export function docsLayers(repo = REPO): { layers: DocsLayer[]; missing: DocsLayer[]; pending: DocsLayer[] } {
  const decl = JSON.parse(readFileSync(declarationPathIn(join(repo, "cat-harness"))!, "utf-8")) as {
    directories?: DeclEntry[];
  };
  // AND the checkout root's own declaration (bean `cmsl` step 2, issue #1694):
  // the repository's overlay layer `root-docs` is declared there since the
  // owner's round-5 ruling, not by cat-harness with `scope: "repository"`. An
  // entry the root declares sits at the repository root, which is exactly what
  // the repository scope meant here, so it is marked as such.
  const rootPath = declarationPathIn(repo);
  const rootDecl = rootPath && existsSync(rootPath)
    ? (JSON.parse(readFileSync(rootPath, "utf-8")) as { directories?: DeclEntry[] })
    : { directories: [] };
  const entries: DeclEntry[] = [
    ...(decl.directories ?? []),
    ...(rootDecl.directories ?? []).map((e) => ({ ...e, scope: "repository" })),
  ];
  const found: DocsLayer[] = [];
  for (const e of entries) {
    if (!e.path || !e.id || !(e.graphTypologies ?? []).includes("docs")) continue;
    const repositoryScoped = e.scope === "repository";
    const root = repositoryScoped ? repo : join(repo, "cat-harness");
    found.push({ id: e.id, dir: join(root, e.path), repositoryScoped });
  }
  // The REPOSITORY overlay is the checkout root layer's `docs` entry since
  // placement PR0 (bean `ejye`): the root declares the directories at its own
  // root, so the platform no longer reaches up for `root-docs` with
  // `scope: "repository"`. Same layer, same order — the overlay goes last.
  const rootDeclPath = declarationPathIn(repo);
  if (rootDeclPath !== undefined && existsSync(rootDeclPath)) {
    const rootDecl = JSON.parse(readFileSync(rootDeclPath, "utf-8")) as { directories?: DeclEntry[] };
    for (const e of rootDecl.directories ?? []) {
      if (!e.path || !e.id || !(e.graphTypologies ?? []).includes("docs")) continue;
      if (found.some((f) => f.id === e.id)) continue;
      found.push({ id: e.id, dir: join(repo, e.path), repositoryScoped: true });
    }
  }
  // Base (instance-scoped) before overlay (repository-scoped): later wins.
  found.sort((a, b) => Number(a.repositoryScoped) - Number(b.repositoryScoped));
  const withOutput = withOutputTwins(repo, found);
  const atPublish = new Set([...builtAtPublishIn(repo), ...builtAtPublishIn(join(repo, "cat-harness"))]);
  // A layer whose pinned directory is absent is still present when a writer
  // put its computed files at the output root: its twin carries it.
  const carried = new Set(withOutput.filter((l) => l.twinOf !== undefined && existsSync(l.dir)).map((l) => l.twinOf));
  const absent = found.filter((l) => !existsSync(l.dir) && !carried.has(l.id));
  const pending = absent.filter((l) => atPublish.has(resolve(l.dir) + sep));
  return {
    layers: withOutput.filter((l) => existsSync(l.dir)).map(({ id, dir, repositoryScoped }) => ({ id, dir, repositoryScoped })),
    missing: absent.filter((l) => !pending.includes(l)),
    pending,
  };
}

/** The id an output-root twin layer is reported under: its base layer's id and this suffix. */
export const OUTPUT_LAYER_SUFFIX = "@output";

/**
 * Each layer of a MOUNTED instance followed by its output-root twin
 * (`build/layers/<instance>/<same path>`, `scripts/lib/layer-output.ts`; bean
 * `cat-tools-sm8r` item 4, step 4). A writer that computes pages for a
 * mounted layer puts them there rather than inside the pinned mount, and the
 * twin is laid directly over its base, so a computed page shadows the pinned
 * copy and the overlay after it still wins. A layer of the checkout's own
 * (not mounted) has no twin, and nothing changes while no writer writes one.
 */
export function withOutputTwins(repo: string, layers: readonly DocsLayer[]): (DocsLayer & { twinOf?: string })[] {
  const mounted = mountedInstances(repo);
  return layers.flatMap((l) => {
    const twin = l.repositoryScoped ? undefined : outputTwinOf(repo, l.dir, mounted);
    return twin === undefined ? [l] : [l, { id: `${l.id}${OUTPUT_LAYER_SUFFIX}`, dir: twin, repositoryScoped: false, twinOf: l.id }];
  });
}

/** One layer directory composed into the Jekyll source under its own name. */
export interface ComposedInstance {
  instance: string;
  /** Absolute source directory. */
  dir: string;
  /** Where it lands, relative to the composed tree — the layer's name. */
  under: string;
  /**
   * The layer's own directory, repo-relative and without a trailing slash.
   *
   * NOT the same string as `under`, and the difference is the whole reason
   * this field exists: `under` is the declaration's `name`, which is what a
   * URL carries, while this is where the files sit in the checkout, which is
   * what a diff names. They coincide today and are free to diverge — a
   * declaration may name itself anything — so `carriedInstances` matching a
   * changed path against `under` would quietly stop matching the day one is
   * renamed, and the failure would look like "this branch touches nothing".
   */
  root: string;
  /**
   * True when the layer also declares an `igSite` directory: its own IG
   * site is built at `/<instance>/` (`stage-ig-sites.ts`, bean `mftp`) and
   * answers `/<instance>/index.html`, so no stub may be written there.
   */
  igSite?: boolean;
}

/**
 * Every OTHER layer's directory that asks to be composed rather than mounted.
 *
 * This is the owner's *"harness can have docs/ which then get listed under
 * `cat-harness/docs/<harness>`"* — the clause neither consumer implemented.
 * `mount-instance-docs.ts` copies built HTML into `_site` AFTER Jekyll, which
 * is a different thing and is what leaves those pages with no layout at all.
 *
 * **Opt-in, read off `composed` on the directory.** A composed default would
 * silently restyle the IRIS replica layer, which is a replica of somebody else's site and
 * must not wear just-the-docs' chrome — the same reason `mount-instance-docs`
 * gives where it declines to run Jekyll over these.
 *
 * `cat-harness` is excluded because it IS the base layer; composing it under
 * its own name would publish the whole site twice, which is the double-publish
 * `mount-instance-docs` already guards with `--built`.
 */
export function composedInstances(repo = REPO): ComposedInstance[] {
  const out: ComposedInstance[] = [];
  const subscribers: { dir: string; decl: Parameters<typeof subscribedTrees>[0][number]["decl"] }[] = [];
  const staged = new Set<string>();
  for (const e of readdirSync(repo, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith(".") || e.name === "node_modules") continue;
    const declPath = declarationPathIn(join(repo, e.name));
    if (!declPath || !existsSync(declPath)) continue;
    let d: { name?: string; directories?: (DeclEntry & { composed?: boolean })[] };
    try {
      d = JSON.parse(readFileSync(declPath, "utf-8"));
    } catch {
      // Not this script's finding — `kg:schema:check` owns an unparseable
      // declaration, and reporting it here would be a second voice on it.
      continue;
    }
    staged.add(d.name ?? e.name);
    if (Array.isArray((d as { subscriptions?: unknown }).subscriptions)) {
      subscribers.push({ dir: join(repo, e.name), decl: { ...d, name: d.name ?? e.name } as (typeof subscribers)[number]["decl"] });
    }
    // The base layer's own directories are never composed under its name (see
    // above) — but its SUBSCRIPTIONS are read, so it was not skipped earlier.
    if (e.name === "cat-harness") continue;
    for (const entry of d.directories ?? []) {
      if (!entry.path || entry.composed !== true) continue;
      const abs = join(repo, e.name, entry.path);
      if (!existsSync(abs)) continue;
      const igSite = (d.directories ?? []).some((x) => (x as { igSite?: boolean }).igSite === true);
      out.push({ instance: d.name ?? e.name, dir: abs, under: d.name ?? e.name, root: e.name, ...(igSite ? { igSite } : {}) });
    }
  }
  // A SUBSCRIBED layer's composed directories, from the tree this checkout
  // holds (bean `g8jp`). Only `held` ones: a chosen directory that is not held
  // is `mount-instance-docs`' finding, which fails the build, and reporting it
  // here too would be a second voice on it. A subscribed layer also staged
  // in the tree is composed from the staged copy alone.
  for (const t of subscribedTrees(subscribers)) {
    if (t.state !== "held" || !t.instance || !t.tree || t.entry?.["composed"] !== true || staged.has(t.instance)) continue;
    out.push({ instance: t.instance, dir: t.tree, under: t.instance, root: relative(repo, t.tree).split(sep).join("/") });
  }
  return out.sort((a, b) => a.under.localeCompare(b.under));
}

/** What `carriedInstances` decided about one composed layer. */
export interface CarryDecision {
  readonly instance: ComposedInstance;
  /** True to compose its files; false to leave a stub in their place. */
  readonly carry: boolean;
  /** Why, in the words the build log prints. */
  readonly why: string;
}

/**
 * Which composed layers a preview must carry, given the branch's own diff.
 *
 * Bean `ga8a`, following `tebu` one directory over. A DAK IG's `docs/` is
 * **3.2 MB of markdown** in the checkout and **111.6 MB of HTML** in a
 * preview — 681 pages at ~164 KiB each, because just-the-docs inlines the
 * whole navigation into every page. Measured across `origin/gh-pages` on
 * 2026-09-23: **776.6 MB over 13 previews, 37 % of a 2.10 GB `branches/`
 * tree**, against a 1 GB Pages limit the main site shares. Every preview
 * carried it, whether or not its branch mentioned the layer.
 *
 * It does not deduplicate either. That IG's tree hash is DISTINCT in
 * all 13 previews, because the staging banner injects the slug into every
 * page — so unlike the dedup argument `tebu` rightly rejected for a
 * published-size threshold, this weighs on both budgets.
 *
 * ## The predicate is the LAYER, not its composed directory
 *
 * That IG's `docs/` is generated from its `fhir-artifact-index/` by its own
 * `scripts/`, so a branch that changes the generator and
 * regenerates in the same commit must still get the rebuilt pages. Matching
 * the layer root is the superset that covers all three, and a superset is
 * the right direction here for the reason below.
 *
 * ## ANY DOUBT CARRIES EVERYTHING
 *
 * `files` is `undefined` when there is no pull request (a `workflow_dispatch`
 * preview), when the API call failed, or when the list came back unreadable —
 * and all three carry the lot. The two failures are not symmetric: a preview
 * that is too big is a threshold finding somebody reads, while a preview
 * missing the pages under review is a **reviewer misled**, and absence read as
 * evidence is this family's whole history of bugs (`dh4f`).
 *
 * An EMPTY list is not the same as no list and is not treated as one: a pull
 * request that genuinely changes nothing touches no layer, and saying so is
 * a determined answer rather than a doubt.
 *
 * ## And the CONE on top (bean `4j86`)
 *
 * The prefix match under-carries: a change to `gen-ig-pages.ts` or to the
 * shared chrome touches no IG's root, and dropped every IG from the preview
 * that existed to review it. `cone` (`staging-cone.ts`) adds what a changed
 * file can REACH: through a directory's declared `writer` and its import
 * closure, and down `derivedFrom`. The prefix match is kept as a floor, so the
 * union can only carry more than before, never less.
 *
 * @param composed every composed layer, from `composedInstances`
 * @param files the pull request's changed paths, repo-relative; `undefined` when unknown
 * @param cone the staging cone's decisions over the same files, when computed
 */
export function carriedInstances(
  composed: readonly ComposedInstance[],
  files?: readonly string[],
  cone?: readonly ConeDecision[],
  repo: string = REPO,
): CarryDecision[] {
  if (!files) {
    return composed.map((instance) => ({
      instance,
      carry: true,
      why: "no readable file list for this branch — carrying everything",
    }));
  }
  // Normalised because a path may reach here with a leading `./` from a diff
  // tool, and `<instance>/x` must not miss `./<instance>/x`.
  const changed = files.map((f) => f.replace(/^\.\//, ""));
  return composed.map((instance) => {
    const prefix = `${instance.root}/`;
    const hit = changed.find((f) => f === instance.root || f.startsWith(prefix));
    if (hit) return { instance, carry: true, why: `the branch touches ${hit}` };
    const path = `${relative(repo, instance.dir).split(sep).join("/").replace(/\/$/, "")}/`;
    const reached = cone?.find((c) => c.path === path && c.carry);
    return reached
      ? { instance, carry: true, why: `the staging cone reaches ${reached.node}: ${reached.why}` }
      : { instance, carry: false, why: `nothing under review touches ${instance.root}/, and the staging cone does not reach it` };
  });
}

/**
 * The page left where a composed layer's tree would have been.
 *
 * A stub rather than nothing, and that is `pb04`: the navbar's harness tiles
 * and every cross-reference address `/<instance>/`, so removing the directory
 * outright turns a working link into a 404 a reviewer has to diagnose. A page
 * that says where the full copy lives costs one file and answers the question
 * the 404 would have raised.
 */
export function instanceStub(c: ComposedInstance): string {
  return [
    "---",
    `title: ${c.under}`,
    "nav_exclude: true",
    "---",
    "",
    `# ${c.under}`,
    "",
    "This instance's pages are **not built into this preview**. Nothing on this",
    "branch changes them, and carrying a themed copy costs a large share of the",
    "GitHub Pages budget the main site shares — see bean `ga8a`.",
    "",
    "Read them on the published site:",
    `<https://litlfred.github.io/folio-assistant/${c.under}/>.`,
    "",
    `A branch that touches \`${c.root}/\` gets the full tree here instead.`,
    "",
  ].join("\n");
}

/**
 * Composed-tree paths a CANONICAL deploy must not carry.
 *
 * Read from every harness's declared `visualisers` with
 * `publish: "staging-only"` (owner, 2026-10-09: the harness declares each
 * visualiser), never from a list here — a list would be the
 * `check:declared-assets` defect again, and this one fails by PUBLISHING
 * something somebody chose not to publish.
 *
 * ## Withholding a page means withholding its directory
 *
 * A viewer is `<dir>/index.html` plus whatever it loads. Withholding the one
 * file leaves its scripts and data deployed, which for `fsh-guts` would
 * publish the very bytes the declaration keeps back — so an `index.*` ref
 * withholds everything under its parent.
 *
 * **Except when that parent is the layer root**, which would withhold the
 * whole site. That guard is not hypothetical bookkeeping: a visualiser ref
 * directly in `cat-harness/docs/` is a perfectly ordinary declaration, and
 * without the check, one such ref marked staging-only would empty the
 * canonical deploy. The ref is then withheld as a single file.
 */
/**
 * What a visualiser ref withholds, given its path inside a docs layer.
 *
 * An `index.*` stands for its whole directory, because a viewer is a page plus
 * whatever it loads and withholding the page alone would deploy the assets.
 *
 * **Unless its parent is the layer root**, where the directory IS the site.
 * Separated out and exported for one reason: as a branch inside
 * `withheldFromCanonical` it could only be exercised by a declaration that
 * actually put a ref at a layer root, so no test over this repository's real
 * tree could ever reach it — and the failure it prevents is the canonical
 * deploy composing to nothing. A guard that cannot be tested where it matters
 * is a guard that is one refactor from being dropped silently.
 */
export function withheldPathFor(rel: string): string {
  const slash = rel.lastIndexOf("/");
  const base = slash === -1 ? rel : rel.slice(slash + 1);
  const parent = slash === -1 ? "" : rel.slice(0, slash);
  // `parent === ""` IS the layer-root case: withhold the file alone.
  return /^index\.(html|md)$/.test(base) && parent !== "" ? `${parent}/` : rel;
}

export function withheldFromCanonical(repo = REPO): string[] {
  const out = new Set<string>();
  // A visualiser's page is at its ROUTE in the base docs layer, which is the
  // composed tree's own path for it: `en/cat-harness/fsh-guts/`. Withheld as a
  // DIRECTORY, because a viewer is a page plus whatever it loads — and at BOTH
  // addresses (folio-assistant#2527): the localised one, and the old one,
  // where a site not yet regenerated still holds the page and where its
  // forwarding page would otherwise go.
  for (const v of declaredVisualisers(repo)) {
    if (v.publish !== "staging-only") continue;
    const parts = { harness: v.harness, visualiser: v.id };
    out.add(visualiserRoute(pageParts(parts)));
    out.add(visualiserRoute(forwardingParts(parts)));
    // Its alias redirect too: a redirect to a withheld page is the page's
    // address published on a deploy that withholds it.
    if (v.alias !== undefined) out.add(aliasRoute(v.alias));
  }
  return [...out].sort();
}

/**
 * Where a visualiser's pages ARE in the composed tree: its localised route,
 * `<locale>/<harness>/<visualiser>/` (folio-assistant#2527), or — a site not
 * yet regenerated — its old one. `undefined` when it has neither.
 */
function pagesRouteIn(out: string, v: { harness: string; id: string }): string | undefined {
  const parts = { harness: v.harness, visualiser: v.id };
  for (const route of [visualiserRoute(pageParts(parts)), visualiserRoute(forwardingParts(parts))]) {
    if (existsSync(join(out, route))) return route;
  }
  return undefined;
}

/** Every `.md` / `.html` page under `route`, as `[htmlRel, stub target from <at><htmlRel>]`. */
function pagesToForward(out: string, route: string, at: string): [string, string][] {
  const pages: [string, string][] = [];
  for (const rel of filesUnder(join(out, route))) {
    // PAGES only. A data file (`.json`, `.jsonld`, an image) is fetched by a
    // script that would not follow a redirect page, so none gets a stub.
    if (!/\.(md|html)$/.test(rel)) continue;
    const htmlRel = rel.replace(/\.md$/, ".html");
    const target = relative(join(out, at, htmlRel, ".."), join(out, route, htmlRel)).split(sep).join("/").replace(/(^|\/)index\.html$/, "$1");
    pages.push([htmlRel, target || "./"]);
  }
  return pages;
}

/**
 * The opt-in `<base>/<alias>/` redirects (bean `t4xb`): for every page under
 * a visualiser's canonical route, a one-file redirect at the same path under
 * its alias. The redirect targets the page where it IS — under the locale
 * once drawn there — never the forwarding page at the old address.
 *
 * Written AFTER every layer and composed layer, and REFUSED over anything
 * already in the tree: an alias that would replace a page is a collision, and
 * the declaration is what has to change — never the page, silently. The gate
 * `check:visualiser-routes` refuses the same collision before a build;
 * this is the build refusing to publish one it was not told about.
 */
export function writeAliasRedirects(
  out: string,
  repo = REPO,
  withheld: readonly string[] = [],
): { written: string[]; collisions: string[] } {
  const written: string[] = [];
  const collisions: string[] = [];
  for (const v of declaredVisualisers(repo)) {
    if (v.alias === undefined) continue;
    const alias = aliasRoute(v.alias);
    if (isWithheld(alias, withheld)) continue;
    const route = pagesRouteIn(out, v);
    if (route === undefined) continue;
    for (const [htmlRel, target] of pagesToForward(out, route, alias)) {
      const stubRel = `${alias}${htmlRel}`;
      const dest = join(out, stubRel);
      if (existsSync(dest) || existsSync(dest.replace(/\.html$/, ".md"))) {
        collisions.push(`${stubRel} — alias of ${v.harness}.visualisers[${v.id}] would replace a page the site already carries`);
        continue;
      }
      mkdirSync(join(dest, ".."), { recursive: true });
      writeFileSync(dest, redirectStub(target));
      written.push(stubRel);
    }
  }
  return { written: written.sort(), collisions: collisions.sort() };
}

/**
 * The FORWARDING pages at the old addresses (folio-assistant#2527): for every
 * page under a visualiser's localised route `<locale>/<harness>/<visualiser>/`,
 * a one-file redirect at the same path under `<harness>/<visualiser>/`, where
 * the page was published until it moved. A bookmark, a link from another site
 * or a `#fragment` someone shared keeps working — `redirectStub` carries the
 * query and the fragment across.
 *
 * The same machinery as the aliases, and the same refusal to replace a page:
 * a page still sitting at the old address — a site whose generators have not
 * been re-run since the move — stands, and is reported as `superseded` (its
 * forwarding page is not written) rather than overwritten. That keeps the
 * canonical compose byte-identical to its layers for every file they carry.
 *
 * Pages only: a data file is never given a stub (see `pagesToForward`).
 */
export function writeForwardingPages(
  out: string,
  repo = REPO,
  withheld: readonly string[] = [],
): { written: string[]; superseded: string[] } {
  const written: string[] = [];
  const superseded: string[] = [];
  for (const v of declaredVisualisers(repo)) {
    const parts = { harness: v.harness, visualiser: v.id };
    const route = visualiserRoute(pageParts(parts));
    const old = visualiserRoute(forwardingParts(parts));
    if (route === old || isWithheld(old, withheld) || isWithheld(route, withheld)) continue;
    if (!existsSync(join(out, route))) continue;
    for (const [htmlRel, target] of pagesToForward(out, route, old)) {
      const stubRel = `${old}${htmlRel}`;
      const dest = join(out, stubRel);
      if (existsSync(dest) || existsSync(dest.replace(/\.html$/, ".md"))) {
        superseded.push(stubRel);
        continue;
      }
      mkdirSync(join(dest, ".."), { recursive: true });
      writeFileSync(dest, redirectStub(target));
      written.push(stubRel);
    }
  }
  return { written: written.sort(), superseded: superseded.sort() };
}

/**
 * Lay every visualiser page a harness commits in its own site directory
 * (`heldVisualiserPages`) into the composed tree at its declared route, where
 * Jekyll renders it with the site's layout like any page drawn into the site
 * owner's tree. Wrong-direction move M1 (2026-10-20): the page used to be
 * committed in the platform's own tree, which then named the layer above it.
 *
 * REFUSED over a file already in the tree, file by file, and reported: the
 * page stood in the platform's tree until the move, and a tree that still
 * carries it (a platform pinned before the move) keeps its copy rather than
 * having it silently replaced.
 */
export function writeHeldVisualiserPages(
  out: string,
  repo = REPO,
  withheld: readonly string[] = [],
  suppliedBy: Record<string, string> = {},
): { written: string[]; collisions: string[] } {
  const written: string[] = [];
  const collisions: string[] = [];
  for (const h of heldVisualiserPages(repo)) {
    for (const rel of filesUnder(h.dir)) {
      const at = `${h.route}${rel.split(sep).join("/")}`;
      if (isWithheld(at, withheld)) continue;
      const dest = join(out, at);
      if (existsSync(dest)) {
        collisions.push(`${at} — ${h.visualiser.harness}.visualisers[${h.visualiser.id}] is already in the tree (${suppliedBy[at] ?? "unknown layer"})`);
        continue;
      }
      mkdirSync(join(dest, ".."), { recursive: true });
      cpSync(join(h.dir, rel), dest);
      suppliedBy[at] = h.visualiser.harness;
      written.push(at);
    }
  }
  return { written: written.sort(), collisions: collisions.sort() };
}

/**
 * A redirect page: no layout, no front matter, so Jekyll copies it verbatim.
 *
 * The script runs first and carries the `?query` and `#fragment` across
 * (folio-assistant#2527): a viewer opened on an item (`#<instance>/<id>`) must
 * still open on it at the new address, and a meta refresh drops both. The
 * meta refresh stays as the fallback for a reader without scripts.
 */
export function redirectStub(target: string): string {
  const t = target.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  // A JS string literal that cannot close the script element it sits in.
  const js = JSON.stringify(target).replace(/</g, "\\u003c");
  return (
    `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Redirecting…</title>\n` +
    `<link rel="canonical" href="${t}">\n` +
    `<script>location.replace(${js} + location.search + location.hash);</script>\n` +
    `<meta http-equiv="refresh" content="0; url=${t}"><meta name="robots" content="noindex">\n` +
    `</head><body><p>This page is at <a href="${t}">${t}</a>.</p></body></html>\n`
  );
}

/** Whether `rel` falls under one of the withheld paths (file, or `dir/`). */
export function isWithheld(rel: string, withheld: readonly string[]): boolean {
  return withheld.some((w) => (w.endsWith("/") ? rel.startsWith(w) : rel === w));
}

/** Every file beneath `dir`, as paths relative to it. Dotfiles are skipped. */
function filesUnder(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(dir, prefix), { withFileTypes: true })) {
    // Jekyll ignores dotfiles, and so does this: `docs/.gitkeep` carries the
    // overlay's own documentation and must not become a published page.
    if (e.name.startsWith(".")) continue;
    // A layer's own README describes the SOURCE directory (written by
    // `subgraph-readmes`); it is not a page of the site. Two layers each
    // carrying one would otherwise collide on `README.md`.
    if (!prefix && !e.isDirectory() && isDirectoryReadme(e.name)) continue;
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...filesUnder(dir, rel));
    else out.push(rel);
  }
  return out;
}

/** What a shell writes for the platform's per-page todo listing: no page lists a note. */
export const EMPTY_TODO_LISTING: { pages: Record<string, string> } = { pages: {} };

export interface ComposeReport {
  /**
   * A shell's scoping to the folio whose site it is (#2263): which layer,
   * which platform root its borrowed links point at, and the host's count
   * projections left out. Absent on a whole-site compose.
   */
  readonly scoped?: { instance?: string; platformBase: string; hostProjections: string[] };
  /** Layers laid down, base first. */
  readonly layers: DocsLayer[];
  /** Declared layers whose directory does not exist. */
  readonly missing: DocsLayer[];
  /** Declared layers absent because they are built at publish ({@link docsLayers}). */
  readonly pending?: DocsLayer[];
  /** `<relative path>` → the layer id that supplied the file finally present. */
  readonly suppliedBy: Record<string, string>;
  /** Paths a later layer shadowed, with both layer ids. */
  readonly overrides: { path: string; baseLayer: string; by: string }[];
  /** Paths an overlay added that no earlier layer had. */
  readonly added: string[];
  /**
   * Files an overlay MERGED into a lower layer rather than shadowing, with the
   * dotted keys the overlay changed. Neither an override nor an addition —
   * collapsing it into either would make "what did the root change" unanswerable.
   */
  readonly merged: { path: string; baseLayer: string; by: string; keys: string[] }[];
  /**
   * Files kept OUT of this tree because their visualisation is
   * `publish: "staging-only"` and this is a canonical compose.
   *
   * Reported rather than silent, for the reason every omission here is
   * reported: a tree that is quietly smaller than its layers is
   * indistinguishable from a layer that failed to read. Empty on a
   * `--staging` run, which is a different fact from "nothing is withheld
   * anywhere" and is why the flag is echoed in the CLI output beside it.
   */
  readonly withheld: string[];
  /**
   * Layers composed under their own name, rather than mounted after Jekyll.
   *
   * Reported separately from `layers`, and that is not tidiness: a layer
   * OVERLAYS the site's own tree and a composed layer sits beside it under
   * its own prefix. Folding them together would make "did the root change this
   * page" and "did an instance add one" the same answer.
   */
  readonly composed: ComposedInstance[];
  /**
   * The carry decision taken for each composed layer, and why.
   *
   * Reported rather than inferred from `composed`, for the same reason
   * `withheld` is reported: a tree quietly missing a layer's pages is
   * indistinguishable from a layer that failed to read. Every entry in
   * `composed` appears here exactly once, so a reader can tell a stubbed
   * layer from an absent one.
   */
  readonly carried: CarryDecision[];
  /** The `<alias>/` redirect stubs written (bean `t4xb`), and every one refused over an existing page. */
  readonly aliases: { written: string[]; collisions: string[] };
  /**
   * The forwarding pages written at the old `<harness>/<visualiser>/`
   * addresses (folio-assistant#2527), and each one NOT written because a page
   * the site carries still stands there (a site not yet regenerated).
   */
  readonly forwards: { written: string[]; superseded: string[] };
  /**
   * The visualiser pages a harness commits in its OWN site directory, laid at
   * their declared route (`heldVisualiserPages`), and each file refused because
   * a layer or composed layer already put one there.
   */
  readonly held: { written: string[]; collisions: string[] };
  /** The repository-scoped layers a platform-only shell left out (`platformOnly`), never silently. */
  readonly leftOut?: DocsLayer[];
}

/**
 * Files an overlay MERGES into the lower layer instead of shadowing it.
 *
 * `_config.yml` is the whole of Jekyll's configuration, so a shadow would
 * replace every plugin, collection and theme setting while reading in the
 * report as one added page. The owner's rule (2026-09-21) is to merge it.
 *
 * A map rather than a set because the reason travels with the entry, the same
 * discipline as `FORWARD_DECLARED` and `STEP_EXEMPTIONS`: a later reader gets
 * the decision rather than a bare filename.
 */
const MERGE_RATHER_THAN_SHADOW: Readonly<Record<string, string>> = {
  "_config.yml":
    "the whole of Jekyll's configuration — shadowing it would replace every plugin, collection and theme setting while reading as one added page",
};

/** A plain object, as distinct from an array or a scalar. */
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Deep-merge `over` onto `base` — the owner's rule, and every clause matters.
 *
 * - objects merge RECURSIVELY, so an overlay setting one colour token does not
 *   drop the rest of the theme;
 * - lists REPLACE, so an overlay can shorten an inherited list. Concatenating
 *   would leave no way to remove an inherited entry;
 * - scalars replace, and `null` is a value like any other — an overlay may
 *   deliberately null a key out.
 *
 * Returns the merged value and the dotted paths the overlay actually changed,
 * because the report names what moved rather than counting it.
 */
export function mergeConfig(
  base: unknown,
  over: unknown,
  prefix = "",
): { merged: unknown; changed: string[] } {
  if (!isRecord(base) || !isRecord(over)) {
    return { merged: over, changed: [prefix || "(document)"] };
  }
  const merged: Record<string, unknown> = { ...base };
  const changed: string[] = [];
  for (const [k, v] of Object.entries(over)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (isRecord(base[k]) && isRecord(v)) {
      const r = mergeConfig(base[k], v, path);
      merged[k] = r.merged;
      changed.push(...r.changed);
    } else {
      merged[k] = v;
      changed.push(path);
    }
  }
  return { merged, changed };
}

/** Lay the layers down in order, recording who supplied what. */
/**
 * Options for a compose run.
 *
 * `staging` is the ONLY way a staging-only visualisation reaches the tree, and
 * the default is deliberately the restrictive one — see
 * `VisualisationSchema.publish` for why the two failure directions are not
 * symmetric. Briefly: forgetting the flag loses a page from a preview, where
 * whoever is looking at the preview sees it missing; the opposite default
 * publishes withheld content to the world, where nothing shows it at all.
 */
export interface ComposeOptions {
  /** True on a local build or a `branches/<slug>/` preview. Default false. */
  readonly staging?: boolean;
  /**
   * The branch's changed paths, repo-relative, when they are known.
   *
   * Passed only by a preview build. Absent — the canonical publisher, a local
   * build, an unreadable API response — carries every composed layer, per
   * `carriedInstances`.
   */
  readonly changedFiles?: readonly string[];
  /**
   * Compose the CHROME only: the layers' Jekyll machinery (`_config.yml`,
   * `_includes/`, `_layouts/`, `_sass/`, `_data/`, …) and `assets/`, and no
   * page and no composed layer. An IG repository's own site composes its
   * IG INTO this shell, so it is built with the same search box, locale
   * selector and navbar as the main site rather than with a plain stand-in
   * layout (#2235 F1). A page is any other path, so it is left out.
   */
  readonly shell?: boolean;
  /**
   * WHOSE site a shell is for (#2263). A shell's `_data/harness.json` is
   * re-scoped to that folio (`lib/foreign-site-scope.ts`), and the platform's
   * count projections under `assets/`, and its translation sweep and index
   * under `_data/`, are left out. Omitted on a shell, the
   * folio is unknown and the scoping still runs, with no layer: nothing is
   * then the folio's own, so every state tile is unlinked and every platform
   * tile re-based — never the platform's numbers on someone else's page.
   */
  readonly foreign?: { instance?: string; platformBase?: string; title?: string };
  /**
   * A shell of the PLATFORM's chrome only: the repository-scoped layers — the
   * docs directories the checkout root's own declaration names — are left out
   * and reported in `leftOut`. Only with `shell`.
   *
   * An IG repository's own site (`ig-repo-site`) asks for this. Its shell was
   * always composed in a folio-assistant checkout (the FHIR IG harness's
   * `templates/ig-repo-site/folio-site.yml`), whose root declares no docs
   * layer, so it carried the platform's chrome and nothing of the IG's. Run
   * from the IG's own checkout, the root's `docs` entry (a DAK IG's
   * `docs/`, the IG's artefact pages and their `assets/`) became an overlay,
   * and its assets arrived twice: once here, once from `stage-ig-sites`, which
   * builds that directory into the IG site (`igSite`) and refuses a path the
   * host already has. That step owns the directory; the shell does not.
   */
  readonly platformOnly?: boolean;
}

/** Is `rel` part of the site's chrome — Jekyll machinery or a static asset — rather than a page? */
export const isChrome = (rel: string): boolean => {
  const first = rel.split(/[\\/]/)[0]!;
  return first.startsWith("_") || first === "assets";
};

export function compose(out: string, repo = REPO, opts: ComposeOptions = {}): ComposeReport {
  if (opts.platformOnly && !opts.shell) throw new Error("compose-docs: platformOnly is a shell's option (--platform-only needs --shell)");
  const declared = docsLayers(repo);
  const missing = declared.missing;
  const pending = declared.pending;
  const leftOut = opts.platformOnly ? declared.layers.filter((l) => l.repositoryScoped) : [];
  const layers = opts.platformOnly ? declared.layers.filter((l) => !l.repositoryScoped) : declared.layers;
  const withheld = opts.staging === true ? [] : withheldFromCanonical(repo);
  const withheldFiles: string[] = [];

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const suppliedBy: Record<string, string> = {};
  const overrides: ComposeReport["overrides"] = [];
  const added: string[] = [];
  const merged: ComposeReport["merged"] = [];
  const hostProjections: string[] = [];

  for (const [i, layer] of layers.entries()) {
    for (const rel of filesUnder(layer.dir)) {
      if (opts.shell && !isChrome(rel)) continue;
      const isOverlay = i > 0;
      // Withheld BEFORE anything else touches `rel`, so a staging-only page
      // cannot be recorded as supplied, overridden or added. A report that
      // named a file the tree does not carry would be worse than no report.
      if (isWithheld(rel, withheld)) {
        withheldFiles.push(rel);
        continue;
      }
      const dest = join(out, rel);
      const src = join(layer.dir, rel);

      // A shell carries the host's GENERATED includes EMPTY: they are
      // projections of the host's own graphs (its harness navbar, its todo
      // listing), not chrome, and on an IG's own site they linked 400 pages
      // that site does not have (#2235 F1). The site that adopts the shell
      // writes its own (`gen-navbar-include --instance`).
      if (opts.shell && /^_includes[\\/]generated[\\/]/.test(rel)) {
        mkdirSync(join(dest, ".."), { recursive: true });
        writeFileSync(dest, "");
        suppliedBy[rel] = layer.id;
        continue;
      }

      // THE HOST'S COUNT PROJECTIONS ARE NOT CHROME EITHER (#2263): the bean
      // and todo indexes, their `count.json`, the library and QA indexes. On
      // an IG's site the icon row fetched them as that site's own, and
      // a DAK IG showed folio-assistant's 537 open beans. Left out, they
      // 404 there, which the badge reads as ABSENT -- not as zero. The same
      // goes for the host's translation sweep and index under `_data/`
      // (`HOST_DATA_PROJECTIONS`): "Swept 49/689" on a folio's page was the
      // platform's sweep.
      if (opts.shell && /^(assets|_data)[\\/].+\.json$/.test(rel) && isHostProjection(rel, readFileSync(src, "utf-8"))) {
        delete suppliedBy[rel];
        rmSync(dest, { force: true });
        hostProjections.push(rel);
        continue;
      }

      // MERGED, not shadowed — and only when a lower layer actually supplied
      // one. A YAML round trip drops comments and may reorder keys, so doing
      // this unconditionally would change the published bytes on a tree whose
      // overlay carries no config, breaking the byte-identity property that
      // licenses pointing the live `source:` at the composed tree.
      if (isOverlay && MERGE_RATHER_THAN_SHADOW[rel] && suppliedBy[rel]) {
        const r = mergeConfig(
          parseYaml(readFileSync(dest, "utf-8")),
          parseYaml(readFileSync(src, "utf-8")),
        );
        writeFileSync(dest, stringifyYaml(r.merged));
        merged.push({ path: rel, baseLayer: suppliedBy[rel]!, by: layer.id, keys: r.changed });
        suppliedBy[rel] = layer.id;
        continue;
      }

      if (suppliedBy[rel]) overrides.push({ path: rel, baseLayer: suppliedBy[rel]!, by: layer.id });
      else if (isOverlay) added.push(rel);

      mkdirSync(join(dest, ".."), { recursive: true });
      cpSync(src, dest);
      suppliedBy[rel] = layer.id;
    }
  }

  // Composed layers land UNDER THEIR OWN NAME, after the layers, so a
  // layer cannot shadow a base page by accident: `<instance>/index.md` in a
  // composed tree is `<out>/<instance>/index.md`, never `<out>/index.md`.
  const composedInst = opts.shell ? [] : composedInstances(repo);
  const carry = carriedInstances(
    composedInst,
    opts.changedFiles,
    opts.changedFiles ? coneForCheckout(opts.changedFiles, repo) : undefined,
    repo,
  );
  for (const d of carry) {
    const c = d.instance;
    if (!d.carry) {
      // A layer with its own IG site has its landing page there: the IG
      // build composes `/<instance>/index.html` after this tree, and refuses
      // a path the host source already holds. A stub here would be a second
      // answer for one URL, so the IG site's own landing stands instead.
      if (c.igSite) continue;
      const under = `${c.under}/index.md`;
      // The stub is a file in the tree like any other, so it answers to
      // withholding like any other. A canonical build never reaches here (it
      // passes no file list), but a local one can, and a stub published where
      // the real index was deliberately withheld would be the same leak with
      // fewer bytes.
      if (isWithheld(under, withheld)) {
        withheldFiles.push(under);
        continue;
      }
      const dest = join(out, c.under, "index.md");
      mkdirSync(join(dest, ".."), { recursive: true });
      writeFileSync(dest, instanceStub(c));
      suppliedBy[under] = c.instance;
      continue;
    }
    // A docs SOURCE the layer declares inside this directory is authored
    // blocks and manifests that `gen-docs-pages.ts` renders into the pages
    // beside them — never pages of their own. The base layer keeps its own out
    // with Jekyll's `exclude`, which names a path from the site root and so
    // cannot reach one composed under a layer's name; it is left out here.
    const sources = declaredDocsSources(join(repo, c.root)).map((s) => s.srcDir + sep);
    for (const rel of filesUnder(c.dir)) {
      if (sources.some((src) => (resolve(c.dir, rel) + sep).startsWith(src))) continue;
      // A composed layer lands under its own name, so its withholding is
      // asked about the path the TREE will carry rather than the layer's
      // own. Skipping this loop would leave a staging-only graph publishable
      // simply by declaring it `composed`.
      const under = `${c.under}/${rel}`;
      if (isWithheld(under, withheld)) {
        withheldFiles.push(under);
        continue;
      }
      const dest = join(out, c.under, rel);
      mkdirSync(join(dest, ".."), { recursive: true });
      cpSync(join(c.dir, rel), dest);
      suppliedBy[join(c.under, rel)] = c.instance;
    }
  }

  // THE VISUALISER PAGES A HARNESS HOLDS ITSELF, at their declared route,
  // after the layers and composed layers so a collision with either is
  // seen. Not on a shell: a folio's own site publishes its own page at its own
  // root, and the platform's routes are not its business.
  const held = opts.shell ? { written: [], collisions: [] } : writeHeldVisualiserPages(out, repo, withheld, suppliedBy);

  // A SHELL IS A FOLIO'S SITE, so the harness data it carries is scoped to
  // that folio: its tiles, icon row, rail scopes and title (#2263). Done
  // after the layers so it scopes the merged result, once.
  let scoped: ComposeReport["scoped"];
  if (opts.shell) {
    const scope = foreignScopeFor(repo, {
      ...(opts.foreign?.instance ? { instance: opts.foreign.instance } : {}),
      platformBase: opts.foreign?.platformBase ?? DOCS_SITE_BASE,
      ...(opts.foreign?.title ? { title: opts.foreign.title } : {}),
    });
    const data = join(out, "_data", "harness.json");
    if (existsSync(data)) {
      const next = scopeHarnessData(JSON.parse(readFileSync(data, "utf-8")), scope);
      writeFileSync(data, `${JSON.stringify(next, null, 2)}\n`);
      scoped = { instance: scope.instance, platformBase: scope.platformBase, hostProjections: [...new Set(hostProjections)].sort() };
    }
    // THE PLATFORM'S PER-PAGE TODO LISTING (bean `lwjc`) is a projection of
    // ITS notes on ITS pages. The footer falls back to the whole listing when
    // the index is ABSENT, so leaving it out would put every platform note on
    // the folio's site. Written EMPTY instead (owner, 2026-10-14): no page of
    // the folio's site lists a platform note, and the footer includes nothing.
    const todoListing = join(out, "_data", "todo_listing.json");
    if (existsSync(todoListing)) writeFileSync(todoListing, `${JSON.stringify(EMPTY_TODO_LISTING, null, 2)}\n`);
    // The landing stickies' platform links, re-based the same way (the IRIS replica's
    // own site, 2026-10-09: they resolved under the folio's baseurl and 404'd).
    const stickiesData = join(out, "_data", "stickies.json");
    if (existsSync(stickiesData)) {
      const next = scopeStickies(JSON.parse(readFileSync(stickiesData, "utf-8")), scope);
      writeFileSync(stickiesData, `${JSON.stringify(next, null, 2)}\n`);
    }
    // The platform's `footer_content` describes the platform (its name, its
    // licences); on a folio's site it read as the folio's own. Replaced by a
    // line naming the folio and what built it, with no licence the folio did
    // not declare. Only in a shell, so the platform's own build keeps its
    // bytes (the byte-identity property `MERGE_RATHER_THAN_SHADOW` protects).
    const config = join(out, "_config.yml");
    if (existsSync(config)) {
      const before = parseYaml(readFileSync(config, "utf-8")) as Record<string, unknown> | null;
      if (before && typeof before === "object") {
        const after = scopeSiteConfig(before, scope);
        if (after !== before) writeFileSync(config, stringifyYaml(after));
      }
    }
  }

  // THE ALIASES, last, over the finished tree — so a collision with any page,
  // from any layer or layer, is seen. Not on a shell: it carries no page.
  const aliases = opts.shell ? { written: [], collisions: [] } : writeAliasRedirects(out, repo, withheld);
  // THE FORWARDING PAGES at the old addresses, after the aliases, so neither
  // ever writes over the other or over a page.
  const forwards = opts.shell ? { written: [], superseded: [] } : writeForwardingPages(out, repo, withheld);


  // DEDUPED. A path present in two layers is withheld once per layer, and a
  // report listing it twice made `withheld.length` stop meaning "files this
  // tree does not carry" — which is the only thing a reader would use it for.
  // Caught by the test asserting the two trees differ by exactly that count.
  return {
    layers,
    missing,
    pending,
    suppliedBy,
    overrides,
    added,
    merged,
    withheld: [...new Set(withheldFiles)].sort(),
    composed: composedInst,
    carried: carry,
    aliases,
    forwards,
    held,
    ...(scoped ? { scoped } : {}),
    ...(opts.platformOnly ? { leftOut } : {}),
  };
}

/**
 * THE GLOB SCOPES, EXPANDED — the stage the CLI runs straight after
 * `compose()`, over the finished tree (owner, 2026-10-14: "Explicit scopes").
 *
 * Jekyll re-runs a glob scope's `Dir.glob` on every `to_liquid` of every page,
 * which was most of the docs build's CPU; one exact-path scope per match is
 * the same set of pages in Jekyll 3.10 and 4 at a fraction of the cost
 * (`lib/default-scope-globs.ts`). Generated here, never written by hand, so a
 * page added to a globbed folder is covered by the next compose.
 *
 * A stage of its own rather than part of `compose()`: composition is ruled
 * parse-equal to the merge of the layers' configs (D1), and the tests that
 * hold it to that stay true of `compose()`. This stage then rewrites ONLY the
 * `defaults` block, splicing it into the composed file's text, so every other
 * key keeps its bytes; with no glob scope the file is not touched at all.
 */
export function expandComposedScopes(out: string): ExpandedScope[] {
  const configPath = join(out, "_config.yml");
  if (!existsSync(configPath)) return [];
  return expandGlobScopesInFile(configPath, out);
}

/** One page's source, in the shape the IG pages' `ig-source-lines` already use. */
export interface PageSource {
  /** `https://github.com/<owner>/<repo>/blob/main/<path>`: the page's Markdown. */
  readonly blob: string;
  /** `owner/name`, the repository a 📣 opens its issue in. */
  readonly repo: string;
  /** Each heading written IN this file: its text and 1-based source line. */
  readonly lines: ReadonlyArray<{ readonly t: string; readonly l: number }>;
}

/**
 * The ATX headings a Markdown page writes itself, with their source lines.
 *
 * Front matter and fenced code are skipped, and a kramdown `{#id}` and closing
 * `#`s are dropped. A heading a Liquid include draws is NOT here, which is the
 * point: the browser offers ✎ only for a section whose text this file holds
 * (owner, 2026-11-13: "own-text sections only").
 */
export function markdownHeadings(md: string): Array<{ t: string; l: number }> {
  const out: Array<{ t: string; l: number }> = [];
  const lines = md.split("\n");
  let i = 0;
  if (lines[0]?.trim() === "---") {
    for (i = 1; i < lines.length && lines[i]!.trim() !== "---"; i++);
    i++;
  }
  let fence: string | null = null;
  for (; i < lines.length; i++) {
    const s = lines[i]!;
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(s);
    if (f) {
      if (fence === null) fence = f[1]![0]!;
      else if (f[1]![0] === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const m = /^\s{0,3}#{1,6}\s+(.*?)\s*$/.exec(s);
    if (!m) continue;
    const t = m[1]!
      .replace(/\s*\{[#:][^}]*\}\s*$/, "")
      .replace(/\s+#+\s*$/, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .trim();
    if (t && !t.includes("{{") && !t.includes("{%")) out.push({ t, l: i + 1 });
  }
  return out;
}

/**
 * THE PAGE SOURCES, a stage the CLI runs after `compose()` (owner,
 * 2026-11-13: ✎ edit and ✍ suggest on plain pages). Writes
 * `_data/page_sources.json`, keyed by `page.path`, so `head_custom.html` can
 * hand each page its source to `edit-links.js`.
 *
 * A data file rather than front matter: front matter would change every
 * page's bytes, and `compose()` is held byte-identical for an empty overlay.
 * A page whose layer declares no `repository` is LEFT OUT, never guessed, and
 * keeps its 📣 alone.
 */
export function writePageSources(out: string, r: ComposeReport, repo = REPO): Record<string, PageSource> {
  const repos = instanceRepositories(repo).entries.map((e) => ({ ...e, root: resolve(e.root) + sep }));
  const where = (abs: string): { repo: string; path: string } | undefined => {
    const owner = repos.filter((e) => abs.startsWith(e.root)).sort((a, b) => b.root.length - a.root.length)[0];
    if (!owner) return undefined;
    const rel = relative(owner.root, abs).split(sep).join("/");
    return owner.livesAt
      ? { repo: owner.livesAt.repository, path: `${owner.livesAt.path}/${rel}` }
      : { repo: owner.repository, path: rel };
  };
  const layerDir = new Map(r.layers.map((l) => [l.id, l.dir]));
  const composedDir = new Map(r.composed.map((c) => [c.under, c.dir]));
  const pages: Record<string, PageSource> = {};
  for (const [rel, by] of Object.entries(r.suppliedBy).sort(([a], [b]) => a.localeCompare(b))) {
    const page = rel.split(sep).join("/");
    if (!page.endsWith(".md") || isChrome(page)) continue;
    const head = page.split("/")[0]!;
    const c = r.composed.find((x) => x.under === head && x.instance === by);
    const src = c ? join(composedDir.get(head)!, page.slice(head.length + 1)) : layerDir.has(by) ? join(layerDir.get(by)!, rel) : undefined;
    if (!src || !existsSync(src)) continue;
    const w = where(resolve(src));
    if (!w) continue;
    pages[page] = {
      blob: `https://github.com/${w.repo}/blob/main/${w.path}`,
      repo: w.repo,
      lines: markdownHeadings(readFileSync(src, "utf-8")),
    };
  }
  mkdirSync(join(out, "_data"), { recursive: true });
  writeFileSync(join(out, "_data", "page_sources.json"), JSON.stringify(pages) + "\n");
  return pages;
}

/** Every file beneath a directory with its bytes — for the identity check. */
export function treeDigest(dir: string): Map<string, string> {
  const m = new Map<string, string>();
  if (!existsSync(dir)) return m;
  for (const rel of filesUnder(dir)) {
    m.set(rel, Bun.hash(readFileSync(join(dir, rel))).toString(16));
  }
  return m;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--out");
  const out = i >= 0 ? argv[i + 1] : undefined;
  if (!out) {
    console.error(
      "usage: compose-docs.ts --out <dir> [--check] [--staging] [--changed-files <file>] [--shell [--platform-only] [--instance <name>] [--title <label>] [--link-root <platform site>]]",
    );
    process.exit(2);
  }

  // `--changed-files` names a file holding the branch's changed paths, one per
  // line — what a preview build reads out of the pull request. ABSENT IS THE
  // SAFE DIRECTION and the default everywhere else: `carriedInstances` then
  // carries every composed layer. An unreadable or empty FILE is treated
  // the same as no flag, because "the list could not be read" and "the list
  // said nothing changed" would otherwise be one answer, and only one of them
  // is a determined zero (`dh4f`).
  const cf = argv.indexOf("--changed-files");
  let changedFiles: string[] | undefined;
  if (cf >= 0 && argv[cf + 1]) {
    try {
      const lines = readFileSync(argv[cf + 1]!, "utf-8")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length > 0) changedFiles = lines;
      else console.log("  --changed-files was empty — carrying every composed instance");
    } catch {
      console.log(`  --changed-files could not be read — carrying every composed instance`);
    }
  }

  // `--staging` is the POSITIVE assertion that this build is not the canonical
  // deploy: a local build, or a `branches/<slug>/` preview. Absent means
  // canonical, which withholds. The default is the restrictive one on purpose
  // — `VisualisationSchema.publish` carries why the two error directions are
  // not symmetric.
  const staging = argv.includes("--staging");
  const shell = argv.includes("--shell");
  const platformOnly = argv.includes("--platform-only");
  if (platformOnly && !shell) {
    console.error("compose-docs: --platform-only needs --shell");
    process.exit(2);
  }
  // `--instance <name> [--title <label>] [--link-root <platform site>]`: whose
  // site the shell is for (#2263). Only meaningful with --shell.
  const opt = (f: string) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);
  const foreign = shell
    ? {
        ...(opt("--instance") ? { instance: opt("--instance")! } : {}),
        ...(opt("--title") ? { title: opt("--title")! } : {}),
        ...(opt("--link-root") ? { platformBase: opt("--link-root")! } : {}),
      }
    : undefined;
  const r = compose(resolve(out), REPO, { staging, changedFiles, shell, platformOnly, ...(foreign ? { foreign } : {}) });
  // The glob front-matter scopes, expanded over the tree just composed.
  // Not on a shell: its pages are composed into it by later steps, so its
  // tree is not finished here, and a glob expanded now would miss them.
  const scopes = shell ? [] : expandComposedScopes(resolve(out));
  // Each page's own source, for the ✎ / ✍ on its sections. Not on a shell, for
  // the same reason: its pages are composed in later.
  const sources = shell ? {} : writePageSources(resolve(out), r);
  if (shell) console.log("  --shell: the chrome only — Jekyll machinery and assets, no page, no composed instance");
  for (const l of r.leftOut ?? []) {
    console.log(`  --platform-only: left out ${l.id} (repository) — ${relative(REPO, l.dir)}; the site's own steps compose it`);
  }
  if (r.scoped) {
    console.log(
      `  --shell: harness data scoped to ${r.scoped.instance ?? "an UNNAMED folio (pass --instance: nothing is then its own)"}; ` +
        `borrowed links point at ${r.scoped.platformBase}`,
    );
    for (const h of r.scoped.hostProjections) console.log(`  HOST PROJECTION left out: ${h}`);
  }

  for (const m of r.pending ?? []) {
    console.log(`  built at publish, not built in this build — left out: ${m.id} (${relative(REPO, m.dir)})`);
  }
  for (const m of r.missing) {
    // A declared layer with no directory is a FINDING, not a skip. It is the
    // `dh4f` shape exactly: the declaration says to look, and there is nothing
    // there, and a composer that shrugged would report a clean run over it.
    console.error(`::error::compose-docs: declared docs layer '${m.id}' has no directory at ${relative(REPO, m.dir)}`);
  }
  console.log(`composed ${Object.keys(r.suppliedBy).length} file(s) from ${r.layers.length} layer(s):`);
  for (const l of r.layers) {
    console.log(`  · ${l.id}${l.repositoryScoped ? " (repository)" : ""} — ${relative(REPO, l.dir)}`);
  }
  // Named, never counted. A bare number would not let a reader check that the
  // right pages were overridden, which is the whole question an override raises.
  if (r.overrides.length === 0) console.log("  no overrides — the composed tree is the base layer");
  for (const o of r.overrides) console.log(`  OVERRIDE ${o.path} — ${o.baseLayer} -> ${o.by}`);
  for (const a of r.added) console.log(`  ADDED    ${a}`);
  // Stated either way, never only when non-empty. "Nothing was withheld" and
  // "withholding was off" are different facts and an empty list alone cannot
  // tell them apart.
  if (staging) console.log("  staging build — staging-only visualisations are INCLUDED");
  else if (r.withheld.length === 0) console.log("  canonical build — nothing declared staging-only");
  else {
    console.log(`  canonical build — ${r.withheld.length} file(s) withheld as staging-only:`);
    for (const w of r.withheld) console.log(`  WITHHELD ${w}`);
  }
  // The changed KEYS, never a count. "merged 1 file" tells a reader nothing
  // about what the overlay did to the site's configuration, which is the whole
  // question a merged config raises.
  for (const m of r.merged) {
    console.log(`  MERGED   ${m.path} — ${m.baseLayer} <- ${m.by} (${m.keys.join(", ")})`);
  }
  // Every composed layer, carried or stubbed, with its reason. Printing
  // only the stubbed ones would leave a reader unable to tell a layer that
  // was carried from one this build never saw (bean `ga8a`).
  for (const d of r.carried) {
    console.log(`  ${d.carry ? "CARRIED " : "STUBBED "} ${d.instance.under} — ${d.why}`);
  }

  // Each glob scope with what it became, so a reader can see a folder's pages
  // were covered rather than trust a count.
  for (const x of scopes) console.log(`  SCOPE    ${x.glob} -> ${x.paths.length} exact path(s): ${x.paths.join(", ")}`);
  if (!shell) console.log(`  page sources: ${Object.keys(sources).length} page(s) know their repository and file (_data/page_sources.json)`);
  console.log(`  ${r.aliases.written.length} alias redirect(s) written`);
  console.log(
    `  ${r.forwards.written.length} forwarding page(s) written at old visualiser addresses` +
      (r.forwards.superseded.length > 0 ? `, ${r.forwards.superseded.length} not written over a page still there` : ""),
  );
  console.log(`  ${r.held.written.length} visualiser page file(s) laid from their own harness's site directory`);
  for (const c of r.held.collisions) console.log(`  KEPT     ${c}`);
  for (const c of r.aliases.collisions) console.error(`::error::compose-docs: alias collision: ${c}`);

  if (r.missing.length > 0 || r.aliases.collisions.length > 0) process.exit(1);
  if (argv.includes("--check")) {
    if (!existsSync(out) || !statSync(out).isDirectory()) process.exit(2);
  }
}

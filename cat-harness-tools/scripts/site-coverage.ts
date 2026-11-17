#!/usr/bin/env bun
/**
 * A built site carries a page for every declared visualiser that has something
 * to show, in this checkout: the root layer and every layer it needs.
 *
 * @module scripts/site-coverage
 * @graphNode none — a guard over a built site, run by `build-instance-site.ts`
 *
 * It compares the built site with what the declarations say it should hold.
 * The parity guard (`site-parity.ts`) only measures a build against the root
 * it replaces, so it cannot miss a page that was never published; this can.
 *
 * ## What is expected
 *
 * For each visualiser `declaredVisualisers` reads in the checkout (which, in a
 * repository's own index, is that repository and its `needs`):
 *   - `<locale>/<harness>/<visualiser>/` when a directory it covers holds
 *     anything;
 *   - with `subgraphs: "instance"`, also `…/<instance>/` for each layer
 *     whose covered directory holds an ENTRY (a sub-directory): a library
 *     whose only file is its `library.json` has no entries to show. Where the
 *     writer reads its layers with a reader of its own
 *     ({@link SUBJECT_READERS}), that reader decides instead, so the guard and
 *     the writer cannot disagree about which layers have a page.
 * A page is there when the route holds `index.html` (the built site) or
 * `index.md` (a Jekyll source).
 *
 * Usage: bun run cat-harness-tools/scripts/site-coverage.ts <site dir> [--root <checkout>] [--staging] [--json]
 * Exit: 0 every expected page is there · 1 a page is missing.
 */
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { checkoutDirectories } from "../schemas/kg/harness-config.js";
import { ROUTE_SEGMENT, visualiserRoute } from "../schemas/kg/visualiser-route.js";
import { toolSubjects } from "./gen-tools-viz.ts";
import { processSubjects } from "./gen-processes-viz.ts";
import { schemaSubjects } from "./gen-schema-viz.ts";
import { readJourneyCorpus } from "./journeys/read.ts";
import { declaredVisualisers, forwardingParts, pageParts, type DeclaredVisualiser } from "./viewer-declarations.ts";
import { WEB_APP_FILE } from "../schemas/ui/web-app.ts";
import { mountedInstances, readPathAt } from "./lib/layer-output.ts";

/** One page the declarations say the site must carry. */
export interface ExpectedPage {
  /** Site-relative directory, `en/<harness>/<visualiser>/[<instance>/]`. */
  route: string;
  harness: string;
  visualiser: string;
  /** The layer sub-graph, for a `subgraphs: "instance"` view. */
  instance?: string;
  /** The same view at its address before the locale segment (`forwardingParts`). */
  legacyRoute: string;
  /**
   * On the site OF the layer that declares it, the same view at that site's
   * own root: a folio's site reads `/<instance>/…` as `/…` (`ownHref` in
   * `lib/foreign-site-scope.ts`), so the IRIS replica's catalogue tile,
   * `/<instance>/catalogue/`, lands on `catalogue/`. Set only for that layer.
   */
  ownSiteRoute?: string;
}

const visible = (name: string): boolean => !name.startsWith(".") && !name.startsWith("_");

function children(dir: string): { files: number; dirs: number } {
  try {
    const all = readdirSync(dir, { withFileTypes: true }).filter((d) => visible(d.name));
    return { files: all.filter((d) => !d.isDirectory()).length, dirs: all.filter((d) => d.isDirectory()).length };
  } catch {
    return { files: 0, dirs: 0 };
  }
}

/** The covered directories of one visualiser, with the layer each belongs to. */
function coveredDirectories(v: DeclaredVisualiser): { instance: string; absPath: string; under?: string }[] {
  return checkoutDirectories(v.harnessRoot, { stackedOn: v.harnessRoot })
    .filter((d) =>
      (v.coversKinds ?? []).some((k) => (d.graphTypologies as readonly string[]).includes(k)) ||
      ((v.covers ?? []) as readonly string[]).includes(d.id) && (d.member ?? d.declaredBy) === v.harness)
    .map((d) => {
      // `subgraphUnder` nests a kind's sub-graph pages one segment down, as the
      // tiles read it (`viewer-declarations.ts`): the glossary's per-instance
      // pages are at `glossary/instance/<instance>/` (owner, 2026-10-15, "3a").
      const under = (d.graphTypologies as readonly string[]).map((k) => v.subgraphUnder?.[k]).find((u) => u !== undefined);
      return { instance: d.member ?? d.declaredBy, absPath: d.absPath, ...(under ? { under } : {}) };
    });
}

/**
 * The layers a writer draws a sub-graph page for, read by the WRITER's own
 * reader, keyed by the Tool the visualiser is `renderedBy`.
 *
 * "A sub-directory is an entry" is the right test for a library, an uploads
 * queue or a bean store, and the wrong one for a `tools` graph: a Tool is a
 * node the writer loads (`toolSubjects`), not a folder. A DAK IG
 * (2026-10-15) inherits the DAK base layer's `tools` declaration as a member, and its
 * repository root holds the IG's own `tools/` folder of FHIR scripts: the guard
 * expected `en/cat-harness/tools/<dak-ig>/`, the writer rightly drew
 * nothing (no Tool node there), and the build failed on a page nobody owed.
 * Owner ruling B1: a declaration names only what an index mounting the
 * layer has — a folder that merely matches a declared path is not a graph.
 *
 * A writer with no entry here keeps the sub-directory test. A reader that
 * throws (a declared graph that does not load) falls back to it too, so the
 * guard still reports rather than goes quiet.
 */
/** A writer's own reader: the layers it draws a page for, given the checkout and the visualiser's covered directories. */
export type SubjectReader = (root: string, dirs: readonly { instance: string; absPath: string }[]) => readonly string[];

export const SUBJECT_READERS: Readonly<Record<string, SubjectReader>> = {
  "tools-viewer": (root) => toolSubjects(root).subjects.map((s) => s.name),
  // A diagram, not a sub-folder: `bootstrap/processes/` holds files only and
  // still owes a page; a folder of DMN tables or global tasks owes none.
  "processes-viewer": (root) => [...processSubjects(root).keys()],
  "ig-pages": igIndexSubjects,
  // An app manifest, not a sub-folder: a web-app directory without one builds nothing.
  "web-app-build": webAppSubjects,
  // A schema MODULE or source descriptor, not a sub-folder: a `schemas`
  // directory holding only JSON contracts in `skills/` owes no page.
  "schemas-viewer": (root) => schemaSubjects(root),
  // A journey or a workshop is a FILE in a declared directory, not a
  // sub-folder, and the writer draws a layer's page when it holds one.
  "journeys-viewer": (root) => {
    const c = readJourneyCorpus(root);
    return [...new Set([...c.journeys.map((j) => j.instance), ...c.workshops.map((w) => w.instance)])].sort();
  },
};

/**
 * The layers whose artefact index this checkout holds, among the
 * visualiser's covered `fhir-artifact-index` directories: what `ig-pages`
 * (the FHIR layer's `gen-ig-pages.ts`) draws from, `<instance>/fhir-artifact-index/index.json`.
 *
 * Since fhir-harness#124 an IG layer commits no index; `ig-index:build`
 * writes it at publish. A site that builds an IG's index owes that IG's
 * artefact pages. A site that mounts the IG layer and builds none (a
 * document folio such as a reference-architecture folio mounting the DAK layer) owes none: the
 * directory's other files (a README, retired sidecars) are not an index the
 * writer can draw. Owner, 2026-10-30, smart-ra#103: "this is not an IG".
 */
export function igIndexSubjects(root: string, dirs: readonly { instance: string; absPath: string }[]): string[] {
  // A mounted layer's index is read through the layer output root (bean `cat-tools-sm8r` item 4).
  const mounted = mountedInstances(root);
  return [...new Set(dirs.filter((d) => existsSync(readPathAt(root, join(d.absPath, "index.json"), mounted))).map((d) => d.instance))].sort();
}

/**
 * The layers whose declared `web-app` directories hold an app manifest
 * (`web-app.json`): what the `apps` visualiser (`web-app-build`,
 * `gen-web-apps.ts`) builds. The `apps` visualiser is cat-harness's, so a
 * site scoped to the layer that carries an app (a content layer's
 * onboarding game, Q-GAME-5) owes `<locale>/cat-harness/apps/` only when the guard
 * knows that layer is a subject; without this reader it never did, the
 * writer never ran, and the game was never published.
 */
export function webAppSubjects(_root: string, dirs: readonly { instance: string; absPath: string }[]): string[] {
  return [...new Set(dirs.filter((d) => existsSync(join(d.absPath, WEB_APP_FILE))).map((d) => d.instance))].sort();
}

/**
 * Writers whose page at the visualiser's own route is owed only when their
 * reader finds a subject: `ig-pages` draws its index page from the indexes it
 * reads, so with none there is nothing at `<harness>/artifact-index/` either.
 * `web-app-build` likewise: its index lists the apps it built, and a scoped
 * site owes it exactly when a layer in scope carries an app.
 */
export const INDEX_PAGE_NEEDS_SUBJECTS: ReadonlySet<string> = new Set(["ig-pages", "web-app-build"]);

/** The layers `v` owes a sub-graph page, by its writer's reader when it has one, else by the sub-directory test. */
export function subjectInstances(
  v: Pick<DeclaredVisualiser, "renderedBy">,
  root: string,
  dirs: readonly { instance: string; absPath: string }[],
  readers: Readonly<Record<string, SubjectReader>> = SUBJECT_READERS,
): string[] {
  const read = readers[v.renderedBy];
  if (read !== undefined) {
    try {
      return [...new Set(read(root, dirs))].sort();
    } catch {
      // fall through: the generic test still names what is expected
    }
  }
  return [...new Set(dirs.filter((d) => children(d.absPath).dirs > 0).map((d) => d.instance))].sort();
}

/**
 * The sub-graph segment of one layer's page: `<under>/<instance>` when a
 * directory of it is nested by the visualiser's `subgraphUnder` (the glossary's
 * `instance/`, owner 2026-10-15 "3a"), else `<instance>` — as `viewersOf`
 * composes the tile and the glossary writer writes the page.
 */
export function instanceSubgraph(instance: string, dirs: readonly { instance: string; under?: string }[]): string {
  const under = dirs.find((d) => d.instance === instance && d.under)?.under;
  return under ? `${under}/${instance}` : instance;
}

/**
 * Whether a site scoped to `scoped` owes visualiser `v`'s page at its own route.
 *
 * It does when the declaring layer is in scope, or one of the layers it has a
 * sub-graph page for is. A `builtOnHostSite` visualiser (bean
 * folio-assistant-uldr) is drawn on the site that HOSTS its subjects, so it is
 * also owed when a layer in scope holds anything in a directory it covers,
 * whatever its `subgraphs`. Without that, a `bibliography` visualiser
 * declared by a layer above this one (`subgraphs: "directory"`, covering a
 * content layer's `references/` and `catalogue/`) was owed by no scoped
 * site: that content layer's own site dropped `en/<harness>/bibliography/`,
 * its writer never ran, and this guard reported every declared page present
 * (publish run 43710187461, 2026-11-15).
 */
export function owedOnScopedSite(
  v: { harness: string; builtOnHostSite?: unknown },
  scoped: ReadonlySet<string>,
  instances: readonly string[],
  withAnything: readonly { instance: string }[],
): boolean {
  if (scoped.has(v.harness) || instances.some((i) => scoped.has(i))) return true;
  return v.builtOnHostSite !== undefined && withAnything.some((d) => scoped.has(d.instance));
}

/**
 * Every page the declarations of the checkout at `root` say a built site must
 * carry. A visualiser declared `publish: "staging-only"` (fsh-guts, the
 * trashcan kept but not published) is expected in a preview and never on a
 * root publish.
 */
export function expectedPages(root: string, opts: { staging?: boolean; ownInstance?: string; scope?: readonly string[] } = {}): ExpectedPage[] {
  // A scoped site owes the per-instance pages of its scope only; the rest live on their layers' own sites.
  const scoped = opts.scope === undefined ? undefined : new Set(opts.scope);
  const out: ExpectedPage[] = [];
  const own = (harness: string, legacy: string): { ownSiteRoute?: string } =>
    opts.ownInstance !== undefined && harness === opts.ownInstance && legacy.startsWith(`${harness}/`) ? { ownSiteRoute: legacy.slice(harness.length + 1) } : {};
  for (const v of declaredVisualisers(root)) {
    if (!opts.staging && v.publish === "staging-only") continue;
    const dirs = coveredDirectories(v).filter((d) => existsSync(d.absPath));
    const withAnything = dirs.filter((d) => { const c = children(d.absPath); return c.files + c.dirs > 0; });
    if (withAnything.length === 0) continue;
    const parts = pageParts({ harness: v.harness, visualiser: v.id });
    const legacy = visualiserRoute(forwardingParts(parts));
    // A directory the checkout ROOT declares (`(root)`, the index's own
    // `test/`) belongs to no layer and has no route segment, so no writer
    // draws a page for it (`perInstanceSubjects` in state-visualizer.ts) and
    // none is owed. Composing its route threw, and took the whole guard down.
    const instances = v.subgraphs === "instance" || INDEX_PAGE_NEEDS_SUBJECTS.has(v.renderedBy)
      ? subjectInstances(v, root, dirs).filter((i) => ROUTE_SEGMENT.test(i))
      : [];
    if (INDEX_PAGE_NEEDS_SUBJECTS.has(v.renderedBy) && instances.length === 0) continue;
    // A scoped site owes a layer's visualiser only when the layer is in scope or
    // one of its subjects is: the platform's own pages (its processes, skills,
    // tools, schemas) are linked on the platform's site, not copied (owner, 2026-11-10).
    if (scoped !== undefined && !owedOnScopedSite(v, scoped, instances, withAnything)) continue;
    out.push({ route: visualiserRoute(parts), legacyRoute: legacy, ...own(v.harness, legacy), harness: v.harness, visualiser: v.id });
    if (v.subgraphs !== "instance") continue;
    for (const instance of instances) {
      if (scoped !== undefined && !scoped.has(instance)) continue;
      const sub = { ...parts, subgraph: instanceSubgraph(instance, dirs) };
      const subLegacy = visualiserRoute(forwardingParts(sub));
      out.push({ route: visualiserRoute(sub), legacyRoute: subLegacy, ...own(v.harness, subLegacy), harness: v.harness, visualiser: v.id, instance });
    }
  }
  return out;
}

const holds = (has: (path: string) => boolean, route: string): boolean => has(`${route}index.html`) || has(`${route}index.md`);

/** The expected pages `has` finds at neither address. `has` answers for a site-relative file path. */
export function missingPages(expected: readonly ExpectedPage[], has: (path: string) => boolean): ExpectedPage[] {
  return expected.filter((p) => !holds(has, p.route) && !holds(has, p.legacyRoute) && !(p.ownSiteRoute !== undefined && holds(has, p.ownSiteRoute)));
}

/**
 * The expected pages found ONLY at the old address: counted and printed, never
 * a finding, as `check:visualiser-routes` treats them, because the generator
 * that moves a page runs in the site's own repository.
 */
export function legacyOnlyPages(expected: readonly ExpectedPage[], has: (path: string) => boolean): ExpectedPage[] {
  return expected.filter((p) => !holds(has, p.route) && holds(has, p.legacyRoute));
}

/** The guard as `build-instance-site.ts` calls it: the missing pages of a built site directory. */
export function siteCoverageShortfall(root: string, site: string, opts: { staging?: boolean; ownInstance?: string; scope?: readonly string[] } = {}): ExpectedPage[] {
  return missingPages(expectedPages(root, opts), (p) => existsSync(join(site, p)));
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--root");
  const root = resolve(at >= 0 ? argv[at + 1]! : ".");
  const site = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--root");
  if (site === undefined) {
    console.error("usage: site-coverage.ts <site dir> [--root <checkout>] [--staging] [--json]");
    process.exit(2);
  }
  const expected = expectedPages(root, { staging: argv.includes("--staging") });
  const has = (p: string): boolean => existsSync(join(resolve(site), p));
  const missing = missingPages(expected, has);
  const legacy = legacyOnlyPages(expected, has);
  if (argv.includes("--json")) console.log(JSON.stringify({ expected: expected.length, missing, legacy }, null, 2));
  else {
    for (const l of legacy) console.log(`· ${l.legacyRoute}  (only at the old address; its generator has not run since the locale segment)`);
    for (const m of missing) console.log(`✗ ${m.route}  (${m.harness} declares \`${m.visualiser}\`${m.instance ? `; ${m.instance} has entries` : ""})`);
    console.log(missing.length ? `site coverage: ${missing.length} of ${expected.length} declared page(s) missing` : `site coverage: ✓ all ${expected.length} declared page(s) present`);
  }
  process.exit(missing.length ? 1 : 0);
}

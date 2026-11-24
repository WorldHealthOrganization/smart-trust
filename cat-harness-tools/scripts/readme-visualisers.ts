/**
 * Where a declared directory is SEEN — its visualisers, resolved for its
 * README.
 *
 * @module scripts/readme-visualisers
 * @covers cat-harness
 *
 * The owner, 2026-11-18: *"each mounted subgraph/dir has a visualizer as
 * required. similar for README.md that describes contents for github viewers
 * of what is in dir."* The bootstrap-tools writer prints a directory's
 * visualisers (`VisualiserView`) and records the `no-visualiser` finding; what
 * renders a directory, and where, is this harness's to say, so it is resolved
 * here and handed down, as the governing process is.
 *
 * ## What is resolved, and from what — nothing is invented
 *
 * - WHICH visualisers: the ones the layers declare (`visualisers`,
 *   `HarnessVisualiserSchema`), in the checkout AND in the layers this one is
 *   built on ({@link visualisersReaching}), each kept when it covers the
 *   directory ({@link covers}: by id from its own harness, or by kind).
 * - WHICH PAGE: the visualiser's declared route,
 *   `visualiserRoute({ locale, harness, visualiser, subgraph })` — the one
 *   function every generator computes a visualiser's URL with — under the
 *   sub-graph segment {@link subgraphCandidates} names when it draws
 *   per-sub-graph views.
 * - UNDER WHAT ADDRESS: the site the checkout publishes, `derivePagesUrl` —
 *   the config's `readme.pagesBaseUrl`, else the GitHub Pages address of its
 *   git remote. Neither: the view keeps its title, `href` is `""` and the
 *   README says it could not determine the address, which the writer records
 *   as `unresolved-visualiser`. A guessed URL looks dereferenceable and is
 *   not.
 *
 * ## Whether one is OWED
 *
 * `owesVisualiser` over the directory's kinds — the same rule the
 * `check:subgraph-coverage` axis applies — less the layer exempt by name
 * (`bootstrap`) and a directory waiving it with a reason
 * (`coverage.exempt.visualiser`). Owed and absent is the writer's
 * `no-visualiser` finding.
 */
import { owesVisualiser } from "../schemas/kg/cat-harness.ts";
import { kindTitle } from "../schemas/kg/graph-typology-registry.ts";
import { visualiserRoute } from "../schemas/kg/visualiser-route.ts";
import { VISUALISER_EXEMPT_INSTANCES } from "./check-subgraph-coverage.ts";
import { derivePagesUrl } from "./pages-bootstrap.ts";
import {
  covers,
  pageParts,
  subgraphCandidates,
  visualisersReaching,
  type DeclaredVisualiser,
  type ViewedDirectory,
} from "./viewer-declarations.ts";

/** One visualiser as the README prints it — `VisualiserView` in bootstrap-tools. */
export interface ReadmeVisualiser {
  title: string;
  href: string;
  undetermined: string;
}

/** The directory, as this resolver reads it: a declared entry plus its waiver. */
export interface ReadmeDirectory extends ViewedDirectory {
  coverage?: ViewedDirectory["coverage"] & { exempt?: { visualiser?: string } };
}

/**
 * Does this directory owe a visualiser? Its kinds say so
 * ({@link owesVisualiser}), unless its layer is exempt by name or it waives
 * the obligation with a reason.
 */
export function readmeOwesVisualiser(layer: string, d: ReadmeDirectory): boolean {
  if (VISUALISER_EXEMPT_INSTANCES.has(layer)) return false;
  if (typeof d.coverage?.exempt?.visualiser === "string") return false;
  return (d.graphTypologies ?? []).some((k) => owesVisualiser(k));
}

/** The address under which `repoRoot` publishes, without its trailing slash, or `undefined`. */
export function siteBase(repoRoot: string): string | undefined {
  const url = derivePagesUrl(repoRoot).url;
  return url === undefined ? undefined : url.replace(/\/+$/, "");
}

/**
 * Every visualiser rendering directory `d` of the layer `owner` (whose root
 * is `instanceRoot`), as README links. `[]` when none covers it.
 *
 * @param absDir the directory's real location, so a visualiser naming the same
 *   directory through another layer's entry still counts ({@link covers})
 * @param base the published site, from {@link siteBase}; `undefined` leaves
 *   every `href` empty with the reason stated
 */
export function readmeVisualisers(
  d: ReadmeDirectory,
  owner: string,
  instanceRoot: string,
  repoRoot: string,
  absDir: string,
  base: string | undefined,
  declared: readonly DeclaredVisualiser[] = visualisersReaching(repoRoot, instanceRoot),
): ReadmeVisualiser[] {
  const out: ReadmeVisualiser[] = [];
  const hrefs = new Set<string>();
  for (const v of declared) {
    if (!covers(v, d, owner, absDir, repoRoot)) continue;
    const subgraph = subgraphCandidates(v, d, owner)[0];
    let route: string;
    try {
      route = visualiserRoute(pageParts({ harness: v.harness, visualiser: v.id, ...(subgraph !== undefined ? { subgraph } : {}) }));
    } catch (e) {
      out.push({ title: titleOf(v), href: "", undetermined: `its route is not a URL path (${(e as Error).message})` });
      continue;
    }
    const href = base === undefined ? "" : `${base}/${route}`;
    if (href !== "" && hrefs.has(href)) continue;
    hrefs.add(href);
    out.push({
      title: titleOf(v),
      href,
      undetermined: base === undefined ? "no published site address is configured (`readme.pagesBaseUrl`), and no git remote names one" : "",
    });
  }
  return out;
}

/**
 * What a link to a visualiser says: its declared title, else the display name
 * of the first kind it covers — what every other surface calls that page
 * (`kindTitle`) — else its id.
 */
function titleOf(v: DeclaredVisualiser): string {
  if (v.title !== undefined && v.title.trim() !== "") return v.title;
  const kind = v.coversKinds?.[0];
  if (kind !== undefined) {
    try {
      return kindTitle(kind);
    } catch {
      // An unregistered kind names no title; the id still does.
    }
  }
  return v.id;
}

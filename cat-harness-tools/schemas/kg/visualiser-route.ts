/**
 * Where a declared visualiser is published — THE one function every generator
 * and every reader computes a visualiser's URL with.
 *
 * @module schemas/visualiser-route
 * @graphNode none — a function library: the one route every visualiser URL is computed with
 *
 * A page never chooses its URL and never claims a directory. The HARNESS
 * declares each visualiser in its own `<instance>.json` (`visualisers`, see
 * `HarnessVisualiserSchema` in `cat-harness.ts`), and the route is a pure
 * function of that declaration:
 *
 * | route | what it is |
 * |---|---|
 * | `<base>/<harness>/<visualiser>/` | the visualiser over the full KG it covers |
 * | `<base>/<harness>/<visualiser>/<sub-graph>/` | the same visualiser over one sub-graph |
 * | `<base>/<harness>/<visualiser>/<sub-graph>/<path>` | an asset of that sub-graph's view |
 * | `<base>/<harness>/<visualiser>/<path>` | an asset of the full view (a per-node page, its data) |
 *
 * `<harness>` is the declaring layer's `name`, `<visualiser>` the entry's
 * `id`. Both are URL segments, checked by {@link ROUTE_SEGMENT}, never encoded:
 * an id that is not a portable segment is a defect in the declaration.
 *
 * ## The locale segment
 *
 * Every rendered page on the CDN lives under `/<locale>/…`, so a route may
 * carry a `locale`, and then it is `<locale>/<harness>/<visualiser>/…` — one
 * locale's site is one subtree. It is optional: every caller names
 * `DEFAULT_LOCALE` (`translation.ts`) explicitly, and the unlocalised route
 * keeps working for the alias below.
 *
 * ## Collisions are DECLARATION errors
 *
 * Two claims on one URL are two declarations naming one
 * `(harness, visualiser)` pair, checkable before anything is drawn:
 * {@link routeCollisions}, run by `check:visualiser-routes`.
 *
 * ## The opt-in alias
 *
 * `<base>/<harness>/<visualiser>` always works; a visualiser may also declare
 * an `alias`. The page is still drawn ONCE, at its canonical route; the
 * composed site carries a redirect at `<base>/<alias>/` (`compose-docs.ts`).
 * An alias that collides with another alias, with a harness's own route or
 * with anything the site already publishes at its top level is refused by the
 * gate, naming both claimants.
 *
 * This module is pure — no filesystem — so the schema layer, the generators
 * and the gate can all import it without an edge to any of them.
 */

/** One URL segment: lower-case letters, digits and hyphens, starting with a letter or digit. */
export const ROUTE_SEGMENT = /^[a-z0-9][a-z0-9-]*$/;

/**
 * A sub-graph id as a route segment: lower-cased, since a URL segment is
 * lower case (`ROUTE_SEGMENT`) but a layer may name its subgraphs with capitals
 * (e.g. `<layer>-L4-skills`, 2026-11-13). Two ids that differ only
 * in case would share a route; the segment check still refuses anything else.
 */
export function subgraphSegment(id: string): string {
  return id.toLowerCase();
}

/** The parts of a visualiser route. */
export interface VisualiserRouteParts {
  /**
   * The locale the page is rendered in (`en`), the route's first segment.
   * Absent for the unlocalised route the t4xb rule keeps working.
   */
  locale?: string;
  /** The declaring harness's `name`. */
  harness: string;
  /** The visualiser's declared `id`. */
  visualiser: string;
  /**
   * A sub-graph of what the visualiser covers — absent for the full KG. One
   * segment, or a `/`-separated path of segments when the visualiser declares
   * its sub-graphs nested (auto-docs' `index/skills/core-skills`, owner
   * 2026-10-03: *"auto-docs is one declared subgraph, with declared
   * sub-sub-graphs per writer"*).
   */
  subgraph?: string;
  /** A path below the (sub-graph's) view, `/`-separated, no leading slash. */
  asset?: string;
}

function segment(what: string, s: string): string {
  if (!ROUTE_SEGMENT.test(s)) {
    throw new Error(`visualiser route: ${what} "${s}" is not a URL segment (${ROUTE_SEGMENT.source})`);
  }
  return s;
}

/**
 * The SITE-RELATIVE route of a visualiser page or asset: no leading slash, a
 * trailing slash for a view (so it addresses the directory's `index.html`),
 * none for an asset.
 *
 * `visualiserRoute({ harness: "cat-harness", visualiser: "library" })` is
 * `cat-harness/library/`; with `subgraph: "<instance>"` it is
 * `cat-harness/library/<instance>/`; with `asset: "data.json"` as well it is
 * `cat-harness/library/<instance>/data.json`. With `locale: "en"` each of those
 * gains a leading `en/`.
 */
export function visualiserRoute(p: VisualiserRouteParts): string {
  const parts = [
    ...(p.locale !== undefined ? [segment("locale", p.locale)] : []),
    segment("harness", p.harness),
    segment("visualiser", p.visualiser),
  ];
  if (p.subgraph !== undefined) for (const s of p.subgraph.split("/")) parts.push(segment("sub-graph", subgraphSegment(s)));
  const base = `${parts.join("/")}/`;
  if (p.asset === undefined || p.asset === "") return base;
  const asset = p.asset.replace(/^\/+/, "");
  if (asset.split("/").some((s) => s === ".." || s === ".")) {
    throw new Error(`visualiser route: asset path "${p.asset}" escapes its view`);
  }
  return `${base}${asset}`;
}

/** The absolute URL of a route under a site base (`https://…/folio-assistant/`, or `/` for a site-relative href). */
export function visualiserUrl(base: string, p: VisualiserRouteParts): string {
  return `${base.replace(/\/*$/, "/")}${visualiserRoute(p)}`;
}

/** The site-relative route of an alias: `<alias>/`. */
export function aliasRoute(alias: string): string {
  return `${segment("alias", alias)}/`;
}

/**
 * Split a site-relative path into `{ harness, visualiser, rest }` when it lies
 * under a declared route, else `undefined`. `rest` is everything after
 * `<harness>/<visualiser>/` — a sub-graph, an asset, or both.
 */
export function routeOf(
  sitePath: string,
  declared: readonly Pick<VisualiserRouteParts, "locale" | "harness" | "visualiser">[],
): { harness: string; visualiser: string; rest: string } | undefined {
  const p = sitePath.replace(/^\/+/, "");
  for (const d of declared) {
    const prefix = `${d.locale !== undefined ? `${d.locale}/` : ""}${d.harness}/${d.visualiser}/`;
    if (p === prefix.slice(0, -1) || p.startsWith(prefix)) {
      return { harness: d.harness, visualiser: d.visualiser, rest: p.slice(prefix.length) };
    }
  }
  return undefined;
}

/** One claim on a site route, and who made it. */
export interface RouteClaim {
  /** Site-relative route, trailing slash for a directory. */
  route: string;
  /** Who claims it, for the message: `cat-harness.visualisers[library]`, `alias of …`, `site: processes/`. */
  by: string;
}

/** Two or more claims on one route, or one route nested inside another's subtree. */
export interface RouteCollision {
  route: string;
  claimants: string[];
  /** `same` — one route claimed twice; `nested` — a claim inside another's subtree. */
  kind: "same" | "nested";
}

/**
 * Every collision among a set of route claims.
 *
 * Two claims COLLIDE when they name the same route, or when one route lies
 * inside the other's subtree — a visualiser owns everything beneath its route
 * (its sub-graphs and assets), so a second claim below it would be a second
 * answer for part of it. That is `mount-instance-docs`'s walk rule
 * (*"outermost wins"*), applied to declarations BEFORE anything is drawn, and
 * reported rather than resolved: a refused claim is a declaration to fix.
 */
export function routeCollisions(claims: readonly RouteClaim[]): RouteCollision[] {
  const norm = (r: string): string => r.replace(/^\/+/, "").replace(/\/*$/, "/");
  const byRoute = new Map<string, string[]>();
  for (const c of claims) {
    const r = norm(c.route);
    byRoute.set(r, [...(byRoute.get(r) ?? []), c.by]);
  }
  const out: RouteCollision[] = [];
  for (const [route, by] of byRoute) {
    if (by.length > 1) out.push({ route, claimants: [...by].sort(), kind: "same" });
  }
  const routes = [...byRoute.keys()].sort();
  for (const outer of routes) {
    for (const inner of routes) {
      if (inner !== outer && inner.startsWith(outer)) {
        out.push({ route: inner, claimants: [...byRoute.get(outer)!, ...byRoute.get(inner)!], kind: "nested" });
      }
    }
  }
  return out.sort((a, b) => a.route.localeCompare(b.route) || a.kind.localeCompare(b.kind));
}

/**
 * The relative path from a view's page back to the SITE ROOT — `../../` for
 * `<harness>/<visualiser>/`, one more `../` per sub-graph segment and one for
 * the locale.
 *
 * A page links the site's shared assets (`assets/`, `reference/`) relative to
 * itself so the same bytes work at the canonical base and under a staging
 * slug. Before the route was declared, every one-page viewer sat one level
 * down and hard-coded `../`; computing it from the route is what lets the
 * route be the only thing that decides the depth.
 */
export function siteRootFrom(p: Pick<VisualiserRouteParts, "locale" | "harness" | "visualiser" | "subgraph">): string {
  const depth = visualiserRoute({
    ...(p.locale !== undefined ? { locale: p.locale } : {}),
    harness: p.harness,
    visualiser: p.visualiser,
    ...(p.subgraph ? { subgraph: p.subgraph } : {}),
  })
    .split("/")
    .filter(Boolean).length;
  return "../".repeat(depth);
}

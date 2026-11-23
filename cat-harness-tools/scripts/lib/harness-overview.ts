/**
 * Where a harness's OVERVIEW PAGE is on a site, and whether the site holds it.
 *
 * Owner, 2026-11-13, on the navbar's Harnesses panel: *"links under harnesses
 * inconsistent… should be page that give an overview of how the particular
 * harness is being used and linked back to the harnesses documentation and
 * knowledge graph."* Until then a harness row linked wherever `harness-tiles`
 * found something — the layer's folio, a section of the landing page, the
 * first graph viewer, or one of its files — so five rows on one site went to
 * five kinds of page.
 *
 * Each harness a site is built on now has one page there, at
 * `<locale>/<host>/harness/<layer>/`, written by `gen-harness-pages.ts`, and
 * every row of the panel links to it. The route is the node-kind pages' shape
 * (`<locale>/<declaring>/<kind>/<harness>/`), with the host harness as the
 * declaring layer.
 *
 * **A row links the page only where the site holds it.** The rail is drawn by
 * passes that run on sites this generator has not run on (the platform's own
 * docs site, an older recipe), and the publish link check refuses a link to a
 * page that is not there. So the rail asks the finished site
 * ({@link overviewHrefIn}) and keeps the row's previous target when the page
 * is absent, the rule `ownSiteGraphs` follows for a graph row.
 *
 * @module scripts/lib/harness-overview
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_LOCALE } from "../../schemas/content/translation.js";
import { HARNESS_NAME } from "./roots.ts";

/** The segment under the host harness that holds the overview pages. */
export const HARNESS_OVERVIEW_SEGMENT = "harness";

/** The directory of every overview page, site-relative with a trailing slash: `en/cat-harness/harness/`. */
export function harnessOverviewsRoute(locale: string = DEFAULT_LOCALE): string {
  return `${locale}/${HARNESS_NAME}/${HARNESS_OVERVIEW_SEGMENT}/`;
}

/** One harness's overview page, site-relative with a trailing slash: `en/cat-harness/harness/<name>/`. */
export function harnessOverviewRoute(name: string, locale: string = DEFAULT_LOCALE): string {
  return `${harnessOverviewsRoute(locale)}${name}/`;
}

/**
 * A resolver for one page of the site: the link from that page to `name`'s
 * overview page (`<toRoot>/<route>`), or `undefined` when the site does not
 * hold one. `toRoot` is the page's way back to the site root, `.` at the root.
 */
export function overviewHrefIn(siteAbs: string, toRoot: string, locale: string = DEFAULT_LOCALE): (name: string) => string | undefined {
  const held = new Map<string, boolean>();
  return (name: string) => {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) return undefined;
    const route = harnessOverviewRoute(name, locale);
    let has = held.get(route);
    if (has === undefined) held.set(route, (has = existsSync(join(siteAbs, route, "index.html"))));
    return has ? `${toRoot}/${route}` : undefined;
  };
}

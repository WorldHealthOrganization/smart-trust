/**
 * ONE NAME PER DESTINATION — the single source of every navigation label.
 *
 * @module scripts/lib/nav-label
 *
 * Owner, 2026-10-01, bean `ob3m` finding 6, choosing option 1 of 4, **"One
 * name everywhere"**: each destination gets ONE label, used identically on
 * every surface (the viewer rail, the Jekyll sidebar, FOLDERS, the landing's
 * "visualisations you can open", the glass tiles and More panel, the Stickies
 * "Visualisations" row). Where the harness matters the surface APPENDS the
 * harness as a qualifier, "Skills · C@T Harness", and never uses a different
 * base name.
 *
 * Measured before, on PR #1762's head: 42 destinations across six surfaces, of
 * which 10 carried two or more names. The rail and the sidebar printed the
 * bare KIND word (`docs`, `methodology`, `external-schema`). The glass printed
 * the tile's declared title ("Docs — cat-harness", "Methodologies"), or the
 * directory id when none was declared (`root-docs`). Two kinds that share a
 * page (`schemas` and `cat-harness`, both drawn by the schema viewer) were two
 * names for one page. A harness with no folio of its own (`bootstrap`) linked
 * a graph's viewer and so named `/processes/` "Bootstrap".
 *
 * ## Where a label comes from
 *
 * Only declarations. Nothing on this page is a per-surface string.
 *
 * - **A harness** is its declared `title`, else its `name` ({@link harnessTitle}).
 * - **A kind's destination** is the kind's registered display name
 *   ({@link kindTitle}). Where several kinds of one layer share a page,
 *   every one of them takes the name of the kind its directory declares
 *   FIRST: `schemas/` declares `["schemas", "cat-harness"]`, so both rows say
 *   "Schemas" ({@link labelVisualisations}).
 * - **A tile** is its declared title when the declaration gives one, with any
 *   harness suffix removed ({@link stripQualifier}), else the display name of
 *   the directory's first kind ({@link tileLabel}).
 *
 * The client renders what this module wrote into `_data/harness.json` and
 * never recomputes it. A second implementation in `docs-ui.js` would be two
 * answers free to disagree, which is the defect itself.
 *
 * `check:nav-names` (`scripts/check-nav-names.ts`) is the gate. It reads every
 * generated surface it can read statically and fails when one destination
 * carries two base labels.
 */
import { kindTitle } from "../../schemas/kg/graph-typology-registry.js";

export { kindTitle };

/** What a qualifier is joined to its label with, wherever both are shown as text. */
export const QUALIFIER_SEPARATOR = " · ";

/** A destination's name: the base label, and the harness it belongs to when that matters. */
export interface NavLabel {
  label: string;
  qualifier?: string;
}

/** A harness's name on every surface: its declared title, else its name. */
export function harnessTitle(decl: { name: string; title?: string | null }): string {
  const t = decl.title?.trim();
  return t ? t : decl.name;
}

/**
 * A declared title with any trailing harness qualifier removed.
 *
 * "Docs — cat-harness" → "Docs". The suffix was how the declarations told two
 * harnesses' tiles apart before a qualifier existed. It is now the
 * qualifier's job, and leaving it in the base label is what made a docs page
 * "Docs — cat-harness" on the glass and `docs` on the rail.
 *
 * Only a dash or middot followed by a single word-like token is stripped, so
 * a title whose dash is part of its meaning ("Thinking about it — wide") is
 * left alone unless that token is a harness name passed in `harnessNames`.
 */
export function stripQualifier(title: string, harnessNames: readonly string[] = []): string {
  const m = /^(.*\S)\s+(?:—|–|-|·)\s+(\S+)$/.exec(title.trim());
  if (!m) return title.trim();
  const tail = m[2]!;
  return harnessNames.includes(tail) ? m[1]! : title.trim();
}

/**
 * The label of a tile: the declared title when one is declared (qualifier
 * stripped), else the display name of the directory's FIRST declared kind.
 *
 * @param declaredTitle the visualisation's title AS DECLARED — `undefined`
 *   when the declaration gives none. A caller must not pass a fallback it
 *   made up (the directory id was that fallback, and produced `root-docs`).
 */
export function tileLabel(
  dir: { id: string; graphTypologies?: readonly string[] },
  declaredTitle: string | undefined,
  harnessNames: readonly string[] = [],
): string {
  if (declaredTitle !== undefined && declaredTitle.trim() !== "") {
    return stripQualifier(declaredTitle, harnessNames);
  }
  const first = dir.graphTypologies?.[0];
  return first ? kindTitle(first) : dir.id;
}

/**
 * Give each of one layer's visualisation rows its label, in place.
 *
 * A row is a KIND, and its destination is its `path`. Two kinds of one
 * layer may share a path — the schema viewer draws both `schemas` and
 * `cat-harness` — and then both take the name of whichever of them the
 * layer's directories declare first, so the page has one name. A row with
 * no path is a kind with no destination and is named for its own kind.
 *
 * A row whose page is named for ANOTHER kind gets `sameAs` set to that kind,
 * and every list of destinations skips it.
 *
 * @param dirs the layer's directories, in declaration order
 */
export function labelVisualisations<V extends { kind: string; path?: string | null; label?: string; sameAs?: string }>(
  rows: V[],
  dirs: readonly { graphTypologies?: readonly string[] }[],
): V[] {
  const rank = (kind: string): number => {
    let best = Number.POSITIVE_INFINITY;
    dirs.forEach((d, i) => {
      const at = (d.graphTypologies ?? []).indexOf(kind);
      if (at !== -1) best = Math.min(best, i * 1000 + at);
    });
    return best;
  };
  const byPath = new Map<string, string>();
  for (const r of rows) {
    if (!r.path) continue;
    const held = byPath.get(r.path);
    if (held === undefined || rank(r.kind) < rank(held)) byPath.set(r.path, r.kind);
  }
  for (const r of rows) {
    const named = r.path ? byPath.get(r.path)! : r.kind;
    r.label = kindTitle(named);
    // The SECOND kind on a shared page is the same destination again. It is
    // marked rather than dropped: the data still says the layer declares
    // it, and a surface that lists destinations skips it, so "Schemas" is not
    // printed twice one row apart.
    if (named !== r.kind) r.sameAs = named;
    else delete r.sameAs;
  }
  return rows;
}

/**
 * A viewer row whose page IS the layer's own root is the harness's
 * destination again, so it takes the harness's name and is listed once.
 *
 * Stage C of #1767 made each ingested IG's generated landing declare itself
 * the `fhir-artifact-index` viewer (`rendered-by: ig-pages`), so that kind's
 * row opened the DAK base layer's root — the page the harness row already opens as
 * "SMART Base". One page was then "SMART Base" on the harness row and "FHIR
 * artefact index" one row below it, on the sidebar, the landing and the rail.
 * The harness name wins because the page is the layer's front door first:
 * a harness row never takes a graph's name (bean `ob3m` finding 6), and the
 * converse — renaming the harness after one of its graphs — would make the
 * harness's name depend on which viewer happens to live at its root.
 *
 * `sameAs` is set to the harness's NAME (not a kind) so every list of
 * destinations skips the row exactly as it skips a kind sharing a page.
 *
 * @param root the layer's own root as published (`folio`), or undefined
 *   when it has none — then no row can be it and nothing changes.
 */
export function nameInstanceRoot<V extends { path?: string | null; label?: string; sameAs?: string }>(
  rows: V[],
  root: string | undefined,
  harness: { name: string; title?: string | null },
): V[] {
  if (root === undefined) return rows;
  const home = normaliseDestination(root);
  if (home === undefined) return rows;
  for (const r of rows) {
    if (!r.path || normaliseDestination(r.path) !== home) continue;
    r.label = harnessTitle(harness);
    r.sameAs = harness.name;
  }
  return rows;
}

/** The label and qualifier as one line of text, for a `title` or an accessible name. */
export function labelText(l: NavLabel): string {
  return l.qualifier ? `${l.label}${QUALIFIER_SEPARATOR}${l.qualifier}` : l.label;
}

/**
 * A destination as compared across surfaces: site-root-relative, with no
 * `index.html`, no baseurl and no trailing `.md`. The fragment is kept, because
 * `/#harness-cat-harness` is a different place from `/`.
 */
export function normaliseDestination(href: string, baseurl = ""): string | undefined {
  if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href)) return undefined;
  let h = href.trim();
  const hash = h.indexOf("#");
  const frag = hash === -1 ? "" : h.slice(hash);
  h = hash === -1 ? h : h.slice(0, hash);
  if (baseurl && (h === baseurl || h.startsWith(`${baseurl}/`))) h = h.slice(baseurl.length);
  if (!h.startsWith("/")) h = `/${h}`;
  h = h.replace(/\/index\.(html|md)$/, "/").replace(/\/{2,}/g, "/");
  if (h === "" ) h = "/";
  return frag === "#" ? h : `${h}${frag}`;
}

/**
 * The `[fhir]` row of the rail's Harnesses list: a link to the index page of
 * a layer's FHIR IG, rendered through just-the-docs on this site.
 *
 * Owner, 2026-10-31: *"if harnessed FHIR IG, then I want LHS navbar should
 * have [fhir] harness that will go to index.html of FHIR justthedocs
 * render"*.
 *
 * The row is decided from the FINISHED site, not from a declaration: the
 * render sits at `<instance>/ig/` beside a layer's own pages, at
 * `<instance>/` when it is the layer's whole site, and at the root (or
 * `ig/`) of an IG repository's own site. Whichever it is, the render writes
 * the IG's table of contents (`toc.html`) beside its `index.html`, and no
 * other page kind on these sites does. So a directory holding both is the
 * render, and an IG that is declared but not rendered gets no row: a link
 * to a page the site does not hold would be a 404 behind the row.
 *
 * @module scripts/lib/ig-render-row
 */

import { existsSync } from "fs";
import { join } from "path";

import type { NavItem } from "./navbar.js";

/** The row's label, as the owner wrote it. */
export const IG_RENDER_LABEL = "[fhir]";

/**
 * The row's mark: a flame silhouette with an inner tongue, drawn here after
 * the shape of the FHIR logo rather than copied from the logo file (owner,
 * 2026-10-31: "fhir nav link should use derived fhir logo silhouette"). A
 * 24x24 path, stroked like every other `glyphPath` mark in the rail.
 */
export const IG_RENDER_GLYPH =
  "M12 2.5c.6 3.2 3.4 4.9 4.9 7.6 1.6 2.9 1.2 6.6-1.3 8.8a5.6 5.6 0 0 1-7.2 0c-2.5-2.2-2.9-5.6-1.3-8.3.6 1.4 1.5 2.3 2.6 2.8-.5-3.6.7-7 2.3-10.9z" +
  "M12.3 12.2c1.6 1.5 2.4 3 1.7 4.6a2.2 2.2 0 0 1-4 0c-.5-1.3.3-2.4 1.2-3.2.1.7.4 1.1.9 1.3-.1-1 0-1.8.2-2.7z";

/** The flame's hue: FHIR's orange-red. */
export const IG_RENDER_TONE = 14;

/** Is `dir` (relative to the site root, `""` for the root) an IG render? */
export function isIgRender(siteAbs: string, dir: string): boolean {
  const at = dir === "" ? siteAbs : join(siteAbs, dir);
  return existsSync(join(at, "index.html")) && existsSync(join(at, "toc.html"));
}

/**
 * Where the IG render of a page's owning layer sits on this site, as a
 * directory relative to the site root (`""` is the root, otherwise it ends in
 * `/`), or `undefined` when the site holds none.
 *
 * `atRoot` says the site IS the layer's (an IG repository's own site, or
 * the folio whose checkout this is): its render is then looked for at `ig/`
 * and at the root. Otherwise it is looked for at `<owner>/ig/` and
 * `<owner>/`. `ig/` comes first both times, because when a layer has
 * pages of its own the root of its directory is those pages, not the IG.
 */
export function igRenderDir(siteAbs: string, owner: string, atRoot: boolean): string | undefined {
  const candidates = atRoot ? ["ig/", ""] : [`${owner}/ig/`, `${owner}/`];
  return candidates.find((d) => isIgRender(siteAbs, d.replace(/\/$/, "")));
}

/**
 * The harness rows with the `[fhir]` row added right after the owning
 * layer's row (found by its label), or first when the list has no row of
 * that label. Unchanged when the site holds no render for the owner, or when
 * the list already carries the row.
 */
export function withIgRenderRow(
  rows: readonly NavItem[] | undefined,
  o: { siteAbs: string; owner: string; ownerLabel?: string; atRoot: boolean; toRoot: string },
): NavItem[] | undefined {
  const dir = igRenderDir(o.siteAbs, o.owner, o.atRoot);
  if (dir === undefined) return rows === undefined ? undefined : [...rows];
  const list = [...(rows ?? [])];
  if (list.some((r) => r.label === IG_RENDER_LABEL)) return list;
  const row: NavItem = { label: IG_RENDER_LABEL, href: `${o.toRoot}/${dir}index.html`, glyphPath: IG_RENDER_GLYPH, tone: IG_RENDER_TONE };
  const at = o.ownerLabel === undefined ? -1 : list.findIndex((r) => r.label === o.ownerLabel);
  list.splice(at + 1, 0, row);
  return list;
}

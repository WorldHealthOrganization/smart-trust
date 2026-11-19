/**
 * Where a declared visualiser's page is on disk, for a spec that reads the
 * COMMITTED generated page rather than building it.
 *
 * The site moved to a per-locale, per-instance layout — a page is at
 * `<site>/<locale>/<harness>/<visualiser>/…` while shared assets stay at
 * `<site>/assets/…` — and a spec that spelled `beans/index.html` under the
 * site root read a file that is no longer there. So a spec names the
 * visualiser it reads by its declared `id`, and the directory is the one the
 * generators write into: `visualiserPageDir` over `pageParts` from
 * `scripts/viewer-declarations.ts`, under `siteOwnerDir`. An id the harness
 * does not declare throws here, at load, rather than reading a stale path.
 *
 * @module test/support/site-pages
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { repoRootFor, siteFileFor } from "../../schemas/kg/cat-harness.ts";
import type { VisualiserRouteParts } from "../../schemas/kg/visualiser-route.ts";
import {
  declaredVisualisers,
  existingPageDir,
  forwardingParts,
  heldVisualiserPages,
  pageParts,
  siteOwnerDir,
  visualiserPageDir,
} from "../../scripts/viewer-declarations.ts";
import { overlayPath } from "../../scripts/lib/layer-output.ts";

/**
 * The absolute directory of the visualiser `id` declared by the harness at
 * `harnessRoot`, under the page locale: `<site>/<locale>/<harness>/<id>/`,
 * or a sub-graph below it when `rest` names one. A page committed at its old,
 * unlocalised address whose writer has not run since is found there, as
 * `visualiserPageRef` finds it (`existingPageDir`).
 */
export function declaredPageDir(
  harnessRoot: string,
  id: string,
  rest: Pick<VisualiserRouteParts, "subgraph" | "locale"> = {},
): string {
  const repoRoot = repoRootFor(harnessRoot);
  const v = declaredVisualisers(repoRoot).find((d) => d.id === id && resolve(d.harnessRoot) === resolve(harnessRoot));
  if (v === undefined) {
    throw new Error(`${harnessRoot}: declares no visualiser \`${id}\` (its \`visualisers\` in the instance declaration)`);
  }
  return pageDirOf(repoRoot, v.harness, v.id, rest);
}

/**
 * {@link declaredPageDir} for a visualiser of ANOTHER harness in the checkout,
 * named by its declared `name` — who-iris's `catalogue`, say — rather than by
 * a root the spec would have to spell.
 */
export function declaredPageDirIn(
  repoRoot: string,
  harness: string,
  id: string,
  rest: Pick<VisualiserRouteParts, "subgraph" | "locale"> = {},
): string {
  const v = declaredVisualisers(repoRoot).find((d) => d.id === id && d.harness === harness);
  if (v === undefined) {
    throw new Error(`${repoRoot}: no instance named \`${harness}\` declares a visualiser \`${id}\``);
  }
  return pageDirOf(repoRoot, v.harness, v.id, rest);
}

/**
 * Where the page is on disk, in the order `visualiserPageRef` finds it: in the
 * site owner's tree (localised, else at its old address), else where a harness
 * that HOLDS its own page commits it, in its own site directory
 * (`heldVisualiserPages`, wrong-direction move M1), which compose lays at its
 * route only in the site build. Only when none of
 * them holds a page is the localised route returned, for the read to fail on.
 */
function pageDirOf(repoRoot: string, harness: string, id: string, rest: Pick<VisualiserRouteParts, "subgraph" | "locale">): string {
  const site = siteOwnerDir(repoRoot);
  const parts = { harness, visualiser: id, ...rest };
  const existing = existingPageDir(site, parts);
  if (existing !== undefined) return existing;
  // A page written at publish to the layer's OUTPUT ROOT is held by neither
  // address at the pinned mount, so existingPageDir answers undefined and the
  // localised route would be guessed. Ask both addresses through the overlay,
  // in the same order (bean cat-tools-sm8r).
  const overlaid = [visualiserPageDir(site, pageParts(parts)), visualiserPageDir(site, forwardingParts(parts))].find(
    (d) => existsSync(overlayPath(join(d, "index.html"))) || existsSync(overlayPath(join(d, "index.md"))),
  );
  if (overlaid !== undefined) return overlaid;
  const held = rest.subgraph === undefined
    ? heldVisualiserPages(repoRoot).find((h) => h.visualiser.harness === harness && h.visualiser.id === id)
    : undefined;
  return held?.dir ?? visualiserPageDir(site, pageParts(parts));
}

/** The URL path `test-server.mjs` serves an absolute directory under the repository root at, with a trailing slash. */
export function servedUrl(repoRoot: string, absDir: string): string {
  return `/${relative(repoRoot, absDir).split(sep).join("/")}/`;
}

/** The absolute path of `file` (default `index.html`) in {@link declaredPageDir}. */
export function declaredPagePath(harnessRoot: string, id: string, file = "index.html", rest: Pick<VisualiserRouteParts, "subgraph" | "locale"> = {}): string {
  return join(declaredPageDir(harnessRoot, id, rest), file);
}

/**
 * The same directory as the URL path `test-server.mjs` serves it at — it
 * serves the REPOSITORY root, so this is `/` plus the directory's path from
 * there, with a trailing slash: `/cat-harness/docs/en/cat-harness/library/`.
 */
export function declaredPageUrl(harnessRoot: string, id: string, rest: Pick<VisualiserRouteParts, "subgraph" | "locale"> = {}): string {
  return servedUrl(repoRootFor(harnessRoot), declaredPageDir(harnessRoot, id, rest));
}

/**
 * The site's first-paint block from `_includes/head_custom.html`: the script
 * that sets `data-fa-scheme` from the stored or OS preference, and the ground
 * it paints for each scheme. A spec that stands in for the default layout
 * carries it, so the scheme the inks resolve to and the ground under them are
 * the same one, as on the site. Painting the dark ground alone, under
 * Playwright's default light emulation, put the light-scheme inks on the dark
 * ground: a contrast failure no reader sees. Throws when the markers are gone,
 * rather than serving a page with no scheme.
 */
export function firstPaintBlock(siteDir: string): string {
  // The include is the site CHROME's (semantic subgraphs, slice 1): resolve it
  // across the declared site layers of the layer this site directory is in.
  const file = join(dirname(siteDir), siteFileFor(dirname(siteDir), "_includes/head_custom.html"));
  const head = readFileSync(file, "utf8");
  const m = /<!-- fa-first-paint:begin -->([\s\S]*?)<!-- fa-first-paint:end -->/.exec(head);
  if (!m) throw new Error(`no fa-first-paint block in ${file}`);
  return m[1]!;
}

/** Body ink for each scheme's ground, so text outside the board is legible in both. */
export const SCHEME_INK = `<style>body{color:#fff}html[data-fa-scheme="light"] body{color:#0b0b0b}</style>`;

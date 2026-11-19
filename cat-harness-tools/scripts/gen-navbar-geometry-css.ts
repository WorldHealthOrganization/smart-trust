#!/usr/bin/env bun
/**
 * Generate `navbar-geometry.css` from `lib/navbar-geometry.ts`.
 *
 * @module scripts/gen-navbar-geometry-css
 * @covers none — generated from `lib/navbar-geometry.ts`; its source is code, which
 *   `check:partition` and the TypeScript gates already grade
 *
 * Same contract as `gen-avatars-css.ts`: the module is the source and the
 * stylesheet is a rendering of it, so a width has one home (`navbar.ts` and
 * `docs-ui.css` cannot disagree). `--check` fails when the committed file is
 * stale.
 *
 * It generates only the two custom-property DEFINITIONS; `docs-ui.css` reads
 * `var(--fa-nav-collapsed)` and `var(--fa-nav-open)` and stays hand-written.
 *
 * Exit codes: 0 written or up to date · 1 stale under `--check`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { siteFileFor } from "../schemas/kg/cat-harness.js";
import { NAV_GEOMETRY, rem } from "./lib/navbar-geometry.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

/**
 * Where the stylesheet lives. Derived from `siteDirFor`, never written down —
 * the same contract as `avatarsCssPath`, and `site-dir-single-answer` is the
 * gate that enforces it. My first draft spelled the path out and that gate
 * caught it: a literal site root is a second answer to a question the
 * declaration already answers, and it writes the file where nothing serves it
 * the moment a layer is laid out differently.
 */
export function navbarGeometryCssPath(root: string): string {
  // The site CHROME holds it (semantic subgraphs, slice 1).
  return siteFileFor(root, "assets/css/docs-ui.css");
}

/** The generated region's fences. Everything between them is this script's. */
export const BEGIN = "/* navbar-geometry:begin — GENERATED, do not edit */";
export const END = "/* navbar-geometry:end */";

export function renderNavbarGeometryCss(): string {
  const g = NAV_GEOMETRY;
  return `${BEGIN}
/* The navbar's geometry, from \`scripts/lib/navbar-geometry.ts\`. That module
 * carries the argument for every value here, including which side's numbers
 * won and why. \`navbar.ts\` interpolates the same constants into the
 * stylesheet it injects on a mounted page, so the rail and this site's sidebar
 * cannot be different widths.
 *
 * Regenerate with \`bun run cat navbar:geometry\`; \`navbar:geometry:check\` fails
 * the build when this region is stale. Edit the MODULE, never these lines. */
:root {
  /* The mark column — the avatar or glyph, and the only thing in the strip. */
  --fa-nav-mark: ${rem(g.markPx)};
  /* Gutter either side of it. DERIVED: (collapsed - mark) / 2. */
  --fa-nav-pad: ${rem(g.padPx)};
  /* At rest. Closed is NOT gone — a width, never a \`visibility: hidden\`. */
  --fa-nav-collapsed: ${rem(g.collapsedPx)};
  /* Open, at the theme's mq(md). */
  --fa-nav-open: ${rem(g.openPx)};
}

/* The theme widens its own sidebar here, with a \`min-width\` FLOOR in
 * layout.scss that a later \`width\` cannot cross. That floor is why these are
 * the numbers both surfaces adopt rather than the rail's. */
@media (min-width: ${rem(g.wideMqPx)}) {
  :root { --fa-nav-open: ${rem(g.openWidePx)}; }
}
${END}`;
}

/** Put the region into a stylesheet, replacing any earlier one. */
export function withGeometry(css: string): string {
  const block = renderNavbarGeometryCss();
  const at = css.indexOf(BEGIN);
  if (at === -1) return `${block}\n\n${css}`;
  const end = css.indexOf(END, at);
  if (end === -1) {
    throw new Error(
      `${NAVBAR_GEOMETRY_MARKER_ERROR} — found ${BEGIN} with no ${END}. Refusing to guess ` +
        `where the region ends; a wrong guess would eat authored CSS.`,
    );
  }
  return css.slice(0, at) + block + css.slice(end + END.length);
}

/** Named so the refusal above reads as one sentence in a test. */
export const NAVBAR_GEOMETRY_MARKER_ERROR = "navbar-geometry: unterminated region";

if (import.meta.main) {
  const check = process.argv.includes("--check");
  // THE LAYER this script belongs to — the one it lives in — not whatever
  // directory the gate was invoked from, for the reason `gen-avatars-css.ts`
  // states: `siteDirFor(cwd)` throws on a `harness.json` one directory down.
  const root = HARNESS_ROOT;
  const rel = navbarGeometryCssPath(root);
  const path = join(root, rel);
  if (!existsSync(path)) {
    console.error(`navbar-geometry: ${rel} does not exist — nothing to write the region into.`);
    process.exit(1);
  }
  const current = readFileSync(path, "utf8");
  const next = withGeometry(current);

  if (check) {
    if (current === next) {
      console.log(`navbar geometry in ${rel} is up to date`);
      process.exit(0);
    }
    console.error("the navbar geometry region is stale — run `bun run cat navbar:geometry` and commit");
    process.exit(1);
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next);
  console.log(
    `wrote the navbar geometry region into ${rel} ` +
      `(strip ${NAV_GEOMETRY.collapsedPx}px, open ${NAV_GEOMETRY.openPx}px)`,
  );
}

/**
 * A tile per declared visualisation — derived, never a second list.
 *
 * @module scripts/graph-tiles
 *
 * A tile is not a function of nodes: if a harness declares visualisers for a
 * directory it watches, each gets a tile (with a title, themed by default),
 * which opens the existing visualisation. A harness may declare one or more.
 *
 * The tile set is the visualiser obligation made reachable:
 * `SubgraphCoverageSchema.visualiser` is where a layer says what renders a
 * directory, and `check:subgraph-coverage` reports the ones that owe one. No
 * second list exists to disagree with it. Nothing here builds a viewer; a tile
 * carries the declared ref and opens it.
 *
 * ## DECLARATION, not projection
 *
 * "No projection at my path" and "nothing renders this" are different facts.
 * A tile derives from the declaration, and **a live projection with no
 * declaration is a FINDING** ({@link undeclaredProjections}).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  type CatHarnessDeclaration,
  type GlassStripPin,
  type TileSurface as CatHarnessTileSurface,
  type Visualisation,
  showsOn,
  TILE_SURFACES,
  visualisationsOf,
} from "../schemas/kg/cat-harness.js";
import { tileLabel } from "./lib/nav-label.js";
import { BASE_GRAPH_TYPOLOGIES, defaultGraphTypologies } from "../schemas/kg/graph-typology-registry.ts";

/** Where a tile may appear. A visualisation that says nothing appears on every surface. */
export type TileSurface = CatHarnessTileSurface;

/** One tile, ready for a template. */
export interface GraphTile {
  /** `<directory>/<n>` — stable, and unique when a directory declares several. */
  id: string;
  /** The directory this visualises. */
  directory: string;
  /**
   * What the tile says: the destination's ONE label (`lib/nav-label.ts`,
   * bean `ob3m` finding 6). The declared title with any harness suffix
   * stripped, else the display name of the directory's first kind. Never the
   * directory id, which is what put `root-docs` on the glass beside `docs` on
   * the rail for the same page.
   */
  title: string;
  /**
   * The harness this tile's directory belongs to, by its declared title —
   * appended to the label where the harness matters ("Docs · C@T Harness"),
   * never folded into it. Absent when the caller did not say.
   */
  qualifier?: string;
  /**
   * True when another tile carries the same {@link title}, so the qualifier
   * is what tells them apart and is SHOWN beside the label rather than only
   * spoken. Decided here, over the whole set, because the client draws one
   * tile at a time and cannot see the others. Elsewhere the qualifier is in
   * the accessible name and the tooltip only: a square tile has room for one
   * line, and on a tile with a unique name the second line hid its count.
   */
  showQualifier?: true;
  /** The declared page, repo-root relative, exactly as declared. */
  ref: string;
  /**
   * Where the tile opens, as the PUBLISHED site serves it — or absent.
   *
   * **A declared path is not a published URL**, and this repository has
   * already paid for the confusion once: `prc5`, where a tile's `<img>`
   * carried `docs/assets/…` and 404'd for every reader, because the site build
   * copies the site directory's CONTENTS to the mount and the declared prefix
   * is exactly what a published URL does not carry.
   *
   * ABSENT when the declared page is not under the published site — a
   * layer may declare a viewer that lives somewhere this site does not
   * serve. `pb04` one layer down: a tile with no href is not a link, which is
   * better than a link to nowhere.
   */
  href?: string;
  /** Where it appears, resolved: absent on the declaration means both. */
  surfaces: TileSurface[];
  /**
   * The directory holds materialized content: openable, and not editable here.
   *
   * ## THE TWO GREYS, and why they must not collapse
   *
   * A tile with no {@link href} and a tile that is `readOnly` both render
   * inert, and they are different facts:
   *
   * - **no `href`** — nothing to open. Either nobody built a viewer, or the
   *   declared page is not under the published site (`pb04`: no link beats a
   *   dead one).
   * - **`readOnly`** — it opens perfectly. It refuses an EDIT, and it is the
   *   one that offers the copy-out.
   *
   * Collapsing them tells a reader "there is nothing here" about content that
   * is present, complete, and deliberately frozen — and then the copy-out, the
   * only way to work on it, has nowhere to be offered from.
   *
   * ABSENT MEANS NOT DECLARED, never `false`. Same as the declaration it comes
   * from, and for the same reason: a directory that has not answered has not
   * asserted it is writable.
   */
  readOnly?: boolean;
  /**
   * Whether it starts out of frame.
   *
   * The DECLARED default only. A reader's own hiding is theirs alone and is
   * committed nowhere — the rule `reader-filter.ts` states for the other
   * view-time control on this surface.
   */
  hidden: boolean;
  /** The tile's theme: its own, then the directory's, then absent (the layer's). */
  theme?: string;
  /**
   * `"staging-only"` when the page this tile opens is withheld from the
   * canonical deploy, or absent.
   *
   * CARRIED SO THE TILE CAN VANISH WITH ITS PAGE. `compose-docs.ts` withholds
   * the page on a canonical build; a tile left pointing at it is a link to a
   * 404, which is `pb04` — a dead link is worse than no link, and worse here
   * than elsewhere because the tile ALSO advertises the existence of content
   * the declaration is deliberately not publishing.
   *
   * Filtered client-side rather than dropped here, for the same reason
   * `harness.json` carries `hidden` rather than omitting hidden tiles: this
   * file is generated once and committed, so it cannot know which deploy will
   * serve it. The page can be withheld at compose time because compose runs
   * per deploy; the data file cannot.
   */
  publish?: string;
  /**
   * The declared glyph NAME, passed through untouched — or absent.
   *
   * Nothing here validates it against the client's registry, and that is the
   * design rather than an omission. The registry is in `docs-ui.js`, deployed
   * with the site and authored apart from any folio's declaration; a generator
   * that refused an unknown name would fail a build over a glyph, and one that
   * silently dropped it would make a typo indistinguishable from a tile that
   * declared nothing. The renderer falls back and the reader still gets a
   * working tile. See `VisualisationSchema.icon`.
   */
  icon?: string;
  /**
   * The projection's DECLARED headline number, and what it counts.
   *
   * Both present or both absent — a count with no unit is the ambiguity
   * `schemas/ui/tile-count.ts` exists to remove, and {@link withTileCounts} is
   * the only writer, so the pair cannot come apart.
   *
   * ABSENT is a third state and must not be rendered as `0`. A tile whose
   * projection declares no count, or whose projection could not be read, is
   * not a tile over an empty graph — opposite facts, and `dh4f` is this
   * repository's name for conflating them.
   */
  count?: number;
  unit?: string;
}

/** The directory fields a tile is derived from — named rather than imported. */
export type TiledDirectory = {
  id: string;
  /** `repository` when the path is resolved from the repository root rather than the layer's. */
  scope?: string;
  coverage?: Parameters<typeof visualisationsOf>[0];
  /** A theme reference (#1168 B8); the tile carries its `themeId`. */
  theme?: { themeId: string; instance?: string };
  /** The directory holds materialized content. Absent is NOT DECLARED, never `false`. */
  readOnly?: boolean;
  /** The directory's declared graph typologies — the icon a tile falls back to. */
  graphTypologies?: readonly string[];
};

/**
 * The tile icon a graph TYPOLOGY stands for, used when a visualisation names none
 * (bean `ob3m` finding 11). Most tiles are derived from a dependency's
 * directory rather than declared, so a declared-only icon left 20 of 29 tiles
 * in the More panel drawing the same net. A tile still names its own icon
 * when it wants a different one; this only fills the gap.
 *
 * Values are names in `TILE_GLYPHS` (`docs/assets/js/docs-ui.js`).
 * `check:navbar-consistency` fails a value that is not drawn there.
 */
export const KIND_TILE_ICONS: Readonly<Record<string, string>> = Object.fromEntries(
  // A FIELD on each kind since sod4 #5 (`tileIcon`), cat-harness's own and a
  // declared node's alike; this map is derived for the callers that read it.
  Object.entries(BASE_GRAPH_TYPOLOGIES).flatMap(([k, d]) => (d.tileIcon ? [[k, d.tileIcon]] : [])),
);

/** The first of `kinds` that has a tile icon, or `undefined`. */
export function kindTileIcon(kinds: readonly string[] | undefined): string | undefined {
  for (const k of kinds ?? []) {
    if (Object.hasOwn(KIND_TILE_ICONS, k)) return KIND_TILE_ICONS[k];
    // A kind another harness DECLARES carries its own tile icon (bean dmx1), so
    // this table lists only cat-harness's own kinds.
    const declared = defaultGraphTypologies.get(k)?.tileIcon;
    if (declared) return declared;
  }
  return undefined;
}

/**
 * Every tile a layer's declarations yield.
 *
 * Ordered by directory then by declaration order, which is the declaration's
 * own order and therefore stable across regenerations — the property that lets
 * this be a generated artefact rather than a snapshot.
 */
export function publishedHref(siteDirFromRepoRoot: string, ref: string): string | undefined {
  const prefix = `${siteDirFromRepoRoot.replace(/\/$/, "")}/`;
  if (!ref.startsWith(prefix)) return undefined;
  const rest = ref.slice(prefix.length);
  // `…/index.html` is the directory's own route. Served either way, but the
  // directory form is what every other link on this site uses, and two
  // spellings of one page is two entries in a reader's history.
  //
  // `.md` TOO, and it is not cosmetic here. A visualisation authored as
  // markdown is a SOURCE path; Jekyll renders it and no `.md` is ever served,
  // so a tile pointing at `/x/index.md` is a guaranteed 404 — `pb04`, a dead
  // link being worse than no link. Every visualisation was `.html` until
  // `fsh-guts` was authored as markdown (2026-09-21), which is why this went
  // unnoticed: the bug needed a markdown viewer to exist before it could fire.
  //
  // A NAMED markdown page is the same 404 and the fix above did not cover it.
  // `processes-index.md` (2026-09-22) is not `index.md`, so the directory
  // rewrite left the extension alone and the tile pointed at a source file.
  // The argument in the paragraph above applies verbatim — Jekyll serves no
  // `.md` — so the extension is mapped rather than stripped, which is what
  // Jekyll actually does to a page that is not a directory index.
  const route = rest.replace(/(^|\/)index\.(html|md)$/, "$1").replace(/\.md$/, ".html");
  return `/${route}`;
}

export function graphTiles(
  dirs: readonly TiledDirectory[],
  /** The site directory, relative to the repository root. Omit for no hrefs. */
  siteDirFromRepoRoot?: string,
  /**
   * The harness each directory belongs to, as its declared title — the tile's
   * qualifier. Omit and no tile carries one.
   */
  qualifierFor?: (d: TiledDirectory) => string | undefined,
  /** Harness names a declared title may end with, as "Docs — cat-harness". Stripped from the label. */
  harnessNames: readonly string[] = [],
  /**
   * The name the harness rows already give a destination (`href`), when they
   * give one. Consulted ONLY for a tile with no declared title, in place of
   * the directory's first kind (cat-harness-tools#1701): a base layer's
   * `schemas/` declares `["code", "schemas"]` and opens the schema viewer, so
   * the rows, FOLDERS and the sidebar call that page "Schemas" while the
   * first-kind fallback made its tile "Code" — two names for one destination,
   * which `check:nav-names` fails. A declared title still wins, unchanged.
   */
  labelFor?: (href: string) => string | undefined,
): GraphTile[] {
  const tiles: GraphTile[] = [];
  // ONE TILE PER PAGE (#1168 B7a-2b, owner 2026-09-29: "tiles for all, one
  // per page"). Viewers are read from the pages now, and one page may draw
  // several directories — the processes index draws every layer's. The
  // tile goes to the layer's OWN directory before a repository-scoped one,
  // then by id, so the page keeps the tile it had when it was declared.
  const opened = new Set<string>();
  const order = [...dirs].sort(
    (a, b) =>
      Number(a.scope === "repository") - Number(b.scope === "repository") || a.id.localeCompare(b.id, "en"),
  );
  const firstFor = new Map<string, string>();
  for (const d of order) for (const v of visualisationsOf(d.coverage, d.id)) if (!firstFor.has(v.ref)) firstFor.set(v.ref, d.id);
  for (const d of [...dirs].sort((a, b) => a.id.localeCompare(b.id, "en"))) {
    const vis = visualisationsOf(d.coverage, d.id).filter((v) => firstFor.get(v.ref) === d.id && !opened.has(v.ref));
    for (const v of vis) opened.add(v.ref);
    vis.forEach((v: Visualisation & { title: string }, i) => {
      // `visualisationsOf` and `viewersOf` both fall back to the directory id
      // when nothing is declared. That fallback is not a name, so it is read
      // as "not declared" and the kind's display name is used instead.
      const declared = v.title === d.id ? undefined : v.title;
      const qualifier = qualifierFor?.(d);
      const href = siteDirFromRepoRoot === undefined ? undefined : publishedHref(siteDirFromRepoRoot, v.ref);
      const rowName = declared === undefined && href !== undefined ? labelFor?.(href) : undefined;
      tiles.push({
        // The index is part of the id only where it has to be. A directory
        // with one visualisation gets its own name, which is what a reader
        // sees in a URL fragment and what a test addresses it by.
        id: vis.length === 1 ? d.id : `${d.id}/${i + 1}`,
        directory: d.id,
        title: rowName ?? tileLabel(d, declared, harnessNames),
        ...(qualifier ? { qualifier } : {}),
        ref: v.ref,
        surfaces: TILE_SURFACES.filter((s) => showsOn(v, s)),
        ...(href === undefined ? {} : { href }),
        hidden: v.hidden === true,
        // FROM THE DIRECTORY, NOT THE VISUALISATION. Read-only is a property of
        // the CONTENT — several visualisations of one directory are several
        // views of the same frozen nodes, so a per-view answer could disagree
        // with itself about one corpus.
        ...(d.readOnly === undefined ? {} : { readOnly: d.readOnly }),
        ...((v.icon ?? kindTileIcon(d.graphTypologies)) === undefined ? {} : { icon: v.icon ?? kindTileIcon(d.graphTypologies) }),
        ...(v.publish === undefined ? {} : { publish: v.publish }),
        // The published tile carries the theme's ID, not the reference: the
        // browser reads `harness.json`, and the reference is a declaration shape.
        ...((v.theme ?? d.theme) ? { theme: (v.theme ?? d.theme)!.themeId } : {}),
      });
    });
  }
  const seen = new Map<string, number>();
  for (const t of tiles) seen.set(t.title, (seen.get(t.title) ?? 0) + 1);
  for (const t of tiles) if (t.qualifier && seen.get(t.title)! > 1) t.showQualifier = true;
  return tiles;
}

/** The glass's pinned strip, resolved to the ids the page draws. */
export interface GlassStrip {
  /**
   * Strip ids in declared order: `glass-<chrome>` for the glass's own
   * controls, a {@link GraphTile.id} for a kind's tile.
   */
  pinned: string[];
  /**
   * Kinds the declaration pins that no glass tile here holds. A FINDING, not
   * a silent skip: "pinned and absent" and "not pinned" are different facts,
   * and the strip cannot show the difference.
   */
  unmatched: string[];
}

/**
 * Resolve a `glassStrip` declaration against the tiles this site publishes.
 *
 * Owner, 2026-10-01 (bean `ob3m` finding 10): **"Pinned tiles first, plus
 * '+N more'"**. A `kind` pin takes ONE tile — the tile whose directory id IS
 * the kind when there is one, else the first glass tile (in `tiles` order)
 * whose directory holds the kind. One slot per kind is the owner's
 * "deduplicate across harnesses": the other harnesses' tiles of that kind
 * stay in More, where their qualifiers tell them apart.
 *
 * A tile that is hidden by default, withheld from some deploys (`publish`),
 * or has no page to open is never pinned: a pinned tile that vanishes on the
 * canonical site, or opens nothing, would be a slot that promises and
 * delivers nothing (`pb04`).
 */
export function resolveGlassStrip(
  pins: readonly GlassStripPin[],
  tiles: readonly GraphTile[],
  kindsOf: ReadonlyMap<string, readonly string[] | undefined>,
): GlassStrip {
  const pinned: string[] = [];
  const unmatched: string[] = [];
  const usable = tiles.filter((t) => t.surfaces.includes("glass") && !t.hidden && t.publish === undefined && t.href !== undefined);
  for (const pin of pins) {
    if ("chrome" in pin) {
      pinned.push(`glass-${pin.chrome}`);
      continue;
    }
    const holds = usable.filter((t) => !pinned.includes(t.id) && (kindsOf.get(t.directory) ?? []).includes(pin.kind));
    const tile = holds.find((t) => t.directory === pin.kind) ?? holds[0];
    if (tile) pinned.push(tile.id);
    else unmatched.push(pin.kind);
  }
  return { pinned, unmatched };
}

/** The tiles for one surface, in declaration order. */
export function tilesOn(tiles: readonly GraphTile[], surface: TileSurface): GraphTile[] {
  return tiles.filter((t) => t.surfaces.includes(surface));
}

/**
 * Directories that visibly HAVE a viewer and declare none — `flh4`'s third state.
 *
 * Not "tiles we are missing": a finding, naming a declaration somebody has to
 * write. Returning the ids rather than silently adding tiles for them is the
 * whole point — a tile that appeared without a declaration would make the
 * audit that reports the gap look wrong.
 *
 * `published` is asked of the caller rather than of the disk, so this is
 * testable without a filesystem and so the definition of "has a viewer" stays
 * the caller's. {@link publishedProjection} is the one this repository uses.
 */
export function undeclaredProjections(
  dirs: readonly TiledDirectory[],
  published: (id: string) => boolean,
): string[] {
  return dirs
    .filter((d) => visualisationsOf(d.coverage, d.id).length === 0 && published(d.id))
    .map((d) => d.id)
    .sort((a, b) => a.localeCompare(b, "en"));
}

/** Does this site publish a page at the directory's own route? */
export function publishedProjection(siteDir: string, id: string): boolean {
  return existsSync(join(siteDir, id, "index.html"));
}

/**
 * Findings for a whole layer, in the shape `harness-tiles.ts` already uses.
 *
 * Phrased as the repair rather than as the symptom: *"declare it"* is the
 * action, and `coverage.visualiser` is where.
 */
export function tileFindings(
  instance: string,
  dirs: readonly TiledDirectory[],
  published: (id: string) => boolean,
): string[] {
  return undeclaredProjections(dirs, published).map(
    (id) =>
      `${instance}/${id}: a viewer is published at /${id}/ and the directory declares no ` +
      `viewer, so it gets no tile. Have its generator name the directory in the page ` +
        `(\`withRenders\`, #1168 B7a) and the tile follows.`,
  );
}

/**
 * Attach each tile's declared count, where its directory declared one.
 *
 * ## Why this is a separate pass rather than part of `graphTiles`
 *
 * `graphTiles` derives a tile from the DECLARATION and reads no projection —
 * the header of this file says why, and `flh4` is the bean. A count comes
 * from the projection, so folding the read into that function would make the
 * rule this file states untrue of the function it states it about.
 *
 * Kept apart, the split is legible in the types: the tile EXISTS because a
 * visualiser was declared, and it carries a NUMBER because a projection
 * offered one. A directory with a projection and no declaration still gets no
 * tile — it is {@link undeclaredProjections}, a finding.
 *
 * ## Pure, like `undeclaredProjections`
 *
 * The map is handed in rather than read from disk, for the reason stated on
 * that function: testable without a filesystem, and the definition of "the
 * projections" stays the caller's. `sync-docs-harness.ts` supplies this
 * repository's.
 *
 * Keyed by `directory`, NOT by `id`. A directory declaring several
 * visualisations mints ids like `library/2`, and every one of them is a view
 * of the same graph — so they share its number, and a projection does not
 * have to know how many tiles were drawn over it.
 */
export function withTileCounts(
  tiles: readonly GraphTile[],
  counts: ReadonlyMap<string, { count: number; unit: string }>,
): GraphTile[] {
  return tiles.map((t) => {
    const c = counts.get(t.directory);
    // Spread only when present. An explicit `count: undefined` would serialise
    // as a `"count": null` in the emitted JSON on some paths and read back as
    // a declared value; absent must stay absent all the way to the browser.
    return c === undefined ? t : { ...t, count: c.count, unit: c.unit };
  });
}

/**
 * Declared visualisation ref → the directory id that declared it.
 *
 * ## Why a generator needs this, and why it is a LOOKUP rather than a rule
 *
 * Issue #863. A tile's count is keyed by directory id ({@link withTileCounts}),
 * but a scoped viewer's generator knows the SUBJECT it is rendering — a
 * layer name like the content core's — not the id of the directory whose
 * declaration produced the tile. The obvious bridge is to compose one from the
 * other, and it is wrong on this repository's own corpus:
 *
 * | subject | declared directory id |
 * |---|---|
 * | `detangle` | `detangle-schemas` |
 * | `large-datasets` | `large-datasets-schemas` |
 * | **the content core** | **`folio-assist-core-schemas`** |
 *
 * Three follow `${subject}-schemas` and the fourth does not. A composed key
 * would have badged three tiles, left the fourth silently uncounted, and
 * looked correct — which is the table of guesses #856 refused, arriving one
 * layer along.
 *
 * SO NOTHING IS COMPOSED. The declaration already names the exact page each
 * directory is visualised by, and a generator already knows the exact page it
 * is about to write. Matching on that page is an identity, not a heuristic: it
 * cannot be right for three ids and wrong for a fourth, and a directory
 * renamed tomorrow carries its own answer.
 *
 * ## Refs are compared as declared
 *
 * No normalising, no resolution: the caller passes the same repo-relative
 * path the declaration holds, which is what `viewerPlacement` already
 * composes. Normalising here would be this function inventing an equivalence
 * the declaration never stated — and a ref that does not match is absent,
 * which is the third state and gets no badge rather than a wrong one.
 *
 * A ref declared by two directories keeps the FIRST, for the reason
 * `scanTileCounts` keeps the first of a duplicated key: two declarations over
 * one page is a defect in the declarations, not something to settle by
 * iteration order.
 */
export function directoryByVisualisationRef(
  dirs: readonly TiledDirectory[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of dirs) {
    for (const v of visualisationsOf(d.coverage, d.id)) {
      if (!out.has(v.ref)) out.set(v.ref, d.id);
    }
  }
  return out;
}

export type { CatHarnessDeclaration };

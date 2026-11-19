/**
 * The number a graph tile shows, DECLARED BY THE PROJECTION.
 *
 * ## Declared, not computed
 *
 * `graph-tiles.ts` builds a tile from the DECLARATION, never from the
 * projection: a tile's EXISTENCE stays declaration-derived, and only its
 * NUMBER is read from here. A live projection with no declared visualiser is
 * still a finding, not a tile.
 *
 * There is **no uniform entry count**: a projection holds several arrays
 * (`schemas` has `roots`, `modules`, `decls`, `edges`), and a meaningful
 * number may not be an array length at all (uploads WAITING, not uploads).
 * Only the generator knows which number is the one, so the generator says.
 *
 * ## KEYED BY DIRECTORY, because one projection can serve two tiles
 *
 * `uploads` and `library` are **two tiles over one dataset**: the queue lives
 * in `assets/library/index.json`, and `gen-uploads-viz.ts` publishes a viewer
 * and no projection of its own. So that file owes two numbers — entries for
 * the corpus tile, waiting for the queue tile — which a single
 * `{count, unit}` per file could not carry.
 *
 * ## `unit` is not decoration
 *
 * `8` on a tile is ambiguous in a way `8 entries` is not, when the same
 * projection also lists uploads. The unit also reaches the accessible name.
 *
 * ## Absent is a THIRD STATE
 *
 * {@link readTileCounts} yields nothing for a projection that declares no
 * counts, declares malformed ones, or cannot be read — and **never `0`**. An
 * absent count and an empty graph are opposite facts; the UI draws no badge
 * at all for the first.
 *
 * A malformed entry is dropped WITHOUT dropping its siblings, so one bad
 * declaration in a shared projection cannot silence the tile beside it.
 *
 * ## A badge is exactly as fresh as its projection
 *
 * The badge and the page it opens read the SAME document, so they cannot
 * disagree. A committed projection's lag therefore shows on the tile:
 * `assets/beans/index.json` is existence-gated, and `docs-site.yml`
 * regenerates before publishing. A number read from a LOCAL checkout is the
 * committed projection's, not the site's; compare against the deployed page,
 * or regenerate first.
 *
 * @graphNode schema
 * @module schemas/tile-count
 */

import { z } from "zod";

/** What a projection says about one tile's headline number. */
export interface TileCount {
  /** The headline number. `0` is a legitimate, meaningful value. */
  count: number;
  /**
   * What is being counted, as a noun the reader sees — `"entries"`,
   * `"beans"`, `"waiting"`. Pluralisation is the declarer's, because only it
   * knows whether its unit pluralises regularly.
   */
  unit: string;
}

/** The field a projection carries them in. One name, so a consumer needs no table. */
export const TILE_COUNT_FIELD = "tile" as const;

/**
 * Read a projection's declared counts as `directory id → count`.
 *
 * Deliberately total and deliberately silent: a projection is allowed not to
 * declare any, so an empty result is a normal answer rather than an error.
 * What it must never do is answer `0` for a question it could not read — see
 * the third-state note above.
 *
 * `count` is checked for finiteness rather than for `typeof === "number"`
 * alone, because `NaN` and `Infinity` are numbers and both would render as a
 * badge that means nothing. `unit` is required and must be non-blank: a bare
 * number is the ambiguity this field exists to remove, so a declaration that
 * omits the unit is malformed rather than partially usable.
 *
 * Own properties only. `hasOwnProperty` via `Object.prototype` rather than the
 * layer's, and `Object.keys` rather than `for…in`: `constructor` and
 * `toString` are inherited by every object literal, so a naive walk would mint
 * entries for directories nobody declared. The same trap `glyphFor` carries a
 * note about in `docs-ui.js`.
 */
export function readTileCounts(projection: unknown): Map<string, TileCount> {
  const out = new Map<string, TileCount>();
  if (typeof projection !== "object" || projection === null) return out;
  const raw = (projection as Record<string, unknown>)[TILE_COUNT_FIELD];
  if (typeof raw !== "object" || raw === null) return out;
  for (const id of Object.keys(raw as Record<string, unknown>)) {
    const entry = (raw as Record<string, unknown>)[id];
    if (typeof entry !== "object" || entry === null) continue;
    const { count, unit } = entry as Record<string, unknown>;
    if (typeof count !== "number" || !Number.isFinite(count)) continue;
    if (typeof unit !== "string" || unit.trim() === "") continue;
    out.set(id, { count, unit: unit.trim() });
  }
  return out;
}

/**
 * The value a generator embeds, for one or more directories.
 *
 * It exists so no generator spells the field name itself — the one place a
 * projection and its reader could disagree — and so the keyed shape is
 * obvious at the call site rather than being a nested literal.
 *
 * ```ts
 * ...tileCounts({ library: [entries.length, "entries"],
 *                 uploads: [waiting, "waiting"] })
 * ```
 */
export function tileCounts(
  byDirectory: Readonly<Record<string, readonly [number, string]>>,
): { tile: Record<string, TileCount> } {
  const tile: Record<string, TileCount> = {};
  for (const id of Object.keys(byDirectory)) {
    const [count, unit] = byDirectory[id]!;
    tile[id] = { count, unit };
  }
  return { [TILE_COUNT_FIELD]: tile };
}

/**
 * The field, for a projection schema that is `.strict()` — which every one of
 * them is, deliberately.
 *
 * Adding a field to a projection without declaring it here is not a cosmetic
 * omission: `todo-index`'s own guard is named *"an UNDECLARED field fails —
 * this is what was missing while three landed unnoticed"*, and it caught this
 * field on its first run. A projection's schema is what tells a consumer the
 * document is complete, so a field that publishes without being declared is a
 * field no consumer can rely on.
 *
 * `.optional()` because declaring a count is the projection's choice. A
 * required field would make the third state impossible to express: every
 * projection would have to claim a number, and the ones with nothing
 * meaningful to count would have to invent one.
 *
 * The record is open-keyed — a directory id is not a closed set, and a
 * projection may declare for a directory this schema has never heard of. The
 * VALUES are closed, which is where a malformed declaration actually hides.
 */
export const TileCountsSchema = z
  .record(
    z.string().min(1),
    z.object({ count: z.number().finite(), unit: z.string().min(1) }).strict(),
  )
  .optional();

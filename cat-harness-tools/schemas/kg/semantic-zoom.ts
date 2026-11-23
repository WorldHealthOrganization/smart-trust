/**
 * When a card stops rendering its words and becomes its avatar.
 *
 * @module schemas/semantic-zoom
 * @graphNode schema
 *
 * As the board shrinks, a card stops rendering its words and renders its
 * avatar instead. The threshold is declared data, not a literal in the
 * renderer.
 *
 * ## Folio default, a kind may override
 *
 * This repository's inheritance rule, unchanged: the folio always has a
 * number, every kind resolves to one, and a kind that states nothing is
 * **complete rather than invalid** — requiredness is checked after
 * resolution, never on the declaration.
 *
 * ## An override CITES WHY, and the resolver says where the number came from
 *
 * `because` is required on an override, and {@link zoomThresholdFor} returns
 * the `source` alongside the value, so a reviewer can tell a deliberate
 * override from the default.
 *
 * **It is not an entity.** ZoomThreshold has no identifier of its own and
 * cannot exist apart from the folio or the kind that states it.
 *
 * ## PIXELS, not board units
 *
 * Legibility is a property of what reaches the reader's eye, so the threshold
 * is the card's RENDERED width in CSS pixels, after zoom — unlike
 * `board-positions.ts`, which stores board units so a file does not bake in
 * a viewport.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

/** The document's own declaration of what it is, inside the file. */
export const SEMANTIC_ZOOM_SCHEMA_TAG = "folio-semantic-zoom/v1";

/**
 * One kind's override.
 *
 * `because` is not documentation — it is the trace. See the module docs.
 */
export const KindZoomSchema = z
  .object({
    /** Rendered card width, in CSS pixels, below which this kind shows its avatar. */
    belowPx: z.number().positive().finite(),
    /** Why this kind differs from the folio's default. Required on every override. */
    because: z.string().min(1),
  })
  .strict();
export type KindZoom = z.infer<typeof KindZoomSchema>;

/** A folio's semantic-zoom declaration: one default, and any number of overrides. */
export const SemanticZoomSchema = z
  .object({
    $schema: z.literal(SEMANTIC_ZOOM_SCHEMA_TAG),
    /** The folio's default, in CSS pixels. Required — so nothing is ever unstated. */
    belowPx: z.number().positive().finite(),
    /** Overrides, keyed by kind. A kind absent here takes the default. */
    byKind: z.record(z.string().min(1), KindZoomSchema).default({}),
  })
  .strict();
export type SemanticZoom = z.infer<typeof SemanticZoomSchema>;

/** The file's name inside the graph directory it is declared in. */
export const SEMANTIC_ZOOM_FILE = "semantic-zoom.json";

/** Where a resolved threshold came from. */
export type ZoomSource = "folio" | "kind";

/** A resolved threshold, with its provenance. */
export type ResolvedZoom = {
  belowPx: number;
  source: ZoomSource;
  /** Present exactly when `source` is `"kind"` — an override always cites why. */
  because?: string;
};

/**
 * The threshold for one kind, resolved, with where it came from.
 *
 * **A bare number would have been the wrong return type** and the module docs
 * say why: an inherited value is still a fact somebody must be able to trace.
 * A reviewer looking at a card that flipped too early needs to know whether
 * somebody decided that or whether the folio's default landed somewhere it
 * does not fit, and those are different bugs with different fixes.
 */
export function zoomThresholdFor(zoom: SemanticZoom, kind: string): ResolvedZoom {
  const override = zoom.byKind[kind];
  if (override === undefined) return { belowPx: zoom.belowPx, source: "folio" };
  return { belowPx: override.belowPx, source: "kind", because: override.because };
}

/**
 * Whether a card of this kind renders its avatar at this rendered width.
 *
 * Strictly below, so the declared number is the last width that still shows
 * words. A boundary stated one way in a comment and the other way in the
 * renderer is the kind of disagreement nobody notices until a card flickers.
 */
export function rendersAvatar(zoom: SemanticZoom, kind: string, widthPx: number): boolean {
  return widthPx < zoomThresholdFor(zoom, kind).belowPx;
}

/**
 * The folio's declaration, or `undefined` when it has not made one.
 *
 * ## Where the file lives, and why it took a bean to decide
 *
 * At the **root of the layer that owns the folio**, beside its
 * `<name>.config.json` — because the threshold is a fact about the FOLIO, and
 * that is where a folio's own declarations sit. (It said `harness.json` until
 * #649 renamed every declaration to carry its layer's name; the rule is
 * unchanged, the filename is not composable any more.) Not the instantiation root: that is
 * where `<name>.config.json` says a layer is instantiated HERE, which is a
 * different question from what one of them declares about its content.
 *
 * The other two candidates were wrong for reasons worth keeping. A board
 * cannot own it, because the threshold survives deleting every board and
 * `board-diagram-interchange`'s test says a fact that survives the layout is
 * not layout. And a new graph TYPOLOGY would have been a directory, a declaration
 * entry and a consumer contract for one object with no identifier of its
 * own.
 *
 * ## `undefined` is a real answer and is never a number
 *
 * The schema gives `belowPx` no default *"so nothing is ever unstated"*, and
 * this function keeps that promise at the file boundary: a folio that has not
 * declared a threshold gets `undefined`, and every consumer must then say it
 * could not determine one rather than reaching for a literal. That is the
 * whole of R2 — *"the threshold SHALL be declared data, not a literal in the
 * renderer"* — and a fallback here would have put the literal one layer down
 * where nobody would look for it.
 *
 * A present-but-unparseable file **throws**, on the rule this repository
 * applies to every declaration: absent is a decision, malformed is a defect,
 * and treating the second as the first hides it.
 */
export function readSemanticZoom(root: string): SemanticZoom | undefined {
  const p = join(root, SEMANTIC_ZOOM_FILE);
  if (!existsSync(p)) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(p, "utf-8"));
  } catch (e) {
    throw new Error(
      `${p} is not valid JSON (${e instanceof Error ? e.message : String(e)}). ` +
        `A malformed declaration is a defect, not an absent one.`,
    );
  }
  return SemanticZoomSchema.parse(raw);
}

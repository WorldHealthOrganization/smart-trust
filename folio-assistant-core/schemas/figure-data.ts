/**
 * The shapes of figure data held on a library entry's `figure-data/`: a
 * published chart transcribed as data, so a generator can redraw it and every
 * handbook that reprints it points at one file (owner, 2026-10-31, option B:
 * the data lives on the library entry of the publication that prints it).
 *
 * | family | drawn by |
 * |---|---|
 * | `diig-phases-figure/v1` | `scripts/diig-phases-svg.ts` |
 * | `diig-phases-adaptation/v1` | `scripts/diig-phases-svg.ts` (a folio's own tiles over a figure) |
 * | `smart-guidelines-approach-figure/v1` | `scripts/smart-approach-svg.ts` |
 * | `as-drawn-figure/v1` | `scripts/as-drawn-svg.ts` (any figure, transcribed from its PDF by `scripts/pdf-as-drawn.py`) |
 *
 * The library typology routes the two figure families (cat-harness-tools
 * `graph-typology-registry.ts`); `validators/` names these schemas for them.
 * The generators keep their own TypeScript interfaces; these schemas check the
 * same fields, and the tests check these schemas against small inline fixtures.
 *
 * @graphNode schema
 */
import { z } from "zod";
import { nodeKind } from "@litlfred/cat-harness-tools/schemas/kg/node-kind.ts";

const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/u, "a #RRGGBB colour");
const Lines = z.array(z.string()).min(1);
const Span = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]);

const FigureRef = z.object({
  library: z.string().min(1),
  label: z.string().min(1),
  caption: z.string().min(1),
  page: z.number().int().positive(),
  file: z.string().min(1),
});

const Link = z.object({
  library: z.string().optional(),
  glossary: z.string().optional(),
  url: z.string().optional(),
}).strict();

const Phase = z.object({
  id: z.string().min(1),
  name: Lines,
  color: Hex,
  tint: Hex,
  steps: z.array(z.string()),
}).strict();

const Resource = z.object({
  id: z.string().min(1),
  label: Lines,
  icons: z.array(z.string()),
  smallPrint: z.array(z.string()).optional(),
  parts: z.array(z.array(z.string())).optional(),
  link: Link.optional(),
}).strict();

const Tile = z.object({
  resource: z.string().min(1),
  columns: Span,
  rows: Span,
  outlinePhase: z.string().min(1),
}).strict();

const ThisDocument = z.object({
  resource: z.string().min(1),
  style: z.enum(["dashed", "filled"]),
  color: Hex,
  fill: Hex,
  note: z.string().optional(),
}).strict();

export const DiigPhasesFigureSchema = z.object({
  $schema: z.literal("diig-phases-figure/v1"),
  _comment: z.string().optional(),
  figure: FigureRef,
  basis: z.string().optional(),
  legend: z.record(z.string(), z.string()),
  phases: z.array(Phase).min(1),
  resources: z.array(Resource),
  layout: z.object({
    columns: z.number().int().positive(),
    rows: z.number().int().positive(),
    tiles: z.array(Tile),
  }).strict(),
  thisDocument: ThisDocument,
}).strict();

export const DiigPhasesAdaptationSchema = z.object({
  $schema: z.literal("diig-phases-adaptation/v1"),
  _comment: z.string().optional(),
  adapts: z.string().min(1),
  title: z.string().optional(),
  basis: z.string().optional(),
  resources: z.array(Resource).optional(),
  tiles: z.array(Tile).optional(),
  thisDocument: ThisDocument,
}).strict();

const Cell = z.object({
  name: z.string().min(1),
  text: z.string().min(1),
  product: z.string().optional(),
}).strict();

export const SmartGuidelinesApproachFigureSchema = z.object({
  $schema: z.literal("smart-guidelines-approach-figure/v1"),
  _comment: z.string().optional(),
  figure: FigureRef,
  basis: z.string().optional(),
  link: Link.optional(),
  style: z.object({ band: Hex, panel: Hex, card: Hex, ink: Hex, arrow: Hex, loop: Hex }).strict(),
  loop: z.string().min(1),
  bands: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) }).strict()).length(3),
  rows: z.array(z.object({
    id: z.enum(["knowledge", "country"]),
    label: Lines,
    from: z.string().min(1),
    to: z.string().min(1),
    chained: z.boolean(),
  }).strict()).length(2),
  layers: z.array(z.object({
    level: z.number().int().positive(),
    knowledge: Cell,
    country: Cell,
  }).strict()).min(1),
}).strict();

// --- as-drawn-figure/v1 ------------------------------------------------------
//
// A figure's drawing transcribed from the source PDF's vector layer
// (scripts/pdf-as-drawn.py): every path, text run and image inside the L1
// figure region, in paint order, at its printed position, colour and size.
// scripts/as-drawn-svg.ts redraws it as an SVG that keeps the original's
// layout and style, for figures with no model route (figure-rebuild, "as
// drawn"), and as the as-drawn companion of a figure rebuilt as a model view.
// Coordinates are PDF points from the region's top-left corner.

const UpperHex = z.string().regex(/^#[0-9A-F]{6}$/u, "a #RRGGBB colour");
const Num = z.number().finite();
const PathD = z.string().regex(/^M[-0-9MLCZ .e]*$/u, "an SVG path of M, L, C and Z commands");
const ClipRefs = z.array(z.number().int().nonnegative()).min(1);

export const AsDrawnShapeSchema = z.object({
  d: PathD,
  fill: UpperHex.optional(),
  evenodd: z.literal(true).optional(),
  stroke: UpperHex.optional(),
  strokeWidth: Num.nonnegative().optional(),
  dash: z.array(Num.nonnegative()).optional(),
  cap: z.enum(["round", "square"]).optional(),
  join: z.enum(["round", "bevel"]).optional(),
  fillOpacity: Num.min(0).max(1).optional(),
  strokeOpacity: Num.min(0).max(1).optional(),
  /** Indices into `clips`: the shape is drawn inside all of them. */
  clip: ClipRefs.optional(),
}).strict().refine((s) => s.fill || s.stroke, "a shape is filled, stroked or both");

export const AsDrawnTextSchema = z.object({
  /** The baseline origin of the run. */
  x: Num,
  y: Num,
  size: Num.positive(),
  text: z.string().min(1),
  weight: z.number().int().min(100).max(900).optional(),
  italic: z.literal(true).optional(),
  color: UpperHex.optional(),
  /** The printed width, so the run keeps its place in another font. */
  width: Num.positive().optional(),
  /** Degrees clockwise, about the origin. */
  rotate: Num.optional(),
  /** The glossary concept the label names (exact prefLabel or altLabel match). */
  link: z.string().url().optional(),
  clip: ClipRefs.optional(),
}).strict();

export const AsDrawnImageSchema = z.object({
  x: Num, y: Num, width: Num.positive(), height: Num.positive(),
  /** Base64 PNG cropped from a 600 dpi render of the page. */
  png: z.string().min(1),
  clip: ClipRefs.optional(),
}).strict();

export const AsDrawnFigureSchema = z.object({
  $schema: z.literal("as-drawn-figure/v1"),
  figure: z.object({
    library: z.string().min(1),
    labels: z.array(z.string().regex(/^Fig\. \d+$/u)).min(1),
    caption: z.string().min(1).nullable(),
    page: z.number().int().positive(),
    /** The L1 render (PNG), kept as the cited source. */
    file: z.string().min(1),
    render: z.string().min(1),
    /** The L1 section the figure sits in. */
    section: z.object({ id: z.string().min(1), title: z.string().min(1), file: z.string().min(1) }).strict(),
  }).strict(),
  basis: z.string().min(1),
  region: z.tuple([Num, Num, Num, Num]),
  canvas: z.object({ width: Num.positive(), height: Num.positive() }).strict(),
  clips: z.array(z.object({ d: PathD, evenodd: z.literal(true).optional() }).strict()),
  shapes: z.array(AsDrawnShapeSchema),
  texts: z.array(AsDrawnTextSchema),
  images: z.array(AsDrawnImageSchema).optional(),
  /** What the PDF paints that the transcription leaves out, and why. */
  omitted: z.object({ softMasked: z.number().int().positive(), why: z.string().min(1) }).strict().optional(),
}).strict().superRefine((f, ctx) => {
  for (const key of ["shapes", "texts", "images"] as const) {
    (f[key] ?? []).forEach((s, i) => s.clip?.forEach((c) => {
      if (c >= f.clips.length) ctx.addIssue({ code: "custom", path: [key, i, "clip"], message: `no clip ${c}` });
    }));
  }
});

export type AsDrawnFigureData = z.infer<typeof AsDrawnFigureSchema>;

/** The node kinds the writer's node-kinds gate reads for the two library families. */
export const DiigPhasesFigureKind = nodeKind("diig-phases-figure", [], DiigPhasesFigureSchema.shape);
export const SmartApproachFigureKind = nodeKind("smart-guidelines-approach-figure", [], SmartGuidelinesApproachFigureSchema.shape);

export type DiigPhasesFigureData = z.infer<typeof DiigPhasesFigureSchema>;
export type DiigPhasesAdaptationData = z.infer<typeof DiigPhasesAdaptationSchema>;
export type SmartGuidelinesApproachFigureData = z.infer<typeof SmartGuidelinesApproachFigureSchema>;

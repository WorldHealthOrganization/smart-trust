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

/** The node kinds the writer's node-kinds gate reads for the two library families. */
export const DiigPhasesFigureKind = nodeKind("diig-phases-figure", [], DiigPhasesFigureSchema.shape);
export const SmartApproachFigureKind = nodeKind("smart-guidelines-approach-figure", [], SmartGuidelinesApproachFigureSchema.shape);

export type DiigPhasesFigureData = z.infer<typeof DiigPhasesFigureSchema>;
export type DiigPhasesAdaptationData = z.infer<typeof DiigPhasesAdaptationSchema>;
export type SmartGuidelinesApproachFigureData = z.infer<typeof SmartGuidelinesApproachFigureSchema>;

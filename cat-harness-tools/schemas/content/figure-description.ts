/**
 * @graphNode schema
 *
 * What a person or agent SAYS a drawn figure shows — the judgement half of the
 * vector arm.
 *
 * ## A third file
 *
 * Measurement and judgement are kept apart:
 *
 * | | measurement, machine-derived | judgement, someone looked |
 * |---|---|---|
 * | raster | `<entry>/images.json` | `<library>/image-verdicts.json` |
 * | vector | `<entry>/vector-labels.json` | `<library>/figure-descriptions.json` |
 *
 * A narrative in `vector-labels.json` would mix measurement and opinion, and
 * would be overwritten on the next extraction. It is not `images.json` either:
 * a drawn figure places no image object, so there is no entry to hang a
 * narrative on.
 *
 * ## `basis` is required
 *
 * A description from labels alone can name every part correctly and still get
 * the RELATION wrong (labels line up as a table while the drawn arrows cross),
 * and miss glyphs that carry no text. So a labels-only description is safe as
 * an INVENTORY and unsafe as an ACCOUNT, and
 * {@link FigureDescriptionSchema.basis} records which one the reader holds.
 *
 * ## Only a human confirms
 *
 * The state machine is `NarrativeSchema`'s: `confirmed_by.kind` must be
 * `"human"`, and an agent cannot confirm its own draft.
 */
import { z } from "zod";

import { AttributionSchema } from "./attribution.ts";
import { NarrativeSlotSchema, narrativeFor } from "./narrative.ts";

/**
 * How much the describer actually looked at.
 *
 * - `labels-only` — read from `vector-labels.json` and nothing else. Trust the
 *   nouns; distrust every relation, multiplicity and anything drawn without
 *   text. Glyph-only content is invisible at this basis and its absence is
 *   not evidence of absence.
 * - `labels-and-render` — the page was rendered and looked at beside the
 *   labels. Arrows, nesting and glyph columns are in scope.
 *
 * There is no third value and no default. A description whose basis nobody
 * recorded is one a reader cannot weigh, which is the `nso8` failure.
 */
export const DESCRIPTION_BASES = ["labels-only", "labels-and-render"] as const;
export type DescriptionBasis = (typeof DESCRIPTION_BASES)[number];

export const FigureDescriptionSchema = z
  .object({
    /** 1-based, matching `VectorFigurePage.page` so the two join. */
    page: z.number().int().positive(),
    /**
     * The figure as the document names it — `"Figure 2"`, `"Fig. 8.4(a)"`.
     *
     * Optional, because a page may draw a figure the text never labels, and
     * inventing a number to fill the field would assert a citation that does
     * not exist.
     */
    figure: z.string().min(1).optional(),
    basis: z.enum(DESCRIPTION_BASES),
    /** Who looked, and when. */
    described_by: AttributionSchema,
    described_at: z.string().min(1),
    /**
     * The description itself, in the standard narrative state machine.
     *
     * An agent writes `draft`; only a human may move it to `confirmed`.
     */
    narrative: NarrativeSlotSchema,
    /**
     * What the describer could NOT read, in their own words.
     *
     * Required at `labels-only` and optional otherwise — at that basis there
     * is always something, and saying "nothing" is the claim the measurement
     * cannot support. At `labels-and-render` an empty gap list is a real
     * finding rather than an omission.
     */
    unread: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.basis === "labels-only" && !d.unread) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unread"],
        message:
          "a labels-only description must say what it could not read — arrows, nesting and " +
          "glyph-only content are invisible at this basis, and silence about them reads as " +
          "their absence (bean a8wy)",
      });
    }
  });

export const FIGURE_DESCRIPTIONS_SCHEMA_ID = "folio-figure-descriptions/v1";

export const FigureDescriptionsFileSchema = z
  .object({
    $schema: z.literal(FIGURE_DESCRIPTIONS_SCHEMA_ID),
    /** Free prose about this file as a whole, as `image-verdicts.json` carries. */
    _comment: z.string().optional(),
    /** doc-id → the figures described in that document. */
    descriptions: z.record(z.string().min(1), z.array(FigureDescriptionSchema).min(1)),
  })
  .strict()
  .superRefine((f, ctx) => {
    for (const [doc, list] of Object.entries(f.descriptions)) {
      const seen = new Set<string>();
      for (const [i, d] of list.entries()) {
        // One description per (page, figure). A page may draw two figures, so
        // the page alone is not the key — `9789240010567-eng` page 92 is the
        // case that makes this concrete.
        //
        // UNLABELLED figures are keyed differently, and the reason is that
        // `figure` is optional for a real reason. `${page}\0""` made every
        // unlabelled drawing on a page the same object, so a page bearing TWO
        // of them could not be described at all: the second was rejected as a
        // duplicate of the first. That turns an unrepresentable state into a
        // schema error about a file that is correct. A review bot found it on
        // #1633.
        //
        // The discriminator is the narrative text, because it is the only
        // thing that already distinguishes two unlabelled figures without
        // inventing anything. Two different drawings get two different
        // descriptions; a record pasted twice keeps the same text and is
        // still caught. A positional field or a required description id would
        // discriminate more sharply, and both mean every existing record
        // gains a field — that is the owner's call, not this branch's.
        const key =
          d.figure === undefined
            ? `${d.page}\u0000\u0000${narrativeFor(d.narrative).text ?? ""}`
            : `${d.page}\u0000${d.figure}`;
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["descriptions", doc, i],
            message:
              d.figure === undefined
                ? `page ${d.page} carries two unlabelled descriptions with identical narrative text`
                : `page ${d.page} / ${d.figure} described twice`,
          });
        }
        seen.add(key);
      }
    }
  });

export type FigureDescription = z.infer<typeof FigureDescriptionSchema>;
export type FigureDescriptionsFile = z.infer<typeof FigureDescriptionsFileSchema>;

/** The file's name at a library's root, beside `image-verdicts.json`. */
export const FIGURE_DESCRIPTIONS_FILE = "figure-descriptions.json";

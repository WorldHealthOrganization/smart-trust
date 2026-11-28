/**
 * @graphNode schema
 *
 * The positioned TEXT on a page that declares a figure: the labels of a
 * figure that is DRAWN rather than placed.
 *
 * ## Not `images.json`
 *
 * `pdf-images.py` recovers the RASTER layer: image objects the PDF places.
 * Conceptual figures — frameworks, maturity models, process flows — are
 * **drawn** in path operators and text, with no image object. Forcing them
 * into `DocumentImageSchema` would make `role` and `basis` mean two things
 * (no rectangle, no `xref`, no pixel). So this is its own sidecar,
 * `vector-labels.json`, joined to images by page number only.
 *
 * ## What it refuses to do
 *
 * **It does not decide which labels belong to the figure.** Intersection with
 * a drawing is not a reliable test (labels, axis titles and legends often sit
 * in the white space between boxes), so every line on a qualifying page is
 * recorded, and {@link VectorLabelSchema.intersectsDrawing} is stored as a
 * measurement, not used as a filter.
 *
 * **It does not group.** A label is one MuPDF *line*, and nothing above that:
 * MuPDF's blocks merge labels that are far apart. Boxes, layers and arrows are
 * inference. A description from labels alone is safe as an INVENTORY and
 * unsafe as an ACCOUNT.
 *
 * **It does not claim reading order.** {@link VectorFigurePageSchema.labels} is
 * ordered by top edge then left edge: a deterministic, stated convention so a
 * re-run diffs cleanly.
 *
 * **It does not count.** No ratio of labels to declared figures is computed;
 * they are not commensurable.
 *
 * ## Which pages qualify — over-inclusion is chosen
 *
 * A page is recorded when it carries a **line-start `Fig.`/`Fig`/`Figure` + number**
 * that is not a table-of-contents entry, **and has a vector layer at all**.
 * That is looser than `declaredFigureCaptions` (which also requires a period
 * and whitespace): captions such as `Fig. 13<tab>Example` have no period, and
 * a false positive costs a page of prose while a false negative loses a
 * figure's labels.
 *
 * **The table-of-contents guard is structural.** A figure-list entry carries a
 * DOT LEADER — two periods separated by nothing but space. It is NOT "the
 * line ends in a number", which would drop real captions ending in a year.
 *
 * **Known limit:** a figure whose caption sits on the facing page is not
 * recorded at all.
 */
import { z } from "zod";

/** A rectangle in PDF user space: `[x0, y0, x1, y1]`, origin top-left. */
export const BBoxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const VectorLabelSchema = z
  .object({
    /** The line's text: its spans concatenated, since a span break is a style change and not a word break. */
    text: z.string().min(1),
    /**
     * The line's rectangle **in the visible frame** — rotation already applied.
     *
     * See {@link VectorFigurePageSchema.rotation}. `intersectsDrawing` is
     * computed in the unrotated frame where MuPDF reports both layers; this is
     * the frame a reader sees.
     */
    bbox: BBoxSchema,
    /**
     * Whether this block's rectangle intersects any vector drawing's.
     *
     * **A measurement, not a verdict.** See the module docblock: on
     * `9789240010567-eng` page 25 this is `false` for 33 labels of which only
     * three are furniture; the other 30 are plainly part of the figure. Nothing here filters on it, and a consumer
     * that does is asserting a coverage this arm did not establish.
     */
    intersectsDrawing: z.boolean(),
    /** Font names on the line's spans, deduplicated and sorted. */
    fonts: z.array(z.string()).min(1),
    /** Point sizes on the line's spans, deduplicated and sorted ascending. */
    sizes: z.array(z.number()).min(1),
  })
  .strict();

export const VectorFigurePageSchema = z
  .object({
    /** 1-based, matching `DocumentImage`'s `basis.page` so the two join. */
    page: z.number().int().positive(),
    /**
     * The page's rotation in degrees, as the PDF declares it.
     *
     * Recorded because it is the reason {@link VectorLabelSchema.bbox} needed
     * a decision at all: MuPDF reports text and drawings in the UNROTATED page,
     * and every figure page of `9789240010567-eng` is landscape by a 90-degree
     * rotation. A consumer that ignores this and re-derives coordinates from
     * the PDF will disagree with the sidecar by a quarter turn.
     */
    rotation: z.number().int(),
    /** Vector drawing operations MuPDF reports on the page. Reported, never graded. */
    drawings: z.number().int().nonnegative(),
    /**
     * Raster images the page also places.
     *
     * Not an exclusion. `9789240010567-eng` page 92 is the flagship case for
     * `m4xy`: five component logos were extracted by the raster arm and
     * Fig. 5.6.2, the diagram they sit inside, was not. A page can need both
     * arms, so this says which other arm also has something to say.
     */
    rasterImagesOnPage: z.number().int().nonnegative(),
    /**
     * Verbatim line-start `Fig.`/`Figure` matches on the page, table-of-contents
     * entries removed. A lower bound, and it deliberately includes
     * cross-references — plural, and never asserted to be the page's figure.
     */
    captionCandidates: z.array(z.string()).min(1),
    labels: z.array(VectorLabelSchema),
  })
  .strict();

export const VECTOR_LABELS_SCHEMA_ID = "folio-vector-labels/v1";

export const VectorLabelsSidecarSchema = z
  .object({
    $schema: z.literal(VECTOR_LABELS_SCHEMA_ID),
    doc_id: z.string().min(1),
    /**
     * `null` is could-not-determine and is NOT an empty list.
     *
     * An empty list is the determined finding that no page in the document
     * declares a figure over a vector layer. `null` says no
     * page geometry could be read at all — the same third state
     * `ImagesSidecarSchema` keeps, and for the same reason: a consumer that
     * cannot tell "looked, found none" from "could not look" reports a clean
     * run over an unread document (bean `dh4f`).
     */
    pages: z.array(VectorFigurePageSchema).nullable(),
    undetermined_reason: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (s.pages === null && !s.undetermined_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["undetermined_reason"],
        message:
          "pages is null, so a reason is required — an undetermined result with no reason " +
          "cannot be told from a bug, which is the `nso8` failure",
      });
    }
    if (s.pages !== null && s.undetermined_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["undetermined_reason"],
        message: "pages was determined, so undetermined_reason must be absent",
      });
    }
    const seen = new Set<number>();
    for (const [i, p] of (s.pages ?? []).entries()) {
      if (seen.has(p.page)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pages", i, "page"],
          message: `page ${p.page} recorded twice — one entry per page`,
        });
      }
      seen.add(p.page);
    }
  });

export type VectorLabel = z.infer<typeof VectorLabelSchema>;
export type VectorFigurePage = z.infer<typeof VectorFigurePageSchema>;
export type VectorLabelsSidecar = z.infer<typeof VectorLabelsSidecarSchema>;

/** The sidecar's filename inside a `library/<bib-slug>/` entry. */
export const VECTOR_LABELS_FILE = "vector-labels.json";

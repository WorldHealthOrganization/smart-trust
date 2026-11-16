/**
 * @graphNode schema
 *
 * An image placed on a page of an ingested document.
 *
 * ## Every image carries a role and its basis
 *
 * Most placed images in an ingested corpus are page scans — one
 * near-full-bleed image per page, which is the page itself — not figures. So
 * every entry carries a {@link ImageRole}, and the **basis** for it:
 * `coverage` and `imagesOnPage` are the two numbers the verdict was computed
 * from, stored so a reader can check it rather than believe it.
 *
 * ## The third state is `undetermined`, and it is not `scan`
 *
 * A role is only ever `page-scan` or `figure` when the geometry was actually
 * read. A backend that could not place an image yields `undetermined`, never a
 * default — an image wrongly filed as `page-scan` is silently dropped from
 * every description pass.
 */
import { z } from "zod";

import { AttributionSchema } from "./attribution.ts";
import { NarrativeSlotSchema, NOT_AUTHORED, type Narrative } from "./narrative.ts";

/**
 * What an image IS, as distinct from what it depicts.
 *
 * - `page-scan` — the rendered page. Describing it produces "a scanned page".
 * - `figure` — content of the document: a chart, a table, a diagram.
 * - `chrome` — interface furniture placed by the CAPTURE rather than present in
 *   the document: a navigation icon, a copy button, a search glyph, a cookie
 *   control. Not content, and not describable — see {@link CaptureBasisSchema}.
 * - `logo` — an organisational or publisher mark. Furniture, not content.
 * - `decorative` — a photograph or ornament carrying no information the prose
 *   does not. Describable for accessibility, but not a figure of the document.
 * - `undetermined` — nothing could be determined. Never rendered as any other.
 *
 * ## Why `figure` alone was not enough
 *
 * Geometry gives exactly one bit: is this image the whole page, or something
 * on it. Measured 2026-09-20, the 24 images the geometric rule called
 * `figure` across this corpus were:
 *
 * | | |
 * |---|---|
 * | real data figures | **2** |
 * | organisation logos (JSTOR, MSF ×2, FAO ×2, UNDP ×2, ILO, WHO ×4) | **12** |
 * | photographs — 7 of them the same picture at seven sizes | **8** |
 * | unreplaced template text reading "SAMPLE TITLE" | **2** |
 *
 * Describing "every figure" would have produced twelve logo captions and
 * seven descriptions of one picture, against two about the document. No
 * measurement of the placed rectangle can tell a WHO emblem from a chart —
 * only looking can, which is why {@link InspectionBasisSchema} exists.
 */
export const IMAGE_ROLES = [
  "page-scan",
  "figure",
  "chrome",
  "logo",
  "decorative",
  "furniture",
  "undetermined",
] as const;
export type ImageRole = (typeof IMAGE_ROLES)[number];

/**
 * Roles worth a description, and why each.
 *
 * A `logo` earns one because a reader using a screen reader still needs to
 * know whose mark is on the page; it is short and factual, not a narrative.
 * `decorative` earns one for the same reason. `page-scan` earns none — the
 * page's own text is already extracted — and `undetermined` earns none
 * because nothing is known about it yet.
 *
 * `chrome` earns none either, and that is the whole point of the role. A
 * navigation icon the CAPTURE placed is not in the document a reader is
 * reading; describing it produces "a search glyph", 104 times over on a
 * four-page print. This is the one role whose absence here is load-bearing —
 * it is what lets such a document satisfy `image-descriptions`.
 */
export const DESCRIBABLE_ROLES: readonly ImageRole[] = IMAGE_ROLES.filter(
  (r): r is ImageRole => r === "figure" || r === "logo" || r === "decorative",
);

/** Roles only reachable by LOOKING. Geometry cannot produce these. */
export const INSPECTION_ONLY_ROLES: readonly ImageRole[] = ["logo", "decorative"];

/**
 * Fraction of the page a placed image covers, at or above which it is the page
 * rather than a figure on it.
 *
 * 0.80 sits in an empty band: the corpus clusters at 0.998 (scans) and below
 * 0.50 (figures), with nothing between 0.50 and 0.99. Chosen low enough to
 * catch a scan with a margin, high enough that a half-page figure — measured
 * at 0.495 in `9789241548960_eng` — is never swept up.
 */
export const PAGE_COVERAGE_THRESHOLD = 0.8;

/**
 * A role computed from the placed rectangle. Cheap, total, and blind: it
 * separates the page from things on the page and nothing finer.
 */
export const GeometryBasisSchema = z.object({
  method: z.literal("geometry"),
  /** Placed area over page area. The number the role was computed from. */
  coverage: z.number().min(0),
  /** How many images share this page. A scan is alone on its page. */
  imagesOnPage: z.number().int().min(1),
  /** The page it sits on, 1-based as a reader counts. */
  page: z.number().int().min(1),
});

/**
 * A role assigned by SOMEBODY LOOKING at the image.
 *
 * A different kind of claim from geometry, so it is a different shape. The
 * two were one type until 2026-09-20, and merging them would have let
 * "a WHO emblem, because an agent recognised it" be read as "furniture,
 * because it covers 0.4 % of the page" — which the numbers cannot support.
 *
 * Carries `by` for the same reason every other judgement here does: an agent
 * attribution must name its model, so a verdict can be re-examined against
 * the thing that made it.
 */
export const InspectionBasisSchema = z.object({
  method: z.literal("inspection"),
  /** Who looked. An `agent` must name its model — see `attribution.ts`. */
  by: AttributionSchema,
  /** ISO date of the look. A verdict ages; this says how much. */
  at: z.string().min(1),
  /** What was seen, in a few words. NOT the description — the reason. */
  saw: z.string().min(1),
  page: z.number().int().min(1),
});

/**
 * Fraction of the page below which an image in a CAPTURE RUNG is interface
 * furniture rather than content — see {@link CaptureBasisSchema}.
 *
 * 0.02 sits in an empty band, derived the same way {@link
 * PAGE_COVERAGE_THRESHOLD} was rather than picked. Measured 2026-09-21 over
 * all 219 placed images in the six browser prints under `uploads/`: nav
 * chrome tops out at **0.005804** (the single image in `Skills in OpenAI
 * API`), the smallest real figure is **0.139632** (`Equipping agents… —
 * Anthropic`), and the largest ratio gap anywhere in the sorted series is the
 * **24.1×** between exactly those two. Nothing lies between them.
 *
 * Placed at 0.02 rather than at the midpoint, deliberately low: ~3.4× above
 * the largest chrome image and ~7× below the smallest figure. Being wrong
 * HIGH would file a small real figure as `chrome` and drop it silently from
 * every description pass — the expensive direction, and the same one the
 * `page-scan` doc warns about. Being wrong low leaves an icon as a `figure`,
 * which merely blocks promotion the way it does today.
 *
 * A small image CAN be load-bearing — a status glyph in a table, an inline
 * equation. That risk is inherent to any bound, which is why the basis records
 * `coverage` alongside the producer: the verdict is checkable per image rather
 * than merely asserted.
 */
export const CAPTURE_CHROME_THRESHOLD = 0.02;

/**
 * A role computed from the CAPTURE the document came out of, plus geometry.
 *
 * Distinct from {@link GeometryBasisSchema} because it is a different claim.
 * Geometry alone yields one bit — is this image the whole page — and
 * {@link InspectionBasisSchema} exists because "no measurement of the placed
 * rectangle can tell a WHO emblem from a chart". Both remain true. What a
 * capture basis adds is evidence that is NOT a rectangle: a browser printed
 * this page, so the small images on it are the browser's own furniture.
 *
 * ## Why the producer string is evidence rather than a guess
 *
 * Measured 2026-09-21 across all 18 PDFs in this repository, the two fields
 * partition the corpus with no overlap in either direction:
 *
 * | class | producer | creator | n |
 * |---|---|---|---|
 * | browser print | `Skia/PDF m152` | `Mozilla/5.0 (Macintosh…)` | 11 |
 * | arXiv | `pikepdf 8.15.1` | `arXiv GenPDF (tex2pdf…)` | 3 |
 * | other | `(none)` ×2, `Atypon Systems`, `Pixel Translations` | — | 4 |
 *
 * BOTH are required by {@link isCapturePrint}, not either. Skia is Chromium's
 * graphics library and reaches well past printing — Android and Flutter emit
 * it too — so it alone says "a Chromium-family renderer", not "a browser
 * printed a web page". The user-agent in `creator` is what says the second
 * thing. Requiring both also fails SAFE: a capture missing one field is not a
 * rung, so its images stay `figure` and merely keep blocking, which is
 * today's behaviour rather than a silent reclassification.
 */
export const CaptureBasisSchema = z.object({
  method: z.literal("capture"),
  /** The PDF's `Producer`, verbatim. The evidence, not a derived flag. */
  producer: z.string().min(1),
  /** The PDF's `Creator`, verbatim — the browser user-agent for a print. */
  creator: z.string().min(1),
  /** Placed area over page area, as for geometry. */
  coverage: z.number().min(0),
  /** How many images share this page. */
  imagesOnPage: z.number().int().min(1),
  /** The page it sits on, 1-based as a reader counts. */
  page: z.number().int().min(1),
});

/** Roles reachable only from a CAPTURE basis. Geometry alone cannot reach them. */
export const CAPTURE_ONLY_ROLES: readonly ImageRole[] = ["chrome"];

/**
 * Roles a COMPUTABLE basis settles outright, so no inspection is owed.
 *
 * `page-scan` because geometry settles it: a near-full-bleed image alone on
 * its page IS the page, and nobody needs to look. `chrome` for the same shape
 * of reason one level along — the capture's own producer settles that a
 * sub-threshold image on a browser-printed page is the browser's furniture.
 *
 * Named rather than written as a pair of literals at the call site, because
 * the call site is `apply-image-verdicts.ts`, which reports every role NOT on
 * this list as an image nobody has looked at. Adding `chrome` to the enum
 * without adding it here would have reported 104 navigation icons as awaiting
 * inspection — the gate this change exists to clear, re-appearing one tool
 * downstream.
 *
 * `undetermined` is deliberately NOT here: nothing is known about it, which
 * is the opposite of settled.
 */
export const SETTLED_BY_COMPUTATION: readonly ImageRole[] = ["page-scan", "chrome", "furniture"];

/**
 * Is this document a captured web page?
 *
 * One definition, so the extractor and every consumer cannot disagree about
 * what a rung is. Both signals required — see {@link CaptureBasisSchema}.
 */
export function isCapturePrint(producer: string | undefined, creator: string | undefined): boolean {
  return (producer ?? "").includes("Skia/PDF") && (creator ?? "").startsWith("Mozilla/");
}

/**
 * A role decided by a coverage CUTOFF THE CALLER SUPPLIED — bean `ay3x`.
 *
 * Owner, 2026-10-03, verbatim: *"an optional one can be set, default none"*
 * (`library-ingestion` §"A role threshold is OPTIONAL, and its default is
 * NONE"). So a cutoff may sort images into roles, but ONLY when somebody
 * passes one, and every image it decides must say so: the value, and that it
 * came from the caller rather than from anybody looking.
 *
 * **There is no default and no recommended value, and none may be added
 * here.** `m4xy` and `j820` measured why (29 documents, 5 libraries):
 * per-image coverage does not separate figure from furniture, and the one
 * empty stretch in the WHO corpus is specific to it — 29 images in other
 * libraries sit inside it. A number chosen after seeing a corpus is a number
 * chosen to fit the answer.
 *
 * A different shape from {@link InspectionBasisSchema} on purpose, and it
 * reaches a different role (`furniture`), so a thresholded call can never be
 * read as an inspected one — the `d5f1` rule.
 */
export const ThresholdBasisSchema = z.object({
  method: z.literal("threshold"),
  /** The cutoff, exactly as supplied. Images below it were filed `furniture`. */
  value: z.number().positive(),
  /** Always the caller. Recorded so the provenance is read, not inferred. */
  suppliedBy: z.literal("caller"),
  /** Placed area over page area — the number compared against `value`. */
  coverage: z.number().min(0),
  imagesOnPage: z.number().int().min(1),
  page: z.number().int().min(1),
});
export type ThresholdBasis = z.infer<typeof ThresholdBasisSchema>;

/** Roles reachable only from a caller-supplied {@link ThresholdBasisSchema}. */
export const THRESHOLD_ONLY_ROLES: readonly ImageRole[] = ["furniture"];

export const ImageBasisSchema = z.discriminatedUnion("method", [
  GeometryBasisSchema,
  InspectionBasisSchema,
  CaptureBasisSchema,
  ThresholdBasisSchema,
]);
export type ImageBasis = z.infer<typeof ImageBasisSchema>;
export type GeometryBasis = z.infer<typeof GeometryBasisSchema>;
export type CaptureBasis = z.infer<typeof CaptureBasisSchema>;

/**
 * ONE PLACEMENT of an image on a page.
 *
 * ## Why this exists — bean `j820`, issue #1234
 *
 * `pdf-images.py` emitted one entry per PLACEMENT, so an image used many times
 * became many images. Measured 2026-09-24 across every `images.json` in the
 * tree: **383 placements of `arxiv-2510.21603v1` are 50 distinct images**, and
 * page 3's 335 are 22, each placed about fifteen times. `9789241509510-eng`
 * is 161 → 102, `9789241511766-eng` 99 → 44, `arxiv-2312.07755v1` 84 → 28.
 *
 * That was diagnosed first as a composite figure shattered into fragments, and
 * that reading was WRONG — the pieces are whole clip-art icons, placed
 * repeatedly. The correction is on `doc-researcher.md`, kept rather than
 * deleted, because it was a description asserted from file sizes instead of
 * from looking.
 *
 * ## The narrative splits in two, and the corpus said so before this did
 *
 * Collapsing duplicates looked destructive until the narratives were read. Of
 * 49 duplicate groups, 5 carried differing text — and every one differs the
 * same way. `9789240010567-eng` has seven byte-identical copies of the
 * Principles for Digital Development logo whose descriptions open with the
 * SAME clause verbatim and then each name the principle on their own page:
 *
 * > *"…used as a recurring header graphic for principle 8, 'Build for
 * > sustainability'."* / *"…for the principle 'Reuse and improve'."*
 *
 * So a description does two jobs: **what the image IS**, which is one fact and
 * belongs on the image, and **what THIS copy serves**, which is per placement
 * and is genuinely lost if the copies are merged. Hence {@link note}.
 *
 * It is also a QUALITY CHECK nothing else performs. `9789240081949-eng` has
 * five byte-identical QR codes described as if each encoded a different
 * category — one image, five incompatible claims. Byte-identical images with
 * materially different descriptions is a findable error class, and dedup is
 * what finds it.
 *
 * @graphNode schema
 */
export const PlacementSchema = z.object({
  /** The page it sits on, 1-based as a reader counts. */
  page: z.number().int().min(1),
  /** Placed area over page area, AT THIS PLACEMENT. Sizes may differ per use. */
  coverage: z.number().min(0),
  /** How many images share this page. */
  imagesOnPage: z.number().int().min(1),
  /**
   * What this copy serves HERE — never what the image is, which is the
   * narrative's job. "a recurring header for principle 8" belongs here;
   * "an irregular grid of coloured squares" belongs on the image.
   *
   * Optional, and absent is the normal case: most images are placed once, and
   * a second placement of a logo usually serves nothing worth saying.
   */
  note: z.string().min(1).optional(),
});
export type Placement = z.infer<typeof PlacementSchema>;

export const DocumentImageSchema = z
  .object({
    /** Stable within the document: `img-p007-1`. */
    id: z.string().min(1),
    /** Path to the extracted file, relative to the library entry. */
    file: z.string().min(1),
    role: z.enum(IMAGE_ROLES),
    /** Why `role` says what it says. Absent only when nothing could be read. */
    basis: ImageBasisSchema.optional(),
    /** Present only where a description is worth having — see `role`. */
    narrative: NarrativeSlotSchema.optional(),
    /**
     * Every place this image appears, the first one included.
     *
     * Absent on a singly-placed image, so the overwhelming majority of entries
     * are unchanged and every existing reader of `basis.page` keeps working —
     * see {@link PlacementSchema} for why it exists at all.
     */
    placements: z.array(PlacementSchema).min(1).optional(),
    /**
     * The SAME PICTURE is already held elsewhere in the repository, and `file`
     * points there instead of at a copy (bean `scfh`, `scripts/image-reuse.py`).
     *
     * A perceptual match, not a byte match: the #1614 deck's two largest
     * pictures are the landing-page theme art re-encoded as WebP, so no byte
     * agrees. The distance is recorded because the threshold is a claim about a
     * corpus, and a reader should be able to re-judge it.
     */
    same_as: z
      .object({
        /** Repository-relative path of the asset `file` now points at. */
        path: z.string().min(1),
        method: z.literal("dhash-256"),
        distance: z.number().int().min(0),
        bits: z.number().int().positive(),
      })
      .strict()
      .optional(),
  })
  // `basis` DESCRIBES THE FIRST PLACEMENT, and the two must not drift. Without
  // this, a migration could collapse duplicates while leaving `basis` pointing
  // at a page no longer listed, and every consumer reading `basis.page` would
  // silently disagree with every consumer reading `placements`.
  .refine(
    (i) =>
      i.placements === undefined ||
      // LENGTH FIRST. `.min(1)` and this refinement run in the same pass, so
      // an empty array reaches here and `placements[0]!.page` throws before
      // `.min(1)` can reject it -- a schema that crashes instead of returning
      // a refusal. Caught by the test asserting an empty array is refused,
      // which is the one assertion in that file that looked redundant.
      i.placements.length === 0 ||
      i.basis === undefined ||
      !("page" in i.basis) ||
      i.placements[0]!.page === i.basis.page,
    {
      message:
        "`placements[0]` must be the placement `basis` describes — two " +
        "spellings of where an image first appears is one fact in two places",
      path: ["placements", 0, "page"],
    },
  )
  // A role that was DECIDED must show its working; `undetermined` has none to
  // show. Without this a caller cannot tell a measured verdict from a default.
  .refine((i) => (i.role === "undetermined") === (i.basis === undefined), {
    message:
      "a decided role must carry its basis, and `undetermined` must not — " +
      "a verdict with no working is indistinguishable from a guess",
    path: ["basis"],
  })
  // `chrome` is unreachable from a rectangle ALONE, and claiming it from one
  // would be the same error the refinement below exists to stop. What makes it
  // reachable is evidence that is not a rectangle — the producer and creator
  // of the capture — so it requires the basis that carries them.
  .refine((i) => !requiresCapture(i.role) || i.basis?.method === "capture", {
    message:
      "`chrome` can only be assigned from a capture basis — it is a claim " +
      "about where the image CAME FROM, and no measurement of a placed " +
      "rectangle establishes that a browser printed the page",
    path: ["basis", "method"],
  })
  // `furniture` is the CALLER's cutoff speaking, and only that basis may say
  // it; equally, a threshold basis decides nothing but `furniture` — an image
  // above the cutoff keeps the geometry verdict it would have had anyway.
  .refine((i) => (i.role === "furniture") === (i.basis?.method === "threshold"), {
    message:
      "`furniture` is assigned only by a caller-supplied threshold, and a threshold basis " +
      "assigns only `furniture` — a cutoff's call must never read as anything else (bean ay3x)",
    path: ["basis", "method"],
  })
  // `logo` and `decorative` are unreachable from a rectangle. Claiming one on
  // a geometry basis would dress a judgement up as a measurement.
  .refine((i) => !requiresInspection(i.role) || i.basis?.method === "inspection", {
    message:
      "`logo` and `decorative` can only be assigned by looking — a geometry " +
      "basis cannot support either, since no measurement of a placed " +
      "rectangle distinguishes a WHO emblem from a chart",
    path: ["basis", "method"],
  })
  // The whole point of the measurement: no narrative slot on the 140 scans.
  .refine((i) => i.narrative === undefined || DESCRIBABLE_ROLES.includes(i.role), {
    message:
      "only a figure carries a narrative — a description of a page scan says " +
      "\"a scanned page\", 140 times over on this corpus",
    path: ["narrative"],
  });
export type DocumentImage = z.infer<typeof DocumentImageSchema>;

/** The sidecar `scripts/pdf-images.py` writes, one per library entry. */
export const ImagesSidecarSchema = z.object({
  $schema: z.literal("folio-document-images/v1"),
  doc_id: z.string().min(1),
  /**
   * Absent when the backend could not run. Distinct from `[]`, which is the
   * determined finding that this document places no images at all.
   */
  images: z.array(DocumentImageSchema).nullable(),
  /** Required whenever `images` is null: say why, never imply absence. */
  undetermined_reason: z.string().min(1).optional(),
})
  .refine((s) => (s.images === null) === (s.undetermined_reason !== undefined), {
    message:
      "`images: null` means COULD NOT DETERMINE and must say why; an empty " +
      "array is the determined finding that there are none",
    path: ["undetermined_reason"],
  });
export type ImagesSidecar = z.infer<typeof ImagesSidecarSchema>;

/**
 * The role implied by a COMPUTABLE basis. One definition, so the extractor and
 * every consumer cannot disagree about where the lines are.
 *
 * Takes geometry or capture — the two bases that carry the numbers the verdict
 * is computed from — and NOT {@link InspectionBasisSchema}. An inspection
 * basis carries a role the inspector ASSIGNED by looking, and there is nothing
 * here to recompute it from: `logo` and `decorative` are unreachable from a
 * rectangle. Accepting that one and quietly returning `figure` would silently
 * overwrite a judgement with a measurement that cannot support it.
 *
 * A capture basis is admitted for the opposite reason. It carries `coverage`
 * and `imagesOnPage` exactly as geometry does, plus the `producer` and
 * `creator` that say which rung the document is in, so the verdict is fully
 * recomputable from what is stored. Nothing is assigned by hand.
 *
 * ## The order of the tests, which is not arbitrary
 *
 * `page-scan` is tried FIRST, in both rungs. A browser print can still place a
 * full-bleed image alone on a page, and that image is the page — the capture
 * being a web page does not change what full-bleed means. Only then does the
 * chrome bound apply, and only inside a capture rung.
 */
export function roleFor(basis: GeometryBasis | CaptureBasis | undefined): ImageRole {
  if (basis === undefined) return "undetermined";
  if (basis.coverage >= PAGE_COVERAGE_THRESHOLD && basis.imagesOnPage === 1) {
    return "page-scan";
  }
  if (basis.method === "capture" && basis.coverage < CAPTURE_CHROME_THRESHOLD) {
    return "chrome";
  }
  return "figure";
}

/** True when this role could only have come from somebody looking. */
export function requiresInspection(role: ImageRole): boolean {
  return INSPECTION_ONLY_ROLES.includes(role);
}

/** True when this role could only have come from the capture's own provenance. */
export function requiresCapture(role: ImageRole): boolean {
  return CAPTURE_ONLY_ROLES.includes(role);
}

/** A fresh entry for a figure: describable, and not yet described. */
export function withEmptyNarrative(image: DocumentImage): DocumentImage {
  return DESCRIBABLE_ROLES.includes(image.role)
    ? { ...image, narrative: image.narrative ?? (NOT_AUTHORED as Narrative) }
    : image;
}

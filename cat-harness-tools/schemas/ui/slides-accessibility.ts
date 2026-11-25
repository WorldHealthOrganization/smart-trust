/**
 * `accessibility.json`: a slide deck's accessibility report, written by
 * `scripts/slides-structure.py` beside its `structure.json`.
 *
 * Per check, never an overall score: one number would weigh a missing slide
 * title against a missing alt text, and nothing supports that weighting. The
 * three checks the package cannot answer carry `state: "undetermined"` with a
 * reason, so a report cannot read as clean over what nobody measured.
 *
 * @module schemas/slides-accessibility
 * @graphNode schema
 */
import { z } from "zod";

export const SLIDES_ACCESSIBILITY_SCHEMA_ID = "folio-slides-accessibility/v1" as const;

const Undetermined = z.object({ state: z.literal("undetermined"), why: z.string().min(1) }).passthrough();
const AltVerdict = z.enum(["missing", "auto-generated", "filename"]);

export const SlidesAccessibilitySchema = z
  .object({
    $schema: z.literal(SLIDES_ACCESSIBILITY_SCHEMA_ID),
    source: z.object({ file: z.string().min(1), sha256: z.string().regex(/^[0-9a-f]{64}$/), mimetype_sniffed: z.string().nullable() }).strict(),
    format: z.enum(["pptx", "odp"]),
    slides: z.number().int().min(0),
    checks: z
      .object({
        "slide-titles": z.object({ criterion: z.string(), pass: z.number().int().min(0), fail: z.number().int().min(0), failing_slides: z.array(z.number().int().min(1)) }).strict(),
        "alt-text": z
          .object({
            criterion: z.string(),
            pictures: z.number().int().min(0),
            ok: z.number().int().min(0),
            decorative: z.number().int().min(0),
            missing: z.number().int().min(0),
            "auto-generated": z.number().int().min(0),
            filename: z.number().int().min(0),
            failing: z.array(z.object({ slide: z.number().int().min(1), media: z.string(), verdict: AltVerdict, alt: z.string().nullable() }).strict()),
          })
          .strict(),
        language: z.object({ criterion: z.string(), languages: z.array(z.string()), scope: z.enum(["per-run", "default-style", "none"]), pass: z.boolean() }).strict(),
        "document-title": z.object({ criterion: z.string(), title: z.string().nullable(), pass: z.boolean() }).strict(),
        "speaker-notes": z.object({ criterion: z.string(), slides_with_notes: z.array(z.number().int().min(1)) }).strict(),
        "hidden-slides": z.object({ slides: z.array(z.number().int().min(1)) }).strict(),
        "reading-order": Undetermined,
        "images-of-text": Undetermined,
        contrast: Undetermined,
      })
      .strict(),
  })
  .strict();
export type SlidesAccessibility = z.infer<typeof SlidesAccessibilitySchema>;

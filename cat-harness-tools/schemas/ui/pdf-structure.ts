/**
 * `structure.json`: the structure of an ingested PDF, tagged `_schema: pdf-structure/v1`.
 *
 * Two rungs write this file:
 *
 * - `scripts/pdf-structure.py` writes the whole artefact: `source`, `metadata`,
 *   `toc`, `toc_source`, `sections` and `diagnostics`.
 * - `scripts/pdf-pages.py`, the no-outline rung, MERGES into whatever is there.
 *   It sets `granularity: "page"`, `source.text_source` and a `structure_note`,
 *   rewrites `sections` at page granularity, and adds the rest of `source` only
 *   when it is absent (`setdefault`).
 *
 * So the fields a page-granularity entry carries depend on whether
 * `pdf-structure` ran on it first. That is why `metadata`, `toc` and
 * `diagnostics` are optional here while `sections` and `source` are not.
 *
 * ## One section shape, strictly
 *
 * `pdf-pages.py` writes exactly the section shape `pdf-structure.py` writes,
 * because `gen-library-jsonld.ts` reads `sec.id`, `page_start` and
 * `page_end`. {@link PdfSectionSchema} is therefore `.strict()`.
 *
 * ## The text origin: one field, one vocabulary
 *
 * Where the section text came from is `source.text_source`: `"embedded"` (the
 * PDF's own text layer) or `"ocr"`. A top-level `text_source` is rejected
 * (the object is `.strict()`).
 *
 * @module schemas/pdf-structure
 * @graphNode schema
 */
import { z } from "zod";

import { RunContextRefSchema } from "../sdlc/run-context";

export const PDF_STRUCTURE_SCHEMA_ID = "pdf-structure/v1" as const;

/**
 * Slide decks that `scripts/slides-structure.py` writes in THIS shape — bean
 * `scfh`, issue #1614. A slide is a determined division exactly as a page is,
 * so a deck is one section per slide with `page_start == page_end == <slide>`
 * and `granularity: "slide"`, and every reader of `library/` reads it unchanged.
 */
export const SLIDE_MIMETYPES = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.presentation",
] as const;

/**
 * `toc_source`, FOUR states and not three (bean `6xaz`). `none` is a DETERMINED
 * "no discoverable table of contents"; `undetermined` is "one was inferred and
 * could not be trusted". `outline-unusable` is `pdf-pages.py`'s: the PDF has an
 * outline that this rung could not use.
 */
export const TOC_SOURCES = ["outline", "inferred", "undetermined", "none", "outline-unusable"] as const;

/**
 * One entry of the table of contents, as `pdf-structure.py`'s `TocEntry`.
 *
 * `page` is `null` when an OUTLINE entry has no destination. Measured: the first
 * entry of the IRIS replica's `library/9789241548960-eng`, the document's own title node.
 * The outline says the entry exists and says nothing about where it is, and a
 * page number would be a guess.
 */
export const PdfTocEntrySchema = z
  .object({
    level: z.number().int().min(1),
    title: z.string(),
    page: z.number().int().min(1).nullable(),
    source: z.enum(["outline", "inferred"]),
    number: z.string().nullable(),
    /**
     * Inferred entries only (issue #2302): how sure the inference is, 0..1,
     * and which independent evidence agreed — a printed contents page, the
     * entry found in the body, a heading style, a section number, another
     * extractor. Null on an outline entry, which is not scored.
     */
    confidence: z.number().min(0).max(1).nullable().optional(),
    evidence: z.array(z.string()).nullable().optional(),
    /** The printed label of `page` ("iv", "23"), where known; `page` is physical. */
    page_label: z.string().nullable().optional(),
  })
  .strict();

/** One section. The single shape every consumer of `library/` reads. */
export const PdfSectionSchema = z
  .object({
    id: z.string().min(1),
    number: z.string().nullable(),
    title: z.string(),
    level: z.number().int().min(1),
    page_start: z.number().int().min(1),
    page_end: z.number().int().min(1),
    n_chars: z.number().int().min(0),
    n_words: z.number().int().min(0),
    /** Printed labels of page_start / page_end, where known (issue #2302). */
    label_start: z.string().nullable().optional(),
    label_end: z.string().nullable().optional(),
  })
  .strict()
  .refine((s) => s.page_end >= s.page_start, { message: "page_end is before page_start" });

const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);

/**
 * The file the artefact was built from. `file`, `sha256`, `bytes`, `mtime` and
 * the SNIFFED mimetype are `_tech_meta.py`'s vocabulary (bean `nso8`). The
 * mimetype is `null` with `mimetype_source: "unrecognised"` when the leading
 * bytes are not recognised, and never guessed from the extension; the schema
 * holds the two fields to that (`unreadable` is null too). `pages` and
 * `extractor` are written by `pdf-structure.py` only; `text_source` by both rungs.
 */
export const PdfSourceSchema = z
  .object({
    file: z.string().min(1),
    sha256: Sha256,
    bytes: z.number().int().min(0),
    mtime: z.string().nullable(),
    mimetype_sniffed: z.string().nullable(),
    // `zip-package`: `_tech_meta.sniff_effective_mimetype`'s answer for an OOXML
    // or ODF package, which DECLARES its type inside the zip. Only a deck
    // reaches this schema with it (bean `scfh`); the PDF rungs never do.
    mimetype_source: z.enum(["magic-bytes", "zip-package", "unrecognised", "unreadable"]),
    pages: z.number().int().min(0).optional(),
    text_source: z.enum(["embedded", "ocr"]).optional(),
    extractor: z.enum(["pymupdf", "pypdf"]).optional(),
    /**
     * Where the entry's MATHEMATICS comes from, written by
     * `latex-math-overlay.py`: `latex` when at least one section's text was
     * replaced by the paper's own LaTeX, `text-layer` when the overlay ran and
     * none passed its gates. Absent when the overlay never ran.
     */
    math_source: z.enum(["latex", "text-layer"]).optional(),
    /**
     * WHICH SOFTWARE produced the text, cited by digest: the
     * `folio-run-context/v1` of the run that wrote it (`schemas/sdlc/run-context.ts`),
     * reused rather than restated — the one optional `runContext: { sha256 }`
     * reference that `docs/proposals/tool-releases-2026-10-07.md` gives every
     * run and report record (owner, C1 = a).
     *
     * Written when `text_source` is `ocr`: it is the context `pdf-ocr.py` wrote
     * to `<entry>/ocr/run-context.json` (the OCR engine, its version, the bytes
     * of the binary and of its language data). Without it, two OCRs of one PDF
     * that read "Manual" and "Manval" cannot be told apart or reproduced.
     * Absent on entries ingested before it existed, and on an embedded text
     * layer.
     */
    runContext: RunContextRefSchema.optional(),
    /**
     * Pages whose embedded text layer failed `scripts/_text_quality.py` and
     * were read from the OCR cache instead, each with the reason (owner,
     * 2026-11-11, who-iris card Q-ODD-1 = A: "force OCR when a page's text
     * layer fails a quality check"). The rest of the document keeps its
     * embedded text, so `text_source` stays `embedded`. Absent when no page
     * was replaced.
     */
    ocr_pages: z
      .array(z.object({ page: z.number().int().min(1), reason: z.string().min(1) }).strict())
      .optional(),
    /**
     * The document's languages as the ingest was told them (`--lang-hint`,
     * ISO 639-1). A reader asks this, not the entry's slug: 10665/202203 is
     * Russian and its slug has no language suffix, because an item's first
     * edition keeps the bare slug (owner, 2026-11-11, card Q-ODD-1 = A).
     * Absent when the ingest was given none.
     */
    languages: z.array(z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{1,8})*$/)).min(1).optional(),
  })
  .strict()
  // The two fields are one fact: `_tech_meta.sniff_effective_mimetype` returns
  // a mimetype exactly when it recognised the bytes (`magic-bytes`) or the
  // package declared one (`zip-package`), and `null` otherwise. A record
  // pairing a mimetype with `unrecognised`, or `null` with `magic-bytes`,
  // claims two different things about one sniff.
  .refine((s) => (s.mimetype_sniffed === null) === (s.mimetype_source === "unrecognised" || s.mimetype_source === "unreadable"), {
    message: "mimetype_sniffed is null exactly when mimetype_source is `unrecognised` or `unreadable`",
    path: ["mimetype_sniffed"],
  });

/**
 * Front matter parsed from the first pages, plus the PDF's own docinfo. Its keys
 * follow what `parse_front_matter` found, so unknown keys pass through. `title`
 * is the one every consumer relies on.
 */
export const PdfMetadataSchema = z
  .object({
    title: z.string().nullable(),
    docinfo: z.record(z.string(), z.unknown()),
    /**
     * Where `title` came from (bean `w6fu`, `scripts/_pdf_title.py`):
     * the PDF's `Title` metadata, its first-page heading or its outline when
     * another source CORROBORATES it, else the text walk's title (`text`) or
     * nothing (`filename`, and the manifest falls back to the entry id).
     */
    title_source: z.enum(["metadata", "heading", "outline", "text", "filename"]).optional(),
    /** False when no source corroborated the title: the raw title was kept, not guessed at. */
    title_verified: z.boolean().optional(),
    /** The text walk's title before resolution, kept so a re-run resolves from it rather than from its own answer. */
    title_raw: z.string().nullable().optional(),
    /** Every candidate the resolver saw, and which sources agreed — the record an editor decides from. */
    title_evidence: z.record(z.string(), z.unknown()).optional(),
    /**
     * An EDITORIAL correction, outranking every extracted title (bean `w6fu`,
     * step b). Authored, never produced by a rung, and carried over by a
     * re-ingest. `basis` says what the title was read from, so it can be
     * checked rather than trusted.
     */
    title_correction: z
      .object({
        title: z.string().min(1),
        basis: z.string().min(1),
        corrected_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        bean: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .passthrough();

/**
 * One caption in the list of figures and tables (issue #2302). `evidence`
 * names what agreed beyond the caption line itself: `referenced` (cited in the
 * text), `in-sequence` (its number fits its run), `graphic` (an image or
 * drawing on its page; figures only), `listed` (a printed list names it).
 */
export const PdfFigureEntrySchema = z
  .object({
    kind: z.enum(["figure", "table", "box", "chart", "algorithm", "listing"]),
    number: z.string(),
    title: z.string(),
    page: z.number().int().min(1),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string()),
    page_label: z.string().nullable().optional(),
  })
  .strict();

/**
 * One physical page and the label a reader sees on it (issue #2302).
 * `source` is where the label was taken from — the PDF's /PageLabels, the
 * number printed in its header or footer, a run's interpolation, a contents
 * page — and `evidence` every source that agreed. `label` is null when no
 * source gives one.
 */
export const PdfPageLabelSchema = z
  .object({
    physical: z.number().int().min(1),
    label: z.string().nullable(),
    source: z.enum(["pdf-labels", "printed", "interpolated", "contents"]).nullable(),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string()),
  })
  .strict();

const PdfAlignmentListSchema = z
  .object({ count: z.number().int().min(0), items: z.array(z.string()) })
  .strict();

export const PdfDiagnosticsSchema = z
  .object({
    pages_without_text: z.number().int().min(0),
    likely_scanned: z.boolean(),
    toc_entries: z.number().int().min(0),
    toc_inferred_entries: z.number().int().min(0).optional(),
    /**
     * Mean confidence of the inferred entries, the input to the second trust
     * test (issue #2302): below 0.6 the inference is not used and the entry is
     * split one section per page. Reported whether or not it passed.
     */
    toc_inferred_mean_confidence: z.number().min(0).max(1).optional(),
    /**
     * Share of the sections an inferred TOC would cut that hold under 50
     * characters, front matter excluded — the third trust test (issue #2302):
     * above 25% (from 5 sections up) the tree is refused as headings without
     * bodies. Reported whether or not it passed.
     */
    toc_inferred_empty_share: z.number().min(0).max(1).optional(),
    /**
     * Which inference produced an inferred TOC (issue #2302): a printed
     * contents page, heading styles read from font metrics, the
     * text-pattern heuristic that OCR'd text falls back to, or `latex`: the
     * `\section` commands of the paper's own LaTeX source, each placed on its
     * PDF page (cat-harness-tools `_latex_headings.py`).
     */
    toc_inferred_method: z.enum(["latex", "contents", "font", "regex"]).optional(),
    /**
     * What `latex-math-overlay.py` did: the main `.tex` file it read, how many
     * sections it found there and how many PDF sections took their text from
     * it, the three gates it applied, and a per-section record of each match.
     */
    latex_overlay: z
      .object({
        _schema: z.string(),
        main: z.string().nullable(),
        tex_sections: z.number().int().min(0),
        overlaid: z.number().int().min(0),
        thresholds: z.record(z.string(), z.number()),
        sections: z.array(z.record(z.string(), z.unknown())),
      })
      .strict()
      .optional(),
    figure_entries: z.number().int().min(0).optional(),
    /** Numbers missing from a caption run, e.g. "table 2.1" beside a Table 2.2. */
    figure_sequence_gaps: z.array(z.string()).optional(),
    /** Pages where label sources disagree, e.g. /PageLabels "3" against a printed "iii". */
    page_label_conflicts: PdfAlignmentListSchema.optional(),
    /**
     * Where a printed contents page and the body disagree (issue #2302) —
     * drafts drift. Present only when the document has a contents page.
     * Each list is capped; `count` is the full number.
     */
    toc_alignment: z
      .object({
        listed_not_found: PdfAlignmentListSchema,
        found_not_listed: PdfAlignmentListSchema,
        page_mismatch: PdfAlignmentListSchema,
      })
      .strict()
      .optional(),
    sections: z.number().int().min(0),
    chars_total: z.number().int().min(0),
    /** Running heads, footers, folios and side tabs `strip_furniture` took out before the split. */
    furniture_lines_stripped: z.number().int().min(0).optional(),
    /**
     * Runs of GRADE quality-of-evidence marks drawn as vector rings and
     * written into the text as ⊕/⊖ (`add_grade_marks`, issue #1925). Absent
     * when none was.
     */
    grade_marks_written: z.number().int().min(1).optional(),
    /** The flat outline ran against its own pages and `repair_outline` put it in page order. Absent when not. */
    outline_reordered: z.literal(true).optional(),
    /**
     * The PDF carried an outline and it was not used, with why: its entries
     * are machine bookmark names (`_GoBack`, `_Hlk62546849`, `_TOC_250000`,
     * "Blank Page", a merged file's name), or too few of them name a heading
     * the pages print (a Russian edition carrying its English outline). The
     * contents were then inferred, as for a PDF with no outline. Absent when
     * the outline was used or there was none.
     */
    outline_rejected: z.string().min(1).optional(),
    /**
     * Sections too long to be one block (more than half of a document of 20
     * pages or more, or over 20,000 words) and how each was cut: at the
     * headings inferred inside it, else where the chapter in its running heads
     * changes, else one section per page. Absent when no section was cut.
     */
    oversized_split: z
      .array(
        z
          .object({
            title: z.string(),
            page_start: z.number().int().min(1),
            page_end: z.number().int().min(1),
            words: z.number().int().min(0),
            by: z.enum(["headings", "running heads", "pages"]),
            into: z.number().int().min(1),
          })
          .strict(),
      )
      .optional(),
    /**
     * Inferred headings that did not read as headings: a title cut to its last
     * line, rejoined with the lines above it up to its number (`as`), or a body
     * word, a reference's first author or a diagram's labels, dropped. Absent
     * when none was.
     */
    headings_tidied: z
      .array(
        z
          .object({
            title: z.string(),
            page: z.number().int().min(1).nullable(),
            action: z.enum(["rejoined", "dropped"]),
            as: z.string().optional(),
            why: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
    /**
     * Pages whose text stream drew the outline's first heading after the
     * page's body, re-read in print order (1-based). Absent when none was.
     */
    pages_read_in_print_order: z.array(z.number().int().min(1)).optional(),
  })
  .strict();

export const PdfStructureSchema = z
  .object({
    _schema: z.literal(PDF_STRUCTURE_SCHEMA_ID),
    doc_id: z.string().min(1),
    source: PdfSourceSchema,
    metadata: PdfMetadataSchema.optional(),
    toc: z.array(PdfTocEntrySchema).optional(),
    toc_source: z.enum(TOC_SOURCES),
    /** Why an inferred TOC was not trusted, in a sentence a person can check. */
    toc_undetermined_reason: z.string().nullable().optional(),
    /** The list of figures and tables, cross-checked (issue #2302). */
    figures: z.array(PdfFigureEntrySchema).optional(),
    /** Every physical page with its printed label (issue #2302). */
    pages: z.array(PdfPageLabelSchema).optional(),
    sections: z.array(PdfSectionSchema),
    diagnostics: PdfDiagnosticsSchema.optional(),
    /**
     * `page`: written by `pdf-pages.py`, one section per page. `slide`: written
     * by `slides-structure.py`, one section per slide (bean `scfh`).
     */
    granularity: z.enum(["page", "slide"]).optional(),
    /** What a rung did NOT claim. Required by check-l1-complete when there are no sections. */
    structure_note: z.string().optional(),
    /**
     * The library holds some works more than once (a preprint beside its
     * published version, one PDF under two names). The duplicate copy names
     * the entry to prefer in `duplicate_of` and says why in `duplicate_note`;
     * the preferred entry lists its copies in `duplicate_copies`. Adjudicated
     * in qou `docs/audits/library-duplicate-ledger.json`.
     */
    duplicate_of: z.string().min(1).optional(),
    duplicate_note: z.string().optional(),
    duplicate_copies: z.array(z.string().min(1)).optional(),
    /**
     * A bound volume split into its papers by qou's `split-bound-volume.py`:
     * the volume keeps `container: true`, names the per-paper entries in
     * `container_children` and says why in `container_note`. Ranking and the
     * library index skip a container, so its pages are not counted twice.
     */
    container: z.boolean().optional(),
    container_children: z.array(z.string().min(1)).optional(),
    container_note: z.string().optional(),
    /** Where the headings came from when a person supplied them, not the producer. */
    toc_note: z.string().optional(),
    /**
     * How the text was obtained when it was done by hand, outside the
     * producer: the route, why, which engine and settings, and how far the
     * result can be trusted. Written for scans OCR'd before `source.runContext`
     * existed; a producer run records `source.runContext` instead.
     */
    text_extraction: z
      .object({
        route: z.enum(["ocr", "embedded"]),
        reason: z.string().optional(),
        engine: z.string().optional(),
        render: z.string().optional(),
        psm: z.number().int().optional(),
        lang: z.string().optional(),
        intermediate_pdf_sha256: Sha256.optional(),
        quality: z.string().optional(),
        metadata_note: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type PdfStructure = z.infer<typeof PdfStructureSchema>;

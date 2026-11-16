/**
 * `structure.json` as a BASE with VARIANTS.
 *
 * @module schemas/document-structure
 * @graphNode schema
 *
 * The base holds the fields every format has (a section's id, number, title,
 * level and sizes; the document's title). `pdf-structure/v1` is unchanged, as
 * one variant.
 *
 * ## A variant adds where a section IS
 *
 * A PDF section is located by pages; a notebook section by cells. They are
 * not the same unit, so {@link structureOf} returns a `locator` that says
 * which it is. A reader that wants pages asks for `kind: "pages"` and gets
 * nothing from a notebook.
 *
 * ## Read it through the accessor
 *
 * {@link structureOf} is the one way to read a `structure.json` whose format
 * is not known in advance; a reader that parses the file itself misreads the
 * next variant. A new format (HTML, DOCX) is a new variant here and no reader
 * changes.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import { PDF_STRUCTURE_SCHEMA_ID, PdfStructureSchema, type PdfStructure } from "../ui/pdf-structure.ts";

export const NOTEBOOK_STRUCTURE_SCHEMA_ID = "notebook-structure/v1" as const;

const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);

/** One section of a notebook: a heading and the cells under it, up to the next heading of its level or above. */
export const NotebookSectionSchema = z
  .object({
    id: z.string().min(1),
    number: z.string().nullable(),
    title: z.string(),
    level: z.number().int().min(1),
    /** Zero-based index of the section's first cell, which is its heading cell. */
    cell_start: z.number().int().min(0),
    /** Zero-based index of its last cell, inclusive. */
    cell_end: z.number().int().min(0),
    /** How many of those cells are code. Kept verbatim in the section text, never executed. */
    code_cells: z.number().int().min(0),
    n_chars: z.number().int().min(0),
    n_words: z.number().int().min(0),
  })
  .strict()
  .refine((s) => s.cell_end >= s.cell_start, { message: "cell_end is before cell_start" });

export const NotebookSourceSchema = z
  .object({
    file: z.string().min(1),
    sha256: Sha256,
    bytes: z.number().int().min(0),
    mtime: z.string().nullable(),
    /**
     * The same two fields every rung writes (bean `nso8`), so the L1 gate's
     * `technical-metadata` requirement reads them as it does for a PDF. A
     * notebook has no magic bytes, so its type is decided by CONTENT, and
     * `mimetype_source` says exactly that rather than claiming a sniff.
     */
    mimetype_sniffed: z.literal("application/x-ipynb+json"),
    mimetype_source: z.literal("content"),
    /** A notebook is JSON; this is what the file declared (`nbformat`), not sniffed bytes. */
    nbformat: z.string().min(1),
    /** The kernel language the notebook declares, or null when it declares none. */
    language: z.string().nullable(),
    cells: z.number().int().min(0),
  })
  .strict();

export const NotebookStructureSchema = z
  .object({
    _schema: z.literal(NOTEBOOK_STRUCTURE_SCHEMA_ID),
    doc_id: z.string().min(1),
    source: NotebookSourceSchema,
    metadata: z.object({ title: z.string().nullable() }).passthrough(),
    /**
     * `headings`: sections come from markdown headings. `none`: the notebook
     * has no markdown heading, so it is one section, and `structure_note` says so.
     */
    toc_source: z.enum(["headings", "none"]),
    sections: z.array(NotebookSectionSchema),
    /** What the rung did NOT claim. Required when `toc_source` is `none`. */
    structure_note: z.string().optional(),
  })
  .strict()
  .refine((s) => s.toc_source !== "none" || (s.structure_note ?? "").trim() !== "", {
    message: "a notebook with no headings must say so in structure_note",
  });

export type NotebookStructure = z.infer<typeof NotebookStructureSchema>;

// ── The text variant — bean `y4uj`, issue #1614 ─────────────────────────────
//
// A source that is TEXT FILES rather than a paged document: a Markdown README,
// a specification kept as `.md`/`.mdx` pages in a git repository, a FHIR
// resource's XML source. None of these has pages or cells, so neither variant
// above can locate a section in it, and printing one to PDF first would make
// the recorded sha256 identify a rendering nobody published.
//
// A section is located by FILE and LINE RANGE. A Markdown file is divided by
// its own ATX headings (outside fenced code), which are its author's
// structure, so nothing is inferred; any other text file is ONE section, kept
// verbatim, because a division nobody wrote would be `6xaz` again.

export const TEXT_STRUCTURE_SCHEMA_ID = "text-structure/v1" as const;

/** One section of a text source: a heading and the lines under it, or a whole file. */
export const TextSectionSchema = z
  .object({
    id: z.string().min(1),
    number: z.string().nullable(),
    title: z.string(),
    level: z.number().int().min(1),
    /** The file the section is in, as recorded in `source.files[].path`. */
    file: z.string().min(1),
    /** One-based first line, inclusive. */
    line_start: z.number().int().min(1),
    /** One-based last line, inclusive. */
    line_end: z.number().int().min(1),
    /** `heading`: divided by the file's own heading. `file`: the whole file, which carries none the rung reads. */
    unit: z.enum(["heading", "file"]),
    n_chars: z.number().int().min(0),
    n_words: z.number().int().min(0),
  })
  .strict()
  .refine((s) => s.line_end >= s.line_start, { message: "line_end is before line_start" });

/** One file of a text source, with its own digest so each can be re-fetched and compared alone. */
export const TextFileSchema = z
  .object({
    path: z.string().min(1),
    sha256: Sha256,
    bytes: z.number().int().min(0),
    /** Line count, or null for a file not read as text (an image the source carries). */
    lines: z.number().int().min(0).nullable(),
    /**
     * How the rung read it, decided by CONTENT: `markdown` when it has an ATX
     * heading outside fenced code and does not open with `<`; `verbatim` for
     * any other text; `image` for a member the caller declared as an image,
     * which is recorded and never sectioned.
     */
    format: z.enum(["markdown", "verbatim", "image"]),
  })
  .strict();

/**
 * Where the files came from, when they came from a repository rather than an
 * upload. `commit` is the exact revision; `published` says in words whether
 * that revision is the publisher's released text or a working copy, because a
 * repository's default branch is often neither.
 */
export const TextUpstreamSchema = z
  .object({
    repository: z.string().url(),
    commit: z.string().regex(/^[0-9a-f]{40}$/),
    /** The ref the commit was taken from (a branch or tag name). */
    ref: z.string().min(1),
    /** Commit time, ISO 8601, as git reports it. */
    committed: z.string().min(1),
    /** Path of the files within the repository. */
    path: z.string().min(1),
    published: z.string().min(1),
    /** When it was retrieved, ISO date. */
    retrieved: z.string().min(1),
  })
  .strict();

export const TextSourceSchema = z
  .object({
    /** A display name for the whole source: the file's name, or the bundle's. */
    file: z.string().min(1),
    /**
     * With one file, that file's sha256. With several, the sha256 of their
     * `sha256sum`-format listing (`<hex>  <path>\n`, in `files` order), which
     * anyone can recompute from a checkout with `sha256sum` alone.
     */
    sha256: Sha256,
    digest: z.enum(["file", "listing"]),
    /** Total bytes over every file. */
    bytes: z.number().int().min(0),
    /**
     * The source's own time. For a repository checkout a file's mtime is the
     * checkout's, which says nothing, so this is the commit time instead.
     */
    mtime: z.string().nullable(),
    /** Text has no magic bytes; what it is was decided by reading it. */
    mimetype_sniffed: z.literal("text/plain"),
    mimetype_source: z.literal("content"),
    files: z.array(TextFileSchema).min(1),
    upstream: TextUpstreamSchema.nullable(),
  })
  .strict();

export const TextStructureSchema = z
  .object({
    _schema: z.literal(TEXT_STRUCTURE_SCHEMA_ID),
    doc_id: z.string().min(1),
    source: TextSourceSchema,
    metadata: z.object({ title: z.string().nullable() }).passthrough(),
    /** `headings`: at least one file was divided by its own headings. `files`: none was, so each file is one section. */
    toc_source: z.enum(["headings", "files"]),
    sections: z.array(TextSectionSchema),
    /** What the rung did NOT claim. Always required: a text source always omits something (rendering, shortcodes, images). */
    structure_note: z.string().min(1),
  })
  .strict();

export type TextStructure = z.infer<typeof TextStructureSchema>;

/** Every variant `structure.json` may be. Discriminated by its `_schema` tag. */
export const DocumentStructureSchema = z.union([PdfStructureSchema, NotebookStructureSchema, TextStructureSchema]);
export type DocumentStructure = PdfStructure | NotebookStructure | TextStructure;

/** The `_schema` tags a `structure.json` may carry. */
export const DOCUMENT_STRUCTURE_SCHEMA_IDS = [PDF_STRUCTURE_SCHEMA_ID, NOTEBOOK_STRUCTURE_SCHEMA_ID, TEXT_STRUCTURE_SCHEMA_ID] as const;

/** Where a section is, in the unit its format has. */
export type SectionLocator =
  | { kind: "pages"; start: number; end: number }
  | { kind: "cells"; start: number; end: number }
  | { kind: "lines"; file: string; start: number; end: number };

/** The fields every variant's sections share, plus where the section is. */
export interface BaseSection {
  id: string;
  number: string | null;
  title: string;
  level: number;
  n_chars: number;
  n_words: number;
  locator: SectionLocator;
}

/** A `structure.json` of any variant, read as the base. */
export interface BaseStructure {
  variant: "pdf" | "notebook" | "text";
  doc_id: string;
  title: string | null;
  sections: BaseSection[];
  /** The parsed variant, for the few readers that need its own fields. */
  raw: DocumentStructure;
}

/**
 * Read a parsed `structure.json` of either variant as the base.
 *
 * A reason rather than a throw when it is neither, because the readers here
 * report "could not read" as its own state. An unrecognised `_schema` is
 * named in the reason: a new format arriving is a finding, never a silent
 * empty section list.
 */
export function structureOf(json: unknown): BaseStructure | { reason: string } {
  const tag = typeof json === "object" && json !== null ? (json as { _schema?: unknown })._schema : undefined;
  if (tag === PDF_STRUCTURE_SCHEMA_ID) {
    const p = PdfStructureSchema.safeParse(json);
    if (!p.success) return { reason: `does not conform to ${PDF_STRUCTURE_SCHEMA_ID}: ${p.error.issues[0]?.message ?? "invalid"}` };
    return {
      variant: "pdf",
      doc_id: p.data.doc_id,
      title: p.data.metadata?.title ?? null,
      sections: p.data.sections.map((s) => ({
        id: s.id,
        number: s.number,
        title: s.title,
        level: s.level,
        n_chars: s.n_chars,
        n_words: s.n_words,
        locator: { kind: "pages", start: s.page_start, end: s.page_end },
      })),
      raw: p.data,
    };
  }
  if (tag === NOTEBOOK_STRUCTURE_SCHEMA_ID) {
    const n = NotebookStructureSchema.safeParse(json);
    if (!n.success) return { reason: `does not conform to ${NOTEBOOK_STRUCTURE_SCHEMA_ID}: ${n.error.issues[0]?.message ?? "invalid"}` };
    return {
      variant: "notebook",
      doc_id: n.data.doc_id,
      title: n.data.metadata.title,
      sections: n.data.sections.map((s) => ({
        id: s.id,
        number: s.number,
        title: s.title,
        level: s.level,
        n_chars: s.n_chars,
        n_words: s.n_words,
        locator: { kind: "cells", start: s.cell_start, end: s.cell_end },
      })),
      raw: n.data,
    };
  }
  if (tag === TEXT_STRUCTURE_SCHEMA_ID) {
    const t = TextStructureSchema.safeParse(json);
    if (!t.success) return { reason: `does not conform to ${TEXT_STRUCTURE_SCHEMA_ID}: ${t.error.issues[0]?.message ?? "invalid"}` };
    return {
      variant: "text",
      doc_id: t.data.doc_id,
      title: t.data.metadata.title,
      sections: t.data.sections.map((s) => ({
        id: s.id,
        number: s.number,
        title: s.title,
        level: s.level,
        n_chars: s.n_chars,
        n_words: s.n_words,
        locator: { kind: "lines", file: s.file, start: s.line_start, end: s.line_end },
      })),
      raw: t.data,
    };
  }
  return {
    reason:
      tag === undefined
        ? "carries no `_schema` tag, so its format cannot be known"
        : `carries \`_schema: ${JSON.stringify(tag)}\`, which is none of ${DOCUMENT_STRUCTURE_SCHEMA_IDS.join(", ")}`,
  };
}

/** The page range of a section, or undefined when its format has no pages. */
export function pagesOf(s: BaseSection): { start: number; end: number } | undefined {
  return s.locator.kind === "pages" ? { start: s.locator.start, end: s.locator.end } : undefined;
}

/** The one filename a library entry's structure lives under. */
export const STRUCTURE_FILENAME = "structure.json";

/**
 * Read a library entry's `structure.json` through {@link structureOf}.
 *
 * `{ reason }` for every way it can fail — absent, unparseable, a variant
 * nobody declared — so a reader keeps "could not read" as its own state and
 * never renders it as an entry with no sections.
 */
export function readStructure(entryDir: string): BaseStructure | { reason: string } {
  const p = join(entryDir, STRUCTURE_FILENAME);
  if (!existsSync(p)) return { reason: `no ${STRUCTURE_FILENAME} in ${entryDir}` };
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(p, "utf-8"));
  } catch (e) {
    return { reason: `${p} will not parse: ${e instanceof Error ? e.message : String(e)}` };
  }
  return structureOf(json);
}

/**
 * The notebook rung — a Jupyter `.ipynb` into a library entry's
 * `structure.json` (`notebook-structure/v1`) and `sections/*.md`.
 *
 * @module scripts/notebook-structure
 * @covers none — a WRITER an ingest step calls, not an audit.
 *
 * A notebook is a variant of the shared document-structure base
 * (`schemas/content/document-structure.ts`), not a notebook rendered to PDF:
 *
 * - **A section is a heading and the cells under it**, up to the next cell
 *   that opens with a heading. A notebook's markdown headings are its author's
 *   own structure, so nothing is inferred. Cells before the first heading form
 *   a `preamble` section when they hold anything.
 * - **Code cells are kept as code**, fenced with the notebook's declared
 *   language, and counted per section. They are never executed.
 * - **Outputs are not kept** (they are run products, possibly large or
 *   binary); `structure_note` records the omission.
 * - **A notebook with no heading is one section**, and `structure_note` says
 *   that no structure was found; the schema refuses the pair otherwise.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/notebook-structure.ts -o <library-dir> <file.ipynb> [--doc-id <id>]
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { libraryEntryDir } from "./lib/library-entry-graphs.ts";

import { NOTEBOOK_STRUCTURE_SCHEMA_ID, NotebookStructureSchema, STRUCTURE_FILENAME, type NotebookStructure } from "../schemas/content/document-structure.ts";

interface Cell {
  cell_type: "markdown" | "code" | "raw" | string;
  source: string | string[];
  outputs?: Array<{ data?: Record<string, unknown> }>;
  attachments?: Record<string, unknown>;
}

interface Notebook {
  nbformat: number;
  nbformat_minor?: number;
  metadata?: { title?: string; kernelspec?: { language?: string }; language_info?: { name?: string } };
  cells: Cell[];
}

/** A cell's text, whichever of the two spellings nbformat allows. */
export function cellText(c: Cell): string {
  return Array.isArray(c.source) ? c.source.join("") : c.source;
}

/** The heading a markdown cell OPENS with, if it opens with one. */
export function openingHeading(c: Cell): { level: number; title: string } | undefined {
  if (c.cell_type !== "markdown") return undefined;
  const first = cellText(c).split("\n").find((l) => l.trim() !== "");
  const m = first?.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
  return m ? { level: m[1]!.length, title: m[2]!.trim() } : undefined;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "section";
}

const words = (s: string): number => s.split(/\s+/).filter(Boolean).length;

export interface RungOutput {
  structure: NotebookStructure;
  /** The entry's `images.json` (`folio-document-images/v1`), in one of its two honest states. */
  images: { $schema: "folio-document-images/v1"; doc_id: string; images: [] | null; undetermined_reason?: string };
  /** Section id → the markdown file body, front matter included. */
  sections: Map<string, string>;
}

/**
 * Build the entry from a parsed notebook. Pure, so the tests need no files.
 * `file` and `bytes`/`sha256` describe the source as it was read.
 */
export function buildEntry(
  nb: Notebook,
  source: { file: string; sha256: string; bytes: number; mtime: string | null },
  docId: string,
): RungOutput {
  const language = nb.metadata?.kernelspec?.language ?? nb.metadata?.language_info?.name ?? null;
  const cells = nb.cells ?? [];

  // Where each section starts: every cell that opens with a heading, plus a
  // preamble when the first heading is not the first cell and anything precedes it.
  const starts: Array<{ at: number; level: number; title: string }> = [];
  cells.forEach((c, i) => {
    const h = openingHeading(c);
    if (h) starts.push({ at: i, ...h });
  });
  const hasHeadings = starts.length > 0;
  const firstAt = hasHeadings ? starts[0]!.at : cells.length;
  const preambleHasText = cells.slice(0, firstAt).some((c) => cellText(c).trim() !== "");
  if (!hasHeadings) starts.push({ at: 0, level: 1, title: nb.metadata?.title ?? basename(source.file, ".ipynb") });
  else if (preambleHasText) starts.unshift({ at: 0, level: 1, title: "Preamble" });

  const title =
    nb.metadata?.title ?? starts.find((s) => s.level === 1 && s.title !== "Preamble")?.title ?? basename(source.file, ".ipynb");

  const used = new Set<string>();
  const sections: NotebookStructure["sections"] = [];
  const files = new Map<string, string>();
  starts.forEach((s, k) => {
    const end = (starts[k + 1]?.at ?? cells.length) - 1;
    const span = cells.slice(s.at, end + 1);
    let id = `s${String(k + 1).padStart(3, "0")}-${slug(s.title)}`;
    while (used.has(id)) id += "-x";
    used.add(id);
    const body = span
      .map((c) => {
        const t = cellText(c).replace(/\s+$/, "");
        if (c.cell_type === "code") return "```" + (language ?? "") + "\n" + t + "\n```";
        return t;
      })
      .filter((t) => t.trim() !== "")
      .join("\n\n");
    sections.push({
      id,
      number: null,
      title: s.title,
      level: s.level,
      cell_start: s.at,
      cell_end: Math.max(s.at, end),
      code_cells: span.filter((c) => c.cell_type === "code").length,
      n_chars: body.length,
      n_words: words(body),
    });
    const fm = [
      "---",
      `doc_id: ${docId}`,
      `doc_title: ${JSON.stringify(title)}`,
      `section_id: ${id}`,
      `section_title: ${JSON.stringify(s.title)}`,
      `cells: ${s.at}-${Math.max(s.at, end)}`,
      `source_notebook: ${source.file}`,
      `source_sha256: ${source.sha256.slice(0, 16)}`,
      "granularity: heading",
      "---",
    ].join("\n");
    files.set(id, `${fm}\n${body}\n`);
  });

  const notes = ["Code cells are kept verbatim as fenced code and never executed; cell OUTPUTS are not kept (they are what a run produced, not what the author wrote)."];
  if (!hasHeadings) notes.unshift("The notebook has no markdown heading, so it is ingested as one section; no structure was inferred.");

  const structure = NotebookStructureSchema.parse({
    _schema: NOTEBOOK_STRUCTURE_SCHEMA_ID,
    doc_id: docId,
    source: {
      ...source,
      mimetype_sniffed: "application/x-ipynb+json",
      mimetype_source: "content",
      nbformat: `${nb.nbformat}.${nb.nbformat_minor ?? 0}`,
      language,
      cells: cells.length,
    },
    metadata: { title },
    toc_source: hasHeadings ? "headings" : "none",
    sections,
    structure_note: notes.join(" "),
  });
  return { structure, sections: files, images: imagesOf(cells, docId) };
}

/**
 * The images sidecar, in the state the notebook actually supports. This rung
 * keeps no outputs and extracts no images, so a notebook that CARRIES images
 * (an image output, a markdown image, an attachment) gets `images: null` with
 * the count and the reason: could not determine, never "none". Only a notebook
 * that carries none gets the determined empty list.
 */
export function imagesOf(cells: Cell[], docId: string): RungOutput["images"] {
  const outputs = cells.reduce(
    (n, c) => n + (c.outputs ?? []).filter((o) => Object.keys(o.data ?? {}).some((k) => k.startsWith("image/"))).length,
    0,
  );
  const inline = cells
    .filter((c) => c.cell_type === "markdown")
    .reduce((n, c) => n + (cellText(c).match(/!\[[^\]]*\]\(|<img\s/g) ?? []).length, 0);
  const attached = cells.reduce((n, c) => n + Object.keys(c.attachments ?? {}).length, 0);
  const total = outputs + inline + attached;
  if (total === 0) return { $schema: "folio-document-images/v1", doc_id: docId, images: [] };
  return {
    $schema: "folio-document-images/v1",
    doc_id: docId,
    images: null,
    undetermined_reason:
      `the notebook carries ${outputs} image output(s), ${inline} markdown image(s) and ${attached} attachment(s); ` +
      "the notebook rung keeps no outputs and extracts no images, so which are figures is not established",
  };
}

/** Read a notebook file, build its entry, and write it under `<lib>/<docId>/`. */
export function runRung(file: string, lib: string, docId?: string): string {
  const raw = readFileSync(file);
  const nb = JSON.parse(raw.toString("utf-8")) as Notebook;
  if (typeof nb.nbformat !== "number" || !Array.isArray(nb.cells)) {
    throw new Error(`${file} is JSON but not a notebook: no numeric nbformat and cells array`);
  }
  const id = docId ?? slug(basename(file, ".ipynb"));
  const out = buildEntry(
    nb,
    {
      file: basename(file),
      sha256: createHash("sha256").update(raw).digest("hex"),
      bytes: raw.length,
      mtime: statSync(file).mtime.toISOString().replace(/\.\d{3}Z$/, "Z"),
    },
    id,
  );
  // Re-ingest writes over the entry where it is filed (`library/<group>/<slug>/`,
  // bean `6fez`); a new entry lands unfiled at `library/<slug>/`.
  const dir = libraryEntryDir(lib, id) ?? join(lib, id);
  mkdirSync(join(dir, "sections"), { recursive: true });
  writeFileSync(join(dir, STRUCTURE_FILENAME), JSON.stringify(out.structure, null, 2) + "\n");
  for (const [sid, body] of out.sections) writeFileSync(join(dir, "sections", `${sid}.md`), body);
  writeFileSync(join(dir, "images.json"), JSON.stringify(out.images, null, 2) + "\n");
  return dir;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const o = argv.indexOf("-o");
  const d = argv.indexOf("--doc-id");
  const lib = o >= 0 ? argv[o + 1] : undefined;
  const file = argv.find((a, i) => a.endsWith(".ipynb") && i !== o + 1 && i !== d + 1);
  if (!lib || !file) {
    console.error("usage: notebook-structure.ts -o <library-dir> <file.ipynb> [--doc-id <id>]");
    process.exit(2);
  }
  const dir = runRung(file, lib, d >= 0 ? argv[d + 1] : undefined);
  console.log(`notebook-structure: wrote ${dir}`);
}

/**
 * pdf-structure/v1 (issue #1112): every committed `structure.json` conforms, and
 * the drifts the schema exists to catch are rejected.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Glob } from "bun";

import { PdfStructureSchema } from "./pdf-structure.ts";

const REPO = resolve(import.meta.dir, "../../..");
const COMMITTED = [...new Glob("*/library/*/structure.json").scanSync({ cwd: REPO, onlyFiles: true })]
  .filter((p) => !p.includes("node_modules") && !p.includes("ingest-staging"))
  .sort();

/** The smallest artefact pdf-structure.py can write: one section, no TOC. */
function minimal(): Record<string, unknown> {
  return {
    _schema: "pdf-structure/v1",
    doc_id: "doc",
    source: {
      file: "doc.pdf",
      sha256: "0".repeat(64),
      bytes: 10,
      mtime: "2026-09-23T00:00:00Z",
      mimetype_sniffed: "application/pdf",
      mimetype_source: "magic-bytes",
    },
    toc_source: "none",
    sections: [{ id: "s1", number: null, title: "One", level: 1, page_start: 1, page_end: 2, n_chars: 5, n_words: 1 }],
  };
}

describe("pdf-structure/v1", () => {
  test("there are committed structure.json files to check", () => {
    // Vacuity guard: a glob that matched nothing would make the next test pass.
    expect(COMMITTED.length).toBeGreaterThan(0);
  });

  test("every committed PDF structure.json conforms", () => {
    // Since bean rkqp a structure.json may be the NOTEBOOK variant, and since
    // bean y4uj the TEXT variant; this
    // schema's promise is about the PDF ones, selected by their own tag.
    // document-structure.test.ts holds every file to SOME declared variant.
    const pdfs = COMMITTED.filter(
      (rel) =>
        !["notebook-structure/v1", "text-structure/v1"].includes(
          (JSON.parse(readFileSync(resolve(REPO, rel), "utf-8")) as { _schema?: string })._schema ?? "",
        ),
    );
    expect(pdfs.length).toBeGreaterThan(10);
    const bad = pdfs.flatMap((rel) => {
      const r = PdfStructureSchema.safeParse(JSON.parse(readFileSync(resolve(REPO, rel), "utf-8")));
      return r.success ? [] : [`${rel}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`];
    });
    expect(bad).toEqual([]);
  });

  test("the minimal artefact conforms", () => {
    expect(PdfStructureSchema.safeParse(minimal()).success).toBe(true);
  });

  test("a second spelling of a section field is rejected (the section_id crash)", () => {
    const d = minimal();
    const [s] = d.sections as Record<string, unknown>[];
    d.sections = [{ ...s, section_id: s.id }];
    expect(PdfStructureSchema.safeParse(d).success).toBe(false);
  });

  test("the diagnostics pdf-structure.py writes are accepted: furniture_lines_stripped, outline_reordered", () => {
    // pdf-structure.py wrote both before the schema named them, so every fresh
    // ingest failed in l1-blocks.ts (found 2026-11-01 on an L1 ingest).
    const d = minimal();
    d.diagnostics = { pages_without_text: 0, likely_scanned: false, toc_entries: 0, sections: 1, chars_total: 5, furniture_lines_stripped: 12, outline_reordered: true, grade_marks_written: 14 };
    const r = PdfStructureSchema.safeParse(d);
    expect(r.success ? "" : r.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")).toBe("");
    d.diagnostics = { ...(d.diagnostics as Record<string, unknown>), outline_reordered: false };
    expect(PdfStructureSchema.safeParse(d).success).toBe(false);
  });

  test("an unknown top-level key is rejected", () => {
    expect(PdfStructureSchema.safeParse({ ...minimal(), sections_text: "withheld" }).success).toBe(false);
  });

  test("a section ending before it starts is rejected", () => {
    const d = minimal();
    const [s] = d.sections as Record<string, unknown>[];
    d.sections = [{ ...s, page_start: 3, page_end: 2 }];
    expect(PdfStructureSchema.safeParse(d).success).toBe(false);
  });

  test("an unknown toc_source is rejected; the four states and outline-unusable are accepted", () => {
    expect(PdfStructureSchema.safeParse({ ...minimal(), toc_source: "guessed" }).success).toBe(false);
    for (const t of ["outline", "inferred", "undetermined", "none", "outline-unusable"])
      expect(PdfStructureSchema.safeParse({ ...minimal(), toc_source: t }).success).toBe(true);
  });

  test("the text origin has one field and one vocabulary (issue #1121)", () => {
    const d = minimal();
    for (const v of ["embedded", "ocr"])
      expect(PdfStructureSchema.safeParse({ ...d, source: { ...(d.source as object), text_source: v } }).success).toBe(true);
    // The retired spellings: pdf-pages.py's old value, and its old top-level field.
    expect(PdfStructureSchema.safeParse({ ...d, source: { ...(d.source as object), text_source: "text-layer" } }).success).toBe(false);
    expect(PdfStructureSchema.safeParse({ ...d, text_source: "ocr" }).success).toBe(false);
  });

  test("which software made the text is a run-context reference by sha256, nothing else", () => {
    const d = minimal();
    const src = (extra: object) => ({ ...d, source: { ...(d.source as object), text_source: "ocr", ...extra } });
    expect(PdfStructureSchema.safeParse(src({ runContext: { sha256: "a".repeat(64) } })).success).toBe(true);
    // Not a second spelling of the engine: the context holds that, once.
    expect(PdfStructureSchema.safeParse(src({ runContext: { sha256: "a".repeat(64), engine: "tesseract" } })).success).toBe(false);
    expect(PdfStructureSchema.safeParse(src({ runContext: { sha256: "not-a-digest" } })).success).toBe(false);
    expect(PdfStructureSchema.safeParse(src({ ocr_engine: "tesseract 5.3.4" })).success).toBe(false);
  });

  test("an unrecognised mimetype is null with its reason, never guessed", () => {
    const d = minimal();
    const src = { ...(d.source as object), mimetype_sniffed: null, mimetype_source: "unrecognised" };
    expect(PdfStructureSchema.safeParse({ ...d, source: src }).success).toBe(true);
    // The reason is required: a null with no source says nothing about why.
    const { mimetype_source: _reason, ...noReason } = src;
    expect(PdfStructureSchema.safeParse({ ...d, source: noReason }).success).toBe(false);
    // A guess is not a reason: no source names the file extension.
    for (const guess of ["extension", "file-extension", "guessed"]) {
      expect(PdfStructureSchema.safeParse({ ...d, source: { ...src, mimetype_source: guess } }).success).toBe(false);
    }
    // The two fields are one fact: null exactly when nothing was recognised.
    const pair = (mimetype_sniffed: string | null, mimetype_source: string) =>
      PdfStructureSchema.safeParse({ ...d, source: { ...src, mimetype_sniffed, mimetype_source } }).success;
    expect(pair(null, "unreadable")).toBe(true);
    expect(pair("application/pdf", "magic-bytes")).toBe(true);
    expect(pair("application/vnd.openxmlformats-officedocument.presentationml.presentation", "zip-package")).toBe(true);
    expect(pair(null, "magic-bytes")).toBe(false);
    expect(pair(null, "zip-package")).toBe(false);
    expect(pair("application/pdf", "unrecognised")).toBe(false);
    expect(pair("application/pdf", "unreadable")).toBe(false);
  });
  test("a duplicate copy names its preferred entry; the preferred entry lists its copies", () => {
    const d = minimal();
    expect(PdfStructureSchema.safeParse({ ...d, duplicate_of: "arxiv-1206.6004v2", duplicate_note: "same work" }).success).toBe(true);
    expect(PdfStructureSchema.safeParse({ ...d, duplicate_copies: ["a", "b"] }).success).toBe(true);
    expect(PdfStructureSchema.safeParse({ ...d, duplicate_of: "" }).success).toBe(false);
    expect(PdfStructureSchema.safeParse({ ...d, duplicate_copies: "a" }).success).toBe(false);
  });
  test("a bound volume, hand-supplied headings and a hand OCR say so in their own fields", () => {
    const d = minimal();
    expect(PdfStructureSchema.safeParse({ ...d, container: true, container_children: ["v-p01"], container_note: "bound issue" }).success).toBe(true);
    expect(PdfStructureSchema.safeParse({ ...d, toc_note: "headings supplied by a reader" }).success).toBe(true);
    const te = { route: "ocr", engine: "tesseract 5.3.4", psm: 4, intermediate_pdf_sha256: "a".repeat(64), quality: "math unreliable" };
    expect(PdfStructureSchema.safeParse({ ...d, text_extraction: te }).success).toBe(true);
    expect(PdfStructureSchema.safeParse({ ...d, text_extraction: { ...te, route: "guess" } }).success).toBe(false);
    expect(PdfStructureSchema.safeParse({ ...d, text_extraction: { ...te, extra: 1 } }).success).toBe(false);
    expect(PdfStructureSchema.safeParse({ ...d, container_children: [""] }).success).toBe(false);
  });
});

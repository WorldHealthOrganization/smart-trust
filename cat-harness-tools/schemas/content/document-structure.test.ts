/**
 * The tests of this file that read the whole checkout (reads the document
 * structures committed in the content layers' libraries) live in
 * `test/document-structure-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";

import { NotebookStructureSchema, pagesOf, structureOf } from "./document-structure.ts";

const notebook = (over: Record<string, unknown> = {}) => ({
  _schema: "notebook-structure/v1",
  doc_id: "nb",
  source: { file: "nb.ipynb", sha256: "a".repeat(64), bytes: 10, mtime: null, mimetype_sniffed: "application/x-ipynb+json", mimetype_source: "content", nbformat: "4.5", language: "python", cells: 4 },
  metadata: { title: "A notebook" },
  toc_source: "headings",
  sections: [
    { id: "s1", number: null, title: "Intro", level: 1, cell_start: 0, cell_end: 1, code_cells: 1, n_chars: 20, n_words: 4 },
    { id: "s2", number: null, title: "Use", level: 2, cell_start: 2, cell_end: 3, code_cells: 0, n_chars: 10, n_words: 2 },
  ],
  ...over,
});

describe("the notebook variant", () => {
  test("reads with cell locators, and pagesOf gives nothing rather than a cell index", () => {
    const s = structureOf(notebook());
    if ("reason" in s) throw new Error(s.reason);
    expect(s.variant).toBe("notebook");
    expect(s.sections[0]!.locator).toEqual({ kind: "cells", start: 0, end: 1 });
    expect(pagesOf(s.sections[0]!)).toBeUndefined();
  });

  test("a notebook with no headings must say so", () => {
    expect(NotebookStructureSchema.safeParse(notebook({ toc_source: "none" })).success).toBe(false);
    expect(NotebookStructureSchema.safeParse(notebook({ toc_source: "none", structure_note: "no markdown heading; one section" })).success).toBe(true);
  });

  test("a section cannot end before it starts", () => {
    const bad = notebook();
    (bad.sections as Array<Record<string, unknown>>)[0]!.cell_end = -1;
    expect("reason" in structureOf(bad)).toBe(true);
    // A non-negative end before its start: refused for the ORDER, not for a
    // negative index — and named as such.
    const backwards = notebook();
    Object.assign((backwards.sections as Array<Record<string, unknown>>)[1]!, { cell_start: 3, cell_end: 2 });
    const r = structureOf(backwards);
    expect("reason" in r && r.reason).toContain("cell_end is before cell_start");
    // The boundary: a one-cell section, ending where it starts, is fine.
    const single = notebook();
    Object.assign((single.sections as Array<Record<string, unknown>>)[1]!, { cell_start: 2, cell_end: 2 });
    expect("reason" in structureOf(single)).toBe(false);
  });
});

describe("anything else is a reason, never an empty section list", () => {
  test("an unknown tag is named", () => {
    const r = structureOf({ _schema: "html-structure/v1", sections: [] });
    expect("reason" in r && r.reason).toContain("html-structure/v1");
  });
  test("no tag at all", () => {
    expect("reason" in structureOf({ sections: [] })).toBe(true);
  });
});

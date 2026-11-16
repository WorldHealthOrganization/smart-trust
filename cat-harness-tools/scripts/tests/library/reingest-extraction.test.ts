/**
 * Re-ingestion so an entry's figures, tables, references and glossary are
 * either extracted or say they were not (owner, 2026-11-14: "has no figures
 * ... needs reingesting"; "not sure all have biblio, glossary, table, figure,
 * keyword, TOC, section, summaries etc fully extracted").
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildDocumentNodes, placedFigures } from "../../../pipeline/gen-library-jsonld.ts";
import { readLibraryGraph } from "../../library-graph.ts";
import { LibraryIndexEntrySchema } from "../../../schemas/ui/site-indexes.ts";
import {
  extractionAdvisories,
  observeExtraction,
  readExtraction,
  recordExtraction,
  runEntryArms,
  stagedRecord,
} from "../../entry-extraction.ts";
import { ENTRY_EXTRACTION_SCHEMA_ID, EntryExtractionKind, ExtractionStepSchema } from "../../../schemas/library/entry-extraction.ts";
import { advisoryLine, checkEntry, sidecarDocument } from "../../check-l1-complete.ts";
import { csvwFromPdfTables, captionLabel, isGrid, isProseCut, runTableArm, toCsv, wordSplitShare } from "../../pdf-tables-csvw.ts";
import { TabularCsvwSchema } from "../../../schemas/library/tabular-csvw.ts";
import { readEntryTables } from "../../lib/library-document.ts";
import { OPTIONAL_PIPELINE_PLUGIN_KINDS, PIPELINE_PLUGIN_KINDS } from "../../../pipeline/pipeline-plugins.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  made.push(d);
  return d;
}
const put = (root: string, rel: string, body: unknown): void => {
  mkdirSync(join(root, rel, ".."), { recursive: true });
  writeFileSync(join(root, rel), typeof body === "string" ? body : JSON.stringify(body));
};

const agent = { kind: "agent", id: "claude-code", model: "not-disclosed" };
const inspected = (page: number) => ({ method: "inspection", by: agent, at: "2026-11-11", saw: "a chart", page });
const vfig = (page: number, role: string, extra: Record<string, unknown> = {}) => ({
  id: `vfig-p${String(page).padStart(3, "0")}`,
  file: `figures/vfig-p${String(page).padStart(3, "0")}.png`,
  role,
  basis: role === "undetermined" ? { method: "assembly", by: { kind: "script", id: "pdf-vector-figures.py" }, page } : inspected(page),
  page,
  ...extra,
});
const narrative = [{ text: "A bar chart of coverage by region.", lang: "en", state: "draft" }];

const structure = {
  doc_id: "d",
  sections: [
    { id: "sec-000-intro", title: "Intro", level: 1, page_start: 1, page_end: 3 },
    { id: "sec-001-body", title: "Body", level: 1, page_start: 3, page_end: 9 },
  ],
};

describe("vector figures become figure blocks", () => {
  const vector = {
    figures: [
      vfig(4, "figure", { narrative }),
      vfig(5, "undetermined"),
      { ...vfig(6, "figure"), file: null, unrendered_reason: "nothing to render" },
    ],
  };
  const images = {
    images: [{ id: "img-p002-1", file: "images/img-p002-1.png", role: "figure", basis: { method: "geometry", coverage: 0.4, imagesOnPage: 1, page: 2 } }],
  };

  test("a kept vector figure gets a block beside the raster ones, with its narrative", () => {
    const out = buildDocumentNodes("d", structure as never, undefined, () => true, images as never, undefined, undefined, undefined, undefined, undefined, undefined, undefined, vector);
    const block = out.find((f) => f.path === "blocks/figure-vfig-p004.jsonld");
    expect(block).toBeDefined();
    const n = JSON.parse(block!.content) as Record<string, unknown>;
    expect(n.kind).toBe("figure");
    expect(n.file).toBe("../figures/vfig-p004.png");
    expect(n.pageStart).toBe(4);
    expect(n.narrative).toEqual(narrative);
    expect(out.some((f) => f.path === "blocks/figure-img-p002-1.jsonld")).toBe(true);
    const body = JSON.parse(out.find((f) => f.path.startsWith("sections/") && f.content.includes("vfig-p004"))!.content) as { contains: string[] };
    expect(body.contains).toContain("library/d/blocks/figure-vfig-p004");
  });

  test("an uninspected or unrendered vector render is not a figure block", () => {
    const out = buildDocumentNodes("d", structure as never, undefined, () => true, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, vector);
    expect(out.some((f) => f.path === "blocks/figure-vfig-p005.jsonld")).toBe(false);
    expect(out.some((f) => f.path === "blocks/figure-vfig-p006.jsonld")).toBe(false);
    expect(placedFigures(images as never, vector).map((f) => f.id)).toEqual(["img-p002-1", "vfig-p004"]);
  });
});

describe("the library index counts figures apart from images", () => {
  test("an entry with one raster image and fifteen vector figures reads images 1, figures 15", () => {
    const root = tmp("figcount-");
    put(root, "fixture.json", {
      $schema: "cat-harness-declaration/1.0.0",
      name: "fixture",
      directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }],
    });
    put(root, "library/e1/manifest.jsonld", { title: "E1", provenance: "ingested", meta: {} });
    put(root, "library/e1/images.json", {
      images: [{ id: "img-p001-1", file: "images/img-p001-1.png", role: "logo", basis: inspected(1) }],
    });
    put(root, "library/e1/vector-figures.json", { figures: Array.from({ length: 15 }, (_, i) => vfig(i + 2, "figure")) });
    const g = readLibraryGraph([root], root);
    const e = g!.entries.find((x) => x.id === "e1")!;
    expect(e.images).toBe(1);
    expect(e.figures).toBe(15);
    expect(LibraryIndexEntrySchema.shape.figures).toBeDefined();
  });
});

describe("the extraction record says which steps ran", () => {
  test("a step is found N, partial, none or not extracted — and says why when it is partial or did not run", () => {
    expect(ExtractionStepSchema.safeParse({ state: "found", count: 3, tool: "t", at: "2026-11-14" }).success).toBe(true);
    expect(ExtractionStepSchema.safeParse({ state: "found", count: 0, tool: "t", at: "2026-11-14" }).success).toBe(false);
    expect(ExtractionStepSchema.safeParse({ state: "none", count: 3, tool: "t", at: "2026-11-14" }).success).toBe(false);
    expect(ExtractionStepSchema.safeParse({ state: "partial", count: 3 }).success).toBe(false);
    expect(ExtractionStepSchema.safeParse({ state: "none" }).success).toBe(true);
    expect(ExtractionStepSchema.safeParse({ state: "not-extracted", tool: "t", at: "2026-11-14" }).success).toBe(false);
    expect(ExtractionStepSchema.safeParse({ state: "undetermined", count: 1, tool: "t", at: "2026-11-14", note: "r" }).success).toBe(false);
  });

  test("an absent artefact observes nothing, and an unnamed kind is not extracted", () => {
    const dir = join(tmp("obs-"), "e1");
    put(dir, "structure.json", { _schema: "pdf-structure/v1", toc: [], toc_source: "undetermined", toc_undetermined_reason: "18 inferred entries with mean confidence 0.50, below the 0.6 floor", sections: [], figures: [] });
    const o = observeExtraction(dir);
    expect(o.contents?.state).toBe("partial");
    expect(o.contents?.note).toContain("0.6 floor");
    expect(o.sections?.state).toBe("none");
    expect(o.tables).toBeUndefined();
    const a = extractionAdvisories(dir);
    expect(a.find((x) => x.kind === "tables")?.state).toBe("not-extracted");
    expect(a.find((x) => x.kind === "glossary")?.state).toBe("not-extracted");
  });

  test("a recorded none is kept apart from never ran — in the shape the viewer reads", () => {
    const dir = join(tmp("rec-"), "e1");
    mkdirSync(dir, { recursive: true });
    recordExtraction(dir, "tables", { state: "none", count: 0, tool: "pdf-tables.py", at: "2026-11-14" });
    const a = extractionAdvisories(dir);
    expect(a.find((x) => x.kind === "tables")?.state).toBe("none");
    expect(a.find((x) => x.kind === "references")?.state).toBe("not-extracted");
    expect(readExtraction(dir)?.kinds.tables?.tool).toBe("pdf-tables.py");
    expect(JSON.parse(readFileSync(join(dir, "extraction.json"), "utf-8")).$schema).toBe("folio-library-extraction/v1");
  });

  test("a staged record takes this run's steps, then the artefacts, then the destination's other kinds", () => {
    const root = tmp("staged-");
    const staging = join(root, "stage", "e1");
    const dest = join(root, "lib", "e1");
    put(staging, "vector-figures.json", { figures: [vfig(3, "figure")] });
    recordExtraction(staging, "tables", { state: "not-extracted", tool: "pdf-tables.py", at: "2026-11-14", note: "no table backend installed" });
    mkdirSync(dest, { recursive: true });
    recordExtraction(dest, "references", { state: "found", count: 12, tool: "references-extract", at: "2026-11-12" });
    recordExtraction(dest, "figures", { state: "none", count: 0, tool: "old", at: "2026-11-01" });
    const k = stagedRecord(staging, dest);
    expect(k.references?.count).toBe(12);
    expect(k.figures?.state).toBe("found");
    expect(k.tables?.note).toBe("no table backend installed");
  });
});

describe("counts that say what the source holds (re-ingest pilot, 2026-11-14)", () => {
  test("footnotes count only the notes a mark calls", () => {
    const dir = join(tmp("fn-"), "e1");
    put(dir, "footnotes.json", { footnotes: [{}], uncalled_notes: [{}, {}, {}], unlinked_marks: [{}] });
    expect(observeExtraction(dir).footnotes).toMatchObject({ state: "found", count: 1 });
    put(dir, "footnotes.json", { footnotes: [], uncalled_notes: [{}, {}], unlinked_marks: [{}] });
    const p = observeExtraction(dir).footnotes!;
    expect([p.state, p.count]).toEqual(["partial", undefined]);
    expect(p.note).toContain("no footnote linked to a mark");
    put(dir, "footnotes.json", { footnotes: [], uncalled_notes: [], unlinked_marks: [] });
    expect(observeExtraction(dir).footnotes).toMatchObject({ state: "none", count: 0 });
  });

  test("a re-run over a promoted entry takes the artefacts over the entry's old record", () => {
    const dir = join(tmp("rerun-"), "lib", "e1");
    put(dir, "vector-figures.json", { figures: [vfig(3, "figure"), vfig(4, "figure")] });
    recordExtraction(dir, "figures", { state: "partial", count: 1, tool: "old", at: "2026-11-01", note: "1 vector render not yet inspected" });
    recordExtraction(dir, "references", { state: "found", count: 12, tool: "references-extract", at: "2026-11-12" });
    const k = stagedRecord(dir, dir);
    expect([k.figures?.state, k.figures?.count]).toEqual(["found", 2]);
    expect(k.references?.count).toBe(12);
  });
});

describe("L1 completeness reports extraction as advice, never as a failure", () => {
  test("a paged entry carries one advisory per kind and the requirements and verdict are unchanged", () => {
    const dir = join(tmp("adv-"), "e1");
    put(dir, "structure.json", { _schema: "pdf-structure/v1", toc: [{ title: "Intro", level: 1, page: 1 }], toc_source: "outline", sections: [], figures: [{ kind: "figure", number: "1", title: "x", page: 2, confidence: 1 }] });
    const r = checkEntry(dir);
    expect(r.advisories?.map((a) => a.kind)).toEqual(["contents", "sections", "figures", "tables", "references", "glossary", "footnotes", "summaries"]);
    expect(advisoryLine(r.advisories!)).toBe("contents 1 · sections none in source · figures not extracted · tables not extracted · references not extracted · glossary not extracted · footnotes not extracted · summaries not extracted");
    expect(JSON.stringify(sidecarDocument(r))).not.toContain("advisories");
    expect(r.requirements.some((q) => q.name.startsWith("extraction"))).toBe(false);
  });

  test("the record is a declared sidecar, not a stray", () => {
    const dir = join(tmp("side-"), "e1");
    put(dir, "structure.json", { _schema: "pdf-structure/v1", sections: [] });
    recordExtraction(dir, "tables", { state: "none", count: 0, tool: "pdf-tables.py", at: "2026-11-14" });
    const contents = checkEntry(dir).requirements.find((q) => q.name === "contents");
    expect(contents?.state).toBe("met");
  });
});

describe("the table arm writes CSVW drafts, guarded", () => {
  const artefact = {
    status: "ok",
    source: { file: "x.pdf", sha256: "a".repeat(64) },
    producer: { backend: "pdfplumber", backend_version: "0.11.10" },
    tables: [
      { id: "tab-p006-001", pages: [6], rows: [["Region", "Coverage, %"], ["AFR", "41"], ["EUR", "93"]], caption: "Table 2. Coverage by region" },
    ],
  };

  test("the drafts are a valid CSVW record that the viewer reads", () => {
    const { record, files } = csvwFromPdfTables("e1", artefact, { file: "x.pdf" }, "2026-11-14", "abc");
    expect(TabularCsvwSchema.safeParse(record).success).toBe(true);
    const dir = join(tmp("csvw-"), "e1");
    for (const f of files) put(dir, f.path, f.content);
    put(dir, "tabular.csvw.json", record);
    const t = readEntryTables(dir);
    expect(t).toHaveLength(1);
    expect(t[0]!.label).toBe("Table 2");
    expect(t[0]!.columns.map((c) => c.titles)).toEqual(["Region", "Coverage, %"]);
    expect(t[0]!.rows).toEqual([["AFR", "41"], ["EUR", "93"]]);
    expect(t[0]!.pages).toEqual([6]);
    expect(toCsv([["a,b", 'say "x"']])).toBe('"a,b","say ""x"""\n');
    expect(captionLabel("Tableau 3.1 : Indicateurs")).toBe("Tableau 3.1");
    // A paragraph read as a one-column grid, or a header with no body, is no table.
    expect(isGrid({ id: "t", pages: [1], rows: [["a paragraph"], ["more"]] })).toBe(false);
    expect(isGrid({ id: "t", pages: [1], rows: [["A", "B"]] })).toBe(false);
  });

  test("prose cut into columns is no table, and is counted apart", () => {
    // Page 26 of 9789240116191-eng as pdfplumber's text strategy cut it, and a real grid (Annex 2's roles).
    const prose = [
      ["ollowi", "n", "g key elements", "t", "o contin", "uously and"],
      ["securely", "m", "anage the", "p", "roduct m", "aster data"],
      ["and ensure", "t", "hat it is", "u", "pdated and", "a"],
    ];
    const grid = [
      ["ROLE CATEGORY", "ROLES", "DEPLOYMENT", "OPERATION"],
      ["Technical", "Solution architect", "Yes", "No"],
      ["Leadership", "Project manager", "Yes", "Yes"],
    ];
    expect(wordSplitShare(prose).share).toBeGreaterThanOrEqual(0.5);
    expect(wordSplitShare(grid)).toEqual({ share: 0, pairs: 9 });
    expect(isProseCut({ id: "p", pages: [26], rows: prose })).toBe(true);
    expect(isProseCut({ id: "g", pages: [57], rows: grid })).toBe(false);
    // Too few boundaries to judge: kept.
    expect(isProseCut({ id: "s", pages: [1], rows: [["Pr", "oduct co"], ["12", "de"]] })).toBe(false);
    const { record } = csvwFromPdfTables("d", { status: "ok", tables: [{ id: "p", pages: [26], rows: prose }, { id: "g", pages: [57], rows: grid }] }, {}, "2026-11-14", undefined);
    expect((record.tables as unknown[]).length).toBe(1);
  });

  test("a failure is recorded as not extracted and the arm does not throw", () => {
    const staging = join(tmp("arm-"), "e1");
    mkdirSync(staging, { recursive: true });
    const out = runTableArm(staging, join(staging, "no-such.pdf"));
    expect(out.state).toBe("not-extracted");
    expect(readExtraction(staging)?.kinds.tables?.state).toBe("not-extracted");
    expect(existsSync(join(staging, "tabular.csvw.json"))).toBe(false);
  });

  test("a transcription the destination holds is kept, never overwritten", () => {
    const root = tmp("keep-");
    const staging = join(root, "stage", "e1");
    mkdirSync(staging, { recursive: true });
    put(root, "lib/e1/tabular.csvw.json", { tables: [{}, {}] });
    const out = runTableArm(staging, join(root, "x.pdf"), join(root, "lib"));
    expect(out.state).toBe("found");
    expect(existsSync(join(staging, "tabular.csvw.json"))).toBe(false);
    expect(readExtraction(staging)?.kinds.tables?.count).toBe(2);
    expect(JSON.parse(readFileSync(join(root, "lib/e1/tabular.csvw.json"), "utf-8")).tables).toHaveLength(2);
  });
});

describe("references and glossary run through an optional pipeline slot", () => {
  const ctx = (entry: string) => ({ instanceRoot: entry, library: entry, entry, slug: "e1" });

  test("the slot is optional, so a full checkout is not required to fill it", () => {
    expect(OPTIONAL_PIPELINE_PLUGIN_KINDS).toContain("library-entry-arms");
    expect(PIPELINE_PLUGIN_KINDS).not.toContain("library-entry-arms");
  });

  test("with no layer filling it, each kind is recorded not extracted — and a reader's earlier record survives", () => {
    const entry = join(tmp("arms-"), "e1");
    mkdirSync(entry, { recursive: true });
    recordExtraction(entry, "references", { state: "found", count: 4, tool: "references-extract", at: "2026-11-12" });
    const ran = runEntryArms(undefined, ctx(entry), "2026-11-14");
    expect(ran.map((r) => r.kind)).toEqual(["glossary"]);
    const k = readExtraction(entry)!.kinds;
    expect(k.references?.count).toBe(4);
    expect(k.glossary?.state).toBe("not-extracted");
    expect(k.glossary?.note).toContain("library-entry-arms");
  });

  test("an arm that throws is recorded not extracted, and the next arm still runs", () => {
    const entry = join(tmp("arms2-"), "e1");
    mkdirSync(entry, { recursive: true });
    const plugin = {
      arms: () => [
        { kind: "references", run: () => { throw new Error("no sections"); } },
        { kind: "glossary", run: () => ({ state: "found" as const, count: 7, tool: "glossary-from-source", at: "2026-11-14" }) },
      ],
    };
    runEntryArms(plugin, ctx(entry), "2026-11-14");
    const k = readExtraction(entry)!.kinds;
    expect(k.references?.state).toBe("not-extracted");
    expect(k.references?.note).toContain("no sections");
    expect(k.glossary?.count).toBe(7);
  });
});

describe("the extraction record is a node kind", () => {
  test("its validator judges a record as the writer's schema does: strict, and each step's rules apply", () => {
    const ok = { $schema: ENTRY_EXTRACTION_SCHEMA_ID, doc_id: "x", kinds: { figures: { state: "found", count: 3 } } };
    expect(EntryExtractionKind.schema.safeParse(ok).success).toBe(true);
    expect(EntryExtractionKind.schema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    expect(EntryExtractionKind.schema.safeParse({ ...ok, kinds: { figures: { state: "found" } } }).success).toBe(false);
  });
});

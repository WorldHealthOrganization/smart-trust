/**
 * The document view of an ingested library entry — issue #2302, bean `turh`.
 *
 * What it holds: the view is read from the ingestion schema (structure.json),
 * a section's summary is matched by its FILE (never by position), an extract
 * is labelled as one and cut at a word, a withheld entry publishes no
 * extract, a field an older ingestion lacks is absent rather than empty, and
 * an entry with no structure.json is null.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DOCUMENT_VIEW_JS, containedRel, entryFigureCopies, entryFigureFiles, extractOf, plainHeading, plainMarkdown, readEntryDocument } from "../../lib/library-document.ts";
import { VIEWER_JS } from "../../gen-library-viz.ts";
import { LibraryDocumentSchema } from "../../../schemas/ui/site-indexes.ts";

function entry(structure: object, extra: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "libdoc-"));
  mkdirSync(join(dir, "sections"));
  writeFileSync(join(dir, "structure.json"), JSON.stringify(structure));
  for (const [p, c] of Object.entries(extra)) writeFileSync(join(dir, p), c);
  return dir;
}

const base = {
  _schema: "pdf-structure/v1",
  doc_id: "r",
  source: { file: "r.pdf", sha256: "0".repeat(64), bytes: 1, mtime: null, mimetype_sniffed: "application/pdf", mimetype_source: "magic-bytes", pages: 4 },
  metadata: { title: "A Report", docinfo: {} },
  toc_source: "inferred",
  diagnostics: {
    pages_without_text: 0, likely_scanned: false, toc_entries: 2, sections: 2, chars_total: 10,
    toc_inferred_method: "font", figure_sequence_gaps: ["table 2"],
  },
  toc: [
    { level: 1, title: "Introduction", page: 2, number: "1", source: "inferred", confidence: 0.9, evidence: ["style", "number"], page_label: "1" },
    { level: 1, title: "Methods", page: 3, number: "2", source: "inferred", confidence: 0.55, evidence: ["style"], page_label: "2" },
  ],
  sections: [
    { id: "sec-000-1-introduction", number: "1", title: "Introduction", level: 1, page_start: 2, page_end: 2, n_chars: 15, n_words: 3, label_start: "1", label_end: "1" },
    { id: "sec-001-2-methods", number: "2", title: "Methods", level: 1, page_start: 3, page_end: 4, n_chars: 1000, n_words: 200 },
  ],
  pages: [{ physical: 1, label: null, source: null, confidence: 0, evidence: [] }, { physical: 2, label: "1", source: "printed", confidence: 0.85, evidence: ["printed", "pdf-labels"] }],
  figures: [{ kind: "table", number: "1", title: "Scores", page: 3, confidence: 0.8, evidence: ["referenced"], page_label: "2" }],
};

describe("readEntryDocument", () => {
  test("reads the schema; TOC entries link to their sections; summary by file, else extract", () => {
    const long = "word ".repeat(200);
    const dir = entry(base, {
      "sections/sec-000-1-introduction.md": "---\nsection_id: x\n---\nShort intro text.",
      "sections/sec-001-2-methods.md": `---\nsection_id: y\n---\n${long}`,
      "summaries.json": JSON.stringify({ summaries: [{ source: "sections/sec-001-2-methods.md", narrative: { text: "What the methods are.", status: "draft" } }] }),
    });
    const d = readEntryDocument(dir, "r")!;
    expect(d.toc.map((e) => e.section)).toEqual(["sec-000-1-introduction", "sec-001-2-methods"]);
    expect(d.toc[1].confidence).toBe(0.55);
    expect(d.sections[0].summary).toBeNull();
    expect(d.sections[0].extract).toBe("Short intro text.");
    expect(d.sections[0].extractCut).toBe(false);
    expect(d.sections[1].summary?.text).toBe("What the methods are.");
    expect(d.pageLabels?.[1].label).toBe("1");
    expect(d.figures?.[0].pageLabel).toBe("2");
    expect(d.checks.figureSequenceGaps).toEqual(["table 2"]);
  });

  test("the summary badge reads the narrative list's state, so a confirmed summary is not shown as draft", () => {
    const by = { kind: "agent", id: "claude-code", model: "test-model" };
    const dir = entry(base, {
      "sections/sec-000-1-introduction.md": "Intro.",
      "sections/sec-001-2-methods.md": "Methods.",
      "summaries.json": JSON.stringify({ summaries: [
        { source: "sections/sec-000-1-introduction.md", narrative: [{ text: "Draft text.", lang: "en", state: "draft", drafted_by: by }] },
        { source: "sections/sec-001-2-methods.md", narrative: [{ text: "Confirmed text.", lang: "en", state: "confirmed", drafted_by: by, confirmed_by: { kind: "human", id: "owner" } }] },
      ] }),
    });
    const d = readEntryDocument(dir, "r")!;
    expect(d.sections[0].summary?.status).toBe("draft");
    expect(d.sections[1].summary?.status).toBe("confirmed");
  });

  test("a withheld entry publishes no extract, and keeps structure and summaries", () => {
    const dir = entry(base, { "sections/sec-000-1-introduction.md": "Secret text." });
    const d = readEntryDocument(dir, "r", { withheld: true })!;
    expect(d.sections[0].extract).toBeNull();
    expect(d.withheld).toBe(true);
    expect(d.toc.length).toBe(2);
  });

  test("a field an older ingestion lacks is absent, not empty; no structure.json is null", () => {
    const { pages: _pages, figures: _figures, ...old } = base;
    const d = readEntryDocument(entry(old), "r")!;
    expect("pageLabels" in d).toBe(false);
    expect("figures" in d).toBe(false);
    expect(readEntryDocument(mkdtempSync(join(tmpdir(), "libdoc-")), "r")).toBeNull();
  });

  test("an extract is cut at a word and says so", () => {
    const r = extractOf("alpha beta gamma delta", 12);
    expect(r).toEqual({ extract: "alpha beta", cut: true });
  });
});

describe("keywords in the document view", () => {
  test("document and section keywords from keywords.json, heading evidence kept; absent file leaves the field absent", () => {
    const kws = {
      $schema: "folio-keywords/v1",
      document: [{ term: "systematic review", score: 2, evidence: ["heading"] }, { term: "grade", score: 1, evidence: [] }],
      sections: { "sec-001-2-methods": [{ term: "methods", score: 1, evidence: ["heading"] }] },
    };
    const d = readEntryDocument(entry(base, { "keywords.json": JSON.stringify(kws) }), "r", { withheld: true })!;
    expect(d.keywords).toEqual([{ term: "systematic review", heading: true }, { term: "grade", heading: false }]);
    expect(d.sections[1].keywords).toEqual([{ term: "methods", heading: true }]);
    expect(d.sections[0].keywords).toEqual([]);
    expect(readEntryDocument(entry(base), "r")!.keywords).toBeUndefined();
  });
});

describe("a text source is shown by its own headings, not as a PDF (litlfred/dth-hrh)", () => {
  // A minimal text-structure/v1 entry, in the shape text-structure.ts writes.
  const sec = (id: string, level: number, line: number) => ({
    id, number: null, title: id, level, file: "outline.md", line_start: line, line_end: line + 1, unit: "heading", n_chars: 10, n_words: 2,
  });
  const text = {
    _schema: "text-structure/v1",
    doc_id: "outline",
    source: {
      file: "outline.md", sha256: "0".repeat(64), digest: "file", bytes: 20, mtime: null,
      mimetype_sniffed: "text/plain", mimetype_source: "content",
      files: [{ path: "outline.md", sha256: "0".repeat(64), bytes: 20, lines: 4, format: "markdown" }],
      upstream: null,
    },
    metadata: { title: "An outline" },
    toc_source: "headings",
    sections: [sec("s001-a", 1, 1), sec("s002-b", 2, 3)],
    structure_note: "test",
  };

  test("the view says it is a text source and keeps its sections", () => {
    const v = readEntryDocument(entry(text), "outline");
    expect(v).not.toBeNull();
    expect(v!.variant).toBe("text");
    expect(v!.sections.map((s) => s.id)).toEqual(["s001-a", "s002-b"]);
  });

  test("a PDF entry still says pdf", () => {
    const v = readEntryDocument(entry(base), "r");
    expect(v?.variant).toBe("pdf");
  });
});

describe("plainHeading — a text heading as a reader sees it (litlfred/dth-hrh)", () => {
  test("strips emphasis and escapes, keeps the words", () => {
    expect(plainHeading("**Chapter 1\\. Why Digital Health Workforce Registries Matter**")).toBe("Chapter 1. Why Digital Health Workforce Registries Matter");
    expect(plainHeading("**1.1 Global challenges**")).toBe("1.1 Global challenges");
    expect(plainHeading("__Part 0\\. Introduction__")).toBe("Part 0. Introduction");
    expect(plainHeading("The *FHIR* `Practitioner` resource")).toBe("The FHIR Practitioner resource");
  });
  test("an escaped star stays a star; words with underscores are untouched", () => {
    expect(plainHeading("Rating \\*\\*\\* stars")).toBe("Rating *** stars");
    expect(plainHeading("HWF_Registry_DTH_Outline.md")).toBe("HWF_Registry_DTH_Outline.md");
    expect(plainHeading("Plain heading")).toBe("Plain heading");
  });
});

describe("a Markdown section's extract (litlfred/dth-hrh, twg-outline)", () => {
  const text = (unit: "heading" | "file") => ({
    _schema: "text-structure/v1", doc_id: "t", metadata: { title: "T" }, toc_source: "headings", structure_note: "verbatim",
    source: { file: "t.md", sha256: "0".repeat(64), digest: "file", bytes: 1, mtime: null, mimetype_sniffed: "text/plain", mimetype_source: "content", upstream: null,
      files: [{ path: "t.md", sha256: "0".repeat(64), bytes: 1, lines: 9, format: "markdown" }] },
    sections: [{ id: "s001-part-4", number: null, title: "**Part 4\\. Examples**", level: 1, file: "t.md", line_start: 1, line_end: 9, unit, n_chars: 1, n_words: 1 }],
  });
  const md = "---\nsection_id: s001-part-4\n---\n# **Part 4\\. Examples**\n\n**Purpose:** worked [use cases](u.md).\n\n* Maturity *levels*  \n* Step 2\\. done\n";

  test("drops its own heading and reads as plain text", () => {
    const dir = entry(text("heading"));
    writeFileSync(join(dir, "sections", "s001-part-4.md"), md);
    const s = readEntryDocument(dir, "t")!.sections[0]!;
    expect(s.title).toBe("Part 4. Examples");
    expect(s.extract).toBe("Purpose: worked use cases. Maturity levels Step 2. done");
  });

  test("a whole verbatim file is left as it is", () => {
    const dir = entry(text("file"));
    writeFileSync(join(dir, "sections", "s001-part-4.md"), md);
    expect(readEntryDocument(dir, "t")!.sections[0]!.extract).toStartWith("# **Part 4\\. Examples**");
  });
});

describe("a Markdown table in an extract (litlfred/dth-hrh, 'Handbook at a glance')", () => {
  test("drops the delimiter row and reads each row as its cells", () => {
    const md = "## At a glance\n\n| Part | Chapter | Sections |\n| :---- | :---- | :---- |\n| Part 0 | 1. Why **registries** | A; B |\n| | 2. Scope | `a\\|b` |\n";
    // As sectionText reads it: whitespace collapsed and trimmed.
    expect(plainMarkdown(md).replace(/\s+/g, " ").trim()).toBe("Part; Chapter; Sections Part 0; 1. Why registries; A; B 2. Scope; a|b");
  });
});

describe("kept figures and transcribed tables (who-iris#224)", () => {
  const images = {
    images: [
      { id: "img-p002-1", file: "images/img-p002-1.webp", role: "figure", basis: { page: 2 },
        narrative: [{ text: "A bar chart.", lang: "en", state: "draft" }, { text: "Un graphique.", lang: "fr", state: "draft" }] },
      { id: "img-p001-1", file: "images/img-p001-1.png", role: "decorative", basis: { page: 1 } },
      { id: "img-p003-1", file: "images/img-p003-1.webp", role: "figure", basis: { page: 3 } },
    ],
  };
  const csvw = {
    tables: [{ url: "tables/table-1.csv", tableSchema: { columns: [{ titles: "A", "fac:group": "G" }, { titles: "B", "fac:group": "G" }] },
      "fac:label": "Table 1", "fac:caption": "Table 1. Things", "fac:pages": [4], "fac:headerRow": 1,
      "fac:narrative": [{ text: "Lists things.", lang: "en", state: "draft" }] }],
  };
  function withFiles(): string {
    const dir = entry(base, { "images.json": JSON.stringify(images), "tabular.csvw.json": JSON.stringify(csvw) });
    mkdirSync(join(dir, "images"));
    mkdirSync(join(dir, "tables"));
    writeFileSync(join(dir, "images", "img-p002-1.webp"), "x");
    writeFileSync(join(dir, "tables", "table-1.csv"), 'A,B\n"a, ""quoted""",2\nx,"two\nlines"\n');
    return dir;
  }

  test("a figure with its WebP on disk is shown with every language; others are not", () => {
    const v = readEntryDocument(withFiles(), "r")!;
    expect(v.images?.map((i) => i.id)).toEqual(["img-p002-1"]);
    expect(v.images?.[0]?.narratives).toEqual({ en: "A bar chart.", fr: "Un graphique." });
  });

  test("a table's cells come from its CSV, header row dropped, quotes and newlines kept", () => {
    const t = readEntryDocument(withFiles(), "r")!.tables![0]!;
    expect(t.rows).toEqual([['a, "quoted"', "2"], ["x", "two\nlines"]]);
    expect(t.columns[0]).toEqual({ titles: "A", group: "G" });
  });

  test("a withheld entry shows neither", () => {
    const v = readEntryDocument(withFiles(), "r", { withheld: true })!;
    expect(v.images).toBeUndefined();
    expect(v.tables).toBeUndefined();
  });

  // The page's schema is strict, and `check:kind-validators` holds every
  // written `entries/<id>.doc.json` to it: a key the generator adds and the
  // schema does not name fails every entry that has one downstream. `images`
  // and `tables` shipped that way (cat-harness-tools 428a2100).
  test("the view the generator writes, with figures and tables, is one the schema accepts", () => {
    const v = readEntryDocument(withFiles(), "r", { links: { repo: "o/r", branch: "main", dir: "library/r" } })!;
    expect(v.images?.length).toBe(1);
    expect(v.tables?.length).toBe(1);
    const r = LibraryDocumentSchema.safeParse(JSON.parse(JSON.stringify(v)));
    expect(r.success ? [] : r.error.issues).toEqual([]);
  });

  test("the site copies exactly the files the page shows", () => {
    expect(entryFigureFiles(withFiles())).toEqual(["images/img-p002-1.webp", "tables/table-1.csv"]);
  });
  // Owner, 2026-11-14: "has no figures". Vector renders are kept as PNG
  // (9789240116191-eng holds 15) and a WebP-only filter showed none of them.
  test("a vector figure kept as PNG is shown and copied", () => {
    const dir = withFiles();
    mkdirSync(join(dir, "figures"));
    writeFileSync(join(dir, "figures", "vfig-p010.png"), "x");
    writeFileSync(join(dir, "vector-figures.json"), JSON.stringify({ figures: [{ id: "vfig-p010", file: "figures/vfig-p010.png", page: 10 }] }));
    expect(readEntryDocument(dir, "r")!.images?.map((i) => i.id)).toEqual(["img-p002-1", "vfig-p010"]);
    expect(entryFigureFiles(dir)).toContain("figures/vfig-p010.png");
  });
  // kg-folio-asst-2026-09-30's images are `../../../docs/assets/img/…`: joined
  // as-is, the copy escaped `files/<id>/` and landed inside the layer's mount
  // at `docs/docs/assets/…` (bean `cat-tools-sm8r`).
  test("a figure outside the entry is published INSIDE files/<id>/ and read from where it is", () => {
    const dir = withFiles();
    mkdirSync(join(dir, "..", "shared"), { recursive: true });
    writeFileSync(join(dir, "..", "shared", "pic.webp"), "x");
    writeFileSync(join(dir, "images.json"), JSON.stringify({ images: [{ id: "pic", file: "../shared/pic.webp", role: "figure" }] }));
    expect(entryFigureCopies(dir)).toContainEqual({ rel: "_up/shared/pic.webp", source: "../shared/pic.webp" });
    expect(entryFigureFiles(dir).every((r) => !r.split("/").includes(".."))).toBe(true);
    // The page links the same contained path, and the document stays schema-valid.
    const v = readEntryDocument(dir, "r")!;
    expect(v.images?.map((i) => i.file)).toEqual(["_up/shared/pic.webp"]);
    const r = LibraryDocumentSchema.safeParse(JSON.parse(JSON.stringify(v)));
    expect(r.success ? [] : r.error.issues).toEqual([]);
  });
  test("containedRel never climbs out", () => {
    expect(containedRel("images/a.webp")).toBe("images/a.webp");
    expect(containedRel("./images/a.webp")).toBe("images/a.webp");
    expect(containedRel("../../../docs/assets/img/x.webp")).toBe("_up/_up/_up/docs/assets/img/x.webp");
  });
});

/**
 * The Contents tab as a tree of sections with their blocks as leaves (owner,
 * 2026-11-13: "a hierarchy tree expandable browser of sections ... that shows
 * blocks within"). Runs the SAME browser code the page embeds.
 */
describe("the Contents tree", () => {
  interface Tree {
    docContents(d: unknown): string;
    docTreeKids(k: number): string;
    setBlocks(b: unknown[] | null): void;
  }
  const esc = (s: unknown): string =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  // input-site: inert #b429a5e6 — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
  const T = new Function("esc", "$", "DATA_HREF", "window", "document", "location",
    `${DOCUMENT_VIEW_JS}\nreturn { docContents, docTreeKids, setBlocks: function(b){ DOC_BLOCKS = b; } };`,
  )(esc, () => null, "data/index.json", { addEventListener() {} }, {}, { hash: "" }) as Tree;

  const sec = (id: string, title: string, level: number, page: number, blocks?: string[]) => ({
    id, number: null, title, level, pageStart: page, pageEnd: page, labelStart: null, labelEnd: null,
    words: 1, summary: null, keywords: [], extract: null, extractCut: false, ...(blocks ? { blocks } : {}),
  });
  const view = (over: object) => ({ id: "r", variant: "pdf", toc: [], sections: [], checks: {}, withheld: false, ...over });
  const pages = view({ sections: [sec("page-001", "Page 1", 1, 1, ["e/blocks/prose-page-001"]), sec("page-002", "Page 2", 1, 2)] });
  const blocks = [
    { id: "e/blocks/prose-page-001", kind: "prose", title: "Page 1", target: "../sections/page-001.md", content: "Opening words of the first page" },
    { id: "e/blocks/prose-page-002", kind: "prose", title: "Page 2", target: "../sections/page-002.md", content: "Second page text" },
    { id: "e/blocks/figure-p002-1", kind: "figure", title: "A chart", target: "images/p002.webp", content: null },
  ];

  test("toc present: the tree is the outline, as before", () => {
    T.setBlocks([]);
    const d = view({
      tocSource: "outline",
      toc: [
        { level: 1, title: "One", number: "1", page: 1, pageLabel: null, confidence: null, evidence: null, source: "outline", section: "s1" },
        { level: 2, title: "One A", number: "1.1", page: 1, pageLabel: null, confidence: null, evidence: null, source: "outline", section: null },
        { level: 1, title: "Two", number: "2", page: 2, pageLabel: null, confidence: null, evidence: null, source: "outline", section: null },
      ],
      sections: [sec("s1", "One", 1, 1), sec("s9", "Not in the outline", 1, 2)],
    });
    const h = T.docContents(d);
    expect(h).toContain("Source: the PDF’s own outline. 3 entries.");
    expect(h).toContain('data-toc="open">Expand all');
    expect(h).toContain('<a href="#sec-s1" data-sec="s1">1 One</a>');
    expect(h).not.toContain("Not in the outline");
    expect(T.docTreeKids(0)).toContain("1.1 One A");
  });

  test("an inferred contents gains the sections it does not list, at their place", () => {
    // 10665-75211: Part 1's contents pages name 70 entries; the chapters of Parts 2 and 3 were cut
    // inside the last one by the oversized split and appeared nowhere in the tree.
    T.setBlocks([]);
    const d = view({
      tocSource: "inferred",
      tocMethod: "contents",
      toc: [
        { level: 1, title: "Vision", number: "1", page: 3, pageLabel: null, confidence: 0.9, evidence: ["contents"], source: "inferred", section: "s1" },
        { level: 1, title: "Definitions of terms", number: null, page: 10, pageLabel: null, confidence: 0.8, evidence: ["contents"], source: "inferred", section: "s2" },
      ],
      sections: [sec("s0", "Front matter", 1, 1), sec("s1", "Vision", 1, 3), sec("s2", "Definitions of terms", 1, 10), sec("s3", "Part 2: Action plan", 2, 12), sec("s4", "Chapter 1. Framework", 2, 14)],
    });
    const h = T.docContents(d);
    expect(h).toContain("2 entries. 3 section(s) the contents do not list are shown at their place.");
    expect(h.indexOf("Front matter")).toBeLessThan(h.indexOf("Vision"));
    expect(h).toContain("a section the contents do not list");
    const kids = T.docTreeKids(2);
    expect(kids).toContain('data-sec="s3">Part 2: Action plan</a>');
    expect(kids).toContain('data-sec="s4">Chapter 1. Framework</a>');
  });

  test("toc absent: the tree is built from the sections, nested by level", () => {
    T.setBlocks([]);
    const h = T.docContents(pages);
    expect(h).toContain("so its sections are listed. 2 sections.");
    expect(h).not.toContain("No table of contents");
    expect(h).toContain('data-sec="page-001">Page 1</a>');
    expect(h).toContain('data-sec="page-002">Page 2</a>');
    const nested = view({ sections: [sec("a", "Part A", 1, 1), sec("a1", "Chapter A1", 2, 1), sec("b", "Part B", 1, 2)] });
    const top = T.docContents(nested);
    expect(top).toContain("Part A");
    expect(top).toContain("Part B");
    expect(T.docTreeKids(0)).toContain("Chapter A1");
  });

  test("blocks appear as leaves under their own section, by contains or by target", () => {
    T.setBlocks(blocks);
    T.docContents(pages);
    const one = T.docTreeKids(0), two = T.docTreeKids(1);
    // Page 1 by its section's `contains`; the leaf's title repeats the section's, so its first words show.
    expect(one).toContain('<a href="#blk-prose-page-001" data-blk="blk-prose-page-001">Opening words of the first page…</a>');
    expect(one).not.toContain("prose-page-002");
    // Page 2 lists nothing; its prose block is placed by target. The figure names no section and is not guessed in.
    expect(two).toContain('data-blk="blk-prose-page-002"');
    expect(two + one).not.toContain("figure-p002-1");
  });

  test("children are built only when a node is first opened", () => {
    T.setBlocks(blocks);
    const h = T.docContents(pages);
    expect(h).toContain('<details data-node="0"><summary>');
    expect(h).toContain('<ul data-kids="0"></ul>');
    expect(h).not.toContain("data-blk");
    expect(T.docTreeKids(0)).toContain("data-blk");
    // A node alone at its level opens at once, so its children are built now.
    const single = T.docContents(view({ sections: [sec("page-001", "Page 1", 1, 1, ["e/blocks/prose-page-001"])] }));
    expect(single).toContain('<details data-node="0" open>');
    expect(single).toContain('data-built="1"><li class="leaf blk">');
  });

  test("the generator reads each section's blocks from its node, and the viewer anchors each block row", () => {
    const dir = entry({ ...base, toc: [] }, {
      "sections/sec-000-1-introduction.jsonld": JSON.stringify({ contains: ["e/blocks/prose-sec-000", "e/sections/sub", "e/blocks/figure-1"] }),
    });
    const d = readEntryDocument(dir, "r")!;
    expect(d.sections[0].blocks).toEqual(["e/blocks/prose-sec-000", "e/blocks/figure-1"]);
    expect(d.sections[1].blocks).toBeUndefined();
    expect(LibraryDocumentSchema.safeParse(d).success).toBe(true);
    expect(VIEWER_JS).toContain("DOC_BLOCKS = bs;");
    expect(VIEWER_JS).toContain(`'<tr id="' + esc(blockAnchor(b.id)) + '">`);
  });
});

// Owner, 2026-11-14: "why no biblio, glossary, etc here" -- a blank said
// nothing. Each kind now says found, none in the text, or not extracted.
describe("what was extracted (coverage)", () => {
  const cov = (dir: string) => Object.fromEntries((readEntryDocument(dir, "r")!.coverage ?? []).map((c) => [c.kind, c]));

  test("a References heading is found but its entries are not extracted; no glossary heading is 'none'", () => {
    const dir = entry({ ...base, sections: [...base.sections,
      { id: "sec-002-references", number: null, title: "References", level: 1, page_start: 4, page_end: 4, n_chars: 10, n_words: 2 }] });
    const c = cov(dir);
    expect(c.references).toMatchObject({ state: "not-extracted" });
    expect(c.references.note).toContain("p4");
    expect(c.glossary).toMatchObject({ state: "none" });
    expect(c.contents).toMatchObject({ state: "found", count: 2 });
    // One table is captioned in the text and none transcribed.
    expect(c.tables).toMatchObject({ state: "not-extracted", note: "1 captioned in the text" });
    expect(c.footnotes).toMatchObject({ state: "not-extracted" });
  });

  test("a page-split entry says its contents were not extracted and its sections are pages", () => {
    const dir = entry({ ...base, toc: [], figures: [], sections: [
      { id: "page-001", number: null, title: "Page 1", level: 1, page_start: 1, page_end: 1, n_chars: 20, n_words: 5 },
      { id: "page-002", number: null, title: "Page 2", level: 1, page_start: 2, page_end: 2, n_chars: 20, n_words: 5 }] });
    writeFileSync(join(dir, "sections", "page-002.md"), "---\nx: 1\n---\nSome text\nGlossary\nterm: meaning\n");
    const c = cov(dir);
    expect(c.contents.state).toBe("not-extracted");
    expect(c.sections).toMatchObject({ state: "partial", count: 2 });
    // A heading line inside a page's text is found too.
    expect(c.glossary.state).toBe("not-extracted");
  });

  test("the ingest's extraction.json wins for the kinds it names", () => {
    const dir = entry(base, { "extraction.json": JSON.stringify({ kinds: { references: { state: "found", count: 12 } } }) });
    expect(cov(dir).references).toEqual({ kind: "references", state: "found", count: 12 });
  });

  test("the view with coverage is one the schema accepts", () => {
    const r = LibraryDocumentSchema.safeParse(JSON.parse(JSON.stringify(readEntryDocument(entry(base), "r"))));
    expect(r.success ? [] : r.error.issues).toEqual([]);
  });
});

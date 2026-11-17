/**
 * The ingest writer turns Stage A/B artefacts into graph nodes.
 *
 * Two properties are load-bearing and easy to get wrong:
 *
 *  - **A section is a manifest, not a text node.** Its `contains` is an
 *    ORDERED list of block ids; the prose lives in a `prose` block that points
 *    at the `sections/<sid>.md` Stage A already wrote. Copying that text into
 *    the block would duplicate 24.7 M characters and move them out of the path
 *    the corpus-grep checklist looks in.
 *  - **Nothing here is folio content.** `candidates.json` says so itself, and
 *    every emitted node carries `provenance: "ingested"` and an attribution to
 *    its source document so a query can separate *what this paper claims* from
 *    *what the folio claims*.
 *
 * Fixtures mirror the real artefact shapes measured on `litlfred/qou`.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  buildDocumentNodes,
  sectionKey,
  blockId,
  candidateMeta,
  candidateTypes,
  ingestRungOf,
  RUNG_INPUT,
  buildEntryNodes,
  readLicence,
  licenceProperties,
  LICENCE_FILENAME,
  libraryInstanceOf,
  libraryEntriesIn,
  unknownArgument,
} from "../../pipeline/gen-library-jsonld";
import { CONTENT_CONTEXT } from "../../schemas/kg/jsonld.ts";
import { ownPrefixTable } from "../../schemas/kg/graph-typology-registry.js";
import { STANDARD_PREFIXES, contextBindings, vocabMapping } from "../../schemas/content/vocab-mapping.ts";
import { manifestLicence } from "../../schemas/library/source-licence.ts";
import { writeDeclaration } from "../../test/support/instance-fixture.js";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { clearGroupCache } from "../concern-groups.ts";

const DIR = mkdtempSync(join(tmpdir(), "gen-library-"));
afterAll(() => {
  try {
    rmSync(DIR, { recursive: true, force: true });
  } catch {}
});

/**
 * A structure WRITTEN TO DISK must conform to a declared variant: the entry
 * path reads it through the shared accessor (bean rkqp), which refuses an
 * untagged file rather than guessing. The in-memory fixtures below stay loose
 * because `buildDocumentNodes` is handed an already-read structure.
 */
function asPdfStructureFile(s: { doc_id: string; sections: unknown[]; metadata?: Record<string, unknown> }): string {
  return JSON.stringify({
    _schema: "pdf-structure/v1",
    doc_id: s.doc_id,
    source: { file: `${s.doc_id}.pdf`, sha256: "e".repeat(64), bytes: 1, mtime: null, mimetype_sniffed: "application/pdf", mimetype_source: "magic-bytes" },
    metadata: { title: null, docinfo: {}, ...(s.metadata ?? {}) },
    toc_source: "outline",
    sections: s.sections,
    ...(s.sections.length === 0 ? { structure_note: "a fixture with no sections" } : {}),
  });
}

const structure = {
  doc_id: "0110001v3",
  source: { file: "0110001v3.pdf", sha256: "f30f603ac1c5", pages: 12 },
  metadata: { title: "A geometric interpretation of Milnor's triple linking numbers", arxiv: null, doi: null },
  sections: [
    { id: "sec-000-1-introduction", number: "1", title: "Introduction", level: 1, page_start: 1, page_end: 3, n_chars: 4595, n_words: 930 },
    { id: "sec-001-2-the-formula", number: "2", title: "The formula", level: 1, page_start: 3, page_end: 8, n_chars: 9000, n_words: 1800 },
  ],
};

const candidates = {
  document_class: "math",
  validated: true,
  disposition: "proposals only — promote via document-intake Stage 4",
  candidates: [
    { kind: "remark", statement: "It is worth noting a few properties.", section_file: "sections/sec-000-1-introduction.md" },
    { kind: "theorem", statement: "The triple linking number equals the count.", section_file: "sections/sec-001-2-the-formula.md", formalization_candidate: true },
    { kind: "lemma", statement: "", section_file: "sections/sec-001-2-the-formula.md" },
  ],
};

let files: Array<{ path: string; content: string }>;
const byPath = (p: string) => files.find((f) => f.path === p);
const parse = (p: string) => JSON.parse(byPath(p)!.content) as Record<string, unknown>;

beforeAll(() => {
  mkdirSync(join(DIR, "sections"), { recursive: true });
  writeFileSync(join(DIR, "sections", "sec-000-1-introduction.md"), "Intro text.\n");
  writeFileSync(join(DIR, "sections", "sec-001-2-the-formula.md"), "Formula text.\n");
  files = buildDocumentNodes("0110001v3", structure, candidates, () => true);
});

describe("id derivation", () => {
  test("section key is the stable prefix, not the slugged title", () => {
    // The title can be re-derived by a better extractor; the index cannot.
    expect(sectionKey("sec-000-1-introduction")).toBe("sec-000");
    expect(sectionKey("sec-012-appendix-b")).toBe("sec-012");
  });

  test("block ids are per-section ordinals, so one section cannot renumber another", () => {
    // An @id is a public contract the moment anything annotates it.
    expect(blockId("theorem", "sec-001", 3)).toBe("thm-sec-001-03");
    expect(blockId("prose", "sec-001")).toBe("prose-sec-001");
  });

  test("uses the same prefixes an author would", () => {
    expect(blockId("remark", "sec-000", 1)).toBe("rem-sec-000-01");
    expect(blockId("lemma", "sec-000", 1)).toBe("lem-sec-000-01");
  });
});

describe("a section is a manifest", () => {
  test("it carries no text of its own", () => {
    const sec = parse("sections/sec-000.jsonld");
    expect(sec.text).toBeUndefined();
  });

  test("contains is ordered: prose first, then candidates in extraction order", () => {
    expect(parse("sections/sec-001.jsonld").contains).toEqual([
      "library/0110001v3/blocks/prose-sec-001",
      "library/0110001v3/blocks/thm-sec-001-01",
      "library/0110001v3/blocks/lem-sec-001-02",
    ]);
  });

  test("the prose block points at Stage A's file rather than copying it", () => {
    const prose = parse("blocks/prose-sec-000.jsonld");
    expect(prose.text).toBe("../sections/sec-000-1-introduction.md");
    // No `.md` is emitted for a prose block — that would duplicate the corpus.
    expect(byPath("blocks/prose-sec-000.md")).toBeUndefined();
  });

  test("a section with no .md yields no prose block", () => {
    const noMd = buildDocumentNodes("d", structure, candidates, () => false);
    expect(noMd.some((f) => f.path.startsWith("blocks/prose-"))).toBe(false);
  });
});

describe("extracted claims become typed blocks", () => {
  test("kind and type survive", () => {
    const thm = parse("blocks/thm-sec-001-01.jsonld");
    expect(thm.kind).toBe("theorem");
    expect(thm["@type"]).toEqual(["folio-assistant-sci:Theorem", "doco:Section"]);
  });

  test("a claim's statement is written as its own text file", () => {
    expect(byPath("blocks/thm-sec-001-01.md")!.content).toContain("triple linking number");
    expect(parse("blocks/thm-sec-001-01.jsonld").text).toBe("thm-sec-001-01.md");
  });

  test("an empty statement yields no text file and no dangling link", () => {
    expect(byPath("blocks/lem-sec-001-02.md")).toBeUndefined();
    expect(parse("blocks/lem-sec-001-02.jsonld").text).toBeUndefined();
  });
});

describe("nothing here is folio content", () => {
  test("every node is marked ingested", () => {
    for (const f of files.filter((x) => x.path.endsWith(".jsonld"))) {
      expect(JSON.parse(f.content).provenance).toBe("ingested");
    }
  });

  test("every node is attributed to its source document", () => {
    for (const f of files.filter((x) => x.path.endsWith(".jsonld") && x.path !== "manifest.jsonld")) {
      expect(JSON.parse(f.content).sourceDocument).toBe("library/0110001v3/manifest");
    }
  });

  test("the extractor's own disposition is carried verbatim, not paraphrased", () => {
    const meta = parse("manifest.jsonld").meta as Record<string, unknown>;
    expect(meta.disposition).toBe(candidates.disposition);
  });

  test("a document with no candidates.json still says it is not folio content", () => {
    const bare = buildDocumentNodes("d", structure, undefined, () => true);
    const meta = JSON.parse(bare.find((f) => f.path === "manifest.jsonld")!.content).meta;
    expect(String(meta.disposition)).toContain("not folio content");
  });
});

describe("the manifest", () => {
  test("carries source identity for the PROV join", () => {
    const meta = parse("manifest.jsonld").meta as Record<string, unknown>;
    expect(meta.source_sha256).toBe("f30f603ac1c5");
    expect(meta.pages).toBe(12);
  });

  test("contains the sections in document order", () => {
    expect(parse("manifest.jsonld").contains).toEqual([
      "library/0110001v3/sections/sec-000",
      "library/0110001v3/sections/sec-001",
    ]);
  });
});

describe("determinism", () => {
  test("two builds are byte-identical — the --check gate depends on it", () => {
    const a = buildDocumentNodes("0110001v3", structure, candidates, () => true);
    const b = buildDocumentNodes("0110001v3", structure, candidates, () => true);
    expect(a.map((f) => f.path + f.content)).toEqual(b.map((f) => f.path + f.content));
  });

  test("no key is emitted with an undefined or empty value", () => {
    for (const f of files.filter((x) => x.path.endsWith(".jsonld"))) {
      for (const [, v] of Object.entries(JSON.parse(f.content))) {
        expect(v).not.toBeUndefined();
        if (Array.isArray(v)) expect(v.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("which ingest rung an entry is on — bean `p67i`", () => {
  const has = (...files: string[]) => (f: string) => files.includes(f);

  test("Stage A output puts it on the paged rung", () => {
    expect(ingestRungOf(has("structure.json"))).toBe("paged");
  });

  test("a tabular record puts it on the tabular rung", () => {
    // The whole point of the branch: before it, this entry fell into
    // `skipped` and was reported "not ingested" while being fully ingested.
    expect(ingestRungOf(has("tabular.jsonld"))).toBe("tabular");
  });

  test("the CSVW record puts it there too, for when eief's extractors land", () => {
    expect(ingestRungOf(has("tabular.csvw.json"))).toBe("tabular");
  });

  test("neither input is a DETERMINED `none`, not an unreadable one", () => {
    // `none` says the entry has no ingest input. An entry WITH an input that
    // did not parse is the other state, and the walk reports it separately
    // and exits non-zero — "could not determine" is never a pass.
    expect(ingestRungOf(has("manifest.jsonld"))).toBe("none");
    expect(ingestRungOf(has())).toBe("none");
  });

  test("paged wins when both are present — the table is ordered, not a set", () => {
    expect(ingestRungOf(has("structure.json", "tabular.jsonld"))).toBe("paged");
    expect(RUNG_INPUT[0]?.[0]).toBe("paged");
  });

  test("every rung in the table is reachable from its own input", () => {
    // A rung whose input the walk never checks is a branch that cannot fire —
    // which is what the emitter itself was until this wiring.
    for (const [rung, inputs] of RUNG_INPUT) {
      for (const f of inputs) expect(ingestRungOf(has(f))).toBe(rung);
    }
  });
});

describe("a whole library entry, through the real branch — bean `p67i`", () => {
  // Against a temp directory rather than `library/`, because a dataset in
  // THIS repository would be content in the platform. That is exactly why the
  // tabular branch had no CI coverage until it was extracted from the walk.
  const entry = (files: Record<string, unknown>) => {
    const dir = mkdtempSync(join(tmpdir(), "entry-"));
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(join(dir, name), typeof body === "string" ? body : JSON.stringify(body));
    }
    return dir;
  };
  const record = (format: string, sheets: { name: string; headers: string[] }[]) => ({
    $schema: "folio-tabular-records/v1",
    "@id": "library/d/tabular",
    source: { file: `d.${format}` },
    format,
    sheets: sheets.map((s) => ({ ...s, rows: 2, columns: s.headers.length, shape_source: "counted" })),
    n_sheets: sheets.length,
    header_vocabulary: [...new Set(sheets.flatMap((s) => s.headers))].sort(),
    narrative: { text: null, state: "not-authored" },
  });

  test("a CSV entry yields manifest + ONE table, and no sheet", () => {
    const dir = entry({ "tabular.jsonld": record("csv", [{ name: "d", headers: ["iso3", "cases"] }]) });
    const out = buildEntryNodes("d", dir);
    expect(out.state).toBe("built");
    if (out.state !== "built") return;
    expect(out.rung).toBe("tabular");
    expect(out.files.map((f) => f.path).sort()).toEqual(["blocks/table-001.jsonld", "manifest.jsonld"]);
    const manifest = JSON.parse(out.files.find((f) => f.path === "manifest.jsonld")!.content);
    expect(manifest.contains).toEqual(["library/d/blocks/table-001"]);
    expect(manifest.meta.tabular_depth).toBe("table");
    expect(manifest.meta.tabular_record).toBe("folio-tabular-records/v1");
    // The record's `title` is its FILE name, which is never a title (#1794):
    // with no catalogue record the slug stands, and says so.
    expect(manifest.title).toBe("d");
    expect(manifest.meta.title_source).toBe("slug");
    rmSync(dir, { recursive: true, force: true });
  });

  test("a two-sheet workbook yields a sheet node per sheet", () => {
    const dir = entry({
      "tabular.jsonld": record("xlsx", [
        { name: "Coverage", headers: ["iso3", "mcv1_pct"] },
        { name: "Notes", headers: ["iso3", "note"] },
      ]),
    });
    const out = buildEntryNodes("d", dir);
    expect(out.state).toBe("built");
    if (out.state !== "built") return;
    expect(out.files.map((f) => f.path).sort()).toEqual([
      "blocks/table-001.jsonld",
      "blocks/table-002.jsonld",
      "manifest.jsonld",
      "sheets/sheet-001.jsonld",
      "sheets/sheet-002.jsonld",
    ]);
    const manifest = JSON.parse(out.files.find((f) => f.path === "manifest.jsonld")!.content);
    expect(manifest.contains).toEqual(["library/d/sheets/sheet-001", "library/d/sheets/sheet-002"]);
    expect(manifest.meta.tabular_depth).toBe("sheet");
    rmSync(dir, { recursive: true, force: true });
  });

  test("a STAGED entry is minted for the library it is promoted INTO — bean `apui`", () => {
    // Measured 2026-10-06: a document staged under `cat-harness/ingest-staging/`
    // and promoted into a sibling layer's library carried a manifest `@id`
    // naming `cat-harness`, because the layer is read off the entry's
    // location and staging is not where the entry ends up. Two layers, so
    // the location-derived answer and the right one differ.
    const root = mkdtempSync(join(tmpdir(), "located-"));
    for (const name of ["stager", "sib"]) {
      mkdirSync(join(root, name, "library"), { recursive: true });
      writeDeclaration(join(root, name), {
        name,
        directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }],
      });
    }
    const staged = join(root, "stager", "ingest-staging", "d");
    mkdirSync(staged, { recursive: true });
    writeFileSync(join(staged, "tabular.jsonld"), JSON.stringify(record("csv", [{ name: "d", headers: ["a"] }])));
    const manifestId = (o: ReturnType<typeof buildEntryNodes>) =>
      o.state === "built" ? JSON.parse(o.files.find((f) => f.path === "manifest.jsonld")!.content)["@id"] : o.state;

    // Without a destination the staging tree's own layer answers — the defect.
    expect(manifestId(buildEntryNodes("d", staged))).toContain("/stager/source/d");
    // With one, the destination's — and the bytes are those the corpus walk
    // will compute once the entry sits there, which is what `--check` compares.
    const dest = join(root, "sib", "library", "d");
    const minted = manifestId(buildEntryNodes("d", staged, dest));
    expect(minted).toContain("/sib/source/d");
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(dest, "tabular.jsonld"), readFileSync(join(staged, "tabular.jsonld")));
    expect(manifestId(buildEntryNodes("d", dest))).toBe(minted);
    rmSync(root, { recursive: true, force: true });
  });

  // Bean `cat-tools-v8wg`: CODATA's corrected title was written into the
  // GENERATED manifest, and the next regeneration put the slug back. An
  // authored `title-correction.json` beside the entry is what the generator
  // reads, so a regeneration keeps it.
  const correction = { title: "CODATA 2022 recommended values of the fundamental physical constants", basis: "the NIST CODATA page the file is published from", corrected_on: "2026-10-12", bean: "cat-tools-v8wg" };

  test("an editorial title-correction.json titles a tabular entry, with its basis in the manifest", () => {
    const dir = entry({ "tabular.jsonld": record("txt", [{ name: "d", headers: ["quantity", "value"] }]), "title-correction.json": correction });
    const out = buildEntryNodes("d", dir);
    expect(out.state).toBe("built");
    if (out.state !== "built") return;
    const manifest = JSON.parse(out.files.find((f) => f.path === "manifest.jsonld")!.content);
    expect(manifest.title).toBe(correction.title);
    expect(manifest.meta.title_source).toBe("editorial");
    expect(manifest.meta.title_from).toBe("title-correction.json title");
    expect(manifest.meta.title_verified).toBe(true);
    expect(manifest.meta.title_correction).toMatchObject({ basis: correction.basis, corrected_on: "2026-10-12", bean: "cat-tools-v8wg" });
    rmSync(dir, { recursive: true, force: true });
  });

  test("FALSIFICATION: regenerating does not erase it — the defect the bean measured", () => {
    const dir = entry({ "tabular.jsonld": record("txt", [{ name: "d", headers: ["quantity"] }]), "title-correction.json": correction });
    const first = buildEntryNodes("d", dir);
    if (first.state !== "built") throw new Error("not built");
    // Write the generated manifest back, as a regeneration's previous run would have.
    writeFileSync(join(dir, "manifest.jsonld"), first.files.find((f) => f.path === "manifest.jsonld")!.content);
    const second = buildEntryNodes("d", dir);
    if (second.state !== "built") throw new Error("not built");
    expect(JSON.parse(second.files.find((f) => f.path === "manifest.jsonld")!.content).title).toBe(correction.title);
    rmSync(dir, { recursive: true, force: true });
  });

  test("a correction without its basis is unreadable — an editorial title with no basis is a guess", () => {
    const dir = entry({ "tabular.jsonld": record("txt", [{ name: "d", headers: ["q"] }]), "title-correction.json": { title: "Something" } });
    expect(buildEntryNodes("d", dir).state).toBe("unreadable");
    rmSync(dir, { recursive: true, force: true });
  });

  test("a record that is THERE and unreadable is `unreadable`, never `no-input`", () => {
    // The failure this separation exists to prevent: reported as "not
    // ingested", it names the wrong cause and sends a reader to the wrong fix.
    const dir = entry({ "tabular.jsonld": "{ not json" });
    expect(buildEntryNodes("d", dir).state).toBe("unreadable");
    rmSync(dir, { recursive: true, force: true });
  });

  test("a record of an unrecognised schema is unreadable too, not an empty document", () => {
    const dir = entry({ "tabular.jsonld": { $schema: "something-else/v9", sheets: [] } });
    expect(buildEntryNodes("d", dir).state).toBe("unreadable");
    rmSync(dir, { recursive: true, force: true });
  });

  test("an entry with no ingest input at all is `no-input`, which PASSES", () => {
    const dir = entry({ "README.md": "nothing here" });
    expect(buildEntryNodes("d", dir).state).toBe("no-input");
    rmSync(dir, { recursive: true, force: true });
  });

  test("an unreadable structure.json is `unreadable` on the PAGED rung too", () => {
    // The third state is not a tabular-only concern: a paged entry whose
    // Stage A output is there and does not parse has the same two wrong
    // answers available to it.
    const dir = entry({ "structure.json": "{ not json" });
    expect(buildEntryNodes("d", dir).state).toBe("unreadable");
    rmSync(dir, { recursive: true, force: true });
  });

  test("a record naming no file falls back to the ENTRY ID, not to nothing", () => {
    // `tabularShapeOf` refuses to invent a title because it cannot know the
    // entry id. The caller can, and does — a manifest with no title at all
    // would be the emitter's ignorance showing up as a missing fact.
    const r = record("csv", [{ name: "d", headers: ["iso3"] }]) as Record<string, unknown>;
    delete r.source;
    const dir = entry({ "tabular.jsonld": r });
    const out = buildEntryNodes("an-entry-id", dir);
    expect(out.state).toBe("built");
    if (out.state !== "built") return;
    const manifest = JSON.parse(out.files.find((f) => f.path === "manifest.jsonld")!.content);
    expect(manifest.title).toBe("an-entry-id");
    rmSync(dir, { recursive: true, force: true });
  });

  test("a paged entry's title is its PDF /Title, never the page-1 parse (#1794)", () => {
    const parsed = entry({
      "structure.json": asPdfStructureFile({ doc_id: "d", sections: [], metadata: { title: "Abies", docinfo: {} } }),
    });
    const titled = entry({
      "structure.json": asPdfStructureFile({
        doc_id: "d",
        sections: [],
        metadata: { title: "JSON-LD 1.1 This version: Latest published version:", docinfo: { Title: "JSON-LD 1.1" } },
      }),
    });
    const manifestOf = (dir: string) => {
      const out = buildEntryNodes("d", dir);
      if (out.state !== "built") throw new Error(out.state);
      return JSON.parse(out.files.find((f) => f.path === "manifest.jsonld")!.content);
    };
    expect(manifestOf(parsed).title).toBe("d");
    expect(manifestOf(parsed).meta.title_source).toBe("slug");
    expect(manifestOf(titled).title).toBe("JSON-LD 1.1");
    expect(manifestOf(titled).meta).toMatchObject({ title_source: "pdf-info", title_from: "structure.json metadata.docinfo.Title" });
    rmSync(parsed, { recursive: true, force: true });
    rmSync(titled, { recursive: true, force: true });
  });

  test("a paged entry still goes down the paged rung, untouched", () => {
    const dir = entry({
      "structure.json": asPdfStructureFile({ doc_id: "d", sections: [], metadata: { title: "A paper" } }),
    });
    const out = buildEntryNodes("d", dir);
    expect(out.state).toBe("built");
    if (out.state !== "built") return;
    expect(out.rung).toBe("paged");
    expect(out.files.some((f) => f.path.startsWith("sheets/"))).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("a figure on a section boundary — bean `imen`", () => {
  // Section page ranges OVERLAP: a section's `page_end` is the start page of
  // the next one, inclusive. The fixture above already has that shape —
  // `sec-000` is pages 1–3 and `sec-001` is pages 3–8, so page 3 is in both.
  //
  // Before the fix, the generator emitted one node PER containing section, all
  // to the same `blocks/figure-<id>.jsonld` path with a different `derivedFrom`
  // each. Last write won, so `--check` reported the losers stale forever:
  // re-running reproduced exactly the same race. Measured on the WHO PHC
  // digital transformation handbook, where page 71 falls inside FOUR sections.
  //
  // It took an embedded outline AND placed raster figures to surface, and no
  // library entry had both until 2026-09-22.
  const images = {
    doc_id: "0110001v3",
    images: [
      // Page 3 — the boundary. In BOTH sections.
      { id: "img-p003-1", file: "images/img-p003-1.png", role: "figure", basis: { method: "geometry", coverage: 0.4, imagesOnPage: 1, page: 3 } },
      // Page 5 — interior to `sec-001` only, the uncontested control.
      { id: "img-p005-1", file: "images/img-p005-1.png", role: "figure", basis: { method: "geometry", coverage: 0.4, imagesOnPage: 1, page: 5 } },
    ],
  };
  let out: Array<{ path: string; content: string }>;
  beforeAll(() => {
    out = buildDocumentNodes("0110001v3", structure, candidates, () => true, images as never);
  });

  test("is written ONCE, not once per containing section", () => {
    const paths = out.map((f) => f.path).filter((p) => p === "blocks/figure-img-p003-1.jsonld");
    expect(paths).toHaveLength(1);
  });

  test("belongs to the FIRST containing section, which is reading order", () => {
    // The owner's ruling, 2026-09-22 (issue #877): first rather than last, so a
    // figure introduced at the end of a section stays with the section that
    // introduced it. Last is what the race happened to land on, not a reason.
    const n = JSON.parse(out.find((f) => f.path === "blocks/figure-img-p003-1.jsonld")!.content) as Record<string, unknown>;
    expect(n.derivedFrom).toBe(`library/0110001v3/sections/${sectionKey("sec-000-1-introduction")}`);
  });

  test("an uncontested figure is unaffected", () => {
    const n = JSON.parse(out.find((f) => f.path === "blocks/figure-img-p005-1.jsonld")!.content) as Record<string, unknown>;
    expect(n.derivedFrom).toBe(`library/0110001v3/sections/${sectionKey("sec-001-2-the-formula")}`);
  });

  test("ONE section lists it — ownership is single, not split", () => {
    // A consequence of the owner's ruling, and worth stating because it goes a
    // step past the question as asked. `contains` is a section's manifest of
    // its blocks, so listing a boundary figure in BOTH sections while deriving
    // it from one would be internally inconsistent: a consumer walking
    // `contains` across sections would meet the same block id twice and have
    // no way to tell a shared figure from a double count.
    //
    // So the first containing section owns it in both places. The later
    // section does not list it. The alternative considered and rejected was
    // listing it everywhere and deriving from one, which asserts two owners.
    const contains = (sid: string) =>
      (JSON.parse(out.find((f) => f.path === `sections/${sectionKey(sid)}.jsonld`)!.content) as { contains?: string[] })
        .contains ?? [];
    expect(contains("sec-000-1-introduction")).toContain("library/0110001v3/blocks/figure-img-p003-1");
    expect(contains("sec-001-2-the-formula")).not.toContain("library/0110001v3/blocks/figure-img-p003-1");
    expect(contains("sec-001-2-the-formula")).toContain("library/0110001v3/blocks/figure-img-p005-1");
  });
});

describe("the licence record survives regeneration (folio-assistant#1492)", () => {
  const manifest = (fs: Array<{ path: string; content: string }>) =>
    JSON.parse(fs.find((f) => f.path === "manifest.jsonld")!.content) as Record<string, unknown> & { meta: Record<string, unknown> };
  const record = { status: "unknown", searched: [{ where: "the PDF", result: "no statement" }] };

  test("an authored licence is carried verbatim as licenceRecord, and read back by the checker's accessor", () => {
    const m = manifest(buildDocumentNodes("d", structure, candidates, () => true, undefined, record));
    expect(m.licenceRecord).toEqual(record);
    expect(manifestLicence(m)).toEqual(record);
  });

  test("no sidecar: no licence anywhere, so the checker reports 'not recorded'", () => {
    const m = manifest(buildDocumentNodes("d", structure, candidates, () => true));
    expect("licenceRecord" in m).toBe(false);
    expect("license" in m).toBe(false);
    expect("licence" in m.meta).toBe(false);
  });

  test("the whole entry path reads licence.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "lic-entry-"));
    try {
      mkdirSync(join(dir, "sections"), { recursive: true });
      writeFileSync(join(dir, "structure.json"), asPdfStructureFile(structure));
      writeFileSync(join(dir, LICENCE_FILENAME), JSON.stringify(record));
      const out = buildEntryNodes("d", dir);
      expect(out.state).toBe("built");
      expect(manifest((out as { files: Array<{ path: string; content: string }> }).files).licenceRecord).toEqual(record);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an unparseable sidecar is carried as malformed, never as absent", () => {
    const dir = mkdtempSync(join(tmpdir(), "lic-bad-"));
    try {
      writeFileSync(join(dir, LICENCE_FILENAME), "{ not json");
      expect((readLicence(dir) as { status: string }).status).toBe("unparseable");
      expect(readLicence(join(dir, "nowhere"))).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("D4: a library item's licence is dcterms:license, by the row a glossary uses (bean gzkt)", () => {
  const manifest = (fs: Array<{ path: string; content: string }>) =>
    JSON.parse(fs.find((f) => f.path === "manifest.jsonld")!.content) as Record<string, unknown> & { meta: Record<string, unknown> };
  const stated = { status: "stated", id: "CC-BY-NC-SA-3.0-IGO", basis: "the copyright page" };
  const unknown = { status: "unknown", searched: [{ where: "the PDF", result: "no statement" }] };

  test("a stated licence is written as `license`, outside meta", () => {
    const m = manifest(buildDocumentNodes("d", structure, candidates, () => true, undefined, stated));
    expect(m.license).toBe("CC-BY-NC-SA-3.0-IGO");
    expect(m.licenceRecord).toEqual(stated);
    expect("licence" in m.meta).toBe(false);
  });

  test("an unknown licence is recorded as unknown and never named", () => {
    const p = licenceProperties(unknown);
    expect("license" in p).toBe(false);
    expect(p.licenceRecord).toEqual(unknown);
  });

  test("a stated record with no id names nothing (the checker reports it malformed)", () => {
    expect("license" in licenceProperties({ status: "stated", basis: "x" })).toBe(false);
  });

  test("an unparseable sidecar names no licence", () => {
    expect("license" in licenceProperties({ status: "unparseable", note: "x" })).toBe(false);
  });

  test("no record: nothing at all", () => {
    expect(licenceProperties(undefined)).toEqual({});
  });

  test("the published context binds both keys as the licence-naming table does", () => {
    const table = vocabMapping(join(HARNESS_ROOT), "licence-naming");
    const bound = contextBindings([table], { inContext: {}, prefixes: { ...STANDARD_PREFIXES, ...ownPrefixTable() } });
    const ctx = CONTENT_CONTEXT as unknown as Record<string, { "@id": string }>;
    const expand = (c: string) => {
      const [pfx, local] = c.split(":") as [string, string];
      return `${(CONTENT_CONTEXT as unknown as Record<string, string>)[pfx]}${local}`;
    };
    expect(expand(ctx.license!["@id"])).toBe(bound.license!);
    expect(bound.license).toBe("http://purl.org/dc/terms/license");
    expect(expand(ctx.licenceRecord!["@id"])).toBe(bound.licenceRecord!);
  });
});

describe("the instance an entry belongs to", () => {
  test("a relative entry path names the instance, not \".\"", () => {
    // Measured 2026-10-11: `--entry library/<id>` run from the layer root
    // minted manifests under `.../jsonld/./<id>/`, since the folder above
    // `library` is "." until the path is resolved.
    const root = mkdtempSync(join(tmpdir(), "relative-"));
    mkdirSync(join(root, "inst", "library", "d"), { recursive: true });
    writeDeclaration(join(root, "inst"), {
      name: "inst",
      directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }],
    });
    const cwd = process.cwd();
    try {
      process.chdir(join(root, "inst"));
      expect(libraryInstanceOf("library/d")).toBe("inst");
    } finally {
      process.chdir(cwd);
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the instance is the declared name, not the folder it was cloned into (bean j3ls)", () => {
    const root = mkdtempSync(join(tmpdir(), "clone-"));
    mkdirSync(join(root, "wim", "library", "d"), { recursive: true });
    writeDeclaration(join(root, "wim"), {
      name: "who-iris",
      directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }],
    });
    try {
      expect(libraryInstanceOf(join(root, "wim", "library", "d"))).toBe("who-iris");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the instance a GROUPED entry belongs to (bean 6fez)", () => {
  test("an entry in a declared group, library/<group>/<id>, names the instance", () => {
    // Measured 2026-11-02: once cat-harness filed its entries into groups,
    // the declaration two folders up was the library's, so every manifest
    // IRI fell back to the relative form and 5531 nodes read as stale.
    const root = mkdtempSync(join(tmpdir(), "grouped-"));
    const lib = join(root, "inst", "library");
    mkdirSync(join(lib, "ui", "d"), { recursive: true });
    mkdirSync(join(lib, "stray", "e"), { recursive: true });
    writeFileSync(join(lib, "library.json"), JSON.stringify({ $schema: "concern-groups/v1", groups: ["ui"] }));
    writeDeclaration(join(root, "inst"), {
      name: "inst",
      directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }],
    });
    clearGroupCache();
    try {
      expect(libraryInstanceOf(join(lib, "ui", "d"))).toBe("inst");
      // A folder the library does not declare as a group is not one: no guess.
      expect(libraryInstanceOf(join(lib, "stray", "e"))).toBeUndefined();
    } finally {
      clearGroupCache();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("the instance an entry belongs to when its library sits BELOW the instance (cat-harness#1032)", () => {
  test("library/corpus/<group>/<id> and library/corpus/<id> name the instance that declares the corpus", () => {
    // Measured 2026-11-07: cat-harness moved its corpus to `library/corpus/`,
    // the folder above the library was no layer, and every manifest IRI
    // fell back to the relative form — 5611 nodes stale.
    const root = mkdtempSync(join(tmpdir(), "nested-"));
    const corpus = join(root, "inst", "library", "corpus");
    mkdirSync(join(corpus, "ui", "d"), { recursive: true });
    mkdirSync(join(corpus, "e"), { recursive: true });
    mkdirSync(join(root, "inst", "library", "other", "f"), { recursive: true });
    writeFileSync(join(corpus, "library.json"), JSON.stringify({ $schema: "concern-groups/v1", groups: ["ui"] }));
    writeDeclaration(join(root, "inst"), {
      name: "inst",
      directories: [{ id: "library", path: "library/corpus/", graphTypologies: ["library"] }],
    });
    clearGroupCache();
    try {
      expect(libraryInstanceOf(join(corpus, "ui", "d"))).toBe("inst");
      expect(libraryInstanceOf(join(corpus, "e"))).toBe("inst");
      // A folder the layer does not declare a library is not one: no guess.
      expect(libraryInstanceOf(join(root, "inst", "library", "other", "f"))).toBeUndefined();
    } finally {
      clearGroupCache();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("an argument run() would not read is refused before anything is written", () => {
  test("--help, a typo, or a stray value is named; the real flags and their values pass", () => {
    expect(unknownArgument(["--help"])).toBe("--help");
    expect(unknownArgument(["--chek"])).toBe("--chek");
    expect(unknownArgument(["library/x"])).toBe("library/x");
    expect(unknownArgument([])).toBeUndefined();
    expect(unknownArgument(["--check", "--prune", "--doc", "x"])).toBeUndefined();
    expect(unknownArgument(["--entry", "ingest-staging/x"])).toBeUndefined();
  });
});

describe("a requirement candidate (L1 requirement ingestion, 2026-11-01)", () => {
  test("carries the source's own number and kind, and nothing it was not given", () => {
    expect(candidateMeta({ kind: "remark" })).toBeUndefined();
    expect(
      candidateMeta({ kind: "indicator", number: "1-01", source_kind: "nhwa-indicator", aspect: "requirements" }),
    ).toEqual({ source_number: "1-01", source_kind: "nhwa-indicator", aspect: "requirements" });
  });

  test("copies printed fields into meta as strings, never over its own keys", () => {
    expect(
      candidateMeta({
        kind: "indicator",
        number: "1-01",
        fields: { indicatorId: "1-01", numerator: "Number of active health workers", source_number: "x", empty: " " },
      }),
    ).toEqual({ indicatorId: "1-01", numerator: "Number of active health workers", source_number: "1-01" });
  });

  test("its node keeps the section link and gains the meta; one without stays byte-identical", () => {
    const withReq = {
      candidates: [
        ...candidates.candidates,
        { kind: "recommendation", number: "R1", strength: "should", statement: "Registries should be updated.", section_file: "sections/sec-000-1-introduction.md" },
      ],
    };
    const out = buildDocumentNodes("0110001v3", structure, withReq, () => true);
    const node = JSON.parse(out.find((f) => f.path === "blocks/recommendation-sec-000-02.jsonld")!.content) as Record<string, unknown>;
    expect(node.derivedFrom).toBe("library/0110001v3/sections/sec-000");
    expect(node.meta).toEqual({ source_number: "R1", strength: "should" });
    expect(parse("blocks/rem-sec-000-01.jsonld").meta).toBeUndefined();
  });
});

describe("a candidate's @type (cat-harness-tools#1356)", () => {
  test("a kind no mounted layer types is still a typed library block, never untyped", () => {
    // No layer in this checkout contributes this kind.
    expect(candidateTypes("no-such-kind-anywhere")).toEqual(["cat-harness:Block"]);
    // A core kind keeps its own pair.
    expect(candidateTypes("theorem").length).toBeGreaterThan(0);
    expect(candidateTypes("theorem")).not.toContain("cat-harness:Block");
  });

  test("an entry in a mounted layer resolves contributed kinds and prefixes from that layer's dependencies, not a sibling's", () => {
    const root = mkdtempSync(join(tmpdir(), "layer-contribs-"));
    try {
      mkdirSync(join(root, "dak", "block-kinds"), { recursive: true });
      writeDeclaration(join(root, "dak"), {
        name: "dak",
        version: "0.1.0",
        iriBase: "https://example.org/dak/",
        directories: [{ id: "dak-block-kinds", path: "block-kinds/", graphTypologies: ["block-kinds"] }],
      });
      writeFileSync(
        join(root, "dak", "block-kinds", "indicator.json"),
        JSON.stringify({
          $schema: "folio-block-kind/v1",
          kind: "indicator",
          adapter: "dak",
          builder: "indicator",
          labelPrefix: "ind",
          folioType: "dak:Indicator",
        }),
      );

      for (const [name, needs] of [
        ["ig", ["dak"]],
        ["iris", []],
      ] as const) {
        const entryDir = join(root, name, "library", "d");
        mkdirSync(join(entryDir, "sections"), { recursive: true });
        writeDeclaration(join(root, name), {
          name,
          version: "0.1.0",
          iriBase: `https://example.org/${name}/`,
          ...(needs.length ? { needs: [...needs] } : {}),
          directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }],
        });
        writeFileSync(
          join(entryDir, "structure.json"),
          asPdfStructureFile({
            doc_id: "d",
            sections: [{ id: "sec-000-1-intro", number: "1", title: "Intro", level: 1, page_start: 1, page_end: 2, n_chars: 10, n_words: 2 }],
            metadata: { title: "Guide" },
          }),
        );
        writeFileSync(join(entryDir, "sections", "sec-000-1-intro.md"), "Intro.\n");
        writeFileSync(
          join(entryDir, "candidates.json"),
          JSON.stringify({
            candidates: [{ kind: "indicator", statement: "Active workers.", section_file: "sections/sec-000-1-intro.md" }],
          }),
        );
      }

      const igBuilt = buildEntryNodes("d", join(root, "ig", "library", "d"));
      expect(igBuilt.state).toBe("built");
      if (igBuilt.state !== "built") return;
      const igBlock = JSON.parse(igBuilt.files.find((f) => f.path === "blocks/indicator-sec-000-01.jsonld")!.content);
      expect(igBlock["@type"]).toEqual(["dak:Indicator"]);
      expect(igBlock["@context"][1].dak).toBe("https://example.org/dak/v0/ns/");

      const irisBuilt = buildEntryNodes("d", join(root, "iris", "library", "d"));
      expect(irisBuilt.state).toBe("built");
      if (irisBuilt.state !== "built") return;
      const irisBlock = JSON.parse(irisBuilt.files.find((f) => f.path === "blocks/indicator-sec-000-01.jsonld")!.content);
      expect(irisBlock["@type"]).toEqual(["cat-harness:Block"]);
      expect(irisBlock["@context"][1].dak).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("non-entry directories inside a library are skipped", () => {
  test("libraryEntriesIn drops dotfiles and directories declared for another graph typology", () => {
    const root = mkdtempSync(join(tmpdir(), "lib-entries-"));
    try {
      const lib = join(root, "inst", "library");
      mkdirSync(join(lib, "doc-1"), { recursive: true });
      mkdirSync(join(lib, "processes"), { recursive: true });
      mkdirSync(join(lib, "skills"), { recursive: true });
      mkdirSync(join(lib, ".hidden"), { recursive: true });
      writeDeclaration(join(root, "inst"), {
        name: "inst",
        directories: [
          { id: "library", path: "library/", graphTypologies: ["library"] },
          { id: "lib-processes", path: "library/processes/", graphTypologies: ["processes"] },
          { id: "lib-skills", path: "library/skills/", graphTypologies: ["skills"] },
        ],
      });
      expect(libraryEntriesIn(lib).map((e) => e.slug)).toEqual(["doc-1"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("tables transcribed from a paged entry's pages are blocks (who-iris#224)", () => {
  // who-iris transcribes a PDF's printed tables into `tabular.csvw.json`
  // BESIDE `structure.json`, one draft narrative per table per language at
  // `tables[i]["fac:narrative"]`. The paged rung never read that file, so
  // those tables had no block: 1464 drafts the narrative queue offered were
  // absent from the graph and the library viewer.
  const narrative = [{ text: "What the table lists.", lang: "en", state: "draft", drafted_by: { kind: "agent", id: "a" }, drafted_at: "2026-11-11" }];
  const tables = [
    // Page 3 — on the boundary of both sections, so it goes to the first.
    { url: "tables/table-1.csv", tableSchema: { columns: [{ titles: "Component" }, { titles: "Purpose" }] }, "fac:label": "Table 1", "fac:caption": "Table 1. Components", "fac:pages": [4, 3], "fac:narrative": narrative },
    // Page 5 — inside the second section only; no label, no narrative.
    { url: "tables/table-2.csv", tableSchema: { columns: [] }, "fac:pages": [5] },
    // No page: placed under no section, and still not dropped.
    { url: "tables/table-3.csv", tableSchema: { columns: [] } },
  ];
  let out: Array<{ path: string; content: string }>;
  const read = (p: string) => JSON.parse(out.find((f) => f.path === p)!.content) as Record<string, unknown>;
  beforeAll(() => {
    out = buildDocumentNodes("0110001v3", structure, candidates, () => true, undefined, undefined, undefined, undefined, undefined, undefined, tables);
  });

  test("each transcribed table is a table block carrying its narrative", () => {
    const n = read("blocks/table-001.jsonld");
    expect(n.kind).toBe("table");
    expect(n["@type"]).toContain("doco:Table");
    expect(n.label).toBe("Table 1");
    expect(n.title).toBe("Table 1. Components");
    expect(n.file).toBe("../tables/table-1.csv");
    expect(n.headers).toEqual(["Component", "Purpose"]);
    expect([n.pageStart, n.pageEnd]).toEqual([3, 4]);
    expect(n.narrative).toEqual(narrative);
    expect(n.provenance).toBe("ingested");
  });

  test("a table belongs to the FIRST section holding its first page, as a figure does", () => {
    const contains = (sid: string) => (read(`sections/${sectionKey(sid)}.jsonld`).contains as string[]) ?? [];
    expect(read("blocks/table-001.jsonld").derivedFrom).toBe(`library/0110001v3/sections/${sectionKey("sec-000-1-introduction")}`);
    expect(contains("sec-000-1-introduction")).toContain("library/0110001v3/blocks/table-001");
    expect(contains("sec-001-2-the-formula")).not.toContain("library/0110001v3/blocks/table-001");
    expect(contains("sec-001-2-the-formula")).toContain("library/0110001v3/blocks/table-002");
  });

  test("a table with no label is named by its block id, and one with no narrative carries none", () => {
    const n = read("blocks/table-002.jsonld");
    expect(n.label).toBe("table-002");
    expect("narrative" in n).toBe(false);
    expect("headers" in n).toBe(false);
  });

  test("a table no section holds hangs off the manifest rather than being dropped", () => {
    expect(read("blocks/table-003.jsonld").derivedFrom).toBe("library/0110001v3/manifest");
    expect(read("manifest.jsonld").contains).toContain("library/0110001v3/blocks/table-003");
  });

  test("with no transcribed tables nothing changes: no table block is written", () => {
    const plain = buildDocumentNodes("0110001v3", structure, candidates, () => true);
    expect(plain.some((f) => f.path.startsWith("blocks/table-"))).toBe(false);
  });

  test("the entry path reads tabular.csvw.json beside structure.json, and stays paged", () => {
    const dir = mkdtempSync(join(DIR, "paged-tables-"));
    writeFileSync(join(dir, "structure.json"), asPdfStructureFile({ doc_id: "d", sections: [], metadata: { title: "A report" } }));
    writeFileSync(join(dir, "tabular.csvw.json"), JSON.stringify({ tables: [tables[0]] }));
    const r = buildEntryNodes("d", dir);
    expect(r.state).toBe("built");
    if (r.state !== "built") return;
    expect(r.rung).toBe("paged");
    const block = r.files.find((f) => f.path === "blocks/table-001.jsonld");
    expect(block).toBeDefined();
    expect(JSON.parse(block!.content).narrative).toEqual(narrative);
    rmSync(dir, { recursive: true, force: true });
  });
});

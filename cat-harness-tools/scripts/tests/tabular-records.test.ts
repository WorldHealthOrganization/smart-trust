/**
 * CSV and spreadsheets — bean `p67i`, and the v1 writer's retirement — bean `urat`.
 *
 * `tabular-records.py` no longer WRITES `folio-tabular-records/v1` (5c-ii,
 * option 1): CSV and xlsx are read as CSVW through the `tabular-csvw` slot.
 * What stays is what a folio's COMMITTED v1 records rely on: the schema still
 * reads them, the gate still judges them, and their keys are still declared.
 * So those tests run against a v1 record exactly as the writer last wrote one
 * (`COMMITTED_V1`), not against a writer that no longer runs.
 *
 * The routing tests build an xlsx with `zipfile` at test time, mimicking what
 * a real writer emits — including the package-root-absolute relationship
 * Target that broke the first draft of the reader.
 *
 @module scripts/tests/tabular-records
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { TABULAR_RECORDS_SCHEMA_ID, TabularRecordsSchema, isTabularMimetype } from "../../schemas/library/tabular-records.ts";
import { checkAll, checkEntry } from "../check-l1-complete.ts";
import { planFor, sniffMimetype, tabularDelimiter } from "../ingest-document.ts";

// The harness: the Python scripts it spawns stayed there; this test moved up in 70lx B2b.
const ROOT = HARNESS_ROOT;
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "tab-"));
  made.push(d);
  return d;
}

/**
 * A two-sheet xlsx, shared strings and all.
 *
 * `Target="/xl/worksheets/sheet1.xml"` is PACKAGE-ROOT-ABSOLUTE, which is what
 * a real writer emits for worksheets while writing `styles.xml` relative in
 * the same file. The first reader prefixed `xl/` unconditionally, producing
 * `xl/xl/worksheets/sheet1.xml`: every read raised, every shape came back
 * `undetermined`, every header list came back empty — and the sheet NAMES were
 * still right, which is what made the output look plausible.
 */
function xlsx(dir: string, name = "book.xlsx"): string {
  const py = [
    "import zipfile, sys",
    "p = sys.argv[1]",
    "z = zipfile.ZipFile(p, 'w')",
    "z.writestr('[Content_Types].xml', '<Types/>')",
    "M='http://schemas.openxmlformats.org/spreadsheetml/2006/main'",
    "R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'",
    "z.writestr('xl/workbook.xml', f'<workbook xmlns=\"{M}\" xmlns:r=\"{R}\"><sheets>'",
    "  f'<sheet name=\"Cases\" sheetId=\"1\" r:id=\"rId1\"/>'",
    "  f'<sheet name=\"Deaths\" sheetId=\"2\" r:id=\"rId2\"/></sheets></workbook>')",
    "z.writestr('xl/_rels/workbook.xml.rels', '<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">'",
    "  '<Relationship Id=\"rId1\" Target=\"/xl/worksheets/sheet1.xml\"/>'",
    "  '<Relationship Id=\"rId2\" Target=\"/xl/worksheets/sheet2.xml\"/>'",
    "  '<Relationship Id=\"rId3\" Target=\"styles.xml\"/></Relationships>')",
    "z.writestr('xl/sharedStrings.xml', f'<sst xmlns=\"{M}\">'",
    "  '<si><t>country</t></si><si><t>year</t></si><si><t>cases</t></si><si><t>deaths</t></si></sst>')",
    "def sheet(dim, idx):",
    "    cells = ''.join(f'<c r=\"{c}1\" t=\"s\"><v>{i}</v></c>' for c, i in zip('ABC', idx))",
    "    return f'<worksheet xmlns=\"{M}\"><dimension ref=\"{dim}\"/><sheetData><row r=\"1\">{cells}</row></sheetData></worksheet>'",
    "z.writestr('xl/worksheets/sheet1.xml', sheet('A1:C3', [0,1,2]))",
    "z.writestr('xl/worksheets/sheet2.xml', sheet('A1:C2', [0,1,3]))",
    "z.close()",
  ].join("\n");
  const p = join(dir, name);
  const r = Bun.spawnSync(["python3", "-c", py, p]);
  if (r.exitCode !== 0) throw new Error(new TextDecoder().decode(r.stderr));
  return p;
}

function csv(dir: string, body: string, name = "data.csv"): string {
  const p = join(dir, name);
  writeFileSync(p, body);
  return p;
}

/**
 * A v1 record as `tabular-records.py` last wrote it, for `a,b\n1,2\n3,4\n`
 * (captured 2026-10-22 from tools 00527df, the commit before retirement).
 * Folios hold records like this; the schema must keep reading them.
 */
const COMMITTED_V1 = {
  "@context": CONTENT_CONTEXT_URL,
  $schema: "folio-tabular-records/v1",
  "@id": "library/data/tabular",
  source: {
    file: "data.csv",
    sha256: "b9485148546419a0f6a85e8d708c923557c15d7f3c7d078ef1fa7f7c0f57d5a5",
    bytes: 12,
    mtime: "2026-10-22T15:38:01Z",
    mimetype_sniffed: null,
    mimetype_source: "unrecognised",
  },
  format: "csv",
  sheets: [
    { name: "data", headers: ["a", "b"], rows: 3, columns: 2, shape_source: "counted", delimiter: ",", delimiter_source: "sniffed" },
  ],
  n_sheets: 1,
  header_vocabulary: ["a", "b"],
  narrative: { text: null, state: "not-authored" },
};

/** The committed record, parsed by today's schema. */
function committed() {
  return TabularRecordsSchema.safeParse(structuredClone(COMMITTED_V1));
}

/** The committed record written into a library at `<out>/data/tabular.jsonld`. */
function commitInto(out: string): void {
  mkdirSync(join(out, "data"), { recursive: true });
  writeFileSync(join(out, "data", "tabular.jsonld"), JSON.stringify(COMMITTED_V1, null, 2) + "\n");
}

describe("the v1 writer is retired", () => {
  test("run as a command it refuses, writes nothing, and names the CSVW rung", () => {
    const d = tmp();
    const out = join(d, "lib");
    const r = Bun.spawnSync(["python3", join(TOOLS_ROOT, "scripts/tabular-records.py"), "-o", out, csv(d, "a,b\n1,2\n3,4\n")], { cwd: ROOT });
    expect(r.exitCode).toBe(1);
    expect(new TextDecoder().decode(r.stderr)).toContain("tabular-csvw.ts");
    expect(existsSync(out)).toBe(false);
  });
});

describe("the narrative slot of a committed record", () => {
  test("the schema refuses a record that says two things at once", () => {
    const r = committed();
    expect(r.success).toBe(true);
    if (!r.success) return;
    // Each as the one-entry list a written narrative is stored in (e1lo).
    const with_ = (n: object) => TabularRecordsSchema.safeParse({ ...r.data, narrative: [{ ...n, lang: "en" }] }).success;
    // Text without a state that admits it, and a state that claims text there
    // is none of, are both refused (bean `ju0u`).
    expect(with_({ text: "a summary", state: "not-authored" })).toBe(false);
    expect(with_({ text: null, state: "draft" })).toBe(false);
    // And an agent cannot confirm its own draft.
    expect(
      with_({
        text: "a summary",
        state: "confirmed",
        drafted_by: { kind: "agent", id: "claude-code", model: "claude-opus-5" },
        confirmed_by: { kind: "agent", id: "claude-code", model: "claude-opus-5" },
      }),
    ).toBe(false);
    expect(
      with_({
        text: "a summary",
        state: "confirmed",
        drafted_by: { kind: "agent", id: "claude-code", model: "claude-opus-5" },
        confirmed_by: { kind: "human", id: "litlfred" },
      }),
    ).toBe(true);
  });
});

describe("routing: a spreadsheet is not an archive", () => {
  test("an .xlsx takes the TABULAR rung, though its magic bytes say zip", () => {
    // The whole point. An OOXML package IS a zip, so `twqe`'s routing sent it
    // to `archive-contents.py` and listed it as a bag of XML parts.
    const d = tmp();
    const book = xlsx(d);
    expect(sniffMimetype(book)).toBe(XLSX);
    expect(planFor(book, undefined, "library").rung).toBe("tabular");
  });

  test("a plain zip still takes the archive rung", () => {
    const d = tmp();
    mkdirSync(join(d, "src"), { recursive: true });
    writeFileSync(join(d, "src", "a.txt"), "x");
    Bun.spawnSync(["sh", "-c", "cd src && zip -qr ../plain.zip ."], { cwd: d });
    expect(planFor(join(d, "plain.zip"), undefined, "library").rung).toBe("archive");
  });

  test("a CSV takes the tabular rung on CONTENT, not on its name", () => {
    const d = tmp();
    // Named `.dat`, so nothing but the row shape can route it.
    const f = csv(d, "a,b,c\n1,2,3\n4,5,6\n", "mystery.dat");
    expect(sniffMimetype(f)).toBeNull();
    expect(planFor(f, undefined, "library").rung).toBe("tabular");
  });

  test("prose named .csv is NOT routed as tabular", () => {
    const d = tmp();
    const f = csv(d, "This is a paragraph of prose.\nIt has two lines and no columns.\n", "notdata.csv");
    expect(tabularDelimiter(f)).toBeNull();
    expect(planFor(f, undefined, "library").rung).not.toBe("tabular");
  });

  test("a single-column file is not a table", () => {
    const d = tmp();
    // Indistinguishable from a list of lines; claiming it would file a text
    // file as a dataset.
    expect(tabularDelimiter(csv(d, "alpha\nbravo\ncharlie\n", "one.csv"))).toBeNull();
  });

  test("a RAGGED file is refused rather than split anyway", () => {
    const d = tmp();
    expect(tabularDelimiter(csv(d, "a,b,c\n1,2\n3,4,5,6\n", "ragged.csv"))).toBeNull();
  });

  test("isTabularMimetype refuses everything else", () => {
    for (const m of ["application/zip", "application/pdf", null, "", undefined]) {
      expect(isTabularMimetype(m)).toBe(false);
    }
    expect(isTabularMimetype(XLSX)).toBe(true);
  });
});

/** A library entry whose `source` sniffed as the given mimetype. */
function entryFor(mimetype: string | null, tabular?: unknown): string {
  const root = tmp();
  const dir = join(root, "doc");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "structure.json"),
    JSON.stringify({ _schema: "pdf-structure/v1", sections: [1], source: { mimetype_sniffed: mimetype } }),
  );
  if (tabular !== undefined) {
    writeFileSync(join(dir, "tabular.jsonld"), typeof tabular === "string" ? tabular : JSON.stringify(tabular));
  }
  return dir;
}

const tabState = (d: string) => checkEntry(d).requirements.find((r) => r.name === "tabular-records");

describe("the gate fires on a workbook with no record", () => {
  test("a workbook entry with no tabular record is UNMET", () => {
    const r = tabState(entryFor(XLSX));
    expect(r?.state).toBe("unmet");
    expect(r?.detail).toContain("no tabular record");
  });

  test("a valid record is MET and names the narrative state", () => {
    const rec = committed();
    expect(rec.success).toBe(true);
    if (!rec.success) return;
    const r = tabState(entryFor(XLSX, rec.data));
    expect(r?.state).toBe("met");
    expect(r?.detail).toContain("narrative not-authored");
  });

  test("a record that is not the declared schema is UNMET", () => {
    const r = tabState(entryFor(XLSX, { $schema: "other/v1" }));
    expect(r?.state).toBe("unmet");
    expect(r?.detail).toContain(TABULAR_RECORDS_SCHEMA_ID);
  });

  test("a CSV entry is checked on its merits despite an unrecognised mimetype", () => {
    // A CSV has no magic bytes, so requiring a record of every unrecognised
    // entry would demand a dataset of every text file. Present means checked.
    const rec = committed();
    expect(rec.success).toBe(true);
    if (!rec.success) return;
    expect(tabState(entryFor(null, rec.data))?.state).toBe("met");
    expect(tabState(entryFor(null, { $schema: "other/v1" }))?.state).toBe("unmet");
  });

  test("a PDF entry is MET and SAYS SO — a determined zero", () => {
    expect(tabState(entryFor("application/pdf"))?.detail).toBe("not tabular (application/pdf)");
  });

  test("a PDF with tables transcribed from its pages is MET, and still NOT a dataset", () => {
    // Transcribed tables in a paged entry: its printed tables as CSVW under `tables/`.
    // The entry is a PDF that holds tables; counting it as tabular would put
    // every such report beside CODATA in the corpus test below.
    const dir = entryFor("application/pdf");
    writeFileSync(
      join(dir, "tabular.csvw.json"),
      JSON.stringify({
        $schema: "folio-tabular-csvw/v1",
        doc_id: "doc",
        tables: [],
        source: { file: "doc.pdf", note: "tables transcribed from the PDF pages" },
        narrative: { text: null, state: "not-authored" },
      }),
    );
    const r = tabState(dir);
    expect(r?.state).toBe("met");
    expect(r?.detail).toBe("not tabular (application/pdf); 0 table(s) transcribed from its pages as CSVW");
  });
});

describe("the real corpus", () => {
  test("every entry says whether it is tabular; the one dataset is CODATA 2022", () => {
    // Zero datasets until 2026-09-30, when CODATA 2022 became the first
    // tabular entry (bean uyp8). Pinned by SLUG rather than by count, so a
    // second dataset is a deliberate edit here, not a silent pass.
    // `undefined` means no `library` graph was declared, which is NOT an
    // empty corpus — a test computed over it has checked nothing.
    const reports = checkAll(ROOT);
    expect(reports, "no `library` declared under ROOT — this test would be vacuous").toBeDefined();
    if (reports === undefined) return;
    expect(reports.length).toBeGreaterThan(0);
    const tabular: string[] = [];
    for (const r of reports) {
      const q = r.requirements.find((x) => x.name === "tabular-records");
      expect(`${r.slug}: ${q?.state}`).toBe(`${r.slug}: met`);
      if (!q?.detail.includes("not tabular")) tabular.push(r.slug);
    }
    expect(tabular).toEqual(["codata-2022"]);
  });
});

// ── The record is real JSON-LD — bean `yh6u` ───────────────────────────────
//
// It was named `.jsonld` with an `@id` and no `@context`, so a JSON-LD
// processor dropped every key. The two assertions that matter: the writer
// emits the PUBLISHED context, and every key it writes is a declared term —
// checked by the same function the CI gate runs, over the arm's real output.

import { CONTENT_CONTEXT_URL } from "../../schemas/kg/jsonld.ts";
import { checkDeclaredKeys } from "../check-content-keys.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";

describe("a committed tabular record is JSON-LD a processor keeps whole", () => {
  test("every key a committed record carries is a declared term — nested data rides in `@json`", () => {
    const d = tmp();
    const out = join(d, "lib");
    commitInto(out);
    const k = checkDeclaredKeys(out);
    expect(k.documents).toBe(1); // not vacuous: the record was read as content
    expect(k.undeclared).toEqual([]);
  });

  test("the Python constant IS the TypeScript one — one URL, not two", () => {
    const py = readFileSync(join(TOOLS_ROOT, "scripts", "_content_context.py"), "utf-8");
    expect(/CONTENT_CONTEXT_URL = "([^"]+)"/.exec(py)?.[1]).toBe(CONTENT_CONTEXT_URL);
  });

  test("a record written before the arm emitted `@context` still validates", () => {
    // Folio repositories hold those. The field is optional for exactly that.
    const raw: Record<string, unknown> = structuredClone(COMMITTED_V1);
    delete raw["@context"];
    expect(TabularRecordsSchema.safeParse(raw).success).toBe(true);
    expect(TabularRecordsSchema.safeParse({ ...raw, "@context": "https://elsewhere.example/ctx" }).success).toBe(false);
  });
});

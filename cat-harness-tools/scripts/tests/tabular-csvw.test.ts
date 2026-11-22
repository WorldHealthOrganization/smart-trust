/**
 * CSVW as the tabular model, annotated — and QA that catches an absent tool.
 *
 * Bean `eief`. The owner decided CSVW on `ulqj` ("not new/custom thing") and
 * then constrained the build: *"no tooling needed, stub out, make QA to catch
 * absence."* So the property under test is not that extraction works — nothing
 * extracts — but that **a missing tool cannot be mistaken for a working one**.
 *
 * @module scripts/tests/tabular-csvw.test
 */
import { describe, expect, test } from "bun:test";

import {
  CsvwTableSchema,
  TabularCsvwTablesSchema,
  CSVW_CONTEXT,
  CSVW_KEYS,
  TABULAR_CSVW_FILENAME,
  TABULAR_CSVW_SCHEMA_ID,
  toCsvw,
  stubsIn,
} from "../../schemas/library/tabular-csvw.ts";
import { CONTENT_CONTEXT } from "../../schemas/kg/jsonld.ts";
import { stubFindings, stubbedTools } from "../check-tabular-stubs.ts";
import { tools } from "../../schemas/tools/harness-tools.ts";

const COLUMN = {
  name: "country",
  titles: "country",
  datatype: "string",
  datatypeSource: "measured" as const,
};
const ANCHOR = { sheet: "Sheet1", cell: "B7", row: 7, column: 2 };
const EXTENT = { rows: 8, columns: 6, source: "measured" as const };

const table = (over: Record<string, unknown> = {}) => ({
  url: "who-measles-coverage.csv",
  tableSchema: { columns: [COLUMN] },
  "fac:anchor": ANCHOR,
  "fac:headerRow": 7,
  "fac:extent": EXTENT,
  ...over,
});

describe("CSVW is annotated, never replaced", () => {
  test("a CSVW reader is handed a real CSVW document — context and all", () => {
    // Bean `792y`. The helper this replaced stripped our keys and called the
    // rest CSVW, but never added the context, so a CSVW parser would have
    // rejected every document it produced. The context is what makes it CSVW.
    const doc = TabularCsvwTablesSchema.parse({ $schema: TABULAR_CSVW_SCHEMA_ID, doc_id: "d", tables: [table()] });
    const csvw = toCsvw(doc);
    expect(csvw["@context"]).toBe(CSVW_CONTEXT);
    expect(CSVW_CONTEXT).toBe("http://www.w3.org/ns/csvw");
    const tables = csvw.tables as { tableSchema: { columns: unknown[] } }[];
    expect(tables).toHaveLength(1);
    expect(tables[0]!.tableSchema.columns).toHaveLength(1);
  });

  test("…and it carries NO key of ours, at ANY level", () => {
    // `csvwOnly` stripped `fac:` keys at the table level and left
    // `datatypeSource` on every column. So the check walks the whole tree.
    const doc = TabularCsvwTablesSchema.parse({
      $schema: TABULAR_CSVW_SCHEMA_ID,
      doc_id: "d",
      tables: [table(), table({ tableSchema: { columns: [] }, "fac:stub": { tool: "t", reason: "r", since: "2026-09-23" } })],
    });
    const seen: string[] = [];
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) return void o.forEach(walk);
      if (!o || typeof o !== "object") return;
      for (const [k, v] of Object.entries(o)) {
        seen.push(k);
        walk(v);
      }
    };
    walk(toCsvw(doc));
    expect(seen.length).toBeGreaterThan(0); // not vacuous
    expect(seen.filter((k) => !CSVW_KEYS.has(k))).toEqual([]);
    expect(seen).not.toContain("datatypeSource");
    expect(seen).not.toContain("$schema");
  });

  test("the record is plain JSON — its filename does not claim JSON-LD", () => {
    // A `.jsonld` name invites a processor to read `fac:anchor` as a compact
    // IRI in a URI scheme called `fac`. In a `.json` file it is only a name.
    expect(TABULAR_CSVW_FILENAME).toBe("tabular.csvw.json");
    expect(TABULAR_CSVW_FILENAME.endsWith(".jsonld")).toBe(false);
  });

  test("`csvw:` is in the published @context, beside the other eight", () => {
    // Adopting a vocabulary this graph does not declare would leave every
    // `csvw:` term unresolvable — a model in name only.
    expect(CONTENT_CONTEXT.csvw).toBe("http://www.w3.org/ns/csvw#");
    for (const p of ["doco", "deo", "cito", "oa", "prov", "skos", "dcterms", "fhir"]) {
      expect(CONTENT_CONTEXT).toHaveProperty(p);
    }
  });

  test("only THREE `fac:` terms extend it — the ones CSVW cannot express", () => {
    // Location on sheet, and nothing else. A fourth term is the moment to ask
    // whether CSVW really cannot say it; usually it can.
    const ours = Object.keys(CsvwTableSchema.parse(table())).filter((k) => k.startsWith("fac:"));
    expect(ours.sort()).toEqual(["fac:anchor", "fac:extent", "fac:headerRow"]);
  });
});

describe('"as best as can" is three states, never two', () => {
  test("an undetermined datatype must be CSVW `any`, never a guess", () => {
    // A column of `1, 2, 3, N/A` is not an integer column. `integer` with a
    // silent coercion is indistinguishable from a correct reading.
    const bad = table({ tableSchema: { columns: [{ ...COLUMN, datatypeSource: "undetermined" }] } });
    expect(CsvwTableSchema.safeParse(bad).success).toBe(false);
    const ok = table({
      tableSchema: { columns: [{ ...COLUMN, datatype: "any", datatypeSource: "undetermined" }] },
    });
    expect(CsvwTableSchema.safeParse(ok).success).toBe(true);
  });

  test("a HALF-KNOWN extent is refused — it reads as a measurement", () => {
    const half = table({ "fac:extent": { rows: 8, columns: null, source: "measured" } });
    expect(CsvwTableSchema.safeParse(half).success).toBe(false);
    const unknown = table({ "fac:extent": { rows: null, columns: null, source: "undetermined" } });
    expect(CsvwTableSchema.safeParse(unknown).success).toBe(true);
  });

  test("a CSV's `sheet: null` is DETERMINED, not missing", () => {
    // The distinction that matters: a CSV genuinely has no sheet, and writing
    // "Sheet1" would invent one. An undetermined extent is the opposite — we
    // looked and could not tell.
    const csv = table({ "fac:anchor": { sheet: null, cell: null, row: 1, column: 1 } });
    expect(CsvwTableSchema.safeParse(csv).success).toBe(true);
  });
});

describe("a stub cannot be mistaken for a result", () => {
  const stub = { tool: "tabular-xlsx", reason: "no XLSX reader implemented", since: "2026-09-20" };

  test("a HALF-STUB is refused by the schema", () => {
    // `fac:stub` alongside real columns: bean `6xaz`'s shape, where sheet
    // names were right and every header list empty, so the output read as a
    // workbook that simply had no headers.
    expect(CsvwTableSchema.safeParse(table({ "fac:stub": stub })).success).toBe(false);
    const honest = table({ tableSchema: { columns: [] }, "fac:stub": stub });
    expect(CsvwTableSchema.safeParse(honest).success).toBe(true);
  });

  test("a stub needs a DATE — undated cannot be told from abandoned", () => {
    const undated = { ...stub, since: "soon" };
    expect(
      CsvwTableSchema.safeParse(table({ tableSchema: { columns: [] }, "fac:stub": undated })).success,
    ).toBe(false);
  });

  test("`stubsIn` finds them", () => {
    const doc = TabularCsvwTablesSchema.parse({
      $schema: "folio-tabular-csvw/v1",
      doc_id: "x",
      tables: [table({ tableSchema: { columns: [] }, "fac:stub": stub }), table()],
    });
    expect(stubsIn(doc).map((s) => s.tool)).toEqual(["tabular-xlsx"]);
  });
});

describe("the QA catches ABSENCE — and can actually fail", () => {
  const stub = { tool: "tabular-xlsx", reason: "no XLSX reader implemented", since: "2026-09-20" };
  const doc = (over: Record<string, unknown> = {}) =>
    JSON.stringify({
      $schema: "folio-tabular-csvw/v1",
      doc_id: "x",
      tables: [{ ...table({ tableSchema: { columns: [] }, "fac:stub": stub }), ...over }],
      // A committed record, as the ingest runner writes it (bean `urat`).
      source: { file: "x.xlsx" },
      narrative: { text: null, state: "not-authored" },
    });

  test("an outstanding stub is REPORTED, and does not block", () => {
    // The honest state of an unbuilt tool. Reported every run — never silent —
    // but it is not a failure, because the tool was always going to be absent.
    const f = stubFindings(["/e"], () => doc(), () => true);
    expect(f.map((x) => x.severity)).toEqual(["stub"]);
    expect(f[0].detail).toContain("tabular-xlsx");
    expect(f[0].detail).toContain("since 2026-09-20");
  });

  test("an EXPIRED stub blocks — the tool exists and `fac:stub` is still there", () => {
    // THE RATCHET. This session fixed the same defect four times and then
    // introduced a fifth — a probe that looked for `transcript.json` when the
    // arm writes `transcript/`, so it could never have fired. A declared
    // exception must carry something a test can re-derive.
    const f = stubFindings(["/e"], () => doc(), () => false);
    expect(f.map((x) => x.severity)).toEqual(["expired"]);
    expect(f[0].detail).toContain("must go");
  });

  test("a record that will not validate is UNREADABLE, never skipped", () => {
    // A skipped record reports no finding, which is a clean sweep over a file
    // that could not be read.
    const f = stubFindings(["/e"], () => '{"$schema":"folio-tabular-csvw/v1","doc_id":"x"}', () => true);
    expect(f.map((x) => x.severity)).toEqual(["unreadable"]);
  });

  test("an entry with no tabular record yields nothing — not a finding", () => {
    expect(stubFindings(["/e"], () => undefined, () => true)).toEqual([]);
  });

  test("the stubbed set is READ from the tool declarations, not restated", () => {
    // The fifth defect above happened because a probe was written from memory
    // instead of from the thing it probed. `install: { none: true }` is the
    // only honest source for "this tool cannot run".
    const declared = stubbedTools(tools());
    // Which tools are stubbed is the DECLARATIONS' answer, so it is not
    // restated here either: `tabular-csv` and `tabular-xlsx` were stubs until
    // their extractors landed in folio-assistant-core (bean cat-tools-1wre),
    // and a test pinning them as stubs would have had to be edited in step.
    // And a tool that CAN run must be outside the set. Without this the
    // predicate could return true for everything and still look right — which
    // it did, until a mutation said so: every stub would then read as
    // outstanding and no stub could ever expire.
    const runnable = tools().filter((t) => !declared.has(t.id));
    expect(runnable.length).toBeGreaterThan(0);
    expect(declared.size).toBeLessThan(tools().length);
  });

  test("a working tool with nothing to install is NOT a stub (cat-tools-1wre)", () => {
    // `install: { none: true }` is also how a runnable, install-free tool is
    // declared (`dublin-core-render`). Only "nothing to install AND only a
    // person can invoke it" is a stub.
    const set = stubbedTools([
      { id: "unbuilt", install: { none: true }, invoke: { manual: true } },
      { id: "install-free", install: { none: true }, invoke: { shell: "bun run x.ts" } },
    ]);
    expect([...set]).toEqual(["unbuilt"]);
  });

  test("a declared stub names the skill it would satisfy", () => {
    // A Tool that satisfies nothing is a mechanism with no stated capability.
    // Checked over whatever is stubbed now, which may be nothing.
    const all = tools();
    const stubbed = stubbedTools(all);
    for (const t of all.filter((x) => stubbed.has(x.id))) {
      expect(t.satisfies?.length ?? 0, t.id).toBeGreaterThan(0);
    }
  });
});

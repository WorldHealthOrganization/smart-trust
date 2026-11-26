/**
 * The CSVW tabular rung (bean `urat`, owner rulings of 2026-10-20): ingest
 * routes delimited text and xlsx to `tabular-csvw.ts`, which reads them
 * through the `tabular-csvw` slot and writes `tabular.csvw.json` carrying the
 * entry's `source` and `narrative`; `check-l1-complete` accepts that record.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ContributionRegistry } from "../../schemas/content/contributions.ts";
import { TABULAR_CSVW_FILENAME, type TabularCsvwTables } from "../../schemas/library/tabular-csvw.ts";
import { UnregisteredPipelinePluginError, usePipelinePluginRegistry } from "../../pipeline/pipeline-plugins.ts";
import { checkEntry, entryKind } from "../check-l1-complete.ts";
import { planFor, tableNotTaken } from "../ingest-document.ts";
import { csvwRecord, entrySlug, techMeta } from "../tabular-csvw.ts";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ODS = "application/vnd.oasis.opendocument.spreadsheet";
const made: string[] = [];
afterEach(() => {
  usePipelinePluginRegistry(undefined);
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "csvw-rung-"));
  made.push(d);
  return d;
};

const table = (docId: string, url: string): TabularCsvwTables => ({
  $schema: "folio-tabular-csvw/v1",
  doc_id: docId,
  tables: [
    {
      url,
      tableSchema: { columns: [{ name: "a", titles: "a", datatype: "integer", datatypeSource: "measured" }] },
      "fac:anchor": null,
      "fac:headerRow": 1,
      "fac:extent": { rows: 2, columns: 1, source: "measured" },
    },
  ],
});

/** A registry whose `tabular-csvw` slot answers with `answer`. */
function filled(answer: (url: string, docId: string) => TabularCsvwTables | null): void {
  const reg = new ContributionRegistry();
  reg.register({
    name: "fixture-core",
    pipelinePlugins: [{ kind: "tabular-csvw", implementation: { extract: (_b: Buffer, o: { url: string; docId: string }) => answer(o.url, o.docId) } }],
  });
  usePipelinePluginRegistry(reg);
}

describe("routing", () => {
  test("delimited text, xlsx and ODS all go to the CSVW rung; ODS says it will SKIP", () => {
    const d = tmp();
    const csv = join(d, "cases.csv");
    writeFileSync(csv, "a,b\n1,2\n3,4\n");
    const argv = (m: string | null) => planFor(csv, undefined, join(d, "lib"), m).steps[0]!.join(" ");
    expect(argv(null)).toContain("tabular-csvw.ts");
    expect(argv(XLSX)).toContain("tabular-csvw.ts");
    // 5c-ii option 1: the v1 writer is retired, and it never wrote ODS anyway.
    expect(argv(ODS)).toContain("tabular-csvw.ts");
    expect(argv(ODS)).not.toContain("tabular-records.py");
    const ods = planFor(csv, undefined, join(d, "lib"), ODS);
    expect(ods.why).toContain("no CSVW reader for ODS");
  });

  test("the step's 'not a table I take' is an answer; its other failures are not", () => {
    const step = ["bun", "run", "/x/scripts/tabular-csvw.ts", "-o", "lib", "f.ods"];
    expect(tableNotTaken(step, 2)).toBe(true);
    // Exit 1 is usage, an unfilled slot or a throwing extractor: a failure.
    expect(tableNotTaken(step, 1)).toBe(false);
    // Exit 2 from any OTHER step proves nothing (Python gives 2 for a script
    // it cannot open).
    expect(tableNotTaken(["python3", "/x/scripts/pdf-pages.py", "-o", "lib", "f.pdf"], 2)).toBe(false);
  });
});

describe("the runner", () => {
  test("the record carries the entry's source and an un-authored narrative", () => {
    const d = tmp();
    const f = join(d, "Cases 2024.csv");
    writeFileSync(f, "a\n1\n2\n");
    filled((url, docId) => table(docId, url));
    const source = techMeta(f);
    const slug = entrySlug(f);
    expect(slug).toBe("cases-2024");
    const r = csvwRecord(f, source, slug);
    expect(r?.source?.sha256).toBe(source.sha256);
    expect(r?.narrative).toEqual({ text: null, state: "not-authored" });
  });

  test("null from the reader is null, not an empty record", () => {
    const d = tmp();
    const f = join(d, "prose.txt");
    writeFileSync(f, "just prose\n");
    filled(() => null);
    expect(csvwRecord(f, techMeta(f), "prose")).toBeNull();
  });

  test("with nothing filling the slot it refuses, never falling back to v1", () => {
    const d = tmp();
    const f = join(d, "a.csv");
    writeFileSync(f, "a,b\n1,2\n");
    usePipelinePluginRegistry(new ContributionRegistry());
    expect(() => csvwRecord(f, techMeta(f), "a")).toThrow(UnregisteredPipelinePluginError);
  });
});

describe("check-l1-complete accepts the CSVW record", () => {
  const entry = (rec: unknown): string => {
    const dir = join(tmp(), "doc");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, TABULAR_CSVW_FILENAME), JSON.stringify(rec));
    return dir;
  };
  const tab = (dir: string) => checkEntry(dir).requirements.find((r) => r.name === "tabular-records");

  test("with its source, it is MET, and the entry is tabular", () => {
    const dir = entry({ ...table("doc", "doc.xlsx"), source: { file: "doc.xlsx", mimetype_sniffed: XLSX }, narrative: { text: null, state: "not-authored" } });
    expect(tab(dir)?.state).toBe("met");
    expect(tab(dir)?.detail).toContain("1 table(s) as CSVW");
    expect(entryKind((f) => existsSync(join(dir, f)))).toBe("tabular");
  });

  test("without a source block it is UNMET, since the entry then has no technical metadata", () => {
    expect(tab(entry(table("doc", "doc.csv")))?.state).toBe("unmet");
  });

  test("a record that is not CSVW is UNMET", () => {
    expect(tab(entry({ $schema: "folio-tabular-csvw/v1", doc_id: "doc" }))?.state).toBe("unmet");
  });
});

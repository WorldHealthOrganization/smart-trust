import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { DAK_DATA_DICTIONARY_SCHEMA, type DakDataDictionaryAnnex } from "../../schemas/dak-annexes";
import { diffDataDictionary, isEmpty, renderMarkdown, termsOf } from "./dak-data-dictionary-diff";

const COLS = [
  { key: "activity id", label: "Activity ID" },
  { key: "data element id", label: "Data element ID" },
  { key: "data element label", label: "Data element label" },
  { key: "data type", label: "Data type" },
];

function annex(sheets: { name: string; columns?: typeof COLS; rows: string[][] }[]): DakDataDictionaryAnnex {
  return {
    $schema: DAK_DATA_DICTIONARY_SCHEMA,
    annexOf: "10665/380303",
    label: "Web Annex A",
    section: "dak#core-data-elements",
    title: "Core data dictionary",
    source: { label: "fixture", sha256: "0".repeat(64) },
    idColumn: "data element id",
    sheets: sheets.map((s) => ({ name: s.name, columns: s.columns ?? COLS, rows: s.rows })),
  };
}

const BEFORE = annex([
  {
    name: "IMMZ.C Client registration",
    rows: [
      ["IMMZ.C4", "IMMZ.C.DE.1", "Unique identifier", "ID"],
      ["IMMZ.C4", "IMMZ.C.DE.2", "Name", "String"],
      ["IMMZ.C4", "IMMZ.C.DE.3", "Sex", "Coding"],
    ],
  },
  { name: "IMMZ.D Administer vaccine", rows: [["IMMZ.D1", "IMMZ.D.DE.1", "Vaccine type", "Coding"]] },
]);

describe("diffDataDictionary", () => {
  test("identicalAnnexesNothingChanged", () => {
    const d = diffDataDictionary(BEFORE, BEFORE);
    expect(isEmpty(d)).toBe(true);
    expect(renderMarkdown(d)).toBe("No data element changed.\n");
  });

  test("addedRemovedChangedKeyedById", () => {
    const after = annex([
      {
        name: "IMMZ.C Client registration",
        rows: [
          ["IMMZ.C4", "IMMZ.C.DE.1", "Unique identifier", "Identifier"],
          ["IMMZ.C4", "IMMZ.C.DE.2", "Name", "String"],
          ["IMMZ.C4", "IMMZ.C.DE.4", "Date of birth", "Date"],
        ],
      },
      { name: "IMMZ.D Administer vaccine", rows: [["IMMZ.D1", "IMMZ.D.DE.1", "Vaccine type", "Coding"]] },
    ]);
    const d = diffDataDictionary(BEFORE, after);
    expect(d.added.map((t) => t.id)).toEqual(["IMMZ.C.DE.4"]);
    expect(d.removed.map((t) => t.id)).toEqual(["IMMZ.C.DE.3"]);
    expect(d.changed).toEqual([
      {
        id: "IMMZ.C.DE.1",
        sheet: "IMMZ.C Client registration",
        label: "Unique identifier",
        cells: [{ column: "data type", before: "ID", after: "Identifier" }],
      },
    ]);
    const md = renderMarkdown(d);
    expect(md).toContain("1 added, 1 removed, 1 changed, 0 moved");
    expect(md).toContain("| IMMZ.C.DE.1 | Unique identifier | data type | ID | Identifier |");
  });

  test("reorderedRowsColumnsNotChanges", () => {
    const swapped = [COLS[1]!, COLS[0]!, COLS[3]!, COLS[2]!];
    const after = annex([
      {
        name: "IMMZ.C Client registration",
        columns: swapped,
        rows: [
          ["IMMZ.C.DE.3", "IMMZ.C4", "Coding", "Sex"],
          ["IMMZ.C.DE.1", "IMMZ.C4", "ID", "Unique identifier"],
          ["IMMZ.C.DE.2", "IMMZ.C4", "String", "Name"],
        ],
      },
      { name: "IMMZ.D Administer vaccine", rows: [["IMMZ.D1", "IMMZ.D.DE.1", "Vaccine type", "Coding"]] },
    ]);
    expect(isEmpty(diffDataDictionary(BEFORE, after))).toBe(true);
  });

  test("sheetMoveIsMoved", () => {
    const after = annex([
      {
        name: "IMMZ.C Client registration",
        rows: [
          ["IMMZ.C4", "IMMZ.C.DE.1", "Unique identifier", "ID"],
          ["IMMZ.C4", "IMMZ.C.DE.2", "Name", "String"],
        ],
      },
      {
        name: "IMMZ.D Administer vaccine",
        rows: [
          ["IMMZ.D1", "IMMZ.D.DE.1", "Vaccine type", "Coding"],
          ["IMMZ.C4", "IMMZ.C.DE.3", "Sex", "Coding"],
        ],
      },
    ]);
    const d = diffDataDictionary(BEFORE, after);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.moved).toEqual([{ id: "IMMZ.C.DE.3", from: "IMMZ.C Client registration", to: "IMMZ.D Administer vaccine" }]);
  });

  test("addedColumnReportedPerSheet", () => {
    const wider = [...COLS, { key: "input option", label: "Input options" }];
    const after = annex([
      {
        name: "IMMZ.C Client registration",
        columns: wider,
        rows: [
          ["IMMZ.C4", "IMMZ.C.DE.1", "Unique identifier", "ID", "N/A"],
          ["IMMZ.C4", "IMMZ.C.DE.2", "Name", "String", "N/A"],
          ["IMMZ.C4", "IMMZ.C.DE.3", "Sex", "Coding", "Male; Female"],
        ],
      },
      { name: "IMMZ.D Administer vaccine", rows: [["IMMZ.D1", "IMMZ.D.DE.1", "Vaccine type", "Coding"]] },
    ]);
    const d = diffDataDictionary(BEFORE, after);
    expect(d.changed).toEqual([]);
    expect(d.columns).toEqual([{ sheet: "IMMZ.C Client registration", added: ["input option"], removed: [] }]);
  });

  test("duplicatedIdRefused", () => {
    const dup = annex([
      { name: "A", rows: [["x", "IMMZ.C.DE.1", "One", "ID"]] },
      { name: "B", rows: [["x", "IMMZ.C.DE.1", "Other", "ID"]] },
    ]);
    expect(() => termsOf(dup)).toThrow(/appears twice/);
  });
});

describe("the CLI", () => {
  const script = resolve(import.meta.dir, "dak-data-dictionary-diff.ts");
  const dir = mkdtempSync(join(tmpdir(), "dd-diff-"));
  const write = (n: string, v: unknown) => {
    const p = join(dir, n);
    writeFileSync(p, JSON.stringify(v));
    return p;
  };
  const run = (...a: string[]) => Bun.spawnSync(["bun", script, ...a]);

  test("cliExitCodes", () => {
    const b = write("before.json", BEFORE);
    const changed = write("after.json", annex([{ name: "IMMZ.C Client registration", rows: [["IMMZ.C4", "IMMZ.C.DE.1", "Unique identifier", "ID"]] }]));
    expect(run(b, b).exitCode).toBe(0);
    const r = run(b, changed);
    expect(r.exitCode).toBe(1);
    expect(r.stdout.toString()).toContain("### Removed");
    expect(run(b, write("bad.json", { not: "an annex" })).exitCode).toBe(2);
  });
});

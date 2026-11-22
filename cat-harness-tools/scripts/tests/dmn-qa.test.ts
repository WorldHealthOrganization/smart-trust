import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { loadDecisionTable } from "../../src/workflow/decision-table";
import { checkFolioStructure, checkTable, folioStructure } from "../../src/workflow/dmn-qa";
import { checkDmn } from "../dmn-check";

/**
 * The DMN table checks (bean `lo3p`): three errors and two warnings, on small
 * tables written here, so nothing depends on a mounted layer.
 */

const dir = mkdtempSync(join(tmpdir(), "dmn-qa-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

interface Col {
  expr: string;
  type?: string;
  values?: string;
}
function dmn(id: string, hit: string, cols: Col[], rules: { when: string[]; then: string; note?: string }[]): string {
  const inputs = cols
    .map(
      (c, i) => `<input id="I${i}"><inputExpression id="IE${i}" typeRef="${c.type ?? "string"}"><text>${c.expr}</text></inputExpression>` +
        (c.values ? `<inputValues id="IV${i}"><text>${c.values}</text></inputValues>` : "") +
        `</input>`,
    )
    .join("");
  const rs = rules
    .map(
      (r, n) =>
        `<rule id="R${n + 1}">${r.note ? `<description>${r.note}</description>` : ""}` +
        r.when.map((w, i) => `<inputEntry id="E${n}_${i}"><text>${w.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text></inputEntry>`).join("") +
        `<outputEntry id="O${n}"><text>${r.then}</text></outputEntry></rule>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="D_${id}" name="${id}" namespace="t">
  <decision id="${id}" name="${id}"><decisionTable id="T_${id}" hitPolicy="${hit}">${inputs}<output id="Out" name="out" typeRef="string"/>${rs}</decisionTable></decision>
</definitions>`;
}

async function table(name: string, xml: string) {
  const p = join(dir, `${name}.dmn`);
  writeFileSync(p, xml);
  return loadDecisionTable(p, name);
}
const checks = (fs: { check: string }[]) => fs.map((f) => f.check);

describe("dmn-table-complete", () => {
  test("a free-text column with no inputValues and no catch-all is incomplete", async () => {
    const t = await table(
      "Open",
      dmn("Open", "UNIQUE", [{ expr: "group" }], [
        { when: ['"a"'], then: '"A"', note: "p.1" },
        { when: ['"b"'], then: '"unknown"' },
      ]),
    );
    const f = checkTable(t).filter((x) => x.check === "dmn-table-complete");
    expect(f).toHaveLength(1);
    expect(f[0]!.severity).toBe("error");
    expect(f[0]!.detail).toContain("declare no inputValues");
  });

  test("declared inputValues close the column", async () => {
    const t = await table(
      "Closed",
      dmn("Closed", "UNIQUE", [{ expr: "s", values: '"yes","no","unknown"' }, { expr: "b", type: "boolean" }], [
        { when: ['"yes"', "true"], then: '"A"', note: "Fig. 2" },
        { when: ['"yes"', "false"], then: '"B"', note: "Fig. 2" },
        { when: ['"no"', "-"], then: '"C"', note: "Fig. 2" },
        { when: ['"unknown"', "-"], then: '"unknown"' },
      ]),
    );
    expect(checkTable(t)).toEqual([]);
  });

  test("a missing combination is named", async () => {
    const t = await table(
      "Gap",
      dmn("Gap", "UNIQUE", [{ expr: "x", type: "boolean" }, { expr: "y", type: "boolean" }], [
        { when: ["true", "-"], then: '"A"', note: "p.2" },
        { when: ["false", "true"], then: '"unknown"' },
      ]),
    );
    const f = checkTable(t).find((x) => x.check === "dmn-table-complete")!;
    expect(f.detail).toContain("{x: false, y: false}");
  });

  test("numeric thresholds are probed on both sides", async () => {
    const t = await table(
      "Num",
      dmn("Num", "FIRST", [{ expr: "n", type: "number" }], [
        { when: ["> 3"], then: '"high"', note: "Table 5" },
        { when: ["< 3"], then: '"unknown"' },
      ]),
    );
    const f = checkTable(t).find((x) => x.check === "dmn-table-complete")!;
    expect(f.detail).toContain("{n: 3}");
  });
});

describe("dmn-rule-shadowed", () => {
  test("under FIRST, a rule covered by earlier rules never fires", async () => {
    const t = await table(
      "Shadow",
      dmn("Shadow", "FIRST", [{ expr: "b", type: "boolean" }], [
        { when: ["-"], then: '"A"', note: "p.3" },
        { when: ["true"], then: '"B"', note: "p.3" },
        { when: ["-"], then: '"unknown"' },
      ]),
    );
    const f = checkTable(t).filter((x) => x.check === "dmn-rule-shadowed");
    expect(f.map((x) => x.rule)).toEqual(["R2"]);
  });

  test("a last all-`-` catch-all under FIRST is not hidden, though earlier rules cover every case", async () => {
    const t = await table(
      "CatchAll",
      dmn("CatchAll", "FIRST", [{ expr: "b", type: "boolean" }], [
        { when: ["true"], then: '"A"', note: "sec-029" },
        { when: ["false"], then: '"B"', note: "sec-029" },
        { when: ["-"], then: '"unknown"', note: "not answered" },
      ]),
    );
    expect(checkTable(t)).toEqual([]);
  });

  test("under UNIQUE, overlapping rules are reported, a catch-all included", async () => {
    const t = await table(
      "Overlap",
      dmn("Overlap", "UNIQUE", [{ expr: "b", type: "boolean" }], [
        { when: ["true"], then: '"A"', note: "p.4" },
        { when: ["false"], then: '"B"', note: "p.4" },
        { when: ["-"], then: '"unknown"' },
      ]),
    );
    const f = checkTable(t).filter((x) => x.check === "dmn-rule-shadowed");
    expect(f.length).toBe(2);
    expect(f[0]!.detail).toContain("UNIQUE");
  });
});

describe("dmn-unknown-last", () => {
  test("a last rule that returns something else is an error", async () => {
    const t = await table(
      "NoUnknown",
      dmn("NoUnknown", "FIRST", [{ expr: "b", type: "boolean" }], [
        { when: ["true"], then: '"A"', note: "p.5" },
        { when: ["-"], then: '"B"', note: "p.5" },
      ]),
    );
    expect(checks(checkTable(t))).toEqual(["dmn-unknown-last"]);
    expect(checks(checkTable(t, { requireUnknown: false }))).toEqual([]);
  });
});

describe("dmn-rule-cites-source", () => {
  test("a rule with no annotation, or one naming no source, is a warning", async () => {
    const t = await table(
      "Cite",
      dmn("Cite", "FIRST", [{ expr: "b", type: "boolean" }], [
        { when: ["true"], then: '"A"' },
        { when: ["false"], then: '"B"', note: "because it is so" },
        { when: ["-"], then: '"unknown"' },
      ]),
    );
    const f = checkTable(t).filter((x) => x.check === "dmn-rule-cites-source");
    expect(f.map((x) => [x.rule, x.severity])).toEqual([
      ["R1", "warning"],
      ["R2", "warning"],
    ]);
  });
});

describe("dmn-structure-matches-folio", () => {
  const md = (header: string, rows: number) =>
    `Intro.\n\n| Rule | ${header} |\n|---|---|\n` + Array.from({ length: rows }, (_, i) => `| ${i + 1} | x |`).join("\n") + "\n";

  test("reads a rule table's backticked header names", () => {
    expect(folioStructure(md("`a` (Fig. 1) | `b` | Rationale", 2))).toEqual({ names: ["a", "b"], rows: 2 });
  });

  test("reads a Decision structure section", () => {
    const s = folioStructure(
      "# T\n\n## Decision structure\n\n- **Inputs:**\n  - `x` (`boolean`): X?\n- **Outputs:**\n  - `out` (`\"a\"`): Out\n- **Rules:** 3, hit policy `FIRST`.\n\n## Next\n- `nope`\n",
    );
    expect(s).toEqual({ names: ["x", "out"], rows: 3 });
  });

  test("names the columns that differ, and a rule count that differs", async () => {
    const t = await table(
      "Struct",
      dmn("Struct", "FIRST", [{ expr: "b", type: "boolean" }], [
        { when: ["true"], then: '"A"', note: "p.6" },
        { when: ["-"], then: '"unknown"' },
      ]),
    );
    expect(checkFolioStructure(t, md("`b` | `out`", 2), "x.md")).toEqual([]);
    const f = checkFolioStructure(t, md("`c` | `out`", 3), "x.md");
    expect(f).toHaveLength(2);
    expect(f[0]!.detail).toContain("Missing from the block: `b`");
    expect(f[0]!.detail).toContain("not the DMN: `c`");
    expect(checkFolioStructure(t, undefined, "x.md")[0]!.severity).toBe("warning");
  });
});

describe("dmn-check over an instance", () => {
  test("reads tables beside folio blocks and flags a second copy elsewhere", async () => {
    const root = join(dir, "inst");
    mkdirSync(join(root, "folio", "doc", "ch1"), { recursive: true });
    mkdirSync(join(root, "processes", "decisions"), { recursive: true });
    const xml = dmn("Two", "FIRST", [{ expr: "b", type: "boolean" }], [
      { when: ["true"], then: '"A"', note: "p.7" },
      { when: ["-"], then: '"unknown"' },
    ]);
    writeFileSync(join(root, "folio", "doc", "ch1", "dt-two.dmn"), xml);
    writeFileSync(join(root, "folio", "doc", "ch1", "dt-two.md"), "| Rule | `b` | `out` |\n|---|---|---|\n| 1 | true | A |\n| 2 | - | unknown |\n");
    writeFileSync(join(root, "processes", "decisions", "Two.dmn"), xml);

    const reports = await checkDmn(root);
    const byFile = Object.fromEntries(reports.map((r) => [r.file, checks(r.findings)]));
    expect(byFile["folio/doc/ch1/dt-two.dmn"]).toEqual([]);
    expect(byFile["processes/decisions/Two.dmn"]).toEqual(["dmn-one-copy"]);
  });
});

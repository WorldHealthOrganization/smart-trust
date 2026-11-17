/**
 * dth-block-check: persona lanes, BPMN process lanes and DMN tables (core#515).
 */
import { describe, expect, it } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { check, lanesOf, repeatedTableMarkers, sectionBlocksOf } from "./dth-block-check";

const DMN = resolve(import.meta.dir, "../collab/processes/content/decisions/draft-qa-gate.dmn");

const bpmn = (lanes: Array<[string, string | null]>) =>
  `<?xml version="1.0"?>\n<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL">\n` +
  `<bpmn:process id="P1"><bpmn:laneSet>\n` +
  lanes.map(([id, ref]) => `<bpmn:lane id="${id}"${ref ? ` partitionElementRef="${ref}"` : ""}></bpmn:lane>`).join("\n") +
  `\n</bpmn:laneSet></bpmn:process></bpmn:definitions>\n`;

const block = (fn: string, fields: Record<string, string>, meta: unknown) =>
  `export default ${fn}({\n` +
  Object.entries(fields).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},\n`).join("") +
  `  meta: ${JSON.stringify(meta)},\n});\n`;

/** A small DTH: one persona, one process with its lane, one decision table. */
function fixture(over: { personaMeta?: Record<string, unknown>; lanes?: Array<[string, string | null]>; passages?: string[] } = {}) {
  const repo = mkdtempSync(join(tmpdir(), "dthblk-"));
  const ch = join(repo, "folio", "dth-x", "ch01");
  mkdirSync(join(repo, "folio", "dth-x", "media"), { recursive: true });
  mkdirSync(ch, { recursive: true });
  writeFileSync(join(ch, "pers-officer.ts"), block("persona", { label: "pers:officer" }, {
    roleId: "R-01",
    bpmnLanes: [{ laneId: "Lane_Officer", bpmnFile: "folio/dth-x/ch01/bp-one.bpmn" }],
    archimate: { elements: [{ iri: "https://example.org/e", name: "Officer" }] },
    glossaryTerms: ["https://example.org/glossary/officer"],
    ...over.personaMeta,
  }));
  writeFileSync(join(ch, "bp-one.ts"), block("businessProcess", { label: "bp:one", processId: "P1" }, { bpmnFile: "bp-one.bpmn", svgFile: "media/bp-one.svg" }));
  writeFileSync(join(ch, "bp-one.bpmn"), bpmn(over.lanes ?? [["Lane_Officer", "pers:officer"]]));
  writeFileSync(join(repo, "folio", "dth-x", "media", "bp-one.svg"), "<svg/>");
  writeFileSync(join(ch, "p-source.md"), "Source text.\n");
  writeFileSync(join(ch, "dt-gate.ts"), block("decisionTable", { label: "dt:gate", decisionId: "Decision_DraftQaGate" }, {
    dmnFile: "dt-gate.dmn",
    source: { sourcePassages: over.passages ?? ["folio/dth-x/ch01/p-source.md"] },
  }));
  copyFileSync(DMN, join(ch, "dt-gate.dmn"));
  return repo;
}

describe("lanesOf", () => {
  it("lanesOfReadsRefs", () => {
    expect(lanesOf(`<bpmn:lane id="A" partitionElementRef="pers:a"></bpmn:lane><lane id="B">`)).toEqual([
      { id: "A", ref: "pers:a" },
      { id: "B", ref: undefined },
    ]);
  });
});

describe("check", () => {
  it("alignedDthPasses", async () => {
    const r = await check(fixture(), "dth-x");
    expect(r.errors).toEqual([]);
    expect(r.counts).toMatchObject({ personas: 1, processes: 1, lanes: 1, decisionTables: 1 });
    expect(r.counts.rules).toBeGreaterThan(0);
  });

  it("personaMissingLinksFlagged", async () => {
    const r = await check(fixture({ personaMeta: { roleId: undefined, archimate: {}, glossaryTerms: [] }, lanes: [["Lane_Officer", "pers:other"]] }), "dth-x");
    expect(r.errors.join("\n")).toContain("no meta.roleId");
    expect(r.errors.join("\n")).toContain("no meta.archimate.elements");
    expect(r.errors.join("\n")).toContain("no meta.glossary");
    expect(r.errors.join("\n")).toContain('has partitionElementRef "pers:other", not "pers:officer"');
    expect(r.errors.join("\n")).toContain('names persona "pers:other", which no persona block declares');
  });

  it("laneWithoutRefFlagged", async () => {
    const r = await check(fixture({ lanes: [["Lane_Officer", "pers:officer"], ["Lane_X", null]] }), "dth-x");
    expect(r.errors).toEqual([expect.stringContaining("lane Lane_X has no partitionElementRef")]);
  });

  it("tableWithoutPassageFlagged", async () => {
    expect((await check(fixture({ passages: [] }), "dth-x")).errors).toEqual([expect.stringContaining("cites no meta.source.sourcePassages")]);
    expect((await check(fixture({ passages: ["folio/dth-x/gone.md"] }), "dth-x")).errors).toEqual([expect.stringContaining("gone.md does not exist")]);
  });

  it("proseRepeatingSectionTableFlagged", async () => {
    const repo = fixture();
    const ch = join(repo, "folio", "dth-x", "ch01");
    writeFileSync(
      join(ch, "ch01.ts"),
      `export default chapter({\n  title: "Chapter 1",\n  sections: [\n    section({ title: "Step 1", blocks: ["p-page-021", "t-step-1"] }),\n  ],\n});\n`,
    );
    writeFileSync(join(ch, "p-page-021.ts"), block("prose", { label: "prose:page-021" }, {}));
    writeFileSync(join(ch, "t-step-1.ts"), block("table", { label: "tbl:step-1" }, {}));
    writeFileSync(
      join(ch, "t-step-1.md"),
      "| INPUTS | STEPS | RESOURCES | OUTPUTS |\n| --- | --- | --- | --- |\n| Policies | Review | Template | List |\n\n| POTENTIAL RISKS | MITIGATION |\n| --- | --- |\n| Low capacity | Engage partners |\n",
    );
    writeFileSync(join(ch, "p-page-021.md"), "Chapter intro paragraph only.\n");
    expect((await check(repo, "dth-x")).errors).toEqual([]);

    writeFileSync(
      join(ch, "p-page-021.md"),
      "Chapter intro. STEP 1 INPUTS STEPS RESOURCES OUTPUTS - Policies Review POTENTIAL RISKS MITIGATION - Low capacity\n",
    );
    const r = await check(repo, "dth-x");
    expect(r.errors).toEqual([
      'folio/dth-x/ch01/p-page-021.md: prose block repeats flattened table text "INPUTS STEPS RESOURCES" from section table(s) t-step-1',
      'folio/dth-x/ch01/p-page-021.md: prose block repeats flattened table text "POTENTIAL RISKS MITIGATION" from section table(s) t-step-1',
    ]);
  });
});

describe("repeatedTableMarkers", () => {
  it("repeatedTableMarkersMatchSectionTables", () => {
    expect(sectionBlocksOf(`section({ blocks: ["p-1", "t-1"] }), section({ blocks: [\n  "p-2",\n  "t-2",\n] })`)).toEqual([
      ["p-1", "t-1"],
      ["p-2", "t-2"],
    ]);
    expect(repeatedTableMarkers("Intro text only.", ["| INPUTS | STEPS | RESOURCES | OUTPUTS |"])).toEqual([]);
    expect(repeatedTableMarkers("Run-on INPUTS STEPS RESOURCES OUTPUTS text.", [])).toEqual([]);
    expect(repeatedTableMarkers("Run-on INPUTS STEPS RESOURCES OUTPUTS text.", ["| INPUTS | STEPS | RESOURCES | OUTPUTS |"])).toEqual([
      "INPUTS STEPS RESOURCES",
    ]);
  });
});

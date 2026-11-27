/**
 * A generator never writes a header-only table.
 *
 * Kramdown 2.5 drops a pipe table that has no body row and prints its header
 * and delimiter as a paragraph, the delimiter's `---` typeset as em dashes.
 * The processes index and the per-Tool pages wrote one wherever a join came
 * back empty, and 31 published pages showed `| role | file | |` and `|—|—|—|`
 * as text. Each generator now writes a sentence instead; these pin it, and
 * judge the output with the same source check (`brokenTablesIn`) the gate runs.
 *
 * @module cat-harness-tools/scripts/tests/generated-tables.test
 */
import { describe, expect, it } from "bun:test";

import { brokenTablesIn } from "../check-escaped-markup.ts";
import { page, processPage, tableOrNone, type ProcessRow } from "../gen-processes-viz.ts";
import { toolPage, type ToolPageData } from "../tool-page.ts";
import { defineTool } from "../../schemas/tools/tool.js";

describe("tableOrNone", () => {
  it("writes the table when there are rows", () => {
    expect(tableOrNone(["a", "b"], ["| 1 | 2 |"], "_None._")).toEqual(["| a | b |", "|---|---|", "| 1 | 2 |"]);
  });

  it("writes the sentence, and no table, when there are none", () => {
    expect(tableOrNone(["a", "b"], [], "_None._")).toEqual(["_None._"]);
  });
});

/** A parsed diagram with nothing in it to tabulate: no lanes, skills, ops or steps. */
const empty = {
  file: "procs/empty.bpmn",
  group: "procs",
  id: "Empty",
  name: "Empty",
  stem: "empty",
  lanes: [],
  roles: [],
  skills: [],
  beanOps: [],
  enforcement: "strict",
  enforcementDeclared: true,
  activities: 1,
  // A call activity only: the census section opens, and its by-lane table,
  // which counts the OTHER steps, has no row.
  activitiesWithoutSkill: [{ id: "C1", lane: "", type: "bpmn:CallActivity" }],
  laneDetails: [],
  steps: [],
  decisions: [],
  svg: "assets/img/workflows/empty.svg",
} as unknown as ProcessRow;

describe("the processes index, over a diagram with no rows to show", () => {
  const md = page([empty]);

  it("writes no header-only table", () => {
    expect(brokenTablesIn("processes/index.md", md).filter((f) => f.defect === "no-body")).toEqual([]);
  });

  it("says each empty join in a sentence instead", () => {
    expect(md).toContain("_No activity names a skill._");
    expect(md).toContain("_No step names a bean op._");
    expect(md).not.toContain("| skill | run by |");
    expect(md).not.toContain("| op | diagrams |");
    expect(md).not.toContain("| lane | steps |");
  });

  it("a process page with no steps says so rather than drawing an empty table", () => {
    const one = processPage(empty, [empty], new Set());
    expect(brokenTablesIn("processes/empty.md", one).filter((f) => f.defect === "no-body")).toEqual([]);
    expect(one).toContain("_No steps._");
  });
});

describe("a Tool page whose definition names no file it is made of", () => {
  const def = defineTool({
    id: "demo-tool",
    title: "Demo",
    description: "A demo Tool.",
    install: { none: true },
    invoke: { shell: "bun run cat demo" },
    io: { inputs: [], outputs: [] },
    satisfies: ["process-state"],
  });
  const data: ToolPageData = {
    def,
    instance: "demo",
    typeIri: "https://x.test/Tool",
    skills: new Map(),
    skillHref: () => undefined,
    toolHref: () => undefined,
    siblings: new Map(),
    alternatives: [],
    processes: [],
    processesRead: true,
    parts: [],
    moduleImports: [],
    mcpServers: [],
    workflows: [],
  };
  const md = toolPage(data, "generated: true");

  it("writes no header-only table under 'What it is made of'", () => {
    expect(md).not.toContain("| role | file | |");
    expect(md).toContain("Its definition names no file it is made of.");
    expect(brokenTablesIn("tools/demo-tool.md", md).filter((f) => f.defect === "no-body")).toEqual([]);
  });

  it("still writes the table when there is a part", () => {
    const withPart = toolPage({ ...data, parts: [{ role: "definition", file: "tools/demo.ts", exists: true }] }, "generated: true");
    expect(withPart).toContain("| role | file | |");
    expect(brokenTablesIn("tools/demo-tool.md", withPart).filter((f) => f.defect === "no-body")).toEqual([]);
  });
});

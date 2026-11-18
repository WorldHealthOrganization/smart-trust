/**
 * The processes viewer draws one page per sub-graph, as the tools, library
 * and beans viewers do (owner, 2026-11-01: "i thought this worked to show
 * process in the subgraph smart-trust only"). These tests pin the pure
 * parts: which layer owns a file, how rows split into pages, and that a
 * sub-graph page links one level deeper than the index.
 *
 * @module cat-harness-tools/scripts/tests/processes-subgraph.test
 */
import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { owningInstance, page, subgraphPages, type ProcessRow } from "../gen-processes-viz.js";

const row = (stem: string, instance: string | undefined): ProcessRow => ({
  file: `${instance ?? "x"}/processes/${stem}.bpmn`,
  group: `${instance ?? "x"}/processes`,
  ...(instance ? { instance } : {}),
  id: `Process_${stem}`,
  name: `Process ${stem}`,
  lanes: [],
  roles: [],
  skills: [],
  beanOps: [],
  enforcement: "strict",
  enforcementDeclared: true,
  activities: 1,
  activitiesWithoutSkill: [],
  stem,
  laneDetails: [],
  steps: [],
  decisions: [],
});

describe("owningInstance", () => {
  const roots = [
    { root: "/w", name: "smart-trust" },
    { root: "/w/smart-base", name: "smart-base" },
  ];
  it("picks the deepest root, so a mounted layer is its own sub-graph", () => {
    expect(owningInstance(join("/w/smart-base/processes/a.bpmn"), roots)).toBe("smart-base");
    expect(owningInstance("/w/input/business-processes/b.bpmn", roots)).toBe("smart-trust");
  });
  it("does not match a sibling that only shares a name prefix", () => {
    expect(owningInstance("/w/smart-base-extra/c.bpmn", [{ root: "/w/smart-base", name: "smart-base" }])).toBeUndefined();
  });
});

describe("subgraphPages", () => {
  it("groups rows by instance, sorted, and skips rows with none", () => {
    const pages = subgraphPages([row("b", "who-iris"), row("a", "smart-trust"), row("c", "smart-trust"), row("d", undefined)]);
    expect(pages.map((p) => [p.name, p.rows.length])).toEqual([
      ["smart-trust", 2],
      ["who-iris", 1],
    ]);
  });
});

describe("page scope", () => {
  const rows = [row("a", "smart-trust")];
  it("the index carries a By subgraph table linking each sub-graph page", () => {
    const md = page(rows, new Set(), undefined, { subjects: [{ name: "smart-trust", count: 1, href: "smart-trust/" }] });
    expect(md).toContain("## By subgraph");
    expect(md).toContain("| [smart-trust](smart-trust/) | 1 |");
    expect(md).toContain("](a.html)");
  });
  it("a sub-graph page is titled for its instance and links process pages one level up", () => {
    const md = page(rows, new Set(), undefined, { instance: "smart-trust" });
    expect(md).toContain("title: 'Processes — smart-trust'");
    expect(md).toContain("# Processes — smart-trust");
    expect(md).toContain("](../a.html)");
    expect(md).not.toContain("## By subgraph");
  });
});

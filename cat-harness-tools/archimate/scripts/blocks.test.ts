import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArchimateConfigSchema, parseArchimate } from "../schemas/archimate.ts";
import { relationshipTable } from "../schemas/metamodel.ts";
import { checkRules, relationshipTypesTableMarkdown, RelationshipRulesSchema, rulesCheckReport, rulesTableMarkdown, type RelationshipRules } from "../schemas/rules.ts";
import { blocksOf, replaceTable } from "./archimate-blocks.ts";

/**
 * A model with: a component realising a service (a rule), a service serving
 * a component twice (no rule covers it), a placeholder "Goal" and a grouping
 * (both left out of the check).
 */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="Tiny" id="id-model" version="5.0.0">
  <folder name="Elements" id="id-f1" type="application">
    <element xsi:type="archimate:ApplicationComponent" name="Registry" id="id-a"/>
    <element xsi:type="archimate:ApplicationService" name="Lookup" id="id-b"/>
    <element xsi:type="archimate:ApplicationComponent" name="Client" id="id-c"/>
    <element xsi:type="archimate:Goal" name="Goal" id="id-p"/>
    <element xsi:type="archimate:Grouping" name="Grouping" id="id-g"/>
  </folder>
  <folder name="Relations" id="id-f2" type="relations">
    <element xsi:type="archimate:RealizationRelationship" id="id-r1" source="id-a" target="id-b"/>
    <element xsi:type="archimate:ServingRelationship" id="id-r2" source="id-b" target="id-c"/>
    <element xsi:type="archimate:ServingRelationship" id="id-r3" source="id-b" target="id-a"/>
    <element xsi:type="archimate:AggregationRelationship" id="id-r4" source="id-g" target="id-a"/>
    <element xsi:type="archimate:InfluenceRelationship" id="id-r5" source="id-a" target="id-p"/>
  </folder>
  <folder name="Views" id="id-f3" type="diagrams">
    <element xsi:type="archimate:ArchimateDiagramModel" name="Tiny view" id="id-v">
      <child xsi:type="archimate:DiagramObject" id="id-n1" archimateElement="id-a">
        <bounds x="10" y="10" width="120" height="55"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c1" source="id-n1" target="id-n2" archimateRelationship="id-r1"/>
      </child>
      <child xsi:type="archimate:DiagramObject" id="id-n2" archimateElement="id-b">
        <bounds x="200" y="10" width="120" height="55"/>
      </child>
    </element>
  </folder>
</archimate:model>`;

const RULES: RelationshipRules = RelationshipRulesSchema.parse({
  $schema: "archimate-relationship-rules/v1",
  relationships: [
    { type: "Realization", name: "Realisation", verb: "Realises", icon: "media/r.png", meaning: "A component *realises* a service" },
    { type: "Serving", name: "Serving" },
  ],
  rules: [
    { source: "ApplicationComponent", relationship: "Realization", target: "ApplicationService", note: "A component realises a service it offers" },
    { source: "Capability", relationship: "Serving", target: "Goal", note: "A capability serves the goal it supports" },
  ],
});

describe("the rules file", () => {
  it("refuses a rule whose relationship type it does not list, and a rule listed twice", () => {
    const bad = {
      $schema: "archimate-relationship-rules/v1",
      relationships: [{ type: "Serving", name: "Serving" }],
      rules: [
        { source: "Goal", relationship: "Composition", target: "Goal", note: "x" },
        { source: "Goal", relationship: "Serving", target: "Goal", note: "x" },
        { source: "Goal", relationship: "Serving", target: "Goal", note: "y" },
      ],
    };
    const r = RelationshipRulesSchema.safeParse(bad);
    expect(r.success).toBe(false);
    const messages = r.success ? [] : r.error.issues.map((i) => i.message);
    expect(messages.some((m) => m.includes("Composition is not in"))).toBe(true);
    expect(messages.some((m) => m.includes("listed twice"))).toBe(true);
  });
});

describe("the tables", () => {
  it("draws the rules table in the file's order, with the document's names", () => {
    expect(rulesTableMarkdown(RULES)).toBe(
      [
        "| Source | Relationship | Target | Note |",
        "| --- | --- | --- | --- |",
        "| Application Component | Realisation | Application Service | A component realises a service it offers |",
        "| Capability | Serving | Goal | A capability serves the goal it supports |",
      ].join("\n"),
    );
  });

  it("draws only the relationship types that carry a meaning", () => {
    expect(relationshipTypesTableMarkdown(RULES)).toBe(
      [
        "| **ArchiMate relationship** | **Relationship type** | **What it represents** |",
        "| --- | --- | --- |",
        "| ![Realises](media/r.png) | **Realises** | A component *realises* a service |",
      ].join("\n"),
    );
  });

  it("replaces the table and keeps the caption and footnotes", () => {
    const md = "*Table 9: Caption*\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n[^1]: a note\n";
    expect(replaceTable(md, "| x |\n| --- |")).toBe("*Table 9: Caption*\n\n| x |\n| --- |\n\n[^1]: a note\n");
  });
});

describe("checking a model against the rules", () => {
  const model = parseArchimate(XML);
  const c = checkRules(model, "tiny", RULES, relationshipTable());

  it("counts what follows each rule, and leaves groupings and placeholders out", () => {
    expect(c.checked).toBe(3);
    expect(c.used.map((u) => u.count)).toEqual([1, 0]);
    // The grouping's aggregation (id-r4) and the influence on the placeholder "Goal" (id-r5) are not checked:
    // no uncovered pattern holds them, and rules naming them count nothing.
    expect(c.uncovered.flatMap((p) => p.relationships)).toEqual(["id-r2", "id-r3"]);
    const withThem = RelationshipRulesSchema.parse({
      ...RULES,
      relationships: [...RULES.relationships, { type: "Aggregation", name: "Aggregation" }, { type: "Influence", name: "Influence" }],
      rules: [
        ...RULES.rules,
        { source: "Grouping", relationship: "Aggregation", target: "ApplicationComponent", note: "A grouping aggregates a component" },
        { source: "ApplicationComponent", relationship: "Influence", target: "Goal", note: "A component influences a goal" },
      ],
    });
    const c2 = checkRules(model, "tiny", withThem, relationshipTable());
    expect(c2.checked).toBe(3);
    expect(c2.used.map((u) => u.count)).toEqual([1, 0, 0, 0]);
  });

  it("reports the patterns no rule covers, most used first", () => {
    expect(c.uncovered.map((p) => `${p.source} ${p.relationship} ${p.target} ${p.count}`)).toEqual(["ApplicationService Serving ApplicationComponent 2"]);
    expect(c.uncoveredCount).toBe(2);
    // With the realisation rule gone, the realisation (once) is reported after the serving (twice).
    const fewer = RelationshipRulesSchema.parse({ ...RULES, rules: RULES.rules.filter((x) => x.relationship !== "Realization") });
    const c2 = checkRules(model, "tiny", fewer, relationshipTable());
    expect(c2.uncovered.map((p) => `${p.source} ${p.relationship} ${p.target} ${p.count}`)).toEqual([
      "ApplicationService Serving ApplicationComponent 2",
      "ApplicationComponent Realization ApplicationService 1",
    ]);
    expect(c2.uncoveredCount).toBe(3);
  });

  it("flags a rule ArchiMate does not allow, and a relationship type the document never explains", () => {
    expect(c.notAllowed.map((x) => `${x.source} ${x.relationship} ${x.target}`)).toEqual(["Capability Serving Goal"]);
    expect(c.unexplained).toEqual(["Serving"]);
    const text = rulesCheckReport(c, "Table 9");
    expect(text).toContain("1 of 2 rule(s) the model never uses");
    expect(text).toContain("does not allow");
  });
});

describe("blocksOf, on an instance", () => {
  const root = mkdtempSync(join(tmpdir(), "archimate-blocks-"));
  mkdirSync(join(root, "archimate"));
  mkdirSync(join(root, "doc"));
  writeFileSync(join(root, "tiny.json"), JSON.stringify({ name: "tiny", directories: [{ id: "archimate", path: "archimate/", graphTypologies: ["archimate"] }] }));
  writeFileSync(join(root, "archimate", "model.archimate"), XML);
  writeFileSync(join(root, "archimate", "rules.json"), JSON.stringify(RULES));
  writeFileSync(join(root, "doc", "t.md"), "*Table 9*\n\n| old |\n| --- |\n");
  const config = ArchimateConfigSchema.parse({
    $schema: "cat-archimate-config/v1",
    directory: "archimate",
    models: [{ id: "tiny", file: "model.archimate", title: "Tiny" }],
    figures: [{ block: "doc/f.md", label: "Figure 9", model: "tiny", view: "id-v", basis: "same-elements", svg: "doc/media/f.svg" }],
    tables: [{ block: "doc/t.md", label: "Table 9", kind: "relationship-rules", rules: "rules.json", model: "tiny" }],
  });

  it("draws the table into its block and the view as SVG, and checks the model", () => {
    const r = blocksOf(root, config);
    expect(r.outputs.map((o) => o.path)).toEqual(["doc/t.md", "doc/media/f.svg"]);
    expect(r.outputs[0]!.content.startsWith("*Table 9*\n\n| Source |")).toBe(true);
    expect(r.outputs[1]!.content).toContain("<svg");
    expect(r.outputs[1]!.content).toContain("Registry");
    expect(r.checks[0]!.check.uncoveredCount).toBe(2);
    expect(readFileSync(join(root, "doc", "t.md"), "utf8")).toContain("| old |");
  });

  it("refuses a table whose model the config does not declare", () => {
    const bad = ArchimateConfigSchema.safeParse({ ...config, tables: [{ ...config.tables![0]!, model: "nope" }] });
    expect(bad.success).toBe(false);
  });
});

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HARNESS_ROOT } from "../../scripts/lib/roots.ts";
import { parseArchimate } from "../schemas/archimate.ts";
import { RELATIONSHIP_TABLE_TAG, RelationshipTableSchema, categorySubsets, drawnCategories, isAllowed, metamodelSvgName, isPlaceholder, metamodelDot, metamodelMermaid, metamodelOf, relationshipTable, type Metamodel, type MetamodelPattern } from "../schemas/metamodel.ts";
import { parseArchiTable, tableJson } from "./import-archi-relationships.ts";
import { report } from "./archimate-metamodel.ts";

/**
 * A model with: a real serving and access (both allowed), one serving
 * ArchiMate does not allow (a data object serving a goal), and a hand-drawn
 * metamodel corner: two placeholders, "Goal" and "Application Component (MS)",
 * joined by a specialization.
 */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="Tiny" id="id-model" version="5.0.0">
  <folder name="Elements" id="id-f1" type="application">
    <element xsi:type="archimate:ApplicationComponent" name="Registry" id="id-a"/>
    <element xsi:type="archimate:ApplicationService" name="Lookup" id="id-b"/>
    <element xsi:type="archimate:DataObject" name="Record" id="id-c"/>
    <element xsi:type="archimate:Goal" name="Trusted records" id="id-d"/>
    <element xsi:type="archimate:Goal" name="Goal" id="id-p1"/>
    <element xsi:type="archimate:ApplicationComponent" name="Application Component (MS)" id="id-p2"/>
    <element xsi:type="archimate:Grouping" name="Grouping" id="id-g"/>
  </folder>
  <folder name="Relations" id="id-f2" type="relations">
    <element xsi:type="archimate:ServingRelationship" id="id-r1" source="id-b" target="id-a"/>
    <element xsi:type="archimate:AccessRelationship" id="id-r2" source="id-a" target="id-c" accessType="1"/>
    <element xsi:type="archimate:ServingRelationship" id="id-r3" source="id-c" target="id-d"/>
    <element xsi:type="archimate:SpecializationRelationship" id="id-r4" source="id-p2" target="id-a"/>
    <element xsi:type="archimate:AggregationRelationship" id="id-r5" source="id-g" target="id-a"/>
  </folder>
</archimate:model>`;

describe("the relationship table", () => {
  const t = relationshipTable();

  it("is ArchiMate 3.2 as Archi holds it, with its source and licence", () => {
    expect(t.archimateVersion).toBe("3.2");
    expect(t.source.license).toBe("MIT");
    expect(t.keys.r).toBe("RealizationRelationship");
  });

  it("is checked by its own schema, the validator of its $schema family", () => {
    expect(t.$schema).toBe(RELATIONSHIP_TABLE_TAG);
    expect(RelationshipTableSchema.safeParse(t).success).toBe(true);
    expect(RelationshipTableSchema.safeParse({ ...t, keys: { r: "Realization" } }).success).toBe(false);
    expect(RelationshipTableSchema.safeParse({ ...t, $schema: "archimate-relationship-table/v2" }).success).toBe(false);
    // The validator node of the table's $schema family names this schema.
    const validator = JSON.parse(readFileSync(join(HARNESS_ROOT, "validators", "archimate-relationship-table.json"), "utf8")) as {
      validates: { kind: string; family: string };
      schema: string;
    };
    expect(validator.validates).toEqual({ kind: "schemas", family: t.$schema });
    expect(validator.schema).toBe("cat-harness-tools:archimate/schemas/metamodel.ts#RelationshipTableSchema");
  });

  it("allows, refuses, and does not guess", () => {
    expect(isAllowed(t, "ApplicationService", "Serving", "ApplicationComponent")).toBe(true);
    expect(isAllowed(t, "ApplicationService", "ServingRelationship", "ApplicationComponent")).toBe(true);
    expect(isAllowed(t, "DataObject", "Serving", "Goal")).toBe(false);
    expect(isAllowed(t, "NotAType", "Serving", "Goal")).toBeUndefined();
  });

  it("is written by the importer from Archi's XML, one row per source type", () => {
    const keys = `<relationshipskeys version="1.0"><key char="o" relationship="AssociationRelationship" /><key char="v" relationship="ServingRelationship" /></relationshipskeys>`;
    const rels = `<relationships version="3.2">\n<source concept="A">\n<target concept="B" relations="ov" />\n</source>\n<source concept="B">\n<target concept="A" relations="o" />\n</source>\n</relationships>`;
    const src = { repository: "r", commit: "c", path: "p", license: "MIT", copyright: "x" };
    const parsed = parseArchiTable(rels, keys, src);
    expect(parsed.allowed).toEqual({ A: { B: "ov" }, B: { A: "o" } });
    expect(JSON.parse(tableJson(parsed))).toEqual(parsed);
    expect(tableJson(parsed)).toContain(`    "A": {"B":"ov"}`);
    expect(() => parseArchiTable(rels.replace(`"ov"`, `"oq"`), keys, src)).toThrow(/unknown key letter "q"/);
  });
});

describe("the metamodel in use", () => {
  const model = parseArchimate(XML);
  const mm = metamodelOf(model, "1.0.0");

  it("names placeholders by their own type, never a default-named grouping", () => {
    expect(isPlaceholder({ type: "Goal", name: "Goal" })).toBe(true);
    expect(isPlaceholder({ type: "ApplicationComponent", name: "application component (MS)" })).toBe(true);
    expect(isPlaceholder({ type: "Goal", name: "Trusted records" })).toBe(false);
    expect(isPlaceholder({ type: "Grouping", name: "Grouping" })).toBe(false);
    expect(mm.placeholders.map((e) => e.id)).toEqual(["id-p1", "id-p2"]);
    expect(mm.placeholderRelationships).toEqual(["id-r4"]);
  });

  it("counts types and patterns without the placeholders, and checks each pattern", () => {
    expect(mm.types.find((t) => t.type === "ApplicationComponent")!.elements).toBe(1);
    expect(mm.types.find((t) => t.type === "Goal")!.elements).toBe(1);
    const key = (p: { source: string; relationship: string; target: string }) => `${p.source} ${p.relationship} ${p.target}`;
    expect(mm.patterns.map((p) => [key(p), p.count, p.allowed])).toEqual([
      ["ApplicationComponent Access DataObject", 1, true],
      ["ApplicationService Serving ApplicationComponent", 1, true],
      ["DataObject Serving Goal", 1, false],
      ["Grouping Aggregation ApplicationComponent", 1, true],
    ]);
    expect(mm.notAllowed).toBe(1);
  });

  it("draws the same result as DOT and Mermaid, a refused pattern in red", () => {
    const dot = metamodelDot(mm);
    expect(dot).toContain(`"DataObject" -> "Goal" [label="✗ serves ×1"`);
    expect(dot).toContain(`color="#c0392b"`);
    expect(dot).toContain(`"ApplicationService" -> "ApplicationComponent" [label="serves ×1", class="mm-cat-dependency mm-from-application mm-to-application", arrowhead=vee]`);
    const mmd = metamodelMermaid(mm);
    expect(mmd.startsWith("classDiagram\n")).toBe(true);
    expect(mmd).toContain("ApplicationComponent ..> DataObject : accesses ×1");
    // The same result: every pattern the DOT draws is a Mermaid line with the same label.
    const dotEdges = [...dot.matchAll(/^ {2}"(\w+)" -> "(\w+)" \[label="([^"]+)", class=/gm)].map(([, s, t, l]) => `${s} ${t} ${l}`);
    const mmdEdges = [...mmd.matchAll(/^ {2}(\w+) \S+ (\w+) : (.+)$/gm)].map(([, s, t, l]) => `${s} ${t} ${l}`);
    expect(dotEdges.sort()).toEqual([
      "ApplicationComponent DataObject accesses ×1",
      "ApplicationService ApplicationComponent serves ×1",
      "DataObject Goal ✗ serves ×1",
    ]);
    expect(dotEdges.every((e) => mmdEdges.includes(e))).toBe(true);
    // Only the refused pattern is red.
    const red = dot.split("\n").filter((l) => l.includes(`color="#c0392b"`));
    expect(red).toHaveLength(1);
    expect(red[0]).toContain(`"DataObject" -> "Goal"`);
  });

  it("keeps the picture readable: one line per pair, self-relationships in the box, no associations or groupings", () => {
    const p = (source: string, relationship: string, target: string, count = 1, allowed: boolean | undefined = true): MetamodelPattern =>
      ({ source, relationship, target, count, allowed, relationships: [] });
    const dense: Metamodel = {
      ...mm,
      types: [
        { type: "Goal", layer: "Motivation", elements: 3, ids: [] },
        { type: "Capability", layer: "Strategy", elements: 2, ids: [] },
      ],
      patterns: [
        p("Capability", "Influence", "Goal", 21),
        p("Capability", "Realization", "Goal", 2),
        p("Goal", "Aggregation", "Goal", 13),
        p("Capability", "Association", "Goal", 4),
        p("Grouping", "Aggregation", "Goal"),
      ],
    };
    const dot = metamodelDot(dense);
    expect(dot.match(/"Capability" -> "Goal"/g)!.length).toBe(1);
    expect(dot).toContain(`label="influences ×21\nrealises ×2", class="mm-cat-dependency mm-cat-structural mm-from-strategy mm-to-motivation", arrowhead=vee`);
    expect(dot).toContain(`class="mm-layer-motivation"`);
    expect(dot).toContain(`(to itself: aggregates ×13)`);
    expect(dot).not.toContain("associated with");
    expect(dot).not.toContain(`"Grouping"`);
    expect(metamodelDot(dense, { associations: true })).toContain("associated with ×4");
    const linked = metamodelDot(dense, { href: { type: (t) => `page/#type-${t}`, pair: (a, b) => `page/#pattern-${a}-${b}` } });
    expect(linked).toContain(`URL="page/#type-Goal", target="_top"`);
    expect(linked).toContain(`URL="page/#pattern-Capability-Goal", target="_top"`);
    expect(dot).not.toContain("URL=");
    // Filtered to one category, the picture is laid out without the other lines, and the types only they touched.
    const structural = metamodelDot(dense, { categories: ["structural"] });
    expect(structural).toContain(`label="realises ×2", class="mm-cat-structural`);
    expect(structural).not.toContain("influences");
    expect(structural).toContain(`(to itself: aggregates ×13)`);
    expect(metamodelDot(dense, { categories: ["dynamic"] })).not.toContain(`"Capability" [`);
    expect(drawnCategories(dense)).toEqual(["structural", "dependency"]);
    expect(categorySubsets(dense)).toEqual([["structural"], ["dependency"]]);
    expect(metamodelSvgName(["dependency"], ["structural", "dependency"])).toBe("metamodel.dependency.svg");
    expect(metamodelSvgName(["dependency", "structural"], ["structural", "dependency"])).toBe("metamodel.svg");
  });

  it("reports in plain text, the refusal first", () => {
    const text = report(mm);
    expect(text).toContain("✗ 1 relationship(s) in 1 pattern(s) ArchiMate does not allow");
    expect(text).toContain("Data Object serves Goal ×1: id-r3");
    expect(text).toContain("2 placeholder element(s)");
    // The refusal comes straight after the heading, before the placeholders.
    const lines = text.split("\n");
    expect(lines[0]).toStartWith("1.0.0 (Tiny): ");
    expect(lines[1]).toContain("✗ 1 relationship(s)");
    expect(lines[2]).toContain("Data Object serves Goal ×1: id-r3");
    expect(lines.findIndex((l) => l.includes("placeholder element(s)"))).toBe(3);
  });
});

import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GlossarySchema } from "../schemas/glossary.ts";
import { readArchimate } from "../../cat-harness-tools/archimate/schemas/archimate.ts";

import { acronymsTable, elementTypesTable, glossaryTablesOf, GlossaryTablesSchema, replaceTable, termsTable, viewTypes } from "./glossary-table.ts";

const G = GlossarySchema.parse({
  $schema: "folio-glossary/v1",
  id: "doc",
  title: "Doc",
  terms: [
    { id: "dpi", prefLabel: "Digital Public Infrastructure", altLabel: ["DPI"], definition: "Shared digital systems.", status: "candidate" },
    { id: "reg", prefLabel: "Registry", definition: "An authoritative system\nof record.", editorialNote: "Under review", status: "candidate" },
    { id: "hie", prefLabel: "Health Information Exchange", editorialNote: "To be included before publication", status: "candidate" },
    { id: "repo", prefLabel: "Repository", status: "candidate" },
  ],
});

const A = GlossarySchema.parse({
  $schema: "folio-glossary/v1",
  id: "acr",
  title: "Acronyms",
  terms: [
    { id: "ai", prefLabel: "Artificial Intelligence", notation: "AI", status: "candidate" },
    { id: "x", prefLabel: "No acronym", status: "candidate" },
    { id: "sdg", prefLabel: "Sustainable Development Goal", notation: "SDG", status: "candidate" },
  ],
});

// A metamodel view: placeholder elements named after their types, and one real element.
const MODEL = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="Tiny" id="id-model" version="5.0.0">
  <folder name="Elements" id="id-f1" type="application">
    <element xsi:type="archimate:Goal" name="Goal" id="id-p1"/>
    <element xsi:type="archimate:ApplicationComponent" name="Application Component" id="id-p2"/>
    <element xsi:type="archimate:Requirement" name="Requirement" id="id-p3"/>
    <element xsi:type="archimate:ApplicationComponent" name="Client Registry" id="id-a"/>
  </folder>
  <folder name="Views" id="id-f3" type="diagrams">
    <element xsi:type="archimate:ArchimateDiagramModel" name="Metamodel" id="id-v">
      <child xsi:type="archimate:DiagramObject" id="id-n1" archimateElement="id-p1"><bounds x="0" y="0" width="120" height="55"/></child>
      <child xsi:type="archimate:DiagramObject" id="id-n2" archimateElement="id-p2"><bounds x="0" y="100" width="120" height="55"/></child>
      <child xsi:type="archimate:DiagramObject" id="id-n3" archimateElement="id-p3"><bounds x="200" y="0" width="120" height="55"/></child>
      <child xsi:type="archimate:DiagramObject" id="id-n4" archimateElement="id-a"><bounds x="200" y="100" width="120" height="55"/></child>
    </element>
  </folder>
</archimate:model>`;

const E = GlossarySchema.parse({
  $schema: "folio-glossary/v1",
  id: "ra",
  title: "RA",
  terms: [
    { id: "goal", prefLabel: "Goal", definition: "A statement of intent.", example: "Universal access to a health record.", status: "candidate" },
    { id: "ac", prefLabel: "Application Component", definition: "A deployable piece of software.", status: "candidate" },
    { id: "req", prefLabel: "Requirement", status: "candidate" },
  ],
});

describe("glossary-table", () => {
  it("elementTypesFromViewAndGlossary", () => {
    const shown = viewTypes(readArchimate(Buffer.from(MODEL)), "id-v");
    expect(shown).toEqual(["Goal", "ApplicationComponent", "Requirement"]);
    expect(elementTypesTable(E, shown, [{ type: "Goal", icon: "media/goal.png" }, { type: "ApplicationComponent" }])).toBe(
      [
        "| **ArchiMate element** | **Element type** | **What it represents** | **Example in the health sector** |",
        "| --- | --- | --- | --- |",
        "| ![Goal](media/goal.png) | **Goal** | A statement of intent. | *Universal access to a health record.* |",
        "|   | **Application Component** | A deployable piece of software. |   |",
      ].join("\n"),
    );
  });

  it("elementTypesRefusesTypeNotOnView", () => {
    expect(() => elementTypesTable(E, ["Goal"], [{ type: "Product" }])).toThrow(/not a type on the metamodel view/);
  });

  it("elementTypesRefusesTermWithoutDefinition", () => {
    expect(() => elementTypesTable(E, ["Requirement"], [{ type: "Requirement" }])).toThrow(/no definition/);
  });

  it("elementTypesNeedsArchimate", () => {
    const r = GlossaryTablesSchema.safeParse({ $schema: "folio-glossary-tables/v1", tables: [{ glossary: "g.json", block: "b.md", kind: "element-types" }] });
    expect(r.success).toBe(false);
  });

  it("drawsElementTypesTableAndReportsLeftOut", () => {
    const root = mkdtempSync(join(tmpdir(), "glossary-table-et-"));
    mkdirSync(join(root, "glossary"));
    writeFileSync(join(root, "glossary", "ra.glossary.json"), JSON.stringify(E));
    writeFileSync(join(root, "m.archimate"), MODEL);
    writeFileSync(join(root, "t.md"), "*Table 3.1*\n\n| old |\n| --- |\n");
    writeFileSync(
      join(root, "glossary", "glossary-tables.json"),
      JSON.stringify({
        $schema: "folio-glossary-tables/v1",
        tables: [{ glossary: "glossary/ra.glossary.json", block: "t.md", kind: "element-types", archimate: { model: "m.archimate", view: "id-v" }, rows: [{ type: "Goal" }] }],
      }),
    );
    const [o] = glossaryTablesOf(root);
    expect(o!.content.startsWith("*Table 3.1*\n\n| **ArchiMate element** |")).toBe(true);
    expect(o!.notShown).toEqual(["ApplicationComponent", "Requirement"]);
  });

  it("termsTableLabelsNotes", () => {
    expect(termsTable(G)).toBe(
      [
        "| **Term** | **Description** |",
        "| --- | --- |",
        "| Digital Public Infrastructure (DPI) | Shared digital systems. |",
        "| Registry | An authoritative system<br>of record. [Under review] |",
        "| Health Information Exchange | [To be included before publication] |",
        "| Repository |   |",
      ].join("\n"),
    );
  });

  it("acronymsTableNotationOnly", () => {
    expect(acronymsTable(A)).toBe(["| AI | Artificial Intelligence |", "| --- | --- |", "| SDG | Sustainable Development Goal |"].join("\n"));
  });

  it("keepsCaptionAndFootnotes", () => {
    expect(replaceTable("*Glossary*\n\n| a |\n| --- |\n\n[^1]: n\n", "| b |\n| --- |")).toBe("*Glossary*\n\n| b |\n| --- |\n\n[^1]: n\n");
  });

  it("refusesEscapingPath", () => {
    const r = GlossaryTablesSchema.safeParse({ $schema: "folio-glossary-tables/v1", tables: [{ glossary: "../g.json", block: "b.md", kind: "terms" }] });
    expect(r.success).toBe(false);
  });

  it("drawsConfiguredTables", () => {
    const root = mkdtempSync(join(tmpdir(), "glossary-table-"));
    mkdirSync(join(root, "glossary"));
    writeFileSync(join(root, "glossary", "doc.glossary.json"), JSON.stringify(G));
    writeFileSync(join(root, "t.md"), "| old |\n| --- |\n");
    writeFileSync(
      join(root, "glossary", "glossary-tables.json"),
      JSON.stringify({ $schema: "folio-glossary-tables/v1", tables: [{ glossary: "glossary/doc.glossary.json", block: "t.md", kind: "terms" }] }),
    );
    const out = glossaryTablesOf(root);
    expect(out).toHaveLength(1);
    expect(out[0]!.content.startsWith("| **Term** |")).toBe(true);
  });
});

/**
 * Core's fill of the `tabular-csvw` pipeline slot (bean `urat`): routing by
 * sniffed content, `null` for anything this reader does not take, and the
 * `pipeline-plugins/` node naming an export that exists. And its fill of
 * `library-entry-arms`: the reference-list and glossary readers run over a
 * promoted entry, each recording `found`, `none` only when it ran, or
 * `not-extracted` saying why.
 */
import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runEntryArms } from "@litlfred/cat-harness-tools/scripts/entry-extraction.js";
import { TABULAR_CSVW_SCHEMA_ID } from "@litlfred/cat-harness-tools/schemas/library/tabular-csvw.js";
import * as slots from "./plugin-slots.ts";

const { extract } = slots.PIPELINE_IMPLEMENTATIONS["tabular-csvw"];

describe("tabular-csvw", () => {
  it("readsDelimitedTextWithoutMagic", () => {
    const r = extract(Buffer.from("name,age\nada,36\nalan,41\n"), { url: "p.csv", docId: "p", mimetype: null });
    expect(r?.$schema).toBe(TABULAR_CSVW_SCHEMA_ID);
    expect(JSON.stringify(r)).toContain("p.csv");
  });

  it("nullForNonTabularText", () => {
    expect(extract(Buffer.from("just a line of prose\n"), { url: "a.txt", docId: "a", mimetype: null })).toBeNull();
  });

  it("nullForFakeWorkbook", () => {
    expect(extract(Buffer.from("not a zip"), { url: "b.xlsx", docId: "b", mimetype: slots.XLSX_MIMETYPE })).toBeNull();
  });

  it("nullForUnreadableMimetype", () => {
    const ods = "application/vnd.oasis.opendocument.spreadsheet";
    expect(extract(Buffer.from("PK"), { url: "c.ods", docId: "c", mimetype: ods })).toBeNull();
  });

  it("pluginNodeNamesTable", () => {
    const node = JSON.parse(readFileSync(join(import.meta.dir, "..", "pipeline-plugins", "tabular-csvw.json"), "utf-8"));
    expect(node.slot).toBe("tabular-csvw");
    const [file, name] = String(node.implementation).split("#");
    expect(file).toBe("pipeline/plugin-slots.ts");
    expect(name in slots).toBe(true);
  });
});

/** An instance declaring library, references and glossary, with one promoted entry `doc` whose sections are `files`. */
function instance(files: Record<string, string> | undefined, graphs = ["library", "references", "glossary"]) {
  const root = mkdtempSync(join(tmpdir(), "entry-arms-"));
  const directories = graphs.map((g) => ({ id: g, path: `${g}/`, graphTypologies: [g] }));
  writeFileSync(join(root, "inst.json"), JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "inst", directories }));
  for (const g of graphs) mkdirSync(join(root, g), { recursive: true });
  const entry = join(root, "library", "doc");
  mkdirSync(entry, { recursive: true });
  writeFileSync(join(entry, "manifest.jsonld"), JSON.stringify({ title: "A handbook" }));
  if (files) {
    mkdirSync(join(entry, "sections"));
    for (const [f, t] of Object.entries(files)) writeFileSync(join(entry, "sections", f), t);
  }
  return { instanceRoot: root, library: join(root, "library"), entry, slug: "doc" };
}

const section = (title: string, body: string) => `---\nsection_title: "${title}"\n---\n${body}`;
const WITH_BOTH = {
  "sec-001-abbreviations.md": section("Abbreviations", "| Acronym | Expansion |\n|---|---|\n| WHO | World Health Organization |\n| HIS | Health information system |"),
  "sec-002-intro.md": section("Introduction", "Prose about health information systems."),
  "sec-009-references.md": section("References", "References\n1. A. Report number one on health. Geneva: WHO; 2001.\n2. B. Report number two on health. Geneva: WHO; 2002."),
};
/** The first declaration read loads the graph-typology registry, which is slow on a cold cache. */
const COLD = 30_000;
const arms = (ctx: ReturnType<typeof instance>) =>
  Object.fromEntries(slots.PIPELINE_IMPLEMENTATIONS["library-entry-arms"].arms(ctx).map((a) => [a.kind, a.run()]));

describe("library-entry-arms", () => {
  it("foundWritesNodesAndScheme", () => {
    const ctx = instance(WITH_BOTH);
    const k = arms(ctx);
    expect(k.references).toMatchObject({ state: "found", count: 2, tool: "references-extract" });
    expect(readdirSync(join(ctx.instanceRoot, "references")).sort()).toEqual(["doc.sec-009.1.json", "doc.sec-009.2.json"]);
    expect(k.glossary).toMatchObject({ state: "found", count: 2, tool: "glossary-from-source" });
    const g = JSON.parse(readFileSync(join(ctx.instanceRoot, "glossary", "doc.glossary.json"), "utf-8"));
    expect(g.id).toBe("doc");
    expect(g.title).toBe("A handbook");
    expect(g.terms.every((t: { status: string }) => t.status === "candidate")).toBe(true);
  }, COLD);

  it("noneOnlyWhenRan", () => {
    const k = arms(instance({ "sec-001-intro.md": section("Introduction", "Prose and nothing else.") }));
    expect(k.references).toMatchObject({ state: "none", count: 0 });
    expect(k.glossary).toMatchObject({ state: "none", count: 0 });
  }, COLD);

  it("notExtractedWithoutSections", () => {
    const k = arms(instance(undefined));
    expect(k.references?.state).toBe("not-extracted");
    expect(k.references?.note).toContain("sections/");
    expect(k.glossary?.state).toBe("not-extracted");
  }, COLD);

  it("notExtractedWithoutDirectory", () => {
    const k = arms(instance(WITH_BOTH, ["library"]));
    expect(k.references).toMatchObject({ state: "not-extracted" });
    expect(k.references?.note).toContain("references directory");
    expect(k.glossary).toMatchObject({ state: "not-extracted" });
    expect(k.glossary?.note).toContain("glossary directory");
  }, COLD);

  it("mergesIntoSchemeCitingEntry", () => {
    const ctx = instance(WITH_BOTH);
    const named = join(ctx.instanceRoot, "glossary", "handbook-2023.glossary.json");
    const authored = { id: "who", prefLabel: "World Health Organization", definition: "Adopted.", source: "library/doc/sections/sec-001-abbreviations.md#L5", status: "authored" };
    writeFileSync(named, JSON.stringify({ $schema: "folio-glossary/v1", id: "handbook-2023", title: "Handbook", terms: [authored] }));
    expect(arms(ctx).glossary?.state).toBe("found");
    expect(existsSync(join(ctx.instanceRoot, "glossary", "doc.glossary.json"))).toBe(false);
    const g = JSON.parse(readFileSync(named, "utf-8"));
    expect(g.terms[0]).toEqual(authored);
    expect(g.terms.map((t: { prefLabel: string }) => t.prefLabel)).toContain("Health information system");
  }, COLD);

  it("ingestRecordsEachStep", () => {
    const ctx = instance(WITH_BOTH);
    runEntryArms(slots.PIPELINE_IMPLEMENTATIONS["library-entry-arms"], ctx, "2026-11-14");
    const rec = JSON.parse(readFileSync(join(ctx.entry, "extraction.json"), "utf-8"));
    expect(rec.$schema).toBe("folio-library-extraction/v1");
    expect(rec.kinds.references).toMatchObject({ state: "found", count: 2 });
    expect(rec.kinds.glossary).toMatchObject({ state: "found", count: 2 });
  }, COLD);

  it("pluginNodeNamesTable", () => {
    const node = JSON.parse(readFileSync(join(import.meta.dir, "..", "pipeline-plugins", "library-entry-arms.json"), "utf-8"));
    expect(node.slot).toBe("library-entry-arms");
    const [file, name] = String(node.implementation).split("#");
    expect(file).toBe("pipeline/plugin-slots.ts");
    expect(name in slots).toBe(true);
  }, COLD);
});

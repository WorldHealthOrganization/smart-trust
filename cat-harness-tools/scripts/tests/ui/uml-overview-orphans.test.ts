/**
 * Bean `ghgn`: a retired layer's UML pages must not stay published. The
 * generator removes, and `--check` reports, what it would no longer write.
 *
 * Bean `f8wp` (Placement PR8, falsifier 3): `uml:overview` / `uml:overview:check`
 * emits one `.puml`/`.mmd` pair per declared sub-subgraph and none for an
 * undeclared one.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { instanceDirectories } from "../../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../../lib/roots.ts";
import { overviewFilesFor, sectionsOf, umlOrphans } from "../../gen-uml-overview.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function put(root: string, rel: string, body: unknown): void {
  const target = join(root, rel);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

describe("umlOrphans (ghgn)", () => {
  const written = new Map([["uml/overview/cat-harness.mmd", ""], ["docs/uml/overview/cat-harness.md", ""]]);
  const svgs = new Set(["img/uml/overview/cat-harness.svg"]);

  test("a retired instance's page, diagram and picture are orphans", () => {
    const existing = [
      ...written.keys(),
      ...svgs,
      "docs/uml/overview/detangle.md",
      "uml/overview/detangle/detangle-schemas.puml",
      "img/uml/overview/detangle.svg",
    ];
    expect(umlOrphans(existing, written, svgs)).toEqual([
      "docs/uml/overview/detangle.md",
      "uml/overview/detangle/detangle-schemas.puml",
      "img/uml/overview/detangle.svg",
    ]);
  });

  test("what this run writes is never an orphan", () => {
    expect(umlOrphans([...written.keys(), ...svgs], written, svgs)).toEqual([]);
  });

  test("a file of a kind the generator does not write is left alone", () => {
    expect(umlOrphans(["docs/uml/overview/notes.txt", "uml/overview/.gitkeep"], written, svgs)).toEqual([]);
  });

  test("a declared directory's README is readme:subgraphs' output, never an orphan (PR #2094)", () => {
    // Both overview roots are declared directories, so `readme:subgraphs`
    // writes a README into each. Treating it as an orphan made the two writers
    // alternate forever: this one deleted it, that one wrote it back.
    // declared-path-literal: fixture paths passed to the pure `umlOrphans`; nothing is read from disk.
    const existing = [...written.keys(), ...svgs, "docs/uml/overview/README.md", "img/uml/overview/README.md"];
    expect(umlOrphans(existing, written, svgs)).toEqual([]);
  });
});

describe("declared vs undeclared sub-subgraphs (f8wp falsifier 3)", () => {
  test("emits one .puml/.mmd pair per declared sub-subgraph and none for an undeclared one", async () => {
    const root = mkdtempSync(join(tmpdir(), "uml-subgraphs-"));
    made.push(root);
    const demo = join(root, "demo");
    put(demo, "demo.json", {
      name: "demo",
      needs: [],
      directories: [{ id: "schemas", path: "custom-schemas/", graphTypologies: ["schemas"] }],
    });
    mkdirSync(join(demo, "custom-schemas", "kg"), { recursive: true });
    put(demo, "custom-schemas/schemas.json", {
      $schema: "concern-groups/v1",
      groups: ["kg"],
      directories: [
        {
          id: "sub-declared",
          path: "declared/",
          subgraph: true,
          graphTypologies: ["schemas"],
        },
      ],
    });
    const sampleSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "SampleNode",
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } },
    };
    put(demo, "custom-schemas/declared/sample.schema.json", sampleSchema);
    put(demo, "custom-schemas/undeclared/rogue.schema.json", sampleSchema);

    const sections = await sectionsOf(demo);
    expect(sections.map((s) => s.id)).toEqual(["schemas", "sub-declared"]);

    const { files } = await overviewFilesFor([demo]);
    const writtenPaths = [...files.keys()].map((p) => p.replace(/\\/g, "/"));
    const demoDiagrams = writtenPaths
      .filter((p) => /\/demo(\/[^/]+)?\.(puml|mmd)$/.test(p))
      .map((p) => p.slice(p.lastIndexOf("/demo") + 1))
      .sort();
    expect(demoDiagrams).toEqual([
      "demo.mmd",
      "demo.puml",
      "demo/schemas.mmd",
      "demo/schemas.puml",
      "demo/sub-declared.mmd",
      "demo/sub-declared.puml",
    ]);
    expect(demoDiagrams.some((p) => p.includes("undeclared"))).toBe(false);
    expect(demoDiagrams.some((p) => p.includes("/kg."))).toBe(false);

    // If an undeclared sub-subgraph's .puml/.mmd pair is left on disk, umlOrphans flags both.
    const declaredSubPuml = writtenPaths.find((p) => p.endsWith("/demo/sub-declared.puml"))!;
    const undeclaredPuml = declaredSubPuml.replace("/sub-declared.puml", "/undeclared.puml");
    const undeclaredMmd = declaredSubPuml.replace("/sub-declared.puml", "/undeclared.mmd");
    expect(umlOrphans([...writtenPaths, undeclaredPuml, undeclaredMmd], files, new Set())).toEqual([
      undeclaredPuml,
      undeclaredMmd,
    ]);
  });

  // The Zod schemas, and `schemas/schemas.json` with them, live in
  // cat-harness-tools since bean `8lcl`, so the concern-groups declaration is
  // read off this repository's `cat-harness-tools-schemas` directory.
  test("cat-harness-tools resolves schemas/schemas.json as concern-groups/v1", async () => {
    const sections = await sectionsOf(TOOLS_ROOT);
    expect(sections.map((s) => s.id)).toEqual(instanceDirectories(TOOLS_ROOT).map((d) => d.id));

    const schemasSection = sections.find((s) => s.id === "cat-harness-tools-schemas")!;
    expect(schemasSection).toBeDefined();
    expect(schemasSection.undetermined.filter((u) => u.kind.startsWith("json"))).toEqual([]);
    expect(schemasSection.classes.some((c) => c.title === "concern-groups/v1" && c.source === "json: ConcernGroupsSchema")).toBe(true);
  });

  test("cat-harness emits one .puml/.mmd pair per declared directory/sub-subgraph", async () => {
    const expectedIds = instanceDirectories(HARNESS_ROOT).map((d) => d.id);
    const sections = await sectionsOf(HARNESS_ROOT);
    expect(sections.map((s) => s.id)).toEqual(expectedIds);

    const { files } = await overviewFilesFor([HARNESS_ROOT]);
    const writtenPaths = [...files.keys()].map((p) => p.replace(/\\/g, "/"));
    for (const id of expectedIds) {
      expect(writtenPaths.some((p) => p.endsWith(`/cat-harness/${id}.puml`))).toBe(true);
      expect(writtenPaths.some((p) => p.endsWith(`/cat-harness/${id}.mmd`))).toBe(true);
    }
    const subPairs = writtenPaths.filter((p) => /\/cat-harness\/[^/]+\.(puml|mmd)$/.test(p));
    expect(subPairs.length).toBe(expectedIds.length * 2);
  });
});

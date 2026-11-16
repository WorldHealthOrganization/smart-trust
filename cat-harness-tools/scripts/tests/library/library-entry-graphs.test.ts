/**
 * A library entry's DECLARED sub-graphs are found, and only those — bean 8pzh
 * item 1. Owner, 2026-10-12: L1 extraction output stays beside its library
 * entry AND is published with it, "if its a part of the KG it should be
 * published". The publisher follows the declaration, never a filename, so the
 * cases that matter are the ones a filename rule would get wrong.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GraphTypologyRegistry } from "../../../schemas/kg/graph-typology-registry.js";
import { entryGraphFiles, entryGraphSitePath } from "../../lib/library-entry-graphs.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function registry(): GraphTypologyRegistry {
  const reg = new GraphTypologyRegistry();
  reg.register("probe-extraction", { renderable: false, holds: "derived", summary: "x", within: "library" });
  reg.register("probe-hidden", { renderable: false, holds: "derived", summary: "x", within: "library", published: false });
  reg.register("probe-loose", { renderable: false, holds: "derived", summary: "x" });
  return reg;
}

/** An instance `fixture` with a library of two entries; `extra` directories are declared beside `library/`. */
function fixture(extra: { id: string; path: string; graphTypologies: string[] }[]): string {
  const root = mkdtempSync(join(tmpdir(), "entry-graphs-"));
  made.push(root);
  const put = (rel: string, body: string): void => {
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), body);
  };
  put("library/e1/manifest.jsonld", "{}");
  put("library/e1/out/graph.l1.json", JSON.stringify({ "@context": "http://example.org/ctx", id: "x" }));
  put("library/e1/out/sub/scen.l2.json", JSON.stringify({ "@context": "http://example.org/ctx" }));
  put("library/e1/out/notes.md", "# notes\n");
  put("library/e1/out/candidates.json", JSON.stringify({ $schema: "probe/v1" }));
  put("library/e1/undeclared/graph.json", JSON.stringify({ "@context": "http://example.org/ctx" }));
  put("library/e2/manifest.jsonld", "{}");
  put(
    "fixture.json",
    JSON.stringify({
      $schema: "cat-harness-declaration/1.0.0",
      name: "fixture",
      directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }, ...extra],
    }),
  );
  return root;
}

describe("entryGraphFiles", () => {
  test("every file of a declared within-library directory, by its path in the entry; JSON-LD is marked", () => {
    const root = fixture([{ id: "e1-out", path: "library/e1/out/", graphTypologies: ["probe-extraction"] }]);
    const files = entryGraphFiles(join(root, "library/e1"), registry());
    expect(files.map((f) => [f.rel, f.kind, f.jsonld])).toEqual([
      ["out/candidates.json", "probe-extraction", false],
      ["out/graph.l1.json", "probe-extraction", true],
      ["out/notes.md", "probe-extraction", false],
      ["out/sub/scen.l2.json", "probe-extraction", true],
    ]);
  });

  test("an UNDECLARED directory in the entry is not published, whatever it holds", () => {
    const root = fixture([{ id: "e1-out", path: "library/e1/out/", graphTypologies: ["probe-extraction"] }]);
    expect(entryGraphFiles(join(root, "library/e1"), registry()).some((f) => f.rel.startsWith("undeclared/"))).toBe(false);
  });

  test("nothing without a declaration — the files on disk are not enough", () => {
    const root = fixture([]);
    expect(entryGraphFiles(join(root, "library/e1"), registry())).toEqual([]);
  });

  test("a kind that is not within library, or is unpublished, publishes nothing", () => {
    const loose = fixture([{ id: "e1-out", path: "library/e1/out/", graphTypologies: ["probe-loose"] }]);
    expect(entryGraphFiles(join(loose, "library/e1"), registry())).toEqual([]);
    const hidden = fixture([{ id: "e1-out", path: "library/e1/out/", graphTypologies: ["probe-hidden"] }]);
    expect(entryGraphFiles(join(hidden, "library/e1"), registry())).toEqual([]);
  });

  test("a declaration inside ONE entry is not another entry's", () => {
    const root = fixture([{ id: "e1-out", path: "library/e1/out/", graphTypologies: ["probe-extraction"] }]);
    expect(entryGraphFiles(join(root, "library/e2"), registry())).toEqual([]);
  });
});

describe("entryGraphSitePath", () => {
  test("under the entry IRI, keeping the path inside the entry", () => {
    expect(entryGraphSitePath("some-instance", "an-entry", "l1-extraction/recommendations.l1.json")).toBe(
      "assets/library/jsonld/some-instance/source/an-entry/l1-extraction/recommendations.l1.json",
    );
  });
});

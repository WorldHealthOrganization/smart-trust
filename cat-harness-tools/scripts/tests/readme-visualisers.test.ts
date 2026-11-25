/**
 * Where a declared directory is SEEN, resolved for its README (owner,
 * 2026-11-18: "each mounted subgraph/dir has a visualizer as required").
 *
 * The visualisers come from the declarations and the address from the site
 * the checkout publishes; nothing is invented, and an address that cannot be
 * determined is said to be so.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { readmeOwesVisualiser, readmeVisualisers } from "../readme-visualisers.ts";
import { clearDeclaredVisualisers, PAGE_LOCALE, subgraphCandidates, visualisersReaching } from "../viewer-declarations.ts";

/** `base` (named cat-harness) declares the visualisers; `top` needs it and declares a library. */
function fixture(): string {
  const repo = mkdtempSync(join(tmpdir(), "readme-vis-"));
  const files: Record<string, unknown> = {
    "base/cat-harness.json": {
      name: "cat-harness",
      directories: [{ id: "todos", path: "todos/", graphTypologies: ["todos"] }],
      visualisers: [
        { id: "library", renderedBy: "library-viewer", coversKinds: ["library"], subgraphs: "instance" },
        { id: "shelf", renderedBy: "shelf-page", coversKinds: ["library", "references"], subgraphs: "directory", title: "Shelf" },
        { id: "todos", renderedBy: "state-viewer", covers: ["todos"], title: "Todos" },
      ],
    },
    "top/top.json": {
      name: "top",
      needs: ["cat-harness"],
      directories: [{ id: "top-library", path: "library/", graphTypologies: ["library"] }],
    },
  };
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(join(repo, dirname(f)), { recursive: true });
    writeFileSync(join(repo, f), JSON.stringify(body));
  }
  for (const d of ["base/todos", "top/library"]) mkdirSync(join(repo, d), { recursive: true });
  clearDeclaredVisualisers();
  return repo;
}

const lib = { id: "top-library", path: "library/", graphTypologies: ["library"] };

describe("which pages render a directory, at what address", () => {
  test("every visualiser covering the directory's kind, under the declared route and the site address", () => {
    const repo = fixture();
    const got = readmeVisualisers(lib, "top", join(repo, "top"), repo, join(repo, "top/library"), "https://e.org/site");
    expect(got).toEqual([
      { title: "Library", href: `https://e.org/site/${PAGE_LOCALE}/cat-harness/library/top/`, undetermined: "" },
      { title: "Shelf", href: `https://e.org/site/${PAGE_LOCALE}/cat-harness/shelf/top-top-library/`, undetermined: "" },
    ]);
  });

  test("a visualiser covering by id reaches its own harness's directory only", () => {
    const repo = fixture();
    const todos = { id: "todos", path: "todos/", graphTypologies: ["todos"] };
    expect(readmeVisualisers(todos, "cat-harness", join(repo, "base"), repo, join(repo, "base/todos"), "https://e.org").map((v) => v.href)).toEqual([
      `https://e.org/${PAGE_LOCALE}/cat-harness/todos/`,
    ]);
    expect(readmeVisualisers(todos, "top", join(repo, "top"), repo, join(repo, "top/todos"), "https://e.org")).toEqual([]);
  });

  test("no site address: the title is kept, the href is empty, and the README is told why", () => {
    const repo = fixture();
    const got = readmeVisualisers(lib, "top", join(repo, "top"), repo, join(repo, "top/library"), undefined);
    expect(got.map((v) => v.href)).toEqual(["", ""]);
    expect(got[0]!.undetermined).toContain("readme.pagesBaseUrl");
  });

  test("the sub-graph segment is the one viewersOf uses", () => {
    const repo = fixture();
    const shelf = visualisersReaching(repo, join(repo, "top")).find((v) => v.id === "shelf")!;
    expect(subgraphCandidates(shelf, lib, "top")).toEqual(["top-top-library", "top-library"]);
  });
});

describe("whether a directory owes one", () => {
  test("a kind that is not content owes one; a renderable kind does not", () => {
    expect(readmeOwesVisualiser("top", { id: "b", path: "b/", graphTypologies: ["beans"] })).toBe(true);
    expect(readmeOwesVisualiser("top", { id: "f", path: "f/", graphTypologies: ["folio"] })).toBe(false);
  });
  test("a waiver with a reason, and the bootstrap layer, owe none", () => {
    const waived = { id: "b", path: "b/", graphTypologies: ["beans"], coverage: { exempt: { visualiser: "read at session start" } } };
    expect(readmeOwesVisualiser("top", waived)).toBe(false);
    expect(readmeOwesVisualiser("bootstrap", { id: "b", path: "b/", graphTypologies: ["beans"] })).toBe(false);
  });
});

/**
 * Graph-aware search — seeds lexically, expands structurally.
 *
 * The fixture mirrors `graph-index.test.ts`: a small authored chapter and a
 * small ingested document, so the authored/ingested split the search reports
 * is exercised for real rather than asserted about one population.
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { mkdtempSync } from "fs";

import {
  type GraphIndex,
  loadGraphIndex,
  defaultRoots,
} from "../../../pipeline/graph-index";
import { graphSearch, formatPath } from "../../../pipeline/graph-search";

let ROOT: string;
let index: GraphIndex;

function node(dir: string, name: string, doc: Record<string, unknown>): void {
  writeFileSync(join(dir, `${name}.jsonld`), `${JSON.stringify(doc, null, 2)}\n`);
}

beforeAll(() => {
  ROOT = mkdtempSync(join(tmpdir(), "graph-search-"));
  const CONTENT = join(ROOT, "folio", "qou", "ch01");
  const LIBRARY = join(ROOT, "library", "src-1", "nodes");
  mkdirSync(CONTENT, { recursive: true });
  mkdirSync(LIBRARY, { recursive: true });

  // `thm:main` never says "widget"; it only USES the thing that does. That is
  // the whole point of expanding — a lexical search cannot reach it.
  node(CONTENT, "def-widget", {
    "@id": "b/def-widget", "@type": ["folio-assistant-core:Definition"],
    label: "def:widget", kind: "definition", title: "A widget",
    tags: ["algebra"], provenance: "authored",
  });
  node(CONTENT, "thm-main", {
    "@id": "b/thm-main", "@type": ["folio-assistant-core:Theorem"],
    label: "thm:main", kind: "theorem", title: "Main theorem",
    uses: ["b/def-widget"], provenance: "authored",
  });
  node(CONTENT, "cor-far", {
    "@id": "b/cor-far", "@type": ["folio-assistant-core:Corollary"],
    label: "cor:far", kind: "corollary", uses: ["b/thm-main"],
    provenance: "authored",
  });
  node(LIBRARY, "rec-7", {
    "@id": "l/rec-7", "@type": ["folio-assistant-core:Recommendation"],
    title: "Screening for widget deficiency", provenance: "ingested",
  });

  index = loadGraphIndex(defaultRoots(ROOT));
});

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

describe("graphSearch", () => {
  test("hops: 0 reproduces a pure lexical search", () => {
    const r = graphSearch(index, "widget", { hops: 0 });
    expect(r.summary.expanded).toBe(0);
    expect(r.hits.every((h) => h.reason.via === "match")).toBe(true);
    // both populations say "widget"
    expect(r.summary.seeds).toBe(2);
  });

  test("expansion reaches a node that does NOT contain the query", () => {
    const r = graphSearch(index, "widget", { hops: 1, direction: "both" });
    const ids = r.hits.map((h) => h.id);
    expect(ids).toContain("b/thm-main");
    const thm = r.hits.find((h) => h.id === "b/thm-main")!;
    expect(thm.reason.via).toBe("graph");
    if (thm.reason.via === "graph") {
      expect(thm.reason.seed).toBe("b/def-widget");
      expect(thm.reason.hops).toBe(1);
    }
  });

  test("a backwards-traversed edge keeps its path and is marked reversed", () => {
    // `thm:main` uses `def:widget`, so from the seed `def:widget` this edge is
    // INCOMING. `neighbors` orients every edge by the graph (`from` -> `to`),
    // not by travel, so the reached node arrives as the edge's `from`. Keying
    // the path on `to` alone left it empty and the hop rendered `via ?` —
    // measured on the qou corpus at 20 of 50 graph-reached nodes, all of them
    // the incoming half of the default `direction: "both"`.
    const r = graphSearch(index, "widget", { hops: 1, direction: "both" });
    const thm = r.hits.find((h) => h.id === "b/thm-main")!;
    expect(thm.reason.via).toBe("graph");
    if (thm.reason.via === "graph") {
      expect(thm.reason.path).toEqual([{ edge: "uses", dir: "in" }]);
      expect(formatPath(thm.reason.path)).toBe("~uses");
    }
  });

  test("direction distinguishes who depends on whom", () => {
    // The same `uses` edge, seeded from the other end, is traversed forwards.
    // Without `dir` both render `uses` and the two opposite facts — "the seed
    // depends on this" and "this depends on the seed" — are indistinguishable.
    const r = graphSearch(index, "Main theorem", { hops: 1, direction: "both" });
    const def = r.hits.find((h) => h.id === "b/def-widget")!;
    expect(def.reason.via).toBe("graph");
    if (def.reason.via === "graph") {
      expect(def.reason.path).toEqual([{ edge: "uses", dir: "out" }]);
      expect(formatPath(def.reason.path)).toBe("uses");
    }
  });

  test("hop depth is respected", () => {
    const one = graphSearch(index, "widget", { hops: 1, direction: "both" });
    const two = graphSearch(index, "widget", { hops: 2, direction: "both" });
    expect(one.hits.map((h) => h.id)).not.toContain("b/cor-far");
    expect(two.hits.map((h) => h.id)).toContain("b/cor-far");
  });

  test("a seed is never demoted to an expansion", () => {
    const r = graphSearch(index, "widget", { hops: 2, direction: "both" });
    const w = r.hits.find((h) => h.id === "b/def-widget")!;
    expect(w.reason.via).toBe("match");
  });

  test("seeds sort before graph-reached nodes", () => {
    const r = graphSearch(index, "widget", { hops: 2, direction: "both" });
    const firstGraph = r.hits.findIndex((h) => h.reason.via === "graph");
    const lastMatch = r.hits.map((h) => h.reason.via).lastIndexOf("match");
    expect(lastMatch).toBeLessThan(firstGraph);
  });

  test("provenance is reported split, not merged", () => {
    const r = graphSearch(index, "widget", { hops: 1 });
    expect(r.summary.seedsByProvenance.authored).toBe(1);
    expect(r.summary.seedsByProvenance.ingested).toBe(1);
  });

  test("a present-but-empty root is reported, not silently zero", () => {
    const empty = mkdtempSync(join(tmpdir(), "graph-search-empty-"));
    mkdirSync(join(empty, "folio"), { recursive: true });
    mkdirSync(join(empty, "library"), { recursive: true });
    try {
      const idx = loadGraphIndex(defaultRoots(empty));
      const r = graphSearch(idx, "anything");
      expect(r.hits).toHaveLength(0);
      // The distinction that matters: nothing MATCHED vs nothing was SEARCHED.
      expect(r.emptyRoots.map((e) => e.name).sort()).toEqual(["folio", "library"]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  test("a populated index reports no empty roots", () => {
    expect(graphSearch(index, "widget").emptyRoots).toHaveLength(0);
  });

  test("no lexical seed means no expansion — the graph cannot rescue a miss", () => {
    const r = graphSearch(index, "torsion", { hops: 3 });
    expect(r.summary.noSeeds).toBe(true);
    expect(r.hits).toHaveLength(0);
  });
});

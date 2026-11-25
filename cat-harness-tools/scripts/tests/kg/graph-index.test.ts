/**
 * The graph index is the point of the `.jsonld` siblings: authored blocks and
 * ingested document nodes become one population, so one walk and one
 * `JSON.parse` serve both. These tests build both populations as fixtures —
 * `library/**` nodes cannot come from the real corpus yet because the ingest
 * writer is unbuilt, and folio-assistant holds no papers either.
 *
 * Three behaviours here are load-bearing rather than incidental:
 *
 *  - **Reverse edges.** "What breaks if this changes?" needs incoming
 *    adjacency, which nothing in the repo builds today without a full scan.
 *  - **Honest emptiness.** A root that does not exist must be distinguishable
 *    from a root with nothing in it, per the §5 integration contract's rule
 *    that an absent input reads as `n/a` and never as a clean pass.
 *  - **No silent truncation.** Both the result cap and the text-scan cap are
 *    reported, because a capped result that looks complete is worse than one
 *    that says it was capped.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  loadGraphIndex,
  searchGraph,
  neighbors,
  findNode,
  graphStats,
  parseNode,
  defaultRoots,
  type GraphIndex,
} from "../../../pipeline/graph-index";
import { assertEdgeTermsAreIdTyped, GRAPH_EDGE_TERMS } from "../../../schemas/kg/jsonld.ts";

const ROOT = mkdtempSync(join(tmpdir(), "graph-index-"));
const CONTENT = join(ROOT, "folio", "qou", "ch01");
const LIBRARY = join(ROOT, "library", "who-anc-2016", "nodes");

let index: GraphIndex;

function node(dir: string, name: string, doc: Record<string, unknown>): void {
  writeFileSync(join(dir, `${name}.jsonld`), `${JSON.stringify(doc, null, 2)}\n`);
}

beforeAll(() => {
  mkdirSync(CONTENT, { recursive: true });
  mkdirSync(LIBRARY, { recursive: true });

  node(CONTENT, "def-widget", {
    "@id": "papers/qou/blocks/def-widget",
    "@type": ["folio-assistant-core:Definition", "doco:Section"],
    label: "def:widget",
    kind: "definition",
    title: "A widget",
    tags: ["algebra"],
    text: "def-widget.md",
    provenance: "authored",
  });
  writeFileSync(join(CONTENT, "def-widget.md"), "A widget is a gadget with torsion.\n");

  node(CONTENT, "thm-main", {
    "@id": "papers/qou/blocks/thm-main",
    "@type": ["folio-assistant-core:Theorem", "doco:Section"],
    label: "thm:main",
    kind: "theorem",
    title: "Main theorem",
    uses: ["papers/qou/blocks/def-widget", "papers/qou/blocks/def-missing"],
    provenance: "authored",
  });

  node(CONTENT, "cor-easy", {
    "@id": "papers/qou/blocks/cor-easy",
    "@type": ["folio-assistant-core:Corollary"],
    label: "cor:easy",
    kind: "corollary",
    uses: ["papers/qou/blocks/thm-main"],
    provenance: "authored",
  });

  // Ingested population — written directly, no .ts anywhere.
  node(LIBRARY, "rec-007", {
    "@id": "library/who-anc-2016/nodes/rec-007",
    "@type": ["folio-assistant-core:Recommendation", "doco:Section"],
    title: "Recommendation A.1.2 on widget screening",
    contains: ["library/who-anc-2016/nodes/rem-014"],
    provenance: "ingested",
  });
  node(LIBRARY, "rem-014", {
    "@id": "library/who-anc-2016/nodes/rem-014",
    "@type": ["folio-assistant-core:Remark"],
    title: "Remarks",
    provenance: "ingested",
  });

  // Not a node: no @id. Must be skipped without erroring.
  node(LIBRARY, "manifest", { "@type": ["folio-assistant-core:Manifest"], title: "no id here" });

  index = loadGraphIndex(defaultRoots(ROOT));
});

afterAll(() => {
  try {
    rmSync(ROOT, { recursive: true, force: true });
  } catch {}
});

describe("edge term contract", () => {
  test("every graph edge term is @id-typed in the published context", () => {
    expect(() => assertEdgeTermsAreIdTyped()).not.toThrow();
  });

  test("companion file links are not traversable edges", () => {
    expect(GRAPH_EDGE_TERMS as readonly string[]).not.toContain("text");
    expect(GRAPH_EDGE_TERMS as readonly string[]).not.toContain("leanSource");
  });
});

describe("loading both populations", () => {
  test("one walk picks up authored and ingested nodes alike", () => {
    expect(index.nodes.size).toBe(5);
    const stats = graphStats(index) as { byProvenance: Record<string, number> };
    expect(stats.byProvenance).toEqual({ authored: 3, ingested: 2 });
  });

  test("a document without @id is skipped, not treated as malformed", () => {
    expect(index.malformed).toEqual([]);
  });

  test("companion .md is resolved relative to the .jsonld", () => {
    const n = findNode(index, "def:widget")!;
    expect(n.textFile?.endsWith("def-widget.md")).toBe(true);
  });

  test("nodes resolve by @id and by authored label", () => {
    expect(findNode(index, "papers/qou/blocks/thm-main")?.label).toBe("thm:main");
    expect(findNode(index, "thm:main")?.id).toBe("papers/qou/blocks/thm-main");
  });
});

describe("honest emptiness", () => {
  test("an absent root is reported as absent, not as empty", () => {
    const idx = loadGraphIndex([
      { name: "folio", dir: join(ROOT, "folio") },
      { name: "library", dir: join(ROOT, "nope") },
    ]);
    const lib = idx.roots.find((r) => r.name === "library")!;
    expect(lib.present).toBe(false);
    expect(lib.nodes).toBe(0);
  });

  test("a colliding @id is recorded rather than silently overwritten", () => {
    const dup = mkdtempSync(join(tmpdir(), "graph-dup-"));
    mkdirSync(join(dup, "folio"), { recursive: true });
    node(join(dup, "folio"), "a", { "@id": "same/id", title: "first" });
    node(join(dup, "folio"), "b", { "@id": "same/id", title: "second" });
    const idx = loadGraphIndex([{ name: "folio", dir: join(dup, "folio") }]);
    expect(idx.nodes.size).toBe(1);
    expect(idx.malformed).toHaveLength(1);
    expect(idx.malformed[0]!.error).toContain("already claimed");
    rmSync(dup, { recursive: true, force: true });
  });
});

describe("search", () => {
  test("matches metadata across both populations", () => {
    const r = searchGraph(index, "widget");
    const ids = r.hits.map((h) => h.id).sort();
    expect(ids).toEqual([
      "library/who-anc-2016/nodes/rec-007",
      "papers/qou/blocks/def-widget",
    ]);
  });

  test("provenance filter separates the populations", () => {
    expect(searchGraph(index, "widget", { provenance: "ingested" }).hits).toHaveLength(1);
    expect(searchGraph(index, "widget", { provenance: "authored" }).hits).toHaveLength(1);
  });

  test("reports which field matched", () => {
    const r = searchGraph(index, "Main theorem");
    expect(r.hits[0]!.matchedIn).toBe("title");
  });

  test("body text is only searched when asked, and yields a snippet", () => {
    expect(searchGraph(index, "torsion").hits).toHaveLength(0);
    const r = searchGraph(index, "torsion", { searchText: true });
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0]!.matchedIn).toBe("text");
    expect(r.hits[0]!.snippet).toContain("torsion");
    expect(r.textFilesScanned).toBeGreaterThan(0);
  });

  test("truncation is visible — totalMatches exceeds the returned hits", () => {
    const r = searchGraph(index, "e", { limit: 1 });
    expect(r.hits).toHaveLength(1);
    expect(r.totalMatches).toBeGreaterThan(1);
  });

  test("the text-scan cap reports itself rather than quietly stopping", () => {
    const r = searchGraph(index, "torsion", { searchText: true, maxTextFiles: 0 });
    expect(r.textScanTruncated).toBe(true);
    expect(r.hits).toHaveLength(0);
  });
});

describe("neighbors", () => {
  test("outbound follows dependencies", () => {
    const r = neighbors(index, "thm:main") as { edges: Array<{ to: string }> };
    expect(r.edges.map((e) => e.to)).toContain("papers/qou/blocks/def-widget");
  });

  test("inbound answers 'what breaks if this changes?'", () => {
    const r = neighbors(index, "def:widget", { direction: "in" }) as {
      edges: Array<{ from: string }>;
    };
    expect(r.edges.map((e) => e.from)).toEqual(["papers/qou/blocks/thm-main"]);
  });

  test("multi-hop inbound reaches a transitive dependent", () => {
    const r = neighbors(index, "def:widget", { direction: "in", hops: 2 }) as {
      nodes: Array<{ id: string }>;
    };
    expect(r.nodes.map((n) => n.id).sort()).toEqual([
      "papers/qou/blocks/cor-easy",
      "papers/qou/blocks/def-widget",
      "papers/qou/blocks/thm-main",
    ]);
  });

  test("an edge to a missing node is reported as dangling, not dropped", () => {
    const r = neighbors(index, "thm:main") as { dangling: string[] };
    expect(r.dangling).toEqual(["papers/qou/blocks/def-missing"]);
  });

  test("traverses ingested containment with the same call", () => {
    const r = neighbors(index, "library/who-anc-2016/nodes/rec-007") as {
      edges: Array<{ from: string; to: string; edge: string; hop: number }>;
    };
    expect(r.edges).toEqual([
      {
        from: "library/who-anc-2016/nodes/rec-007",
        to: "library/who-anc-2016/nodes/rem-014",
        edge: "contains",
        hop: 1,
      },
    ]);
  });

  test("edge filter restricts traversal", () => {
    const r = neighbors(index, "thm:main", { edges: ["cites"] }) as { edges: unknown[] };
    expect(r.edges).toHaveLength(0);
  });

  test("an unknown seed is an error, not an empty neighbourhood", () => {
    expect(neighbors(index, "def:nope")).toEqual({ error: 'No node for "def:nope"' });
  });

  test("node cap reports truncation", () => {
    const r = neighbors(index, "def:widget", {
      direction: "in",
      hops: 3,
      maxNodes: 1,
    }) as { truncated: boolean };
    expect(r.truncated).toBe(true);
  });
});

describe("parseNode", () => {
  test("returns undefined for a document with no @id", () => {
    expect(parseNode("/x.jsonld", JSON.stringify({ title: "x" }))).toBeUndefined();
  });

  test("accepts a single string where a set is allowed", () => {
    const n = parseNode(
      "/x.jsonld",
      JSON.stringify({ "@id": "a", uses: "b", "@type": "folio-assistant-core:Theorem" }),
    )!;
    expect(n.edges.uses).toEqual(["b"]);
    expect(n.types).toEqual(["folio-assistant-core:Theorem"]);
  });
});

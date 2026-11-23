/**
 * The MCP graph tools' handlers, driven the way the server drives them.
 *
 * These lived inside `server.ts`'s `executeTool` — a nested function in a
 * request handler — so the wiring between a declared tool and its
 * implementation was covered by `tsc` and nothing else. That is exactly where
 * the last two defects in this work were: an `@id` placeholder that collided
 * twelve real blocks, and a `paths` object that never carried the companions
 * the type system had learned about. Both typechecked cleanly.
 *
 * So the handlers moved to `tools/graph.ts` and these tests call them.
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  executeGraphTool,
  isGraphTool,
  invalidateGraphIndex,
  GRAPH_TOOL_NAMES,
} from "../adapters/mcp-server/tools/graph";

const ROOT = mkdtempSync(join(tmpdir(), "mcp-graph-"));
const CONTENT = join(ROOT, "folio", "qou", "ch01");
const LIBRARY = join(ROOT, "library", "doc-1", "blocks");
const ROOTS = [
  { name: "folio", dir: join(ROOT, "folio") },
  { name: "library", dir: join(ROOT, "library") },
];

const call = (name: string, input: Record<string, unknown> = {}) =>
  JSON.parse(executeGraphTool(name, input, ROOTS)!);

beforeAll(() => {
  mkdirSync(CONTENT, { recursive: true });
  mkdirSync(LIBRARY, { recursive: true });
  const w = (dir: string, n: string, d: Record<string, unknown>) =>
    writeFileSync(join(dir, `${n}.jsonld`), JSON.stringify(d, null, 2));

  w(CONTENT, "def-widget", {
    "@id": "papers/qou/blocks/def-widget",
    label: "def:widget",
    kind: "definition",
    title: "A widget",
    provenance: "authored",
  });
  w(CONTENT, "thm-main", {
    "@id": "papers/qou/blocks/thm-main",
    label: "thm:main",
    kind: "theorem",
    title: "Widget theorem",
    uses: ["papers/qou/blocks/def-widget"],
    provenance: "authored",
  });
  w(CONTENT, "cor-scaling", {
    "@id": "papers/qou/blocks/cor-scaling",
    label: "cor:scaling",
    kind: "corollary",
    // Deliberately says nothing about widgets: it is reachable ONLY through
    // the graph, which is the whole difference from search_graph.
    title: "Asymptotic scaling law",
    uses: ["papers/qou/blocks/thm-main"],
    provenance: "authored",
  });
  w(LIBRARY, "prose-sec-000", {
    "@id": "library/doc-1/blocks/prose-sec-000",
    kind: "prose",
    title: "Introduction to widgets",
    provenance: "ingested",
  });

  invalidateGraphIndex();
});

afterAll(() => {
  try {
    rmSync(ROOT, { recursive: true, force: true });
  } catch {}
  invalidateGraphIndex();
});

describe("dispatch", () => {
  test("owns exactly the four declared tools", () => {
    expect([...GRAPH_TOOL_NAMES].sort()).toEqual([
      "corpus_search",
      "get_graph_stats",
      "get_neighbors",
      "search_graph",
    ]);
    for (const n of GRAPH_TOOL_NAMES) expect(isGraphTool(n)).toBe(true);
  });

  test("returns undefined for a tool it does not own, rather than guessing", () => {
    expect(executeGraphTool("get_block", {}, ROOTS)).toBeUndefined();
  });

  test("every handler returns parseable JSON", () => {
    for (const n of GRAPH_TOOL_NAMES) {
      expect(() => JSON.parse(executeGraphTool(n, { query: "x", id: "def:widget" }, ROOTS)!)).not.toThrow();
    }
  });
});

describe("search_graph", () => {
  test("spans both populations — the thing search_blocks cannot do", () => {
    const r = call("search_graph", { query: "widget" });
    expect(r.hits.map((h: { provenance: string }) => h.provenance).sort()).toEqual([
      "authored",
      "authored",
      "ingested",
    ]);
  });

  test("provenance narrows to one population", () => {
    expect(call("search_graph", { query: "widget", provenance: "ingested" }).hits).toHaveLength(1);
  });

  test("truncation is reported, never silent", () => {
    const r = call("search_graph", { query: "widget", limit: 1 });
    expect(r.hits).toHaveLength(1);
    expect(r.totalMatches).toBe(3);
  });

  test("a missing query returns an empty result rather than everything", () => {
    expect(call("search_graph", {}).hits).toEqual([]);
  });
});

describe("get_neighbors", () => {
  test("resolves an authored label, not just an @id", () => {
    expect(call("get_neighbors", { id: "thm:main" }).seed).toBe("papers/qou/blocks/thm-main");
  });

  test("direction 'in' answers what breaks if this changes", () => {
    const r = call("get_neighbors", { id: "def:widget", direction: "in" });
    expect(r.edges.map((e: { from: string }) => e.from)).toEqual(["papers/qou/blocks/thm-main"]);
  });

  test("an unknown seed is an error, not an empty neighbourhood", () => {
    expect(call("get_neighbors", { id: "def:nope" }).error).toContain("No node");
  });

  test("an unknown edge term is reported, not silently dropped", () => {
    // Dropping it would answer a narrower question than the caller asked.
    const r = call("get_neighbors", { id: "thm:main", edges: ["uses", "bogus"] });
    expect(r.error).toContain("bogus");
    expect(r.known).toContain("uses");
  });

  test("a valid edge filter still works", () => {
    expect(call("get_neighbors", { id: "thm:main", edges: ["uses"] }).edges).toHaveLength(1);
  });
});

describe("get_graph_stats", () => {
  test("reports both roots and their counts", () => {
    const s = call("get_graph_stats");
    expect(s.nodes).toBe(4);
    expect(s.byProvenance).toEqual({ authored: 3, ingested: 1 });
  });

  test("an absent root is reported absent, so 'not built' differs from 'no match'", () => {
    const s = JSON.parse(
      executeGraphTool("get_graph_stats", { refresh: true }, [
        { name: "folio", dir: join(ROOT, "folio") },
        { name: "library", dir: join(ROOT, "nope") },
      ])!,
    );
    expect(s.roots.find((r: { name: string }) => r.name === "library").present).toBe(false);
    invalidateGraphIndex();
  });
});

describe("corpus_search", () => {
  test("reaches a node that does not contain the query", () => {
    // `cor:scaling` says nothing about widgets; it is two hops from the seeds
    // through `uses`. This is the case a lexical search structurally cannot
    // answer, and the reason the tool exists.
    const r = call("corpus_search", { query: "widget", hops: 2 });
    const ids = r.hits.map((h: { id: string }) => h.id);
    expect(ids).toContain("papers/qou/blocks/cor-scaling");
    const hit = r.hits.find((h: { id: string }) => h.id === "papers/qou/blocks/cor-scaling");
    expect(hit.why).toMatch(/hop via/);
  });

  test("hops: 0 is exactly search_graph", () => {
    const c = call("corpus_search", { query: "widget", hops: 0 });
    const s = call("search_graph", { query: "widget" });
    expect(c.hits.map((h: { id: string }) => h.id).sort()).toEqual(
      s.hits.map((h: { id: string }) => h.id).sort(),
    );
    expect(c.summary.expanded).toBe(0);
  });

  test("says whether a hit MATCHED or was REACHED, and which way the edge ran", () => {
    // `uses` and `~uses` are opposite facts about who depends on whom, so a
    // reason that omitted the direction would be worse than no reason.
    const r = call("corpus_search", { query: "Widget theorem", hops: 1 });
    const why = Object.fromEntries(
      r.hits.map((h: { label: string; why: string }) => [h.label, h.why]),
    );
    expect(why["thm:main"]).toMatch(/^match:/);
    expect(why["def:widget"]).toBe("1hop via uses from papers/qou/blocks/thm-main");
    expect(why["cor:scaling"]).toBe("1hop via ~uses from papers/qou/blocks/thm-main");
  });

  test("splits counts by provenance rather than merging them", () => {
    // "Open in this corpus" and "settled in a paper we hold" are different
    // verdicts; a merged total cannot express either.
    const r = call("corpus_search", { query: "widget", hops: 0 });
    expect(r.summary.seedsByProvenance.authored).toBe(2);
    expect(r.summary.seedsByProvenance.ingested).toBe(1);
  });

  test("a query that seeds on nothing says so, rather than looking like an absence", () => {
    const r = call("corpus_search", { query: "torsion", hops: 3 });
    expect(r.summary.noSeeds).toBe(true);
    expect(r.hits).toHaveLength(0);
  });
});

/**
 * The handlers above were reachable only through the viewer server's embedded
 * chat agent, so an MCP client calling `corpus_search` got "Tool not found"
 * (qou bean `qou-q261`). `src/tools/graph.ts` registers them on the MCP
 * surface; these tests drive it through a real MCP client over an in-memory
 * transport, the way an agent session's client reaches it.
 */
describe("served over MCP (src/tools/graph.ts)", () => {
  async function connected() {
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
    const { registerGraphTools } = await import("../src/tools/graph");
    const server = new McpServer({ name: "graph-test", version: "0" });
    registerGraphTools(server, ROOT);
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "graph-test-client", version: "0" });
    await Promise.all([server.connect(a), client.connect(b)]);
    return client;
  }

  test("tools/list carries all four graph tools", async () => {
    const client = await connected();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    for (const n of GRAPH_TOOL_NAMES) expect(names).toContain(n);
    await client.close();
  });

  test("tools/call corpus_search answers over the folio and library roots", async () => {
    invalidateGraphIndex();
    const client = await connected();
    const r = (await client.callTool({ name: "corpus_search", arguments: { query: "widget", hops: 0 } })) as {
      isError?: boolean;
      content: Array<{ type: string; text: string }>;
    };
    expect(r.isError ?? false).toBe(false);
    const body = JSON.parse(r.content[0].text);
    expect(body.summary.seedsByProvenance.authored).toBe(2);
    expect(body.summary.seedsByProvenance.ingested).toBe(1);
    await client.close();
  });

  test("the roots are the declared folio and library, falling back to the convention", async () => {
    const { graphRootsFor } = await import("../src/tools/graph");
    expect(graphRootsFor(ROOT)).toEqual(ROOTS);
  });

  test("an unreadable declaration falls back to the convention and SAYS so", async () => {
    const { graphRootsResolved } = await import("../src/tools/graph");
    const bad = mkdtempSync(join(tmpdir(), "mcp-graph-bad-"));
    try {
      mkdirSync(join(bad, "odd"));
      writeFileSync(
        join(bad, "bad.json"),
        JSON.stringify({ name: "bad", directories: [{ id: "odd", path: "odd/", graphTypologies: ["no-such-typology"] }] }),
      );
      const r = graphRootsResolved(bad);
      expect(r.roots).toEqual([
        { name: "folio", dir: join(bad, "folio") },
        { name: "library", dir: join(bad, "library") },
      ]);
      expect(r.note).toContain("searched the conventional folio/ and library/");
    } finally {
      rmSync(bad, { recursive: true, force: true });
    }
  });
});

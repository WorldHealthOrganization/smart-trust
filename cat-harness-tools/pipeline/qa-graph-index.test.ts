/**
 * Tests for the `qa` graph projection (bean `py74`).
 *
 * The ruling is *"separate family panels, never one total"*, so the falsifier
 * is not "does it count" — it is **does the shape make a total impossible**.
 * A test that only checked the numbers would pass just as well against an
 * index that also published a cross-family headline, which is the one thing
 * this module exists to refuse.
 */
import { describe, it, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  readQaGraph,
  projectQaGraph,
  isQaGraphUnknown,
  accumulate,
  rollUpFieldOf,
  jsonFilesIn,
  QA_GRAPH_INDEX_SCHEMA,
  NOT_TO_BE_CONFUSED_WITH,
} from "./qa-graph-index";

/** A throwaway qa graph. Keys are relative paths; values are written verbatim. */
function graph(files: Record<string, unknown | string>): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "qa-graph-"));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(abs.slice(0, abs.lastIndexOf("/")), { recursive: true });
    writeFileSync(abs, typeof body === "string" ? body : JSON.stringify(body));
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe("the ruling is the SHAPE — no cross-family total exists to publish", () => {
  it("publishes no verdict field above the families", () => {
    // The structural assertion, and the reason this file leads with it. Adding
    // a headline later has to break this test rather than slip past review.
    const { dir, cleanup } = graph({
      "a.json": { $schema: "kg-qa/v1", totals: { pass: 3, fail: 1 } },
      "b.json": { $schema: "qa-witness/v1", counts: { pass: 2, warn: 1 } },
    });
    const ix = readQaGraph(dir);
    expect(Object.keys(ix).sort()).toEqual([
      "$schema",
      "families",
      "files",
      "unclassified",
      "unreadable",
    ]);
    for (const k of ["totals", "counts", "buckets", "total", "state", "verdict", "summary"]) {
      expect(ix).not.toHaveProperty(k);
    }
    cleanup();
  });

  it("keeps each family's own bucket spelling apart, and never merges them", () => {
    // `n/a` and `na` are the same idea under two spellings in the real corpus.
    // Merging them is exactly the decision the owner declined.
    const { dir, cleanup } = graph({
      "a.json": { $schema: "kg-qa/v1", totals: { pass: 1, "n/a": 4 } },
      "b.json": { $schema: "qa-witness/v1", counts: { pass: 1, na: 7, warn: 2 } },
    });
    const fams = Object.fromEntries(readQaGraph(dir).families.map((f) => [f.schema, f]));
    expect(fams["kg-qa/v1"]?.buckets).toEqual({ pass: 1, "n/a": 4 });
    expect(fams["qa-witness/v1"]?.buckets).toEqual({ pass: 1, na: 7, warn: 2 });
    // `warn` exists in one family and not the other, and stays that way.
    expect(fams["kg-qa/v1"]?.buckets).not.toHaveProperty("warn");
    cleanup();
  });

  it("reports WHICH field a family rolled up from — they differ", () => {
    const { dir, cleanup } = graph({
      "a.json": { $schema: "kg-qa/v1", totals: { pass: 1 } },
      "b.json": { $schema: "qa-witness/v1", counts: { pass: 1 } },
      "c.json": { $schema: "block-qa/v1", criteria: { x: { result: "pass" } } },
    });
    const fams = Object.fromEntries(readQaGraph(dir).families.map((f) => [f.schema, f]));
    expect(fams["kg-qa/v1"]?.rollUpField).toBe("totals");
    expect(fams["qa-witness/v1"]?.rollUpField).toBe("counts");
    // The third-largest real family declares none, and that is not zero.
    expect(fams["block-qa/v1"]?.rollUpField).toBeNull();
    expect(fams["block-qa/v1"]).not.toHaveProperty("buckets");
    cleanup();
  });
});

describe("classification reads the FILE, never the path", () => {
  it("two families in one directory are told apart", () => {
    // The real corpus does this: a page's `qa-index.json` sits beside the
    // `.block.json` witnesses it indexes.
    const { dir, cleanup } = graph({
      "page/qa-index.json": { $schema: "folio-qa-index/v1", page: "p", badges: {} },
      "page/one.block.json": { $schema: "qa-witness/v1", counts: { pass: 1 } },
      "page/two.block.json": { $schema: "qa-witness/v1", counts: { pass: 1 } },
    });
    const ix = readQaGraph(dir);
    expect(ix.families.map((f) => [f.schema, f.files])).toEqual([
      ["qa-witness/v1", 2],
      ["folio-qa-index/v1", 1],
    ]);
    cleanup();
  });

  it("the same content under a misleading name lands in the same family", () => {
    const { dir, cleanup } = graph({
      "looks-like-a-witness.block.json": { $schema: "kg-qa/v1", totals: { pass: 1 } },
    });
    expect(readQaGraph(dir).families[0]?.schema).toBe("kg-qa/v1");
    cleanup();
  });
});

describe("three states — classified, unclassified, unreadable", () => {
  it("valid JSON with no `$schema` is UNCLASSIFIED, not a family and not a failure", () => {
    const { dir, cleanup } = graph({
      "a.json": { $schema: "kg-qa/v1", totals: { pass: 1 } },
      "b.json": { some: "json", but: "no schema tag" },
    });
    const ix = readQaGraph(dir);
    expect(ix.unclassified).toBe(1);
    expect(ix.unreadable).toBe(0);
    expect(ix.families).toHaveLength(1);
    // Counted among the files scanned — dropping it would report a clean
    // sweep over a document nothing looked at.
    expect(ix.files).toBe(2);
    cleanup();
  });

  it("a document that will not parse is UNREADABLE, counted apart from the above", () => {
    const { dir, cleanup } = graph({
      "a.json": { $schema: "kg-qa/v1", totals: { pass: 1 } },
      "broken.json": "{ this is not json",
    });
    const ix = readQaGraph(dir);
    expect(ix.unreadable).toBe(1);
    expect(ix.unclassified).toBe(0);
    cleanup();
  });

  it("an empty `$schema`, a JSON array and a bare null are all unclassified", () => {
    const { dir, cleanup } = graph({
      "empty.json": { $schema: "" },
      "array.json": [1, 2, 3],
      "null.json": "null",
    });
    const ix = readQaGraph(dir);
    expect(ix.unclassified).toBe(3);
    expect(ix.unreadable).toBe(0);
    expect(ix.families).toEqual([]);
    cleanup();
  });

  it("a missing directory is an empty projection, not a throw", () => {
    const ix = readQaGraph(join(tmpdir(), "definitely-not-here-" + Date.now()));
    expect(ix).toEqual({
      $schema: QA_GRAPH_INDEX_SCHEMA,
      files: 0,
      families: [],
      unclassified: 0,
      unreadable: 0,
    });
  });
});

describe("the arithmetic, which is the only place numbers meet", () => {
  it("adds only finite numbers, and skips everything else rather than coercing", () => {
    // `Number(x) || 0` would turn a string, a null and a genuine zero into the
    // same 0, and the published count would be a claim nobody could reproduce.
    const into: Record<string, number> = {};
    accumulate(into, { pass: 2, fail: "3", skip: null, warn: NaN, na: 0 });
    expect(into).toEqual({ pass: 2, na: 0 });
  });

  it("is additive across documents", () => {
    const into: Record<string, number> = {};
    accumulate(into, { pass: 2 });
    accumulate(into, { pass: 3, fail: 1 });
    expect(into).toEqual({ pass: 5, fail: 1 });
  });

  it("ignores a roll-up that is not an object", () => {
    const into: Record<string, number> = {};
    accumulate(into, 7);
    accumulate(into, null);
    accumulate(into, "totals");
    expect(into).toEqual({});
  });

  it("`totals` wins over `counts` when a document somehow carries both", () => {
    expect(rollUpFieldOf({ totals: {}, counts: {} })).toBe("totals");
    expect(rollUpFieldOf({ counts: {} })).toBe("counts");
    expect(rollUpFieldOf({})).toBeNull();
    // Present-but-null is the same answer as absent: nothing to add up.
    expect(rollUpFieldOf({ totals: null })).toBeNull();
  });

  it("a family whose first document declares no roll-up still reports one if a later one does", () => {
    // Otherwise the answer depends on readdir order — a result that reproduces
    // on one machine and not the next.
    const { dir, cleanup } = graph({
      "a-first.json": { $schema: "x/v1" },
      "b-second.json": { $schema: "x/v1", totals: { pass: 4 } },
    });
    const f = readQaGraph(dir).families[0];
    expect(f?.rollUpField).toBe("totals");
    expect(f?.buckets).toEqual({ pass: 4 });
    cleanup();
  });
});

describe("ordering is stable, so a rerun is not a diff", () => {
  it("largest first, ties broken by tag", () => {
    const { dir, cleanup } = graph({
      "1.json": { $schema: "zebra/v1" },
      "2.json": { $schema: "alpha/v1" },
      "3.json": { $schema: "big/v1" },
      "4.json": { $schema: "big/v1" },
    });
    expect(readQaGraph(dir).families.map((f) => f.schema)).toEqual([
      "big/v1",
      "alpha/v1",
      "zebra/v1",
    ]);
    cleanup();
  });
});

describe("the tag is not the one that is already taken", () => {
  it("`folio-qa-graph/v1` is distinct from the per-PAGE `folio-qa-index/v1`", () => {
    // 11 documents already carry the other tag and are a different shape
    // (`page` + `badges`). Reusing it would make two unlike documents
    // indistinguishable to exactly the consumer this serves.
    expect(QA_GRAPH_INDEX_SCHEMA).toBe("folio-qa-graph/v1");
    expect(QA_GRAPH_INDEX_SCHEMA).not.toBe(NOT_TO_BE_CONFUSED_WITH);
  });
});

describe("jsonFilesIn", () => {
  it("recurses, and takes only `.json`", () => {
    const { dir, cleanup } = graph({
      "a.json": { $schema: "x/v1" },
      "deep/b/c.json": { $schema: "x/v1" },
      "notes.md": "not json",
      "data.jsonl": "not json either",
    });
    expect(jsonFilesIn(dir).map((p) => p.slice(dir.length + 1)).sort()).toEqual([
      "a.json",
      "deep/b/c.json",
    ]);
    cleanup();
  });
});

describe("an absent corpus is UNKNOWN, never a count of what the build wrote (bean `tfqf`, C9)", () => {
  it("publishes no count, no families and no tile field when the corpus was not there", () => {
    // Measured before the fix: 965 documents became 2 — the two witnesses the
    // generator had just written into the empty tree — and the tile said 2.
    const { dir, cleanup } = graph({ "witnesses/p/a.json": { $schema: "qa-witness/v1", counts: { pass: 1 } } });
    const ix = projectQaGraph(dir, false);
    expect(isQaGraphUnknown(ix)).toBe(true);
    expect(Object.keys(ix).sort()).toEqual(["$schema", "availability", "reason"]);
    expect(ix).not.toHaveProperty("files");
    expect(ix).not.toHaveProperty("tile");
    expect((ix as { reason: string }).reason).toContain("qa-reports");
    cleanup();
  });

  it("a present corpus is the census, unchanged", () => {
    const { dir, cleanup } = graph({ "a.json": { $schema: "kg-qa/v1", totals: { pass: 1 } } });
    const ix = projectQaGraph(dir, true);
    expect(isQaGraphUnknown(ix)).toBe(false);
    expect(ix).toEqual(readQaGraph(dir));
    cleanup();
  });
});

describe("opts.exclude in readQaGraph and projectQaGraph (bean 0kbt)", () => {
  it("excludes queued orphan paths from the files count, families and buckets", () => {
    const { dir, cleanup } = graph({
      "witnesses/p/surviving.json": { $schema: "qa-witness/v1", counts: { pass: 2, fail: 1 } },
      "witnesses/p/orphan.json": { $schema: "qa-witness/v1", counts: { fail: 1 } },
    });
    const orphanPath = join(dir, "witnesses/p/orphan.json");
    const ix = readQaGraph(dir, { exclude: new Set([orphanPath]) });
    expect(ix.files).toBe(1);
    expect(ix.families).toHaveLength(1);
    expect(ix.families[0]?.files).toBe(1);
    expect(ix.families[0]?.buckets).toEqual({ pass: 2, fail: 1 });
    cleanup();
  });

  it("passes opts.exclude through projectQaGraph", () => {
    const { dir, cleanup } = graph({
      "witnesses/p/surviving.json": { $schema: "qa-witness/v1", counts: { pass: 2 } },
      "witnesses/p/orphan.json": { $schema: "qa-witness/v1", counts: { fail: 5 } },
    });
    const orphanPath = join(dir, "witnesses/p/orphan.json");
    const ix = projectQaGraph(dir, true, undefined, { exclude: new Set([orphanPath]) });
    expect(isQaGraphUnknown(ix)).toBe(false);
    if (!isQaGraphUnknown(ix)) {
      expect(ix.files).toBe(1);
      expect(ix.families[0]?.buckets).toEqual({ pass: 2 });
    }
    cleanup();
  });
});


/**
 * The prefix-sharded identifier lookup — bean `folio-assistant-4pm8`.
 *
 * @module cat-harness-tools/test/id-lookup.test
 * @graphNode none — a test
 *
 * Four claims, each asserted against the COMMITTED index as well as a built
 * one, because the committed files are what a reader downloads:
 *
 * 1. every referenced node resolves through the shards, using the client a
 *    browser runs, not a re-implementation of it;
 * 2. no shard exceeds the stated budget, and the prefix length is the
 *    smallest that keeps under it;
 * 3. `--check` catches a changed, a missing and a stale shard;
 * 4. none of that is vacuous: the referenced nodes are counted from the raw
 *    catalogue independently of the build, and an empty selection is refused.
 */
import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import * as client from "../id-lookup/lookup.js";
import { build as buildFor, catalogueNodesDir, defaultSource, nodesSelection, outDirFor, referencedEntries, staleness } from "../scripts/gen-id-lookup.ts";
import { rng, syntheticCorpus, uuidV4 } from "../scripts/bench-id-lookup.ts";
import {
  buildIdLookup,
  choosePrefixLength,
  IdLookupManifestSchema,
  SHARD_BUDGET_BYTES,
  ShardSchema,
  shardFile,
  splitId,
  type IdEntry,
} from "../schemas/kg/id-lookup.ts";

// The one corpus the checkout hosts a lookup for, read off the declarations
// rather than named here (bean `j7ql`).
const SOURCE = defaultSource();
const OUT = outDirFor(SOURCE);
const build = (): Map<string, string> => buildFor(SOURCE);

/** A `fetch` over a map of files, so the real client runs against a built index without a server. */
function mapFetch(files: Map<string, string>, root = "mem:/"): (url: string) => Promise<Response> {
  return async (url: string) => {
    const f = files.get(url.slice(root.length));
    return f === undefined ? new Response("", { status: 404 }) : new Response(f);
  };
}

function committedFiles(): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string, rel: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name), rel + e.name + "/");
      // The host directory's own subgraph README is not part of the index
      // (`gen-id-lookup.ts`, NOT_THE_INDEX; bean `j7ql`).
      else if (!(rel === "" && e.name === "README.md")) out.set(rel + e.name, readFileSync(join(d, e.name), "utf8"));
    }
  };
  walk(OUT, "");
  return out;
}

/** Referenced nodes counted from the raw JSON, deliberately NOT through `referencedEntries`. */
function rawReferencedIds(): string[] {
  const dir = catalogueNodesDir(SOURCE);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as { id: string; materialization?: { state?: string } })
    .filter((n) => n.materialization?.state === "referenced")
    .map((n) => n.id)
    .sort();
}

describe("the committed who-iris index", () => {
  const files = committedFiles();
  const manifest = IdLookupManifestSchema.parse(JSON.parse(files.get("manifest.json")!));
  const referenced = rawReferencedIds();

  test("there are referenced nodes to resolve, so the checks below are not vacuous", () => {
    expect(referenced.length).toBeGreaterThanOrEqual(10);
    expect(manifest.entryCount).toBe(referenced.length);
  });

  test("every referenced node resolves through the shards, with the browser's own client", async () => {
    const ix = await client.openIndex("mem:/", mapFetch(files));
    let resolved = 0;
    for (const id of referenced) {
      const r = await ix.lookup(id);
      expect(r.state, id).toBe("found");
      if (r.state === "found") {
        expect(r.entry.id).toBe(id);
        expect(r.fetched.length).toBe(1);
        resolved++;
      }
      // What a reader types is trimmed and lower-cased.
      expect((await ix.lookup(`  ${id.toUpperCase()} `)).state).toBe("found");
    }
    expect(resolved).toBe(referenced.length);
  });

  test("a materialised node is NOT in it: the site's own search holds those", async () => {
    const ix = await client.openIndex("mem:/", mapFetch(files));
    expect((await ix.lookup("item/18892cf3-5a4f-42a4-923c-a93f4a594dec")).state).toBe("absent");
  });

  test("every shard parses, is listed, and is under the budget", () => {
    let shards = 0;
    for (const [f, body] of files) {
      if (f === "manifest.json") continue;
      ShardSchema.parse(JSON.parse(body));
      const ns = f.slice(0, f.indexOf("/"));
      expect(manifest.namespaces[ns]!.shards).toContain(f.slice(ns.length + 1));
      expect(Buffer.byteLength(body)).toBeLessThanOrEqual(manifest.budgetBytes);
      shards++;
    }
    expect(manifest.budgetBytes).toBe(SHARD_BUDGET_BYTES);
    expect(shards).toBe(Object.values(manifest.namespaces).reduce((s, n) => s + n.shards.length, 0));
  });

  test("the committed files are what the build writes (the `--check` gate, run here too)", () => {
    expect(staleness(build(), OUT)).toEqual([]);
  });
});

describe("`--check` catches staleness", () => {
  function withCopy(fn: (dir: string) => void): void {
    const dir = mkdtempSync(join(tmpdir(), "id-lookup-"));
    try {
      cpSync(OUT, dir, { recursive: true });
      fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  const files = build();
  const shard = [...files.keys()].find((f) => f !== "manifest.json")!;

  test("a copy of the committed index is current", () => withCopy((d) => expect(staleness(files, d)).toEqual([])));
  test("a changed shard", () =>
    withCopy((d) => {
      writeFileSync(join(d, shard), readFileSync(join(d, shard), "utf8").replace(/\n$/, " \n"));
      expect(staleness(files, d)).toEqual([`${shard}: differs`]);
    }));
  test("a missing shard", () =>
    withCopy((d) => {
      unlinkSync(join(d, shard));
      expect(staleness(files, d)).toEqual([`${shard}: missing`]);
    }));
  test("a stale shard the build no longer writes", () =>
    withCopy((d) => {
      writeFileSync(join(d, "community", "pzz.json"), "{}\n");
      expect(staleness(files, d)).toEqual(["community/pzz.json: stale — the build no longer writes it"]);
    }));
  test("a node that stops being referenced makes the committed index stale", () => {
    const fewer = referencedEntries(catalogueNodesDir(SOURCE)).slice(1);
    const rebuilt = buildIdLookup(fewer, { source: SOURCE, selection: "x" }).files;
    withCopy((d) => expect(staleness(rebuilt, d).length).toBeGreaterThan(0));
  });
});

describe("the build", () => {
  const e = (id: string, title = "t"): IdEntry => ({ id, title, url: "https://example.org/" + id });

  test("an empty selection is refused rather than written as an index that answers 'absent'", () => {
    expect(() => buildIdLookup([], { source: "s", selection: "x" })).toThrow(/no entries/);
  });
  test("ids the client could not find again are refused", () => {
    expect(() => buildIdLookup([e("nonamespace")], { source: "s", selection: "x" })).toThrow(/kind\/local/);
    expect(() => buildIdLookup([e("item/ABC")], { source: "s", selection: "x" })).toThrow(/upper case/);
    expect(() => buildIdLookup([e("item/a"), e("item/a")], { source: "s", selection: "x" })).toThrow(/twice/);
  });
  test("an entry larger than the budget is refused, not written over it", () => {
    expect(() => buildIdLookup([e("item/a", "x".repeat(500))], { source: "s", selection: "x", budget: 200 })).toThrow(/no prefix length/);
  });
  test("it is deterministic whatever the input order", () => {
    const xs = [e("item/b1"), e("item/a2"), e("item/c3"), e("community/z")];
    const a = buildIdLookup(xs, { source: "s", selection: "x", budget: 120 }).files;
    const b = buildIdLookup([...xs].reverse(), { source: "s", selection: "x", budget: 120 }).files;
    expect([...a]).toEqual([...b]);
  });
});

describe("at scale (60,000 synthetic IRIS-shaped items)", () => {
  const r = rng(7);
  const words = ["World", "Health", "Organization", "report", "on", "the", "regional", "meeting", "of"];
  const entries = syntheticCorpus([], 60_000, 180, words, 11);
  const { manifest, files } = buildIdLookup(entries, { source: "synthetic", selection: "test" });

  test("every shard is under the budget, and the prefix length is the smallest that is", () => {
    const n = manifest.namespaces.item!.prefixLength;
    expect(n).toBeGreaterThan(0);
    for (const [f, body] of files) if (f !== "manifest.json") expect(Buffer.byteLength(body)).toBeLessThanOrEqual(SHARD_BUDGET_BYTES);
    expect(choosePrefixLength("item", entries, SHARD_BUDGET_BYTES)).toBe(n);
    // One shorter would put some shard over: the length is chosen, not padded.
    const shorter = new Map<string, number>();
    for (const x of entries) {
      const f = shardFile("item", splitId(x.id)!.local, n - 1);
      shorter.set(f, (shorter.get(f) ?? 0) + Buffer.byteLength(JSON.stringify([x.id, x.title, x.url])) + 1);
    }
    expect(Math.max(...shorter.values())).toBeGreaterThan(SHARD_BUDGET_BYTES);
  });

  test("every id resolves with exactly one shard fetched, and an unknown one is absent", async () => {
    const ix = await client.openIndex("mem:/", mapFetch(files));
    for (const x of entries) {
      const res = await ix.lookup(x.id);
      if (res.state !== "found" || res.fetched.length !== 1) throw new Error(`${x.id}: ${JSON.stringify(res)}`);
    }
    expect((await ix.lookup("item/" + uuidV4(r))).state).toBe("absent");
    expect((await ix.lookup("item/a")).state).toBe("too-short");
  }, 60_000);
});

describe("the client and the build name shards the same way", () => {
  test("over every committed id, and over characters that need escaping", () => {
    const ids = [...rawReferencedIds(), "item/a/b", "item/ä-x", "item/%20", "item/~", "item/..", "c/"];
    for (const id of ids) {
      expect(client.splitId(id)).toEqual(splitId(id));
      const s = splitId(id);
      if (!s) continue;
      for (const n of [0, 1, 2, 3, 4]) expect(client.shardFile(s.ns, s.local, n)).toBe(shardFile(s.ns, s.local, n));
    }
    expect(shardFile("item", "a/b", 3)).toBe("item/pa~2fb.json");
  });
});

describe("the manifest's selection does not depend on where the checkout sits", () => {
  // Spelled from the checkout root it read `catalogue/nodes/` with the layer
  // at the root and `who-iris/catalogue/nodes/` in a consumer checkout, so the
  // committed lookup was stale in one of the two. It is the declaration's.
  test("the whole build carries no checkout path in its manifest", () => {
    const files = buildFor(defaultSource());
    const manifest = files.get("manifest.json");
    expect(manifest).toBeDefined();
    const sel = (JSON.parse(manifest!) as { selection?: string }).selection ?? "";
    // The declared path, whatever directory the layer was mounted at.
    expect(sel).toMatch(/^every node under [^/]/);
    expect(sel).not.toContain(`${defaultSource()}/`);
  });

  test("spellings of the declared path agree", () => {
    for (const p of ["catalogue", "catalogue/", "./catalogue/", "catalogue//"]) {
      expect(nodesSelection({ path: p }, "nodes/")).toBe('every node under catalogue/nodes/ whose materialization.state is "referenced"');
    }
  });
});

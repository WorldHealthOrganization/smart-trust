import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { CACHE_SCHEMA_TAG, CacheInventorySchema, CacheSchema, nodeStaleness, staleness, type Cache } from "./cache";

const CACHES = join(import.meta.dir, "..", "..", "caches");

/** One cache, in the shape a layer's node takes; a helper so a test asserting ONE rule cannot pass on a second violation. */
function cache(over: Partial<Cache> = {}): unknown {
  return {
    $schema: CACHE_SCHEMA_TAG,
    id: "demo",
    title: "Demo",
    instance: "cat-harness-tools",
    kind: "actions-cache",
    trustClass: "a",
    location: "cs1-demo-",
    keyRecipe: { source: "hashFiles", files: ["index.lock.json"] },
    derivedInputs: "the lock",
    holds: "the mounts",
    producer: "the mount step",
    consumers: ["every job that mounts"],
    savePolicy: "main, or a PR into its own scope",
    verify: "the replayer checks every tree against the lock",
    uses: [".github/workflows/x.yml:12", ".github/workflows/x.yml:20-24"],
    stateInputs: { reads: "none", how: "the lock pins everything it holds" },
    ...over,
  };
}

describe("cache/1.0.0", () => {
  test("the baseline parses", () => expect(CacheSchema.safeParse(cache()).success).toBe(true));
  test("never the entries: an unknown key is refused", () => {
    expect(CacheSchema.safeParse({ ...(cache() as object), storedKey: "cs1-demo-abc" }).success).toBe(false);
  });
  test("a recipe must name what it derives from", () => {
    expect(CacheSchema.safeParse(cache({ keyRecipe: { source: "hashFiles" } as never })).success).toBe(false);
    expect(CacheSchema.safeParse(cache({ keyRecipe: { source: "cache:key" } as never })).success).toBe(false);
    expect(CacheSchema.safeParse(cache({ keyRecipe: { source: "script" } as never })).success).toBe(false);
  });
  test("a hand-listed or run-scoped key is a finding that must record its expression", () => {
    expect(CacheSchema.safeParse(cache({ keyRecipe: { source: "hand-listed" } as never })).success).toBe(false);
    expect(CacheSchema.safeParse(cache({ keyRecipe: { source: "hand-listed", expression: "k-$judge" } })).success).toBe(true);
  });
  test("a trust class outside the policy is refused", () => {
    expect(CacheSchema.safeParse(cache({ trustClass: "trusted" as never })).success).toBe(false);
  });
});

describe("state a producer reads (#2966: the pages read the work plan, the key did not)", () => {
  test("every node must say whether its producer reads state", () => {
    const { stateInputs: _, ...without } = cache() as Record<string, unknown>;
    expect(CacheSchema.safeParse(without).success).toBe(false);
  });
  test("keyed state names its refs", () => {
    expect(CacheSchema.safeParse(cache({ stateInputs: { reads: "keyed", how: "x" } as never })).success).toBe(false);
    expect(CacheSchema.safeParse(cache({ stateInputs: { reads: "keyed", refs: ["cat/cat-harness/beans"], how: "the ref's commit is in the key" } })).success).toBe(true);
  });
  test("unkeyed or unmeasured state is never current, whatever the keys say", () => {
    for (const s of [{ reads: "unkeyed", how: "reads beans" }, { reads: "unmeasured" }] as const) {
      expect(nodeStaleness({ stateInputs: s as never }, "abc", { key: "cs1-demo-abc" }, "cs1-demo-").state).toBe("undetermined");
    }
    expect(nodeStaleness({ stateInputs: { reads: "none", how: "x" } }, "abc", { key: "cs1-demo-abc" }, "cs1-demo-").state).toBe("current");
  });
});

describe("staleness is computed, never claimed", () => {
  test("an implied key that cannot be computed is undetermined, never current", () => {
    expect(staleness({ undetermined: "x" }, { key: "anything" }).state).toBe("undetermined");
  });
  test("no stored key read is undetermined, never current", () => {
    expect(staleness("abc", undefined).state).toBe("undetermined");
  });
  test("equal is current, different is stale", () => {
    expect(staleness("abc", { key: "cs1-demo-abc" }, "cs1-demo-").state).toBe("current");
    expect(staleness("abc", { key: "cs1-demo-old" }, "cs1-demo-").state).toBe("stale");
  });
});

describe("this layer's caches/", () => {
  const files = readdirSync(CACHES).filter((f) => f.endsWith(".json"));
  test("every node parses under its family", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const j = JSON.parse(readFileSync(join(CACHES, f), "utf8")) as { $schema: string };
      const r = j.$schema === "cache-inventory/1.0.0" ? CacheInventorySchema.safeParse(j) : CacheSchema.safeParse(j);
      if (!r.success) throw new Error(`${f}: ${r.error.message}`);
    }
  });
  test("a node's file stem is its id", () => {
    for (const f of files.filter((n) => n.endsWith(".cache.json"))) {
      const j = JSON.parse(readFileSync(join(CACHES, f), "utf8")) as { id: string };
      expect(f).toBe(`${j.id}.cache.json`);
    }
  });
});

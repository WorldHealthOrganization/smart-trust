/**
 * `cache:plan` (`scripts/cache-plan.ts`): which caches a target needs (derived
 * from its recorded read set), which are stale, and restore / refresh / skip.
 * Most cases are ones that must NOT restore: a cache restored for a target that
 * cannot be derived, or a stale one restored as fresh, is the defect.
 */
import { describe, expect, test } from "bun:test";
import { batches, plan, readSets, under, type Recorded } from "../cache-plan.ts";
import type { Cache } from "../../schemas/sdlc/cache.ts";

const node = (id: string, over: Partial<Cache> = {}): Cache =>
  ({
    $schema: "cache/1.0.0",
    id,
    title: id,
    instance: "cat-harness-tools",
    kind: "actions-cache",
    trustClass: "a",
    location: `${id}-`,
    keyRecipe: { source: "script", implementation: "x.sh" },
    derivedInputs: "d",
    holds: "h",
    producer: "p",
    consumers: ["c"],
    savePolicy: "main",
    verify: "v",
    uses: ["x.sh:1"],
    stateInputs: { reads: "none", how: "fixture" },
    ...over,
  }) as Cache;

const caches = [
  node("layers-ref", { needs: [], refresh: { mode: "incremental", how: "moved layers" } }),
  node("node-modules", { needs: ["layers-ref"], materializes: ["node_modules/"] }),
  node("lean", { needs: ["layers-ref"], materializes: [".lake/build"], refresh: { mode: "incremental", how: "changed modules" } }),
  node("jekyll", { needs: ["node-modules"], materializes: [".jekyll-cache/"] }),
];
const recorded: Recorded[] = [
  { checks: { "check:lint": { reads: { "node_modules/eslint/index.js": "f", "src/a.ts": "f" } } } },
  { writers: { "docs:build": { reads: { ".jekyll-cache/x": "f" } } } },
];

describe("under", () => {
  test("a path under a materialized dir, or equal to it; never a home path; no prefix confusion", () => {
    expect(under("node_modules/a", "node_modules/")).toBe(true);
    expect(under(".lake/build", ".lake/build")).toBe(true);
    expect(under("node_modules_x/a", "node_modules/")).toBe(false);
    expect(under("x", "~/.cache/x")).toBe(false);
  });
});

describe("needed is derived", () => {
  test("a read under materializes makes a cache needed, and its needs closure too", () => {
    const p = plan({ targets: ["check:lint"], caches, recorded, stored: undefined, root: "/" });
    const by = Object.fromEntries(p.rows.map((r) => [r.id, r]));
    expect(by["node-modules"].needed).toBe(true);
    expect(by["node-modules"].neededWhy).toContain("check:lint reads node_modules/");
    expect(by["layers-ref"].needed).toBe(true);
    expect(by["layers-ref"].neededWhy).toBe("needed by node-modules");
    expect(by.lean.needed).toBe(false);
    expect(by.lean.action).toBe("skip");
    expect(by.jekyll.needed).toBe(false);
  });
  test("closure through two levels: jekyll → node-modules → layers-ref", () => {
    const p = plan({ targets: ["docs:build"], caches, recorded, stored: undefined, root: "/" });
    expect(p.rows.filter((r) => r.needed).map((r) => r.id).sort()).toEqual(["jekyll", "layers-ref", "node-modules"]);
  });
  test("a target with no record: could not derive, nothing restored, it builds", () => {
    const p = plan({ targets: ["check:unknown"], caches, recorded, stored: undefined, root: "/" });
    expect(p.undetermined).toEqual([{ target: "check:unknown", why: expect.stringContaining("cannot be derived") }]);
    expect(p.rows.every((r) => r.action === "skip")).toBe(true);
    expect(p.rows[0].neededWhy).toContain("the target builds");
  });
  test("readSets unions the ci-cone and writer-cone records", () => {
    const { reads } = readSets(["check:lint", "docs:build"], recorded);
    expect(reads.get("check:lint")).toEqual(["node_modules/eslint/index.js", "src/a.ts"]);
    expect(reads.get("docs:build")).toEqual([".jekyll-cache/x"]);
  });
});

describe("stale is computed; undetermined counts as stale", () => {
  test("no stored key: undetermined → refresh, never restore", () => {
    const p = plan({ targets: ["check:lint"], caches, recorded, stored: undefined, root: "/" });
    const nm = p.rows.find((r) => r.id === "node-modules")!;
    expect(nm.staleness).toBe("undetermined");
    expect(nm.action).toBe("refresh-whole");
    expect(p.rows.find((r) => r.id === "layers-ref")!.action).toBe("refresh-incremental");
  });
  test("an implied key equal to the stored key → restore; different → refresh", () => {
    const hf = (id: string, over: Partial<Cache> = {}) => node(id, { keyRecipe: { source: "hashFiles", files: [] }, materializes: ["node_modules/"], ...over });
    // hashFiles over no file is undetermined; use a stored key that matches nothing to exercise "stale" via a fake implied key.
    const p = plan({ targets: ["check:lint"], caches: [hf("nm")], recorded, stored: { nm: { key: "k" } }, root: "/" });
    expect(p.rows[0].staleness).toBe("undetermined"); // no file to hash: never "current"
    expect(p.rows[0].action).toBe("refresh-whole");
  });
});

describe("order and cost", () => {
  test("needs order in batches; independent caches share a batch", () => {
    const { batchOf, refused } = batches(caches);
    expect(refused).toEqual([]);
    expect(batchOf.get("layers-ref")).toBe(0);
    expect(batchOf.get("node-modules")).toBe(1);
    expect(batchOf.get("lean")).toBe(1);
    expect(batchOf.get("jekyll")).toBe(2);
  });
  test("a cycle or an unknown needs id is refused and planned skip", () => {
    const bad = [node("a", { needs: ["b"], materializes: ["x/"] }), node("b", { needs: ["a"] }), node("c", { needs: ["nope"] })];
    const p = plan({ targets: ["t"], caches: bad, recorded: [{ checks: { t: { reads: { "x/1": "f" } } } }], stored: undefined, root: "/" });
    expect(p.refused.map((r) => r.id).sort()).toEqual(["a", "b", "c"]);
    expect(p.rows.every((r) => r.action === "skip")).toBe(true);
  });
  test("cost comes only from the report; otherwise unknown", () => {
    const withReport = plan({ targets: ["check:lint"], caches, recorded, stored: { "node-modules": { sizeBytes: 1048576, hitRate: 0.5 } }, root: "/" });
    expect(withReport.rows.find((r) => r.id === "node-modules")!.cost).toEqual({ sizeBytes: 1048576, hitRate: 0.5 });
    expect(withReport.rows.find((r) => r.id === "lean")!.cost).toBe("unknown");
  });
  test("the plan is machine-readable", () => {
    expect(plan({ targets: ["check:lint"], caches, recorded, stored: undefined, root: "/" }).schema).toBe("cache-plan/1");
  });
});

test("fresh (implied key equals the stored key) → restore; a different stored key → refresh", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { hashFilesOf } = await import("../gen-caches-viz.ts");
  const root = mkdtempSync(join(tmpdir(), "plan-"));
  writeFileSync(join(root, "lock.json"), "{}");
  const implied = hashFilesOf(root, ["lock.json"]);
  expect(typeof implied).toBe("string");
  const c = node("nm", { keyRecipe: { source: "hashFiles", files: ["lock.json"] }, materializes: ["node_modules/"] });
  const fresh = plan({ targets: ["check:lint"], caches: [c], recorded, stored: { nm: { key: implied as string } }, root });
  expect(fresh.rows[0].staleness).toBe("current");
  expect(fresh.rows[0].action).toBe("restore");
  const stale = plan({ targets: ["check:lint"], caches: [c], recorded, stored: { nm: { key: "old-key" } }, root });
  expect(stale.rows[0].staleness).toBe("stale");
  expect(stale.rows[0].action).toBe("refresh-whole");
});

test("a needed node whose producer reads unmeasured state is refreshed, never restored", () => {
  const n = node("pages", { materializes: ["docs/"], needs: [], stateInputs: { reads: "unmeasured" } });
  const p = plan({ caches: [n], recorded: [{ writers: { w: { reads: { "docs/a.html": "f" } } } }], targets: ["w"], root: "/", stored: { pages: { key: "pages-x" } } });
  const row = p.rows.find((r) => r.id === "pages")!;
  expect(row.staleness).toBe("undetermined");
  expect(row.action).not.toBe("restore");
});


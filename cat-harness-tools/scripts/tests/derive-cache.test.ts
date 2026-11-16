/**
 * `derive:publish`'s per-writer cache and parallel scheduler (issue #400,
 * `derive-cache.ts`): a writer whose key has a recorded result is RESTORED,
 * not rebuilt, and restoring it spares what another writer put inside its
 * directory; writers the declared edges leave unordered run side by side, at
 * most `CAT_DERIVE_JOBS` at once, and one the edges order waits for its
 * predecessors whatever they did. The tree digest the keys are computed over
 * leaves out the declared outputs (`trackedTreeDigest`'s `exclude`), and
 * nothing else.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  cacheDirOf,
  commitStaged,
  deriveCacheEnabled,
  digestPaths,
  hasEntry,
  jobsOf,
  nestedForeign,
  outputsByWriter,
  predecessorsOf,
  restoreOutputs,
  schedule,
  stageOutputs,
  writerKey,
} from "../derive-cache.ts";
import { FileDigests, trackedTreeDigest } from "../input-hash.ts";

let tmp: string;
const put = (rel: string, body: string) => {
  mkdirSync(dirname(join(tmp, rel)), { recursive: true });
  writeFileSync(join(tmp, rel), body);
};
const read = (rel: string) => readFileSync(join(tmp, rel), "utf-8");

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "derive-cache-"));
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("settings", () => {
  test("the cache directory is CAT_DERIVE_CACHE_DIR, else build/derive-cache", () => {
    expect(cacheDirOf("/r", {})).toBe("/r/build/derive-cache");
    expect(cacheDirOf("/r", { CAT_DERIVE_CACHE_DIR: "c" })).toBe("/r/c");
    expect(cacheDirOf("/r", { CAT_DERIVE_CACHE_DIR: "/abs" })).toBe("/abs");
  });
  test("reuse is off under --no-cache, and under CI unless a cache directory is named", () => {
    expect(deriveCacheEnabled([], {}).on).toBe(true);
    expect(deriveCacheEnabled(["--no-cache"], {}).on).toBe(false);
    expect(deriveCacheEnabled([], { CI: "true" }).on).toBe(false);
    expect(deriveCacheEnabled([], { CI: "true", CAT_DERIVE_CACHE_DIR: "/c" }).on).toBe(true);
    expect(deriveCacheEnabled([], { CI: "false" }).on).toBe(true);
  });
  test("CAT_DERIVE_JOBS bounds the pool; the default is the cores; nonsense is refused", () => {
    expect(jobsOf({}, 6)).toBe(6);
    expect(jobsOf({ CAT_DERIVE_JOBS: "2" }, 6)).toBe(2);
    expect(() => jobsOf({ CAT_DERIVE_JOBS: "0" }, 6)).toThrow(/positive integer/);
    expect(() => jobsOf({ CAT_DERIVE_JOBS: "x" }, 6)).toThrow(/positive integer/);
  });
});

describe("what a writer owns, and what it is keyed on", () => {
  const plan = [
    { abs: "/r/i/docs/beans/", writer: ["state:visualizer"] },
    { abs: "/r/i/docs/beans/inner/", writer: ["other"] },
    { abs: "/r/i/docs/_data/harness.json", writer: ["docs:pages", "docs:harness"] },
  ];
  test("an entry naming several writers is each one's output; a directory keeps its slash", () => {
    const by = outputsByWriter(plan, "/r");
    expect(by.get("state:visualizer")).toEqual(["i/docs/beans/"]);
    expect(by.get("docs:pages")).toEqual(["i/docs/_data/harness.json"]);
    expect(by.get("docs:harness")).toEqual(["i/docs/_data/harness.json"]);
  });
  test("another writer's output nested inside one's own is named, so a restore spares it", () => {
    const by = outputsByWriter(plan, "/r");
    expect(nestedForeign("state:visualizer", by)).toEqual(["i/docs/beans/inner"]);
    expect(nestedForeign("other", by)).toEqual([]);
    // Two writers of ONE entry do not spare each other: it is both of theirs.
    expect(nestedForeign("docs:harness", by)).toEqual([]);
  });
  test("predecessors are transitive over the declared edges", () => {
    const edges = [
      { before: "a", after: "b" },
      { before: "b", after: "c" },
      { before: "x", after: "c" },
    ];
    expect([...predecessorsOf("c", edges)].sort()).toEqual(["a", "b", "x"]);
    expect([...predecessorsOf("a", edges)]).toEqual([]);
  });
  test("the key moves with the fingerprint and with the predecessors' outputs", () => {
    put("k/p/out.txt", "one");
    const d1 = digestPaths(tmp, ["k/p/", "k/absent.json"]);
    put("k/p/out.txt", "two");
    const d2 = digestPaths(tmp, ["k/p/", "k/absent.json"]);
    expect(d1).not.toBe(d2);
    expect(digestPaths(tmp, ["k/p/"], ["k/p/out.txt"])).toBe(digestPaths(tmp, ["k/p/"], ["k/p"]));
    expect(writerKey("w", "f1", d1)).not.toBe(writerKey("w", "f2", d1));
    expect(writerKey("w", "f1", d1)).not.toBe(writerKey("w", "f1", d2));
    expect(writerKey("w", "f1", d1)).not.toBe(writerKey("v", "f1", d1));
  });
});

describe("record and restore", () => {
  test("a staged result is not reusable until committed; a restore puts the bytes back and spares nested foreign outputs", () => {
    const cache = join(tmp, "build", "derive-cache");
    put("r/site/index.html", "built");
    put("r/site/sub/a.css", "css");
    put("r/site/inner/foreign.html", "foreign-v1");
    const outs = ["r/site/", "r/never-written.json"];
    const keep = ["r/site/inner"];
    const staged = stageOutputs(cache, "w:pages", "k1", tmp, outs, keep);
    expect(hasEntry(cache, "w:pages", "k1")).toBe(false);
    commitStaged(cache, "w:pages", "k1", staged);
    expect(hasEntry(cache, "w:pages", "k1")).toBe(true);
    expect(existsSync(join(cache, "w_pages", "k1", "files", "r/site/inner/foreign.html"))).toBe(false);

    // The checkout moves on: a stale extra file, an edit, the foreign writer's new output, and an
    // output that the recorded run never wrote.
    put("r/site/index.html", "stale");
    put("r/site/extra.html", "left over");
    put("r/site/inner/foreign.html", "foreign-v2");
    put("r/never-written.json", "{}");
    expect(restoreOutputs(cache, "w:pages", "k1", tmp, keep)).toBe(true);
    expect(read("r/site/index.html")).toBe("built");
    expect(read("r/site/sub/a.css")).toBe("css");
    expect(existsSync(join(tmp, "r/site/extra.html"))).toBe(false);
    expect(read("r/site/inner/foreign.html")).toBe("foreign-v2");
    expect(existsSync(join(tmp, "r/never-written.json"))).toBe(false);
  });
  test("an unknown key, or another writer's entry, restores nothing", () => {
    const cache = join(tmp, "build", "derive-cache");
    expect(restoreOutputs(cache, "w:pages", "nope", tmp, [])).toBe(false);
    expect(restoreOutputs(cache, "w-pages", "k1", tmp, [])).toBe(false);
  });
  test("a newer key replaces the writer's older entry", () => {
    const cache = join(tmp, "build", "derive-cache");
    put("r/one.txt", "x");
    commitStaged(cache, "w:one", "old", stageOutputs(cache, "w:one", "old", tmp, ["r/one.txt"], []));
    commitStaged(cache, "w:one", "new", stageOutputs(cache, "w:one", "new", tmp, ["r/one.txt"], []));
    expect(hasEntry(cache, "w:one", "old")).toBe(false);
    expect(hasEntry(cache, "w:one", "new")).toBe(true);
  });
});

describe("schedule", () => {
  const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function trace(order: string[], edges: { before: string; after: string }[], jobs: number) {
    const events: string[] = [];
    let live = 0;
    let peak = 0;
    await schedule(order, edges, jobs, async (w) => {
      live++;
      peak = Math.max(peak, live);
      events.push(`start ${w}`);
      await tick(15);
      events.push(`end ${w}`);
      live--;
      return w === "bad" ? "failed" : "ran";
    });
    return { events, peak };
  }
  test("unordered writers run side by side, never more than the jobs allow", async () => {
    expect((await trace(["a", "b", "c", "d"], [], 2)).peak).toBe(2);
    expect((await trace(["a", "b", "c", "d"], [], 8)).peak).toBe(4);
  });
  test("one job is the sequential order exactly", async () => {
    const { events, peak } = await trace(["a", "b", "c"], [], 1);
    expect(peak).toBe(1);
    expect(events).toEqual(["start a", "end a", "start b", "end b", "start c", "end c"]);
  });
  test("a declared edge holds: the reader starts after its source ENDS, even when that source failed", async () => {
    const { events } = await trace(["docs:harness", "bad", "other"], [{ before: "bad", after: "docs:harness" }], 4);
    expect(events.indexOf("start docs:harness")).toBeGreaterThan(events.indexOf("end bad"));
    expect(events.indexOf("start other")).toBeLessThan(events.indexOf("end bad"));
  });
  test("every writer's result comes back", async () => {
    const r = await schedule(["a", "b"], [{ before: "a", after: "b" }], 3, async (w) => w.toUpperCase());
    expect([...r.entries()].sort()).toEqual([
      ["a", "A"],
      ["b", "B"],
    ]);
  });
});

describe("the tree digest leaves out exactly the declared outputs", () => {
  test("an excluded output moving keeps the digest; any other file moving changes it", () => {
    const repo = join(tmp, "repo");
    mkdirSync(repo, { recursive: true });
    const git = (...a: string[]) => Bun.spawnSync(["git", ...a], { cwd: repo, stdout: "pipe", stderr: "pipe" });
    git("init", "-q");
    writeFileSync(join(repo, ".gitignore"), "docs/\n");
    writeFileSync(join(repo, "src.ts"), "export const a = 1;\n");
    mkdirSync(join(repo, "docs", "site"), { recursive: true });
    mkdirSync(join(repo, "docs", "other"), { recursive: true });
    writeFileSync(join(repo, "docs", "site", "index.html"), "v1");
    writeFileSync(join(repo, "docs", "other", "page.html"), "o1");
    writeFileSync(join(repo, "untracked-out.json"), "u1");
    git("add", ".gitignore", "src.ts");
    const exclude = ["docs/site/", "untracked-out.json"];
    const digest = () => {
      const d = trackedTreeDigest(repo, new FileDigests(repo), { exclude });
      if (!("hash" in d)) throw new Error(d.undetermined);
      return d.hash;
    };
    const d0 = digest();
    writeFileSync(join(repo, "docs", "site", "index.html"), "v2");
    writeFileSync(join(repo, "untracked-out.json"), "u2");
    expect(digest()).toBe(d0);
    writeFileSync(join(repo, "docs", "other", "page.html"), "o2");
    const d1 = digest();
    expect(d1).not.toBe(d0);
    writeFileSync(join(repo, "src.ts"), "export const a = 2;\n");
    expect(digest()).not.toBe(d1);
  });
});

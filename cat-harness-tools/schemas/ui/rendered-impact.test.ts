/**
 * The rendered-impact contract (bean `bnjs`): a build diff, the review list,
 * and checking a cone prediction against a build.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  comparePrediction,
  diffBuiltSites,
  missedFiles,
  pinImpact,
  RENDERED_IMPACT_TAG,
  RENDERED_MEASURED_TAG,
  RenderedImpactSchema,
  RenderedMeasuredSchema,
  reviewList,
  type RenderedImpact,
} from "./rendered-impact";

const T = mkdtempSync(join(tmpdir(), "rendered-impact-"));
afterAll(() => rmSync(T, { recursive: true, force: true }));
const put = (rel: string, body: string) => {
  mkdirSync(dirname(join(T, rel)), { recursive: true });
  writeFileSync(join(T, rel), body);
};

put("a/same.html", "x");
put("a/page.html", "old");
put("a/gone.html", "g");
put("a/assets/js/search-data.json", "{1}");
put("a/data/r.json", "{}");
put("b/same.html", "x");
put("b/page.html", "new");
put("b/new.html", "n");
put("b/assets/js/search-data.json", "{2}");
put("b/data/r.json", '{"x":1}');

describe("diffBuiltSites", () => {
  const d = diffBuiltSites(join(T, "a"), join(T, "b"), { renderer: "jekyll" });
  test("every added, changed and removed file, by content, with a role; unchanged files are absent", () => {
    expect(d.method).toBe("build-diff");
    expect(d.files.map((f) => [f.path, f.change, f.role])).toEqual([
      ["assets/js/search-data.json", "changed", "index"],
      ["data/r.json", "changed", "data"],
      ["gone.html", "removed", "content"],
      ["new.html", "added", "content"],
      ["page.html", "changed", "content"],
    ]);
  });
  test("each changed file is pinned to its content; a removed file has nothing to pin", () => {
    const by = new Map(d.files.map((f) => [f.path, f.hash]));
    expect(by.get("page.html")).toMatch(/^[0-9a-f]{64}$/);
    expect(by.get("new.html")).toMatch(/^[0-9a-f]{64}$/);
    expect(by.get("gone.html")).toBeUndefined();
  });
  test("build stamps are not content: two builds of one page differ only by them, and are not a change", () => {
    put("c/page.html", '<link href="a.css?v=1791301518">');
    put("d/page.html", '<link href="a.css?v=1791301617">');
    put("c/meta.json", '{"generatedAt": "2026-10-06T15:46:47Z", "sourceTreeDirty": false, "n": 1}');
    put("d/meta.json", '{"generatedAt": "2026-10-06T15:48:19Z", "sourceTreeDirty": true, "n": 1}');
    put("d/real.json", '{"n": 2}');
    put("c/real.json", '{"n": 1}');
    expect(diffBuiltSites(join(T, "c"), join(T, "d"), { renderer: "jekyll" }).files.map((f) => f.path)).toEqual(["real.json"]);
  });
  test("`keep` limits BOTH sides, so another site under a shared root is neither removed nor added", () => {
    const k = diffBuiltSites(join(T, "a"), join(T, "b"), { renderer: "jekyll", keep: (p) => p !== "gone.html" && p !== "new.html" });
    expect(k.files.map((f) => f.path)).toEqual(["assets/js/search-data.json", "data/r.json", "page.html"]);
  });
  test("the review list drops index files and nothing else", () => {
    expect(reviewList(d).map((f) => f.path)).toEqual(["data/r.json", "gone.html", "new.html", "page.html"]);
  });
});

describe("comparePrediction", () => {
  const impact = (method: "cone" | "build-diff", files: Array<[string, "content" | "data" | "index"]>): RenderedImpact =>
    RenderedImpactSchema.parse({ $schema: RENDERED_IMPACT_TAG, renderer: "r", method, files: files.map(([path, role]) => ({ path, change: "changed", role })) });

  test("a measured change the cone did not predict is MISSED; a content page whose bytes did not move is only unconfirmed", () => {
    const predicted = impact("cone", [["p.html", "content"], ["d/r.json", "data"]]);
    const measured = impact("build-diff", [["d/r.json", "data"], ["other.html", "content"]]);
    const c = comparePrediction(predicted, measured);
    expect(c.missed).toEqual(["other.html"]);
    expect(c.confirmed).toEqual(["d/r.json"]);
    expect(c.unconfirmed).toEqual([{ path: "p.html", role: "content" }]);
  });

  test("could-not-determine is carried, never read as no change", () => {
    const p = RenderedImpactSchema.parse({ $schema: RENDERED_IMPACT_TAG, renderer: "r", method: "cone", files: [], undetermined: [{ input: "sushi-config.yaml", reason: "site-wide", scope: "all" }] });
    expect(p.files).toEqual([]);
    expect(p.undetermined).toEqual([{ input: "sushi-config.yaml", reason: "site-wide", scope: "all" }]);
    // Carried through pinning, and pinned rather than dropped.
    const pinnedP = pinImpact(p, () => "blob");
    expect(pinnedP.undetermined).toHaveLength(1);
    expect(pinnedP.undetermined[0]!.input).toBe("sushi-config.yaml");
    expect(pinnedP.undetermined[0]!.hash).toMatch(/^[0-9a-f]{64}$/);
    // An empty cone with an undetermined input is not a clean "no change":
    // what the build did change is reported as missed.
    const c = comparePrediction(p, impact("build-diff", [["other.html", "content"]]));
    expect(c.missed).toEqual(["other.html"]);
    expect(c.confirmed).toEqual([]);
  });
});

describe("pinImpact", () => {
  const base = RenderedImpactSchema.parse({
    $schema: RENDERED_IMPACT_TAG,
    renderer: "r",
    method: "cone",
    inputs: ["a.md", "b.md", "cfg.yaml"],
    files: [
      { path: "p.html", change: "changed", role: "content", via: ["a.md", "prose:a"] },
      { path: "q.html", change: "changed", role: "content", via: ["a.md", "b.md"] },
      { path: "idx.json", change: "changed", role: "index", via: [] },
    ],
    undetermined: [{ input: "cfg.yaml", reason: "site-wide", scope: "all" }],
  });
  const blobs = new Map([["a.md", "1"], ["b.md", "2"], ["cfg.yaml", "3"]]);
  const pinned = pinImpact(base, (p) => blobs.get(p));
  const pin = (i: RenderedImpact, path: string) => i.files.find((f) => f.path === path)!.hash;

  test("a file is pinned to the changed inputs on its via, and nothing else on it", () => {
    expect(pin(pinned, "p.html")).toMatch(/^[0-9a-f]{64}$/);
    const relabelled = pinImpact({ ...base, files: base.files.map((f) => (f.path === "p.html" ? { ...f, via: ["a.md", "prose:renamed"] } : f)) }, (p) => blobs.get(p));
    expect(pin(relabelled, "p.html")).toBe(pin(pinned, "p.html"));
  });
  test("an edit moves the pin of exactly the files and inputs it touched", () => {
    const after = pinImpact(base, (p) => (p === "b.md" ? "2b" : blobs.get(p)));
    expect(pin(after, "p.html")).toBe(pin(pinned, "p.html"));
    expect(pin(after, "q.html")).not.toBe(pin(pinned, "q.html"));
    expect(after.undetermined[0]!.hash).toBe(pinned.undetermined[0]!.hash);
  });
  test("a file reached by no changed input is left unpinned rather than pinned to nothing", () => {
    expect(pin(pinned, "idx.json")).toBeUndefined();
  });
  test("a removed input pins as absent, which differs from any version of it", () => {
    const gone = pinImpact(base, (p) => (p === "a.md" ? undefined : blobs.get(p)));
    for (const version of ["1", "1b", "", "0".repeat(40)]) {
      const at = pinImpact(base, (p) => (p === "a.md" ? version : blobs.get(p)));
      expect(pin(gone, "p.html")).not.toBe(pin(at, "p.html"));
      expect(pin(gone, "q.html")).not.toBe(pin(at, "q.html"));
    }
  });
});

describe("RenderedMeasuredSchema", () => {
  test("missedFiles returns the measured files the prediction did not name, with their pins", () => {
    const m = RenderedMeasuredSchema.parse({
      $schema: RENDERED_MEASURED_TAG,
      status: "known",
      baseCommit: "b",
      beforeCommit: "b",
      measured: { $schema: RENDERED_IMPACT_TAG, renderer: "build-diff", method: "build-diff", files: [
        { path: "x.html", change: "changed", role: "content", hash: "h1" },
        { path: "y.html", change: "changed", role: "content", hash: "h2" },
      ] },
      check: { missed: ["y.html"], confirmed: ["x.html"], unconfirmed: [] },
    });
    expect(missedFiles(m)).toEqual([{ path: "y.html", change: "changed", role: "content", via: [], hash: "h2" }]);
  });
});

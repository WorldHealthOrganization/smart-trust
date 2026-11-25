/**
 * The size review (`site-size.ts`): measured over a fixture site laid out in
 * a temporary directory, compared with a `git ls-tree -l` listing, a tree on
 * disk and an earlier report, and run as the build step that writes its
 * report beside the build.
 *
 * @module scripts/tests/site-size.test
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  baselineFromDir,
  baselineFromGit,
  baselineFromLsTree,
  baselineFromReport,
  compareSize,
  formatReport,
  lockInstances,
  measureSite,
  otherLayerDir,
  parseLsTree,
  reviewSiteSize,
  SITE_SIZE_FILE,
  SITE_SIZE_SCHEMA,
} from "../site-size.ts";

let tmp: string;
let site: string;

function put(rel: string, body: string | Buffer, root = site): void {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), body);
}

const LOCK = { instances: [{ instance: "layer-a", path: "layer-a" }, { instance: "layer-b", path: "mounts/layer-b" }] };

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "site-size-"));
  site = join(tmp, "_site");
  put("index.html", "<html>home</html>");
  put("assets/js/app.js", "x".repeat(4000));
  put("assets/js/app.js.map", "m".repeat(3000));
  put("assets/css/site.css", "c".repeat(1000));
  put("assets/css/site.css.map", "n".repeat(500));
  put("artifact/a.json", "same-bytes-".repeat(100));
  put("artifact/a.jsonld", "same-bytes-".repeat(100));
  put("copy/a.json", "same-bytes-".repeat(100));
  put("layer-a/page.html", "a".repeat(2000));
  put("en/layer-b/page.html", "b".repeat(1500));
  put("en/notalayer/page.html", "z".repeat(10));
  put("layer-a.html", "a file named after a layer is not a directory of it");
  put("empty-1.txt", "");
  put("empty-2.txt", "");
  put("assets/js/vendor/sqlite-wasm/sqlite3.wasm", "w".repeat(800));
  writeFileSync(join(tmp, "index.lock.json"), JSON.stringify(LOCK));
});

afterEach(() => rmSync(tmp, { recursive: true, force: true }));

describe("measureSite", () => {
  test("totals, directories, extensions and the biggest files", () => {
    const r = measureSite(site, { lock: join(tmp, "index.lock.json"), now: () => new Date("2026-11-10T00:00:00Z") });
    expect(r.$schema).toBe(SITE_SIZE_SCHEMA);
    expect(r.generatedAt).toBe("2026-11-10T00:00:00.000Z");
    expect(r.total.files).toBe(15);
    expect(r.total.bytes).toBe(r.topDirs.reduce((s, d) => s + d.bytes, 0));
    expect(r.topDirs[0]).toEqual({ path: "assets", bytes: 4000 + 3000 + 1000 + 500 + 800, files: 5 });
    expect(r.topDirs.find((d) => d.path === ".")?.files).toBe(4);
    expect(r.subDirs.find((d) => d.path === "assets/js")?.bytes).toBe(4000 + 3000 + 800);
    expect(r.byExt.find((d) => d.path === ".map")).toEqual({ path: ".map", bytes: 3500, files: 2 });
    expect(r.byExt.find((d) => d.path === "(none)")).toBeUndefined();
    expect(r.biggest[0]).toEqual({ path: "assets/js/app.js", bytes: 4000 });
  });

  test("byte-identical files are grouped, with what the extra copies cost; empty files are not", () => {
    const r = measureSite(site);
    expect(r.duplicates.groups).toHaveLength(1);
    const g = r.duplicates.groups[0]!;
    expect(g.paths).toEqual(["artifact/a.json", "artifact/a.jsonld", "copy/a.json"]);
    expect(g.copies).toBe(3);
    expect(g.bytes).toBe(1100);
    expect(g.wasted).toBe(2200);
    expect(r.duplicates.wasted).toBe(2200);
  });

  test("same size, different bytes: not duplicates", () => {
    put("x/one.txt", "aaaa");
    put("x/two.txt", "bbbb");
    expect(measureSite(site).duplicates.groups.flatMap((g) => g.paths)).not.toContain("x/one.txt");
  });

  test("every .map file is listed", () => {
    const r = measureSite(site);
    expect(r.sourceMaps.files.map((f) => f.path)).toEqual(["assets/js/app.js.map", "assets/css/site.css.map"]);
    expect(r.sourceMaps.bytes).toBe(3500);
  });

  test("directories named after another layer come from the lock, not from a list", () => {
    const r = measureSite(site, { lock: join(tmp, "index.lock.json") });
    expect(r.otherLayers.map((d) => [d.path, d.instance, d.bytes])).toEqual([
      ["layer-a", "layer-a", 2000],
      ["en/layer-b", "layer-b", 1500],
    ]);
    expect(measureSite(site).otherLayers).toEqual([]);
    expect(measureSite(site, { lock: join(tmp, "index.lock.json"), self: ["layer-a"] }).otherLayers.map((d) => d.path)).toEqual(["en/layer-b"]);
  });

  test("directories the shared-assets host could serve are named", () => {
    expect(measureSite(site).shareable).toEqual([{ path: "assets/js/vendor/sqlite-wasm/", bytes: 800, files: 1 }]);
  });
});

describe("helpers", () => {
  test("lockInstances reads names and mount basenames, and tolerates a missing or broken lock", () => {
    expect(lockInstances(join(tmp, "index.lock.json"))).toEqual(["layer-a", "layer-b"]);
    expect(lockInstances(join(tmp, "absent.json"))).toEqual([]);
    writeFileSync(join(tmp, "bad.json"), "{");
    expect(lockInstances(join(tmp, "bad.json"))).toEqual([]);
  });

  test("otherLayerDir: the outermost directory within three segments, never the file", () => {
    const L = new Set(["l"]);
    expect(otherLayerDir("l/x.html", L)).toEqual({ dir: "l", instance: "l" });
    expect(otherLayerDir("en/l/x.html", L)).toEqual({ dir: "en/l", instance: "l" });
    expect(otherLayerDir("a/b/l/x.html", L)).toEqual({ dir: "a/b/l", instance: "l" });
    expect(otherLayerDir("a/b/c/l/x.html", L)).toBeUndefined();
    expect(otherLayerDir("l", L)).toBeUndefined();
  });

  test("parseLsTree keeps blobs, skips submodules, unquotes paths", () => {
    const text = [
      "100644 blob 0123abcd     120\tindex.html",
      "100644 blob 0123abce    5000\tbranches/x/index.html",
      "160000 commit 0123abcf       -\tvendor/sub",
      '100644 blob 0123abd0      10\t"odd \\"name\\".txt"',
      "",
    ].join("\n");
    expect(parseLsTree(text)).toEqual([
      { path: "index.html", bytes: 120 },
      { path: "branches/x/index.html", bytes: 5000 },
      { path: 'odd "name".txt', bytes: 10 },
    ]);
    const b = baselineFromLsTree(text, "gh-pages");
    expect(b.total).toEqual({ bytes: 130, files: 2 });
    expect(b.topDirs).toEqual({ ".": 130 });
  });
});

describe("compareSize", () => {
  test("growth over the budget is a warning, said and not refused", () => {
    const r = measureSite(site, { lock: join(tmp, "index.lock.json") });
    const before = { source: "published", total: { bytes: 1000, files: 3 }, topDirs: { assets: 1000 }, byExt: { ".js": 1000 } };
    const c = compareSize(r, before, { pct: 10, mb: 10 });
    expect(c.deltaBytes).toBe(r.total.bytes - 1000);
    expect(c.deltaPct).toBeGreaterThan(10);
    expect(c.warnings[0]).toContain("grew");
    expect(c.warnings.some((w) => w.includes("source map"))).toBe(true);
    expect(c.warnings.some((w) => w.includes("another layer"))).toBe(true);
    expect(c.dirs[0]!.path).toBe("assets");
  });

  test("within the budget: no growth warning", () => {
    const r = measureSite(site);
    const same = { source: "published", total: r.total, topDirs: {}, byExt: {} };
    expect(compareSize(r, same).warnings.some((w) => w.includes("grew"))).toBe(false);
  });

  test("a tree on disk and an earlier report are baselines too", () => {
    const pub = join(tmp, "published");
    put("index.html", "<html>home</html>", pub);
    put("branches/p/index.html", "preview", pub);
    expect(baselineFromDir(pub, "disk").total).toEqual({ bytes: 17, files: 1 });

    const r = measureSite(site);
    const file = join(tmp, SITE_SIZE_FILE);
    writeFileSync(file, JSON.stringify(r));
    const b = baselineFromReport(file)!;
    expect(b.total).toEqual(r.total);
    expect(compareSize(r, b).deltaBytes).toBe(0);
    writeFileSync(join(tmp, "other.json"), JSON.stringify({ $schema: "something-else" }));
    expect(baselineFromReport(join(tmp, "other.json"))).toBeUndefined();
  });

  test("formatReport names every section", () => {
    const r = measureSite(site, { lock: join(tmp, "index.lock.json") });
    r.comparison = compareSize(r, { source: "gh-pages", total: { bytes: 100, files: 1 }, topDirs: { ".": 100 }, byExt: { ".html": 100 } });
    const text = formatReport(r).join("\n");
    for (const s of ["top directories", "by extension", "biggest files", "byte-identical files: 1 group", "source maps: 2 file(s)", "another layer", "shared-assets host", "against gh-pages", "budget (advisory)", "⚠"]) expect(text).toContain(s);
  });
});

describe("the build step", () => {
  test("against the local origin/gh-pages, by git ls-tree", () => {
    const repo = join(tmp, "repo");
    mkdirSync(repo);
    const git = (...a: string[]) => spawnSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", ...a], { encoding: "utf-8" });
    git("init", "-q");
    put("index.html", "x".repeat(100), repo);
    put("STAGING/old/index.html", "y".repeat(100000), repo);
    git("add", ".");
    git("commit", "-q", "-m", "pages");
    git("update-ref", "refs/remotes/origin/gh-pages", "HEAD");
    const b = baselineFromGit(repo, "origin/gh-pages")!;
    expect(b.total).toEqual({ bytes: 100, files: 1 });
    expect(b.source).toMatch(/^origin\/gh-pages \(/);
    expect(baselineFromGit(repo, "origin/absent")).toBeUndefined();

    const lines: string[] = [];
    const out = join(tmp, "build", SITE_SIZE_FILE);
    mkdirSync(dirname(out));
    const r = reviewSiteSize({ site, out, repo, log: (l) => lines.push(l) })!;
    expect(r.comparison?.before.bytes).toBe(100);
    expect(existsSync(out)).toBe(true);
    expect(existsSync(join(site, SITE_SIZE_FILE))).toBe(false);
    expect(JSON.parse(readFileSync(out, "utf-8")).$schema).toBe(SITE_SIZE_SCHEMA);
    expect(lines.some((l) => l.includes("against origin/gh-pages"))).toBe(true);
  });

  test("with no published tree, the last report is the baseline; a missing site is said, not thrown", () => {
    const out = join(tmp, SITE_SIZE_FILE);
    const log: string[] = [];
    reviewSiteSize({ site, out, repo: tmp, log: (l) => log.push(l) });
    expect(log.some((l) => l.includes("no published site or earlier report"))).toBe(true);
    put("assets/js/new.js", "n".repeat(50));
    const r = reviewSiteSize({ site, out, repo: tmp, log: () => {} })!;
    expect(r.comparison?.deltaBytes).toBe(50);
    const miss: string[] = [];
    expect(reviewSiteSize({ site: join(tmp, "nope"), out, repo: tmp, log: (l) => miss.push(l) })).toBeUndefined();
    expect(miss[0]).toContain("nothing measured");
  });
});

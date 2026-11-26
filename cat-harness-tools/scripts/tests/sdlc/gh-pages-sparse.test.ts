/**
 * The staging deploy's scripts on a SPARSE, blobless checkout of `gh-pages`
 * give the answers they give on a full one: the share plan, the rotation (and
 * the tree it commits), the push gate's tip, the render log, and the changes
 * page's diff against the publish root.
 *
 * @module scripts/tests/sdlc/gh-pages-sparse.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createStagingPreview, serializeStagingPreview } from "../../../schemas/sdlc/staging-preview.ts";
import { FRAGMENT } from "../../staging-banner.ts";
import { planShare } from "../../staging-share.ts";
import { STAGED_AT_FILE, STAGED_SIZE_FILE, readPreviews, rotate, sizeDigest, writeSizeRecord, type GitTime } from "../../staging-rotate.ts";
import { readTip } from "../../staging-push-gate.ts";
import { appendEntry, buildEntry } from "../../render-log.ts";
import { measureGitRoot, measureSites, provenanceIndex } from "../../staging-changes.ts";
import { inCone } from "../../lib/git-blobs.ts";
import { blobAbsent, fullClone, git, origin, put, sparseClone, treeClone } from "./gh-pages-fixture.ts";

const NOW = "2026-10-02T12:00:00.000Z";
const NOW_MS = Date.parse(NOW);
const ago = (h: number) => new Date(NOW_MS - h * 3_600_000).toISOString();
const noGit: GitTime = () => undefined;
const cone = (slug: string) => [`branches/${slug}`, "branches/_retired", "_render-log"];

const live = (body: string) =>
  `<html><head><link rel="canonical" href="https://x/p.html"><meta name="fa-staging" content=""><meta name="fa-search-index" content=""><title>P</title></head><body>${body}</body></html>`;
const previewOf = (body: string) =>
  `<html><head><meta name="fa-staging" content="preview"><meta name="fa-search-index" content="published"><title>P (staging: s1)</title></head><body>${FRAGMENT}${body}</body></html>`;

describe("the cone, as git draws it", () => {
  test("root files, files beside a path to a cone directory, and everything under one", () => {
    const dirs = ["branches/s1", "_render-log"];
    expect(inCone("index.html", dirs)).toBe(true);
    expect(inCone("branches/README.txt", dirs)).toBe(true);
    expect(inCone("branches/s1/a/b.html", dirs)).toBe(true);
    expect(inCone("_render-log/1.jsonl", dirs)).toBe(true);
    expect(inCone("branches/s10/index.html", dirs)).toBe(false);
    expect(inCone("branches/b/index.html", dirs)).toBe(false);
    expect(inCone("docs/a.html", dirs)).toBe(false);
  });
});

describe("staging-share — the plan from git objects is the plan from a checkout", () => {
  const big = Buffer.alloc(4096, 7);
  const o = origin({
    "index.html": live("home"),
    "docs/same.html": live("same"),
    "docs/changed.html": live("old"),
    "docs/same.css": "a{}",
    "docs/diff.css": "a{}",
    "docs/big.bin": big,
    "payload/retained.json": JSON.stringify({ version: 1, kept: { "payload/sha256/k.bin": "2026-01-01T00:00:00Z" } }),
    "payload/sha256/k.bin": "k",
    "branches/other/x.bin": Buffer.alloc(8192, 1),
  });
  const preview = {
    "index.html": previewOf("home"),
    "docs/same.html": previewOf("same"),
    "docs/changed.html": previewOf("new"),
    "docs/same.css": "a{}",
    "docs/diff.css": "b{}",
    "docs/big.bin": big,
    "docs/new.js": "x",
    "payload/sha256/k.bin": "k",
    "staging.json": "{}",
  };
  const full = fullClone(o);
  const sparse = sparseClone(o, cone("s1"));
  for (const d of [full, sparse]) put(join(d, "branches", "s1"), preview);

  test("same shared list, kept count and bytes", () => {
    const a = planShare(full, join(full, "branches", "s1"), "s1");
    const b = planShare(sparse, join(sparse, "branches", "s1"), "s1");
    expect(b).toEqual(a);
    expect(a.shared.sort()).toEqual(["docs/big.bin", "docs/same.css", "docs/same.html"]);
  });

  test("a live file left on disk outside the cone is read from the index, not the disk", () => {
    const s2 = sparseClone(o, cone("s1"));
    put(join(s2, "branches", "s1"), preview);
    put(s2, { "docs/diff.css": "b{}" }); // a stale copy that would match the preview
    expect(planShare(s2, join(s2, "branches", "s1"), "s1")).toEqual(planShare(full, join(full, "branches", "s1"), "s1"));
  });

  test("a blob fetch that fails throws, so apply removes nothing", () => {
    const s2 = sparseClone(o, cone("s1"));
    put(join(s2, "branches", "s1"), preview);
    git(s2, "remote", "set-url", "origin", `file://${join(tmpdir(), "no-such-origin")}`);
    expect(() => planShare(s2, join(s2, "branches", "s1"), "s1")).toThrow(/could not fetch/);
  });

  test("a byte-identical file is decided by its blob id, without fetching it", () => {
    expect(blobAbsent(sparse, "docs/big.bin")).toBe(true);
    expect(blobAbsent(sparse, "docs/same.css")).toBe(true);
    expect(blobAbsent(sparse, "branches/other/x.bin")).toBe(true);
    // A page is compared with the per-preview edits set aside, so its blob was read.
    expect(blobAbsent(sparse, "docs/same.html")).toBe(false);
  });
});

describe("staging-rotate — the same plan, and the same commit, on a sparse checkout", () => {
  // `a` carries a size record from an earlier staging; `b` predates them.
  const files: Record<string, string | Buffer> = {
    "index.html": "live",
    "branches/a/index.html": "a".repeat(300),
    "branches/a/big.bin": Buffer.alloc(2000, 2),
    [`branches/a/${STAGED_AT_FILE}`]: `${ago(1)}\n`,
    "branches/b/index.html": "b".repeat(1000),
    [`branches/b/${STAGED_AT_FILE}`]: `${ago(5)}\n`,
    "branches/c/index.html": "c".repeat(500),
    "branches/d/index.html": "d".repeat(500),
    "branches/d/staging-preview.json": serializeStagingPreview(
      createStagingPreview({ slug: "d", branch: "claude/d", commit: "abc1234", builtAt: ago(50) }),
    ),
    "branches/_retired/old.json": "{}",
    "branches/README.txt": "not a preview",
    "_render-log/2026-10-01.jsonl":
      JSON.stringify({
        $schema: "folio-render-log/v1",
        id: "x",
        at: ago(10),
        event: "rendered",
        subject: { kind: "staging-preview", path: "branches/c", slug: "c" },
        summary: "staging preview published",
        process: "Process_RenderLog",
        capture: "on",
      }) + "\n",
  };
  // The record `a` would have been given when it was staged.
  const seed = mkdtempSync(join(tmpdir(), "seed-"));
  put(seed, files);
  writeSizeRecord(seed, join(seed, "branches", "a"));
  files[`branches/a/${STAGED_SIZE_FILE}`] = readFileSync(join(seed, "branches", "a", STAGED_SIZE_FILE));
  const o = origin(files);

  const fresh = () => {
    const full = fullClone(o);
    const sparse = sparseClone(o, cone("cur"));
    for (const d of [full, sparse]) put(join(d, "branches", "cur"), { "index.html": "n".repeat(400) });
    return { full, sparse };
  };

  test("inCone agrees with git's own skip-worktree marks on a fresh checkout", () => {
    const { sparse } = fresh();
    for (const line of git(sparse, "ls-files", "-t").split("\n").filter(Boolean)) {
      const path = line.slice(2);
      expect([path, inCone(path, cone("cur"))]).toEqual([path, line[0] !== "S"]);
    }
  });

  test("every preview has the same age, source and size", () => {
    const { full, sparse } = fresh();
    const a = readPreviews(full, noGit);
    expect(readPreviews(sparse, noGit)).toEqual(a);
    expect(a.map((p) => [p.slug, p.source])).toEqual([
      ["a", "stamp"],
      ["b", "stamp"],
      ["c", "render-log"],
      ["cur", "unknown"],
      ["d", "record"],
    ]);
  });

  test("a recorded size is read without the preview's blobs; an unrecorded one fetches them", () => {
    const { sparse } = fresh();
    readPreviews(sparse, noGit);
    expect(blobAbsent(sparse, "branches/a/big.bin")).toBe(true);
    expect(blobAbsent(sparse, "branches/b/index.html")).toBe(false);
  });

  test("a size record that no longer matches the preview's files is not trusted", () => {
    const o2 = origin({ ...files, "branches/a/added.txt": "written after the record" });
    const a = readPreviews(fullClone(o2), noGit).find((p) => p.slug === "a");
    const b = readPreviews(sparseClone(o2, cone("cur")), noGit).find((p) => p.slug === "a");
    expect(b).toEqual(a);
  });

  test("the rotation removes the same previews and commits the same tree", () => {
    const { full, sparse } = fresh();
    const budget = 4000;
    const r1 = rotate({ dir: full, current: "cur", now: NOW, git: noGit, budget });
    const r2 = rotate({ dir: sparse, current: "cur", now: NOW, git: noGit, budget });
    expect(r2.plan).toEqual(r1.plan);
    expect(r2.lines).toEqual(r1.lines);
    expect(r1.plan.remove.map((p) => p.slug)).toEqual(["c", "d"]);
    // What the deploy step stages, in each checkout.
    for (const d of [full, sparse]) {
      git(d, "add", "-A", "branches/cur", "_render-log");
      git(d, "add", "-A", "branches");
    }
    expect(git(sparse, "write-tree")).toBe(git(full, "write-tree"));
    expect(git(full, "ls-files", "branches/_retired").split("\n").filter(Boolean)).toEqual([
      "branches/_retired/d.json",
      "branches/_retired/old.json",
    ]);
  });

  test("a preview directory on disk OUTSIDE the cone is read, and removed, from the index", () => {
    const { full, sparse } = fresh();
    // What a batch writer leaves: a rewritten preview outside the cone, and an empty leftover.
    put(join(sparse, "branches", "b"), { "index.html": "rewritten, never committed" });
    mkdirSync(join(sparse, "branches", "c"), { recursive: true });
    expect(readPreviews(sparse, noGit)).toEqual(readPreviews(full, noGit));
    const budget = 4000;
    const r1 = rotate({ dir: full, current: "cur", now: NOW, git: noGit, budget });
    const r2 = rotate({ dir: sparse, current: "cur", now: NOW, git: noGit, budget });
    expect(r2.plan).toEqual(r1.plan);
    expect(existsSync(join(sparse, "branches", "c"))).toBe(false);
    for (const d of [full, sparse]) git(d, "add", "-A", "branches", "_render-log");
    expect(git(sparse, "write-tree")).toBe(git(full, "write-tree"));
    expect(git(sparse, "ls-files", "branches/c")).toBe("");
  });

  test("the preview being staged outside the cone is refused, before anything is written", () => {
    const sparse = sparseClone(o, cone("cur"));
    put(join(sparse, "branches", "a"), { "index.html": "new" });
    expect(() => rotate({ dir: sparse, current: "a", now: NOW, git: noGit, budget: 1 })).toThrow(/outside the sparse checkout's cone/);
    expect(readFileSync(join(sparse, "branches", "a", "index.html"), "utf8")).toBe("new");
    expect(existsSync(join(sparse, "branches", "a", STAGED_AT_FILE))).toBe(false);
  });

  test("a preview NEW to gh-pages, outside the cone, is refused too, before anything is written", () => {
    const sparse = sparseClone(o, cone("cur"));
    const index = git(sparse, "ls-files", "-s");
    put(join(sparse, "branches", "brand-new"), { "index.html": "new" });
    expect(() => rotate({ dir: sparse, current: "brand-new", now: NOW, git: noGit, budget: 1 })).toThrow(/outside the sparse checkout's cone/);
    expect(existsSync(join(sparse, "branches", "brand-new", STAGED_AT_FILE))).toBe(false);
    expect(git(sparse, "ls-files", "-s")).toBe(index);
  });

  test("a blob fetch that fails stops the rotation before any removal", () => {
    const { sparse } = fresh();
    git(sparse, "remote", "set-url", "origin", `file://${join(tmpdir(), "no-such-origin")}`);
    const index = git(sparse, "ls-files", "-s");
    const log = readFileSync(join(sparse, "_render-log", "2026-10-01.jsonl"), "utf8");
    expect(() => rotate({ dir: sparse, current: "cur", now: NOW, git: noGit, budget: 4000 })).toThrow(/could not fetch/);
    expect(git(sparse, "ls-files", "-s")).toBe(index);
    expect(readdirSync(join(sparse, "_render-log"))).toEqual(["2026-10-01.jsonl"]);
    expect(readFileSync(join(sparse, "_render-log", "2026-10-01.jsonl"), "utf8")).toBe(log);
    expect(readdirSync(join(sparse, "branches", "_retired"))).toEqual(["old.json"]);
  });

  test("the size record's digest is injective and its file count is checked", () => {
    // The newline-joined form this replaced gave these two sets one text.
    expect(sizeDigest([{ oid: "o1", path: "p\no2 q" }])).not.toBe(sizeDigest([{ oid: "o1", path: "p" }, { oid: "o2", path: "q" }]));
    // A record that names the right files but the wrong count is not trusted.
    const forged = { ...files };
    const rec = JSON.parse(String(files[`branches/a/${STAGED_SIZE_FILE}`]));
    forged[`branches/a/${STAGED_SIZE_FILE}`] = `${JSON.stringify({ ...rec, files: rec.files + 1, bytes: 1 })}\n`;
    const o3 = origin(forged);
    const want = readPreviews(fullClone(o3), noGit).find((x) => x.slug === "a");
    const sparse = sparseClone(o3, cone("cur"));
    expect(readPreviews(sparse, noGit).find((x) => x.slug === "a")).toEqual(want);
    expect(blobAbsent(sparse, "branches/a/big.bin")).toBe(false);
  });
});

describe("staging-push-gate and render-log — nothing they read is outside the cone", () => {
  const o = origin({ "index.html": "x", "_render-log/2026-10-02.jsonl": "", "branches/a/x": "y" }, "staging(a): from b", "2026-10-02T11:00:00Z");

  test("the tip is the same", () => {
    const tip = readTip(fullClone(o));
    expect(tip).toEqual({ committedMs: Date.parse("2026-10-02T11:00:00Z"), subject: "staging(a): from b" });
    expect(readTip(sparseClone(o, cone("s1")))).toEqual(tip);
  });

  test("the render log is appended to the same file", () => {
    const entry = buildEntry({ event: "rendered", kind: "staging-preview", path: "branches/s1", slug: "s1", summary: "s", at: NOW, id: "i" });
    const [full, sparse] = [fullClone(o), sparseClone(o, cone("s1"))];
    expect(appendEntry(sparse, entry)).toBe(appendEntry(full, entry));
    const rel = "_render-log/2026-10-02.jsonl";
    expect(readFileSync(join(sparse, rel), "utf8")).toBe(readFileSync(join(full, rel), "utf8"));
  });
});

describe("staging-changes — the publish root from its tree is the root from a checkout", () => {
  const page = (base: string, nav: string, body: string) =>
    `<html><nav>${nav}<a href="${base}/x.html">x</a></nav><main><a href="${base}/y.html">y</a>${body}</main></html>`;
  const o = origin({
    "index.html": page("/r", "sha:aaa", "home"),
    "a.html": page("/r", "sha:aaa", "A"),
    "b.html": page("/r", "sha:aaa", "B"),
    "ref/one.html": page("/r", "sha:aaa", '<p>Generated from <code>m/x.md</code></p>'),
    "same.css": "a{}",
    "based.css": "a{background:url(/r/STAGING/s/i.png)}",
    "logo.png": Buffer.alloc(3000, 4),
    "old.png": Buffer.alloc(3000, 5),
    "build.json": JSON.stringify({ sha: "base1" }),
    "branches/other/a.html": "theirs",
    "_render-log/1.jsonl": "{}",
  });
  const site = mkdtempSync(join(tmpdir(), "site-"));
  put(site, {
    "index.html": page("/r/STAGING/s", "branch:feat", "home"),
    "a.html": page("/r/STAGING/s", "branch:feat", "A2"),
    "b.html": page("/r/STAGING/s", "branch:feat", "B"),
    "same.css": "a{}",
    "based.css": "a{background:url(/r/STAGING/s/i.png)}",
    "logo.png": Buffer.alloc(3000, 4),
    "old.png": Buffer.alloc(3000, 6),
    "new.svg": "<svg/>",
    "rendered-impact.json": "[]",
  });
  const rule = { stagingBase: "/r/STAGING/s", siteBase: "/r" };
  const full = fullClone(o);
  const tree = treeClone(o);

  test("the same diff, provenance and build stamp", () => {
    const g = measureGitRoot({ dir: tree, after: site, rule, base: "b1", head: "h1" });
    expect(g.measured).toEqual(measureSites({ before: full, after: site, rule, base: "b1", head: "h1" }));
    expect(g.provenance).toEqual(provenanceIndex(full));
    expect(g.build).toEqual({ sha: "base1" });
    expect(g.measured!.files.map((f) => [f.path, f.change])).toEqual([
      ["a.html", "changed"],
      ["based.css", "changed"],
      ["build.json", "removed"],
      ["new.svg", "added"],
      ["old.png", "changed"],
      ["ref/one.html", "removed"],
    ]);
  });

  test("binary files and unchanged text are compared by blob id, never fetched", () => {
    measureGitRoot({ dir: tree, after: site, rule });
    expect(blobAbsent(tree, "logo.png")).toBe(true);
    expect(blobAbsent(tree, "old.png")).toBe(true);
    expect(blobAbsent(tree, "same.css")).toBe(true);
    expect(blobAbsent(tree, "branches/other/a.html")).toBe(true);
    // Text the base fold would change is read, so it is compared as `--before` compares it.
    expect(blobAbsent(tree, "based.css")).toBe(false);
  });

  test("the CLI writes the same changes.json from --before-git as from --before", () => {
    const sources = join(mkdtempSync(join(tmpdir(), "src-")), "sources.json");
    put(dirname0(sources), {
      "sources.json": JSON.stringify({
        $schema: "staging-changes/v1",
        repository: "o/r",
        head: "h1",
        changes: [{ path: "m/x.md", status: "modified", repository: "o/r", upstreamPath: "m/x.md", ref: "h1", mounted: true }],
        repins: [],
      }),
    });
    const run = (root: string[]) => {
      const out = mkdtempSync(join(tmpdir(), "out-"));
      const r = spawnSync(
        "bun",
        ["run", join(import.meta.dir, "..", "..", "staging-changes.ts"), "render", "--sources", sources, ...root, "--after", site,
          "--staging-base", "/r/STAGING/s", "--site-base", "/r", "--base", "base1",
          "--site-url", "https://o.github.io/r/", "--staging-url", "https://o.github.io/r/STAGING/s/", "--out", out],
        { encoding: "utf-8" },
      );
      expect(r.status).toBe(0);
      return readFileSync(join(out, "changes.json"), "utf8");
    };
    const a = run(["--before", full]);
    expect(run(["--before-git", tree])).toBe(a);
    expect(JSON.parse(a).qa.status).toBe("known");
  });
});

function dirname0(p: string): string {
  return p.slice(0, p.lastIndexOf("/"));
}

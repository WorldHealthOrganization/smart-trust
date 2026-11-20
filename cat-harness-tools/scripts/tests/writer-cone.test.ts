/**
 * Writer records for the rerun-and-measure deploy (bean `fwtz`, option B).
 * @covers scripts/writer-cone.ts
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseTrace } from "../ci-cone.ts";
import { FileDigests } from "../input-hash.ts";
import { carryRecord, changedWhy, churnReport, decideWriter, entryShaOf, renderChurn, emptyRecords, snapshotPaths, tracedArgv, underOutputs, verifySummary, verifyWriters, writerRecordOf } from "../writer-cone.ts";

const ROOT = "/work/repo";

describe("parseTrace in collect mode — a writer's reads and writes", () => {
  const collect = (lines: string[]) => parseTrace(lines.join("\n"), ROOT, { writes: "collect" });

  test("what it wrote is output, not input; a path probed absent and then created was absent before", () => {
    const r = collect([
      `10 openat(AT_FDCWD</work/repo>, "beans/defs/a.md", O_RDONLY|O_CLOEXEC) = 3</work/repo/beans/defs/a.md>`,
      `10 newfstatat(AT_FDCWD</work/repo>, "site/out", 0x7ffc, 0) = -1 ENOENT (No such file or directory)`,
      `10 mkdir("/work/repo/site/out", 0777) = 0`,
      `10 openat(AT_FDCWD</work/repo>, "site/out/index.json", O_WRONLY|O_CREAT|O_TRUNC|O_CLOEXEC, 0666) = 4</work/repo/site/out/index.json>`,
    ]);
    expect(r).toEqual({ paths: ["beans/defs/a.md"], git: [], writes: ["site/out", "site/out/index.json"], absentBefore: ["site/out"] });
  });

  test("a path it read while it existed and then rewrote cannot be replayed", () => {
    const r = collect([
      `10 openat(AT_FDCWD</work/repo>, "site/out/index.json", O_RDONLY|O_CLOEXEC) = 3</work/repo/site/out/index.json>`,
      `10 openat(AT_FDCWD</work/repo>, "site/out/index.json", O_WRONLY|O_TRUNC|O_CLOEXEC) = 4</work/repo/site/out/index.json>`,
    ]);
    expect(r).toEqual({ undetermined: "the writer reads site/out/index.json and then rewrites it" });
  });

  test("a write that failed is a probe: mkdir -p meeting an existing directory does not rewrite it", () => {
    const r = collect([
      `10 newfstatat(AT_FDCWD</work/repo>, "smart-base/docs", {st_mode=S_IFDIR|0755}, 0) = 0`,
      `10 mkdir("/work/repo/smart-base/docs", 0777) = -1 EEXIST (File exists)`,
      `10 openat(AT_FDCWD</work/repo>, "smart-base/docs/p.md", O_WRONLY|O_CREAT|O_TRUNC|O_CLOEXEC, 0666) = 4</work/repo/smart-base/docs/p.md>`,
    ]);
    expect(r).toEqual({ paths: ["smart-base/docs"], git: [], writes: ["smart-base/docs/p.md"], absentBefore: [] });
  });

  test("a call strace lost as a thread detached names nothing, and a named one keeps its arguments", () => {
    const r = collect([
      `10 openat(AT_FDCWD</work/repo>, "a.md", O_RDONLY|O_CLOEXEC) = 3</work/repo/a.md>`,
      `11 ???( <detached ...>`,
      `12 ???( <unfinished ...>`,
      `12 <... ??? resumed> <detached ...>`,
      `15 ???( <unfinished ...>`,
      `15 <... ??? resumed>) = ?`,
      `16 <... futex resumed> <detached ...>`,
      `17 <detached ...>`,
      `13 clone3({flags=CLONE_VM|CLONE_FS}, 88 <detached ...>`,
      `14 openat(AT_FDCWD</work/repo>, "b.md", O_RDONLY|O_CLOEXEC <unfinished ...>`,
      `14 <... openat resumed> <detached ...>`,
    ]);
    expect(r).toEqual({ paths: ["a.md", "b.md"], git: [], writes: [], absentBefore: [] });
  });

  test("git run with an absolute -C at the root is replayed from the root", () => {
    const r = collect([
      `20 getcwd("/work/repo", 4096) = 11`,
      // input-site: inert #1c312c7e — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
      `20 execve("/usr/bin/git", ["git", "-C", "/work/repo", "remote", "get-url", "origin"], 0x1 /* 3 vars */) = 0`,
    ]);
    expect(r).toEqual({ paths: [], git: [{ cwd: "", args: ["remote", "get-url", "origin"] }], writes: [], absentBefore: [] });
  });

  test("re-reading its own declared output before rewriting it is not an input; anything else still refuses", () => {
    const lines = [
      `10 openat(AT_FDCWD</work/repo>, "docs/out/index.html", O_RDONLY|O_CLOEXEC) = 3</work/repo/docs/out/index.html>`,
      `10 openat(AT_FDCWD</work/repo>, "docs/out/index.html", O_WRONLY|O_TRUNC|O_CLOEXEC) = 4</work/repo/docs/out/index.html>`,
    ];
    const own = underOutputs(["docs/out/"]);
    expect(parseTrace(lines.join("\n"), ROOT, { writes: "collect", ownOutput: own })).toEqual({ paths: [], git: [], writes: ["docs/out/index.html"], absentBefore: [] });
    expect(parseTrace(lines.join("\n"), ROOT, { writes: "collect", ownOutput: underOutputs(["docs/other/", "docs/out"]) })).toEqual({
      undetermined: "the writer reads docs/out/index.html and then rewrites it",
    });
    // A plain read inside its own outputs is not an input either: a skip restores it.
    const probe = [`10 newfstatat(AT_FDCWD</work/repo>, "docs/out", {st_mode=S_IFDIR|0755}, 0) = 0`, `10 openat(AT_FDCWD</work/repo>, "src/a.md", O_RDONLY) = 3</work/repo/src/a.md>`];
    expect(parseTrace(probe.join("\n"), ROOT, { writes: "collect", ownOutput: own })).toEqual({ paths: ["src/a.md"], git: [], writes: [], absentBefore: [] });
    expect(underOutputs(["a/b/", "c.json"])("a/b")).toBe(true);
    expect(underOutputs(["a/b/", "c.json"])("a/bc")).toBe(false);
    expect(underOutputs(["a/b/", "c.json"])("c.json")).toBe(true);
  });

  test("a rewritten file nobody declares is kept as an input, with its state after the run", () => {
    const lines = [
      `10 openat(AT_FDCWD</work/repo>, "docs/todo/index.html", O_RDONLY|O_CLOEXEC) = 3</work/repo/docs/todo/index.html>`,
      `10 openat(AT_FDCWD</work/repo>, "docs/todo/index.html", O_WRONLY|O_TRUNC|O_CLOEXEC) = 4</work/repo/docs/todo/index.html>`,
      `10 openat(AT_FDCWD</work/repo>, "docs/new.html", O_WRONLY|O_CREAT|O_TRUNC, 0644) = 5</work/repo/docs/new.html>`,
    ];
    const r = parseTrace(lines.join("\n"), ROOT, { writes: "collect", rewriteAsInput: (rel) => rel !== "docs/declared.html" });
    expect(r).toEqual({ paths: ["docs/todo/index.html"], git: [], writes: ["docs/new.html"], absentBefore: [], rewritten: ["docs/todo/index.html"] });
    // Declared by some writer: still refused.
    expect(parseTrace(lines.join("\n"), ROOT, { writes: "collect", rewriteAsInput: (rel) => rel !== "docs/todo/index.html" })).toEqual({
      undetermined: "the writer reads docs/todo/index.html and then rewrites it",
    });
  });

  test("a directory it listed (getdents64) is marked listed; one it only opened is not (tools#1265)", () => {
    const r = collect([
      `10 openat(AT_FDCWD</work/repo>, "/work/repo/data", O_RDONLY|O_CLOEXEC|O_DIRECTORY) = 5</work/repo/data>`,
      `10 getdents64(5</work/repo/data>, 0x7ffe /* 4 entries */, 8192) = 96`,
      `10 getdents64(5</work/repo/data>, 0x7ffe /* 0 entries */, 8192) = 0`,
      `10 openat(AT_FDCWD</work/repo>, "/work/repo/opened", O_RDONLY|O_CLOEXEC|O_DIRECTORY) = 6</work/repo/opened>`,
      `10 openat(6</work/repo/opened>, "k.json", O_RDONLY|O_CLOEXEC) = 7</work/repo/opened/k.json>`,
      `10 getdents64(9</usr/lib>, 0x7ffe /* 4 entries */, 8192) = 96`,
    ]);
    expect(r).toEqual({ paths: ["data", "opened", "opened/k.json"], git: [], listed: ["data"], writes: [], absentBefore: [] });
  });

  test("the default still refuses any write (checks are unchanged)", () => {
    const r = parseTrace(`10 openat(AT_FDCWD</work/repo>, "x", O_WRONLY|O_CREAT, 0644) = 3</work/repo/x>`, ROOT);
    expect("undetermined" in r).toBe(true);
  });

  test("a failed mkdir (-1 EEXIST) on an already-read directory does not mark the directory as rewritten, and <detached ...> lines parse", () => {
    const r = collect([
      `10 newfstatat(AT_FDCWD</work/repo>, "smart-base/docs", {st_mode=S_IFDIR|0755}, 0) = 0`,
      `10 mkdir("/work/repo/smart-base/docs", 0777) = -1 EEXIST (File exists)`,
      `10 openat(AT_FDCWD</work/repo>, "smart-base/docs/index.md", O_WRONLY|O_CREAT|O_TRUNC|O_CLOEXEC, 0666) = 4</work/repo/smart-base/docs/index.md>`,
      `11 openat(AT_FDCWD</work/repo>, "in/extra.json", O_RDONLY <detached ...>`,
      `12 ???( <detached ...>`,
    ]);
    expect(r).toEqual({
      paths: ["in/extra.json", "smart-base/docs"],
      git: [],
      writes: ["smart-base/docs/index.md"],
      absentBefore: [],
    });
  });
});

describe("writerRecordOf and decideWriter", () => {
  const fp = { hash: "base1", audit: "clean" } as const;

  test("records reads with their state and outputs, then skips only while every read matches", () => {
    const root = mkdtempSync(join(tmpdir(), "writer-cone-"));
    try {
      mkdirSync(join(root, "in"), { recursive: true });
      writeFileSync(join(root, "in/a.txt"), "one");
      mkdirSync(join(root, "out"), { recursive: true });
      writeFileSync(join(root, "out/o.json"), "{}");
      const rec = writerRecordOf({
        sha: "abc123",
        ran: true,
        before: fp,
        after: fp,
        reads: { paths: ["in/a.txt"], git: [], writes: ["out/o.json"], absentBefore: ["later"] },
        reached: undefined,
        root,
        digests: new FileDigests(root),
      });
      if ("none" in rec) throw new Error(rec.none);
      // A path it probed absent and created is its own output, not an input.
      expect(Object.keys(rec.reads)).toEqual(["in/a.txt"]);
      expect(Object.keys(rec.outputs)).toEqual(["out/o.json"]);

      const records = emptyRecords("abc123");
      records.writers["w"] = rec;
      const yes = decideWriter(records, "w", fp, root, new FileDigests(root));
      expect(yes.skip && yes.proof).toBe(true);
      records.writers["w"] = { ...rec, audit: "unannotated env site" };
      const ev = decideWriter(records, "w", fp, root, new FileDigests(root));
      expect(ev.skip && !ev.proof && ev.why.includes("evidence only")).toBe(true);
      records.writers["w"] = rec;
      expect(decideWriter(records, "w", { hash: "other", audit: "clean" }, root, new FileDigests(root))).toEqual({ skip: false, why: "its script, imports, audited environment or tools changed", cause: { kind: "script" } });
      writeFileSync(join(root, "in/a.txt"), "two");
      expect(decideWriter(records, "w", fp, root, new FileDigests(root))).toEqual({ skip: false, why: "in/a.txt changed", cause: { kind: "path", path: "in/a.txt" } });
      writeFileSync(join(root, "in/a.txt"), "one");

      // verifyWriters: a skippable writer whose fresh output matches is safe; one that differs is unsafe.
      const v = (files: string[]) => verifyWriters({ prev: records, writers: ["w", "x"], base: () => fp, root, digests: new FileDigests(root), filesNow: (w) => (w === "w" ? files : []) });
      expect(v(["out/o.json"])).toEqual([
        { writer: "w", verdict: "skip-safe", proof: true, outputs: 1 },
        { writer: "x", verdict: "rerun", why: "the deploy at abc123 recorded nothing for it" },
      ]);
      writeFileSync(join(root, "out/o.json"), '{"changed":1}');
      expect(v(["out/o.json", "out/new.json"])[0]).toEqual({ writer: "w", verdict: "skip-unsafe", proof: true, differs: ["out/new.json (not in the record)", "out/o.json"] });
      expect(verifySummary(v(["out/o.json"]), "abc123")).toContain("**unsafe**");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("records nothing for a failed run, a traced site, a moved fingerprint or an unenumerable trace", () => {
    const base = { sha: "s", ran: true, before: fp, after: fp, reads: { paths: [], git: [] }, reached: undefined, root: ROOT, digests: new FileDigests(ROOT) };
    expect(writerRecordOf({ ...base, ran: false })).toEqual({ none: "the writer did not succeed" });
    expect(writerRecordOf({ ...base, reached: "network" })).toEqual({ none: "the run reached a traced input site (network)" });
    expect(writerRecordOf({ ...base, after: { hash: "moved", audit: "clean" } })).toEqual({ none: "its script, imports or audited environment moved while it ran" });
    expect(writerRecordOf({ ...base, reads: { undetermined: "why" } })).toEqual({ none: "why" });
  });

  test("a directory only opened is recorded as \"dir\": a new entry keeps the skip, a listed one's new entry does not (tools#1265)", () => {
    const root = mkdtempSync(join(tmpdir(), "writer-cone-"));
    try {
      mkdirSync(join(root, "opened"));
      mkdirSync(join(root, "listed"));
      const reads = { paths: ["listed", "opened"], git: [], listed: ["listed"], writes: [], absentBefore: [] };
      const rec = writerRecordOf({ sha: "abc123", ran: true, before: fp, after: fp, reads, reached: undefined, root, digests: new FileDigests(root) });
      if ("none" in rec) throw new Error(rec.none);
      expect(rec.reads["opened"]).toBe("dir");
      expect(rec.reads["listed"]).toStartWith("dir ");
      const records = emptyRecords("abc123");
      records.writers["w"] = rec;
      writeFileSync(join(root, "opened/new.txt"), "x");
      expect(decideWriter(records, "w", fp, root, new FileDigests(root)).skip).toBe(true);
      writeFileSync(join(root, "listed/new.txt"), "x");
      expect(decideWriter(records, "w", fp, root, new FileDigests(root))).toEqual({ skip: false, why: "listed changed", cause: { kind: "path", path: "listed" } });
      rmSync(join(root, "listed/new.txt"));
      rmSync(join(root, "opened"), { recursive: true });
      writeFileSync(join(root, "opened"), "a file now");
      expect(decideWriter(records, "w", fp, root, new FileDigests(root))).toEqual({ skip: false, why: "opened changed", cause: { kind: "path", path: "opened" } });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("no records, or an unrecorded writer, always runs", () => {
    expect(decideWriter(undefined, "w", fp, ROOT, new FileDigests(ROOT)).skip).toBe(false);
    const r = emptyRecords("abc");
    r.unrecorded["w"] = "the run reached a traced input site (clock)";
    expect(decideWriter(r, "w", fp, ROOT, new FileDigests(ROOT))).toEqual({ skip: false, why: "not recorded: the run reached a traced input site (clock)" });
  });

  test("tracedArgv wraps the writer in strace", () => {
    // input-site: inert #b8af476a — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(tracedArgv(["bun", "run", "cat", "w"], "/tmp/l").slice(-6)).toEqual(["-o", "/tmp/l", "bun", "run", "cat", "w"]);
    // input-site: inert #1b71d3c1 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
    expect(tracedArgv(["x"], "/tmp/l")[0]).toBe("strace");
  });
});

describe("snapshotPaths (what a skip puts back)", () => {
  const own = ["site/a/", "out.json"];
  const others = ["site/b/"];
  test("adds every file the run wrote outside its declared outputs", () => {
    const r = snapshotPaths(own, ["site/a/x.html", "out.json", "build/extra.json"], underOutputs(own), underOutputs([...own, ...others]));
    expect(r).toEqual({ paths: ["site/a/", "out.json", "build/extra.json"] });
  });
  test("refuses a write into another writer's declared output", () => {
    const r = snapshotPaths(own, ["site/b/y.html"], underOutputs(own), underOutputs([...own, ...others]));
    expect("none" in r && r.none).toContain("site/b/y.html");
  });
});

describe("churnReport", () => {
  const writerOf = (p: string) => (p.startsWith("docs/a/") ? "a:pages" : undefined);
  const entries = [
    { writer: "a:pages", did: "ran" as const, why: "src.md changed", cause: { kind: "path" as const, path: "src.md" }, seconds: 10 },
    { writer: "b:pages", did: "ran" as const, why: "docs/a/x.json changed", cause: { kind: "path" as const, path: "docs/a/x.json" }, seconds: 30 },
    { writer: "c:pages", did: "ran" as const, why: "docs/a/x.json changed", cause: { kind: "path" as const, path: "docs/a/x.json" }, seconds: 5 },
    { writer: "d:pages", did: "skipped" as const, why: "reads unchanged", seconds: 0.1 },
    { writer: "e:pages", did: "ran" as const, why: "script", cause: { kind: "script" as const }, seconds: 1 },
  ];
  test("groups reruns by what changed and who wrote it, costliest first", () => {
    const r = churnReport(entries, "abcdef0123456789", writerOf);
    expect([r.skipped, r.ran, r.reused]).toEqual([1, 4, 0]);
    expect(r.groups.map((g) => [g.cause, g.writtenBy, g.reran, g.seconds])).toEqual([
      ["docs/a/x.json", "a:pages", ["b:pages", "c:pages"], 35],
      ["src.md", "the commit", ["a:pages"], 10],
      ["its script, imports or tools", "the commit", ["e:pages"], 1],
    ]);
  });
  test("renders a table naming the cascade", () => {
    const md = renderChurn(churnReport(entries, "abcdef0123456789", writerOf));
    expect(md).toContain("against abcdef012345");
    expect(md).toContain("| `docs/a/x.json` | a:pages | `b:pages`, `c:pages` | 35 |");
  });
  test("says so when nothing ran", () => {
    expect(renderChurn(churnReport([entries[3]!], "x", writerOf))).toContain("Nothing ran again.");
  });
});

describe("changedWhy (bean fwtz, S-CI3)", () => {
  test("names the first changed read as before, then the rest, capped", () => {
    expect(changedWhy(["."])).toBe(". changed");
    expect(changedWhy([".", ".git", "a"])).toBe(". changed (+2 more: .git, a)");
    const many = Array.from({ length: 12 }, (_, i) => `f${i}`);
    expect(changedWhy(many)).toBe("f0 changed (+11 more: f1, f2, f3, f4, f5, f6, f7, and 4 others)");
  });
});

describe("incremental records (cat-harness-tools#1702)", () => {
  const rec = (sha: string) => ({ sha, base: "b", audit: "clean", reads: { "a.md": "f:1" }, git: {}, outputs: { "out/a.html": "f:2" }, rewritten: ["r.json"] });

  test("a carried record keeps its own commit, so its outputs entry is found under it", () => {
    const prev = emptyRecords("old");
    prev.writers["w"] = rec("older");
    const next = emptyRecords("new");
    next.unrecorded["w"] = "stale";
    expect(carryRecord(next, prev, "w")).toBe(true);
    expect(next.writers["w"]).toEqual(rec("older"));
    expect(next.unrecorded["w"]).toBeUndefined();
    expect(entryShaOf(next, "w")).toBe("older");
  });

  test("nothing to carry for a writer the previous records do not hold", () => {
    const next = emptyRecords("new");
    expect(carryRecord(next, emptyRecords("old"), "w")).toBe(false);
    expect(next.writers["w"]).toBeUndefined();
  });

  test("an index kept without a record is found at the commit it was kept at; anything else at the file's commit", () => {
    const r = emptyRecords("new");
    r.kept = { idx: "kept-at" };
    expect(entryShaOf(r, "idx")).toBe("kept-at");
    expect(entryShaOf(r, "other")).toBe("new");
  });
});

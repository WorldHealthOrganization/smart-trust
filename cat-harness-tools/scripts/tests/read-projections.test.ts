/**
 * Projected reads (owner card Q-SPD-9b A, 2026-11-01): a writer is keyed only
 * on the part of a hub file its reader uses, and only when every open of the
 * file was reported.
 * @covers schemas/sdlc/read-projections.ts
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseTrace, STRACE_ARGS } from "../ci-cone.ts";
import { FileDigests } from "../input-hash.ts";
import { decideWriter, emptyRecords, projectedReadsOf, projectionFor, writerRecordOf } from "../writer-cone.ts";
import { openTrace } from "../../schemas/sdlc/input-trace.ts";
import { PROJECTED_LINE, PROJECTIONS, TRACE_ENV, projectedRead, projectedReads, projectedState } from "../../schemas/sdlc/read-projections.ts";
import { reportLocationRead } from "../mount-from-lock.ts";

const HAS_STRACE = Bun.which("strace") !== null && Bun.spawnSync(["strace", "-f", "-qq", "-o", "/dev/null", "true"], { stdout: "ignore", stderr: "ignore" }).exitCode === 0;

describe("PROJECTIONS", () => {
  test("declaration-name keeps only whether it parses and its name", () => {
    const p = PROJECTIONS["declaration-name"];
    expect(p('{"$schema":"x","sha":"1"}')).toBe(p('{"sha":"2","ran":[1,2]}'));
    expect(p('{"name":"a","x":1}')).toBe(p('{"name":"a","x":2}'));
    expect(p('{"name":"a"}')).not.toBe(p('{"name":"b"}'));
    expect(p("{ not json")).toBe("unparseable");
    expect(p("{ not json")).not.toBe(p("{}"));
  });

  test("nested-directories keeps directories as written, and nothing else", () => {
    const p = PROJECTIONS["nested-directories"];
    expect(p('{"@context":{"a":1},"@graph":[]}')).toBe(p('{"@context":{"a":2},"@graph":[{"x":1}]}'));
    expect(p('{"directories":[{"id":"a","path":"a/"}]}')).not.toBe(p('{"directories":[{"id":"a","path":"b/"}]}'));
  });

  test("mount-location keeps where the mount lives, not its tip or files", () => {
    const p = PROJECTIONS["mount-location"];
    const m = (tip: string, into = "beans") => JSON.stringify({ $schema: "branch-mount/v1", id: "beans", path: "beans", into, tip, files: { [tip]: { blob: tip } } });
    expect(p(m("t1"))).toBe(p(m("t2")));
    expect(p(m("t1"))).not.toBe(p(m("t1", "elsewhere")));
  });

  test("projectedReads counts reports per path, and drops a path reported under two projections", () => {
    const r = projectedReads(["projected declaration-name /r/a.json", "projected declaration-name /r/a.json", "projected nested-directories /r/b.json", "projected declaration-name /r/b.json", "clock"]);
    expect(r.get("/r/a.json")).toEqual({ name: "declaration-name", count: 2 });
    expect(r.get("/r/b.json")).toEqual({ name: undefined, count: 2 });
  });
});

describe("writerRecordOf with projected reads", () => {
  const fp = { hash: "base1", audit: "clean" } as const;

  test("a file every open of which was reported is keyed on its projection; one opened more often is keyed in full", () => {
    const root = mkdtempSync(join(tmpdir(), "read-proj-"));
    try {
      writeFileSync(join(root, "report.json"), '{"sha":"1"}');
      writeFileSync(join(root, "twice.json"), '{"sha":"1"}');
      const projected = projectedReadsOf([`projected declaration-name ${root}/report.json`, `projected declaration-name ${root}/twice.json`], root);
      const reads = { paths: ["report.json", "twice.json"], git: [], writes: [], absentBefore: [], opened: { "report.json": 1, "twice.json": 2 } };
      expect(projectionFor("report.json", reads, projected)).toBe("declaration-name");
      expect(projectionFor("twice.json", reads, projected)).toBeUndefined();
      const rec = writerRecordOf({ sha: "abc", ran: true, before: fp, after: fp, reads, reached: undefined, root, digests: new FileDigests(root), projected });
      if ("none" in rec) throw new Error(rec.none);
      expect(rec.reads["report.json"]).toBe(projectedState("declaration-name", '{"sha":"1"}'));
      expect(rec.reads["twice.json"]).toStartWith("file ");

      const records = emptyRecords("abc");
      records.writers["w"] = rec;
      // The report moves: the projected read keeps the skip, the full one does not.
      writeFileSync(join(root, "report.json"), '{"sha":"2"}');
      expect(decideWriter(records, "w", fp, root, new FileDigests(root)).skip).toBe(true);
      writeFileSync(join(root, "twice.json"), '{"sha":"2"}');
      expect(decideWriter(records, "w", fp, root, new FileDigests(root))).toMatchObject({ skip: false, why: "twice.json changed" });
      writeFileSync(join(root, "twice.json"), '{"sha":"1"}');
      // What the reader uses moves: it runs.
      writeFileSync(join(root, "report.json"), '{"name":"report"}');
      expect(decideWriter(records, "w", fp, root, new FileDigests(root))).toMatchObject({ skip: false, why: "report.json changed" });
      // Gone is a change too.
      rmSync(join(root, "report.json"));
      expect(decideWriter(records, "w", fp, root, new FileDigests(root)).skip).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a projection this version does not know never matches", () => {
    const root = mkdtempSync(join(tmpdir(), "read-proj-"));
    try {
      writeFileSync(join(root, "a.json"), "{}");
      const records = emptyRecords("abc");
      records.writers["w"] = { sha: "abc", base: fp.hash, audit: fp.audit, reads: { "a.json": "proj from-the-future 00" }, git: {}, outputs: {} };
      expect(decideWriter(records, "w", fp, root, new FileDigests(root)).skip).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("parseTrace countOpens", () => {
  test("counts successful opens for reading of the paths asked for, and only those", () => {
    const r = parseTrace(
      [
        `10 openat(AT_FDCWD</r>, "a.json", O_RDONLY|O_CLOEXEC) = 3</r/a.json>`,
        `10 openat(AT_FDCWD</r>, "a.json", O_RDONLY|O_CLOEXEC) = 4</r/a.json>`,
        `10 openat(AT_FDCWD</r>, "b.json", O_RDONLY|O_CLOEXEC) = -1 ENOENT (No such file or directory)`,
        `10 newfstatat(AT_FDCWD</r>, "b.json", 0x7ffc, 0) = 0`,
        `10 openat(AT_FDCWD</r>, "c.json", O_RDONLY|O_CLOEXEC) = 3</r/c.json>`,
      ].join("\n"),
      "/r",
      { writes: "collect", countOpens: new Set(["a.json", "b.json"]) },
    );
    if ("undetermined" in r) throw new Error(r.undetermined);
    expect(r.opened).toEqual({ "a.json": 2, "b.json": 0 });
  });
});

describe.skipIf(!HAS_STRACE)("the real readers, under a real strace", () => {
  test("instance discovery reads a build report only for its name, so the report keeps a writer's skip", () => {
    const root = mkdtempSync(join(tmpdir(), "read-proj-real-"));
    try {
      mkdirSync(join(root, "build"));
      writeFileSync(join(root, "build/qa-refresh.json"), '{"sha":"one"}');
      const script = join(root, "probe.ts");
      writeFileSync(script, `import { findDeclarationFile } from ${JSON.stringify(join(import.meta.dir, "../../schemas/kg/instance-roots.ts"))};\nfindDeclarationFile(${JSON.stringify(join(root, "build"))});\n`);
      const trace = openTrace(root);
      const log = join(root, "probe.strace");
      const r = Bun.spawnSync(["strace", ...STRACE_ARGS, "-o", log, "bun", script], { cwd: root, env: trace.env, stdout: "ignore", stderr: "pipe" });
      expect(r.exitCode).toBe(0);
      expect(trace.reached()).toBeUndefined();
      const projected = projectedReadsOf(trace.projected(), root);
      expect(projected.get("build/qa-refresh.json")).toEqual({ name: "declaration-name", count: 1 });
      const reads = parseTrace(readFileSync(log, "utf-8"), root, { writes: "collect", countOpens: new Set(projected.keys()), ownOutput: (p) => p === "probe.strace" });
      if ("undetermined" in reads) throw new Error(reads.undetermined);
      expect(reads.opened?.["build/qa-refresh.json"]).toBe(1);
      expect(projectionFor("build/qa-refresh.json", reads, projected)).toBe("declaration-name");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("mount-from-lock's restated report", () => {
  test("writes the same line projectedRead does", () => {
    const root = mkdtempSync(join(tmpdir(), "read-proj-mfl-"));
    const trace = join(root, "trace.log");
    // input-site: inert #97f14c0f — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
    const prev = process.env["INPUT_HASH_TRACE"];
    try {
      process.env["INPUT_HASH_TRACE"] = trace;
      reportLocationRead("/r/.git/branch-mounts/beans.json");
      projectedRead("/r/.git/branch-mounts/beans.json", "mount-location");
      const [a, b] = readFileSync(trace, "utf-8").split("\n");
      expect(a).toBe(b);
    } finally {
      if (prev === undefined) delete process.env["INPUT_HASH_TRACE"];
      else process.env["INPUT_HASH_TRACE"] = prev;
      rmSync(root, { recursive: true, force: true });
    }
  });
});

test("a trace too long to spread into push() is read without overflowing the stack", () => {
  // `gates` crashed after a whole-suite `bun test` run (2026-11-05,
  // RangeError at input-trace.ts): `projected.push(...lines)` passes every
  // line as an argument. 1 000 000 projected lines is past that limit.
  const root = mkdtempSync(join(tmpdir(), "trace-long-"));
  try {
    const trace = openTrace(root);
    writeFileSync(trace.env[TRACE_ENV]!, `${PROJECTED_LINE}kg /x.json\n`.repeat(1_000_000));
    expect(trace.reached()).toBeUndefined();
    expect(trace.projected().length).toBe(1_000_000);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

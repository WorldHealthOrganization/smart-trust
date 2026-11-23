/**
 * Baselines and compute-and-judge — beans `id4s` and `0dav` (arc `3fva`,
 * proposal `qa-reports-branch-and-test-process` §2.3).
 *
 * The rule every self-sidecar gate now follows, pinned once here:
 *
 * - a finding NEW against a baseline fails a PR; an INHERITED one does not;
 * - a missing baseline is `unknown` — reported, never a pass, never a failure;
 * - `--against <ref>` reads the baseline from the `qa-reports` branch through
 *   qa-store, in its four states, and a miss there is never "no findings".
 *
 * The branch half runs against a real bare repository over `file://`, as
 * `qa-store.test.ts` does: what matters (a ref with no entry, a payload that
 * is there) is something a remote does, and stubbing git would only test the
 * stub. Nothing here touches `test/results/`, so it runs the same with the
 * checkout's results present or absent.
 *
 * @module scripts/tests/qa-baseline
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  againstRef,
  buildQaResult,
  diffFindings,
  judgeQaResult,
  qaResultPath,
  qaResultState,
  readBaseline,
  readQaResultFrom,
  writeQaResult,
  type QaResult,
} from "../qa-results.ts";
import { clearQaCache, publishQa, QaUsageError, type QaStoreOptions } from "../qa-store.ts";

const made: string[] = [];
afterEach(() => {
  clearQaCache();
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), `qa-baseline-${prefix}-`));
  made.push(d);
  return d;
}

/** A result with one graded family `bad` and one census family `info`. */
function result(bad: unknown[], info: unknown[] = []): QaResult {
  return buildQaResult({
    script: "scripts/demo.ts",
    scriptAbsPath: "/no/such/file.ts",
    subject: { kind: "demo", id: "demo" },
    families: { bad: { summary: "graded", entries: bad }, info: { summary: "census", entries: info } },
  });
}

/** Judge quietly: the verdict is what is asserted, not the console. */
function judge(args: Parameters<typeof judgeQaResult>[0]) {
  const log = console.log;
  const err = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return judgeQaResult(args);
  } finally {
    console.log = log;
    console.error = err;
  }
}

describe("--against parses or refuses — a typo is never a missing baseline", () => {
  test("absent → undefined; a ref → the ref; a bad or empty ref → usage error", () => {
    expect(againstRef(["--check"])).toBeUndefined();
    expect(againstRef(["--check", "--against", "main"])).toBe("main");
    expect(againstRef(["--against=pr/12"])).toBe("pr/12");
    expect(() => againstRef(["--against"])).toThrow(QaUsageError);
    expect(() => againstRef(["--against", "--strict"])).toThrow(QaUsageError);
    expect(() => againstRef(["--against", "refs/heads/main"])).toThrow(QaUsageError);
  });
});

describe("the working-copy baseline, in four states", () => {
  test("miss carries no text — there is nothing to read as clean", () => {
    const root = tmp("miss");
    const r = readBaseline(qaResultPath(root, "x"));
    expect(r.state).toBe("miss");
    expect(r).not.toHaveProperty("text");
    expect(qaResultState(qaResultPath(root, "x"), result([]))).toBe("absent");
  });

  test("a file that will not parse is corrupt, never stale and never current", () => {
    const root = tmp("corrupt");
    const p = qaResultPath(root, "x");
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, "{ not json");
    expect(readBaseline(p).state).toBe("corrupt");
    expect(qaResultState(p, result([]))).toBe("unreadable");
  });

  test("valid JSON that is not qa-results/v1 is corrupt as a RESULT", () => {
    const root = tmp("foreign");
    const p = qaResultPath(root, "x");
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify({ rows: 3 }));
    expect(readBaseline(p).state).toBe("hit");
    expect(readQaResultFrom(p).state).toBe("corrupt");
  });

  test("hit: current when identical, stale when not", () => {
    const root = tmp("hit");
    const p = writeQaResult(root, "x", result([{ f: 1 }]));
    expect(qaResultState(p, result([{ f: 1 }]))).toBe("current");
    expect(qaResultState(p, result([{ f: 2 }]))).toBe("stale");
  });
});

describe("new vs inherited", () => {
  test("by entry identity, independent of key order", () => {
    const d = diffFindings(result([{ a: 1, b: 2 }, { a: 3 }]), result([{ b: 2, a: 1 }, { a: 4 }]), ["bad"]);
    expect(d.added).toEqual({ bad: [{ a: 4 }] });
    expect(d.inherited).toBe(1);
    expect(d.resolved).toBe(1);
  });

  test("a family the baseline lacks is all new", () => {
    expect(diffFindings(result([]), result([{ a: 1 }]), ["bad"]).added).toEqual({ bad: [{ a: 1 }] });
  });
});

describe("compute and judge against the working copy (the pre-move baseline)", () => {
  const baseline = (root: string) => ({ root, stem: "demo", writer: "demo" });

  test("a SEEDED new finding fails (1); the same finding inherited does not (0)", () => {
    const root = tmp("judge");
    writeQaResult(root, "demo", result([{ file: "old" }]));
    const seeded = judge({ gate: "t", fresh: result([{ file: "old" }, { file: "new" }]), failOnNew: ["bad"], baseline: baseline(root) });
    expect(seeded.exit).toBe(1);
    expect(seeded.diff?.added).toEqual({ bad: [{ file: "new" }] });
    const inherited = judge({ gate: "t", fresh: result([{ file: "old" }]), failOnNew: ["bad"], baseline: baseline(root) });
    expect(inherited.exit).toBe(0);
    expect(inherited.diff?.inherited).toBe(1);
  });

  test("a census family never fails, however much it moved", () => {
    const root = tmp("census");
    writeQaResult(root, "demo", result([], [1]));
    expect(judge({ gate: "t", fresh: result([], [1, 2, 3]), failOnNew: ["bad"], baseline: baseline(root) }).exit).toBe(0);
  });

  test("failOn is absolute against the working copy: the author's own record cannot excuse their finding", () => {
    const root = tmp("abs");
    writeQaResult(root, "demo", result([{ file: "old" }]));
    expect(judge({ gate: "t", fresh: result([{ file: "old" }]), failOn: ["bad"], baseline: baseline(root) }).exit).toBe(1);
  });

  test("NO baseline: unknown, reported, and not a failure — but failOn still judged in full", () => {
    const root = tmp("none");
    const v = judge({ gate: "t", fresh: result([{ file: "new" }]), failOnNew: ["bad"], baseline: baseline(root) });
    expect(v.exit).toBe(0);
    expect(v.baseline.state).toBe("miss");
    expect(v.unknowns.length).toBe(1);
    expect(v.unknowns[0]).toContain("not made");
    expect(judge({ gate: "t", fresh: result([{ file: "new" }]), failOn: ["bad"], baseline: baseline(root) }).exit).toBe(1);
  });

  test("a run that could not ask part of its question is 2, outranking a finding", () => {
    const root = tmp("undet");
    const v = judge({ gate: "t", fresh: result([{ x: 1 }]), failOn: ["bad"], undetermined: "a source would not read", baseline: baseline(root) });
    expect(v.exit).toBe(2);
  });
});

// ── The branch: --against over a real bare remote ──────────────────────────

const NOGPG = ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t"];
const SHA = "a".repeat(40);

function git(cwd: string, ...args: string[]): void {
  const r = spawnSync("git", [...NOGPG, ...args], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} → ${r.status}\n${r.stderr}`);
}

/** A checkout `work` whose `inst/test/results/demo.qa-results.json` is published as `main/<SHA>`. */
function branchFixture(published: QaResult | undefined): { work: string; store: (n: string) => QaStoreOptions } {
  const base = tmp("branch");
  const bare = join(base, "remote.git");
  git(base, "init", "-q", "--bare", "-b", "main", bare);
  git(bare, "config", "uploadpack.allowFilter", "true");
  git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
  const work = join(base, "work");
  mkdirSync(work);
  git(work, "init", "-q", "-b", "main");
  const store = (n: string): QaStoreOptions => ({
    repoRoot: work,
    remote: `file://${bare}`,
    branch: "qa-reports",
    storeDir: join(base, `${n}.store.git`),
    sleep: () => {},
    log: () => {},
  });
  if (published) {
    const p = writeQaResult(join(work, "inst"), "demo", published);
    publishQa({ ref: `main/${SHA}`, roots: [dirname(p)] }, store("writer"));
    // The working copy is gone: the branch is the only baseline, as after 5hox.
    rmSync(join(work, "inst"), { recursive: true, force: true });
    clearQaCache();
  }
  return { work, store };
}

describe("compute and judge --against the qa-reports branch", () => {
  test(
    "a seeded new finding fails; an inherited one does not, even under failOn",
    () => {
      const { work, store } = branchFixture(result([{ file: "old" }]));
      const baseline = { root: join(work, "inst"), stem: "demo", writer: "demo", against: "main", store: store("reader") };
      const seeded = judge({ gate: "t", fresh: result([{ file: "old" }, { file: "new" }]), failOn: ["bad"], baseline });
      expect(seeded.baseline.state).toBe("hit");
      expect(seeded.baseline.from).toBe(`qa-reports:main/${SHA}`);
      expect(seeded.exit).toBe(1);
      const inherited = judge({ gate: "t", fresh: result([{ file: "old" }]), failOn: ["bad"], baseline });
      expect(inherited.exit).toBe(0);
      expect(qaResultState(qaResultPath(join(work, "inst"), "demo"), result([{ file: "old" }]), { against: "main", store: store("reader") })).toBe("current");
    },
    60_000,
  );

  test(
    "no entry on the branch: unknown, never a pass of the split, never a failure",
    () => {
      const { work, store } = branchFixture(undefined);
      const baseline = { root: join(work, "inst"), stem: "demo", writer: "demo", against: "main", store: store("reader") };
      const v = judge({ gate: "t", fresh: result([{ file: "new" }]), failOnNew: ["bad"], baseline });
      expect(v.baseline.state).toBe("miss");
      expect(v.exit).toBe(0);
      expect(v.unknowns.join(" ")).toContain("qa-reports:main");
      expect(qaResultState(qaResultPath(join(work, "inst"), "demo"), result([]), { against: "main", store: store("reader") })).toBe("absent");
    },
    60_000,
  );

  test(
    "a remote that cannot be reached is unknown — the fifth QaResultState, never current",
    () => {
      const { work, store } = branchFixture(undefined);
      const o = { ...store("reader"), remote: "file:///no/such/remote.git" };
      const r = readBaseline(qaResultPath(join(work, "inst"), "demo"), { against: "main", store: o });
      expect(r.state).toBe("unknown");
      expect(r).not.toHaveProperty("text");
    },
    60_000,
  );
});

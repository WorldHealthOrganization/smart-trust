/**
 * `--prior-from <ref>` (bean `8wj1`, owner option B, 2026-10-22): a block
 * writer reads the earlier report from the `qa-reports` branch at `<ref>`
 * instead of the working copy, and a read it cannot complete REFUSES (exit 2)
 * rather than falling back.
 *
 * The branch half runs against a real bare repository over `file://`, as
 * `qa-baseline.test.ts` does.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { PRIOR_FROM_FLAG, priorFromRef } from "../qa-results.ts";
import { clearQaCache, publishQa, QaUsageError, type QaStoreOptions } from "../qa-store.ts";
import { loadPriorBlockReport, priorRefusalLine } from "../../pipeline/qa-utils.ts";
import { blockQaPath } from "../../pipeline/qa-paths.ts";

const NOGPG = ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t"];
const SHA = "b".repeat(40);
const T = 60_000;

const made: string[] = [];
afterEach(() => {
  clearQaCache();
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), `qa-prior-from-${prefix}-`));
  made.push(d);
  return d;
}

function git(cwd: string, ...args: string[]): void {
  const r = spawnSync("git", [...NOGPG, ...args], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} → ${r.status}\n${r.stderr}`);
}

describe("--prior-from parses or refuses", () => {
  test("absent, separate and = forms; a missing or full ref is a usage error", () => {
    expect(PRIOR_FROM_FLAG).toBe("--prior-from");
    expect(priorFromRef(["--paper", "x"])).toBeUndefined();
    expect(priorFromRef(["--prior-from", "main"])).toBe("main");
    expect(priorFromRef(["--prior-from=pr/12"])).toBe("pr/12");
    expect(() => priorFromRef(["--prior-from"])).toThrow(QaUsageError);
    expect(() => priorFromRef(["--prior-from", "--strict"])).toThrow(QaUsageError);
    expect(() => priorFromRef(["--prior-from", "refs/heads/main"])).toThrow(QaUsageError);
  });
});

/** A checkout `work` whose block `ch/blk` has `text` published as its report at `main/<SHA>`. */
function fixture(text: string | undefined): { work: string; blockRoot: string; store: (n: string) => QaStoreOptions } {
  const base = tmp("branch");
  const bare = join(base, "remote.git");
  git(base, "init", "-q", "--bare", "-b", "main", bare);
  git(bare, "config", "uploadpack.allowFilter", "true");
  git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
  const work = join(base, "work");
  mkdirSync(work);
  git(work, "init", "-q", "-b", "main");
  const blockRoot = join(work, "ch", "blk");
  const store = (n: string): QaStoreOptions => ({
    repoRoot: work,
    remote: `file://${bare}`,
    branch: "qa-reports",
    storeDir: join(base, `${n}.store.git`),
    sleep: () => {},
    log: () => {},
  });
  if (text !== undefined) {
    const p = blockQaPath(work, blockRoot);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
    publishQa({ ref: `main/${SHA}`, roots: [dirname(p)] }, store("writer"));
    // The working copy goes: only the branch can answer.
    rmSync(dirname(p), { recursive: true, force: true });
    clearQaCache();
  }
  return { work, blockRoot, store };
}

describe("loadPriorBlockReport --prior-from reads the branch, never the working copy", () => {
  test(
    "a published report is read from qa-reports",
    () => {
      const { work, blockRoot, store } = fixture(JSON.stringify({ $schema: "block-qa/v1", criteria: { a: [{ result: "pass" }] } }));
      const r = loadPriorBlockReport(work, blockRoot, "main", store("reader"));
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.from).toBe(`qa-reports:main/${SHA}`);
        expect(Object.keys(r.report?.criteria ?? {})).toEqual(["a"]);
      }
    },
    T,
  );

  test(
    "no report at the ref is a block with no history, not a refusal",
    () => {
      const { work, blockRoot, store } = fixture(undefined);
      // A working-copy report that exists must NOT be read in its place.
      const p = blockQaPath(work, blockRoot);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify({ $schema: "block-qa/v1", criteria: { local: [{ result: "pass" }] } }));
      const r = loadPriorBlockReport(work, blockRoot, "main", store("reader"));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.report).toBeUndefined();
    },
    T,
  );

  test(
    "an unreachable store refuses, and does not fall back to the working copy",
    () => {
      const { work, blockRoot, store } = fixture(undefined);
      const p = blockQaPath(work, blockRoot);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, JSON.stringify({ $schema: "block-qa/v1", criteria: { local: [{ result: "pass" }] } }));
      const o = { ...store("reader"), remote: "file:///no/such/remote.git" };
      const r = loadPriorBlockReport(work, blockRoot, "main", o);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.state).toBe("unknown");
        expect(priorRefusalLine("w", "ch/blk", r)).toContain("Nothing was written");
      }
    },
    T,
  );

  test(
    "a report at the ref that is not block-qa/v1 is corrupt, and refused",
    () => {
      const { work, blockRoot, store } = fixture(JSON.stringify({ criterion: "x", paper: "p", chapters: [] }));
      const r = loadPriorBlockReport(work, blockRoot, "main", store("reader"));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.state).toBe("corrupt");
    },
    T,
  );
});

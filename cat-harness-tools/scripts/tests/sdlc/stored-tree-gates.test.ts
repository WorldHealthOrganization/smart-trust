/**
 * `lsi:skills:check` and `kg:detangle:check` judge instead of comparing —
 * bean `oqe3` (arc `3fva`, proposal `qa-reports-branch-and-test-process` §2.3).
 *
 * Both gates compared a fresh computation with the copy committed under
 * cat-harness's `test/results/`, and failed on "stale". That directory is
 * declared `storage` (it lives on `qa-reports`), so the copy in a checkout is
 * a measurement of the last run, not a record. Measured on cat-harness-tools
 * `main` 51ce679 in a composed checkout, 2026-10-23: both gates exited 1 on
 * `main` itself with the files present (`skills.lsi.json` stale, seven
 * `*.detangle.json` stale), which is the regenerate-and-commit round the bean
 * retires. They now:
 *
 * - compute in memory and fail only on what the computation finds — an LSI
 *   index that cannot be built; detangle grades nothing here (the carve is
 *   an adjudication, and `--gate-direction` is unchanged);
 * - print a stale or orphaned stored copy as ADVISORY, never fail on it;
 * - with `--against <ref>`, report what the stored record at that ref says,
 *   and report a ref with no entry as UNKNOWN, which is not gated;
 * - refuse a malformed `--against` or an unknown flag with exit 2.
 *
 * The store is pointed at an empty bare remote over `file://`, as
 * `qa-tree-judge.test.ts` does, so nothing here touches the network.
 *
 * @module scripts/tests/stored-tree-gates
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { checkGraphs, proseGraphs } from "../../lsi.ts";
import { clearQaCache } from "../../qa-store.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { notApplicableAlone } from "../../../test/support/checkout.ts";

const REPO = resolve(dirname(HARNESS_ROOT));
const NOGPG = ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t"];
const DETANGLE = "cat-harness-tools/skills/kg/graph-management/kg-detangle.ts";
const LSI = "cat-harness-tools/scripts/lsi.ts";

const made: string[] = [];
afterEach(() => {
  clearQaCache();
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** An empty bare remote and a private store directory: every `--against` read is a miss. */
function emptyStore(): Record<string, string> {
  const base = mkdtempSync(join(tmpdir(), "stored-tree-gates-"));
  made.push(base);
  const bare = join(base, "remote.git");
  const r = spawnSync("git", [...NOGPG, "init", "-q", "--bare", "-b", "main", bare], { encoding: "utf-8" });
  if (r.status !== 0) throw new Error(r.stderr);
  return { QA_STORE_REMOTE: `file://${bare}`, QA_STORE_DIR: join(base, "store.git") };
}

function gitStatus(): string {
  return spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: REPO, encoding: "utf-8" }).stdout;
}

const skills = () => {
  const t = proseGraphs().find((g) => g.instance === "cat-harness" && g.id === "skills");
  if (!t) throw new Error("cat-harness/skills is not a declared prose graph in this checkout");
  return t;
};

describe("lsi check over a stored index directory", () => {
  test("rebuilds the index in memory and passes; the stored copy is not what it judges", () => {
    const lines: string[] = [];
    const exit = checkGraphs([skills()], { stored: true, log: (l) => lines.push(l) });
    expect(exit).toBe(0);
    expect(lines[0]).toStartWith("pass");
    expect(lines[0]).toContain("recomputed in this run");
    // A stale working copy, if there is one, is said, and only as advisory.
    for (const l of lines.slice(1)) expect(l).toMatch(/^\s+(advisory|current):/);
  });

  test(
    "--against a ref with no entry is UNKNOWN, reported and not gated",
    () => {
      const env = emptyStore();
      // input-site: inert #9347e256 — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
      const saved = { r: process.env.QA_STORE_REMOTE, d: process.env.QA_STORE_DIR };
      // input-site: inert #4dfe08aa — sets the test's own variables, or hands the environment whole to a child; no value is read here
      Object.assign(process.env, env);
      try {
        const lines: string[] = [];
        const exit = checkGraphs([skills()], { stored: true, against: "main", log: (l) => lines.push(l) });
        expect(exit).toBe(0);
        expect(lines.join("\n")).toContain("UNKNOWN");
      } finally {
        if (saved.r === undefined) delete process.env.QA_STORE_REMOTE;
        else process.env.QA_STORE_REMOTE = saved.r;
        if (saved.d === undefined) delete process.env.QA_STORE_DIR;
        else process.env.QA_STORE_DIR = saved.d;
      }
    },
    120_000,
  );

  test("an unknown flag and a malformed --against are usage errors (2)", () => {
    const flag = spawnSync("bun", ["run", LSI, "check", "--graph", "skills", "--chek"], { cwd: REPO, encoding: "utf-8" });
    expect(flag.status).toBe(2);
    expect(flag.stdout + flag.stderr).toContain("unknown flag");
    const ref = spawnSync("bun", ["run", LSI, "check", "--graph", "skills", "--against", "refs/heads/main"], { cwd: REPO, encoding: "utf-8" });
    expect(ref.status).toBe(2);
  }, 60_000);
});

/**
 * `kg-detangle` runs over the checkout that holds the harness, `REPO`, and
 * judges against that checkout's stored tree. The composed checkout is a git
 * work tree there; side-by-side clones have none above them (w1gy F11, the
 * sibling root), so there is no checkout to detangle or to hold unchanged.
 */
const NO_CHECKOUT_AT_REPO =
  spawnSync("git", ["-C", REPO, "rev-parse", "--show-toplevel"], { encoding: "utf-8" }).stdout.trim() !== REPO &&
  notApplicableAlone(`a git checkout at ${REPO}, the composed root kg-detangle runs over (clones side by side have none)`);

describe("kg:detangle:check over a stored detangle tree", () => {
  test.skipIf(NO_CHECKOUT_AT_REPO)(
    "computes, never fails on a stale stored copy, reports a missing baseline as UNKNOWN, and writes nothing",
    () => {
      const before = gitStatus();
      const r = spawnSync("bun", ["run", DETANGLE, "--check", "--against", "main"], {
        cwd: REPO,
        encoding: "utf-8",
        env: { ...process.env, ...emptyStore() },
      });
      const out = r.stdout + r.stderr;
      expect(r.status).toBe(0);
      expect(out).not.toContain("STALE ");
      expect(out).not.toContain("and commit the result");
      expect(out).toContain("UNKNOWN");
      expect(gitStatus()).toBe(before);
    },
    180_000,
  );

  test(
    "a malformed --against is a usage error (2), never a missing baseline",
    () => {
      const r = spawnSync("bun", ["run", DETANGLE, "--check", "--against", "refs/heads/main"], { cwd: REPO, encoding: "utf-8" });
      expect(r.status).toBe(2);
    },
    // It spawns `bun run`, which loads the module graph before it parses a flag:
    // the 5 s default is too short on a loaded runner (it failed twice on #631).
    60_000,
  );
});

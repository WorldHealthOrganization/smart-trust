/**
 * Compute the recorded test runs of a results directory the checkout does not
 * hold, without writing the tree.
 *
 * A harness's `test/results/` is not committed: it is derived, and stored on
 * a `qa-reports` branch another repository cannot read. So a repository that
 * MOUNTS the harness (dth-hrh, smart-ra, …) computes the runs instead of
 * reporting the test-run criteria `unknown`. A writer in
 * {@link TEST_RUN_WRITERS} writes its runs to {@link TEST_RUN_OUT_ENV} when
 * that is set, and nothing else, so the gate can run it into a temporary
 * directory and judge what it produced: determined, and still writing nothing.
 *
 * The list lives here rather than in `qa-refresh.ts` (which spreads it into
 * `QA_WRITERS`) because that module scans the workspace when it is imported.
 *
 * @module scripts/test-run-compute
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { TOOLS_ROOT } from "./lib/roots.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

/** Directory a {@link TEST_RUN_WRITERS} writer puts its test runs in instead of `test/results/`. */
export const TEST_RUN_OUT_ENV = "QA_TEST_RUN_OUT_DIR";

/** A `qa-refresh` writer whose only output is `*.test-run.json`, redirectable by {@link TEST_RUN_OUT_ENV}. */
export interface TestRunWriter {
  id: string;
  /** `bun run cat` arguments, from the workspace root. */
  run: readonly string[];
  /** Workspace-relative paths of the runs it writes. No globs. */
  writes: readonly string[];
  because: string;
}

// declared-path-literal: the HARNESS's qa tree, keyed as qa-refresh's `R` is.
const R = "cat-harness/test/results";

export const TEST_RUN_WRITERS: readonly TestRunWriter[] = [
  { id: "eval:crdm-detect", run: ["eval:crdm-detect"], writes: [`${R}/crdm-detect-eval.test-run.json`], because: "the crdm-detect phrase-signal evaluation over its fixed corpus" },
];

export interface ComputedTestRuns {
  /** Temporary directory holding the computed `*.test-run.json`; the caller removes it with `done()`. */
  dir: string;
  /** Writer ids that ran. */
  writers: string[];
  done: () => void;
}

/** The writers whose runs belong directly under `resultsDir`. */
export function testRunWritersFor(resultsDir: string, workspaceRoot: string, writers: readonly TestRunWriter[] = TEST_RUN_WRITERS): TestRunWriter[] {
  const dir = resolve(resultsDir);
  return writers.filter((w) => w.writes.some((p) => p.endsWith(".test-run.json") && resolve(workspaceRoot, dirname(p)) === dir));
}

/**
 * Run each writer for `resultsDir` into one temporary directory. A reason,
 * not a directory, when there is no writer or one failed: the caller keeps
 * its `unknown`, because a partial set would read as all the runs.
 */
export function computeTestRuns(
  resultsDir: string,
  workspaceRoot: string,
  writers: readonly TestRunWriter[] = TEST_RUN_WRITERS,
): ComputedTestRuns | { reason: string } {
  const chosen = testRunWritersFor(resultsDir, workspaceRoot, writers);
  if (chosen.length === 0) return { reason: "no declared writer computes its test runs" };
  // input-site: traced #4904ad92 — where the writers write their computed runs, which reach the answer; a run that reaches it records no hash
  inputSiteReached("test-run-compute: dir");
  const dir = mkdtempSync(join(tmpdir(), "test-runs-computed-"));
  const done = (): void => rmSync(dir, { recursive: true, force: true });
  for (const w of chosen) {
    // input-site: traced #db56d334 — the writer's environment, all of this process's
    inputSiteReached("test-run-compute: writer env");
    const env = { ...process.env, [TEST_RUN_OUT_ENV]: dir };
    // `bun run cat …`, without needing the workspace's package.json to name `cat`.
    // input-site: traced #69125803 — runs a declared test-run writer, whose output reaches the answer
    inputSiteReached("test-run-compute: writer");
    const r = spawnSync("bun", [join(TOOLS_ROOT, "scripts", "run-script.ts"), ...w.run], { cwd: workspaceRoot, encoding: "utf-8", env, maxBuffer: 1 << 26 });
    if (r.status !== 0) {
      done();
      const why = (r.stderr || r.stdout || "").trim().split("\n").pop() ?? "";
      return { reason: `writer ${w.id} exited ${r.status ?? "on a signal"}${why ? `: ${why.slice(0, 200)}` : ""}` };
    }
  }
  return { dir, writers: chosen.map((w) => w.id), done };
}

/** `where` of a computed run, named as the file it stands for. */
export function computedWhere(where: string, resultsRel: string): string {
  return `${join(resultsRel, basename(where))} (computed in this run)`;
}

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { computedWhere, computeTestRuns, TEST_RUN_WRITERS, testRunWritersFor } from "../test-run-compute.ts";
import { QA_WRITERS } from "../qa-refresh.ts";

// cat-harness-tools#1191: a mounted harness's test runs are not committed and
// its store is on another repository, so kg:audit:check computes them.
describe("test runs the checkout does not hold are computed, never written to the tree", () => {
  const ws = "/w";
  test("a writer is chosen only for the directory its runs belong in", () => {
    expect(testRunWritersFor("/w/cat-harness/test/results", ws).map((w) => w.id)).toEqual(["eval:crdm-detect"]);
    expect(testRunWritersFor("/w/other/test/results", ws)).toEqual([]);
  });
  test("qa:refresh still runs every test-run writer", () => {
    for (const w of TEST_RUN_WRITERS) expect(QA_WRITERS.some((q) => q.id === w.id)).toBe(true);
  });
  test("no writer for the directory is a reason, so the caller keeps unknown", () => {
    const r = computeTestRuns("/nowhere/test/results", ws);
    expect("reason" in r && r.reason).toContain("no declared writer");
  });
  test("a failing writer is a reason and leaves no directory behind", () => {
    const r = computeTestRuns(resolve("/w/x"), ws, [{ id: "bad", run: ["no-such-script-1191"], writes: ["x/a.test-run.json"], because: "t" }]);
    expect("reason" in r && r.reason).toContain("writer bad exited");
  });
  test("a computed run is named as the file it stands for", () => {
    expect(computedWhere("../../tmp/test-runs-computed-x/a.test-run.json", "test/results")).toBe(join("test/results", "a.test-run.json") + " (computed in this run)");
  });
  test("a computed run is written to the temporary directory only", () => {
    const harness = resolve(import.meta.dir, "../../../cat-harness");
    if (!existsSync(join(harness, "cat-harness.json"))) return; // no sibling harness here
    const r = computeTestRuns(join(harness, "test/results"), resolve(harness, ".."));
    if (!("dir" in r)) throw new Error(r.reason);
    try {
      expect(readdirSync(r.dir)).toEqual(["crdm-detect-eval.test-run.json"]);
    } finally {
      r.done();
    }
  }, 120_000);
});

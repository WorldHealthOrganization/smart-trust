/**
 * `merge:watch`'s verdict: rule 1 of merge-manager-watcher §"Merge-sweep rules",
 * with the owner's "every judge" ruling of 2026-11-07.
 *
 * Each fixture case is one head SHA's check runs and workflow runs, with the
 * verdict the rule gives. Every "green" case has a sibling that must not be
 * green: a cancelled job superseded only by another workflow, a red judge, a
 * missing shard.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { formatVerdict, verdictOf, type CheckRun, type WorkflowRun } from "../../merge-watch.ts";

interface Case {
  name: string;
  pr: { draft: boolean };
  checkRuns: CheckRun[];
  workflowRuns: WorkflowRun[];
  /** Job logs by check run id; `null`: could not be read. */
  logs?: Record<string, string | null>;
  expected: string;
}

const { cases } = JSON.parse(readFileSync(join(import.meta.dir, "..", "fixtures", "merge-watch", "cases.json"), "utf8")) as { cases: Case[] };

describe("merge:watch verdict per rule 1", () => {
  test("the fixture covers the named cases", () => {
    const names = cases.map((c) => c.name);
    for (const n of [
      "fast-tier-only",
      "cancelled-then-superseded",
      "queued-judge",
      "red-shard-no-judge",
      "red-shard-judge-passes",
      "red-shard-judge-passes-no-table",
      "shard-table-lists-new-failures",
      "red-check-no-judge-names",
      "one-of-two-judges-red",
      "ready-for-review-run-queued",
    ]) {
      expect(names).toContain(n);
    }
  });

  test.each(cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    const logs = new Map(Object.entries(c.logs ?? {}).map(([id, log]) => [Number(id), log]));
    expect(formatVerdict(verdictOf(c.pr, c.checkRuns, c.workflowRuns, logs))).toBe(c.expected);
  });

  test("no checks at all is pending, never green", () => {
    expect(formatVerdict(verdictOf({ draft: false }, [], []))).toBe("pending: no checks");
  });
});

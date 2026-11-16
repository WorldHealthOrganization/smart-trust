/**
 * The typed reports of `gates` and `check:merged` (#1259, owner card Q-DS-14 A).
 *
 * The exit code is the verdict and the report never re-derives it: these hold
 * that `outcome` names each code correctly, that the two exit-1 cases (a gate
 * failed; every gate passed but one changed the tree) are told apart, and that
 * a run which stopped before any verdict is not reported as a gate failure.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { finishGatesReport, reportPathFrom, startGatesReport } from "../gates.ts";
import { finishMergedReport, readInnerReport } from "../check-merged.ts";
import { GatesReportSchema, MergedGatesReportSchema } from "../../schemas/sdlc/gates-report.ts";
import { TOOL_TYPES } from "../../schemas/tools/tool-types.ts";

const gate = { command: "bun run cat check:x", job: "checks", step: "Check x" };

describe("gates --report", () => {
  test("is published as shared tool types", () => {
    for (const n of ["GatesReport", "MergedGatesReport"]) expect(n in TOOL_TYPES).toBe(true);
  });

  test("--report takes a path, and refuses a missing one", () => {
    expect(reportPathFrom(["bun", "gates.ts"])).toBeUndefined();
    expect(reportPathFrom(["bun", "gates.ts", "--report", "/tmp/r.json"])).toBe("/tmp/r.json");
    expect(() => reportPathFrom(["bun", "gates.ts", "--report"])).toThrow(/needs a path/);
    expect(() => reportPathFrom(["bun", "gates.ts", "--report", "--all"])).toThrow(/needs a path/);
  });

  test("exit 0 is a pass, and skipped gates stay listed apart from it", () => {
    const r = { ...startGatesReport(false), gates: 3, skipped: [{ command: gate.command, why: "inputs unchanged" }] };
    const f = finishGatesReport(r, 0);
    expect(f.outcome).toBe("pass");
    expect(f.exitCode).toBe(0);
    expect(f.skipped).toHaveLength(1);
    expect(GatesReportSchema.parse(f)).toEqual(f);
  });

  test("exit 1 with a failed gate is a fail, with its salient lines", () => {
    const r = { ...startGatesReport(true), failed: [{ ...gate, why: ["expected 0, got 2"] }] };
    const f = finishGatesReport(r, 1);
    expect(f.outcome).toBe("fail");
    expect(f.set).toBe("whole");
    expect(f.failed[0]!.why).toEqual(["expected 0, got 2"]);
  });

  test("exit 1 with nothing failed but a mutation is not-clean, not a fail", () => {
    expect(finishGatesReport({ ...startGatesReport(false), mutatedBy: ["bun test"] }, 1).outcome).toBe("not-clean");
  });

  test("exit 1 with nothing recorded stopped before a verdict, so it is undetermined", () => {
    const f = finishGatesReport(startGatesReport(false), 1);
    expect(f.outcome).toBe("undetermined");
    expect(f.exitCode).toBe(1);
    expect(f.undetermined.at(-1)).toMatch(/before any verdict/);
  });

  test("exit 2, and any other code, is undetermined", () => {
    expect(finishGatesReport(startGatesReport(false), 2).outcome).toBe("undetermined");
    const crash = finishGatesReport(startGatesReport(false), 134);
    expect([crash.outcome, crash.exitCode]).toEqual(["undetermined", 2]);
  });
});

describe("check:merged --report", () => {
  test("a conflict names its files", () => {
    const f = finishMergedReport({ outcome: "conflict", head: "a", base: "b", behind: 2, conflicts: ["x.ts"], why: "the merge conflicts" }, 1);
    expect(MergedGatesReportSchema.parse(f)).toEqual(f);
    expect(f.conflicts).toEqual(["x.ts"]);
  });

  test("carries the inner gate run when it wrote one, and ignores a file that is not one", () => {
    const dir = mkdtempSync(join(tmpdir(), "gates-report-"));
    const good = join(dir, "good.json");
    writeFileSync(good, JSON.stringify(finishGatesReport(startGatesReport(false), 0)));
    const bad = join(dir, "bad.json");
    writeFileSync(bad, JSON.stringify({ outcome: "pass" }));
    expect(readInnerReport(good)?.outcome).toBe("pass");
    expect(readInnerReport(bad)).toBeUndefined();
    expect(readInnerReport(join(dir, "absent.json"))).toBeUndefined();
    const f = finishMergedReport({ outcome: "pass", gates: readInnerReport(good) }, 0);
    expect(f.gates?.exitCode).toBe(0);
  });
});

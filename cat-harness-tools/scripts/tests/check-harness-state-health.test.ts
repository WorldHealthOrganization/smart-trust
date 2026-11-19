// Q-FAD-6 A (owner, 2026-11-01): the health-producer gate judges only this
// repository's own report, and gives a report from an old producer one daily
// cycle of grace before it is a finding.
import { describe, expect, test } from "bun:test";
import { HEALTH_PRODUCER_GRACE_HOURS, isOwnHealthReport, judgeHealthReport } from "../check-harness-state.ts";

const now = new Date("2026-11-01T15:00:00Z");
const report = (hash: string, updatedAt?: string) =>
  JSON.stringify({ producer: { script: "test/health/run.ts", script_hash: hash }, ...(updatedAt ? { updated_at: updatedAt } : {}) });
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

describe("judgeHealthReport", () => {
  test("a report from the current producer is current at any age", () => {
    expect(judgeHealthReport(report("new", hoursAgo(500)), ["new"], now)).toBeUndefined();
  });
  test("a report from an old producer passes inside the grace period", () => {
    expect(judgeHealthReport(report("old", hoursAgo(8)), ["new"], now)).toBeUndefined();
    expect(judgeHealthReport(report("old", hoursAgo(HEALTH_PRODUCER_GRACE_HOURS)), ["new"], now)).toBeUndefined();
  });
  test("past the grace period it is a finding naming both hashes", () => {
    const f = judgeHealthReport(report("old", hoursAgo(HEALTH_PRODUCER_GRACE_HOURS + 1)), ["new"], now);
    expect(f?.detail).toContain("at old");
    expect(f?.detail).toContain("now new");
  });
  test("no readable date gets no grace", () => {
    expect(judgeHealthReport(report("old"), ["new"], now)?.detail).toContain("no readable updated_at");
  });
  test("a report with no producer, or that does not parse, is still a finding", () => {
    expect(judgeHealthReport("{}", ["new"], now)?.detail).toContain("records no producer");
    expect(judgeHealthReport("{", ["new"], now)?.detail).toContain("does not parse");
  });
});

describe("isOwnHealthReport", () => {
  const repo = "/r";
  const roots = ["/r", "/r/cat-harness-tools", "/r/who-iris"];
  test("the repository's own report is judged; a mounted instance's is not", () => {
    expect(isOwnHealthReport("/r/test/health/results/repository.health-report.json", repo, roots)).toBe(true);
    expect(isOwnHealthReport("/r/cat-harness-tools/health/repository.health-report.json", repo, roots)).toBe(false);
    expect(isOwnHealthReport("/r/who-iris/test/health/results/repository.health-report.json", repo, roots)).toBe(false);
  });
  test("a prefix that is not a directory boundary does not count as inside an instance", () => {
    expect(isOwnHealthReport("/r/who-iris-notes/x.json", repo, roots)).toBe(true);
  });
});

/**
 * `scripts/ci/qa-axis-summary.py` reads what `qa-sweep --json` actually emits.
 *
 * Bean `cat-tools-5jij`: the summary read `want_criteria` and `blocks` (the
 * keys of `qa-staleness.ts`) through `.get(..., [])` defaults, so on every
 * axis it printed "criteria run: 0" and "(no failing criteria)" while the
 * same run's full sweep reported a critical finding. This pipes a REAL sweep
 * of a folio with a known failure through it, and holds the old shape to a
 * non-zero exit so a missing key can never read as zero again.
 *
 * @module scripts/tests/qa-axis-summary
 */
import { describe, expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { initFolio } from "../init-folio";
import { TOOLS_ROOT } from "../lib/roots.ts";

const SUMMARY = join(TOOLS_ROOT, "scripts", "ci", "qa-axis-summary.py");
const SWEEP = join(TOOLS_ROOT, "pipeline", "qa-sweep.ts");

function summarise(stdin: string): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync("python3", ["-B", SUMMARY], { input: stdin, encoding: "utf-8" });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/**
 * One sweep, at module scope, as `profile-scoping.test.ts` does: the child
 * imports the whole QA pipeline and costs seconds, which is most of a
 * per-test budget.
 */
function sweepWithKnownFailure(): string {
  const d = mkdtempSync(join(tmpdir(), "qa-axis-summary-"));
  try {
    initFolio({
      targetDir: d,
      contentType: "document",
      slug: "cold-chain-guidance",
      title: "Cold Chain Guidance",
      authors: ["A. Author"],
      link: "sibling",
      assistantPath: "folio-assistant",
      skipVcs: true,
    });
    // A work-tracker marker in the manuscript: `voice-status-leak`, critical.
    appendFileSync(join(d, "folio", "cold-chain-guidance", "introduction", "overview.md"), "\nTODO: finish this section.\n");
    const res = spawnSync("bun", ["run", SWEEP, "folio/cold-chain-guidance", "--axis", "one-voice", "--dry-run", "--json"], {
      cwd: d,
      encoding: "utf-8",
      timeout: 600_000,
    });
    if (res.status !== 0) throw new Error(`qa-sweep exited ${res.status} (signal ${res.signal ?? "-"})\n${res.stderr}`);
    return res.stdout;
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}

const SWEPT = sweepWithKnownFailure();

describe("qa-axis-summary reads the shape qa-sweep --json emits (5jij)", () => {
  test("a real one-voice sweep with a planted TODO: criteria are counted and the failure is named", () => {
    const r = summarise(SWEPT);
    expect(r.status).toBe(0);
    const run = Number(/^criteria run: (\d+)$/m.exec(r.stdout)?.[1]);
    expect(run).toBeGreaterThan(0);
    expect(r.stdout).toMatch(/^\s+\d+ voice-status-leak$/m);
    expect(r.stdout).not.toContain("(no failing criteria)");
  });

  test("the shape it used to read is an error, not a zero", () => {
    const r = summarise(JSON.stringify({ want_criteria: ["a"], blocks: [{ details: [{ criterion: "a", outcome: "fail" }] }] }));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("`criteria`");
    expect(r.stdout).toBe("");
  });

  test("each missing or mistyped key is an error", () => {
    for (const bad of [
      { criteria: ["a"] },
      { results: [] },
      { criteria: "a", results: [] },
      { criteria: ["a"], results: [{}] },
      { criteria: ["a"], results: [{ details: [{ criterion: "a" }] }] },
      [],
    ]) expect(summarise(JSON.stringify(bad)).status).toBe(1);
  });

  test("an empty stdin (a crashed sweep) is an error", () => {
    expect(summarise("").status).toBe(1);
  });

  test("a clean sweep reports its count and no failures", () => {
    const r = summarise(JSON.stringify({ criteria: ["a", "b"], results: [{ details: [{ criterion: "a", outcome: "pass" }] }] }));
    expect(r.status).toBe(0);
    expect(r.stdout).toBe("criteria run: 2\n  (no failing criteria)\n");
  });
});

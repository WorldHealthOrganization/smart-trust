/**
 * Two CI hard gates reported success over a corpus they never read.
 *
 * `qa-section-title-audit.ts` — `section-title-audit.yml` documents it as a
 * HARD GATE ("a new split-artifact / trailing-colon / empty title … now fails
 * CI"). Run with no folio attached it printed:
 *
 *     section-title audit: 0 titles across 0 chapters (max-len 72)
 *       ✓ no HARD defect(s)
 *       ✓ no conciseness/duplicate warning(s)
 *       ✓ no structure findings (depth / band / balance)
 *     exit 0
 *
 * Three green ticks, one line under "0 titles across 0 chapters".
 *
 * `trivial-skeleton-audit.ts` — `witness-pipeline.yml` (retired to `fsh-guts`,
 * bean `1l13`) ran it as
 * "baseline-strict" with per-pattern budgets pinned at the current counts and
 * the `|| true` mask deliberately dropped, so its exit code really gates. The
 * test is `observed > budget`; over an empty corpus every `observed` is 0, so
 * no budget can ever be exceeded and it printed "✓ All strict-gate budgets
 * respected". It also wrote a witness JSON recording the empty result.
 *
 * Neither could read anything in EITHER repo. `qa-section-title-audit` began
 * with `process.chdir(resolve(HARNESS_ROOT))` — the platform —
 * and every path in it is cwd-relative; `trivial-skeleton-audit` globbed under
 * a hardcoded `folio/quantum-observable-universe` beneath a self-rooted
 * `REPO_ROOT`, a path present in no checkout.
 *
 * The rule these now follow is the one `validateObjects` settled (bean
 * `vald`): auditing nothing is a failure, not a pass.
 */
import { describe, test, expect, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { spawnSync } from "child_process";
import { HARNESS_ROOT, TOOLS_ROOT } from "../lib/roots.ts";

const INSTANCE_ROOT = resolve(HARNESS_ROOT);
const DIR = mkdtempSync(join(tmpdir(), "audit-empty-"));
afterAll(() => {
  try {
    rmSync(DIR, { recursive: true, force: true });
  } catch {}
});

const run = (script: string, cwd: string, args: string[] = []) =>
  spawnSync("bun", ["run", join(TOOLS_ROOT, script), ...args], {
    cwd,
    encoding: "utf-8",
    timeout: 90_000,
  });

/** A folio with one paper: a chapter manifest and a Lean file. */
function makeFolio(name: string): string {
  const root = join(DIR, name);
  const paper = join(root, "folio", "demo-paper");
  mkdirSync(join(paper, "ch-one"), { recursive: true });
  mkdirSync(join(paper, "lean", "Demo"), { recursive: true });
  writeFileSync(
    join(paper, "demo-paper.ts"),
    'export default { title: "Demo", authors: [], chapters: [{ dir: "ch-one" }] };\n',
  );
  writeFileSync(
    join(paper, "ch-one", "ch-one.ts"),
    "export default {\n" +
      '  title: "A Chapter",\n' +
      "  sections: [\n" +
      '    { title: "A Perfectly Fine Section", label: "sec:fine", blocks: [] },\n' +
      '    { title: "Trailing colon artifact : tag", label: "sec:bad", blocks: [] },\n' +
      "  ],\n};\n",
  );
  writeFileSync(join(paper, "lean", "Demo", "Triv.lean"), "def oneDef : Nat := 1\n");
  try {
    symlinkSync(INSTANCE_ROOT, join(root, "folio-assistant"));
  } catch {
    /* already linked */
  }
  return root;
}

describe("qa-section-title-audit", () => {
  const SCRIPT = "pipeline/qa-section-title-audit.ts";

  test("refuses to report success over an empty corpus", () => {
    const r = run(SCRIPT, INSTANCE_ROOT);
    expect(r.status).not.toBe(0);
    expect(`${r.stdout}${r.stderr}`).toContain("refusing to report success");
  });

  test("does not print a clean bill of health when it read nothing", () => {
    // The exact regression: three ✓ lines over "0 titles across 0 chapters".
    const out = (() => {
      const r = run(SCRIPT, INSTANCE_ROOT);
      return `${r.stdout}${r.stderr}`;
    })();
    expect(out).not.toContain("✓ no HARD defect(s)");
    expect(out).not.toContain("✓ no structure findings");
  });

  test("reads a folio's chapter manifests and gates on a real defect", () => {
    // Before the fix this was impossible: the script chdir'd to the platform
    // at module load, so a folio cwd made no difference.
    const r = run(SCRIPT, makeFolio("titles"));
    const out = `${r.stdout}${r.stderr}`;
    expect(out).toContain("3 titles across 1 chapters");
    expect(out).toContain("split-artifact");
    expect(r.status).toBe(1);
  });
});

describe("trivial-skeleton-audit", () => {
  const SCRIPT = "pipeline/trivial-skeleton-audit.ts";

  test("refuses to report success over an empty corpus", () => {
    const r = run(SCRIPT, INSTANCE_ROOT);
    expect(r.status).not.toBe(0);
    expect(`${r.stdout}${r.stderr}`).toContain("refusing to report success");
  });

  test("a strict-gate budget cannot be satisfied by scanning nothing", () => {
    // The purest form of the defect: `0 > budget` is false for every budget,
    // so the gate passed for free. It must not even reach that comparison.
    const r = run(SCRIPT, INSTANCE_ROOT, ["--max-per-pattern", "one_def=0"]);
    expect(r.status).not.toBe(0);
    expect(`${r.stdout}${r.stderr}`).not.toContain("budgets respected");
  });

  test("scans a folio's Lean and enforces the budget", () => {
    const folio = makeFolio("skeleton");
    const over = run(SCRIPT, folio, ["--max-per-pattern", "one_def=0"]);
    expect(`${over.stdout}${over.stderr}`).toContain("one_def: 1 (budget 0)");
    expect(over.status).toBe(1);

    const under = run(SCRIPT, folio, ["--max-per-pattern", "one_def=5"]);
    // The pass states what it scanned, so "respected" can't mean "read nothing".
    expect(`${under.stdout}${under.stderr}`).toContain("1 file(s) scanned");
    expect(under.status).toBe(0);
  });
});

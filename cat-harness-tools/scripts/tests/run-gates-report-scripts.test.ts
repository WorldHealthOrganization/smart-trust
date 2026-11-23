/**
 * run-gates.py skips every script `gates.ts` declares `kind: "report"`, in
 * index mode as in layer mode, read from where gates.ts reads them.
 *
 * check:draft-beans is `report` (a PR checkout has no `origin/main`, so it
 * exits 2), but run-gates.py skipped it only in LAYER_MODE_SCRIPTS: an
 * instance that is its own index ran it as a gate and went red on nothing in
 * its diff. The skip is now derived from gates.ts's own table, each present
 * instance's declared `gateExemptions.scripts` and the index's, so a new
 * `report` entry is skipped without anyone editing a list here. run-gates.py
 * asks gates.ts itself (`--report-scripts`), so the answer is SCRIPT_EXEMPTIONS.
 *
 * Except the `report` scripts run-gates.py wires as gates itself: it supplies
 * check:test-budgets its junit report, and runs separation:cutover:check over
 * the tree as mounted.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { SCRIPT_EXEMPTIONS, reportScripts } from "../gates.ts";
import { RUN_GATES } from "../lib/root-gate-set.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function write(root: string, rel: string, body: unknown): void {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

/** A stand-in gates.ts that answers `--report-scripts` as the real one does. */
const GATES_TS = `if (process.argv.includes("--report-scripts")) {
  console.log(JSON.stringify({
    "check:draft-beans": "a PR checkout has no origin/main",
    "check:declared-report": "declared by the instance",
    "check:test-budgets": "has no subject until a suite has run",
    "separation:cutover:check": "a one-event question",
  }));
}
`;

/** An instance that is its own index (INDEX mode, as dth-sfp is), mounting cat-harness-tools. */
function fixture(withGatesTs = true): string {
  const root = mkdtempSync(join(tmpdir(), "run-gates-report-"));
  made.push(root);
  write(root, "doc.json", {
    $schema: "cat-harness-declaration/v1",
    name: "doc",
    needs: ["tools"],
  });
  write(root, "package.json", { name: "doc", scripts: { cat: "echo" } });
  write(root, "index.config.json", {
    $schema: "folio-index-config/v1",
    layers: [{ name: "doc", source: { local: { at: "." } } }],
  });
  write(root, "tools/tools.json", { $schema: "cat-harness-declaration/v1", name: "tools" });
  write(root, "tools/package.json", {
    name: "tools",
    scripts: {
      "check:draft-beans": "x",
      "check:declared-report": "x",
      "check:test-budgets": "x",
      "separation:cutover:check": "x",
      "check:other": "x",
    },
  });
  if (withGatesTs) write(root, "cat-harness-tools/scripts/gates.ts", GATES_TS);
  return root;
}

type Gate = { exit?: number; skipped?: string };

function runGates(root: string, junit?: string) {
  const env: Record<string, string | undefined> = { ...process.env, GATE_JOBS: "8", GATE_CONE: "" };
  for (const k of ["GATE_SHARD", "GATE_TIMINGS", "MODE", "GATE_JUNIT"]) delete env[k];
  if (junit) env.GATE_JUNIT = junit;
  const out = join(root, "gates.json");
  const r = spawnSync("python3", ["-B", RUN_GATES, root, out], { encoding: "utf-8", env, timeout: 120_000 });
  return { r, gates: JSON.parse(readFileSync(out, "utf-8")) as Record<string, Gate> };
}

describe("run-gates.py skips gates.ts's `report` scripts", () => {
  test("in INDEX mode, check:draft-beans is skipped as a report, never run as a gate", () => {
    const { r, gates } = runGates(fixture());
    expect(r.status).toBe(0);
    expect(gates["tools:check:draft-beans"]?.exit).toBeUndefined();
    expect(gates["tools:check:draft-beans"]?.skipped).toContain('kind: "report"');
    expect(gates["tools:check:other"]?.exit).toBe(0);
  });

  test("a `report` gates.ts takes from a declaration is skipped with its reason", () => {
    const { gates } = runGates(fixture());
    expect(gates["tools:check:declared-report"]?.skipped).toContain("declared by the instance");
  });

  test("the `report` scripts run-gates.py wires itself still run as gates", () => {
    const root = fixture();
    write(root, "junit.xml", '<testsuites tests="1"><testsuite name="a"><testcase name="t" time="0.1"/></testsuite></testsuites>');
    const { gates } = runGates(root, join(root, "junit.xml"));
    expect(gates["tools:check:test-budgets"]?.exit).toBe(0);
    expect(gates["tools:separation:cutover:check"]?.exit).toBe(0);
  });

  test("in INDEX mode EVERY `report` script of the real table is skipped, but the two run-gates.py wires (#2460)", () => {
    // Not only check:draft-beans: each script gates.ts calls `report` would
    // redden an index-mode run the same way, so every one is asked of here.
    const real = reportScripts(SCRIPT_EXEMPTIONS);
    const wired = new Set(["check:test-budgets", "separation:cutover:check"]);
    const root = fixture();
    write(root, "cat-harness-tools/scripts/gates.ts", `if (process.argv.includes("--report-scripts")) console.log(${JSON.stringify(JSON.stringify(real))});\n`);
    write(root, "tools/package.json", {
      name: "tools",
      scripts: Object.fromEntries([...Object.keys(real), "check:other"].map((k) => [k, "x"])),
    });
    const { r, gates } = runGates(root);
    expect(r.status).toBe(0);
    const ran = Object.keys(real).filter((k) => !wired.has(k) && gates[`tools:${k}`]?.skipped === undefined);
    expect(ran).toEqual([]);
    // check:draft-beans by its `report` reason; a few are skipped earlier for a reason of their own (needs-input).
    expect(gates["tools:check:draft-beans"]?.skipped).toContain('kind: "report"');
    expect(gates["tools:check:other"]?.exit).toBe(0);
  });

  test("with no gates.ts to ask it says so, and skips nothing as a report", () => {
    const { r, gates } = runGates(fixture(false));
    expect(r.stderr).toContain("--report-scripts is absent");
    expect(gates["tools:check:draft-beans"]?.exit).toBe(0);
    expect(gates["tools:check:declared-report"]?.exit).toBe(0);
  });
});

describe("gates.ts --report-scripts", () => {
  test("prints exactly the `report` exemptions of SCRIPT_EXEMPTIONS, check:draft-beans among them", () => {
    const r = spawnSync("bun", [join(import.meta.dir, "..", "gates.ts"), "--report-scripts"], { encoding: "utf-8", timeout: 120_000 });
    expect(r.status).toBe(0);
    const got = JSON.parse(r.stdout.trim().split("\n").at(-1)!) as Record<string, string>;
    expect(got).toEqual(reportScripts(SCRIPT_EXEMPTIONS));
    expect(Object.keys(got)).toContain("check:draft-beans");
    // the ones built by a `.map` count too, not only the literal entries
    expect(Object.keys(got)).toContain("check:wireframes");
    expect(reportScripts([{ script: "a", kind: "covered-by", reason: "r" }])).toEqual({});
  });
});

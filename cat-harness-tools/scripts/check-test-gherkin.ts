#!/usr/bin/env bun
/**
 * Every test has a Gherkin: report the tests no Scenario names, and the
 * Scenarios that name no test.
 *
 * The rule is the `test-engineer` skill's *Every test has a Gherkin*; the
 * scanner and the tag grammar (`@test:<file>::<scope>::<name>`) are
 * `scripts/lib/test-gherkin.ts`. This is the command around them, for any
 * repository: it reads the tree under `--root` (default: the current
 * directory's git top level, else the current directory) with every language
 * adapter, and names tests relative to that root.
 *
 * Not a gate. A repository adopting the rule backfills first; until then this
 * reports the size of the gap, and the kg-audit criterion `test-has-gherkin`
 * records it. A repository that has backfilled can gate on the exit code.
 *
 * A Scenario may also bind an EXTERNAL test case by tag — `@itb:<testSuite id>/<testCase id>`
 * for a WHO-ITB (GITB TDL) test case (owner, 2026-11-07). Those tags resolve
 * against the checkout `--itb` names; without one they are reported
 * "unresolved — source not held", never passed. Feature files may be in any
 * Gherkin dialect (`# language: <code>`).
 *
 * A repository that DECLARES its `.feature` files to be test specifications
 * for implementers — `testSpecifications` on a `contentTypes` section of its
 * `index.config.json` (owner, 2026-11-13) — has its
 * unbound Scenarios counted as specifications, not reported; a bound one is
 * checked as usual. See `SPECIFICATION_DECLARATIONS` in the library.
 *
 * Usage:
 *   bun run cat check:test-gherkin
 *   bun run cat check:test-gherkin -- --root ../smart-trust-tools --under tools/hcert-rust
 *   bun run cat check:test-gherkin -- --itb ../who-itb     # resolve @itb: tags
 *   bun run cat check:test-gherkin -- --json
 *
 * Exit: 0 every test and Scenario linked, 1 an orphan either way, 2 could not check.
 *
 * @covers code — the tests and `.feature` files under `--root`, read by each language adapter
 * @module scripts/check-test-gherkin
 */
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { itbResolver, scanTree, type GherkinFindingKind } from "./lib/test-gherkin.ts";

const ORDER: GherkinFindingKind[] = [
  "test-without-scenario",
  "tag-names-no-test",
  "test-in-two-scenarios",
  "scenario-names-no-test",
  "tag-on-feature",
  "ambiguous-test-name",
  "tag-names-no-target",
  "binding-unresolved",
  "unknown-dialect",
  "test-name-not-static",
];

function defaultRoot(): string {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return process.cwd();
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  let root: string | undefined;
  const under: string[] = [];
  let json = false;
  let itb: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--root") root = args[++i];
    else if (a === "--under") under.push(args[++i]);
    else if (a === "--json") json = true;
    else if (a === "--itb") itb = args[++i];
    else {
      console.error(`check:test-gherkin: unknown argument \`${a}\`. Usage: [--root DIR] [--under DIR]… [--itb DIR] [--json]`);
      process.exit(2);
    }
  }
  const dir = resolve(root ?? defaultRoot());
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    console.error(`check:test-gherkin: ${dir} is not a directory — could not check.`);
    process.exit(2);
  }
  const report = scanTree(dir, { under, resolvers: [itbResolver(itb && resolve(itb))] });
  if (json) {
    console.log(JSON.stringify({ root: dir, tests: report.tests.length, scenarios: report.scenarios.length, specifications: report.specifications.length, findings: report.findings }, null, 2));
  } else {
    const linked = report.tests.length - report.findings.filter((f) => f.kind === "test-without-scenario" || f.kind === "test-name-not-static").length;
    console.log(`check:test-gherkin: ${report.tests.length} test(s), ${report.scenarios.length} Scenario(s), ${linked} test(s) linked — under ${dir}`);
    if (report.specifications.length > 0) {
      const files = new Set(report.specifications.map((s) => s.file));
      console.log(`${report.specifications.length} unbound Scenario(s) in ${files.size} declared specification file(s) — test specifications for implementers, not tests of this tree; an \`@itb:\` binding makes one checked.`);
    }
    for (const kind of ORDER) {
      const fs = report.findings.filter((f) => f.kind === kind);
      if (fs.length === 0) continue;
      console.log(`\n${kind} (${fs.length}):`);
      for (const f of fs) console.log(`  ${f.file}:${f.line}  ${f.detail}`);
    }
    if (report.findings.length === 0) console.log("Every test has a Scenario, and every Scenario names a test.");
  }
  process.exit(report.findings.length > 0 ? 1 : 0);
}

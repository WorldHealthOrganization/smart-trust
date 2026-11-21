#!/usr/bin/env bun
/**
 * Does a path-filtered workflow rebuild when the scripts it RUNS change?
 *
 * A `paths:` filter is a hand-maintained list; a change to a generator a
 * workflow runs changes its output while touching nothing under the filtered
 * directories. This checks the **directly invoked** scripts: a repo-relative
 * `.ts` or `.sh` path appearing in a `run:` step must be covered by the
 * filter.
 *
 * It does NOT follow imports; a directory wildcard is the way to cover the
 * transitive set, and is accepted.
 *
 * A workflow with no `paths:` filter is reported as `unfiltered`, and one
 * whose `run:` steps name no repo script as `no-scripts`, never as a pass.
 * **An empty workflow set exits 2.**
 *
 * @covers none — .github/workflows/ is not a declared graph typology
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { repoRootFor } from "../schemas/kg/cat-harness.js";

const ROOT = repoRootFor(join(import.meta.dir, ".."));
const WORKFLOW_DIR = join(ROOT, ".github", "workflows");

export type Verdict = "covered" | "uncovered" | "unfiltered" | "no-scripts";

export interface WorkflowReport {
  workflow: string;
  verdict: Verdict;
  /** Scripts the workflow runs that no `paths:` pattern matches. */
  uncovered: string[];
  /** Scripts the workflow runs, whether covered or not. */
  invoked: string[];
}

/**
 * EVERY `paths:` block in a workflow — one per trigger — or `[]` when it
 * declares none.
 *
 * All of them, not the first. `jsonld-gen-check.yml` carries a block under
 * `push:` and another under `pull_request:`, and each gates INDEPENDENTLY: a
 * script covered on push and missing on pull_request rebuilds on `main` and
 * not on the PR, which is the half of the pair a reviewer actually looks at.
 * Reading only the first block found that workflow clean while four of its
 * scripts were uncovered in both — a parser's partial read reported as a pass.
 *
 * An empty array means "no filter", which is TOTAL coverage (the workflow runs
 * on every push), and the caller must not read it as "covers nothing". The two
 * are opposite verdicts, so the caller distinguishes them rather than this
 * returning one value for both.
 */
export function pathsFilters(yaml: string): string[][] {
  return [...yaml.matchAll(/^ {4}paths:\n((?: {6}(?:-|#).*\n)+)/gm)].map((m) =>
    m[1]!
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("- "))
      .map((l) => l.slice(2).trim().replace(/^['"]|['"]$/g, "")),
  );
}

/**
 * Repo-relative scripts a workflow's `run:` steps invoke.
 *
 * Filtered by `existsSync` on purpose: the same regex also matches paths the
 * workflow WRITES (`./_site/foo.ts` never exists) and paths inside comments
 * that name a file since moved. A path that is not in the tree cannot be a
 * script this workflow runs, and reporting it would train a reader to ignore
 * the output.
 */
export function invokedScripts(yaml: string, root: string): string[] {
  const out = new Set<string>();
  for (const m of yaml.matchAll(/([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+\.(?:ts|sh))/g)) {
    // `./x/y.ts` and `x/y.ts` name the same file; a `paths:` pattern never
    // starts with `./`, so the prefix would leave it matching nothing
    // (feature-staging.yml imports two scripts as `./cat-harness-tools/...`).
    const p = m[1]!.replace(/^(\.\/)+/, "");
    if (p.startsWith(".github/")) continue; // the workflow's own file
    if (existsSync(join(root, p))) out.add(p);
  }
  return [...out].sort();
}

/**
 * Does a GitHub `paths:` pattern match this repo-relative file?
 *
 * Only the three forms this repository's workflows actually use are
 * implemented — `dir/**`, `dir/*.ext` and an exact path. An unrecognised
 * pattern is treated as MATCHING NOTHING, so a form this function cannot read
 * shows up as an uncovered script rather than as a silent pass.
 */
export function matches(pattern: string, file: string): boolean {
  if (pattern.endsWith("/**")) return file.startsWith(pattern.slice(0, -2));
  if (!pattern.includes("*")) return pattern === file;
  const rx = new RegExp("^" + pattern.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*") + "$");
  return rx.test(file);
}

export function assess(workflow: string, yaml: string, root: string): WorkflowReport {
  const invoked = invokedScripts(yaml, root);
  const blocks = pathsFilters(yaml);
  if (blocks.length === 0) return { workflow, verdict: "unfiltered", uncovered: [], invoked };
  if (invoked.length === 0) return { workflow, verdict: "no-scripts", uncovered: [], invoked };
  // Uncovered by ANY block, because each trigger gates on its own list: a
  // script the push block covers and the pull_request block does not is a
  // preview that never builds, which is the case a reviewer sees.
  const uncovered = invoked.filter((s) => blocks.some((patterns) => !patterns.some((p) => matches(p, s))));
  return { workflow, verdict: uncovered.length ? "uncovered" : "covered", uncovered, invoked };
}

export function sweep(dir: string, root: string): WorkflowReport[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort()
    .map((f) => assess(f, readFileSync(join(dir, f), "utf-8"), root));
}

if (import.meta.main) {
  if (!existsSync(WORKFLOW_DIR)) {
    console.error(`✗ no workflow directory at ${relative(ROOT, WORKFLOW_DIR)} — nothing could be checked`);
    process.exit(2);
  }
  const reports = sweep(WORKFLOW_DIR, ROOT);
  if (reports.length === 0) {
    console.error("✗ no workflows found — this check swept nothing and is not a pass");
    process.exit(2);
  }

  console.log(`Workflow script paths (${reports.length} workflow(s))\n`);
  const filtered = reports.filter((r) => r.verdict === "covered" || r.verdict === "uncovered");
  for (const r of filtered) {
    const mark = r.verdict === "covered" ? "✓" : "✗";
    console.log(`  ${mark} ${r.workflow}  (${r.invoked.length} script(s) invoked)`);
    for (const u of r.uncovered) console.log(`      ✗ ${u} — runs here, but no paths pattern matches it`);
  }

  const unfiltered = reports.filter((r) => r.verdict === "unfiltered").length;
  const noScripts = reports.filter((r) => r.verdict === "no-scripts").length;
  console.log(
    `\n  ${unfiltered} workflow(s) declare no paths filter — they run on every push, so there is nothing to under-cover.` +
      `\n  ${noScripts} path-filtered workflow(s) invoke no repo script.`,
  );

  const bad = filtered.filter((r) => r.verdict === "uncovered");
  if (bad.length) {
    console.error(
      `\n✗ ${bad.length} workflow(s) would not rebuild when a script they RUN changes.` +
        `\n  Cover the directory rather than naming each script: a named list is what drifted (bean \`tyyc\`).`,
    );
    process.exit(1);
  }
  console.log("\n✓ every path-filtered workflow rebuilds when the scripts it runs change");
}

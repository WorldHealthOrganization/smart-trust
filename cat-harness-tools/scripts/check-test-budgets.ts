/**
 * Which tests are closest to a timeout budget they never declared.
 *
 * The population is tests that are **expensive AND silently inherit bun's
 * 5000 ms default**. A test that passes an explicit budget (a third argument,
 * read from the AST, never evaluated) is reported as `declared` and given no
 * share.
 *
 * The share is a **ranking of exposure, not a prediction**: junit's `time`
 * includes work the timeout does not count, so a share over 100 % does not
 * mean the test will fail.
 *
 * It writes no sidecar: a timing is a fact about the machine, not the
 * repository. It is a report, not a pass/fail gate.
 *
 * Exit codes: **0** when a report was produced, **2** when it could not be — a
 * missing report, zero cases, or source that would not parse. Never 1.
 *
 * Usage:
 *   bun test --reporter=junit --reporter-outfile=/tmp/junit.xml
 *   bun run cat check:test-budgets /tmp/junit.xml
 *
 * @covers none — its subject is a test run's timings, which no declared graph holds
 * @graphNode tool
 */
import { HARNESS_ROOT } from "./lib/roots.ts";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import ts from "typescript";

const INSTANCE_ROOT = HARNESS_ROOT;
const REPO_ROOT = resolve(INSTANCE_ROOT, "..");

/** bun's default per-test timeout. Only ever applied to a test that declares none. */
export const DEFAULT_BUDGET_MS = 5000;

/** The bands reported, as a share of `DEFAULT_BUDGET_MS`. */
export const BANDS = [1.0, 0.8, 0.6, 0.5, 0.4, 0.2] as const;

export interface Observed {
  /** Repo-relative path, as the report gives it. */
  file: string;
  /** 1-indexed line the runner attributed the case to. */
  line: number;
  name: string;
  /** Milliseconds this case took ON THE RUN THAT PRODUCED THE REPORT. */
  costMs: number;
  /** True when the source declares a budget, so no share is computed. */
  declared: boolean;
  /** `costMs / DEFAULT_BUDGET_MS`, or undefined when `declared`. */
  share?: number;
}

export interface Report {
  /** Cases read. Zero is exit 2, never a clean run. */
  cases: number;
  /** Cases whose source declares a budget. */
  declared: number;
  /** Files whose source could not be read or parsed — reported, never ignored. */
  unreadable: string[];
  /** Count of DEFAULT-budget cases at or above each band. */
  bands: Array<{ share: number; count: number }>;
  /** Default-budget cases, worst share first. */
  worst: Observed[];
  /** The run's own wall clock, so a reader can see how loaded it was. */
  suiteSeconds?: number;
}

/**
 * Line ranges of `test(...)` / `it(...)` calls that pass a third argument.
 *
 * Returns ranges rather than single lines because the runner attributes a case to
 * the line of the call or of its name, and a `test(` spanning thirty lines makes
 * those different — `declared-directory-resolves.test.ts` is exactly that shape, so
 * matching on an exact line would have missed the one test this tool most needs to
 * classify correctly.
 */
export function declaredBudgetRanges(source: string, fileName: string): Array<[number, number]> {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.ESNext, true);
  const ranges: Array<[number, number]> = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      // `test(...)`, `it(...)`, and the modifier forms `test.only(...)` etc.
      const name = ts.isPropertyAccessExpression(callee)
        ? ts.isIdentifier(callee.expression)
          ? callee.expression.text
          : undefined
        : ts.isIdentifier(callee)
          ? callee.text
          : undefined;
      if ((name === "test" || name === "it") && node.arguments.length >= 3) {
        const start = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        const end = sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
        ranges.push([start, end]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return ranges;
}

/** Every `<testcase>` in a junit document, with the attributes this tool needs. */
export function testcases(xml: string): Array<{ file: string; line: number; name: string; costMs: number }> {
  const out: Array<{ file: string; line: number; name: string; costMs: number }> = [];
  for (const m of xml.matchAll(/<testcase\b([^>]*)\/?>/g)) {
    const attrs = m[1]!;
    const get = (k: string): string | undefined => {
      const a = new RegExp(`\\b${k}="([^"]*)"`).exec(attrs);
      return a ? a[1] : undefined;
    };
    const file = get("file");
    const time = get("time");
    if (file === undefined || time === undefined) continue;
    const secs = Number(time);
    if (!Number.isFinite(secs)) continue;
    out.push({
      file,
      line: Number(get("line") ?? "0"),
      name: get("name") ?? "(unnamed)",
      costMs: secs * 1000,
    });
  }
  return out;
}

/** Judge a junit document against the sources it names. */
export function budgets(xml: string, repoRoot: string, worstN = 20): Report {
  const cases = testcases(xml);
  const suite = /<testsuites\b[^>]*\btime="([\d.]+)"/.exec(xml);

  const rangesByFile = new Map<string, Array<[number, number]> | null>();
  const unreadable: string[] = [];

  const rangesFor = (file: string): Array<[number, number]> | null => {
    if (rangesByFile.has(file)) return rangesByFile.get(file)!;
    let ranges: Array<[number, number]> | null = null;
    const abs = join(repoRoot, file);
    if (existsSync(abs)) {
      try {
        ranges = declaredBudgetRanges(readFileSync(abs, "utf-8"), file);
      } catch {
        ranges = null;
      }
    }
    if (ranges === null) unreadable.push(file);
    rangesByFile.set(file, ranges);
    return ranges;
  };

  const observed: Observed[] = cases.map((c) => {
    const ranges = rangesFor(c.file);
    // An unreadable source is NOT "declares no budget": that would invent a share
    // for a test whose budget is unknown. It is reported in `unreadable` and given
    // no share, the same treatment as a declared one.
    const declared = ranges === null || ranges.some(([a, b]) => c.line >= a && c.line <= b);
    return {
      file: c.file,
      line: c.line,
      name: c.name,
      costMs: c.costMs,
      declared,
      share: declared ? undefined : c.costMs / DEFAULT_BUDGET_MS,
    };
  });

  const defaulted = observed.filter((o) => !o.declared);
  return {
    cases: observed.length,
    declared: observed.length - defaulted.length,
    unreadable: [...new Set(unreadable)],
    bands: BANDS.map((share) => ({
      share,
      count: defaulted.filter((o) => (o.share ?? 0) >= share).length,
    })),
    worst: defaulted.sort((a, b) => (b.share ?? 0) - (a.share ?? 0)).slice(0, worstN),
    suiteSeconds: suite ? Number(suite[1]) : undefined,
  };
}

export function format(r: Report): string {
  const lines: string[] = [];
  lines.push(
    `Test budgets — ${r.cases} case(s), ${r.declared} declaring their own budget, ` +
      `${r.cases - r.declared} on the ${DEFAULT_BUDGET_MS} ms default` +
      (r.suiteSeconds === undefined ? "" : `; suite wall clock ${r.suiteSeconds.toFixed(1)} s`),
  );
  lines.push("");
  lines.push("  Default-budget cases by share of budget, ON THIS RUN'S MACHINE:");
  for (const b of r.bands) {
    lines.push(`    >= ${String(Math.round(b.share * DEFAULT_BUDGET_MS)).padStart(5)} ms ` +
      `(${String(Math.round(b.share * 100)).padStart(3)} %): ${String(b.count).padStart(4)}`);
  }
  if (r.worst.length > 0) {
    lines.push("");
    lines.push("  Closest to a budget they never declared:");
    for (const o of r.worst) {
      lines.push(
        `    ${(o.costMs / 1000).toFixed(2).padStart(7)} s  ` +
          `${String(Math.round((o.share ?? 0) * 100)).padStart(4)} %  ` +
          `${o.file}:${o.line}  ${o.name.slice(0, 60)}`,
      );
    }
  }
  if (r.unreadable.length > 0) {
    lines.push("");
    lines.push(
      `  ${r.unreadable.length} file(s) could not be read, so their cases are reported as ` +
        "`declared` rather than given a share — an unknown budget is not a default one:",
    );
    for (const f of r.unreadable) lines.push(`    ${f}`);
  }
  lines.push("");
  lines.push(
    "  Timings are a fact about the MACHINE, not the repository, so nothing here is " +
      "committed and nothing here is a defect.",
  );
  lines.push(
    "  A share is a RANKING OF EXPOSURE, not a prediction: junit's `time` includes " +
      "work the timeout does not charge, and a default-budget case measured at 5.22 s " +
      "PASSED in a run that timed out three others. Read the order, not the threshold.",
  );
  return lines.join("\n");
}

if (import.meta.main) {
  const arg = process.argv[2];
  if (arg === undefined) {
    console.error(
      "Test budgets — no junit report given, so nothing was measured.\n\n" +
        "  bun test --reporter=junit --reporter-outfile=/tmp/junit.xml\n" +
        "  bun run cat check:test-budgets /tmp/junit.xml\n\n" +
        "Exit 2: could not determine, which is not the same as clean.",
    );
    process.exit(2);
  }
  if (!existsSync(arg)) {
    console.error(`Test budgets — no report at ${arg}. Exit 2: could not determine.`);
    process.exit(2);
  }

  let report: Report;
  try {
    report = budgets(readFileSync(arg, "utf-8"), REPO_ROOT);
  } catch (e) {
    console.error(`Test budgets — ${arg} would not parse as junit: ${String(e)}. Exit 2.`);
    process.exit(2);
  }

  if (report.cases === 0) {
    console.error(
      `Test budgets — ${arg} holds 0 test cases. Refusing to call that clean: a sweep ` +
        "over no subjects asserts nothing (bean `6tkl`). Exit 2.",
    );
    process.exit(2);
  }

  console.log(format(report));
}

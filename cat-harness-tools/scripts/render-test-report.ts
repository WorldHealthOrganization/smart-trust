/**
 * Render a `test-report/v1` as a page a person reads, with a badge that links
 * to the run it came from.
 *
 * Written beside the report, in the same `tests/<plan>/<sut>/<run>/`
 * directory of the `qa` working copy, so `qa:publish` records the page, the
 * badge and the two records together on `qa-reports` and every relative link
 * keeps working there.
 *
 * ## What the badge says, and what it refuses to say
 *
 * The badge reads `testReportVerdict` — the schema's own three states — and
 * nothing else: `ok`, `finding` or `unknown`. A `running` report is `unknown`,
 * never a pass. It never shows a total across plans, because a report has no
 * field for one.
 *
 * Measurements a run records in its `outcome` (precision, recall …) are shown
 * as RECORDED numbers. Whether any threshold applies is the plan's exit DMN's
 * business, and the page says which DMN that is rather than grading here.
 *
 * @module scripts/render-test-report
 */
import type { TestRun } from "../schemas/sdlc/test-run.ts";
import { currentVerdicts, testReportVerdict, type TestReport } from "../schemas/sdlc/test-report.ts";

const COLOUR: Record<ReturnType<typeof testReportVerdict>, string> = { ok: "#2e7d32", finding: "#c62828", unknown: "#6d6d6d" };
const WORD: Record<ReturnType<typeof testReportVerdict>, string> = { ok: "passed", finding: "findings", unknown: "could not determine" };

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A flat two-part badge. Widths are estimated per character — legible, not pixel-exact. */
export function testReportBadge(report: TestReport): string {
  const v = testReportVerdict(report);
  const left = `${report.plan.id} v${report.plan.version}`;
  const right = WORD[v];
  const w = (t: string) => 10 + t.length * 6.5;
  const lw = Math.round(w(left));
  const rw = Math.round(w(right));
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + rw}" height="20" role="img" aria-label="${esc(`${left}: ${right}`)}">`,
    `<title>${esc(`${left}: ${right} — run ${report.run.id}`)}</title>`,
    `<rect width="${lw}" height="20" fill="#555"/>`,
    `<rect x="${lw}" width="${rw}" height="20" fill="${COLOUR[v]}"/>`,
    `<g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">`,
    `<text x="5" y="14">${esc(left)}</text>`,
    `<text x="${lw + 5}" y="14">${esc(right)}</text>`,
    `</g></svg>`,
    ``,
  ].join("\n");
}

/**
 * The page. `runHref` and `badgeHref` are relative to the page — the defaults
 * are the sibling files the runner writes.
 */
export function renderTestReport(
  report: TestReport,
  run: TestRun | undefined,
  opts: { runHref?: string; badgeHref?: string; exitDecision?: string } = {},
): string {
  const runHref = opts.runHref ?? "test-run.json";
  const badgeHref = opts.badgeHref ?? "badge.svg";
  const v = testReportVerdict(report);
  const lines: string[] = [];
  lines.push(`# Test report — \`${report.plan.id}\` v${report.plan.version}`);
  lines.push("");
  lines.push(`[![${WORD[v]}](${badgeHref})](${runHref})`);
  lines.push("");
  lines.push("| | |");
  lines.push("|---|---|");
  lines.push(`| system under test | \`${report.sut.actor}\` v${report.sut.version} (reach: ${report.sut.reach}) |`);
  lines.push(`| run | [\`${report.run.id}\`](${runHref}) — data \`${report.run.data}\`, process \`${report.run.process}\` |`);
  lines.push(`| status | ${report.status}${report.completed_at ? `, completed ${report.completed_at}` : ""} (started ${report.started_at}) |`);
  lines.push(`| verdict | **${WORD[v]}** |`);
  if (opts.exitDecision) lines.push(`| certification rule | \`${opts.exitDecision}\` |`);
  lines.push("");
  lines.push(
    `**Cases:** ${report.rollup.pass} pass · ${report.rollup.warn} warn · ${report.rollup.fail} fail · ` +
      `${report.rollup["n/a"]} n/a · ${report.rollup.skipped} skipped — for this one plan; there is no total across plans.`,
  );
  lines.push("");
  const outcome = run?.outcome;
  if (outcome && Object.keys(outcome).length > 0) {
    lines.push("## Recorded measurements");
    lines.push("");
    lines.push("Recorded by the run, not graded here: whether a number must reach a threshold is the plan's certification rule.");
    lines.push("");
    lines.push("| measure | value |");
    lines.push("|---|---|");
    for (const [k, val] of Object.entries(outcome)) lines.push(`| ${esc(k)} | ${esc(String(val))} |`);
    lines.push("");
  }
  const current = currentVerdicts(report.cases);
  const notPass = Object.entries(current).filter(([, c]) => c.result !== "pass");
  if (notPass.length > 0) {
    lines.push("## Cases that did not simply pass");
    lines.push("");
    lines.push("| case | result | evidence |");
    lines.push("|---|---|---|");
    for (const [id, c] of notPass) {
      const ev = typeof c.evidence === "string" ? c.evidence : c.reason ?? "";
      lines.push(`| \`${id}\` | ${c.result} | ${esc(ev).replace(/[\\|]/g, "\\$&")} |`);
    }
    lines.push("");
  }
  lines.push(`<details><summary>All ${Object.keys(current).length} cases</summary>`);
  lines.push("");
  lines.push("| case | result | reviewer |");
  lines.push("|---|---|---|");
  for (const [id, c] of Object.entries(current)) lines.push(`| \`${id}\` | ${c.result} | ${esc(c.reviewer.id)} |`);
  lines.push("");
  lines.push("</details>");
  lines.push("");
  return lines.join("\n");
}

#!/usr/bin/env bun
/**
 * ISSUES ARE A THIRD TODO SOURCE: audit beans that owe an issue link.
 *
 * `beans/` (agent work plan) and `todos/` (human items and feedback) are the
 * two declared local stores. GitHub issues are a THIRD source carrying human
 * and stakeholder adjudication, external tracking, and cross-team visibility.
 *
 * Beans representing substantive roadmap items (specifically `type: feature`),
 * or beans explicitly requiring stakeholder adjudication (e.g. `issue-required`
 * or `needs-issue` tags, or adjudication requirements in body), OWE an issue link.
 *
 * That link can be satisfied in two ways:
 * 1. Queryably in front matter via `issue: <number | string>`
 * 2. Referenced in the bean's body (e.g. `#123`, `issue #123`, or issue URL)
 *
 * ## Three-state reporting
 * - 0 = pass (all beans that owe an issue are compliant, or no store)
 * - 1 = finding (one or more beans owe an issue but lack any issue link)
 * - 2 = could not determine (store is unreachable / threw an error)
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/check-bean-issues.ts
 *   bun run cat-harness-tools/scripts/check-bean-issues.ts --json
 *
 * @module scripts/check-bean-issues
 * @covers bean-defs, beans
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beanDefsDir, isOpen, readBeans, type BeanNode } from "./beans.ts";
import { exitIfBeanStoreAbsent } from "./lib/bean-store-absent.ts";

export { beanDefsDir };

/** Baseline file for legacy beans with accepted missing issue links. */
export const BASELINE_FILE = "cat-harness-tools/scripts/bean-issues-baseline.json";

export interface IssueResolution {
  source: "frontmatter" | "body";
  issue: number | string;
}

export interface CompliantBean {
  id: string;
  title: string;
  type: string;
  source: "frontmatter" | "body";
  issue: number | string;
}

export interface BeanIssueProblem {
  id: string;
  title: string;
  type: string;
  file: string;
  reason: string;
  message: string;
}

export interface BeanIssuesReport {
  store: string | null;
  totalOwed: number;
  compliant: CompliantBean[];
  details: BeanIssueProblem[];
  problems: string[];
  outstanding: string[];
  stale: string[];
}

export interface CheckBeanIssuesOptions {
  openOnly?: boolean;
}

/**
 * Determine whether a bean owes an issue link.
 *
 * Features (`type: feature`) represent user-facing capabilities or major roadmap
 * items that owe stakeholder/human adjudication. Beans with explicit issue
 * requirements (tags or body declarations) also owe an issue link.
 */
export function owesIssue(b: BeanNode, opts: CheckBeanIssuesOptions = {}): { owes: boolean; reason: string } {
  if (opts.openOnly && !isOpen(b)) return { owes: false, reason: "closed bean" };
  if (b.type === "feature") return { owes: true, reason: 'type is "feature"' };
  if (b.tags?.some((t) => /^(?:issue-required|needs-issue|requires-issue)$/i.test(t))) {
    return { owes: true, reason: "tagged as requiring an issue" };
  }
  if (/\b(?:adjudication\s+required|stakeholder\s+adjudication|issue\s+required|needs\s+issue|requires\s+issue)\b/i.test(b.body)) {
    return { owes: true, reason: "body declares stakeholder adjudication or issue required" };
  }
  return { owes: false, reason: "" };
}

/**
 * Extract an issue reference from markdown prose if present.
 */
export function extractIssueFromBody(body: string): string | undefined {
  if (!body) return undefined;
  // Full GitHub issue URL
  const urlMatch = /https?:\/\/[^\s)]+\/issues\/(\d+)/i.exec(body);
  if (urlMatch) return urlMatch[0];

  // "issue #730", "issue 730", "Issue #730"
  const issueMatch = /\bissue\s*#?(\d+)\b/i.exec(body);
  if (issueMatch) return `#${issueMatch[1]}`;

  // "gh-730"
  const ghMatch = /\bgh-(\d+)\b/i.exec(body);
  if (ghMatch) return `#${ghMatch[1]}`;

  // Standalone "#730" (distinguish from markdown headings "# Heading")
  const hashMatch = /(?:^|[\s(])#(\d+)\b/.exec(body);
  if (hashMatch) return `#${hashMatch[1]}`;

  return undefined;
}

/**
 * Resolve an issue link from front matter or body.
 */
export function resolveIssue(b: BeanNode): IssueResolution | undefined {
  if (b.issue !== undefined && String(b.issue).trim() !== "") {
    return {
      source: "frontmatter",
      issue: b.issue,
    };
  }
  const bodyIssue = extractIssueFromBody(b.body);
  if (bodyIssue !== undefined) {
    return {
      source: "body",
      issue: bodyIssue,
    };
  }
  return undefined;
}

const key = (id: string): string => `missing-issue:${id}`;

function loadBaseline(root: string): Set<string> {
  const candidate1 = resolve(root, BASELINE_FILE);
  const candidate2 = resolve(root, "scripts/bean-issues-baseline.json");
  const f = existsSync(candidate1) ? candidate1 : (existsSync(candidate2) ? candidate2 : candidate1);
  if (!existsSync(f)) return new Set();
  try {
    const raw: unknown = JSON.parse(readFileSync(f, "utf-8"));
    const entries = (raw as { outstanding?: unknown }).outstanding;
    return new Set(Array.isArray(entries) ? entries.filter((e): e is string => typeof e === "string") : []);
  } catch {
    return new Set();
  }
}

/**
 * Run the audit check over bean issue links.
 */
export function checkBeanIssues(root: string, opts: CheckBeanIssuesOptions = {}): BeanIssuesReport {
  const beans = readBeans(root);
  if (beans === null) {
    return {
      store: null,
      totalOwed: 0,
      compliant: [],
      details: [],
      problems: [],
      outstanding: [],
      stale: [],
    };
  }

  const compliant: CompliantBean[] = [];
  const details: BeanIssueProblem[] = [];
  const found: { key: string; message: string }[] = [];

  for (const b of beans.sort((a, c) => a.id.localeCompare(c.id))) {
    const { owes, reason } = owesIssue(b, opts);
    if (!owes) continue;

    const link = resolveIssue(b);
    if (link) {
      compliant.push({
        id: b.id,
        title: b.title,
        type: b.type,
        source: link.source,
        issue: link.issue,
      });
    } else {
      const where = `${b.id} (${b.title.slice(0, 60)})`;
      const message = `${where}: owes an issue (${reason}) but specifies neither front-matter \`issue:\` nor body issue reference`;
      details.push({
        id: b.id,
        title: b.title,
        type: b.type,
        file: b.file,
        reason,
        message,
      });
      found.push({
        key: key(b.id),
        message,
      });
    }
  }

  const baseline = loadBaseline(root);
  const matched = new Set(found.map((f) => f.key).filter((k) => baseline.has(k)));

  return {
    store: beanDefsDir(root),
    totalOwed: compliant.length + details.length,
    compliant,
    details,
    problems: found.filter((f) => !baseline.has(f.key)).map((f) => f.message),
    outstanding: found.filter((f) => baseline.has(f.key)).map((f) => f.message),
    stale: [...baseline].filter((k) => !matched.has(k)).sort(),
  };
}

/**
 * Format the report for console output.
 */
export function formatReport(r: BeanIssuesReport): string {
  if (r.store === null) return "Bean issues\n  · no bean store — nothing to check";
  const out = [`Bean issues (${r.totalOwed} beans owing an issue)`];
  if (r.problems.length === 0) {
    out.push(
      r.outstanding.length
        ? `  ✓ every bean owing an issue is linked to an issue — ${r.outstanding.length} baselined defect(s) below`
        : "  ✓ every bean owing an issue is linked to an issue (in front matter or body)",
    );
  } else {
    for (const p of r.problems) out.push(`  ✗ ${p}`);
    out.push("");
    out.push("  Add `issue: <number|string>` in the bean's front matter, or reference the issue in the body.");
    out.push("  Features and work requiring human adjudication owe an issue link (work-plan/skills/work-plan/bean-coordination.md).");
  }
  for (const o of r.outstanding) out.push(`  · outstanding (baselined): ${o}`);
  for (const k of r.stale) out.push(`  ✗ baseline entry \`${k}\` matches nothing — remove it from ${BASELINE_FILE}`);
  if (r.compliant.length > 0) {
    out.push("");
    out.push(`  Compliant beans (${r.compliant.length}):`);
    for (const c of r.compliant) {
      out.push(`    · ${c.id}: ${c.issue} (from ${c.source})`);
    }
  }
  return out.join("\n");
}

if (import.meta.main) {
  let report: BeanIssuesReport;
  try {
    report = checkBeanIssues(resolve("."), {
      openOnly: process.argv.includes("--open-only"),
    });
  } catch (e) {
    exitIfBeanStoreAbsent("check:bean-issues", e);
    console.error(`Could not check bean issues: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT a pass. Treat it as unknown.");
    process.exit(2);
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exit(report.problems.length || report.stale.length ? 1 : 0);
}

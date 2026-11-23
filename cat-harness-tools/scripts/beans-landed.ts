#!/usr/bin/env bun
/**
 * Open beans whose work has already merged — REPORTED, never closed.
 *
 * Usage:
 *   bun run cat beans:landed          # strong findings, then a count of the rest
 *   bun run cat beans:landed --all    # every finding
 *   bun run cat beans:landed --days 60
 *
 * When an agent commits a bean's completion after its PR merged and then
 * re-branches from the new `main`, the completion commit is orphaned and the
 * bean still reads open. The rule that prevents it is in
 * `work-plan/skills/work-plan/bean-coordination.md` §"Complete it in the PR's own
 * last commit". This reports what slips through.
 *
 * ## The signal, ranked rather than listed
 *
 * A merged PR's title names its bean by convention (`gpdo: …`), and GitHub
 * puts the title in the merge commit: as the subject when the merge is titled,
 * as the first body line when it is the default "Merge pull request #N from
 * …". So an OPEN bean named there may be finished and unrecorded. Epics are
 * excluded: many PRs name them and they stay open by design. The rest rank:
 *
 * - `done-ticked`: every `## Done when` box ticked, status still open — the
 *   orphan shape itself, listed first.
 * - `partly-ticked`: some boxes open; often a PR that legitimately did part
 *   of the work.
 * - `no-checklist`: nothing to read either way.
 *
 * ## Could not determine
 *
 * With no merge commits visible in the window (e.g. a shallow clone), the run
 * says it could not determine anything rather than reporting clean.
 *
 * It closes nothing. `bean-coordination.md` §"Closing a bean whose work has
 * already landed": a bean closes on evidence you re-derive, never on a report.
 *
 * @module scripts/beans-landed
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { listBeans } from "./beans-fallback.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { dirname } from "node:path";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

const REPO = resolve(dirname(HARNESS_ROOT));

export interface OpenBean {
  id: string;
  short: string;
  title: string;
  status: string;
  type: string;
  ticked: number;
  unticked: number;
}

export type Tier = "done-ticked" | "partly-ticked" | "no-checklist";

export interface Finding {
  bean: OpenBean;
  tier: Tier;
  /** The merge commit that named it, and the line it was named in. */
  merge: { sha: string; line: string };
}

const OPEN = new Set(["todo", "in-progress", "draft"]);
const TIER_ORDER: Tier[] = ["done-ticked", "partly-ticked", "no-checklist"];

/**
 * Ticked and unticked boxes in a bean body's `## Done when` section only.
 * Boxes elsewhere in the body are notes, not the bean's contract.
 */
export function doneWhen(body: string): { ticked: number; unticked: number } {
  const dw = body.split(/^## Done when\s*$/m)[1]?.split(/^## /m)[0] ?? "";
  return {
    ticked: (dw.match(/^\s*- \[x\]/gim) ?? []).length,
    unticked: (dw.match(/^\s*- \[ \]/gm) ?? []).length,
  };
}

/**
 * Open, non-epic beans, read through `beans-fallback`'s `listBeans`, which
 * resolves the store from its declaration rather than a literal path.
 */
export function openBeans(root = REPO): OpenBean[] {
  return listBeans(root)
    .filter((b) => OPEN.has(b.status) && b.type !== "epic")
    .map((b) => ({
      id: b.id,
      short: b.id.split("-").pop()!,
      title: b.title,
      status: b.status,
      type: b.type,
      ...doneWhen(b.body),
    }));
}

export interface Merge {
  sha: string;
  subject: string;
  firstBodyLine: string;
}

/** Merge commits on `ref` in the window, or undefined when git cannot say. */
export function merges(ref = "origin/main", days = 30, repo = REPO): Merge[] | undefined {
  let log: string;
  try {
    // input-site: traced #f2b6df11 — merges on a ref within the last N days: the ref and the clock, which no fingerprint names, so a run that reaches it records no hash
    inputSiteReached("beans-landed: merges in the window");
    log = execFileSync("git", ["log", ref, "--merges", `--since=${days} days ago`, "--format=%H%x00%s%x00%b%x01"], {
      cwd: repo,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return undefined;
  }
  return log
    .split("\x01")
    .filter((m) => m.trim())
    .map((m) => {
      const [sha, subject, body] = m.replace(/^\n/, "").split("\x00");
      return { sha, subject, firstBodyLine: (body ?? "").trim().split("\n")[0] ?? "" };
    });
}

const tierOf = (b: OpenBean): Tier =>
  b.ticked === 0 && b.unticked === 0 ? "no-checklist" : b.unticked === 0 ? "done-ticked" : "partly-ticked";

/** Each open bean named in a merge's subject or first body line, once, by its most recent merge. */
export function findings(beans: readonly OpenBean[], ms: readonly Merge[]): Finding[] {
  const out: Finding[] = [];
  for (const bean of beans) {
    const pat = new RegExp(`(?<![A-Za-z0-9-])${bean.short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9-])`);
    for (const m of ms) {
      const line = pat.test(m.subject) ? m.subject : pat.test(m.firstBodyLine) ? m.firstBodyLine : undefined;
      if (line) {
        out.push({ bean, tier: tierOf(bean), merge: { sha: m.sha, line } });
        break;
      }
    }
  }
  return out.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
}

if (import.meta.main) {
  const days = process.argv.includes("--days") ? Number(process.argv[process.argv.indexOf("--days") + 1]) : 30;
  const ms = merges("origin/main", days) ?? merges("HEAD", days);
  if (!ms || ms.length === 0) {
    console.log(
      `beans:landed — COULD NOT DETERMINE: no merge commits visible in the last ${days} days ` +
        `(a shallow clone, or no origin/main). This is not a clean result.`,
    );
    process.exit(0);
  }
  const fs = findings(openBeans(), ms);
  const by = (t: Tier) => fs.filter((f) => f.tier === t);
  console.log(`\nbeans:landed — open, non-epic beans named in a merged PR title (last ${days} days, ${ms.length} merges)\n`);
  console.log(`  done-ticked ${by("done-ticked").length} · partly-ticked ${by("partly-ticked").length} · no-checklist ${by("no-checklist").length}`);
  console.log(`  REPORTED ONLY. Close a bean on evidence you re-derive (bean-coordination.md), never on this list.\n`);
  const show = process.argv.includes("--all") ? fs : by("done-ticked");
  for (const f of show) {
    console.log(`  ${f.tier.padEnd(13)} ${f.bean.short}  [${f.bean.status}] ${f.bean.title.slice(0, 70)}`);
    console.log(`                named by ${f.merge.sha.slice(0, 8)}: ${f.merge.line.slice(0, 90)}`);
  }
  if (!process.argv.includes("--all") && fs.length > show.length) {
    console.log(`\n  …and ${fs.length - show.length} partly-ticked or no-checklist (--all lists them)`);
  }
  console.log("");
}

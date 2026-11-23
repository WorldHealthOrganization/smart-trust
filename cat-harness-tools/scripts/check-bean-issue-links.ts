#!/usr/bin/env bun
/**
 * A bean and its issue reach each other — in BOTH directions, where that is
 * checkable from a checkout.
 *
 * | direction | source | verdict |
 * |---|---|---|
 * | bean → issue | the bean's own body | **checked** — every reference is extracted and listed |
 * | issue → bean, for a TRACKED issue | `issue-marks/` | **checked** — a tracked issue no open bean names is a finding |
 * | issue → bean, in general | GitHub | **could not determine** — needs the API, and a checkout is not it |
 *
 * The third row is printed every run, named, with what would settle it, so
 * the first two are never read as a verdict on every issue
 * (`could-not-determine-is-a-third-state-everywhere`).
 *
 * `issue-marks/` holds an id and two timestamps for each issue some session
 * chose to track; such an issue is one the work plan has engaged with, so
 * "no bean names it" is a defect rather than an absence.
 *
 * Exit: 0 clean or nothing to check, 1 a tracked issue no bean names, 2 unknown.
 *
 * @module folio-assistant/scripts/check-bean-issue-links
 * @covers bean-defs, beans
 */

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { OPEN_STATUSES, readBeanFiles } from "./bean-store-read.ts";
import { corpusDirectoriesForGraph } from "../schemas/kg/harness-config.js";
// The HARNESS, not this layer: these scripts moved up in 70lx B2b and read cat-harness.
import { HARNESS_ROOT } from "./lib/roots.ts";
import { exitIfBeanStoreAbsent } from "./lib/bean-store-absent.ts";

/** The LAYER root — this file lives at `<instance>/scripts/`. */
export const INSTANCE_ROOT = HARNESS_ROOT;
/**
 * The REPOSITORY root, which is where the bean store is.
 *
 * The two parted company when `#437` moved this layer under `cat-harness/`,
 * and they are needed for different questions here: `directoriesForGraph`
 * resolves a declaration from the LAYER, while `beans/` is repository-scoped
 * and sits a level up. Reading beans from the layer root returns `null` —
 * "no store" — which is a clean-looking answer to a question that was asked in
 * the wrong place, and it is what the first draft of this module did.
 */
export const REPO_ROOT = repoRootFor(INSTANCE_ROOT);

/** `#123`, `issues/123`, or a full issue URL. Repo-qualified refs are kept whole. */
const ISSUE_REF = /(?:issues\/(\d{1,6}))|(?:(?<![\w/])#(\d{1,6})\b)/g;

/**
 * The issue → bean direction, asked of the forge.
 *
 * `state` is three-valued on purpose. `unknown` is what a missing token, a
 * rate limit or an unreachable API produces, and it is NEVER rendered as
 * clean: a check that answers "no orphans" because it could not ask has
 * asserted something about every issue in the repository on no evidence.
 * That is the `dh4f` shape, and this check's own prose warned about it while
 * the direction went unasked.
 */
export interface ReverseDirection {
  state: "checked" | "unknown";
  /** Open issues no open bean names. Empty when `unknown`. */
  orphans: { number: number; title: string }[];
  /** How many open issues were read. */
  read: number;
  /** Why it could not be asked. Set only when `unknown`. */
  because?: string;
}

export interface BeanIssueReport {
  /** Issue number → the open beans naming it. */
  forward: Record<string, string[]>;
  /** Tracked in `issue-marks/` and named by no open bean. */
  untracked: string[];
  /** How many issue marks were read, so a zero is legible. */
  marksRead: number;
  /** Always present: what this check structurally cannot see. */
  undetermined: string;
  /** The issue → bean direction. */
  reverse: ReverseDirection;
}

/** Issue numbers this repository tracks a read-mark for. */
export function markedIssues(root: string): string[] {
  const dirs = corpusDirectoriesForGraph(root, "issue-marks");
  const out: string[] = [];
  for (const dir of dirs) {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      const n = JSON.parse(readFileSync(join(dir, name), "utf8")) as { issue?: string };
      const m = /#(\d+)\s*$/.exec(n.issue ?? "");
      if (m) out.push(m[1]!);
    }
  }
  return [...new Set(out)].sort((a, b) => Number(a) - Number(b));
}

/** `owner/repo` from the `origin` remote, or undefined when there is none. */
export function originSlug(): string | undefined {
  const url = spawnSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).stdout?.trim();
  const m = /github\.com[:/]([^/]+\/[^/.]+)/.exec(url ?? "");
  return m?.[1];
}

/**
 * Open issues, asked of GitHub.
 *
 * Pull requests are excluded: the REST issues endpoint returns them, and a PR
 * is not an issue a bean should be expected to name. Measured on this
 * repository, where the open PR count is a large fraction of the response.
 */
export async function fetchOpenIssues(): Promise<
  { issues: { number: number; title: string }[] } | { because: string }
> {
  const slug = originSlug();
  if (!slug) return { because: "no GitHub `origin` remote to ask about" };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const out: { number: number; title: string }[] = [];
  try {
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(
        `https://api.github.com/repos/${slug}/issues?state=open&per_page=100&page=${page}`,
        {
          headers: {
            accept: "application/vnd.github+json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          signal: AbortSignal.timeout(20_000),
        },
      );
      if (!res.ok) {
        return {
          because:
            `GitHub API returned ${res.status} for ${slug}` +
            (res.status === 404 && !token
              ? " — a private repo needs GITHUB_TOKEN or GH_TOKEN"
              : res.status === 403
                ? " — rate limited; set GITHUB_TOKEN to raise the limit"
                : ""),
        };
      }
      const body = (await res.json()) as { number: number; title: string; pull_request?: unknown }[];
      if (body.length === 0) break;
      for (const i of body) if (!i.pull_request) out.push({ number: i.number, title: i.title });
      if (body.length < 100) break;
    }
  } catch (e) {
    return { because: `could not reach the GitHub API: ${String(e).slice(0, 120)}` };
  }
  return { issues: out };
}

export function checkBeanIssueLinks(
  root: string = INSTANCE_ROOT,
  reverse?: ReverseDirection,
): BeanIssueReport {
  const undetermined =
    "issue → bean for every OTHER issue needs the GitHub API and is NOT checked here; " +
    "read this as unknown, never as clean.";
  const beans = readBeanFiles(REPO_ROOT);
  const forward: Record<string, string[]> = {};
  for (const b of (beans ?? []).filter((x) => !x.archived && OPEN_STATUSES.has(x.status))) {
    for (const m of b.body.matchAll(ISSUE_REF)) {
      const n = m[1] ?? m[2];
      if (!n) continue;
      (forward[n] ??= []).push(b.id);
    }
  }
  for (const k of Object.keys(forward)) forward[k] = [...new Set(forward[k]!)].sort();
  const marks = markedIssues(root);
  return {
    forward,
    untracked: marks.filter((n) => !forward[n]),
    marksRead: marks.length,
    undetermined,
    reverse: reverse ?? { state: "unknown", orphans: [], read: 0, because: "not asked" },
  };
}

/** Which open issues no open bean names. Pure: the caller does the asking. */
export function orphanIssues(
  forward: Record<string, string[]>,
  issues: { number: number; title: string }[],
): { number: number; title: string }[] {
  return issues.filter((i) => !forward[String(i.number)]);
}

function formatReport(r: BeanIssueReport): string {
  const linked = Object.keys(r.forward).length;
  const out = [`Bean ↔ issue links (${linked} issue(s) named by an open bean, ${r.marksRead} tracked)`];
  if (r.untracked.length === 0) {
    out.push("  ✓ every tracked issue is named by at least one open bean");
  } else {
    for (const n of r.untracked) {
      out.push(`  ✗ #${n} is tracked in \`issue-marks/\` and no open bean names it — the work plan cannot reach it`);
    }
    out.push("");
    out.push("  Name the issue in the bean that owns its subject, or open one. See");
    out.push("  sdlc/skills/sdlc-core/issue-working.md §\"When the work has a BEAN and no issue\".");
  }
  if (r.reverse.state === "unknown") {
    // NOT a pass. The direction was the whole of this bean's second
    // Done-when, and reporting silence as agreement is the defect the rest of
    // this repository's checks are built to refuse.
    out.push(`  ? issue → bean NOT checked — ${r.reverse.because}. Read as unknown, never as clean.`);
  } else if (r.reverse.orphans.length === 0) {
    out.push(`  ✓ every one of ${r.reverse.read} open issue(s) is named by an open bean`);
  } else {
    out.push(
      `  · ${r.reverse.orphans.length} of ${r.reverse.read} open issue(s) are named by no open bean —` +
        ` counted, not failed:`,
    );
    for (const o of r.reverse.orphans.slice(0, 10)) {
      out.push(`      #${o.number}  ${o.title.slice(0, 70)}`);
    }
    if (r.reverse.orphans.length > 10) {
      out.push(`      …and ${r.reverse.orphans.length - 10} more (\`--json\` lists them)`);
    }
    out.push("");
    out.push("  An issue with no bean is not automatically a defect — somebody else's issue,");
    out.push("  a question, a discussion. It IS the work plan not reaching it, which is what");
    out.push("  `oh78` asked to be able to see. Failing on it would make this check a demand");
    out.push("  that every issue in the repository become somebody's bean.");
  }
  return out.join("\n");
}

if (import.meta.main) {
  let report: BeanIssueReport;
  try {
    // The forward direction first, so the reverse one's failure cannot cost
    // the answer this check already had.
    const dry = checkBeanIssueLinks();
    const asked = process.argv.includes("--offline") ? { because: "--offline" } : await fetchOpenIssues();
    const reverse: ReverseDirection =
      "issues" in asked
        ? { state: "checked", orphans: orphanIssues(dry.forward, asked.issues), read: asked.issues.length }
        : { state: "unknown", orphans: [], read: 0, because: asked.because };
    report = checkBeanIssueLinks(INSTANCE_ROOT, reverse);
  } catch (e) {
    exitIfBeanStoreAbsent("check:bean-issue-links", e);
    console.error(`Could not check bean/issue links: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT a pass. Treat it as unknown.");
    process.exit(2);
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exit(report.untracked.length ? 1 : 0);
}

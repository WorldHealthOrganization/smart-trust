#!/usr/bin/env bun
/**
 * A bean's STATUS must agree with its own subtree — and the stale-claim sweep.
 *
 * ```sh
 * bun run cat check:bean-rollup            # the gate
 * bun run cat check:bean-rollup -- --sweep # + the claim-age report (never fails)
 * bun run cat check:bean-rollup -- --json
 * ```
 *
 * `in-progress` is the status every sibling session reads before deciding
 * whether a bean is free. An old `updated_at` does not make a claim stale:
 * nobody edits a milestone when a child moves, so a container's `updated_at`
 * measures EDITING, not liveness. And a bean with no children is a leaf
 * whatever its type, so {@link rollupFindings} requires `children.length > 0`
 * before it judges a container at all.
 *
 * ## What the GATE checks, and why it owns no clock
 *
 * Anything computed against the clock changes on every run and would turn CI
 * red with nobody having changed anything (the reason `beans.ts`
 * §`beanFindings` declines a stale-`in-progress` finding). So the gate is the
 * **pure graph** half: a bean's status against its children's.
 *
 * | rule | the contradiction |
 * |---|---|
 * | `open-container-closed-subtree` | open, has children, **none** open — it asserts live work its own subtree denies |
 * | `closed-container-open-subtree` | closed, and **some** child is open — the roadmap reads the area as finished |
 *
 * Existing contradictions whose resolution is the bean owner's judgement are
 * baselined.
 *
 * ## What `--sweep` reports, and what it refuses to conclude
 *
 * The sweep carries the clock, so it **never sets the exit code**. A leaf
 * claim is held by a session, a branch or a PR, none committed here, so
 * without `--github` the leaf buckets are one **unjudged** group:
 * could-not-check is never green, and never GUILTY either.
 *
 * `--github` (needs `GH_TOKEN`) asks the API for open PRs and splits the
 * leaves by whether one names the bean. That is a fact GitHub holds ABOUT this
 * repository rather than one the repository holds, so it is asked every run
 * and cached nowhere.
 *
 * ## What it does NOT claim
 *
 * A leaf with no open PR is a **candidate**, never a verdict: it may be real
 * work on an unpushed branch, in which case the answer is `bean-blocking`'s
 * four-field record (the form `check:bean-blocks` owns) rather than a
 * release. Nothing here changes a status or deletes a bean: unwanted work is
 * `scrapped`, with its reasons.
 *
 * @covers bean-defs, beans
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { beanDefsDir, isOpen, readBeans, type BeanNode } from "./beans.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";
import { exitIfBeanStoreAbsent } from "./lib/bean-store-absent.ts";

/** Where the accepted-for-now contradictions are recorded. */
export const BASELINE_FILE = "cat-harness-tools/scripts/bean-rollup-baseline.json";

/** Ages the sweep buckets by, in days. Reported, never failed on. */
const STALE_DAYS = 1;

export interface RollupFinding {
  /** `<rule>:<bean-id>` — stable across a title edit, because a title is prose. */
  key: string;
  kind: "open-container-closed-subtree" | "closed-container-open-subtree";
  bean: string;
  message: string;
}

export interface SweepBucket {
  /** `container-live`, `container-childless`, `leaf-open-pr`, `leaf-no-open-pr`, `leaf-unjudged`. */
  name: string;
  /** What `in-progress` asserts for the beans in here, in one line. */
  reading: string;
  beans: string[];
}

export interface BeanRollupReport {
  /** The store directory, or `null` when this layer declares none. */
  store: string | null;
  /** Open beans considered. */
  open: number;
  problems: string[];
  outstanding: string[];
  /** Baseline keys nothing matched — a repair that left its licence behind. */
  stale: string[];
  /** Present only with `--sweep`. Never contributes to the exit code. */
  sweep: {
    inProgress: number;
    untouchedDays: number;
    untouched: number;
    /** False when the leaf split could not be made — reported, not guessed. */
    githubConsulted: boolean;
    buckets: SweepBucket[];
  } | null;
}

/** Bean id → the ids naming it as `parent`. Built once; inverting it wrongly is silent. */
export function childrenOf(beans: BeanNode[]): Map<string, BeanNode[]> {
  const out = new Map<string, BeanNode[]>();
  for (const b of beans) {
    if (!b.parent) continue;
    const at = out.get(b.parent);
    if (at) at.push(b);
    else out.set(b.parent, [b]);
  }
  return out;
}

/**
 * The clock-free half: a status its own subtree refutes.
 *
 * **`children.length > 0` is the load-bearing guard**, not a micro-optimisation.
 * Without it "no open child" is true of every leaf in the store, and the first
 * pass of this sweep duly reported nine `feature` beans with no children at all
 * as containers whose work was done.
 */
export function rollupFindings(beans: BeanNode[]): RollupFinding[] {
  const kids = childrenOf(beans);
  const out: RollupFinding[] = [];
  for (const b of beans) {
    const children = kids.get(b.id) ?? [];
    if (children.length === 0) continue;
    const open = children.filter(isOpen);
    if (isOpen(b) && open.length === 0) {
      out.push({
        key: `open-container-closed-subtree:${b.id}`,
        kind: "open-container-closed-subtree",
        bean: b.id,
        message:
          `${b.id} (${b.title.slice(0, 60)}): \`${b.status}\` over ${children.length} ` +
          `child(ren), none of them open — it asserts live work its own subtree denies`,
      });
    }
    if (!isOpen(b) && open.length > 0) {
      out.push({
        key: `closed-container-open-subtree:${b.id}`,
        kind: "closed-container-open-subtree",
        bean: b.id,
        message:
          `${b.id} (${b.title.slice(0, 60)}): \`${b.status}\` with ${open.length} open ` +
          `child(ren) — the roadmap reads this area as finished while the work is not`,
      });
    }
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

function loadBaseline(root: string): Set<string> {
  const file = join(root, BASELINE_FILE);
  if (!existsSync(file)) return new Set();
  const entries = (JSON.parse(readFileSync(file, "utf-8")) as { outstanding?: unknown }).outstanding;
  return new Set(Array.isArray(entries) ? entries.filter((e): e is string => typeof e === "string") : []);
}

/** Days since a bean's `updated_at`, or `null` when it states none. */
export function ageDays(b: BeanNode, now: Date): number | null {
  if (!b.updatedAt) return null;
  const t = Date.parse(b.updatedAt);
  return Number.isNaN(t) ? null : (now.getTime() - t) / 86_400_000;
}

/**
 * The clock-carrying half. `openPrBeans` is `null` when GitHub was not asked —
 * which is reported as **unjudged**, never as a verdict either way.
 */
export function sweep(
  beans: BeanNode[],
  now: Date,
  openPrBeans: Set<string> | null,
): NonNullable<BeanRollupReport["sweep"]> {
  const kids = childrenOf(beans);
  const claims = beans.filter((b) => b.status === "in-progress");
  const untouched = claims.filter((b) => (ageDays(b, now) ?? 0) >= STALE_DAYS);
  const named = (b: BeanNode) => `${b.id.replace(/^folio-assistant-/, "")} (${(ageDays(b, now) ?? 0).toFixed(1)}d)`;

  const container: BeanNode[] = [];
  const childless: BeanNode[] = [];
  const leaves: BeanNode[] = [];
  for (const b of untouched) {
    const children = kids.get(b.id) ?? [];
    if (children.length === 0) leaves.push(b);
    else if (children.some(isOpen)) container.push(b);
    else childless.push(b);
  }

  const buckets: SweepBucket[] = [
    {
      name: "container-live",
      reading: "the claim is TRUE — an open child is carrying it; `updated_at` measures editing, not liveness",
      beans: container.map(named),
    },
    {
      name: "container-subtree-closed",
      reading: "every child is closed — the gate above fails on this, it is not a sweep matter",
      beans: childless.map(named),
    },
  ];
  if (openPrBeans === null) {
    buckets.push({
      name: "leaf-unjudged",
      reading:
        "no session, branch or PR is visible from the store, so liveness is UNJUDGED — " +
        "pass --github to split these; unjudged is not stale",
      beans: leaves.map(named),
    });
  } else {
    buckets.push(
      {
        name: "leaf-open-pr",
        reading: "an open PR names this bean — live work, mid-flight",
        beans: leaves.filter((b) => openPrBeans.has(b.id)).map(named),
      },
      {
        name: "leaf-no-open-pr",
        reading:
          "no open PR names it — a CANDIDATE for release, re-claim or a `## Blocked on` record, never a verdict",
        beans: leaves.filter((b) => !openPrBeans.has(b.id)).map(named),
      },
    );
  }
  return {
    inProgress: claims.length,
    untouchedDays: STALE_DAYS,
    untouched: untouched.length,
    githubConsulted: openPrBeans !== null,
    buckets,
  };
}

/**
 * Bean ids named by the title, body or branch of an open PR.
 *
 * Word-bounded on the short id, which is how every PR body here writes one.
 * Returns `null` on any failure — a network error is *unjudged*, and rendering
 * it as "no PR names this bean" would convict 42 beans of the API being down.
 */
export async function openPrBeanIds(beans: BeanNode[], token: string | undefined): Promise<Set<string> | null> {
  if (!token) return null;
  try {
    // input-site: traced #1cccf22c — GitHub's open PRs over the network: a run that asks records no hash
    inputSiteReached("check-bean-rollup: open PRs");
    const res = await fetch(
      "https://api.github.com/repos/litlfred/folio-assistant/pulls?state=open&per_page=100",
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } },
    );
    if (!res.ok) return null;
    const prs = (await res.json()) as Array<{ title: string; body: string | null; head: { ref: string } }>;
    const text = prs.map((p) => `${p.title}\n${p.body ?? ""}\n${p.head.ref}`).join("\n");
    const out = new Set<string>();
    for (const b of beans) {
      const short = b.id.replace(/^folio-assistant-/, "");
      if (new RegExp(`\\b${short}\\b`).test(text)) out.add(b.id);
    }
    return out;
  } catch {
    return null;
  }
}

export async function checkBeanRollup(
  root: string,
  opts: { sweep?: boolean; github?: boolean; now?: Date } = {},
): Promise<BeanRollupReport> {
  const beans = readBeans(root);
  if (beans === null) return { store: null, open: 0, problems: [], outstanding: [], stale: [], sweep: null };
  const found = rollupFindings(beans);
  const baseline = loadBaseline(root);
  const matched = new Set(found.map((f) => f.key).filter((k) => baseline.has(k)));
  // The sweep reads the clock and, asked, GitHub's open PRs: neither is in any fingerprint.
  let swept: ReturnType<typeof sweep> | null = null;
  if (opts.sweep) {
    // input-site: traced #d6fc1512 — the sweep's clock and GH_TOKEN for its PR lookup: a run that sweeps records no hash
    inputSiteReached("check-bean-rollup: sweep");
    swept = sweep(beans, opts.now ?? new Date(), opts.github ? await openPrBeanIds(beans, process.env.GH_TOKEN) : null);
  }
  return {
    store: beanDefsDir(root),
    open: beans.filter(isOpen).length,
    problems: found.filter((f) => !baseline.has(f.key)).map((f) => f.message),
    outstanding: found.filter((f) => baseline.has(f.key)).map((f) => f.message),
    stale: [...baseline].filter((k) => !matched.has(k)).sort(),
    sweep: swept,
  };
}

function formatReport(r: BeanRollupReport): string {
  if (r.store === null) return "Bean rollup\n  · no bean store — nothing to check";
  const out = [`Bean rollup (${r.open} open)`];
  if (r.problems.length === 0) {
    out.push("  ✓ no bean's status is refuted by its own children");
  } else {
    for (const p of r.problems) out.push(`  ✗ ${p}`);
    out.push("");
    out.push("  Close the container, or re-open/re-parent the children that disagree with it.");
    out.push("  Never delete a bean — unwanted work is `scrapped`, with its reasons.");
  }
  // Listed, never failed, and never silent: hiding a baselined defect makes
  // "nobody has fixed this" and "there is nothing here" the same output.
  for (const o of r.outstanding) out.push(`  · outstanding (baselined): ${o}`);
  for (const k of r.stale) out.push(`  ✗ baseline entry \`${k}\` matches nothing — remove it from ${BASELINE_FILE}`);
  if (r.sweep) {
    const s = r.sweep;
    out.push("");
    out.push(
      `  Claim sweep — ${s.inProgress} in-progress, ${s.untouched} untouched for ≥ ${s.untouchedDays}d ` +
        `(reported, never failed on: this half carries a clock)`,
    );
    if (!s.githubConsulted) out.push("  · GitHub not consulted — leaf liveness is UNJUDGED, which is not stale");
    for (const b of s.buckets) {
      out.push(`    ${b.name}: ${b.beans.length} — ${b.reading}`);
      if (b.beans.length) out.push(`      ${b.beans.join(", ")}`);
    }
  }
  return out.join("\n");
}

if (import.meta.main) {
  let report: BeanRollupReport;
  try {
    report = await checkBeanRollup(resolve("."), {
      sweep: process.argv.includes("--sweep"),
      github: process.argv.includes("--github"),
    });
  } catch (e) {
    exitIfBeanStoreAbsent("check:bean-rollup", e);
    console.error(`Could not check bean rollup: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT a pass. Treat it as unknown.");
    process.exit(2);
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  // The sweep is deliberately absent from this expression.
  process.exit(report.problems.length || report.stale.length ? 1 : 0);
}

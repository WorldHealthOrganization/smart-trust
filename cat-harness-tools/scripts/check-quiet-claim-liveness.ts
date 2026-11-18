#!/usr/bin/env bun
/**
 * The NETWORK half of `bean-quiet-claims`: liveness signals the health check
 * cannot compute.
 *
 * `bun run cat health` reports quiet claims from hours since the bean's own
 * `updated_at`, an UPPER BOUND. A claim is live when an open PR names it, an
 * unmerged branch touches it, or a note was added since
 * (`bean-coordination.md` §"A quiet claim"). This script checks the first two.
 *
 * **It never changes a bean's status**: quiet is not evidence of completion.
 *
 * A PR that merely MENTIONS a bean counts as a signal (naming is the test);
 * the ref and PR number are printed so a person can look.
 *
 * Exit: **0** however many findings (a quiet claim is a fact, not a defect);
 * **2** when a signal could not be established (an unreachable API or an
 * unmeasurable ref age is never reported as "no signal found").
 *
 *   bun run cat-harness-tools/scripts/check-quiet-claim-liveness.ts
 *   bun run cat-harness-tools/scripts/check-quiet-claim-liveness.ts --no-fetch
 *   bun run cat-harness-tools/scripts/check-quiet-claim-liveness.ts --json
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { probeBeans, beanDefsDirRelative } from "../test/health/probes.ts";
import { claimPopulations } from "../test/health/checks.ts";
import { isAncestor } from "./git-ancestry.ts";

export const SIGNALS = ["open-pr", "unmerged-branch"] as const;
export type Signal = (typeof SIGNALS)[number];

/**
 * How stale the remote-tracking refs may be before the branch signal is
 * refused rather than trusted.
 *
 * NO EXTERNAL STANDARD; this is `pomp`'s lesson turned into a number. That bean
 * measured two confident, specific, FALSE findings in one session, both from
 * reading a checkout older than the claim — and its rule is that where you read
 * the evidence from is part of the evidence. A branch signal computed against
 * refs fetched hours ago cannot distinguish "no branch touches this bean" from
 * "the branch that does was pushed after my last fetch", and the failure is
 * silent and reads as a finding.
 *
 * Fifteen minutes is short because sibling sessions here merge every few
 * minutes: `bean-coordination` §"A fetch in the same compound command is not a
 * barrier" records a ref that was current when fetched and stale when read.
 */
export const REF_FRESHNESS_MINUTES = 15;

export interface Liveness {
  id: string;
  title: string;
  hours: number;
  signals: Signal[];
  /** Which pull requests named it, for the reader to go and look. */
  prs: number[];
  /** Which unmerged refs carry a commit touching its file. */
  refs: string[];
}

export interface SweepResult {
  verdict: "checked" | "undetermined";
  reason?: string;
  /** Quiet claims with at least one network signal — the check's over-count. */
  live: Liveness[];
  /** Quiet claims with none — the real number the check cannot reach. */
  quiet: Liveness[];
  /** The denominator, so a count here is legible. */
  claimed: number;
  /** Excused by `thux`'s parenthood rule before this sweep ran. */
  parenting: number;
  refsSeen: number;
  /**
   * Refs excluded from the branch signal for changing more than
   * `BULK_BEAN_CHANGES` bean files.
   *
   * REPORTED, NEVER SILENTLY DROPPED — `dh4f`, and the same argument
   * `quietButParenting` carries in the health check. "No ref was excluded" and
   * "the excluded refs were sweeps" must not read identically, because the
   * second is a judgement a reader may want to check.
   */
  bulkRefs: { ref: string; files: number }[];
}

/**
 * Does `text` carry a BEAN-SHAPED reference to `id`?
 *
 * **A bare four-character id is not a reference**, and this is the trap `thux`
 * found: `2634` "matched" a dependabot pull request, because a digit run of
 * that length occurs inside version strings. A substring match on an id this
 * short manufactures liveness signals, and a manufactured signal is worse than
 * a missing one here — it excuses a claim nobody is on.
 *
 * So a reference is the qualified form (`folio-assistant-2634`) or the
 * backticked bare id (`` `2634` ``), which is how beans are cited in prose
 * throughout this repository.
 */
export function referencesBean(text: string, id: string): boolean {
  const bare = id.replace(/^folio-assistant-/, "");
  if (bare.length === 0) return false;
  const esc = bare.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    new RegExp(`folio-assistant-${esc}\\b`).test(text) || new RegExp("`" + esc + "`").test(text)
  );
}

function git(root: string, args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
}

/** The repository's `owner/name` from `origin`, or `undefined`. */
export function originSlug(root: string): string | undefined {
  let url: string;
  try {
    url = git(root, ["remote", "get-url", "origin"]).trim();
  } catch {
    return undefined;
  }
  const m = /github\.com[/:]([^/]+\/[^/.]+)/.exec(url);
  return m?.[1];
}

/** Minutes since the most recently updated remote-tracking ref, or `undefined`. */
export function refAgeMinutes(root: string): number | undefined {
  let out: string;
  try {
    out = git(root, [
      "for-each-ref",
      "--sort=-committerdate",
      "--count=1",
      "--format=%(committerdate:unix)",
      "refs/remotes/origin",
    ]);
  } catch {
    return undefined;
  }
  const unix = Number(out.trim());
  if (!Number.isFinite(unix) || unix <= 0) return undefined;
  // FETCH_HEAD's mtime is when we last fetched; the newest ref's committerdate
  // is when somebody last pushed. The question is how long ago WE LOOKED, so it
  // is the former — the latter can be minutes old on a repository nobody has
  // fetched for a day.
  let stat: string;
  try {
    stat = git(root, ["log", "-1", "--format=%cd", "--date=unix", "FETCH_HEAD"]);
  } catch {
    return undefined;
  }
  const fetched = Number(stat.trim());
  if (!Number.isFinite(fetched) || fetched <= 0) return undefined;
  return Math.max(0, Math.floor((Date.now() / 1000 - fetched) / 60));
}

/** Open pull requests, as `{number, text}` where text is title + body. */
export async function openPullRequests(
  slug: string,
): Promise<{ state: "ok"; value: { number: number; text: string }[] } | { state: "unknown"; reason: string }> {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const out: { number: number; text: string }[] = [];
  // Paginated for the reason `probeOpenPrHeads` is: truncating the listing
  // turns a live claim into a quiet one by omission, silently.
  for (let page = 1; page <= 10; page += 1) {
    const url = `https://api.github.com/repos/${slug}/pulls?state=open&per_page=100&page=${page}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          accept: "application/vnd.github+json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (e) {
      return { state: "unknown", reason: `could not reach the GitHub API: ${String(e).slice(0, 160)}` };
    }
    if (!res.ok) {
      return {
        state: "unknown",
        reason:
          `GitHub API returned ${res.status} for ${slug}/pulls` +
          (res.status === 404 && !token
            ? " — a private repository needs GITHUB_TOKEN or GH_TOKEN."
            : res.status === 403
              ? " — rate limited; set GITHUB_TOKEN to raise the limit."
              : "."),
      };
    }
    const body = (await res.json()) as Array<{ number?: number; title?: string; body?: string | null }>;
    for (const pr of body) {
      if (typeof pr.number === "number") {
        out.push({ number: pr.number, text: `${pr.title ?? ""}\n${pr.body ?? ""}` });
      }
    }
    if (body.length < 100) return { state: "ok", value: out };
  }
  return {
    state: "unknown",
    reason: "more than 1000 open pull requests; the listing truncated, so an absent reference cannot be told from a missed page.",
  };
}

/**
 * How many bean files a ref may change before it is doing BULK work rather than
 * claiming any one of them.
 *
 * **Measured on this repository, 2026-09-25**, over the 408 unmerged
 * remote-tracking refs. Distinct bean files changed against each ref's
 * merge-base with `origin/main`:
 *
 *     27 refs change  1     3 refs change 4     1 ref changes 11
 *     11 refs change  2     1 ref changes 7     1 ref changes 30
 *      2 refs change  3     3 refs change 8     1 ref changes 198
 *                           1 ref changes 9
 *
 * The distribution is bimodal with a clean gap between **11 and 30**, and the
 * threshold is the gap rather than a round number. Both refs above it were
 * checked by reading their diffs rather than inferred from the count, and both
 * are path-rewrite sweeps: `peaceful-heisenberg-dzgsf1` rewrites
 * `fsh-guts/proposals/` to `cat-harness/docs/proposals/` across 198 beans, and
 * `cat-bootstrap-rename` rewrites `bootstrap/` to `cat-bootstrap/` across 30.
 * Neither is a claim on any bean it touches.
 *
 * Getting this wrong manufactures liveness, which is the failure mode that
 * matters here: a false signal EXCUSES a claim nobody is on, so the sweep would
 * quietly report the work plan as healthier than it is. The first version of
 * this script did exactly that — see `refsChangingBeans` on why `--source` was
 * the wrong instrument.
 */
export const BULK_BEAN_CHANGES = 11;

export interface RefChange {
  ref: string;
  /** Hours since the ref's tip commit — an abandoned branch is still a branch. */
  tipAgeHours: number;
  /** Bean files it changes against its merge-base with the default branch. */
  files: string[];
}

/**
 * Every unmerged ref, with the bean files it CHANGES against its merge-base.
 *
 * **Why a diff against the merge-base and not `git log ref --not base`.** The
 * first version of this script asked the latter, and it counted MAIN's own bean
 * churn as the branch's own work on any branch that had merged main in: refs
 * came back "touching" 155 to 263 bean files, and the report named
 * `elegant-clarke-bpycir` as the live signal for some 25 beans when that branch
 * changes exactly ONE. Compounding it, `--source`/`%S` attributes a commit to
 * whichever containing ref the walk reached first, so the ref NAMES in the
 * report were arbitrary — a reader sent to look would have found nothing.
 *
 * A merge-base diff asks the question the signal is actually about: what does
 * this branch change that the default branch does not have?
 */
export function refsChangingBeans(root: string, base: string, beansDir: string): RefChange[] {
  let listing: string;
  try {
    listing = git(root, [
      "for-each-ref",
      "--format=%(refname:short)\t%(committerdate:unix)",
      "refs/remotes/origin",
    ]);
  } catch {
    return [];
  }
  const now = Date.now() / 1000;
  const out: RefChange[] = [];
  for (const line of listing.split("\n")) {
    const [ref, unix] = line.split("\t");
    if (!ref || ref === "origin/HEAD" || ref === base || ref === "origin/gh-pages") continue;
    // A merged ref is not live work — its commits are in the default branch.
    //
    // NOT a `try`/`catch` around the bare call. `--is-ancestor` throws for two
    // different reasons, and catching both reads a MERGED ref as live: on a
    // shallow clone a missing commit exits 128, not 1. The consequence here is
    // a dead claim reported as live work, which is the opposite of this
    // check's purpose. `isAncestor` deepens before answering.
    //
    // `unknown` falls through deliberately, and the direction is the safe one:
    // a ref we cannot judge is examined further rather than silently dropped
    // from the listing. A missed ref would be a claim this check never looks
    // at; an extra one only costs the diff below.
    const merged = isAncestor(root, ref, base);
    if (merged.known && merged.ancestor) continue;
    let mb: string;
    try {
      mb = git(root, ["merge-base", ref, base]).trim();
    } catch {
      continue;
    }
    let diff: string;
    try {
      diff = git(root, ["diff", "--name-only", mb, ref, "--", beansDir]);
    } catch {
      continue;
    }
    const files = diff.split("\n").map((f) => f.trim()).filter((f) => f.length > 0);
    if (files.length === 0) continue;
    const tip = Number(unix);
    out.push({
      ref,
      tipAgeHours: Number.isFinite(tip) ? Math.max(0, Math.floor((now - tip) / 3600)) : 0,
      files,
    });
  }
  return out;
}

export async function sweep(
  root: string,
  opts: { fetch?: boolean; now?: Date } = {},
): Promise<SweepResult> {
  const probe = probeBeans(root);
  if (probe.state !== "ok") {
    return { verdict: "undetermined", reason: probe.reason, live: [], quiet: [], claimed: 0, parenting: 0, refsSeen: 0, bulkRefs: [] };
  }
  if (opts.fetch !== false) {
    try {
      git(root, ["fetch", "--prune", "--quiet", "origin"]);
    } catch (e) {
      return {
        verdict: "undetermined",
        reason: `could not fetch, so the branch signal would be computed against stale refs: ${String(e).slice(0, 160)}`,
        live: [],
        quiet: [],
        claimed: 0,
        parenting: 0,
        refsSeen: 0,
        bulkRefs: [],
      };
    }
  }

  const age = refAgeMinutes(root);
  if (age === undefined) {
    return {
      verdict: "undetermined",
      reason: "could not establish how old the remote-tracking refs are, and `pomp` makes ref freshness part of the evidence rather than a nicety.",
      live: [],
      quiet: [],
      claimed: 0,
      parenting: 0,
      refsSeen: 0,
      bulkRefs: [],
    };
  }
  if (age > REF_FRESHNESS_MINUTES) {
    return {
      verdict: "undetermined",
      reason: `remote-tracking refs were last fetched ${age} minutes ago, past the ${REF_FRESHNESS_MINUTES}-minute limit — a branch pushed since would read as absent.`,
      live: [],
      quiet: [],
      claimed: 0,
      parenting: 0,
      refsSeen: 0,
      bulkRefs: [],
    };
  }

  const slug = originSlug(root);
  if (slug === undefined) {
    return {
      verdict: "undetermined",
      reason: "no GitHub `origin` remote, so there are no pull requests to ask about.",
      live: [],
      quiet: [],
      claimed: 0,
      parenting: 0,
      refsSeen: 0,
      bulkRefs: [],
    };
  }
  const prs = await openPullRequests(slug);
  if (prs.state !== "ok") {
    return { verdict: "undetermined", reason: prs.reason, live: [], quiet: [], claimed: 0, parenting: 0, refsSeen: 0, bulkRefs: [] };
  }

  const pops = claimPopulations(probe.value, opts.now ?? new Date());
  const refsSeen = git(root, ["for-each-ref", "--format=%(refname)", "refs/remotes/origin"]).split("\n").filter((l) => l.trim()).length;
  const base = "origin/main";

  // Built ONCE, not per bean: 55 quiet claims against 408 refs is the same
  // question asked from the other side, and asking it per bean cost 55 walks of
  // every ref.
  // The pathspec comes from the DECLARATION, not from a literal: the store has
  // already moved once (`.beans/` to `beans/`, 2026-09-18), and a hardcoded
  // pathspec would then match nothing and report every claim quiet — a silent
  // false finding rather than an error. `check:declared-paths` is the ratchet
  // that asked for this.
  const beansDir = beanDefsDirRelative(root);
  if (beansDir === undefined) {
    return {
      verdict: "undetermined",
      reason: "could not read the bean-graph declaration, so the branch signal has no path to ask git about.",
      live: [],
      quiet: [],
      claimed: 0,
      parenting: 0,
      refsSeen: 0,
      bulkRefs: [],
    };
  }
  const changes = refsChangingBeans(root, base, beansDir);
  const bulk = changes.filter((c) => c.files.length > BULK_BEAN_CHANGES);
  const byBean = new Map<string, string[]>();
  for (const c of changes) {
    if (c.files.length > BULK_BEAN_CHANGES) continue;
    for (const f of c.files) {
      const m = /-([a-z0-9]+)--/.exec(f.slice(f.lastIndexOf("/") + 1));
      if (m?.[1] === undefined) continue;
      const list = byBean.get(m[1]) ?? [];
      list.push(`${c.ref} (tip ${c.tipAgeHours}h)`);
      byBean.set(m[1], list);
    }
  }

  const live: Liveness[] = [];
  const quiet: Liveness[] = [];
  for (const { bean, hours } of pops.quiet) {
    const named = prs.value.filter((p) => referencesBean(p.text, bean.id)).map((p) => p.number);
    const bare = bean.id.replace(/^folio-assistant-/, "");
    const refs = (byBean.get(bare) ?? []).sort();
    const signals: Signal[] = [];
    if (named.length > 0) signals.push("open-pr");
    if (refs.length > 0) signals.push("unmerged-branch");
    const row: Liveness = { id: bean.id, title: bean.title, hours, signals, prs: named, refs };
    (signals.length > 0 ? live : quiet).push(row);
  }

  return {
    verdict: "checked",
    live,
    quiet,
    claimed: pops.claimed.length,
    parenting: pops.quietButParenting.length,
    refsSeen,
    bulkRefs: bulk.map((c) => ({ ref: c.ref, files: c.files.length })),
  };
}

export function formatReport(r: SweepResult): string {
  const out: string[] = [];
  out.push("Quiet-claim liveness — the network half of `bean-quiet-claims`");
  out.push("");
  if (r.verdict === "undetermined") {
    out.push(`  ⚠ COULD NOT DETERMINE — this is not a clean run: ${r.reason}`);
    out.push("");
    out.push("  No claim is reported quiet on an undetermined sweep. A signal that");
    out.push("  could not be looked for is not a signal that was absent.");
    return out.join("\n");
  }
  const total = r.live.length + r.quiet.length;
  out.push(
    `  ${total} quiet claim(s) of ${r.claimed} claimed · ${r.parenting} already excused as parenting live work · ${r.refsSeen} remote refs`,
  );
  if (r.bulkRefs.length > 0) {
    out.push(
      `  EXCLUDED from the branch signal — ${r.bulkRefs.length} ref(s) change more than ${BULK_BEAN_CHANGES} bean`,
    );
    out.push("  files, so they are doing bulk work rather than claiming any one of them:");
    for (const b of r.bulkRefs) out.push(`    ${b.ref}  ${b.files} bean files`);
    out.push("");
  }
  out.push(`  LIVE — a signal the offline check cannot see (${r.live.length}):`);
  if (r.live.length === 0) out.push("    (none)");
  for (const l of r.live) {
    const why = [
      l.prs.length > 0 ? `PR ${l.prs.map((n) => `#${n}`).join(", ")}` : undefined,
      l.refs.length > 0 ? `${l.refs.length} unmerged ref(s): ${l.refs.slice(0, 3).join(", ")}` : undefined,
    ]
      .filter(Boolean)
      .join(" · ");
    out.push(`    ${l.id}  ${l.hours}h  ${why}`);
  }
  out.push("");
  out.push(`  QUIET — no open PR, no unmerged branch (${r.quiet.length}):`);
  if (r.quiet.length === 0) out.push("    (none)");
  for (const q of r.quiet) out.push(`    ${q.id}  ${q.hours}h  ${q.title.slice(0, 74)}`);
  out.push("");
  out.push(
    `  A claim in the QUIET list announced nothing to anybody, so it reserves nothing:`,
  );
  out.push("  any session may take it after saying in the bean that it checked. Quiet is");
  out.push("  NEVER evidence of completion — it goes back to the pool, not to `completed`.");
  out.push("  Nothing here re-statuses a bean; that is a person's call.");
  return out.join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const root = resolve(import.meta.dir, "..", "..");
  const r = await sweep(root, { fetch: !argv.includes("--no-fetch") });
  if (argv.includes("--json")) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.log(formatReport(r));
  }
  // Findings exit 0 — a quiet claim is a fact about the repository, not a
  // defect in it. Could-not-determine exits 2, so a caller cannot read a blind
  // sweep as a clean one.
  process.exit(r.verdict === "undetermined" ? 2 : 0);
}

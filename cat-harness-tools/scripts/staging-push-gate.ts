#!/usr/bin/env bun
/**
 * Rate-limit staging-preview pushes to `gh-pages`, so a push never lands while
 * the Pages build it would cancel is still running.
 *
 * @module scripts/staging-push-gate
 * @covers none — a GATE the deploy waits on, not an audit: it decides when the stage job may push, and judges nothing else
 *
 * ```sh
 * bun run cat-harness-tools/scripts/staging-push-gate.ts gate --dir pages --queued-at "$QUEUED_AT"
 * bun run cat-harness-tools/scripts/staging-push-gate.ts comment --state queued --dir pages --out body.md
 * ```
 *
 * ## Why this exists — issues #1868 and #1956, bean `j27s`
 *
 * GitHub's `pages build and deployment` keeps only the NEWEST run: every push
 * to `gh-pages` cancels the build in flight. A build takes about three minutes
 * (successful runs on 2026-10-03 took 2m20s to 3m40s), and staging previews
 * were pushed every one to two minutes in a busy stretch — 07:50Z to 08:00Z
 * that day, ten builds cancelled in a row. A main-site publish pushed into
 * that stretch was cancelled with them and stayed unpublished until a quiet
 * gap came.
 *
 * **Owner ruling, 2026-10-03, option 1:** push staging previews to `gh-pages`
 * less often — batched or rate-limited. This is the rate limit.
 *
 * ## The rule, and why it is enough
 *
 * Before each push attempt the stage job re-reads `gh-pages` and asks this
 * script whether the TIP is old enough:
 *
 * - tip is a staging commit (`staging(...)`): wait until it is
 *   {@link STAGING_WINDOW_MS} old — longer than a Pages build, so that build
 *   finishes before the next staging push can cancel it;
 * - tip is anything else (the main-site publish, `publish.yml`, any other
 *   publisher): wait until it is {@link MAIN_WINDOW_MS} old. Those are the
 *   builds this exists to protect, and the commit is made minutes before the
 *   push completes on a full-site replace, so they get the wider margin.
 *
 * **The fast-forward check is what makes it a guarantee and not a hope.** Two
 * stage jobs that both find the window open both build a commit on the SAME
 * tip; only one push can fast-forward, and the other is rejected, re-reads, and
 * finds a tip younger than the window. So at most ONE staging push lands per
 * window, however many jobs wait — no lock, no shared state, nothing to
 * expire. The same rejection protects the main site: a staging push racing a
 * main-site publish either lands BEFORE it (and is harmless, because the main
 * push then cancels the staging build, and the build that runs carries both)
 * or is rejected and waits out the main-site window.
 *
 * ## Why not a single "flush" job instead
 *
 * The alternative was to have each stage job upload its preview as an
 * artifact and a scheduled job push every pending preview in one commit. It
 * batches harder, but it costs a second workflow, an artifact round trip of
 * 200–500 MB per preview, a record of which artifact is already deployed, and
 * a schedule GitHub only runs best-effort — and the flush job would hold a
 * write token over content built from a pull request, which no job here does
 * today. The rate limit is one script and one loop, and its safety argument
 * is git's own fast-forward rule.
 *
 * Coalescing still happens: the workflow's per-branch concurrency group has
 * `cancel-in-progress: true`, so a job waiting here is cancelled by the next
 * push to the same branch, and a superseded preview is never pushed at all.
 *
 * ## Exit codes of `gate`
 *
 * - `0` — the window is open; push now.
 * - `75` (`EX_TEMPFAIL`) — the window was closed; this script SLEPT until it
 *   should open (plus jitter, so waiters do not wake together) and the caller
 *   must re-read `gh-pages` and ask again. Sleeping here rather than printing
 *   a number is `backoff-sleep.ts`'s reason: a failure is then an exit code,
 *   never an empty `sleep` operand.
 * - `1` — the job has waited longer than {@link MAX_WAIT_MS}. Something is
 *   pushing `gh-pages` continuously; the preview is NOT deployed and the job
 *   fails, because a lost staging deploy must stay visible.
 * - `2` — usage, or the tip could not be read. Never read as "open".
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

import {
  RenderedImpactSchema,
  reviewList,
  type RenderedImpact,
} from "../schemas/ui/rendered-impact.ts";
import { previewPath } from "./lib/preview-prefix.ts";

/** After a staging commit: longer than a Pages build (≤ 3m40s measured 2026-10-03). */
export const STAGING_WINDOW_MS = 5 * 60_000;
/** After any other publisher's commit — the main site above all. */
export const MAIN_WINDOW_MS = 10 * 60_000;
/** Give up after this long in the queue. */
export const MAX_WAIT_MS = 120 * 60_000;
/** Each waiter wakes at a random point up to this long after the window opens. */
export const JITTER_MS = 60_000;
/** What to tell a reviewer: push, then a Pages build, with margin. */
export const LIVE_AFTER_PUSH_MS = 5 * 60_000;
/** `EX_TEMPFAIL` — slept; re-read and ask again. */
export const EXIT_WAITED = 75;

export interface Tip {
  /** Committer time of the `gh-pages` tip, epoch ms. */
  committedMs: number;
  subject: string;
}

export type TipKind = "staging" | "other";

/** A staging commit is one the staging jobs write: `staging(<slug>): …`. Anything else is protected. */
export function tipKind(subject: string): TipKind {
  return /^staging\(/.test(subject) ? "staging" : "other";
}

export interface Decision {
  open: boolean;
  /** When the window opens (or opened), epoch ms. */
  openAtMs: number;
  kind: TipKind;
  /** The job has been queued longer than `MAX_WAIT_MS`. */
  expired: boolean;
  reason: string;
}

/**
 * Decide whether a staging push may go now. Pure.
 *
 * A tip committed in the future (runner clock skew) counts as committed now,
 * so skew can only make the gate wait longer, never open early.
 */
export function decide(tip: Tip, nowMs: number, queuedMs: number = nowMs): Decision {
  const kind = tipKind(tip.subject);
  const window = kind === "staging" ? STAGING_WINDOW_MS : MAIN_WINDOW_MS;
  const base = Math.min(tip.committedMs, nowMs);
  const openAtMs = base + window;
  const open = nowMs >= openAtMs;
  const expired = !open && nowMs - queuedMs >= MAX_WAIT_MS;
  const what = kind === "staging" ? "a staging preview" : "a main-site (or other) publish";
  const reason = open
    ? `gh-pages tip is ${what}, ${minutes(nowMs - base)} old — window of ${minutes(window)} has passed`
    : `gh-pages tip is ${what}, ${minutes(nowMs - base)} old — waiting until ${iso(openAtMs)} so its Pages build is not cancelled`;
  return { open, openAtMs, kind, expired, reason };
}

/** When a preview queued at `nowMs` can expect to be live, at the earliest. */
export function estimateLive(tip: Tip, nowMs: number): { pushAtMs: number; liveByMs: number } {
  const d = decide(tip, nowMs);
  const pushAtMs = Math.max(nowMs, d.openAtMs);
  return { pushAtMs, liveByMs: pushAtMs + LIVE_AFTER_PUSH_MS };
}

function minutes(ms: number): string {
  return `${(ms / 60_000).toFixed(1)} min`;
}

function iso(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** `HH:MM UTC` — what a reviewer reads in a comment. */
export function clock(ms: number): string {
  return `${new Date(ms).toISOString().slice(11, 16)} UTC`;
}

/** Read the tip of a `gh-pages` checkout. `undefined` when it cannot be read. */
export function readTip(dir: string): Tip | undefined {
  const r = spawnSync("git", ["-C", dir, "log", "-1", "--format=%ct%x09%s", "HEAD"], { encoding: "utf-8" });
  if (r.status !== 0) return undefined;
  return parseTip(r.stdout ?? "");
}

/** Parse `git log -1 --format=%ct%x09%s`. */
export function parseTip(line: string): Tip | undefined {
  const m = /^(\d+)\t(.*)$/.exec(line.trim());
  if (m === null) return undefined;
  const s = Number(m[1]);
  if (!Number.isFinite(s) || s <= 0) return undefined;
  return { committedMs: s * 1000, subject: m[2] };
}

export interface CommentInput {
  state: "queued" | "pushed";
  owner: string;
  repo: string;
  slug: string;
  branch: string;
  sha: string;
  nowMs: number;
  /** queued: the tip the estimate is made against. */
  tip?: Tip;
  /** pushed: when the push landed. */
  pushedMs?: number;
  /**
   * The rendered-impact list(s) for this build (`rendered-impact.json`). Absent
   * means NO list was computed — a third state, never read as "nothing changed".
   */
  impact?: readonly RenderedImpact[];
}

/** How many page rows a comment lists before pointing at the rest. */
export const MAX_REVIEW_ROWS = 20;

/**
 * The "Pages to review" section: one deep link per changed page (and per
 * anchor on it) into the preview, each beside the SAME page on the main site,
 * so a reviewer opens the change and its before, not two site roots (bean
 * `g4dv`, owner 2026-10-14: review requests carry deep links to what is being
 * edited). The row shape is `folio-staging.yml`'s. Pure.
 *
 * Three states, kept apart: no list computed (said plainly — not "no
 * change"); a list that names pages; a list that names none. Inputs the
 * renderer could not map (`undetermined`) are listed as NOT KNOWN, because a
 * short list next to them would otherwise read as complete.
 */
export function reviewSection(staging: string, main: string, impact: readonly RenderedImpact[] | undefined): string {
  if (impact === undefined) {
    return `**Pages to review:** No page list was computed for this build, so nothing here says which pages changed — compare the [preview](${staging}) with the [main site](${main}) page by page.`;
  }
  const rows: string[] = [];
  let index = 0;
  const unknown: string[] = [];
  // Pages before data (CSS, JSON, images), so the 20 rows shown are the ones
  // a reviewer reads; each group stays in path order.
  const files = impact
    .flatMap((imp) => reviewList(imp))
    .sort((x, y) => Number(x.role !== "content") - Number(y.role !== "content") || x.path.localeCompare(y.path));
  for (const imp of impact) index += imp.files.filter((f) => f.role === "index").length;
  for (const f of files) {
    for (const a of f.anchors?.length ? f.anchors : [undefined]) {
      const frag = a === undefined ? "" : `#${encodeURIComponent(a)}`;
      const label = `\`${f.path}${a === undefined ? "" : ` › ${a}`}\``;
      if (f.change === "removed") rows.push(`- removed: ${label} · [before](${main}${f.path}${frag})`);
      else if (f.change === "added") rows.push(`- [${label}](${staging}${f.path}${frag}) · (new page)`);
      else rows.push(`- [${label}](${staging}${f.path}${frag}) · [before](${main}${f.path}${frag})`);
    }
  }
  for (const u of impact.flatMap((imp) => imp.undetermined)) {
    unknown.push(`- \`${u.input}\` — ${u.scope === "all" ? "can change any page" : "changes pages not mapped one by one"}: ${u.reason}`);
  }
  const json = `[rendered-impact.json](${staging}rendered-impact.json)`;
  const indexNote = index ? ` (and ${index} index file(s), not listed)` : "";
  const shown = rows.slice(0, MAX_REVIEW_ROWS);
  const more = rows.length > shown.length ? `\n- … and ${rows.length - shown.length} more in ${json}` : "";
  const head = rows.length
    ? `**Pages to review:** ${rows.length}${indexNote} — each links the preview, then the same page on the main site — ${json}\n${shown.join("\n")}${more}`
    : `**Pages to review:** the page list computed for this build names no rendered page${indexNote} — ${json}`;
  const shownUnknown = unknown.slice(0, MAX_REVIEW_ROWS);
  const unknownMore = unknown.length > shownUnknown.length ? `\n- … and ${unknown.length - shownUnknown.length} more in ${json}` : "";
  const notKnown = unknown.length
    ? `\n\n**Not known** — inputs the list could not map to pages (never read as "no change"):\n${shownUnknown.join("\n")}${unknownMore}`
    : "";
  return `${head}${notKnown}`;
}

/** Read a `rendered-impact.json` (one impact or an array). `undefined` when it cannot be read or is not one. */
export function readImpact(path: string): RenderedImpact[] | undefined {
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    return (Array.isArray(raw) ? raw : [raw]).map((x) => RenderedImpactSchema.parse(x));
  } catch {
    return undefined;
  }
}

/** The marker the PR-comment step finds its own comment by. */
export const COMMENT_MARKER = "<!-- staging-preview-comment -->";

/**
 * The preview comment's body. Pure.
 *
 * It says which of two things is true, and never the third: QUEUED (built,
 * waiting for the rate-limit window) or PUSHED (on `gh-pages`, waiting for the
 * Pages build). Neither is "live" — whether Pages has served it is something
 * this job cannot observe, so the comment gives a time to check by.
 */
export function stagingComment(c: CommentInput): string {
  const url = `https://${c.owner}.github.io/${c.repo}/${previewPath(c.slug)}/`;
  const main = `https://${c.owner}.github.io/${c.repo}/`;
  const deployments = `https://github.com/${c.owner}/${c.repo}/deployments/github-pages`;
  const rate =
    `Staging pushes to \`gh-pages\` are rate-limited (issue #1956): at most one per ` +
    `${STAGING_WINDOW_MS / 60_000} min, and none for ${MAIN_WINDOW_MS / 60_000} min after a ` +
    `main-site publish, so the Pages build that publishes the main site is never cancelled by a preview.`;
  let status: string;
  if (c.state === "queued") {
    const est = c.tip === undefined ? undefined : estimateLive(c.tip, c.nowMs);
    status =
      est === undefined
        ? `**Status:** staged — built, and queued for \`gh-pages\`. The push time could not be estimated (the publish branch could not be read); this comment is updated when it is pushed.`
        : `**Status:** staged — built, and queued for \`gh-pages\`. Earliest push **${clock(est.pushAtMs)}**; live by about **${clock(est.liveByMs)}** if nothing is queued ahead of it. This comment is updated when it is pushed.`;
  } else {
    const pushed = c.pushedMs ?? c.nowMs;
    status = `**Status:** pushed to \`gh-pages\` at ${clock(pushed)}; live by about **${clock(pushed + LIVE_AFTER_PUSH_MS)}**, once the Pages build finishes ([deployment status](${deployments})).`;
  }
  return `${COMMENT_MARKER}
## 🔍 Staging preview

**URL:** ${url}
**Commit:** \`${c.sha.substring(0, 7)}\`
**Branch:** \`${c.branch}\`

${status}

${rate}

${reviewSection(url, main, c.impact)}

Every page carries a sage banner linking back to the branch, this PR, the issue it is for, the main site, and the build log.

**Main site:** ${main}`;
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return undefined;
  const v = argv[i].startsWith(`--${name}=`) ? argv[i].slice(name.length + 3) : argv[i + 1];
  return v === undefined || v === "" ? undefined : v;
}

const USAGE =
  "usage: staging-push-gate.ts gate --dir PAGES_CHECKOUT [--queued-at ISO]\n" +
  "       staging-push-gate.ts comment --state queued|pushed --out FILE [--dir PAGES_CHECKOUT] [--pushed-at ISO] [--impact RENDERED_IMPACT_JSON]\n" +
  "       (comment reads SLUG, BRANCH, SHA and GITHUB_REPOSITORY from the environment)";

if (import.meta.main) {
  const [cmd, ...argv] = process.argv.slice(2);
  const nowMs = Date.now();
  if (cmd === "gate") {
    const dir = flag(argv, "dir");
    if (dir === undefined) {
      console.error(USAGE);
      process.exit(2);
    }
    const tip = readTip(dir);
    if (tip === undefined) {
      console.error(`::error::staging-push-gate: could not read the gh-pages tip in ${dir} — refusing to call the window open`);
      process.exit(2);
    }
    const q = flag(argv, "queued-at");
    const queuedMs = q === undefined ? nowMs : Date.parse(q);
    if (Number.isNaN(queuedMs)) {
      console.error(`staging-push-gate: --queued-at \`${q}\` is not a timestamp`);
      process.exit(2);
    }
    const d = decide(tip, nowMs, queuedMs);
    if (d.open) {
      console.log(`staging-push-gate: open — ${d.reason}`);
      process.exit(0);
    }
    if (d.expired) {
      console.log(
        `::error::staging-push-gate: queued for ${minutes(nowMs - queuedMs)} without a window — ` +
          `gh-pages is being pushed continuously. The preview was NOT deployed; re-run the job.`,
      );
      process.exit(1);
    }
    const ms = d.openAtMs - nowMs + Math.floor(Math.random() * JITTER_MS);
    console.log(`staging-push-gate: closed — ${d.reason}; sleeping ${(ms / 1000).toFixed(0)}s`);
    await new Promise((r) => setTimeout(r, ms));
    process.exit(EXIT_WAITED);
  } else if (cmd === "comment") {
    const state = flag(argv, "state");
    const out = flag(argv, "out");
    const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "/").split("/");
    const slug = process.env.SLUG ?? "";
    if ((state !== "queued" && state !== "pushed") || out === undefined || !owner || !repo || !slug) {
      console.error(USAGE);
      process.exit(2);
    }
    const dir = flag(argv, "dir");
    const p = flag(argv, "pushed-at");
    const i = flag(argv, "impact");
    const impact = i === undefined ? undefined : readImpact(i);
    // Unreadable is reported, then commented as "no page list" — the honest state.
    if (i !== undefined && impact === undefined) console.error(`::warning::staging-push-gate: ${i} is not a readable rendered-impact list`);
    const body = stagingComment({
      state,
      owner,
      repo,
      slug,
      branch: process.env.BRANCH ?? "",
      sha: process.env.SHA ?? "",
      nowMs,
      tip: dir === undefined ? undefined : readTip(dir),
      pushedMs: p === undefined || Number.isNaN(Date.parse(p)) ? undefined : Date.parse(p),
      impact,
    });
    writeFileSync(out, `${body}\n`);
    process.exit(0);
  } else {
    console.error(USAGE);
    process.exit(2);
  }
}

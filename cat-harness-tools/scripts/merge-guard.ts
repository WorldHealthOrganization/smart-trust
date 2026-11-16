#!/usr/bin/env bun
/**
 * The single way a steward lands a pull request: an ENFORCED merge guard
 * that asks whether the PR is finished before it reaches its base.
 *
 * @module cat-harness/scripts/merge-guard
 * @covers none — a merge precondition over GitHub's live facts about one PR; it judges no declared graph
 *
 * No workflow merges into a base (`merge-main.yml` merges `main` INTO PRs
 * only), so this guard is what stands between "the steward decided" and "the
 * PR is on its base".
 *
 * ## Usage
 *
 * ```
 * bun run cat merge:guard <pr>                         # evaluate only
 * bun run cat merge:guard <pr> --merge --session <id>  # land it, only if every check passes
 * ```
 *
 * `--session` is the MERGING session (an id `session_…` or its URL). It is
 * required with `--merge`, because check 2 asks whether that session is the
 * one that marked the PR ready. `--merge-manager-own-pr` is for one case
 * only: the merge manager landing a PR it opened itself, so the PR's own
 * session IS the merging one and check 2 cannot separate them. It lifts that
 * separation and nothing else, and refuses when `--session` is not the PR's
 * own session. (`--no-merge-manager` is its old name, still accepted; it no
 * longer means "no merge manager is active, so any session merges".)
 * `--status` also posts the verdict as the `merge-guard` commit status on the
 * head, which is what the workflow does.
 *
 * ## Only the merge manager runs a merge path
 *
 * Owner, 2026-11-13 (cat-harness#1313, merge-manager-watcher §"What this does
 * not do yet"): only the merge manager merges and re-pins. `--merge` is its
 * tool; no other session runs it, on its own PR or anyone else's. A session
 * says its PR is finished in one of two ways, both of which check 3 reads:
 *
 * - it sends the merge manager `ready: <sha>` (or `repin+merge: …`), and
 *   posts or has the merge manager relay the `ready: <sha>` marker on the PR;
 * - an agent that cannot send messages labels its own PR instead:
 *   `ready-to-merge` when it is green, `needs-repin` when it is green except
 *   the re-pin. `merge:watch --queue` lists both labels as the queue.
 *
 * Evaluating without `--merge` (and `--status`, which the workflow posts on
 * every PR) is read-only, and anyone may run it.
 *
 * ## The `merge-guard` status on every layer PR (`--full-tier`, `--root`)
 *
 * Owner, 2026-11-13, card "A. merge-guard required status": every layer
 * repository posts the `merge-guard` commit status on every PR head, so it
 * can be a required check on `main`. The reusable workflow
 * `.github/workflows/layer-merge-guard.yml` does it, running
 * `merge-guard.ts <pr> --status --full-tier --root <the caller at main>`.
 * `--full-tier` makes check 5 a gate that ALSO needs the full tier green on
 * the head ({@link fullTierCheck}); `--root` names the repository whose
 * `pull_request` workflows check 5 owes. The status is `success` only when
 * all nine checks pass, so it means: the full tier is green, the
 * `ready-to-merge` label is on (check 4) and the PR's own session said ready
 * (check 3). It never merges; only the merge manager does.
 *
 * ## The nine checks
 *
 * Every refusal names its check, by number and by id:
 *
 * 1. `base` — the base is `main`, the PR is open, and the base is not the head
 *    branch of a merged PR.
 * 2. `ready-for-review` — not a draft; and the latest `ready_for_review` event
 *    is attributable to the PR's OWN session, never the merging one — unless
 *    `--merge-manager-own-pr`, when the own session IS the merging one.
 * 3. `ready-marker` — the PR's own session said it is ready, at the head, in
 *    one of three ways (every commit after the point named may be a
 *    merge-main bot merge):
 *    - a `ready: <sha>` comment whose session footer is the PR's own session;
 *    - a `ready: <sha>` comment the merge manager posted FOR that session,
 *      saying `relayed for <session>` ({@link relayedFor}), whoever signs it;
 *    - the `ready-to-merge` label, added (the timeline's `labeled` event)
 *      after the last push to the head ({@link labelReady}) — the path for an
 *      agent that cannot send messages.
 * 4. `labels` — `ready-to-merge` present, `needs-merge-human` absent.
 * 5. `ci` — every `pull_request` run on the head is `success` or `skipped`,
 *    and every workflow owed for that event ran. One substitution: on
 *    a head that is a merge-main bot merge, a `pull_request` run GitHub held
 *    for approval (`NOT_EXECUTED`) is judged by the latest
 *    `workflow_dispatch` run of the same workflow on the head — green counts,
 *    running is not-ready, red is a defect. Held with no dispatch: refused
 *    not-ready if `merge-main.yml` dispatches that workflow (it is still
 *    owed), reported "not judged" if it does not (preview-only), `unknown` if
 *    that file's dispatch line cannot be parsed. One exemption from WAITING,
 *    never from judging: a workflow in {@link NOT_WAITED_FOR_WORKFLOW_FILES}
 *    (Feature Staging) that is still in flight or has not started is not a
 *    refusal; once finished, red refuses. The same holds for the
 *    {@link AGENT_BUILD_CONTEXT} commit status (folio-assistant#2881): when
 *    Feature Staging defers to an agent-built preview its own run judges
 *    nothing, and the verify rebuild reports the built-site checks only
 *    there. `failure` or `error` refuses as a defect; `pending` is not
 *    waited for.
 *    **Check 5 gates a RELEASE only** (owner, card Q-CIB-4 A, 2026-11-08:
 *    "CI not gate on non-release merge to main"). A merge is a release when
 *    run with `--release` or when the PR carries the `release` label. On any
 *    other merge the same judgement is made and reported, and the check
 *    passes as advisory ({@link advisoryCi}).
 * 6. `checklist` — no unticked `- [ ]` item in the body.
 * 7. `open-question` — no comment newer than the ready marker asks the owner
 *    or the Merge Manager an open question. A heuristic; its limits are on
 *    {@link openQuestions}.
 * 8. `mergeable` — GitHub says the head still merges cleanly into its base:
 *    check 5's runs tested the head merged with main as main was when the
 *    head was pushed. `mergeable: false` (or `mergeable_state: dirty`) refuses
 *    not-ready; `null` — GitHub has not finished computing it — is `unknown`,
 *    after {@link fetchSnapshot} re-asks a few times. `unstable` and
 *    `blocked` pass here: they are about checks, which check 5 judges.
 * 9. `content-review` — a PR labelled `content` (it changes folio content
 *    text) has a `## Content review` section in its body that points to a
 *    review record: an owner decision card id, a committee or review-log
 *    link, a bean, or an editing-hci-validation instance
 *    ({@link contentReviewRecord}). A draft without one is not-ready; a PR
 *    marked ready without one is a defect. Owner, 2026-11-15.
 *
 * ## Exit codes
 *
 * | code | means |
 * |---|---|
 * | 0 | every check passed (and, with `--merge`, the PR merged) |
 * | 1 | refused: at least one check failed, and every check could be asked |
 * | 2 | could not determine: a fact could not be read, or bad usage |
 *
 * ## The commit status (`--status`)
 *
 * | verdict | status | when |
 * |---|---|---|
 * | pass | `success` | every check passes |
 * | refused, every refusal `not-ready` | `pending` | a draft, no marker, no label, an unticked box, CI still running, an open question, a conflict with main |
 * | refused, any refusal a `defect` | `failure` | a base that is not `main` or is dead, `needs-merge-human`, red CI, a marker or ready-flip by another session |
 * | unknown | `error` | a fact could not be read |
 *
 * `pending` exists so that every unfinished PR is not painted red
 * ({@link RefusalKind}). A required check blocks the merge in every state but
 * `success`, and the exit code is 1 for both kinds of refusal.
 *
 * **Unknown is never a pass.** A check that could not ask returns `unknown`,
 * and an unknown anywhere makes the whole verdict `unknown` even when another
 * check refused.
 *
 * ## Attribution goes through comments, not the event's actor
 *
 * Every session acts with the owner's token, so every timeline event's actor
 * is the same login. The session IS recorded in the footer of what a session
 * posts (`https://claude.ai/code/session_…`), so a `ready_for_review` event
 * is attributed to the session of the nearest session-bearing comment within
 * {@link READY_WINDOW_MS}. The owning session must therefore **mark the PR
 * ready and post its `ready: <sha>` marker together.** `--actor` is still
 * compared, for the day a steward acts under its own login.
 *
 * ## What this does not stop
 *
 * It guards against a CARELESS steward, not a hostile author: a PR may edit
 * `.github/workflows/merge-guard.yml` in its own tree, and every check reads
 * text a session wrote. The workflow runs this script from `main`'s copy for
 * that reason, but a pull_request run still uses the PR's workflow file.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { coverageFor, runsForHead, NOT_EXECUTED, type HeadRunVerdict, type RunRow } from "./check-head-has-run.ts";
import { classifyResponse, withBackoff } from "../src/core/retry.js";
import { scanTriggers, type TriggerScan } from "../src/core/workflow-events.js";
import { detectRepoUrl, ownerRepo } from "../src/core/git-refs.js";
import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

// ─── vocabulary ────────────────────────────────────────────────────────────

export const BASE = "main";
export const READY_LABEL = "ready-to-merge";
export const HUMAN_LABEL = "needs-merge-human";
/**
 * The label on a PR that changes folio content text: wording, tables,
 * figures, models, decisions, glossary entries, a change set (owner,
 * 2026-11-15). Harness or tool code, re-pins and beans are not content.
 * Check 9 reads it.
 */
export const CONTENT_LABEL = "content";
export const BOT_LOGIN = "github-actions[bot]";
/**
 * The commit status an agent-built preview's verify rebuild posts on the head
 * (folio-assistant#2881, `feature-staging.yml`). A deferred Feature Staging run
 * builds and checks nothing, so it is green over a site it never examined;
 * this status is where its checks reach the PR. Check 5 judges it the way it
 * judges Feature Staging: once it has an answer, never waiting for one.
 */
export const AGENT_BUILD_CONTEXT = "preview/agent-build";
/** The first line of every comment `merge-main.yml` writes. */
export const MERGE_MAIN_MARKER = "<!-- merge-main-bot -->";
/** This guard's own workflow. Its runs are never evidence about the head: they are the guard. */
export const SELF_WORKFLOW_FILE = ".github/workflows/merge-guard.yml";
/**
 * Workflows check 5 JUDGES once they finish but never WAITS for — bean `gnnj`,
 * owner ruling 2026-10-05 (option 1 of the staging-speed report).
 *
 * Feature Staging's deploy is held by the #1956 rate limit: one `gh-pages` push
 * per 5 min, none for 10 min after a main-site publish. Measured 06:00–07:10Z
 * that day, its deploy step waited up to 2483 s (41 min) and eight runs were
 * queued at once, so every PR in the merge queue inherited the preview queue's
 * depth. The preview is for reviewers and publishes on its own schedule; the
 * merge does not wait for it.
 *
 * NOT waived: a run that has FINISHED red still refuses, because `stage`
 * carries real checks before it deploys (no duplicate page id, no escaped
 * block markup, the export verifies). Only "not finished yet" and "not started
 * yet" stop being reasons to refuse. #1956's limits are untouched.
 */
export const NOT_WAITED_FOR_WORKFLOW_FILES: ReadonlySet<string> = new Set([".github/workflows/feature-staging.yml"]);

/**
 * The one step of a {@link NOT_WAITED_FOR_WORKFLOW_FILES} run whose failure is
 * not a verdict on the tree: the `gh-pages` deploy, which fails when the #1956
 * push window never opened (`staging-push-gate` gave up) or three pushes were
 * rejected. Nothing in it judges the head, so a run whose ONLY failed step is
 * this one does not refuse check 5 (owner ruling 2026-10-05, bean `gnnj`). Any
 * other failed step — a build or page check — still refuses.
 */
export const DEPLOY_ONLY_STEP = "Deploy the preview and log the render, in one commit";
/** The workflow that merges main into PR heads, and dispatches the gating workflows after a bot push. */
export const MERGE_MAIN_WORKFLOW = ".github/workflows/merge-main.yml";
/** The commit-status context the workflow posts and a ruleset would require. */
export const STATUS_CONTEXT = "merge-guard";
/** How far from a `ready_for_review` event a session-bearing comment may be and still attribute it. */
export const READY_WINDOW_MS = 10 * 60 * 1000;
/** GitHub's pulls/{n}/commits endpoint stops at this many commits. */
export const COMMITS_API_CAP = 250;
/** CI conclusions that count as passed for check 5. */
export const PASSING = new Set(["success", "skipped"]);

export const CHECKS = [
  "base",
  "ready-for-review",
  "ready-marker",
  "labels",
  "ci",
  "checklist",
  "open-question",
  "mergeable",
  "content-review",
] as const;
export type CheckId = (typeof CHECKS)[number];

// ─── the snapshot evaluate() reads ─────────────────────────────────────────

export interface GhUser {
  login: string;
}
export interface GhComment {
  id: number;
  created_at: string;
  body: string;
  user: GhUser | null;
  html_url?: string;
}
export interface GhTimelineEvent {
  event: string;
  created_at?: string;
  actor?: GhUser | null;
  /** On `labeled` / `unlabeled` events: the label. */
  label?: { name: string } | null;
}
export interface GhCommit {
  sha: string;
  author: GhUser | null;
  commit: { author: { name: string; date?: string } | null; committer?: { date?: string } | null; message?: string };
  parents: { sha: string }[];
}
export interface GhPull {
  number: number;
  state: string;
  draft: boolean;
  merged?: boolean;
  body: string | null;
  user?: GhUser | null;
  labels: { name: string }[];
  head: { sha: string; ref: string };
  base: { ref: string; repo?: { owner?: GhUser } };
  /**
   * Whether GitHub can merge the head into the base (check 8). `null` means
   * GitHub has not computed it yet: a GET of the PR starts the job, and a
   * later GET reads the answer. Absent means the record did not carry it.
   */
  mergeable?: boolean | null;
  /**
   * Trusted only when it is `dirty` (a conflict). `unknown` is not computed yet
   * (bean `h2s9`), and on a MERGED PR every value goes stale, serving the
   * pre-merge view (bean `fx5r`), which is why check 1 refuses a merged PR first.
   */
  mergeable_state?: string;
}

/** A workflow run as the Actions API returns it; `id` orders re-runs. */
export interface GuardRun extends RunRow {
  id?: number;
  created_at?: string;
  head_sha?: string | null;
}

/**
 * Everything the nine checks read, fetched once. The tests build this from
 * fixture JSON; {@link fetchSnapshot} builds it from GitHub.
 */
export interface GuardSnapshot {
  pr: GhPull;
  comments: GhComment[];
  timeline: GhTimelineEvent[];
  commits: GhCommit[];
  /** Merged PRs whose HEAD branch is this PR's base, or `unknown` when that could not be asked. */
  baseMergedAsHeadOf: number[] | { unknown: string };
  runs: HeadRunVerdict;
  scan: TriggerScan;
  /**
   * The workflow FILES (basenames) merge-main dispatches on a PR head it
   * pushed with the bot token, parsed from {@link MERGE_MAIN_WORKFLOW} by
   * {@link parseMergeMainDispatches}; `unknown` when that could not be read.
   */
  mergeMainDispatches: string[] | { unknown: string };
  /**
   * For each FAILED run of a not-waited-for workflow, by run id: the names of
   * its failed steps, or `unknown` when the jobs could not be read. Absent
   * means not fetched, which refuses as before.
   */
  failedSteps?: Record<number, string[] | { unknown: string }>;
  /**
   * The newest {@link AGENT_BUILD_CONTEXT} status on the head: `null` when the
   * head has none (no agent build), `unknown` when the statuses could not be
   * read. Absent means not fetched, and nothing is judged.
   */
  agentBuild?: GhStatus | null | { unknown: string };
  /**
   * The check runs on the head, for `--full-tier` ({@link fullTierCheck});
   * `unknown` when they could not be read. Absent means not fetched.
   */
  checkRuns?: GhCheckRun[] | { unknown: string };
}

/** A check run as `GET /repos/{repo}/commits/{ref}/check-runs` returns it. */
export interface GhCheckRun {
  id?: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at?: string | null;
}

/** A commit status as `GET /repos/{repo}/commits/{ref}/statuses` returns it (newest first). */
export interface GhStatus {
  context: string;
  state: string;
  description?: string | null;
  target_url?: string | null;
  created_at?: string;
}

export interface GuardOptions {
  /** The session that would merge. With `--merge` it is required. */
  mergingSession?: string;
  /** The login the merge would be made under, for check 2's actor half. */
  mergingActor?: string;
  /**
   * The merge manager is landing a PR it opened itself, so the PR's OWN
   * session is the merging one. Check 2 then drops its separation half — "the
   * merging session did not mark it ready" — because there is no second
   * session to separate from, and instead refuses unless {@link mergingSession}
   * (when given) IS the PR's own session. Every other check still applies.
   *
   * Only the merge manager merges (owner, 2026-11-13, cat-harness#1313), so
   * this is not "no merge manager is active, any session may merge" — the
   * meaning of its old name, `--no-merge-manager` (owner ruling 2026-10-06,
   * superseded). CLI: `--merge-manager-own-pr`, or the old name.
   */
  mergeManagerOwnPr?: boolean;
  /**
   * This merge is a RELEASE (owner, card Q-CIB-4 A, 2026-11-08): check 5
   * gates it. Without it, and without the {@link RELEASE_LABEL} label on the
   * PR, check 5 is advisory. CLI: `--release`.
   */
  release?: boolean;
  /**
   * Require the FULL tier on the head (check 5): a check run named as a
   * full-tier judge ({@link FULL_TIER_JUDGE}) concluded `success`. Implies
   * {@link release}: check 5 gates. The `merge-guard` status workflow sets it
   * (`layer-merge-guard.yml`), so the status means "full tier green" and can be
   * a required check. CLI: `--full-tier`.
   */
  fullTier?: boolean;
  /** For a fixture's clock; defaults to {@link READY_WINDOW_MS}. */
  readyWindowMs?: number;
}

export type CheckStatus = "pass" | "refuse" | "unknown" | "skip";

/**
 * What KIND of refusal — and so which commit-status state it posts.
 *
 * `not-ready` is the ordinary state of a PR nobody has finished yet: a draft,
 * no `ready:` marker, no label, an unticked box, CI still running, a question
 * still open, a head that main has moved out from under. `defect` is something WRONG: a base that is not `main` or is a
 * dead branch, `needs-merge-human`, red CI on the head, a marker or a
 * ready-flip by a session that is not the PR's own, a marker naming a commit
 * the PR does not have.
 *
 * The split exists because the status is posted on EVERY open PR. Painting
 * every draft red is noise that trains people to ignore red (coordinator,
 * 2026-10-03), so a PR that is merely unfinished posts `pending` and only a
 * defect posts `failure`. A required check blocks the merge in both states,
 * and the exit code is 1 in both: this changes what a reader SEES, never what
 * may merge.
 */
export type RefusalKind = "not-ready" | "defect";

export interface CheckResult {
  n: number;
  id: CheckId;
  status: CheckStatus;
  detail: string;
  /** Present on a refusal only. */
  kind?: RefusalKind;
}

/** The commit-status state a verdict posts. */
export type StatusState = "success" | "pending" | "failure" | "error";

export interface GuardVerdict {
  pr: number;
  head: string;
  verdict: "pass" | "refused" | "unknown";
  /** `pending` when every refusal is `not-ready`; `failure` when any is a `defect`. */
  state: StatusState;
  exitCode: 0 | 1 | 2;
  checks: CheckResult[];
}

// ─── text helpers ──────────────────────────────────────────────────────────

const SESSION_RE = /claude\.ai\/code\/(session_[A-Za-z0-9]+)/g;

/** Every session id a text links to, in order. */
export function sessionsIn(text: string | null | undefined): string[] {
  return [...(text ?? "").matchAll(SESSION_RE)].map((m) => m[1]!);
}

/**
 * The session a text is SIGNED by: the LAST session link in it, which is
 * where the footer convention puts it. Earlier links may name other sessions
 * being talked about.
 */
export function signingSession(text: string | null | undefined): string | undefined {
  return sessionsIn(text).at(-1);
}

/** Accept `session_…` or any URL containing it. */
export function normaliseSession(arg: string): string | undefined {
  const m = arg.match(/(session_[A-Za-z0-9]+)/);
  return m?.[1];
}

/** Text with fenced code blocks removed, so a quoted template cannot trip a check. */
export function withoutCode(text: string): string {
  return text.replace(/```[\s\S]*?(```|$)/g, "");
}

/**
 * `ready: <sha>` at the start of a line, optionally bolded or in backticks.
 * A quoted line (`> ready: …`) does not match, so quoting somebody's marker
 * is not making one.
 */
const READY_RE = /^[ \t]*\**[ \t]*ready:\**[ \t]*`?([0-9a-f]{7,40})\b/im;

export interface ReadyMarker {
  sha: string;
  /** The session that SIGNED the comment. */
  session: string | undefined;
  /** For a marker the merge manager relays: the session it speaks for ({@link relayedFor}). */
  relayedFor?: string;
  at: string;
  url?: string;
}

/**
 * `relayed for <session>` (an id or a URL containing one), on a line that is
 * not quoted, outside code. The merge manager writes it on a `ready: <sha>`
 * it posts for a session that told it the PR is ready, so the marker counts as
 * that session's own (check 3) and is not the merge manager marking the PR
 * ready (check 2).
 */
const RELAY_RE = /^(?![ \t]*>).*\brelayed for\b[^\n]*?(session_[A-Za-z0-9]+)/im;

/** The session a comment relays a `ready:` for, or `undefined`. */
export function relayedFor(body: string | null | undefined): string | undefined {
  return withoutCode(body ?? "").match(RELAY_RE)?.[1];
}

/** Every `ready:` comment, oldest first. */
export function readyMarkers(comments: readonly GhComment[]): ReadyMarker[] {
  const out: ReadyMarker[] = [];
  for (const c of byTime(comments)) {
    const m = withoutCode(c.body ?? "").match(READY_RE);
    if (!m) continue;
    const relay = relayedFor(c.body);
    out.push({
      sha: m[1]!.toLowerCase(),
      session: signingSession(c.body),
      ...(relay ? { relayedFor: relay } : {}),
      at: c.created_at,
      url: c.html_url,
    });
  }
  return out;
}

/** Does this marker speak for `own`: signed by it, or relayed for it? */
function speaksFor(m: ReadyMarker, own: string): boolean {
  return m.relayedFor === undefined ? m.session === own : m.relayedFor === own;
}

/**
 * Whether a comment is an ACK, queue, or hand-back note posted by the Merge
 * Manager / steward. Check 2 excludes these comments from ready-flip attribution
 * so an ACK posted near a ready flip is never mistaken for marking the PR ready
 * (bean `gdni`).
 */
export function isStewardAckComment(body: string | null | undefined): boolean {
  if (!body) return false;
  if (/<!--\s*(?:steward|merge):(?:ack|note|queue|hand-back)\s*-->/i.test(body)) {
    return true;
  }
  const text = withoutCode(body).trim();
  const firstLine = text.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
  return /^(?:#+\s*)?(?:\*\*|__)?(?:(?:merge[- ]queue\s+)?ack\b|\[ack\]|ack:\b|hand-?back\b|handed\s+back|queue\s+entry\b|(?:merge[- ]queue|queued|queueing)\b)/i.test(
    firstLine,
  );
}

/**
 * A line that claims the author or finishing agent converted the PR out of
 * draft and marked it ready for review.
 */
const READY_CLAIM_LINE_RE =
  /\b(?:mark(?:ed|ing|s)?\s+(?:it\s+)?ready|re-marked\s+ready|ready[- ]for[- ]review|converted\s+(?:it|this\s+pr\s+)?(?:to\s+draft\s+and\s+back|to\s+ready))\b/i;

/**
 * Whether a comment explicitly claims converting or marking the PR ready
 * (e.g. `ready: <sha>`, "Marking ready", "Re-marked ready"). Excludes steward
 * ACK notes ({@link isStewardAckComment}) and negative statements ("not ready").
 */
export function claimsReadyFlip(body: string | null | undefined): boolean {
  if (!body || isStewardAckComment(body)) return false;
  const text = withoutCode(body);
  if (READY_RE.test(text)) return true;
  for (const raw of text.split("\n")) {
    if (/^\s*>/.test(raw)) continue;
    if (/\b(?:not\s+ready|isn't\s+ready|is\s+not\s+ready|unready)\b/i.test(raw)) continue;
    if (READY_CLAIM_LINE_RE.test(raw)) return true;
  }
  return false;
}

function byTime<T extends { created_at?: string }>(xs: readonly T[]): T[] {
  return [...xs].sort((a, b) => Date.parse(a.created_at ?? "") - Date.parse(b.created_at ?? ""));
}

const short = (sha: string) => sha.slice(0, 10);

/** Heads named by merge-main's own comments: "pushed `<sha>`". Only the bot's comments count. */
export function botPushedShas(comments: readonly GhComment[]): string[] {
  return comments
    .filter((c) => c.user?.login === BOT_LOGIN && (c.body ?? "").trimStart().startsWith(MERGE_MAIN_MARKER))
    .flatMap((c) => [...(c.body ?? "").matchAll(/pushed `([0-9a-f]{7,40})`/g)].map((m) => m[1]!));
}

/**
 * A merge-main bot merge: a merge commit (two parents) authored by the bot,
 * or one the bot's own comment names as what it pushed.
 */
export function isBotMerge(c: GhCommit, botNamed: readonly string[]): boolean {
  if (c.parents.length < 2) return false;
  if (c.author?.login === BOT_LOGIN || c.commit.author?.name === BOT_LOGIN) return true;
  return botNamed.some((s) => c.sha.startsWith(s));
}

/** Unticked task-list items in a body, outside code. */
export function untickedItems(body: string | null | undefined): string[] {
  return withoutCode(body ?? "")
    .split("\n")
    .filter((l) => /^\s*[-*+]\s+\[ \]/.test(l))
    .map((l) => l.trim());
}

/**
 * Who a question has to be addressed to, for check 7 to count it.
 * `ownerLogin` is the repository owner's login.
 */
export function addresseeRe(ownerLogin: string | undefined): RegExp {
  const login = ownerLogin ? `|@${ownerLogin.replace(/[^A-Za-z0-9-]/g, "")}\\b` : "";
  // A request for a decision is addressed to whoever decides, which on a PR
  // is the owner — measured on #1937, whose open question ("Should I delete
  // the `_external` copy?") named nobody but said "I need a decision".
  return new RegExp(
    `\\b(owner|merge[- ]manager|merge[- ]steward|steward|decision|your call|please confirm|approve)\\b${login}`,
    "i",
  );
}

/** Sentences ending in `?`, in one line. A `?` inside a URL is followed by text, so it does not end one. */
export function questionsIn(line: string): string[] {
  return [...line.matchAll(/([^.!?\n]*\?)(?=[\s*_`)]|$)/g)]
    .map((m) => m[1]!.replace(/^[\s*_`>#-]+/, "").trim())
    .filter((q) => q.length > 1);
}

export interface OpenQuestion {
  line: string;
  url?: string;
  at: string;
}

/**
 * Check 7's heuristic: comments newer than `since`, not written by the bot,
 * that contain a sentence ending in `?` AND, somewhere in the same comment,
 * name the owner or the Merge Manager or ask for a decision ({@link addresseeRe}).
 *
 * **Its limits, stated so nobody reads a pass as "nothing is open":**
 *
 * - It misses a question with no `?` ("tell me whether…"), and one in a
 *   comment that neither names an addressee nor asks for a decision.
 * - It flags a rhetorical question, and a question already answered in a later
 *   comment: it cannot read an answer. The remedy is the owning session's: a
 *   fresh `ready: <sha>` comment after the question is settled moves the
 *   window past it.
 * - Quoted lines (`>`) and fenced code are ignored, so quoting a question does
 *   not re-open it, and a question asked only inside a quote is missed.
 * - It reads issue comments only, not review comments or review bodies.
 */
export function openQuestions(
  comments: readonly GhComment[],
  since: string,
  ownerLogin: string | undefined,
): OpenQuestion[] {
  const addressee = addresseeRe(ownerLogin);
  const out: OpenQuestion[] = [];
  for (const c of byTime(comments)) {
    if (Date.parse(c.created_at) <= Date.parse(since)) continue;
    if (c.user?.login === BOT_LOGIN) continue;
    const text = withoutCode(c.body ?? "");
    if (!addressee.test(text)) continue;
    for (const raw of text.split("\n")) {
      if (/^\s*>/.test(raw)) continue;
      for (const line of questionsIn(raw)) out.push({ line, url: c.html_url, at: c.created_at });
    }
  }
  return out;
}

/**
 * The workflow files merge-main dispatches after a bot-token push, from its
 * `for wf in a.yml b.yml; do gh workflow run "$wf" …` line. `undefined` when
 * that line is absent or names anything but workflow files: check 5 then
 * cannot say which held runs are owed a dispatch, and returns `unknown`.
 */
export function parseMergeMainDispatches(text: string): string[] | undefined {
  const m = text.match(/for\s+wf\s+in\s+([^;\n]+?)\s*;\s*do\s+gh\s+workflow\s+run\s+"?\$\{?wf\b/);
  if (!m) return undefined;
  const files = m[1]!.trim().split(/\s+/);
  return files.length > 0 && files.every((f) => /^[\w.-]+\.ya?ml$/.test(f)) ? files : undefined;
}

// ─── the checks ──────────────────────────────────────────────────────

const R = (n: number, id: CheckId, status: CheckStatus, detail: string, kind?: RefusalKind): CheckResult =>
  status === "refuse" ? { n, id, status, detail, kind: kind ?? "not-ready" } : { n, id, status, detail };

function checkBase(s: GuardSnapshot): CheckResult {
  const problems: string[] = [];
  if (s.pr.state !== "open" || s.pr.merged) problems.push(`the PR is ${s.pr.merged ? "already merged" : s.pr.state}`);
  if (s.pr.base.ref !== BASE) problems.push(`base is \`${s.pr.base.ref}\`, not \`${BASE}\``);
  if (!Array.isArray(s.baseMergedAsHeadOf)) {
    if (problems.length) return R(1, "base", "refuse", problems.join("; "), "defect");
    return R(1, "base", "unknown", `could not ask whether \`${s.pr.base.ref}\` is a merged PR's head: ${s.baseMergedAsHeadOf.unknown}`);
  }
  if (s.baseMergedAsHeadOf.length > 0) {
    problems.push(
      `base \`${s.pr.base.ref}\` is the head branch of merged PR ${s.baseMergedAsHeadOf.map((n) => `#${n}`).join(", ")}: a merge into it lands nowhere anyone reads`,
    );
  }
  return problems.length ? R(1, "base", "refuse", problems.join("; "), "defect") : R(1, "base", "pass", `base is \`${BASE}\``);
}

function checkReadyForReview(s: GuardSnapshot, o: GuardOptions): CheckResult {
  if (s.pr.draft) return R(2, "ready-for-review", "refuse", "the PR is a draft");
  const events = byTime(s.timeline.filter((e) => e.event === "ready_for_review"));
  const last = events.at(-1);
  if (!last) return R(2, "ready-for-review", "pass", "not a draft, and never converted from one");
  const at = Date.parse(last.created_at ?? "");
  const actor = last.actor?.login ?? "?";
  const own = signingSession(s.pr.body);
  const window = o.readyWindowMs ?? READY_WINDOW_MS;

  const separate = !o.mergeManagerOwnPr;
  if (separate && o.mergingActor && actor === o.mergingActor && actor !== s.pr.user?.login) {
    return R(2, "ready-for-review", "refuse", `marked ready at ${last.created_at} by \`${actor}\`, the merging actor`, "defect");
  }
  const near = s.comments
    .map((c) => ({
      c,
      session: signingSession(c.body),
      dt: Math.abs(Date.parse(c.created_at) - at),
      // A relayed marker reports the PR's own session's word; it is not the
      // relaying merge manager marking the PR ready.
      isAck: isStewardAckComment(c.body) || relayedFor(c.body) !== undefined,
      claims: claimsReadyFlip(c.body),
    }))
    .filter((x): x is typeof x & { session: string } => Boolean(x.session) && x.dt <= window)
    .sort((a, b) => a.dt - b.dt);

  const nonAck = near.filter((x) => !x.isAck);
  const claiming = nonAck.filter((x) => x.claims);
  const ownClaim = claiming.find((x) => x.session === own);
  const ownComment = nonAck.find((x) => x.session === own);

  // Check 2 attributes a ready flip only to a session whose signed comment
  // claims the flip (e.g. a `marked ready` line) or is the PR's author/takeover
  // session from the body's session line — never by time proximity to an ACK
  // (bean `gdni`).
  const attributed = ownClaim?.session ?? claiming[0]?.session ?? ownComment?.session;

  if (separate && o.mergingSession) {
    const mergingClaimed = claiming.some((x) => x.session === o.mergingSession);
    const mergingAttributed = attributed === o.mergingSession;
    if (mergingClaimed || mergingAttributed) {
      return R(
        2,
        "ready-for-review",
        "refuse",
        `marked ready at ${last.created_at} (actor \`${actor}\`) beside a comment signed by the MERGING session \`${o.mergingSession}\`: the steward may not mark a PR ready and then merge it`,
        "defect",
      );
    }
  }

  if (!own || attributed !== own) {
    // Signed by somebody ELSE is a defect; signed by nobody is merely unfinished.
    const kind: RefusalKind = attributed && own ? "defect" : "not-ready";
    return R(
      2,
      "ready-for-review",
      "refuse",
      `marked ready at ${last.created_at} (actor \`${actor}\`), and that cannot be attributed to the PR's own session ` +
        `(${own ? `\`${own}\`` : "its body names none"}): the nearest session-signed comment within ${Math.round(window / 60000)} min ` +
        `${attributed ? `is signed \`${attributed}\`` : "does not exist"}. The owning session marks the PR ready and posts its \`ready: <sha>\` together`,
      kind,
    );
  }
  if (o.mergeManagerOwnPr && o.mergingSession && o.mergingSession !== own) {
    return R(
      2,
      "ready-for-review",
      "refuse",
      `--merge-manager-own-pr is for the merge manager landing its OWN PR, but the merging session \`${o.mergingSession}\` is not this PR's own session \`${own}\``,
      "defect",
    );
  }
  const lifted = o.mergeManagerOwnPr
    ? "; the merge manager is landing its own PR, so the merging session is not separated from it (--merge-manager-own-pr)"
    : "";
  return R(2, "ready-for-review", "pass", `marked ready at ${last.created_at} by the PR's own session \`${own}\`${lifted}`);
}

function latestOwnMarker(s: GuardSnapshot): ReadyMarker | undefined {
  const own = signingSession(s.pr.body);
  return own ? readyMarkers(s.comments).filter((m) => speaksFor(m, own)).at(-1) : undefined;
}

/** When the head was pushed, as far as the record shows: the latest of the dates below. */
function pushedAt(s: GuardSnapshot, c: GhCommit): number | undefined {
  const dates = [c.commit.committer?.date, c.commit.author?.date];
  // A workflow run starts when the commit reaches GitHub, so the earliest run
  // on the sha bounds the push from below even when the commit's own date is old.
  if (s.runs.state === "has-run") {
    const onSha = (s.runs.runs as GuardRun[]).filter((r) => r.head_sha && c.sha.toLowerCase().startsWith(r.head_sha.toLowerCase()));
    const first = onSha.map((r) => Date.parse(r.created_at ?? "")).filter(Number.isFinite).sort((a, b) => a - b)[0];
    if (first !== undefined) dates.push(new Date(first).toISOString());
  }
  for (const e of s.timeline) if (e.event === "head_ref_force_pushed") dates.push(e.created_at);
  const ms = dates.map((d) => Date.parse(d ?? "")).filter(Number.isFinite);
  return ms.length ? Math.max(...ms) : undefined;
}

export type LabelReady = { ok: true; at: string; detail: string } | { ok: false; why: string };

/**
 * Check 3's label path, for an agent that cannot send messages (owner,
 * 2026-11-13): the PR carries {@link READY_LABEL}, and the timeline's latest
 * `labeled` event for it is later than the last push of any commit that is
 * not a merge-main bot merge.
 *
 * "The last push" is read from what the record keeps, since GitHub records no
 * push event for a plain push: the commit's committer and author dates, the
 * earliest workflow run on that sha, and every `head_ref_force_pushed`. A
 * commit made before the label but pushed after it, on a head with no run
 * yet, is the case it can miss; check 5's runs on the head are then still
 * pending, and the next push re-dates the head.
 */
export function labelReady(s: GuardSnapshot): LabelReady {
  if (!s.pr.labels.some((l) => l.name === READY_LABEL)) return { ok: false, why: `\`${READY_LABEL}\` is absent` };
  const added = byTime(s.timeline.filter((e) => e.event === "labeled" && e.label?.name === READY_LABEL)).at(-1);
  if (!added?.created_at) return { ok: false, why: `the timeline shows no \`labeled ${READY_LABEL}\` event` };
  if (s.commits.length >= COMMITS_API_CAP) return { ok: false, why: `the PR has ${COMMITS_API_CAP}+ commits, more than the API returns` };
  const named = botPushedShas(s.comments);
  const lastOwn = s.commits.filter((c) => !isBotMerge(c, named)).at(-1) ?? s.commits.at(-1);
  if (!lastOwn) return { ok: false, why: "the PR has no commits" };
  const pushed = pushedAt(s, lastOwn);
  if (pushed === undefined) return { ok: false, why: `no date for the push of \`${short(lastOwn.sha)}\`` };
  const pushedIso = new Date(pushed).toISOString();
  if (Date.parse(added.created_at) <= pushed) {
    return { ok: false, why: `\`${READY_LABEL}\` was added at ${added.created_at}, not after the last push (\`${short(lastOwn.sha)}\`, ${pushedIso})` };
  }
  const after = s.commits.length - 1 - s.commits.indexOf(lastOwn);
  return {
    ok: true,
    at: added.created_at,
    detail: `\`${READY_LABEL}\` added at ${added.created_at}, after the last push (\`${short(lastOwn.sha)}\`, ${pushedIso})${after ? `; the ${after} commit(s) after it are merge-main bot merges` : ""}`,
  };
}

/**
 * Check 3 by its marker and, where that does not pass, by the label: a pass
 * on either passes. A refusal keeps the marker's detail and kind, with why the
 * label did not stand in.
 */
function checkReadyMarker(s: GuardSnapshot): CheckResult {
  const byMarker = checkReadyMarkerComment(s);
  if (byMarker.status === "pass") return byMarker;
  const label = labelReady(s);
  if (label.ok) return R(3, "ready-marker", "pass", label.detail);
  const hasLabel = s.pr.labels.some((l) => l.name === READY_LABEL);
  return hasLabel ? { ...byMarker, detail: `${byMarker.detail}; nor does the label stand in: ${label.why}` } : byMarker;
}

function checkReadyMarkerComment(s: GuardSnapshot): CheckResult {
  const own = signingSession(s.pr.body);
  if (!own) {
    return R(3, "ready-marker", "refuse", "the PR body links no session, so no `ready:` comment can be attributed to the PR's own session");
  }
  const all = readyMarkers(s.comments);
  const marker = latestOwnMarker(s);
  if (!marker) {
    if (all.length === 0) return R(3, "ready-marker", "refuse", "no `ready: <sha>` comment");
    const seen = all
      .map((m) => `\`${short(m.sha)}\` signed ${m.session ? `\`${m.session}\`` : "by no session"}${m.relayedFor ? ` relayed for \`${m.relayedFor}\`` : ""}`)
      .join(", ");
    const kind: RefusalKind = all.some((m) => (m.relayedFor ?? m.session) && (m.relayedFor ?? m.session) !== own) ? "defect" : "not-ready";
    return R(3, "ready-marker", "refuse", `no \`ready:\` comment is signed by the PR's own session \`${own}\` (found: ${seen})`, kind);
  }
  const head = s.pr.head.sha.toLowerCase();
  const via = marker.relayedFor ? `, relayed for \`${own}\` by ${marker.session ? `\`${marker.session}\`` : "an unsigned comment"}` : "";
  if (head.startsWith(marker.sha)) return R(3, "ready-marker", "pass", `\`ready: ${short(marker.sha)}\` names the head${via}`);
  const i = s.commits.findIndex((c) => c.sha.toLowerCase().startsWith(marker.sha));
  if (i < 0) {
    if (s.commits.length >= COMMITS_API_CAP) {
      return R(3, "ready-marker", "unknown", `ready sha \`${short(marker.sha)}\` is not among the first ${COMMITS_API_CAP} commits, which is all the API returns`);
    }
    return R(3, "ready-marker", "refuse", `ready sha \`${short(marker.sha)}\` is not a commit on this PR (head \`${short(head)}\`)`, "defect");
  }
  const named = botPushedShas(s.comments);
  const after = s.commits.slice(i + 1);
  const foreign = after.filter((c) => !isBotMerge(c, named));
  if (foreign.length) {
    const list = foreign
      .map((c) => `\`${short(c.sha)}\` by ${c.author?.login ?? c.commit.author?.name ?? "?"}${c.parents.length > 1 ? " (merge)" : ""}`)
      .join(", ");
    return R(
      3,
      "ready-marker",
      "refuse",
      `the head \`${short(head)}\` is newer than \`ready: ${short(marker.sha)}\`, and ${foreign.length} commit(s) after it are not merge-main bot merges: ${list}`,
    );
  }
  return R(3, "ready-marker", "pass", `\`ready: ${short(marker.sha)}\`${via}; the ${after.length} commit(s) after it are merge-main bot merges`);
}

function checkLabels(s: GuardSnapshot): CheckResult {
  const labels = s.pr.labels.map((l) => l.name);
  const problems: string[] = [];
  if (!labels.includes(READY_LABEL)) problems.push(`\`${READY_LABEL}\` is absent`);
  if (labels.includes(HUMAN_LABEL)) problems.push(`\`${HUMAN_LABEL}\` is present`);
  const kind: RefusalKind = labels.includes(HUMAN_LABEL) ? "defect" : "not-ready";
  return problems.length ? R(4, "labels", "refuse", problems.join("; "), kind) : R(4, "labels", "pass", `\`${READY_LABEL}\`, no \`${HUMAN_LABEL}\``);
}

function runOrder(r: GuardRun): number {
  return r.id ?? Number(r.html_url?.match(/\/runs\/(\d+)/)?.[1] ?? 0);
}

/** A finished run whose every job was skipped: it judged nothing. */
const allSkipped = (r: GuardRun) => r.status === "completed" && r.conclusion === "skipped";

/**
 * The latest run per workflow name, by {@link runOrder}. A run whose every job
 * skipped judged nothing, so it never displaces another run of the same
 * workflow on the head: a `labeled` run for a label other than `release`
 * (`ready-to-merge`, added after the full tier) skips every job, and taken as
 * the latest it would read a red full tier as passed (owner, 2026-11-11,
 * card B). It stands only when no run of that workflow judged anything.
 */
function latestByName(runs: readonly GuardRun[]): Map<string, GuardRun> {
  const latest = new Map<string, GuardRun>();
  for (const r of runs) {
    const prev = latest.get(r.name);
    const newer = !prev || runOrder(r) > runOrder(prev);
    if (!prev || (allSkipped(prev) && !allSkipped(r)) || (newer && (!allSkipped(r) || allSkipped(prev)))) latest.set(r.name, r);
  }
  return latest;
}

/** What a held `pull_request` run resolves to, once its stand-in is looked for. */
type HeldOutcome =
  | { ok: true; how: "dispatch"; run: GuardRun }
  | { ok: true; how: "not-judged" }
  | { ok: false; problem: string; kind: RefusalKind }
  | { unknown: string };

function checkCi(s: GuardSnapshot): CheckResult {
  if (s.runs.state === "cannot-ask") return R(5, "ci", "unknown", `could not read the head's runs: ${s.runs.reason}`);
  if (s.scan.unreadable.length) {
    return R(5, "ci", "unknown", `could not read ${s.scan.unreadable.map((u) => u.file).join(", ")}, so the owed set is not established`);
  }
  const head = s.pr.head.sha.toLowerCase();
  // `runsForHead` asks by head_sha already; this is belt and braces for a run
  // that carries its sha, so a dispatch on another commit can never stand in.
  const onHead = (r: GuardRun) => !r.head_sha || r.head_sha.toLowerCase() === head;
  const all: GuardRun[] = (s.runs.state === "has-run" ? (s.runs.runs as GuardRun[]) : []).filter(onHead);
  const selfNames = new Set(s.scan.triggers.filter((t) => t.file === SELF_WORKFLOW_FILE).map((t) => t.name));
  const prRuns = all.filter((r) => r.event === "pull_request" && !selfNames.has(r.name));
  const dispatchRuns = latestByName(all.filter((r) => r.event === "workflow_dispatch" && !selfNames.has(r.name)));

  // A `workflow_dispatch` run counts ONLY as the stand-in for a `pull_request`
  // run GitHub held for approval (`NOT_EXECUTED`) on a head that is a
  // merge-main bot merge. merge-main pushes with the bot token, GitHub holds
  // the PR's own runs at `action_required` (bean `0qjq`), and merge-main then
  // dispatches the gating workflows on the branch. Everywhere else a dispatch
  // resolves `refs/heads/<branch>`, not the merge ref (`yv4z`) — but here
  // merge-main has ALREADY merged main into the head, so the head IS the merge
  // and a dispatch on it judges the tree that would land. A green dispatch
  // never rescues a `pull_request` run that executed and went red (#1937).
  const headCommit = s.commits.find((c) => c.sha.toLowerCase() === head);
  const botHead = headCommit !== undefined && isBotMerge(headCommit, botPushedShas(s.comments));
  const fileOf = (name: string) => s.scan.triggers.find((t) => t.name === name)?.file;
  const baseName = (file: string) => file.split("/").at(-1)!;

  const held = new Map<string, HeldOutcome>();
  const resolveHeld = (name: string, conclusion: string): HeldOutcome => {
    const cached = held.get(name);
    if (cached) return cached;
    const out = ((): HeldOutcome => {
      if (!botHead) {
        return { ok: false, problem: `${name}: ${conclusion}, and the head is not a merge-main bot merge, so no dispatch can stand in`, kind: "not-ready" };
      }
      const d = dispatchRuns.get(name);
      if (d) {
        const ref = `its \`workflow_dispatch\` stand-in${d.id ? ` (run ${d.id})` : ""}`;
        if (d.status !== "completed") return { ok: false, problem: `${name}: ${conclusion}; ${ref} is ${d.status}`, kind: "not-ready" };
        if (PASSING.has(d.conclusion ?? "")) return { ok: true, how: "dispatch", run: d };
        const kind: RefusalKind = NOT_EXECUTED.has(d.conclusion ?? "") ? "not-ready" : "defect";
        return { ok: false, problem: `${name}: ${conclusion}; ${ref} is ${d.conclusion}`, kind };
      }
      if (!Array.isArray(s.mergeMainDispatches)) return { unknown: s.mergeMainDispatches.unknown };
      const file = fileOf(name);
      if (file && !s.mergeMainDispatches.includes(baseName(file))) return { ok: true, how: "not-judged" };
      return {
        ok: false,
        problem: file
          ? `${name}: ${conclusion}, and the \`workflow_dispatch\` merge-main owes for \`${baseName(file)}\` has not appeared`
          : `${name}: ${conclusion}, no \`workflow_dispatch\` on the head, and no workflow file declares that name, so whether merge-main owes one is not established`,
        kind: "not-ready",
      };
    })();
    held.set(name, out);
    return out;
  };

  const problems = new Map<string, { text: string; kind: RefusalKind }>();
  const problem = (name: string, text: string, kind: RefusalKind) => {
    if (!problems.has(name)) problems.set(name, { text, kind });
  };

  // Judged once finished, never waited for (bean `gnnj`). Matched by FILE and
  // mapped to the run NAME the scan reads from that file, as `selfNames` is.
  const notWaitedNames = new Set(
    s.scan.triggers.filter((t) => NOT_WAITED_FOR_WORKFLOW_FILES.has(t.file)).map((t) => t.name),
  );
  const notWaited: string[] = [];

  const latest = latestByName(prRuns);
  for (const [name, r] of latest) {
    if (r.status !== "completed" && notWaitedNames.has(name)) notWaited.push(`${name} (${r.status})`);
    else if (r.status !== "completed") problem(name, `${name}: ${r.status}`, "not-ready");
    else if (NOT_EXECUTED.has(r.conclusion ?? "")) {
      // A run that never executed is not a verdict on the tree, so it is not
      // red either; on a bot-merged head its dispatch may stand in for it.
      const o = resolveHeld(name, r.conclusion ?? "");
      if ("unknown" in o) {
        return R(5, "ci", "unknown", `\`${name}\` was held for approval and has no dispatch, and \`.github/workflows/merge-main.yml\` could not be read for the workflows it dispatches: ${o.unknown}`);
      }
      if (!o.ok) problem(name, o.problem, o.kind);
    } else if (!PASSING.has(r.conclusion ?? "")) {
      const steps = notWaitedNames.has(name) && r.id !== undefined ? s.failedSteps?.[r.id] : undefined;
      if (Array.isArray(steps) && steps.length > 0 && steps.every((x) => x === DEPLOY_ONLY_STEP)) {
        notWaited.push(`${name} (${r.conclusion} in the deploy step only)`);
      } else problem(name, `${name}: ${r.conclusion}`, "defect");
    }
  }

  // The agent-built preview's verify (folio-assistant#2881): judged once it
  // has an answer, never waited for, as Feature Staging is.
  const ab = s.agentBuild;
  if (ab !== undefined && ab !== null) {
    if ("unknown" in ab) {
      return R(5, "ci", "unknown", `could not read the head's \`${AGENT_BUILD_CONTEXT}\` status: ${ab.unknown}`);
    }
    const why = ab.description ? ` (${ab.description})` : "";
    if (ab.state === "failure" || ab.state === "error") {
      problem(AGENT_BUILD_CONTEXT, `${AGENT_BUILD_CONTEXT}: ${ab.state}${why}`, "defect");
    } else if (ab.state === "pending") {
      notWaited.push(`${AGENT_BUILD_CONTEXT} (pending: the verify rebuild has not reported)`);
    }
  }

  // Coverage applies the same substitution: a required workflow whose only
  // `pull_request` runs were held is satisfied by its stand-in, per the rules above.
  const scan: TriggerScan = { ...s.scan, triggers: s.scan.triggers.filter((t) => t.file !== SELF_WORKFLOW_FILE) };
  const cov = coverageFor(all, scan, "pull_request");
  for (const w of cov.required) {
    if (w.ran) continue;
    if (notWaitedNames.has(w.name)) {
      if (!latest.has(w.name)) notWaited.push(`${w.name} (${w.state})`);
      continue;
    }
    if (w.state === "blocked") {
      const o = resolveHeld(w.name, latest.get(w.name)?.conclusion ?? "blocked");
      if ("unknown" in o) {
        return R(5, "ci", "unknown", `\`${w.name}\` was held for approval and has no dispatch, and \`.github/workflows/merge-main.yml\` could not be read for the workflows it dispatches: ${o.unknown}`);
      }
      if (!o.ok) problem(w.name, o.problem, o.kind);
      continue;
    }
    problem(w.name, `${w.name}: ${w.state}`, "not-ready");
  }

  const standIns = [...held].filter(([, o]) => "ok" in o && o.ok && o.how === "dispatch").map(([n]) => n).sort();
  const notJudged = [...held].filter(([, o]) => "ok" in o && o.ok && o.how === "not-judged").map(([n]) => n).sort();
  const unused = [...dispatchRuns.values()].filter((r) => r.conclusion === "success" && !standIns.includes(r.name)).length;
  const notes = [
    standIns.length
      ? `${standIns.length} held for approval on this bot-merged head and judged by its green \`workflow_dispatch\` run: ${standIns.join(", ")}`
      : "",
    notJudged.length ? `not judged (preview-only, not dispatched by merge-main): ${notJudged.join(", ")}` : "",
    notWaited.length ? `not waited for (judged only once finished, bean \`gnnj\`): ${notWaited.join(", ")}` : "",
    unused
      ? `${unused} green \`workflow_dispatch\` run(s) on this head are not counted: a dispatch stands in only for a \`pull_request\` run held for approval on a bot-merged head`
      : "",
  ].filter(Boolean);
  const note = notes.length ? ` (${notes.join("; ")})` : "";

  if (prRuns.length === 0) return R(5, "ci", "refuse", `no \`pull_request\` run names the head${note}`);
  if (problems.size) {
    const list = [...problems.values()];
    const kind: RefusalKind = list.some((p) => p.kind === "defect") ? "defect" : "not-ready";
    return R(5, "ci", "refuse", `\`pull_request\` CI on the head is not green: ${list.map((p) => p.text).join("; ")}${note}`, kind);
  }
  const how = standIns.length || notJudged.length ? ", once held runs are resolved" : "";
  const finished = [...latest.values()].filter((r) => r.status === "completed" || !notWaitedNames.has(r.name)).length;
  return R(5, "ci", "pass", `${finished} \`pull_request\` workflow(s) on the head, all success or skipped${how}${note}`);
}

function checkChecklist(s: GuardSnapshot): CheckResult {
  const items = untickedItems(s.pr.body);
  return items.length
    ? R(6, "checklist", "refuse", `${items.length} unticked item(s) in the body: ${items.map((i) => `"${i}"`).join(", ")}`)
    : R(6, "checklist", "pass", "no unticked item");
}

function checkOpenQuestion(s: GuardSnapshot): CheckResult {
  const marker = latestOwnMarker(s);
  const markerComment = marker && s.comments.find((c) => c.created_at === marker.at);
  // With no marker, the `ready-to-merge` label that stood in for it (check 3) is the point to measure from.
  const label = labelReady(s);
  const since = marker && markerComment ? marker.at : label.ok ? label.at : undefined;
  if (since === undefined) return R(7, "open-question", "skip", "no ready marker to measure from (check 3)");
  const qs = openQuestions(s.comments, since, s.pr.base.repo?.owner?.login ?? "litlfred");
  return qs.length
    ? R(
        7,
        "open-question",
        "refuse",
        `${qs.length} question(s) to the owner or the Merge Manager after the ready marker: ${qs.map((q) => `"${q.line}"${q.url ? ` (${q.url})` : ""}`).join("; ")}`,
      )
    : R(7, "open-question", "pass", "no question to the owner or the Merge Manager after the ready marker (heuristic)");
}

/**
 * Check 8 (bean `vihx`): the head still merges cleanly into the base.
 *
 * GitHub's own answer, from the PR record. Only a conflict refuses:
 * `unstable` (a non-required check failing) and `blocked` (a required check
 * or review outstanding) are about CI and review, which check 5 and the
 * owner judge, and refusing on them here would make one red run two
 * refusals. `null` is "not computed yet", which is not "clean".
 */
function checkMergeable(s: GuardSnapshot): CheckResult {
  const { mergeable, mergeable_state: state } = s.pr;
  // Only `dirty` refuses; any other state is shown, never judged. On a merged
  // PR the field is stale (bean `fx5r`), but check 1 has refused that PR already.
  const st = state ? ` (\`mergeable_state: ${state}\`)` : "";
  if (mergeable === false || state === "dirty") {
    return R(
      8,
      "mergeable",
      "refuse",
      `the head \`${short(s.pr.head.sha)}\` conflicts with \`${s.pr.base.ref}\`${st}: green CI on it predates the move of \`${s.pr.base.ref}\`. Merge \`${s.pr.base.ref}\` into the head and re-sign \`ready:\``,
    );
  }
  if (mergeable === true) return R(8, "mergeable", "pass", `merges cleanly into \`${s.pr.base.ref}\`${st}`);
  return R(
    8,
    "mergeable",
    "unknown",
    mergeable === null
      ? `GitHub has not computed whether the head merges into \`${s.pr.base.ref}\` yet${st}; re-run the guard`
      : "the PR record carries no `mergeable` field",
  );
}


// ─── check 9: content review ──────────────────────────────────────────────

/** The PR-body heading under which a content PR documents its review. */
export const CONTENT_REVIEW_HEADING = "Content review";

/**
 * What counts as a pointer to a review record inside the "Content review"
 * section: a link, an owner decision card (`Q-RA-VAL-2`), a bean id
 * (`folio-assistant-n6ny`), or a path to an editing-hci-validation instance
 * or a review log in the repository.
 */
const RECORD_PATTERNS: readonly RegExp[] = [
  /https?:\/\/\S+/g,
  /\bQ-[A-Z0-9]+(?:-[A-Z0-9]+)+\b/g,
  /\bfolio-assistant-[a-z0-9]{4}\b/g,
  /(?:^|[\s`(])((?:beans|review|processes|test\/attestations)\/[\w./-]*editing-hci-validation[\w./-]*|review\/[\w./-]+)/g,
];

/** A section that only says the review has not happened yet. */
const PLACEHOLDER = /^(?:\s|[-*>]|_|tbd|todo|pending|none|n\/a|not yet|to do|\.|:)*$/i;

/**
 * `text` with every HTML comment removed, including one that spans lines
 * and one left open to the end (a template's hint is not a record).
 */
export function stripHtmlComments(text: string): string {
  let out = "";
  let at = 0;
  for (;;) {
    const open = text.indexOf("<!--", at);
    if (open < 0) return out + text.slice(at);
    out += text.slice(at, open);
    const close = text.indexOf("-->", open + 4);
    if (close < 0) return out;
    at = close + 3;
  }
}

export interface ContentReviewRecord {
  ok: boolean;
  /** The pointers found, when `ok`. */
  records: string[];
  why: string;
}

/**
 * The "Content review" section of a PR body (`## Content review` or
 * `### Content review`, up to the next heading of the same or a higher
 * level), and the review records it points to. Pure.
 */
export function contentReviewRecord(body: string | null | undefined): ContentReviewRecord {
  const lines = (body ?? "").split(/\r?\n/);
  const at = lines.findIndex((l) => /^(#{2,3})\s+Content review\s*:?\s*$/i.test(l.trim()));
  if (at < 0) return { ok: false, records: [], why: `the body has no \`## ${CONTENT_REVIEW_HEADING}\` section` };
  const level = (lines[at]!.trim().match(/^#+/) ?? ["##"])[0].length;
  const section: string[] = [];
  for (const l of lines.slice(at + 1)) {
    const h = l.trim().match(/^(#+)\s/);
    if (h && h[1]!.length <= level) break;
    section.push(l);
  }
  const text = stripHtmlComments(section.join("\n"));
  if (PLACEHOLDER.test(text)) return { ok: false, records: [], why: `the \`${CONTENT_REVIEW_HEADING}\` section is empty or a placeholder` };
  const records = [...new Set(RECORD_PATTERNS.flatMap((re) => [...text.matchAll(re)].map((m) => (m[1] ?? m[0]).replace(/[).,]+$/, ""))))];
  return records.length
    ? { ok: true, records, why: "" }
    : {
        ok: false,
        records: [],
        why: `the \`${CONTENT_REVIEW_HEADING}\` section names no review record (a link, an owner card id such as \`Q-RA-VAL-2\`, a bean id, or an editing-hci-validation instance path)`,
      };
}

/**
 * Check 9 (owner, 2026-11-15): a PR labelled {@link CONTENT_LABEL} documents
 * its content review in the body before it is ready. A content draft with no
 * record is not-ready (pending); a content PR marked ready with no record is
 * a defect (failure), because the record is part of making it ready. A PR
 * without the label passes: it is not content.
 */
function checkContentReview(s: GuardSnapshot): CheckResult {
  if (!s.pr.labels.some((l) => l.name === CONTENT_LABEL)) return R(9, "content-review", "pass", `not a content PR (no \`${CONTENT_LABEL}\` label)`);
  const rec = contentReviewRecord(s.pr.body);
  if (rec.ok) return R(9, "content-review", "pass", `content review documented: ${rec.records.slice(0, 4).join(", ")}${rec.records.length > 4 ? ", …" : ""}`);
  return s.pr.draft
    ? R(9, "content-review", "refuse", `a \`${CONTENT_LABEL}\` PR needs its review documented before it is ready: ${rec.why}`)
    : R(9, "content-review", "refuse", `marked ready without a documented content review: ${rec.why}. Convert it back to draft, or add the \`## ${CONTENT_REVIEW_HEADING}\` section`, "defect");
}

/** Run the nine checks. Pure: everything it reads is in `s`. */
/** The label that makes a merge a release, so CI gates it (check 5). */
export const RELEASE_LABEL = "release";

const ADVISORY_RULING = 'owner, card Q-CIB-4 A, 2026-11-08: "CI not gate on non-release merge to main"';

/**
 * A full-tier judge: the job that joins the full tier's verdict —
 * `layer-pr-checks.yml`'s "No new failures (tests and gates)" and
 * `pr-tests.yml`'s "Tests (no new failures)". The fast tier reports as "Fast
 * tier only (advisory; …)", which this does not match.
 */
export const FULL_TIER_JUDGE = /no new failures/i;

/**
 * A check run that judged nothing: `skipped` (the fast tier skips the full
 * tier's judge), or a job whose name GitHub never rendered (`${{ … }}` still
 * in it — the skipped judge of a run whose tier was decided in the same job,
 * whose template text names both tiers). Neither is a full-tier verdict.
 */
/**
 * A test shard: `bun test (head, 2/4)` (`pr-tests.yml`) or `head — tests and
 * gates, shard 2/3` (`layer-pr-checks.yml`); merge-watch's `SHARD`. The fast
 * tier skips every shard, and `pr-tests.yml`'s judge still concludes `success`
 * on it (measured on #2103, 2026-11-13), so the judge alone does not say the
 * full tier ran: a shard that RAN does.
 */
export const SHARD = /(?:shard |, )(\d+)\/(\d+)\b/i;

/**
 * A job name that is still template text. GitHub shows some with the `${{ }}`
 * and some without it, as `needs.<job>.outputs.full == 'false' && '…' || '…'`
 * (dth-hrh#133, 2026-11-14: a run cancelled before its tier was decided). The
 * run that followed it was green, and this cancelled one kept check 5 red.
 */
const UNRENDERED = /\$\{\{|\bneeds\.[\w-]+\.outputs\./;

function judgedNothing(c: GhCheckRun): boolean {
  return c.conclusion === "skipped" || UNRENDERED.test(c.name);
}

/**
 * `--full-tier`: did the full tier run on the head and pass? The latest run of
 * each full-tier judge (by name) must have concluded `success`; a skipped or
 * unrendered one judged nothing and is not counted; and at least one test
 * shard ({@link SHARD}) must have run, since a fast-tier judge can be green
 * too. None at all is
 * not-ready (only the fast tier ran: label the PR `ready-to-merge` or
 * `release`, which runs the full tier); one in progress is not-ready; one red
 * is a defect.
 */
export function fullTierCheck(s: GuardSnapshot): CheckResult {
  if (s.checkRuns === undefined) return R(5, "ci", "unknown", "the head's check runs were not fetched, so the full tier cannot be judged");
  if (!Array.isArray(s.checkRuns)) return R(5, "ci", "unknown", `could not read the head's check runs: ${s.checkRuns.unknown}`);
  const latest = new Map<string, GhCheckRun>();
  for (const c of s.checkRuns.filter((x) => FULL_TIER_JUDGE.test(x.name) && !judgedNothing(x))) {
    const had = latest.get(c.name);
    const order = (x: GhCheckRun) => Date.parse(x.started_at ?? "") || x.id || 0;
    if (!had || order(c) >= order(had)) latest.set(c.name, c);
  }
  const judges = [...latest.values()];
  if (judges.length === 0) {
    return R(5, "ci", "refuse", "the full tier has not run on the head (no `No new failures` judge; only the fast tier, or nothing). the `release` label runs it (and `ready-to-merge` too, in a layer whose PR checks read the live labels; this repository's `pr-tests.yml` reads only `release`)");
  }
  const red = judges.filter((j) => j.status === "completed" && j.conclusion !== "success");
  if (red.length) return R(5, "ci", "refuse", `full-tier judge red: ${red.map((j) => `${j.name} (${j.conclusion})`).join(", ")}`, "defect");
  const going = judges.filter((j) => j.status !== "completed");
  if (going.length) return R(5, "ci", "refuse", `full-tier judge not finished: ${going.map((j) => j.name).join(", ")}`);
  const ran = s.checkRuns.filter((c) => SHARD.test(c.name) && !judgedNothing(c) && c.status === "completed" && c.conclusion !== "cancelled");
  if (ran.length === 0) {
    return R(5, "ci", "refuse", `the full tier has not run on the head: ${judges.map((j) => j.name).join(", ")} is green, but no test shard ran (the fast tier). the \`release\` label runs it (and \`ready-to-merge\` too, in a layer whose PR checks read the live labels; this repository's \`pr-tests.yml\` reads only \`release\`)`);
  }
  return R(5, "ci", "pass", `full tier green: ${judges.map((j) => j.name).join(", ")}, after ${ran.length} test shard(s) ran`);
}

/** Check 5 under `--full-tier`: the workflow-run judgement gates, AND the full tier must be green. */
export function withFullTier(ci: CheckResult, s: GuardSnapshot): CheckResult {
  const full = fullTierCheck(s);
  if (ci.status === "pass") return full.status === "pass" ? { ...ci, detail: `${ci.detail}; ${full.detail}` } : full;
  if (full.status === "pass") return ci;
  // Both failed: the worse kind wins, and both details are kept.
  const status = ci.status === "unknown" || full.status === "unknown" ? "unknown" : "refuse";
  const kind: RefusalKind | undefined = status === "refuse" ? (ci.kind === "defect" || full.kind === "defect" ? "defect" : "not-ready") : undefined;
  return R(5, "ci", status, `${ci.detail}; ${full.detail}`, kind);
}

/** A release merge: `--release`, or the PR carries {@link RELEASE_LABEL}. */
export function isRelease(s: GuardSnapshot, o: GuardOptions = {}): boolean {
  return o.release === true || s.pr.labels.some((l) => l.name === RELEASE_LABEL);
}

/**
 * Check 5 on a NON-release merge: reported, never a refusal. The full suite
 * gates the release instead (release-gated CI, cat-harness
 * `release-lifecycle`). What CI said is kept in the detail, so the verdict
 * still shows a red or unread head.
 */
export function advisoryCi(c: CheckResult): CheckResult {
  if (c.status === "pass") return { ...c, detail: `${c.detail} (advisory: not a gate on a non-release merge)` };
  const what = c.status === "unknown" ? "could not be judged" : "is not green";
  return R(5, "ci", "pass", `advisory, not a gate: CI ${what} (${c.detail}). A non-release merge does not wait for CI (${ADVISORY_RULING}); \`--release\` or the \`${RELEASE_LABEL}\` label makes it a gate`);
}

export function evaluate(s: GuardSnapshot, o: GuardOptions = {}): GuardVerdict {
  const ci = checkCi(s);
  const checks = [
    checkBase(s),
    checkReadyForReview(s, o),
    checkReadyMarker(s),
    checkLabels(s),
    o.fullTier ? withFullTier(ci, s) : isRelease(s, o) ? ci : advisoryCi(ci),
    checkChecklist(s),
    checkOpenQuestion(s),
    checkMergeable(s),
    checkContentReview(s),
  ];
  const unknown = checks.some((c) => c.status === "unknown");
  const refused = checks.some((c) => c.status === "refuse");
  const verdict = unknown ? "unknown" : refused ? "refused" : "pass";
  const defect = checks.some((c) => c.kind === "defect");
  const state: StatusState = unknown ? "error" : defect ? "failure" : refused ? "pending" : "success";
  return { pr: s.pr.number, head: s.pr.head.sha, verdict, state, exitCode: unknown ? 2 : refused ? 1 : 0, checks };
}

// ─── GitHub ────────────────────────────────────────────────────────────────

export class CannotAsk extends Error {}

function token(): string | undefined {
  return process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
}

async function gh(url: string, init: RequestInit = {}, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const full = url.startsWith("http") ? url : `https://api.github.com/${url}`;
  const t = token();
  try {
    return await withBackoff(
      async () => {
        const r = await fetchImpl(full, {
          ...init,
          headers: {
            accept: "application/vnd.github+json",
            ...(t ? { authorization: `Bearer ${t}` } : {}),
            ...(init.body ? { "content-type": "application/json" } : {}),
          },
          signal: AbortSignal.timeout(20_000),
        });
        // A PUT/POST is not retried on 5xx: the write may have landed.
        const transient = init.method && init.method !== "GET" ? undefined : classifyResponse(r.status, r.headers);
        return { value: r, transient };
      },
      { onRetry: (n, ms, why) => console.error(`  … attempt ${n} failed (${why}); retrying in ${ms}ms`) },
    );
  } catch (e) {
    throw new CannotAsk(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Why a GET failed, with GitHub's (or the proxy's) own `message` when the body
 * carries one. The status alone hid the cause of issue #2137 for two days: the
 * 403 body said in plain words which URL form to use instead.
 */
async function failure(url: string, r: Response): Promise<CannotAsk> {
  let why = "";
  try {
    const m = ((await r.json()) as { message?: unknown }).message;
    if (typeof m === "string" && m) why = ` — ${m}`;
  } catch {
    // no JSON body: the status is all there is
  }
  return new CannotAsk(`GET ${url}: HTTP ${r.status}${why}`);
}

async function getJson<T>(url: string, fetchImpl?: typeof fetch): Promise<T> {
  const r = await gh(url, {}, fetchImpl);
  if (!r.ok) throw await failure(url, r);
  return (await r.json()) as T;
}

/**
 * A `rel="next"` URL rewritten to the `repos/{owner}/{repo}/…` form of the
 * walk's first URL.
 *
 * GitHub writes pagination links as `/repositories/<numeric id>/…`, and the
 * Claude Code agent proxy refuses that form outright (HTTP 403, "Numeric-ID
 * repository paths … are not supported through this proxy"), so page 2 of any
 * long list failed from an agent session while page 1 — which we build — worked
 * (issue #2137). The two forms name the same resource: the `next` link of a list
 * under `repos/{owner}/{repo}/` is always into that same repository.
 *
 * Anything else — a `next` not in the numeric form, or a walk that did not start
 * under `repos/{owner}/{repo}/` — is returned unchanged; if the proxy then
 * refuses it, the caller's could-not-determine path reports it.
 */
export function sameRepoNext(next: string, start: string): string {
  const repo = start.replace(/^https:\/\/api\.github\.com\//, "").match(/^repos\/([^/]+\/[^/?#]+)\//)?.[1];
  const m = next.match(/^https:\/\/api\.github\.com\/repositories\/\d+\/(.*)$/);
  return repo && m ? `https://api.github.com/repos/${repo}/${m[1]}` : next;
}

/** Every page of a list endpoint, following `Link: rel="next"` (normalised by {@link sameRepoNext}). */
export async function getAll<T>(url: string, fetchImpl?: typeof fetch): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = url;
  for (let page = 0; next && page < 20; page += 1) {
    const r = await gh(next, {}, fetchImpl);
    if (!r.ok) throw await failure(next, r);
    out.push(...((await r.json()) as T[]));
    const link = r.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
    next = link === undefined ? undefined : sameRepoNext(link, url);
  }
  return out;
}

/**
 * How long {@link fetchPull} waits before each re-ask while `mergeable` is
 * `null`. GitHub computes it in a background job that the first GET starts,
 * typically within seconds; 2+4+8 s bounds the wait at 14 s, after which
 * check 8 reports `unknown` rather than guess.
 */
export const MERGEABLE_RETRY_MS: readonly number[] = [2_000, 4_000, 8_000];

/**
 * The PR record, re-asked while GitHub has not yet computed `mergeable`
 * (check 8). Still `null` after {@link MERGEABLE_RETRY_MS} is returned as is,
 * and check 8 reads it as `unknown`. A closed or merged PR is not re-asked:
 * GitHub does not compute mergeability for it, and check 1 refuses it anyway.
 */
export async function fetchPull(
  repo: string,
  n: number,
  opts: { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; waitsMs?: readonly number[] } = {},
): Promise<GhPull> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let pr = await getJson<GhPull>(`repos/${repo}/pulls/${n}`, opts.fetchImpl);
  for (const ms of opts.waitsMs ?? MERGEABLE_RETRY_MS) {
    if (pr.mergeable !== null || pr.state !== "open") break;
    await sleep(ms);
    pr = await getJson<GhPull>(`repos/${repo}/pulls/${n}`, opts.fetchImpl);
  }
  return pr;
}

/** Read everything {@link evaluate} needs. Throws {@link CannotAsk} when a required fact is unreadable. */
/**
 * The newest {@link AGENT_BUILD_CONTEXT} status, or `null` for none. GitHub
 * lists a ref's statuses newest first, and every update is a new entry, so
 * the first match is the current one; `created_at` orders them when present.
 */
export function agentBuildStatus(statuses: readonly GhStatus[]): GhStatus | null {
  const mine = statuses.filter((x) => x.context === AGENT_BUILD_CONTEXT);
  if (mine.length === 0) return null;
  if (mine.every((x) => x.created_at)) return [...mine].sort((a, b) => b.created_at!.localeCompare(a.created_at!))[0]!;
  return mine[0]!;
}

export async function fetchSnapshot(repo: string, n: number, root: string): Promise<GuardSnapshot> {
  const pr = await fetchPull(repo, n);
  const [comments, timeline, commits] = await Promise.all([
    getAll<GhComment>(`repos/${repo}/issues/${n}/comments?per_page=100`),
    getAll<GhTimelineEvent>(`repos/${repo}/issues/${n}/timeline?per_page=100`),
    getAll<GhCommit>(`repos/${repo}/pulls/${n}/commits?per_page=100`),
  ]);
  const owner = repo.split("/")[0];
  let baseMergedAsHeadOf: GuardSnapshot["baseMergedAsHeadOf"];
  try {
    const closed = await getAll<{ number: number; merged_at: string | null }>(
      `repos/${repo}/pulls?state=closed&head=${encodeURIComponent(`${owner}:${pr.base.ref}`)}&per_page=100`,
    );
    baseMergedAsHeadOf = closed.filter((p) => p.merged_at).map((p) => p.number);
  } catch (e) {
    baseMergedAsHeadOf = { unknown: e instanceof Error ? e.message : String(e) };
  }
  const runs = await runsForHead(repo, pr.head.sha);
  const scan = scanTriggers(root, "pull_request");
  let mergeMainDispatches: GuardSnapshot["mergeMainDispatches"];
  try {
    const parsed = parseMergeMainDispatches(readFileSync(join(root, MERGE_MAIN_WORKFLOW), "utf8"));
    mergeMainDispatches = parsed ?? { unknown: `no \`for wf in … ; do gh workflow run\` line in ${MERGE_MAIN_WORKFLOW}` };
  } catch (e) {
    mergeMainDispatches = { unknown: e instanceof Error ? e.message : String(e) };
  }
  const failedSteps: NonNullable<GuardSnapshot["failedSteps"]> = {};
  if (runs.state === "has-run") {
    const notWaitedNames = new Set(
      scan.triggers.filter((t) => NOT_WAITED_FOR_WORKFLOW_FILES.has(t.file)).map((t) => t.name),
    );
    for (const r of runs.runs as GuardRun[]) {
      if (!notWaitedNames.has(r.name) || r.id === undefined || r.status !== "completed") continue;
      if (PASSING.has(r.conclusion ?? "") || NOT_EXECUTED.has(r.conclusion ?? "")) continue;
      try {
        const jobs = await getJson<{ jobs: { steps?: { name: string; conclusion: string | null }[] }[] }>(
          `repos/${repo}/actions/runs/${r.id}/jobs?per_page=100`,
        );
        failedSteps[r.id] = jobs.jobs.flatMap((j) =>
          (j.steps ?? []).filter((x) => x.conclusion === "failure").map((x) => x.name),
        );
      } catch (e) {
        failedSteps[r.id] = { unknown: e instanceof Error ? e.message : String(e) };
      }
    }
  }
  let agentBuild: GuardSnapshot["agentBuild"];
  try {
    agentBuild = agentBuildStatus(await getJson<GhStatus[]>(`repos/${repo}/commits/${pr.head.sha}/statuses?per_page=100`));
  } catch (e) {
    agentBuild = { unknown: e instanceof Error ? e.message : String(e) };
  }
  let checkRuns: GuardSnapshot["checkRuns"];
  try {
    checkRuns = (await getJson<{ check_runs: GhCheckRun[] }>(`repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`)).check_runs;
  } catch (e) {
    checkRuns = { unknown: e instanceof Error ? e.message : String(e) };
  }
  return { pr, comments, timeline, commits, baseMergedAsHeadOf, runs, scan, mergeMainDispatches, failedSteps, agentBuild, checkRuns };
}

export type MergeOutcome = { merged: true; sha: string } | { merged: false; refused: boolean; reason: string };

/** The PUT, pinned to the head that was evaluated: GitHub refuses it if the head moved. */
export async function mergePinned(repo: string, n: number, sha: string): Promise<MergeOutcome> {
  let r: Response;
  try {
    r = await gh(`repos/${repo}/pulls/${n}/merge`, { method: "PUT", body: JSON.stringify({ sha, merge_method: "merge" }) });
  } catch (e) {
    return { merged: false, refused: false, reason: e instanceof Error ? e.message : String(e) };
  }
  const body = (await r.json().catch(() => ({}))) as { merged?: boolean; sha?: string; message?: string };
  if (r.ok && body.merged) return { merged: true, sha: body.sha ?? "" };
  const refused = r.status === 405 || r.status === 409 || r.status === 422;
  return { merged: false, refused, reason: `HTTP ${r.status}: ${body.message ?? "no message"}` };
}

/** Post the verdict as the `merge-guard` commit status on the head. */
export async function postStatus(repo: string, v: GuardVerdict): Promise<void> {
  const state = v.state;
  const failed = v.checks.filter((c) => c.status === "refuse" || c.status === "unknown");
  const label = v.state === "pending" ? "not ready" : v.verdict;
  const description = (
    v.verdict === "pass" ? `all ${CHECKS.length} checks pass` :`${label}: ${failed.map((c) => `${c.n} ${c.id}`).join(", ")}`
  ).slice(0, 140);
  const runUrl = process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL ?? "https://github.com"}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : undefined;
  const r = await gh(`repos/${repo}/statuses/${v.head}`, {
    method: "POST",
    body: JSON.stringify({ state, context: STATUS_CONTEXT, description, ...(runUrl ? { target_url: runUrl } : {}) }),
  });
  if (!r.ok) throw new CannotAsk(`POST status: HTTP ${r.status}`);
}

// ─── CLI ───────────────────────────────────────────────────────────────────

const MARK: Record<CheckStatus, string> = { pass: "✓", refuse: "✗", unknown: "?", skip: "–" };

export function render(v: GuardVerdict): string {
  const lines = [`merge-guard #${v.pr} @ ${short(v.head)}: ${v.verdict.toUpperCase()} (status: ${v.state})`];
  for (const c of v.checks) lines.push(`  ${MARK[c.status]} ${c.n} ${c.id.padEnd(16)} ${c.kind ? `[${c.kind}] ` : ""}${c.detail}`);
  return lines.join("\n");
}

const USAGE =
  "usage: bun run cat merge:guard <pr> [--merge --session <id> [--merge-manager-own-pr]] [--release] [--full-tier] [--root <dir>] [--actor <login>] [--repo owner/repo] [--status] [--json]\n" +
  "  --merge is the merge manager's alone (owner, 2026-11-13): no other session runs it.";

async function main(argv: string[]): Promise<number> {
  const args = [...argv];
  const flag = (f: string) => {
    const i = args.indexOf(f);
    if (i < 0) return false;
    args.splice(i, 1);
    return true;
  };
  const opt = (f: string) => {
    const i = args.indexOf(f);
    if (i < 0) return undefined;
    const v = args[i + 1];
    args.splice(i, 2);
    return v;
  };
  const doMerge = flag("--merge");
  const asJson = flag("--json");
  const doStatus = flag("--status");
  // `--no-merge-manager` is the old name; both are taken out of `args`.
  const oldName = flag("--no-merge-manager");
  const mergeManagerOwnPr = flag("--merge-manager-own-pr") || oldName;
  if (oldName) console.error("--no-merge-manager is now --merge-manager-own-pr: the merge manager landing its own PR. No other session merges.");
  const release = flag("--release");
  const fullTier = flag("--full-tier");
  const rootArg = opt("--root");
  const sessionArg = opt("--session");
  const actor = opt("--actor");
  // `--root`: the repository whose workflows check 5 owes (the status
  // workflow checks the caller out at its default branch and names it here).
  const root = rootArg ? resolve(rootArg) : repoRootFor(resolve(HARNESS_ROOT));
  const repo = opt("--repo") ?? process.env.GITHUB_REPOSITORY ?? ownerRepo(detectRepoUrl(root) ?? "");
  const n = Number(args[0]);
  if (!Number.isInteger(n) || n <= 0 || !repo) {
    console.error(USAGE);
    return 2;
  }
  const mergingSession = sessionArg ? normaliseSession(sessionArg) : undefined;
  if (doMerge && !mergingSession) {
    console.error("--merge needs --session <the merging session's id>: check 2 asks whether that session marked the PR ready.\n" + USAGE);
    return 2;
  }

  let snapshot: GuardSnapshot;
  try {
    snapshot = await fetchSnapshot(repo, n, root);
  } catch (e) {
    console.error(`merge-guard #${n}: COULD NOT DETERMINE — ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  const v = evaluate(snapshot, { mergingSession, mergingActor: actor, mergeManagerOwnPr, release, fullTier });
  console.log(asJson ? JSON.stringify(v, null, 2) : render(v));
  if (doStatus) {
    try {
      await postStatus(repo, v);
    } catch (e) {
      console.error(`could not post the ${STATUS_CONTEXT} status: ${e instanceof Error ? e.message : String(e)}`);
      return 2;
    }
  }
  if (!doMerge || v.exitCode !== 0) return v.exitCode;

  const out = await mergePinned(repo, n, v.head);
  if (out.merged) {
    console.log(`merged #${n} at ${short(v.head)} -> ${short(out.sha)}`);
    return 0;
  }
  console.error(`merge of #${n} ${out.refused ? "REFUSED by GitHub" : "COULD NOT BE DETERMINED"}: ${out.reason}`);
  return out.refused ? 1 : 2;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}

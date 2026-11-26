/**
 * Is CI actually green, or has it merely been red for so long that nobody looks?
 *
 * `5rfy` fixed workflows that never **fire** — a header advertising a schedule
 * its `on:` block did not have. This is the opposite defect, and the one that
 * cost more: `docs-site.yml` fired on every push to `main` and **failed all 30
 * times** between 2026-06-29 and 2026-08-26. The published site sat two months
 * stale, and the workflow diagrams merged in #135 never reached it.
 *
 * The trigger was fine. The *outcome* was invisible. From inside the repo a
 * workflow that runs and passes and one that runs and fails look identical, and
 * GitHub's failure email is evidently a channel nobody reads.
 *
 * So this classifies each workflow's recent history on the default branch, and
 * the session-start sweep prints it where attention already goes.
 *
 * ## "Could not check" is not "healthy"
 *
 * Every function here distinguishes *red*, *green* and *unknown*, and the
 * caller must too. A health report that silently treats an unreachable API as
 * fine is the same failure one level up — which is precisely the mistake the
 * sibling-branch section of `session-start-coord-sweep.sh` already refuses to
 * make ("Treat this section as unread, not as empty").
 *
 * @module folio-assistant/workflow/ci-health
 */

import { parse as parseYaml } from "yaml";
import { inputSiteReached } from "../../schemas/sdlc/input-trace.ts";

/**
 * Does a workflow's YAML fire on every push to its branches?
 *
 * `true` every push, `false` never, **`undefined` cannot tell** — and the third
 * is the one that carries the design. GitHub spells the trigger three ways
 * (`on: push`, `on: [push, …]`, a mapping with a `push:` key); `on` is also the
 * YAML 1.1 boolean `true` under some parsers, so that key is checked rather
 * than assumed absent.
 *
 * A `push:` block carrying `paths`, `paths-ignore`, `branches`,
 * `branches-ignore`, `tags` or `tags-ignore` fires on SOME pushes, and which
 * ones is not answerable from this file — deciding it would mean evaluating the
 * filter against the commit's changed files, which a health report has no
 * business fetching. So it answers `undefined`, and every caller treats that as
 * "claim nothing".
 *
 * That clause was not foreseen; it was measured. `jsonld-gen-check.yml`
 * declares `on.push` under fifteen `paths:` entries, and the first version of
 * this returned `true` for it — putting a false "no run has judged the current
 * head" on a workflow that owed no run, which is the exact false fire the
 * trigger check exists to prevent.
 */
export interface PushContext {
  /** The branch being pushed to, for a `branches` / `branches-ignore` filter. */
  branch?: string;
  /**
   * Paths the commit changed, for a `paths` / `paths-ignore` filter.
   *
   * Pass it only when the list is COMPLETE. GitHub's commit endpoint caps
   * `files` at 300, and a truncated list makes a matching file look absent —
   * which turns "this workflow ran" into "no run judged the head", a false
   * fire. A caller that cannot guarantee completeness passes nothing.
   */
  changedFiles?: string[];
}

/**
 * Translate one GitHub filter pattern to a regex, or `undefined` if it uses
 * syntax this does not confidently support.
 *
 * Supported: literal characters, `*` (any run not crossing `/`), and `**` (any
 * run, crossing `/`). `/**​/` also matches zero directories, which is what
 * `content/**​/*.ts` means to GitHub and what a naive `.*` would get wrong for
 * `content/a.ts`.
 *
 * **Refused, deliberately:** `!` negation, `?`, `[`, `+`, `{`. Each has real
 * semantics and each is a chance to be subtly wrong in the direction that
 * invents a finding. Returning `undefined` costs a workflow's coverage;
 * guessing costs the report's credibility, which is the asset this module is
 * entirely made of.
 */
function patternToRegExp(pattern: string): RegExp | undefined {
  if (/[!?[\]+{}]/.test(pattern)) return undefined;
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === "*") {
      const doubled = pattern[i + 1] === "*";
      if (doubled) {
        // `a/**/b` must also match `a/b`, so the separator is consumed here.
        if (out.endsWith("/") && pattern[i + 2] === "/") {
          out = out.slice(0, -1) + "(?:/.*)?/";
          i += 2;
        } else {
          out += ".*";
          i += 1;
        }
      } else {
        out += "[^/]*";
      }
      continue;
    }
    out += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  try {
    return new RegExp(`^${out}$`);
  } catch {
    return undefined;
  }
}

/** Does any changed file match any pattern? `undefined` if a pattern is unsupported. */
function anyFileMatches(patterns: string[], files: string[]): boolean | undefined {
  const res: RegExp[] = [];
  for (const p of patterns) {
    const r = patternToRegExp(p);
    if (!r) return undefined;
    res.push(r);
  }
  return files.some((f) => res.some((r) => r.test(f)));
}

export function pushTriggerOf(text: string, ctx: PushContext = {}): boolean | undefined {
  let doc: unknown;
  try {
    doc = parseYaml(text);
  } catch {
    return undefined;
  }
  if (!doc || typeof doc !== "object") return undefined;
  const d = doc as Record<string, unknown>;
  const on = "on" in d ? d.on : d[true as unknown as string];
  if (on === undefined || on === null) return undefined;
  if (typeof on === "string") return on === "push";
  if (Array.isArray(on)) return on.includes("push");
  if (typeof on !== "object") return undefined;
  if (!Object.hasOwn(on as object, "push")) return false;
  const push = (on as Record<string, unknown>).push;
  if (push === null || push === undefined) return true;
  if (typeof push !== "object") return true;
  const p = push as Record<string, unknown>;
  const has = (k: string) => Object.hasOwn(p, k);

  // A tag filter means this push block is about tags, not branch commits.
  if (has("tags") || has("tags-ignore")) return undefined;

  // ── branch filters ─────────────────────────────────────────────────
  // Fully decidable whenever the caller says which branch, and no globbing is
  // involved for a plain name. `code-quality-gates.yml` is exactly this shape:
  // `branches: [main]` and nothing else.
  if (has("branches") || has("branches-ignore")) {
    if (ctx.branch === undefined) return undefined;
    const list = (has("branches") ? p.branches : p["branches-ignore"]) as unknown;
    if (!Array.isArray(list)) return undefined;
    const match = anyFileMatches(list as string[], [ctx.branch]);
    if (match === undefined) return undefined;
    if (has("branches") ? !match : match) return false;
  }

  // ── path filters ───────────────────────────────────────────────────
  // GitHub refuses `paths` and `paths-ignore` together for one event, so a
  // file carrying both is not something to reason about.
  if (has("paths") && has("paths-ignore")) return undefined;
  if (has("paths") || has("paths-ignore")) {
    if (ctx.changedFiles === undefined) return undefined;
    const list = (has("paths") ? p.paths : p["paths-ignore"]) as unknown;
    if (!Array.isArray(list)) return undefined;
    const match = anyFileMatches(list as string[], ctx.changedFiles);
    if (match === undefined) return undefined;
    // `paths`: run when ANY changed file matches.
    // `paths-ignore`: skip only when EVERY changed file matches, so run when
    // any file falls outside the list.
    if (has("paths")) return match;
    const allIgnored = anyFileMatches(list as string[], ctx.changedFiles) === true &&
      ctx.changedFiles.every((f) => anyFileMatches(list as string[], [f]) === true);
    return !allIgnored;
  }

  return true;
}

/** The fields of a GitHub Actions run this module reads. */
export interface RunSummary {
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  html_url?: string;
  /** `.github/workflows/x.yml` — the file the run came from, if any. */
  path?: string;
  /** The commit this run judged. Absent when the caller did not supply it. */
  head_sha?: string;
}

export type Health = "green" | "red" | "running" | "no-runs" | "superseded";

export interface WorkflowHealth {
  workflow: string;
  health: Health;
  /** Consecutive non-success runs, newest first. 0 when the latest passed. */
  consecutiveFailures: number;
  /** ISO date of the most recent success, if there is one in the window. */
  lastSuccess?: string;
  /** Whole days since that success. `undefined` when there is none in window. */
  daysSinceSuccess?: number;
  /** Newest run, for a link to hand the reader. */
  latestUrl?: string;
  /**
   * The commit the NEWEST SETTLED FAILING run judged — the starting point for
   * {@link blameFailingRun}. Bean `kgho`.
   *
   * Set here rather than re-derived by the caller because "which run failed" is
   * a classification fact, and this module already answers it for
   * `consecutiveFailures`. A second derivation in the CLI would be free to
   * disagree with this one.
   *
   * Absent when the workflow is not red, or when the caller supplied runs
   * without `head_sha` — which is why the blame path treats its absence as
   * could-not-determine rather than as nothing to attribute.
   */
  failingSha?: string;
  /**
   * Whole days since the most recent run of any conclusion.
   *
   * Age is what separates an active fire from a stale scorch mark. Two of this
   * repo's workflows show "no success in the window" — and both last ran on
   * 2026-08-07 against a commit whose files were changed the next day. Reporting
   * those identically to something that broke an hour ago is how a health
   * report earns the inattention it exists to fix.
   */
  daysSinceLastRun?: number;
  /** ISO date of the most recent run of any conclusion. */
  lastRun?: string;
  /**
   * ISO date of the change that made this workflow's last verdict obsolete.
   *
   * Set only on a red whose newest run **predates** the last edit to its
   * workflow file: the version that failed no longer exists, so the failure is
   * history rather than a live problem — the same distinction `workflowExists`
   * already draws for a workflow that was deleted outright.
   */
  supersededBy?: string;
  /** `.github/workflows/x.yml`, carried through for the reader. */
  path?: string;
  /**
   * The newest run is **not** the one this verdict came from — it is still in
   * flight, or it ended in a non-verdict (`cancelled`, `skipped`, `neutral`).
   *
   * Set whenever `runs[0]` is not `settled[0]`, and it is the difference
   * between a trend and an answer. `health` describes the newest *settled*
   * run, which can be older than the commit in front of the reader; when this
   * is set, that verdict says nothing about the head.
   *
   * Measured 2026-09-19, bean `gpuu`. `main` took a merge at 02:39 that broke
   * `kg:audit:check`; a run of this check a minute later printed three green
   * rows, because the run for the breaking commit had not settled and the
   * previous green was reported as current. An agent then wrote "`main` is not
   * red" into a pull request body on that basis, and flagged the PR that was
   * fixing it as mistaken. Both claims merged.
   *
   * This is the same class as the three rules this module already carries —
   * "could not check" is never green, a week-old red is flagged stale, a
   * superseded red is named as superseded. All exist so uncertainty never
   * renders as green. An unsettled newest run was the one uncertainty left
   * uncovered, in a module written for bean `xom7`: a red workflow that looked
   * green from inside the repo.
   *
   * It is deliberately **not** folded into `health`. The existing `running`
   * state means "nothing has settled at all", and overloading it would erase
   * the trend — a workflow red for six runs with a seventh in flight is still
   * red, and a reader needs both facts. So the verdict stays a verdict and
   * this says what it does not cover.
   */
  newestUnsettled?: boolean;
  /**
   * No run in the window judged the branch head at all.
   *
   * The sibling of {@link newestUnsettled}, and the case that one does not
   * reach. `newestUnsettled` answers "a run for the head exists but has not
   * finished". This answers "no run for the head was ever created" — the
   * workflow did not fire, or has not yet. Either way the verdict below is
   * about some earlier commit, and `docs-site.yml` sat in exactly this state
   * for two months under bean `xom7`.
   *
   * **Three facts must all be known before this is set, and any unknown means
   * silence rather than a finding.** The caller must supply the head sha
   * ({@link AssessOptions.headSha}); no run in the window may carry it; and
   * {@link AssessOptions.triggersOnPush} must return exactly `true` for this
   * workflow.
   *
   * That last one is not caution for its own sake. `witness-refresh.yml` and
   * `qa-sweep.yml` are `workflow_dispatch`-only and will never have a run for
   * any head, so without the trigger check this would report two permanent
   * false fires — which is precisely the defect the `superseded` rule was
   * added to retire. A health report earns its inattention one false fire at
   * a time.
   */
  headUnjudged?: boolean;
  /**
   * This workflow's file exists, and **no run of it fell inside the window**.
   *
   * Set only on a `no-runs` row, which before 2026-09-20 was unreachable: the
   * state existed in {@link Health} and `classifyRuns` set it at
   * `runs.length === 0`, but rows were built by grouping the runs, and a group
   * is never empty. So a workflow with nothing in the window was not a row
   * with a quiet verdict — it was **absent from the report entirely**.
   *
   * Measured on this repository, 2026-09-20: 38 workflow files, 3 rows,
   * `✓ every workflow … is green`. The 35 were not judged and not mentioned.
   */
  noRunsInWindow?: boolean;
  /**
   * WHY there was no run — supplied by the caller, like {@link scheduled}.
   *
   * A `no-runs` row was reported as a bare count under the parenthetical
   * *"(dispatch-only, or vendored for a folio)"*. Both halves are plausible
   * and **neither was measured**, so the line could not distinguish 31 files
   * that cannot fire from 30 that cannot and one that should have. A summary
   * asserting a cause is the `1xhc` defect at the level of the report rather
   * than the gate. Bean `kpcl`.
   *
   * Reading YAML is not this module's business — the same reason
   * {@link AssessOptions.hasSchedule} is a callback — so the verdict arrives
   * computed. Unset means the caller did not say, which is NOT
   * `"undetermined"`: the first is "nobody asked", the second is "asked and
   * could not tell".
   */
  noRunReason?: NoRunReason;
  /**
   * This workflow fires on a `schedule:`.
   *
   * Supplied by the caller ({@link AssessOptions.hasSchedule}), because
   * reading YAML is not this module's business. It changes what a `no-runs`
   * row MEANS, and the difference is the whole point of carrying it: a
   * `workflow_dispatch`-only file with no runs is working as intended, while a
   * scheduled one with no runs is either broken or outside the window — and
   * the second of those is a fact about the REPORT, not about the workflow.
   */
  scheduled?: boolean;
  /**
   * What a DIRECT request for this workflow's own runs established, when the
   * window did not reach it.
   *
   * Three states, and collapsing any two of them is the defect this module is
   * about. `"never-ran"` means the forge was asked and answered zero: a real
   * finding, and `5rfy`'s shape — a workflow that cannot be red because it has
   * never run. `"unknown"` means the request failed, which is not evidence of
   * anything. Unset means no direct request was made.
   *
   * The first draft of this change printed "the direct fetch did not answer"
   * for a workflow whose fetch answered perfectly well, with zero. A message
   * that reports a clean measurement as a failed one is worse than silence,
   * because it sends the reader to debug the tool instead of the workflow.
   */
  probe?: "never-ran" | "unknown";
  /**
   * It has never run because it has never had the CHANCE — the workflow file
   * is younger than the longest gap its cron can leave.
   *
   * Set only on a `probe: "never-ran"` row, and only when both the file's age
   * and {@link cronPeriodDays} are known. It turns a finding into a fact.
   *
   * Measured 2026-09-20, which is why it exists: `upstream-pins.yml` was
   * reported as a finding — never run on `main`, asked directly. True, and
   * meaningless: the file had been added the day before and its cron is
   * `43 9 * * 2`, a Tuesday two days out. A workflow neutered for months and
   * one added yesterday rendered identically. That is `5rfy`'s ambiguity one
   * level in — the report could see that nothing HAD run, not that nothing
   * COULD have.
   */
  tooYoung?: boolean;
  /** Whole days since the workflow file first appeared on the default branch. */
  fileAgeDays?: number;
}

/** Conclusions that are not a pass but are also not the workflow's fault. */
/**
 * Conclusions that are NOT a verdict on the commit: the run finished without
 * judging it. `cancelled` was superseded, `skipped` never ran its body, and
 * `neutral` is a deliberate abstention.
 *
 * EXPORTED since 2026-10-01, because it was re-listed. `conclusionOnCommit` in
 * `check-ci-health.ts` filtered `cancelled` and `skipped` and forgot `neutral`,
 * so a neutral-only parent read as a FAILURE there and as a non-verdict here —
 * and the blame walk then continued past it and could name it as the suspect.
 * Found by review on #1725. Two spellings of one fact, and the drift only shows
 * on the conclusion the shorter list forgot.
 */
export const NOT_A_VERDICT: ReadonlySet<string> = new Set(["cancelled", "skipped", "neutral"]);

/**
 * Classify one workflow's runs, newest first.
 *
 * A run still in flight defers the verdict rather than counting as either — a
 * queued run is not evidence of health, and calling it a failure would cry wolf
 * on every push.
 */
export function classifyRuns(
  runs: RunSummary[],
  asOf?: Date,
  headSha?: string,
): Omit<WorkflowHealth, "workflow"> {
  let now = asOf;
  if (now === undefined) {
    // input-site: traced #7ab6c4e8 — the time runs are aged against when the caller gives none: a run that reaches it records no hash
    inputSiteReached("ci-health: classify's time");
    now = new Date();
  }
  const settled = runs.filter((r) => r.status === "completed" && !NOT_A_VERDICT.has(r.conclusion ?? ""));

  const lastSuccessRun = settled.find((r) => r.conclusion === "success");
  const lastSuccess = lastSuccessRun?.created_at;
  const daysSinceSuccess = lastSuccess
    ? Math.floor((now.getTime() - new Date(lastSuccess).getTime()) / 86_400_000)
    : undefined;

  let consecutiveFailures = 0;
  for (const r of settled) {
    if (r.conclusion === "success") break;
    consecutiveFailures++;
  }

  let health: Health;
  if (runs.length === 0) health = "no-runs";
  else if (settled.length === 0) health = "running";
  else health = consecutiveFailures === 0 ? "green" : "red";

  const daysSinceLastRun = runs[0]
    ? Math.floor((now.getTime() - new Date(runs[0].created_at).getTime()) / 86_400_000)
    : undefined;

  // From `settled`, the same list `consecutiveFailures` counts, so the sha and
  // the count can never describe different runs. `runs[0]` would be wrong
  // whenever the newest run is still in flight or was cancelled.
  const failingSha = consecutiveFailures > 0 ? settled[0]?.head_sha : undefined;

  // The verdict above is computed from `settled`. When the newest run is not
  // the newest settled one, the verdict is about an older commit and must say
  // so — see `newestUnsettled`. `health === "running"` already covers the case
  // where nothing has settled at all, so exclude it rather than report both.
  const newestUnsettled = runs.length > 0 && settled[0] !== runs[0] && health !== "running";

  // Only whether a run for the head EXISTS. Whether this workflow was supposed
  // to produce one is the caller's to answer, in `assess` — see `headUnjudged`.
  const headSeen = headSha !== undefined && runs.some((r) => r.head_sha === headSha);

  return {
    health,
    consecutiveFailures,
    lastSuccess,
    daysSinceSuccess,
    daysSinceLastRun,
    lastRun: runs[0]?.created_at,
    latestUrl: runs[0]?.html_url,
    ...(failingSha !== undefined ? { failingSha } : {}),
    ...(newestUnsettled ? { newestUnsettled: true } : {}),
    ...(headSha !== undefined && !headSeen ? { headUnjudged: true } : {}),
  };
}

/** Group a flat run list by workflow name, newest first within each group. */
export function byWorkflow(runs: RunSummary[]): Map<string, RunSummary[]> {
  const out = new Map<string, RunSummary[]>();
  const sorted = [...runs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const r of sorted) {
    const list = out.get(r.name) ?? [];
    list.push(r);
    out.set(r.name, list);
  }
  return out;
}

/**
 * Why a workflow file produced no run, as {@link WorkflowHealth.noRunReason}.
 *
 * Only `auto-triggered` is a defect: the workflow can fire on this branch and
 * did not. `undetermined` is the third state this module applies everywhere —
 * it is never folded into either of the benign two.
 */
export type NoRunReason = "dispatch-only" | "path-filtered" | "auto-triggered" | "undetermined";

export interface AssessOptions {
  now?: Date;
  /**
   * Does this workflow file still exist? Runs of a **deleted** workflow are
   * history, not a live problem, and reporting them cries wolf — which is how a
   * health report earns the same inattention that let `docs-site` rot.
   *
   * Omit it and nothing is filtered: not knowing which files exist must not
   * silently drop failures.
   */
  workflowExists?: (path: string) => boolean;
  /**
   * When was this workflow file last changed? ISO date, or `undefined` if not
   * known.
   *
   * A red verdict is a verdict about *the file as it was when it ran*. Edit the
   * file and that verdict is about a version that no longer exists — most
   * sharply when the failure was a startup failure, where the YAML never parsed
   * and no job ran at all.
   *
   * Two of this repo's workflows sit exactly there. `witness-refresh.yml` and
   * `qa-sweep.yml` failed to parse, fired on `push` despite being
   * `workflow_dispatch`-only (GitHub could not read the `on:` block to filter
   * on), and were fixed the next day. They only run on dispatch, and this
   * report only reads the default branch — so nothing will ever run them here
   * again, and without this rule they stay red forever. Two permanent false
   * fires erode exactly the attention the report exists to protect.
   *
   * Omit it and nothing is superseded: not knowing when a file changed must
   * leave a failure reported, never explain it away.
   */
  workflowChangedAt?: (path: string) => string | undefined;
  /**
   * The commit at the tip of the branch being reported on.
   *
   * Omit it and {@link WorkflowHealth.headUnjudged} is never set: not knowing
   * which commit is current must not be rendered as "nothing judged it".
   * Whoever supplies this must be sure of it — a stale local ref is a wrong
   * answer, not a missing one, so a caller that cannot ask the forge directly
   * should pass nothing.
   */
  headSha?: string;
  /**
   * Does this workflow run on a push to the branch at all?
   *
   * `true` means a missing run for the head is a real gap. `false` or
   * `undefined` means nothing is claimed — a `workflow_dispatch`-only file has
   * no business having a run for every commit, and reporting one as unjudged
   * is a false fire that costs the whole report its credibility.
   *
   * Omit it and `headUnjudged` is never set, for the same reason
   * `workflowExists` omitted filters nothing: not knowing must not manufacture
   * a finding.
   */
  triggersOnPush?: (path: string) => boolean | undefined;
  /**
   * Every workflow file in the repository, so a file with no run in the window
   * becomes a ROW rather than an absence.
   *
   * Without this the report is a function of the runs alone, and a workflow
   * that did not run is indistinguishable from one that does not exist. That
   * is the `xom7` defect — a workflow failing where nobody looks — with the
   * dial at zero, and it was live in this module: see
   * {@link WorkflowHealth.noRunsInWindow}.
   *
   * Omitting it keeps the old behaviour exactly. Not knowing the file list
   * must not invent rows, so an empty array and `undefined` are different: the
   * first says "there are none", the second says "I did not look".
   */
  knownWorkflows?: Array<{ path: string; name: string }>;
  /**
   * Does this workflow fire on a `schedule:`? `undefined` when unreadable.
   *
   * Only consulted for a file with no runs, where it separates "dispatch-only,
   * nothing expected" from "scheduled and nothing arrived". Unknown is left
   * unset rather than guessed, on the same rule as every other predicate here.
   */
  hasSchedule?: (path: string) => boolean | undefined;
  /**
   * Why this workflow produced no run. See {@link WorkflowHealth.noRunReason}.
   *
   * Consulted only for a file with no runs. Omitting it keeps the previous
   * output, which counted every such file under one unmeasured parenthetical.
   */
  noRunReason?: (path: string) => NoRunReason | undefined;
  /**
   * The outcome of a direct per-workflow request, for files the window missed.
   * See {@link WorkflowHealth.probe}. Omit it and no row claims to have been
   * probed.
   */
  probed?: (path: string) => "never-ran" | "unknown" | undefined;
  /**
   * When did this workflow file first appear on the default branch? ISO, or
   * `undefined` when git cannot answer.
   *
   * Only consulted for a `never-ran` row. Not knowing leaves the row as a
   * plain finding, which is the safe direction: an unknown age must never
   * explain a silent workflow away.
   */
  workflowAddedAt?: (path: string) => string | undefined;
  /** The workflow's cron expression, for {@link cronPeriodDays}. */
  cronOf?: (path: string) => string | undefined;
}

/**
 * Is this workflow simply too new to have fired yet?
 *
 * Every input is optional and any missing one yields `{}` — not knowing must
 * leave the row a finding rather than explain it away. The comparison is
 * against the LONGEST gap the cron can leave, so `tooYoung` is only ever set
 * when the schedule demonstrably could not have come round.
 */
function youth(
  path: string,
  opts: AssessOptions,
  now: Date,
): { tooYoung?: true; fileAgeDays?: number } {
  if (opts.probed?.(path) !== "never-ran") return {};
  const added = opts.workflowAddedAt?.(path);
  if (!added) return {};
  const ageMs = now.getTime() - new Date(added).getTime();
  if (Number.isNaN(ageMs)) return {};
  const fileAgeDays = Math.floor(ageMs / 86_400_000);
  const cron = opts.cronOf?.(path);
  const period = cron ? cronPeriodDays(cron) : undefined;
  if (period === undefined) return { fileAgeDays };
  return fileAgeDays < period ? { tooYoung: true, fileAgeDays } : { fileAgeDays };
}

export function assess(runs: RunSummary[], opts: AssessOptions = {}): WorkflowHealth[] {
  let now = opts.now;
  if (now === undefined) {
    // input-site: traced #7ab6c4e8 — the time workflows are assessed against when the caller gives none: a run that reaches it records no hash
    inputSiteReached("ci-health: assess's time");
    now = new Date();
  }
  const live = opts.workflowExists
    ? runs.filter((r) => !r.path || opts.workflowExists!(r.path))
    : runs;
  const rows: WorkflowHealth[] = [...byWorkflow(live).entries()]
    .map(([workflow, rs]) => {
      const h: WorkflowHealth = {
        workflow,
        path: rs[0]?.path,
        ...classifyRuns(rs, now, opts.headSha),
      };
      // `classifyRuns` only saw that no run carries the head sha. Whether this
      // workflow OWES one is a fact about its triggers, which only the caller
      // can read — and every unknown here clears the flag rather than keeping
      // it, so the report stays silent on anything it cannot establish.
      if (h.headUnjudged && opts.triggersOnPush?.(h.path ?? "") !== true) {
        delete h.headUnjudged;
      }
      // A failure against a version of the file that is gone is history. Note
      // that this only ever DEMOTES a red — it can never turn a failure into a
      // pass, because a later edit is evidence the failing version is gone, not
      // evidence the new one works.
      if (h.health === "red" && h.path && h.lastRun && opts.workflowChangedAt) {
        const changed = opts.workflowChangedAt(h.path);
        if (changed && changed > h.lastRun) {
          h.health = "superseded";
          h.supersededBy = changed;
        }
      }
      return h;
    });

  // Files that produced NO run in the window. Appended rather than merged,
  // because they come from a different source of truth: the runs say what
  // happened, the file list says what exists, and only the second can tell you
  // that something did not happen at all.
  //
  // `knownWorkflows` omitted means the caller did not look, and that is not
  // the same as there being none — so the loop simply does not run, and the
  // report is exactly what it was before this existed.
  const seen = new Set(rows.map((h) => h.path).filter((p): p is string => !!p));
  const extra: WorkflowHealth[] = [];
  for (const wf of opts.knownWorkflows ?? []) {
    if (seen.has(wf.path)) continue;
    extra.push({
      workflow: wf.name,
      path: wf.path,
      health: "no-runs",
      consecutiveFailures: 0,
      noRunsInWindow: true,
      // Unknown stays unset. A row that cannot say whether it was expected to
      // run says nothing about it, rather than implying "dispatch-only".
      ...(opts.hasSchedule?.(wf.path) === true ? { scheduled: true } : {}),
      // Unset when the caller supplied no predicate: "nobody asked" is not
      // "asked and could not tell", and only the second is `undetermined`.
      ...(opts.noRunReason?.(wf.path) ? { noRunReason: opts.noRunReason(wf.path) } : {}),
      ...(opts.probed?.(wf.path) ? { probe: opts.probed(wf.path) } : {}),
      ...youth(wf.path, opts, now),
    });
  }

  return [...rows, ...extra]
    .sort((a, b) => {
      // Worst first: a reader who reads one line should read the worst one.
      const order: Health[] = ["red", "running", "superseded", "green", "no-runs"];
      const rank = (h: WorkflowHealth) => order.indexOf(h.health);
      return rank(a) - rank(b) || b.consecutiveFailures - a.consecutiveFailures;
    });
}

/**
 * Render for the session-start sweep.
 *
 * `unreachable` is its own outcome, printed as loudly as a failure, because a
 * health check that goes quiet when it cannot see is worse than no check: it
 * reads as reassurance.
 */
export interface Window {
  /** How many runs the single API call returned. */
  runs: number;
  /** ISO timestamp of the OLDEST run in that page. */
  from: string;
  /** ISO timestamp of the NEWEST. */
  to: string;
}

/**
 * The window, in words, with its span in hours or days.
 *
 * **The span is the point, not the count.** `?per_page=100` is a page of RUNS,
 * not a period, so how far back it reaches is a function of how busy the
 * repository is. Measured here on 2026-09-20: 100 runs covered **6.1 hours**
 * (of 1096 on the branch). A weekly workflow cannot appear in six hours, and a
 * daily one appears only if the repository happens to be quiet — so `ci-health`
 * (weekly), `upstream-pins` (weekly) and `health-check` (daily) were absent by
 * construction from a report that then printed `✓ every workflow … is green`.
 *
 * That is `xom7` — a workflow red where nobody looks — inside the module
 * written for `xom7`. Stating the span is what lets a reader see it; fetching
 * the scheduled ones separately is what fixes it, and that is the caller's job
 * because it costs API calls.
 */
/**
 * The LONGEST gap a 5-field cron can leave between fires, in days.
 *
 * `undefined` when the expression is not one of the shapes below — which is
 * the honest answer and the one every caller here is built to take, rather
 * than a guess that would be indistinguishable from a measurement.
 *
 * ## Why an approximation is the right tool
 *
 * This answers exactly one question: **has this workflow's schedule had a
 * chance to fire since its file appeared?** For that, the longest gap is
 * sufficient and a full cron evaluator is not needed — and a full evaluator
 * is a surprising amount of code to carry for a yes/no.
 *
 * It exists because `never-ran` alone is ambiguous in the worst way. Measured
 * 2026-09-20: `upstream-pins.yml` had never run on `main` and the report
 * raised it as a finding. It had been added **the previous day**, and its
 * cron is `43 9 * * 2` — a Tuesday, two days out. Nothing was wrong with it.
 * A workflow neutered for months and one added yesterday rendered identically,
 * which is `5rfy`'s ambiguity one level in: the report could see that nothing
 * had run, and not that nothing *could* have.
 */
export function cronPeriodDays(cron: string): number | undefined {
  const f = cron.trim().split(/\s+/);
  if (f.length !== 5) return undefined;
  const [minute, hour, dom, , dow] = f as [string, string, string, string, string];

  // Anything sub-daily in minute or hour: at most a day, so nothing is ever
  // "too young" by more than that. One day is the safe over-estimate.
  if (/[*/,-]/.test(minute) && minute !== "*") return 1;
  if (minute === "*") return 1;
  if (hour === "*" || hour.includes("/")) return 1;

  const domEvery = dom === "*";
  const dowEvery = dow === "*";

  if (domEvery && dowEvery) return 1; // daily at a fixed time
  // A day-of-week field, with no day-of-month restriction: weekly at worst,
  // and less when it names several days — but the LONGEST gap is what is
  // asked for, so 7 stands whether it is one day or three.
  if (domEvery && !dowEvery) return 7;
  // A specific day of month. The longest month is 31 days.
  if (!domEvery && dowEvery) return 31;
  // Both restricted. GitHub ORs them, which can fire often or almost never
  // depending on the values; not worth guessing.
  return undefined;
}

export function describeWindow(w: Window): string {
  const hours = (new Date(w.to).getTime() - new Date(w.from).getTime()) / 3_600_000;
  const span =
    hours >= 48
      ? `${(hours / 24).toFixed(1)}d`
      : hours >= 1
        ? `${hours.toFixed(1)}h`
        : `${Math.round(hours * 60)}m`;
  return `${w.runs} recent run(s) spanning ${span}`;
}

export function render(
  health: WorkflowHealth[],
  opts: {
    unreachable?: string;
    branch: string;
    window?: Window;
    /**
     * Blame verdict per red workflow, by `workflow` name. OPTIONAL, and its
     * absence is rendered as a sentence rather than as a missing section — a
     * caller that did not compute blame is a different fact from a red with no
     * attributable merge, and collapsing them is the `1xhc` shape. Bean `kgho`.
     */
    blame?: ReadonlyMap<string, BlameVerdict>;
  },
): string {
  const lines = ["## CI health", ""];
  if (opts.window) {
    // Above the unreachable branch on purpose: when the check DID look, the
    // reader needs to know how far. A verdict without its window is a verdict
    // whose scope the reader has to assume, and they assume "all of it".
    lines.push(`_Window: ${describeWindow(opts.window)} on \`${opts.branch}\`._`, "");
  }
  if (opts.unreachable) {
    lines.push(
      `**Not checked — treat as unknown, not as green.** ${opts.unreachable}`,
      "",
      "`docs-site.yml` was red for 30 consecutive runs over two months without",
      "anyone noticing (bean `xom7`). An unchecked section is exactly how that",
      "looked from in here.",
      "",
    );
    return lines.join("\n");
  }
  if (health.length === 0) {
    lines.push(`_No runs on \`${opts.branch}\` in the window checked._`, "");
    return lines.join("\n");
  }

  const red = health.filter((h) => h.health === "red");
  const STALE_DAYS = 7;
  for (const h of red) {
    const since =
      h.daysSinceSuccess === undefined
        ? "no success in the window"
        : `last green ${h.daysSinceSuccess}d ago`;
    // A red that has not re-run in a week may already be fixed — flag it as
    // stale so the reader triages it differently from something failing now.
    const age =
      h.daysSinceLastRun === undefined
        ? ""
        : h.daysSinceLastRun >= STALE_DAYS
          ? `, but has not run in ${h.daysSinceLastRun}d — may be stale`
          : `, last ran ${h.daysSinceLastRun}d ago`;
    lines.push(
      `- ❌ **${h.workflow}** — ${h.consecutiveFailures} consecutive failure(s), ${since}${age}` +
        (h.latestUrl ? `\n      ${h.latestUrl}` : ""),
    );
  }
  // Reported, but below the fold and never as a pass: the failing version of
  // the file is gone, which is not the same as knowing the current one works.
  const superseded = health.filter((h) => h.health === "superseded");
  for (const h of superseded) {
    lines.push(
      `- ❔ **${h.workflow}** — last failed ${h.daysSinceLastRun}d ago, but the ` +
        `workflow file changed after that. Verdict is stale, not green; nothing ` +
        `has re-run it since.`,
    );
  }

  // A workflow whose newest run has not settled is reported by name, above the
  // summary, because the summary is the line a reader takes away. Saying
  // "every workflow is green" while a run is in flight over the commit they
  // are looking at is the exact sentence bean `gpuu` was opened for.
  const pending = health.filter((h) => h.newestUnsettled || h.headUnjudged);
  for (const h of pending) {
    // Two different silences, and the difference is what a reader acts on: a
    // run exists and has not finished (wait), or no run was ever created for
    // this commit (go and look at why).
    const why = h.headUnjudged
      ? "no run has judged the current head"
      : "newest run has not reported";
    lines.push(
      `- ⏳ **${h.workflow}** — ${why}; the ${h.health} below ` +
        `is the last settled verdict and may predate the current head.` +
        (h.latestUrl ? `\n      ${h.latestUrl}` : ""),
    );
  }

  // A scheduled workflow that produced nothing in the window is reported ABOVE
  // the summary and by name. It is not a failure — it may simply have a period
  // longer than the window — but it is the one thing a reader must not take
  // the summary's word on, because the summary is computed from workflows that
  // ran and this one did not.
  // A workflow that has never run because its schedule has not come round yet
  // is NOT a finding, and must not sit in the list that withholds the green
  // tick. It is still reported — silence would be the other error — but below
  // the fold and as a fact.
  const tooYoung = health.filter((h) => h.noRunsInWindow && h.scheduled && h.tooYoung);
  const unjudgedScheduled = health.filter(
    (h) => h.noRunsInWindow && h.scheduled && !h.tooYoung,
  );
  for (const h of unjudgedScheduled) {
    const why =
      h.probe === "never-ran"
        ? "asked directly, and it has **never run on this branch**. A workflow " +
          "with no runs cannot be red, so nothing that reads runs can see it " +
          "(bean `5rfy`)."
        : h.probe === "unknown"
          ? "asked directly, and the request failed — state UNKNOWN, not green."
          : "**no run of it fell in the window**, and it was not asked directly. " +
            "If its period is longer than the window above, it cannot appear " +
            "however healthy or broken it is.";
    lines.push(`- ⚠️ **${h.workflow}** — fires on a schedule; ${why}`);
  }

  for (const h of tooYoung) {
    lines.push(
      `- 🌱 **${h.workflow}** — scheduled and not yet run, but the file is only ` +
        `${h.fileAgeDays}d old and its schedule has not come round. Nothing to do.`,
    );
  }

  const unjudgedOther = health.filter((h) => h.noRunsInWindow && !h.scheduled);
  if (unjudgedOther.length > 0) {
    /* A count rather than a list, BY CLASS. Most of these are folio-vendored,
     * dispatch-only files the platform should never judge, and naming 35 of
     * them every run is how a reader learns to skip the section — so the
     * benign classes stay counts. What changed is that the classes are
     * measured rather than asserted in a parenthetical, and the one class that
     * IS a defect is named: a workflow that can fire here and did not. */
    const by = (r: NoRunReason) => unjudgedOther.filter((h) => h.noRunReason === r).length;
    const unsaid = unjudgedOther.filter((h) => h.noRunReason === undefined).length;
    const parts = [
      by("dispatch-only") ? `${by("dispatch-only")} cannot fire by themselves` : "",
      by("path-filtered") ? `${by("path-filtered")} fire only on specific paths` : "",
      by("undetermined") ? `${by("undetermined")} unreadable` : "",
      unsaid ? `${unsaid} unclassified` : "",
    ].filter(Boolean);
    lines.push(
      `- ℹ️ ${unjudgedOther.length} other workflow file(s) produced no run in ` +
        `the window and are unjudged` +
        (parts.length ? `: ${parts.join(", ")}.` : "."),
    );
    for (const h of unjudgedOther.filter((x) => x.noRunReason === "auto-triggered")) {
      lines.push(
        `- ⚠️ **${h.workflow}** — UNJUDGED: it can fire on this branch and produced no run. Not green.`,
      );
    }
  }

  const ok = health.filter(
    (h) => h.health !== "red" && h.health !== "superseded" && !h.noRunsInWindow,
  );
  if (
    red.length === 0 &&
    superseded.length === 0 &&
    pending.length === 0 &&
    unjudgedScheduled.length === 0
  ) {
    lines.push(`✓ every workflow with a recent run on \`${opts.branch}\` is green (${ok.length}).`);
  } else if (red.length === 0 && superseded.length === 0 && pending.length === 0) {
    // Every workflow that RAN is green, and at least one scheduled workflow did
    // not run. The tick is withheld deliberately: a reader who sees ✓ stops
    // reading, and what is above this line is the part they must not stop
    // before.
    lines.push(
      "",
      `_(${ok.length} workflow(s) green; ${unjudgedScheduled.length} scheduled ` +
        `workflow(s) unjudged. Not "all green" — the window did not reach them.)_`,
    );
  } else if (red.length === 0 && superseded.length === 0) {
    lines.push(
      `_(no settled failures; ${pending.length} workflow(s) still reporting. ` +
        `Not "all green" — the head has not been judged.)_`,
    );
  } else if (red.length === 0) {
    // Not "all green" — that would be the lie this module exists to prevent.
    lines.push("", `_(no live failures; ${ok.length} workflow(s) green.)_`);
  } else {
    lines.push("", `_(${ok.length} other workflow(s) not failing.)_`);
  }
  // WHICH MERGE, for each live failure — bean `kgho`, implementing `391j`'s
  // "check the parent before blaming the last merge". Deliberately a section
  // rather than a column: a blame is two shas and a reason, and squeezing it
  // into the table would cost the reason, which is the part that stops the
  // reader trusting a guess.
  if (red.length > 0) {
    lines.push("", "### Which merge", "");
    if (opts.blame === undefined) {
      // NOT silence. A caller that did not ask is a different fact from a red
      // whose cause could not be found, and a missing section reads as neither.
      lines.push("_Attribution was not computed for this report._", "");
    } else {
      for (const h of red) {
        const v = opts.blame.get(h.workflow);
        lines.push(
          `- **${h.workflow}** — ` +
            (v ? renderBlame(v) : "no attribution was computed for this workflow."),
        );
      }
      lines.push("");
    }
  }
  lines.push("");
  return lines.join("\n");
}

// ── Pages deployments — bean `3yi4` ──────────────────────────────────────
//
// **A Pages build outcome is not repository state.** It is a fact an external
// service holds, which *changes the status of the repo* — the owner's
// correction, 2026-09-20: *"they are not. changes status of repo. tools need
// to look external."* So nothing here caches it; these are pure reducers over
// what the caller fetched, and the caller asks the API.
//
// The gap they close: `bm6d` measured **6 of the last 10 `pages build and
// deployment` runs cancelled**, in an exact pattern, with nothing anywhere
// saying so. Three properties hid it — the runs are on `gh-pages` rather than
// the default branch, they are bot-triggered (`github-pages[bot]`, event
// `dynamic`), and the query above asks `?branch=<default>`. The reader was
// never missing; the question was too narrow.

/** The workflow GitHub runs for Pages. Not a file in `.github/workflows/`. */
export const PAGES_WORKFLOW = "pages build and deployment";

export interface PagesHealth {
  total: number;
  success: number;
  /**
   * THE THIRD STATE, and the reason this exists. A cancelled deployment is
   * neither success nor failure: nothing broke, and nothing shipped. Folding
   * it into either is the lie — into success because the preview is stale,
   * into failure because nobody needs to fix a build that was superseded.
   */
  cancelled: number;
  failure: number;
  /** Queued, in flight, skipped, neutral — not yet a verdict of any kind. */
  unsettled: number;
  /**
   * The newest Pages run of any kind, settled or not.
   *
   * Routinely still in flight — it was in the run that produced bean `thsz` —
   * which is exactly why it cannot answer "did the last deployment work?".
   * {@link PagesHealth.newestSettled} is the one that can.
   */
  latest?: RunSummary;
  /**
   * The newest Pages run that reached a CONCLUSION — and the field that lets a
   * reader tell coalescing from starvation. Bean `thsz`.
   *
   * GitHub Pages has **one deployment per repository**, so every push to the
   * publish ref cancels the build in flight and the survivor publishes
   * everything on the ref. A high cancellation share is therefore the normal
   * shape of a busy hour, and the same share means two opposite things:
   *
   * | this run | what the share means |
   * |---|---|
   * | `success` | coalescing — the site is current, and the cancellations behind it shipped their content in the survivor |
   * | `cancelled` | **starvation** — nothing is getting through, and the site is as of the last success |
   *
   * The section reported 78 cancelled against 21 succeeded on 2026-09-25 and
   * its own author read it as a ten-hour outage. It was not one: the newest run
   * before a quiet period had SUCCEEDED, and the gap was nobody pushing. A
   * number whose first reader takes the alarming meaning is not neutral
   * reporting — it is `xom7` pointing the other way.
   */
  newestSettled?: RunSummary;
  /** `created_at` of the newest successful deployment, when there is one. */
  lastSuccessAt?: string;
}

/** Reduce the Pages runs the caller fetched. Pure; asks nothing. */
export function pagesHealth(runs: readonly RunSummary[]): PagesHealth {
  const pages = runs.filter((r) => r.name.toLowerCase() === PAGES_WORKFLOW);
  const h: PagesHealth = {
    total: pages.length,
    success: 0,
    cancelled: 0,
    failure: 0,
    unsettled: 0,
    latest: pages[0],
  };
  for (const r of pages) {
    if (r.status !== "completed") h.unsettled++;
    else if (r.conclusion === "success") h.success++;
    else if (r.conclusion === "cancelled") h.cancelled++;
    else if (NOT_A_VERDICT.has(r.conclusion ?? "")) h.unsettled++;
    else h.failure++;
  }
  // Newest-first is how the API returns them, and `find` takes the first match
  // — so this is the newest run that reached a conclusion, not merely any
  // settled one. A run still in flight is skipped rather than counted as a
  // verdict, which is the same rule the tallies above follow.
  h.newestSettled = pages.find((r) => r.status === "completed");
  h.lastSuccessAt = pages.find(
    (r) => r.status === "completed" && r.conclusion === "success",
  )?.created_at;
  return h;
}

/** One commit on the publish branch, as the commits API returns it. */
export interface DeployCommit {
  sha: string;
  message: string;
  /** ISO-8601. */
  date: string;
}

/**
 * The staging slug a publish-branch commit is about, or `undefined`.
 *
 * Three spellings, and **the order between them is load-bearing** — which a
 * mutation established rather than a reading. The first version tried the
 * `staging(<slug>):` subject first and a `render-log: … branches/<slug>`
 * trailer second, on the rationale that the subject is authoritative. Stubbing
 * the order gave a SURVIVING mutation, so the rationale was checked against
 * `feature-staging.yml` and was wrong twice over.
 *
 * It was vacuous where it was right: a deploy commit writes `$STAGING_SLUG`
 * into both spellings from one variable, so on that commit the two branches
 * cannot disagree and the order decides nothing.
 *
 * And it was wrong where it mattered: the cleanup commits spell the subject
 * `staging(cleanup): remove branches/<slug>`, where `cleanup` is the OPERATION
 * and the slug is in the path. Subject-first read every removal as a deploy of
 * a branch called `cleanup` — so two removals for two unrelated PRs became one
 * slug, and {@link selfSupersedes} reported them as this repository contending
 * with itself. A false finding in exactly the direction `3yi4` exists to
 * remove.
 *
 * So a `branches/<slug>` path wins wherever it appears, and the bare subject is
 * the fallback for a deploy commit that carries no path. Order alone carries
 * it — the first fix also excluded the literal `cleanup` from the subject
 * branch, and a test written for the cost of the fix rather than its benefit
 * caught that this breaks a branch genuinely NAMED `cleanup`, whose deploy
 * commit has no `remove branches/` for the first branch to find. A blanket
 * exclusion would have made one real branch permanently invisible to the
 * report, to guard a case the ordering already handles.
 */
export function slugOfDeployCommit(message: string): string | undefined {
  const removed = /^staging\(cleanup\): \w+ (?:branches|STAGING)\/(\S+)/m.exec(message);
  if (removed) return removed[1];
  const logged = /^render-log: \w+ (?:branches|STAGING)\/(\S+)/m.exec(message);
  if (logged) return logged[1];
  const staged = /^staging\(([^)]+)\):/m.exec(message);
  if (staged) return staged[1];
  return undefined;
}

export interface SelfSupersede {
  slug: string;
  /** The commit that cancelled the build of `superseded`. */
  by: string;
  superseded: string;
  secondsApart: number;
}

/**
 * Consecutive publish-branch commits from ONE deploy — `bm6d`'s signature.
 *
 * **This is what separates self-cancellation from cross-session contention**,
 * which `3yi4` asks for and `bm6d` needs: that bean fixed one workflow pushing
 * twice and did nothing about four sessions contending for one ref, so a
 * merged cancellation count cannot show whether it worked.
 *
 * Two commits naming the SAME slug within `withinSeconds` are one deploy
 * writing twice; the second cancels the first's Pages build. Different slugs
 * are two sessions, which is `yzsj`'s ground and not counted here.
 *
 * `commits` is newest-first, as the API returns it.
 */
export function selfSupersedes(
  commits: readonly DeployCommit[],
  withinSeconds = 120,
): SelfSupersede[] {
  const out: SelfSupersede[] = [];
  for (let i = 0; i + 1 < commits.length; i++) {
    const newer = commits[i];
    const older = commits[i + 1];
    const a = slugOfDeployCommit(newer.message);
    const b = slugOfDeployCommit(older.message);
    if (!a || a !== b) continue;
    const gap = (Date.parse(newer.date) - Date.parse(older.date)) / 1000;
    // A negative gap means the caller did not hand them over newest-first.
    // Refuse rather than report a pair from an ordering we cannot trust.
    if (!Number.isFinite(gap) || gap < 0 || gap > withinSeconds) continue;
    out.push({ slug: a, by: newer.sha, superseded: older.sha, secondsApart: gap });
  }
  return out;
}

/**
 * Everything the caller managed to learn about the Pages deployments.
 *
 * Two independent questions, so two independent "could not look" fields. The
 * runs and the publish-branch commits come from different endpoints and either
 * can fail alone; one reason field would make a failure of one silence the
 * other, which is the `xom7` shape at the level of the report itself.
 */
/**
 * What is known about a bean this report CITES.
 *
 * Bean `xfyk`. This section used to state a cited bean's position outright —
 * *"which is a different fix and is not done"* about `yzsj` — and that clause
 * went stale the moment `yzsj` closed on 2026-09-21, sending the next reader
 * to a finished 200-line bean. The comment a few lines below records fixing
 * the *pointer* (`6pfo` -> `yzsj`) and names the class: **a reference inside
 * printed output that resolves to the wrong thing**. The pointer was fixed;
 * the CLAIM ATTACHED TO IT was left hardcoded, so it drifted instead.
 *
 * A bean's status lives in the work plan. A copy of it in a renderer is a
 * second place for one fact, which is the arrangement `AGENTS.md` refuses for
 * rules and which fails here for exactly the same reason. So the status is
 * RESOLVED BY THE CALLER — `check-ci-health.ts`, which has a repository root —
 * and this renderer stays a pure function of its report.
 *
 * Three states, because "could not read the work plan" is not "the bean is
 * open", and neither is "no such bean".
 */
export type CitedBean =
  /** Read from the store. `status` is the bean's own word, not an interpretation. */
  | { state: "read"; status: string }
  /** The id resolves to nothing. Beans are never deleted, so this is a typo or a rename. */
  | { state: "absent" }
  /** No readable bean store on this run. NOT rendered as either. */
  | { state: "unreadable"; why: string };

/** Statuses meaning the work is finished, one way or the other. */
const SETTLED = new Set(["completed", "scrapped"]);

/**
 * How a citation reads, given what is known about the bean.
 *
 * Exported so a test can drive every branch without building a report, and
 * because the phrasing IS the contribution: each branch has to be honest
 * about a different thing.
 */
export function citationClause(id: string, bean: CitedBean | undefined): string[] {
  // Returned as LINES, hand-wrapped like every other block in this renderer.
  // One long string reads fine in a terminal and wraps raggedly in the
  // markdown the watchdog commits, which is the surface this is read on.
  if (bean === undefined || bean.state === "unreadable") {
    const why = bean?.state === "unreadable" ? ` (${bean.why})` : "";
    return [
      `ref (\`${id}\`). This run could not read the work plan${why}, so`,
      "whether that is still open is unknown here — not assumed either way.",
    ];
  }
  if (bean.state === "absent") {
    return [
      `ref (\`${id}\`) — and this store holds no such bean, so the citation is`,
      "stale. Beans are never deleted here, so it was renamed or mistyped.",
    ];
  }
  if (SETTLED.has(bean.status)) {
    return [
      `ref (\`${id}\`, now \`${bean.status}\`). Cancellations continuing past that`,
      "fix are NEW ground rather than its residue, and worth a fresh",
      "measurement rather than a reread of a closed bean.",
    ];
  }
  return [`ref (\`${id}\`), which is a different fix and is \`${bean.status}\`.`];
}

export interface PagesReport {
  /** Absent when {@link PagesReport.unreachable} says why. */
  health?: PagesHealth;
  /** Why the deployment runs could not be read. Never rendered as green. */
  unreachable?: string;
  /**
   * The branch the deployments actually ran against — **measured** from the
   * runs, never assumed. `/repos/{slug}/pages` would say it outright and
   * answers 403 without admin (checked 2026-09-20), so the publish branch is
   * read off `head_branch`. A repository publishing from `main` or from a
   * `docs/` folder therefore reports its own branch rather than a guess.
   */
  publishBranch?: string;
  supersedes?: SelfSupersede[];
  /** Why the publish-branch commits could not be read. */
  commitsUnreachable?: string;
  /** The span the commits covered, for the same reason the CI window exists. */
  window?: Window;
  /**
   * Work-plan status of the beans this section names, resolved by the CALLER.
   * Absent means nobody looked, which {@link citationClause} renders as an
   * unknown rather than as either answer.
   */
  citedBeans?: Record<string, CitedBean>;
}

/**
 * The Pages section, rendered separately from {@link render} **on purpose**.
 *
 * `render` returns early when the default-branch API was unreachable and again
 * when that branch had no runs. Folding this in would let a failure to read
 * `main` silence a question about `gh-pages` — two independent facts collapsed
 * into one verdict, which is the defect the whole module exists to prevent.
 * Separate functions make that structurally impossible rather than carefully
 * avoided.
 *
 * ## It reports; it does not grade a share
 *
 * Measured 2026-09-20 on this repository: **52 of the last 100** deployments
 * cancelled, 48 succeeded, none failed. That is bad, and no number here says
 * how bad, because no basis for a threshold exists — the same argument that
 * stopped `6xaz` inventing one. The counts are stated and the reader judges.
 *
 * The one graded statement is a FLOOR rather than a threshold: deployments
 * happened and **not one of them succeeded**. That is answerable without
 * calibration, exactly as `-z` on `ls -A` is in `oisv`.
 */
export function renderPages(r: PagesReport): string {
  const lines = ["## Pages deployments", ""];
  lines.push(
    "_A Pages build outcome is not repository state — it is a fact GitHub holds_",
    "_about this repository, asked fresh every run and cached nowhere._",
    "",
  );
  if (r.unreachable || !r.health) {
    lines.push(
      `**Not checked — treat as unknown, not as green.** ${r.unreachable ?? "no deployment runs were fetched."}`,
      "",
      "The previews may or may not be building. Nothing here can tell you which.",
      "",
    );
    return lines.join("\n");
  }
  const h = r.health;
  const on = r.publishBranch ? ` on \`${r.publishBranch}\`` : "";
  if (h.total === 0) {
    // NOT a green. A repository with no Pages, and a repository whose
    // deployments this failed to see, look identical from here.
    lines.push(
      `_No \`${PAGES_WORKFLOW}\` runs in the window${on}._ Unjudged, not green —`,
      "a repository that publishes nothing and one whose deployments went",
      "unseen read the same from here.",
      "",
    );
    return lines.join("\n");
  }
  lines.push(
    `_Window: ${r.window ? describeWindow(r.window) : `${h.total} recent deployments`}${on}._`,
    "",
  );
  lines.push(
    `- ✓ **${h.success}** succeeded`,
    `- ❔ **${h.cancelled}** cancelled — *neither shipped nor broken*: a superseded`,
    "  build leaves the previous preview in place, so the site is stale rather",
    "  than down, and nobody is sent to fix anything.",
    `- ✗ **${h.failure}** failed`,
    `- ⏳ **${h.unsettled}** not settled`,
    "",
  );
  if (h.success === 0) {
    // The floor. No calibration needed to say that nothing got through.
    lines.push(
      `**Not one of ${h.total} deployments succeeded.** The published site is`,
      "whatever the last successful build left, and that is older than this window.",
      "",
    );
  }
  // WHAT THE SHARE ABOVE MEANS — bean `thsz`.
  //
  // The counts alone are ambiguous by a factor that matters, and the ambiguity
  // is not the reader's fault. GitHub Pages runs ONE deployment per repository,
  // so every push to the publish ref cancels the build in flight and the
  // survivor publishes everything on the ref: during a busy hour most builds
  // are cancelled BY DESIGN and nothing is wrong. During starvation the same
  // share means nothing is getting through at all.
  //
  // So the section answers it rather than leaving the reader to supply an
  // interpretation — which it did until this, and the first reader to try
  // supplied the alarming one and nearly reported an outage that was a quiet
  // afternoon.
  //
  // A floor, not a threshold: "did the newest deployment to settle succeed?"
  // needs no calibration, exactly as `oisv`'s empty-directory check does not.
  // Nothing here grades the share, and nothing invents a staleness cutoff.
  if (h.newestSettled === undefined) {
    if (h.total > 0) {
      lines.push(
        "**No deployment in this window has settled yet**, so the share above is",
        "not a verdict on anything — there is no newest outcome to read it against.",
        "",
      );
    }
  } else if (h.newestSettled.conclusion === "success") {
    lines.push(
      `**The newest deployment to settle SUCCEEDED** (${h.newestSettled.created_at}),`,
      "so the published site reflects the publish ref as of that build. The",
      "cancellations above are superseded builds whose content shipped in the one",
      "that survived them — coalescing, not failure.",
      "",
    );
  } else {
    // Cancelled, failed, or any other non-success. Named rather than assumed.
    const since =
      h.lastSuccessAt === undefined
        ? "and **no deployment in this window succeeded at all**"
        : `and the site is as of ${h.lastSuccessAt}`;
    lines.push(
      `**The newest deployment to settle did NOT succeed** ` +
        `(${h.newestSettled.conclusion ?? "no conclusion"}, ${h.newestSettled.created_at}),`,
      `${since}. If pushes are still arriving, that is starvation rather than`,
      "coalescing: nothing is reaching the published site. If the ref has simply",
      "gone quiet, the next push settles it.",
      "",
    );
  }
  if (r.commitsUnreachable) {
    lines.push(
      `_Could not read the publish branch's commits (${r.commitsUnreachable}), so_`,
      "_the cancellations below are uncategorised — not absent._",
      "",
    );
    return lines.join("\n");
  }
  const self = r.supersedes ?? [];
  if (self.length === 0) {
    lines.push(
      "No deployment superseded its own slug in the window — whatever cancelled",
      "these builds, it was not one workflow pushing twice (`bm6d`).",
      "",
    );
    return lines.join("\n");
  }
  // WHOSE contention. `bm6d` fixed one workflow pushing twice; `yzsj` is
  // several sessions racing for one ref. A merged count cannot show whether
  // the first fix held, which is why these are named.
  //
  // Neither status is stated here any more — see {@link citationClause}. This
  // comment said `yzsj` "is not fixed" and was wrong from 2026-09-21.
  //
  // This cited `6pfo` until 2026-09-20, in four places across two files. It
  // does not fit: `6pfo` is "publish staging metadata as a KG graph", and all
  // 290 lines of it contain no mention of contention, racing or a rejected
  // push. An agent reading the report below was sent to a bean about
  // metadata when the problem in front of it was a race — the `b963` shape,
  // one level up: a reference inside printed output that resolves to the
  // wrong thing. `yzsj` (issue #605) is the bean that measured it.
  const bySlug = new Map<string, number>();
  for (const s of self) bySlug.set(s.slug, (bySlug.get(s.slug) ?? 0) + 1);
  lines.push(
    `**${self.length}** cancellation(s) were self-inflicted: one deploy pushed`,
    "twice and cancelled its own build. That is `bm6d`'s signature, and a slug",
    "still showing it is running a workflow from before that fix.",
    "",
  );
  for (const [slug, n] of [...bySlug.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`- \`${slug}\` — ${n}`);
  }
  lines.push(
    "",
    "Cancellations NOT listed here are several sessions racing for the publish",
    ...citationClause("yzsj", r.citedBeans?.yzsj),
    "",
  );
  return lines.join("\n");
}

/**
 * How far back {@link blameFailingRun} will walk before giving up.
 *
 * Stated rather than left implicit because an unbounded walk turns a long red
 * stretch into an API sweep: one request per step, per failing workflow, on a
 * trigger that fires on every failure. At 10 it examines EXACTLY ten parents —
 * the loop is exclusive, so the constant is the request budget rather than one
 * less than it — and covers about 77 minutes of this repository's merge cadence
 * (7.7 min median, measured over 186 merges in 24h, bean `kgho`), long enough
 * that a walk hitting the cap is itself worth reporting rather than a routine
 * outcome.
 */
export const BLAME_WALK_CAP = 10;

/** A workflow's outcome on one commit, as {@link blameFailingRun} needs it. */
export type ConclusionOnCommit = "success" | "failure" | "none" | "unknown";

/**
 * Which merge a red `main` is attributable to — or, explicitly, that it cannot
 * be told.
 *
 * `stepsBack: 0` means the failing commit itself; anything higher means the
 * failure predates it and blaming the last merge would have been wrong.
 */
export type BlameVerdict =
  | { kind: "suspect"; sha: string; parentSha: string; stepsBack: number }
  | { kind: "cannot-determine"; why: BlameUnknown; at: string; stepsBack: number };

/**
 * Why a blame could not be computed. Each is a DIFFERENT fact with a different
 * remedy, so they are not collapsed into one "unknown":
 *
 * - `no-run-on-parent` — the parent has no run of this workflow. **The one that
 *   must never be read as "the parent was green"**; see below.
 * - `no-parent` — the walk reached a commit with no first parent (a root, or a
 *   shallow clone's boundary, which is why the workflow keeps `fetch-depth: 0`).
 * - `walk-exhausted` — {@link BLAME_WALK_CAP} steps and still red. The failure
 *   is older than the window this is willing to pay for.
 * - `lookup-failed` — the request for a parent's conclusion did not answer.
 */
export type BlameUnknown = "no-run-on-parent" | "no-parent" | "walk-exhausted" | "lookup-failed";

/**
 * Walk first-parents back from a failing commit to the merge that broke it.
 *
 * **The parent is checked before the last merge is blamed**, which is bean
 * `391j`'s rule and the reason this function exists rather than the report
 * simply naming the failing run's own commit. `391j` blamed #1245's merge when
 * `main` had already been red one merge earlier at `08fe2c68`; the diagnosis
 * was confident, cited a real commit, and was wrong.
 *
 * **`none` is not `success`.** A commit with no run of this workflow is not a
 * commit that passed it, and returning a suspect on that basis would put a
 * false accusation in a tracking issue somebody then acts on. That is the same
 * false-fire direction `GITHUB_COMMIT_FILES_CAP` and `workflowChangedAt` already
 * refuse in this module: a wrong answer is worse than no answer. So `none`
 * ends the walk as `cannot-determine`, never as a verdict.
 *
 * Pure: every fact comes from an injected lookup, as {@link assess}'s do, so
 * the walk is testable without a network or a git tree.
 */
export function blameFailingRun(opts: {
  /** The commit whose run of this workflow failed. */
  failingSha: string;
  /** First parent of a commit, or `undefined` if it has none / is unknown. */
  firstParent: (sha: string) => string | undefined;
  /** This workflow's conclusion on a commit. */
  conclusionOn: (sha: string) => ConclusionOnCommit;
  /** Override the walk bound; defaults to {@link BLAME_WALK_CAP}. */
  cap?: number;
}): BlameVerdict {
  const cap = opts.cap ?? BLAME_WALK_CAP;
  let cur = opts.failingSha;

  // EXCLUSIVE. `<=` examined `cap + 1` parents and returned `stepsBack: cap + 1`,
  // while `renderBlame` said "still red 10 first-parents back" and the cap's own
  // docblock promised "at most ten extra requests" — three numbers, two of them
  // wrong. Found by review on #1725. The budget is now what the constant says.
  for (let stepsBack = 0; stepsBack < cap; stepsBack++) {
    const parent = opts.firstParent(cur);
    if (parent === undefined) return { kind: "cannot-determine", why: "no-parent", at: cur, stepsBack };

    const c = opts.conclusionOn(parent);
    if (c === "success") return { kind: "suspect", sha: cur, parentSha: parent, stepsBack };
    if (c === "none") return { kind: "cannot-determine", why: "no-run-on-parent", at: parent, stepsBack };
    if (c === "unknown") return { kind: "cannot-determine", why: "lookup-failed", at: parent, stepsBack };

    // `failure`: the parent is red too, so `cur` did not cause it. Keep going.
    cur = parent;
  }
  return { kind: "cannot-determine", why: "walk-exhausted", at: cur, stepsBack: cap };
}

/**
 * The blame verdict as one line for the tracking issue.
 *
 * Every `cannot-determine` renders as a sentence saying WHAT is not known, never
 * as an omission — a report that simply leaves the suspect out is
 * indistinguishable from one where nothing was wrong, which is `1xhc`.
 */
export function renderBlame(v: BlameVerdict): string {
  const short = (s: string) => s.slice(0, 11);
  if (v.kind === "suspect") {
    return v.stepsBack === 0
      ? `Suspect: \`${short(v.sha)}\` — its first parent \`${short(v.parentSha)}\` was green for this workflow.`
      : `Suspect: \`${short(v.sha)}\`, **${v.stepsBack} merge(s) before the failing one** — ` +
          `the last green first-parent for this workflow is \`${short(v.parentSha)}\`. ` +
          `Blaming the most recent merge would have been wrong (bean \`391j\`).`;
  }
  const why = {
    "no-run-on-parent":
      `\`${short(v.at)}\` has NO run of this workflow, so it cannot be called green. ` +
      `No suspect is named: a commit with no run is not a commit that passed.`,
    "no-parent": `\`${short(v.at)}\` has no first parent available, so the walk could not continue.`,
    "walk-exhausted":
      `still red ${BLAME_WALK_CAP} first-parents back, at \`${short(v.at)}\`. ` +
      `The failure is older than this walk pays for — it is not the recent merges.`,
    "lookup-failed": `the conclusion on \`${short(v.at)}\` could not be fetched.`,
  }[v.why];
  return `Suspect merge: **could not determine** — ${why}`;
}

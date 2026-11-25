#!/usr/bin/env bun
/**
 * Workflow YAML that GitHub will actually parse.
 *
 * ## Why a local check, when CI already runs the workflows
 *
 * Because a workflow GitHub cannot parse does not fail loudly — it produces a
 * run **named by its file path instead of its `name:`**, because there is no
 * `name:` to read. `AGENTS.md` records two workflows that failed this way on
 * 2026-08-07 and stayed red for a day. I reproduced it on 2026-09-18 by adding
 * a second `env:` block to a step that already had one.
 *
 * The trap is that **`yaml.safe_load` accepts duplicate keys** — the YAML spec
 * says they are invalid, but most loaders take the last one silently. So
 * "it parses locally" is not evidence, and that is exactly what I relied on.
 *
 * ## What is checked
 *
 * - **Duplicate keys at any level.** The failure above.
 * - **`${{ }}` inside a `run:` body**, where the expression is substituted into
 *   the script TEXT before the shell parses it. Trusted contexts are allowed;
 *   anything attacker-controlled is an error. See
 *   `skills/conduct/conduct-core/untrusted-input.md`.
 * - **A job that pushes `gh-pages` with no protection against the race.**
 *   Either the shared `gh-pages-push` concurrency group, or a retry. One or
 *   the other, because they all contend for a single ref.
 * - **A job that REPLACES the whole publish branch without carrying the open
 *   PRs' `branches/` previews across.** Bean `plj1`.
 * - **A push to `qa-reports` that does not go through `qa-store.ts`.** Bean
 *   `16ei`: `qa-reports-unretried`.
 *
 * @module scripts/check-workflows
 * @covers none — .github/workflows/ is not a declared graph typology
 */
import { readdirSync, readFileSync } from "node:fs";
import { parse, parseDocument } from "yaml";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { PREVIEW_PREFIX } from "./lib/preview-prefix.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(repoRootFor(ROOT), ".github", "workflows");

/**
 * Expressions an attacker can choose the value of.
 *
 * Deliberately a list of the dangerous ones rather than an allow-list of safe
 * ones: a blanket rule over every `${{ }}` would flag `github.workspace` and
 * `matrix.*`, produce a wall of false findings, and get switched off — which is
 * how a check stops being a check.
 */
const ATTACKER_CONTROLLED = [
  /github\.event\.pull_request\.head\.ref/,
  /github\.event\.pull_request\.title/,
  /github\.event\.pull_request\.body/,
  /github\.event\.issue\.title/,
  /github\.event\.issue\.body/,
  /github\.event\.comment\.body/,
  /github\.event\.pull_request\.labels/,
  /github\.head_ref/,
];

export interface WorkflowFinding {
  file: string;
  line: number;
  kind:
    | "duplicate-key"
    | "unparseable"
    | "interpolated-untrusted"
    | "gh-pages-ungrouped"
    | "gh-pages-wipes-staging"
    | "qa-reports-unretried"
    | "bean-gate-unmounted"
    | "exit-status-swallowed";
  detail: string;
}

/**
 * Duplicate keys, from a real YAML parser.
 *
 * Hand-rolled scope tracking got this wrong **twice** — first reporting
 * `types:` under `pull_request:` as a duplicate of `types:` under
 * `pull_request_target:`, then reporting `run:` in one step as a duplicate of
 * `run:` in the step before it. Both times the checker would have produced a
 * wall of false findings in a repository with no duplicates at all, which is
 * the failure its own doc comment warns about.
 *
 * Two wrong attempts is evidence, not bad luck: YAML scoping is a parser's job.
 * `yaml`'s `parseDocument` reports duplicates as errors with line/column, which
 * is exactly the question being asked, and it is the same class of parser
 * GitHub uses.
 */
function duplicateKeys(text: string, file: string): WorkflowFinding[] {
  const doc = parseDocument(text, { uniqueKeys: true, keepSourceTokens: false });
  return doc.errors
    .filter((e) => /duplicate/i.test(e.message))
    .map((e) => ({
      file,
      line: e.linePos?.[0]?.line ?? 0,
      kind: "duplicate-key" as const,
      detail: `${e.message} — loaders take the LAST silently; GitHub refuses the file.`,
    }));
}

/**
 * Anything else the parser refuses.
 *
 * A workflow GitHub cannot parse produces a run named by its FILE PATH rather
 * than by its `name:`, because there is no `name:` to read — which is why this
 * class of failure reads as an ordinary red rather than as "the file is
 * broken". Reported separately from duplicates so the message says which.
 */
function unparseable(text: string, file: string): WorkflowFinding[] {
  const doc = parseDocument(text, { uniqueKeys: true });
  return doc.errors
    .filter((e) => !/duplicate/i.test(e.message))
    .map((e) => ({
      file,
      line: e.linePos?.[0]?.line ?? 0,
      kind: "unparseable" as const,
      detail: e.message,
    }));
}

/** `${{ attacker-controlled }}` inside a `run:` body. */
function interpolatedUntrusted(text: string, file: string): WorkflowFinding[] {
  const out: WorkflowFinding[] = [];
  const lines = text.split("\n");
  let inRun = false;
  let runIndent = 0;

  lines.forEach((line, i) => {
    const m = /^(\s*)run:\s*\|?/.exec(line);
    if (m !== null) {
      inRun = true;
      runIndent = m[1].length;
      return;
    }
    if (!inRun) return;
    if (line.trim() !== "" && line.length - line.trimStart().length <= runIndent) {
      inRun = false;
      return;
    }
    for (const pat of ATTACKER_CONTROLLED) {
      if (pat.test(line) && line.includes("${{")) {
        out.push({
          file,
          line: i + 1,
          kind: "interpolated-untrusted",
          detail: `attacker-controlled expression in a run body — bind it to \`env:\` and read the variable`,
        });
        break;
      }
    }
  });
  return out;
}

/** The one group name every `gh-pages`-pushing job must share. */
export const GH_PAGES_GROUP = "gh-pages-push";

/**
 * A job that writes `gh-pages` must be protected against the race — **somehow**.
 *
 * ## The rule is "queue OR retry", and the first version got that wrong
 *
 * This check originally demanded the shared group, full stop. That is too
 * narrow, and #300 shipped a regression because of it: it put
 * `discoverability-docs`' three jobs into the group, and those three run **in
 * parallel with no `needs:`**.
 *
 * GitHub cancels a PENDING job when a newer one queues for the same group. All
 * three enter at once, so one runs, one pends, and the third cancels the
 * pending one — **a lost publish every run**, which is worse than the race it
 * replaces, because a cancelled job reads as intentional while a rejected push
 * is at least red. #300's own commit message stated that cancellation rule
 * about a different case and then did not apply it here; a sibling session
 * raised it on the PR before it landed (bean `pdxk`) and it was merged unseen.
 *
 * So the invariant is protection, not membership:
 *
 * - **queue** — `concurrency.group: gh-pages-push`. Correct when the contending
 *   jobs arrive at different times, which is the cross-workflow case.
 * - **retry** — push with `continue-on-error`, then push again on failure.
 *   Correct when they arrive together, AND only when a re-clone loses nothing:
 *   `discoverability-docs`' three write to different directories under one
 *   root with `keep_files: true`, so whichever loses simply adds its tile
 *   beside the winner's. That is **not** true in general.
 *
 * A job may have both. `feature-staging`'s `stage` does.
 *
 * ## What counts as pushing, and as retrying
 *
 * Pushing: the `peaceiris/actions-gh-pages` action, or a bare
 * `git push … gh-pages` in a `run:` body — every job in `feature-staging`
 * uses the latter and contends for the same ref. That became true of `stage`
 * in PR #552 and this comment still named it as the action example, which is
 * the failure mode of a doc comment about which file does what: nothing reads
 * it, so nothing catches it.
 *
 * Retrying comes in two shapes here, and both are detected STRUCTURALLY
 * rather than by a marker comment, so a retry cannot be claimed without being
 * implemented:
 *
 * - **Two `uses:` push steps plus `continue-on-error: true`** — the action
 *   form, used by `discoverability-docs`. `feature-staging`'s `stage` used it
 *   too until PR #552 (bean `bm6d`, 2026-09-20), when it moved to the loop
 *   form so the preview and its render-log entry could be ONE commit.
 * - **A shell loop around `git push`, with a rebase or re-fetch inside it** —
 *   `feature-staging`'s `cleanup` does three attempts with
 *   `git pull --rebase` between them; `stage` re-fetches `gh-pages` and
 *   rebuilds its commit on every attempt instead (issue #1868: its commit
 *   carries preview-cap removals, and a rebased removal is a stale one).
 *   Missing this shape is not hypothetical:
 *   the first version of this check flagged `cleanup` as unprotected while it
 *   was sitting next to a working retry loop, which is how a correct check
 *   teaches somebody to delete a correct fix.
 */
function ghPagesUngrouped(text: string, file: string): WorkflowFinding[] {
  const lines = text.split("\n");
  type Job = {
    name: string;
    line: number;
    group?: string;
    pushes: number;
    /** `continue-on-error` on a push, so a later step can try again. */
    tolerant: boolean;
    /** A shell retry loop — `for attempt in …`. */
    loops: boolean;
    /** A rebase or fetch, so the retry pushes onto what landed. */
    rebases: boolean;
  };
  const jobs: Job[] = [];
  let cur: Job | undefined;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const job = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(l);
    if (job !== null) {
      cur = { name: job[1], line: i + 1, pushes: 0, tolerant: false, loops: false, rebases: false };
      jobs.push(cur);
      continue;
    }
    if (cur === undefined) continue;
    const g = /^ {6}group:\s*(\S+)/.exec(l);
    if (g !== null && !g[1].startsWith("${{")) cur.group = g[1];
    const bare = l.trimStart().startsWith("#");
    if (bare) continue;
    if (/peaceiris\/actions-gh-pages@/.test(l)) cur.pushes++;
    if (/git push\b[^\n]*\bgh-pages\b/.test(l)) cur.pushes++;
    if (/continue-on-error:\s*true/.test(l)) cur.tolerant = true;
    if (/\b(for|until|while)\b[^\n]*\battempt\b/.test(l)) cur.loops = true;
    // `-C <dir>` allowed: `stage`'s loop re-reads with `git -C pages fetch`.
    if (/git\s+(?:-C\s+\S+\s+)?(pull\s+--rebase|rebase|fetch)\b/.test(l)) cur.rebases = true;
  }

  return jobs
    .filter((j) => {
      if (j.pushes === 0) return false;
      if (j.group === GH_PAGES_GROUP) return false;
      const actionRetry = j.pushes >= 2 && j.tolerant;
      const shellRetry = j.loops && j.rebases;
      return !actionRetry && !shellRetry;
    })
    .map((j) => ({
      file,
      line: j.line,
      kind: "gh-pages-ungrouped" as const,
      detail:
        `job \`${j.name}\` pushes gh-pages with no protection against the race: its concurrency group is ` +
        `${j.group === undefined ? "absent" : `\`${j.group}\``}, not \`${GH_PAGES_GROUP}\`, and it has no retry. ` +
        "Give it the shared group, or a retry (a second push guarded by the first's failure) where the jobs " +
        "contend simultaneously and a re-clone loses nothing.",
    }));
}

/** The directory on the publish branch that holds the per-PR review previews. */
const STAGING_PREFIX = PREVIEW_PREFIX;

/** The script that carries them across a full replace. */
const RESTORE_SCRIPT = "scripts/restore-staging.ts";

/**
 * A full-replace publish that would delete every open PR's review preview.
 *
 * ## The defect — bean `plj1`
 *
 * `peaceiris/actions-gh-pages` with `keep_files` unset and no
 * `destination_dir` clones the publish branch, runs
 * `git rm -r --ignore-unmatch '*'` over ALL of it and copies `publish_dir` in.
 * `docs-site.yml` was the only one of this repository's six `gh-pages`
 * publishers in that shape, and it is the one that fires on every push to
 * `main` — so the most frequently run publisher was the only one that wiped,
 * and what it wiped was `branches/`.
 *
 * Measured on the real branch, 2026-09-19: three `docs(gh-pages)` commits in a
 * 25-minute window, carrying 1, 3 and 1 previews on their respective parents
 * and **zero** after.
 *
 * ## Why this is checked structurally rather than left to a comment
 *
 * Because the failure is invisible to everything else. The staging push
 * succeeds, the bot comments the URL on the PR, the check run is green, and
 * the artefact is removed minutes later by an unrelated merge — so no red run,
 * no annotation and no test would ever have reported it. The same reasoning as
 * the retry detection above: a restore cannot be CLAIMED without being
 * implemented, so what is looked for is the step that does it.
 *
 * ## What is exempt, and why each exemption is safe
 *
 * - **`keep_files: true`** — additive; it removes nothing, so there is nothing
 *   to carry. (It is also why it is not the fix for `docs-site`: it would stop
 *   the main site's own deleted pages from ever disappearing.)
 * - **a non-empty `destination_dir`** — the replace is scoped to a
 *   subdirectory, so the previews beside it are untouched. `feature-staging`
 *   writes `branches/<slug>` this way.
 * - **a publish branch other than the one the previews live on** — a different
 *   branch is a different site.
 */
export function ghPagesWipesStaging(text: string, file: string): WorkflowFinding[] {
  let doc: unknown;
  try {
    doc = parse(text);
  } catch {
    // `unparseable` already reports this; a second finding for one cause is noise.
    return [];
  }
  const jobs = (doc as { jobs?: Record<string, unknown> } | null)?.jobs;
  if (jobs === undefined || jobs === null || typeof jobs !== "object") return [];

  const out: WorkflowFinding[] = [];
  for (const [jobName, rawJob] of Object.entries(jobs)) {
    const steps = (rawJob as { steps?: unknown })?.steps;
    if (!Array.isArray(steps)) continue;

    let restored = false;
    for (const rawStep of steps) {
      const step = rawStep as { uses?: unknown; with?: Record<string, unknown>; run?: unknown };
      if (typeof step.run === "string" && step.run.includes(RESTORE_SCRIPT) && !step.run.includes("--verify")) {
        restored = true;
      }
      if (typeof step.uses !== "string" || !step.uses.startsWith("peaceiris/actions-gh-pages@")) continue;

      const w = step.with ?? {};
      const branch = String(w.publish_branch ?? "gh-pages");
      if (branch !== "gh-pages") continue;
      if (String(w.keep_files ?? "false") === "true") continue;
      if (String(w.destination_dir ?? "").trim() !== "") continue;
      if (restored) continue;

      out.push({
        file,
        line: text.split("\n").findIndex((l) => l.includes("peaceiris/actions-gh-pages@")) + 1,
        kind: "gh-pages-wipes-staging" as const,
        detail:
          `job \`${jobName}\` replaces the whole of \`${branch}\` (no \`keep_files\`, no \`destination_dir\`) ` +
          `without first restoring \`${STAGING_PREFIX}/\`, so every open PR's review preview is deleted by this ` +
          `deploy — silently, because the push succeeds. Run \`${RESTORE_SCRIPT}\` into the publish directory ` +
          "immediately before the push, or scope the replace with `destination_dir`.",
      });
    }
  }
  return out;
}

/** The branch the QA results are published to (owner ruling D1), and its earlier names (beans `32f6`, `tlk2`). */
export const QA_REPORTS_BRANCH = "cat/cat-harness/qa-reports";
export const QA_REPORTS_BRANCH_NAMES: readonly string[] = [QA_REPORTS_BRANCH, "cat-qa-reports", "qa-reports"];

/**
 * Every write to `qa-reports` must go through `qa-store.ts` — bean `16ei`.
 *
 * ## Why the gh-pages rule does not generalise
 *
 * {@link ghPagesUngrouped} accepts a QUEUE or a retry, because a gh-pages
 * writer may replace what it finds. `qa-reports` writers own DISJOINT paths
 * (`main/<sha>/`, `pr/<n>/<sha>/`) and run concurrently by design: one job per
 * push and one per PR, so a shared concurrency group would serialise every
 * run in the repository behind one ref, and GitHub would cancel the pending
 * ones — losing entries, which is #300's failure again. The only protection
 * that keeps a sibling's entry is the one spike `3ds9` measured: fetch the
 * tip, splice, `commit-tree -p tip`, push WITHOUT `-f`, and rebuild on
 * rejection. That loop lives in `qa-store.ts` and nowhere else, so the rule
 * here is narrower than "has a retry": a raw `git push` naming the branch is a
 * finding even inside a loop, because a hand-written loop is a second policy
 * free to forget the splice or to reach for `-f`.
 *
 * Detected per line of a run body, comments skipped: `git push` together with
 * the branch name. `qa:publish` / `qa:prune` / `qa-store.ts` are the
 * sanctioned writers and contain no `git push` in the workflow text.
 */
export function qaReportsUnretried(text: string, file: string): WorkflowFinding[] {
  const out: WorkflowFinding[] = [];
  const lines = text.split("\n");
  const branch = new RegExp(`(^|[\\s:/'"])(${QA_REPORTS_BRANCH_NAMES.join("|")})(?![\\w-])`);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (l.trimStart().startsWith("#")) continue;
    if (!/\bgit\b[^\n]*\bpush\b/.test(l) || !branch.test(l)) continue;
    out.push({
      file,
      line: i + 1,
      kind: "qa-reports-unretried" as const,
      detail:
        `a raw push to \`${QA_REPORTS_BRANCH}\`. Every write to that branch goes through ` +
        "`bun run cat qa:publish` / `qa:prune` (`cat-harness-tools/scripts/qa-store.ts`): fetch the tip, splice, " +
        "`commit-tree -p`, push without `-f`, three attempts with `backoff-sleep.ts`. A hand-rolled push " +
        "loses a concurrent writer's entry or force-pushes over it.",
    });
  }
  return out;
}

/** How a job puts a tip-keyed graph on disk. One command, so one spelling to look for. */
export const STATE_MOUNT = "state:mount";

/**
 * Commands that READ the bean store, declared rather than inferred.
 *
 * A DECLARED list, for `audit:coverage`'s reason: a grep for the store's path
 * fails in both directions — these scripts reach it through
 * `resolveBeanDefs`, which names no path, while a dozen unrelated files
 * mention `beans/` in prose. So the list is stated, and the cost of its being
 * stated is that a new bean gate must be added here too. That is the cheaper
 * failure: a missing entry means this check does not cover a gate, which the
 * gate's own red run still reveals, whereas an inferred list that quietly
 * stopped matching would report every job clean.
 *
 * `kg:audit`, `audit:coverage` and `check:harness-state` are in it because
 * they judge the bean graph among others — `audit:coverage`'s whole subject is
 * whether a kind is audited at all, and it was `bjzs`/`xutg`'s point that a
 * zero there must not read as "clean".
 */
export const BEAN_STORE_READERS: readonly string[] = [
  "check:bean-parents",
  "check:bean-parent-prose",
  "check:bean-blocks",
  "check:bean-archive",
  "check:bean-rollup",
  "check:bean-bodies",
  "check:bean-front-matter",
  "beans:retag:check",
  "check:bean-issue-links",
  "check:bean-restates-skill",
  "beans:notes:check",
  "beans:landed",
  "check:quiet-claim-liveness",
  "check:harness-state",
  "audit:coverage",
  "kg:audit",
];

/**
 * A job that judges the bean store must put it on disk FIRST — bean `9ofm`,
 * arc `fs43` §4's `gates` row.
 *
 * Nine bean gates run in one job here, and `check:harness-state`, `kg:audit`
 * and `audit:coverage` judge that graph among others. Once `beans/` is kept at
 * the tip of its own branch the checkout no longer carries it, and a gate that
 * joined the path would judge an absent directory: `1xhc`, a step that did not
 * fire looking exactly like one that passed, over the store eight of those
 * gates exist to judge. The readers themselves now refuse rather than read
 * empty (`graphReadPath`, row D), so the symptom would be a red run with a
 * remedy — but only for the readers that funnel through it, and only after
 * somebody has spent a CI cycle on it.
 *
 * Per JOB, not per file, and that is the point: `code-quality-gates.yml` has
 * the mount in two jobs and a third job could add a bean gate without one.
 * The mount must also come EARLIER in the job, because a mount after the gate
 * is a gate that ran over nothing.
 *
 * The rule is live while the graph is still on `main` and that is deliberate.
 * `state:mount` reports `not-enabled` and exits 0 until a declaration keeps a
 * graph at a branch tip, so the requirement costs one process per job now and
 * is correct on the day the declaration flips — rather than becoming a rule
 * somebody has to remember to turn on, inside the one commit that is already
 * irreversible.
 */
export function beanGateUnmounted(text: string, file: string): WorkflowFinding[] {
  const lines = text.split("\n");
  type Job = { name: string; mount: number | undefined; readers: Array<{ cmd: string; line: number }> };
  const jobs: Job[] = [];
  let cur: Job | undefined;
  let inJobs = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (/^jobs:\s*$/.test(l)) {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    const job = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(l);
    if (job !== null) {
      cur = { name: job[1]!, mount: undefined, readers: [] };
      jobs.push(cur);
      continue;
    }
    if (cur === undefined || l.trimStart().startsWith("#")) continue;
    if (cur.mount === undefined && l.includes(STATE_MOUNT)) cur.mount = i + 1;
    for (const cmd of BEAN_STORE_READERS) {
      // `bun run <cmd>`, so a comment naming a gate and a `--check` variant of
      // one are not two different rules.
      if (new RegExp(`\\bbun run (?:cat )?${cmd.replace(/[:]/g, "[:]")}(?![\\w-])`).test(l)) cur.readers.push({ cmd, line: i + 1 });
    }
  }
  const out: WorkflowFinding[] = [];
  for (const j of jobs) {
    const late = j.readers.filter((r) => j.mount === undefined || r.line < j.mount);
    if (late.length === 0) continue;
    const first = late[0]!;
    out.push({
      file,
      line: first.line,
      kind: "bean-gate-unmounted" as const,
      detail:
        `job \`${j.name}\` runs \`bun run cat ${first.cmd}\`${late.length > 1 ? ` (and ${late.length - 1} more)` : ""} ` +
        (j.mount === undefined
          ? `with no \`bun run cat ${STATE_MOUNT}\` step`
          : `BEFORE its \`${STATE_MOUNT}\` step on line ${j.mount}`) +
        `. The bean store is declared tip-keyed (arc \`fs43\`), so after the cutover the checkout does not ` +
        `carry \`beans/\` and this gate would judge an absent directory — a step that did not fire, reported ` +
        `as one that passed. Add \`- run: bun run cat ${STATE_MOUNT}\` earlier in the job; it exits 0 and mounts ` +
        `nothing while \`main\` is still authoritative.`,
    });
  }
  return out;
}

/**
 * A run body that reads `$?` on its own line, under Actions' `bash -e`.
 *
 * GitHub runs a `run:` step as `bash -e` (`bash -eo pipefail` when the step
 * names `shell: bash`), so a failing command ends the step at once. A body
 * written as a bare call, then `code=$?` on the next line, never reaches that
 * line on the very exit codes it was written to handle: the report it meant to
 * print, the summary, the output and the softened exit are all skipped. The
 * step goes red with nothing said. Measured in the index on 2026-10-22: every
 * `post-merge-regen.yml` run on `main` failed with only "exited with code 1"
 * for that reason, and a QA step that was meant to be a warning went red with
 * no output.
 *
 * The sanctioned forms are `code=0; cmd || code=$?` (as `post-merge-regen.yml`
 * does) or a `set +e` earlier in the same body. Detected per `run: |` block:
 * a line that is only `<name>=$?`, with no `set +e` before it in that block.
 *
 * Also sanctioned: the read as the FIRST command of an `else` branch. `bash
 * -e` never stops on a failing `if` condition, and `$?` there is that
 * condition's status. `if X=$(cmd); then …; else rc=$?; …; fi` is the
 * index's own `feature-staging.yml` / `docs-site.yml` form (exit 3 means
 * "declared, not published"), and flagging it held folio-assistant#2628 red
 * on correct code.
 */
export function exitStatusSwallowed(text: string, file: string): WorkflowFinding[] {
  const out: WorkflowFinding[] = [];
  const lines = text.split("\n");
  let block: { indent: number; plusE: boolean; prev: string } | undefined;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    const start = /^(\s*)(?:- )?run:\s*[|>][-+]?\s*$/.exec(l);
    if (start !== null) {
      block = { indent: start[1]!.length, plusE: false, prev: "" };
      continue;
    }
    if (block === undefined) continue;
    if (l.trim() === "") continue;
    if (l.length - l.trimStart().length <= block.indent) {
      block = undefined;
      continue;
    }
    const body = l.trim();
    if (body.startsWith("#")) continue;
    if (/^set\b.*(?:\s\+[a-zA-Z]*e|\+o\s+errexit)/.test(body)) block.plusE = true;
    const read = /^([A-Za-z_][A-Za-z0-9_]*)=\$\?\s*(?:#.*)?$/.exec(body);
    const afterElse = /^else\s*(?:#.*)?$/.test(block.prev);
    block.prev = body;
    if (read === null || block.plusE || afterElse) continue;
    out.push({
      file,
      line: i + 1,
      kind: "exit-status-swallowed" as const,
      detail:
        `\`${read[1]}=$?\` on its own line. Actions runs this body as \`bash -e\`, so the command before it ` +
        `ends the step on a non-zero exit and this line is never reached. Write \`${read[1]}=0\` before the ` +
        `command and \`|| ${read[1]}=$?\` after it (as \`post-merge-regen.yml\` does), or \`set +e\` earlier in the body.`,
    });
  }
  return out;
}

export function checkWorkflows(): WorkflowFinding[] {
  const out: WorkflowFinding[] = [];
  for (const f of readdirSync(DIR)) {
    if (!f.endsWith(".yml") && !f.endsWith(".yaml")) continue;
    const text = readFileSync(join(DIR, f), "utf-8");
    out.push(
      ...duplicateKeys(text, f),
      ...unparseable(text, f),
      ...interpolatedUntrusted(text, f),
      ...ghPagesUngrouped(text, f),
      ...ghPagesWipesStaging(text, f),
      ...qaReportsUnretried(text, f),
      ...beanGateUnmounted(text, f),
      ...exitStatusSwallowed(text, f),
    );
  }
  return out;
}

if (import.meta.main) {
  const findings = checkWorkflows();
  const files = readdirSync(DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
  console.log(`Workflows: ${files.length}\n`);
  if (findings.length === 0) {
    console.log(
      "✓ all parse; no duplicate keys; no attacker-controlled expression in a run body; " +
        `every gh-pages push is protected by the \`${GH_PAGES_GROUP}\` queue or a retry; ` +
        `no full-replace publish drops the open PRs' \`${STAGING_PREFIX}/\` previews; ` +
        `every write to \`${QA_REPORTS_BRANCH}\` goes through qa-store; ` +
        `every job that judges the bean store mounts it first; ` +
        "no run body reads `$?` on a line `bash -e` never reaches",
    );
  } else {
    for (const f of findings) console.error(`  ✗ ${f.file}:${f.line}  [${f.kind}] ${f.detail}`);
    process.exit(1);
  }
}

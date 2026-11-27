#!/usr/bin/env bun
/**
 * Shared workflows and actions are called at the commit this repository's
 * `index.lock.json` pins, never at a branch.
 *
 * @module scripts/workflow-pins
 * @covers cat-harness — the instance axis: every `uses: <owner>/<layer>/…` line in .github is pinned to the commit index.lock.json mounts for that layer, under the owner the lock names
 *
 * A `uses: litlfred/cat-harness-tools/.github/workflows/x.yml@main` line runs
 * whatever that branch holds when the run starts, so one bad push to a lower
 * layer's main would run in every repository that calls it, with that
 * repository's tokens. The lock already names the commit of each layer this
 * repository has accepted; the call follows it:
 *
 * | the line names | wanted |
 * |---|---|
 * | a layer the lock mounts | `@<that mount's ref> # index.lock.json` |
 * | this repository's own workflow, as a job | `./.github/workflows/<file>` (same commit) |
 * | this repository's own action, as a step | `@<a commit whose copy of the action is main's or this tree's>` |
 * | anything else | a 40-hex commit, kept as it is; a branch or tag is an error |
 *
 * The owner is not fixed. A line is first-party when its owner is this
 * repository's owner or the owner of any layer in the lock (layers can live
 * under different owners, e.g. content layers under one org and the harness under
 * litlfred). A first-party call to a layer the lock mounts is rewritten to the
 * lock's `repository`, so moving a layer to a new owner is a re-pin away.
 * Calls under any other owner (actions/checkout, …) are left alone.
 *
 * A job that calls `layer-pr-checks.yml` must not pass `tools-ref: <branch>`:
 * the judging scripts follow the lock too (`tools-ref: lock`, the default).
 *
 * A workflow that calls `layer-pr-checks.yml` on `pull_request` must list
 * `labeled` in its types, key its concurrency group so a no-op label never
 * cancels the real run, cancel in progress only on an event that moves the
 * head or starts a tier ({@link HEAD_EVENT}: a `ready_for_review` cancelled
 * the `release` label's full tier on downstream PRs, 2026-11-18), and skip its
 * calling job on any label but `release` or `preview` (the caller snippet in
 * layer-pr-checks.yml's header). Without
 * `labeled`, adding `release` starts nothing and every run reads the labels
 * the PR had when it was opened or pushed: the dth-* callers ran the fast tier
 * (`full=false`) on every PR, so no gate ever ran on them (2026-11-16).
 * `--write` adds all four to the usual caller shape; any other shape is
 * reported for a hand fix.
 *
 * A caller of `layer-merge-guard.yml` runs only from the default branch: no
 * `pull_request_target` trigger (owner, 2026-11-17: GitHub is changing that
 * trigger's default, and its 2026-11-16 brownout failed the guard). The
 * pull-request events reach it through `.github/workflows/merge-guard-trigger.yml`,
 * a permissionless `pull_request` signal ({@link MERGE_GUARD_TRIGGER_TEXT})
 * whose completion the caller hears on `workflow_run`. `--write` drops the
 * `pull_request_target` block, adds {@link MERGE_GUARD_TRIGGER_NAME} to the
 * caller's `workflow_run.workflows`, and writes the signal file. These are
 * trailing findings: they warn and pass until an agent session writes them.
 *
 * `mount:remote` runs `--write` after it writes the lock, so a re-pin moves
 * the calls with the mounts. In CI (`CI=true`) it does not: the re-pin train's
 * App has no `workflows` permission, so a train cannot push workflow-file
 * edits. A call pinned to an OLDER commit than the lock therefore only trails
 * it: the check warns and passes, and the next agent-session run of
 * `workflow-pins` catches it up. A branch or tag still fails.
 * `WORKFLOW_PINS_STRICT=1` makes a trailing pin fail too.
 *
 *   bun run cat workflow-pins          # check (the gate is check:workflow-pins)
 *   bun run cat workflow-pins --write  # rewrite the lines
 *
 * Exit codes: 0 current · 1 a line is unpinned or drifted · 2 unreadable lock.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";
import { checkoutOwner, HARNESS_OWNER, isSameOwnerName, resolveLockRepositories } from "../schemas/kg/repo-owner.ts";

/** The owner assumed when nothing else names one (no CI env, no origin). */
export const DEFAULT_OWNER = HARNESS_OWNER;
const SHA = /^[0-9a-f]{40}$/;
/** `  - uses: <owner>/<repo>/<path>@<ref>  # comment` — groups: lead, step dash, owner, repo, path, ref. */
const USES = /^(\s*(-\s+)?uses:\s*)([A-Za-z0-9_-][A-Za-z0-9_.-]*)\/([A-Za-z0-9_.-]+)\/(\S+?)@(\S+)(\s+#.*)?$/;
const TOOLS_REF = /^(\s*)tools-ref:\s*["']?([^"'\s#]+)["']?/;

export interface Finding {
  file: string;
  line: number;
  have: string;
  want: string | null;
  why: string;
  /** A commit pin that only trails the lock: a warning, not a failure (see the header). */
  trailing?: boolean;
}

type LockMount = { harness?: string; repository?: string; ref?: string };

function lockMounts(root: string): LockMount[] {
  const f = join(root, "index.lock.json");
  if (!existsSync(f)) return [];
  const lock = JSON.parse(readFileSync(f, "utf8")) as { mounts?: LockMount[] };
  // A same-owner mount (bare repository name) is called under this
  // checkout's owner (cat-harness-tools#2337): `uses:` cannot be relative.
  if (!(lock.mounts ?? []).some((m) => typeof m.repository === "string" && isSameOwnerName(m.repository))) return lock.mounts ?? [];
  return resolveLockRepositories(lock, checkoutOwner(root) ?? DEFAULT_OWNER).mounts ?? [];
}

/** The repository name of a lock mount: the name part of `repository`, else the harness name. */
function mountRepoName(m: LockMount): string | undefined {
  return m.repository?.split("/")[1] ?? m.harness;
}

/**
 * The mounts of index.lock.json, repository name → commit (also keyed by the
 * harness name when it differs); empty
 * when there is no lock.
 */
export function lockedRefs(root: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of lockMounts(root)) {
    if (!m.ref || !SHA.test(m.ref)) continue;
    const name = mountRepoName(m);
    if (name) out.set(name, m.ref);
    if (m.harness) out.set(m.harness, m.ref);
  }
  return out;
}

/** The mounts of index.lock.json, repository name → `owner/repo` as the lock names it. */
export function lockedRepos(root: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of lockMounts(root)) {
    const name = mountRepoName(m);
    if (name && m.repository?.includes("/")) out.set(name, m.repository);
  }
  return out;
}

/** This repository's name on GitHub: GITHUB_REPOSITORY, else origin's URL, else the directory. */
export function ownName(root: string): string {
  return ownSlug(root).repo;
}

/**
 * This repository's owner and name on GitHub: GITHUB_REPOSITORY, else
 * origin's URL, else {@link DEFAULT_OWNER} and the directory.
 */
export function ownSlug(root: string): { owner: string; repo: string } {
  // input-site: env GITHUB_REPOSITORY #bd3896fa — this repository's name, when CI says it
  const env = process.env.GITHUB_REPOSITORY;
  const e = env?.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (e) return { owner: e[1], repo: e[2] };
  return { owner: originOwner(root) ?? DEFAULT_OWNER, repo: checkoutName(root) };
}

/** The owner in origin's URL (`github.com/<owner>/<repo>` or `github.com:<owner>/<repo>`), else null. */
function originOwner(root: string): string | null {
  const url = git(root, ["remote", "get-url", "origin"]);
  return url?.match(/[/:]([^/:]+)\/[^/]+?(\.git)?$/)?.[1] ?? null;
}

/**
 * The repository a CHECKOUT is, from the checkout alone: its origin's name,
 * else its directory's. Unlike {@link ownName} it never reads
 * `GITHUB_REPOSITORY`, which names the repository whose CI is running, not
 * the root being judged: a layer's CI judges the folio-assistant index it is
 * mounted in, and a baseline recorded there must still apply (cat-harness-tools#1537).
 */
export function checkoutName(root: string): string {
  try {
    // input-site: traced #06a06e7d — origin's URL, from this clone's git config: no fingerprint names it, so a run that reaches it records no hash
    inputSiteReached("workflow-pins: origin's URL");
    const url = execFileSync("git", ["-C", root, "remote", "get-url", "origin"], { encoding: "utf8" }).trim();
    const m = url.match(/[/:]([^/]+?)(\.git)?$/);
    if (m) return m[1];
  } catch {
    /* no origin: fall through */
  }
  return basename(root);
}

function git(root: string, args: string[]): string | null {
  try {
    // input-site: traced #d3ed1c22 — a pinned commit's tree, fetched from origin when the clone lacks it: a run that reaches it records no hash
    inputSiteReached("workflow-pins: git");
    return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

/** The tree id of `dir` at `rev`, fetching `rev` once when a shallow clone lacks it. */
function treeAt(root: string, rev: string, dir: string): string | null {
  const ask = () => git(root, ["rev-parse", `${rev}:${dir}`]);
  let t = ask();
  if (t === null && SHA.test(rev)) {
    git(root, ["fetch", "-q", "--depth", "1", "origin", rev]);
    t = ask();
  }
  return t;
}

/** The newest commit of origin/main (else HEAD) that touched `dir`; null when history is too shallow to say. */
function lastTouch(root: string, dir: string): string | null {
  for (const base of ["origin/main", "HEAD"]) {
    const c = git(root, ["log", "-1", "--format=%H", base, "--", dir]);
    if (c && SHA.test(c)) return c;
  }
  return null;
}

/** The workflow and action files under .github. */
export function workflowFiles(root: string): string[] {
  const out: string[] = [];
  const wf = join(root, ".github", "workflows");
  if (existsSync(wf)) for (const f of readdirSync(wf)) if (/\.ya?ml$/.test(f)) out.push(join(wf, f));
  const act = join(root, ".github", "actions");
  if (existsSync(act))
    for (const d of readdirSync(act, { withFileTypes: true }))
      if (d.isDirectory()) for (const f of ["action.yml", "action.yaml"]) if (existsSync(join(act, d.name, f))) out.push(join(act, d.name, f));
  return out.sort();
}

/**
 * Judge (and with `write`, fix) one file's lines. Pure but for the git calls
 * a self-pinned action needs.
 */
export function judgeFile(
  root: string,
  file: string,
  text: string,
  own: string,
  refs: Map<string, string>,
  repos: Map<string, string> = new Map(),
  ownOwner: string = DEFAULT_OWNER,
): { findings: Finding[]; text: string } {
  const lines = text.split("\n");
  /** Owners whose calls this check judges: this repository's and every locked layer's. */
  const firstParty = new Set([ownOwner, ...[...repos.values()].map((r) => r.split("/")[0])]);
  const findings: Finding[] = [];
  const rel = relative(root, file);
  let callsChecks = false;
  let callIndent = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*#/.test(l)) continue;
    const indent = l.length - l.trimStart().length;
    if (callIndent >= 0 && l.trim() !== "" && indent < callIndent) callsChecks = false;
    const m = l.match(USES);
    if (m) {
      const [, lead, dash, owner, repo, path, ref] = m;
      if (!firstParty.has(owner)) continue;
      callsChecks = path.endsWith("layer-pr-checks.yml");
      callIndent = indent;
      let want: string | null = null;
      let why = "";
      if (repo === own && owner === ownOwner && !dash && path.startsWith(".github/workflows/")) {
        want = `${lead}./${path}`;
        why = "this repository's own workflow: call it at the same commit";
      } else if (repo === own && owner === ownOwner) {
        const dir = path.replace(/\/action\.ya?ml$/, "");
        const head = treeAt(root, "HEAD", dir);
        const pinned = SHA.test(ref) ? treeAt(root, ref, dir) : null;
        const main = treeAt(root, "origin/main", dir);
        if (pinned !== null && (pinned === head || pinned === main)) continue;
        const c = lastTouch(root, dir);
        want = c ? `${lead}${owner}/${repo}/${path}@${c} # last change to ${dir}` : null;
        why = c ? "this repository's own action: pin the commit that last changed it" : "this repository's own action: history too shallow to find the commit that last changed it; fetch more and re-run";
      } else if (refs.has(repo)) {
        const sha = refs.get(repo)!;
        const slug = repos.get(repo) ?? `${owner}/${repo}`;
        const moved = slug !== `${owner}/${repo}`;
        if (ref === sha && !moved) continue;
        want = `${lead}${slug}/${path}@${sha} # index.lock.json`;
        why = moved ? `index.lock.json mounts ${repo} from ${slug} at ${sha.slice(0, 8)}, not ${owner}/${repo}` : `index.lock.json mounts ${repo} at ${sha.slice(0, 8)}`;
        if (SHA.test(ref) && !moved) {
          findings.push({ file: rel, line: i + 1, have: l.trim(), want: want.trim(), why: `${why}; this pin trails it until an agent session runs workflow-pins`, trailing: true });
          lines[i] = want;
          continue;
        }
      } else if (SHA.test(ref)) {
        continue;
      } else {
        why = `${repo} is not in index.lock.json: mount it, or pin a 40-hex commit by hand`;
      }
      const cur = l.trimEnd();
      if (want !== null && cur === want) continue;
      findings.push({ file: rel, line: i + 1, have: l.trim(), want: want?.trim() ?? null, why });
      if (want !== null) lines[i] = want;
      continue;
    }
    const t = l.match(TOOLS_REF);
    if (t && callsChecks && t[2] !== "lock" && !SHA.test(t[2])) {
      findings.push({ file: rel, line: i + 1, have: l.trim(), want: null, why: "tools-ref names a branch: drop it, so the judging scripts follow index.lock.json (tools-ref: lock)" });
      lines[i] = "\u0000drop";
    }
  }
  findings.push(...labeledTrigger(lines, rel));
  findings.push(...mergeGuardCaller(lines, rel));
  return { findings, text: lines.filter((x) => x !== "\u0000drop").join("\n") };
}

/** The labels that start a layer-pr-checks run; any other label is a no-op there. */
const NOOP_LABEL = "(github.event.action == 'labeled' && github.event.label.name != 'release' && github.event.label.name != 'preview')";
const JOB_IF = "github.event.action != 'labeled' || github.event.label.name == 'release' || github.event.label.name == 'preview'";
/**
 * The pull-request events that may cancel a run in flight: those that move the
 * head, start a tier (`labeled`: a no-op label has its own group) or close the
 * PR. `ready_for_review`, `unlabeled`, `edited` and `converted_to_draft` leave
 * the head where it is, so they wait behind the running run instead of
 * cancelling the full tier the `release` label started on it (the
 * `ready_for_review` on two downstream layers' PRs, 2026-11-18).
 */
export const HEAD_EVENT = "(github.event.action == 'opened' || github.event.action == 'synchronize' || github.event.action == 'reopened' || github.event.action == 'labeled' || github.event.action == 'closed')";
const CALLS_CHECKS = /^\s*(-\s+)?uses:\s*\S*\/layer-pr-checks\.yml(@|\s|$)/;
const indentOf = (l: string) => l.length - l.trimStart().length;

/**
 * A caller of `layer-pr-checks.yml` that runs on `pull_request` must start on
 * `labeled` (see the header). Judges `lines` in place, fixing what it can;
 * insertions come last and bottom-up, so earlier findings' line numbers hold.
 */
export function labeledTrigger(lines: string[], rel: string): Finding[] {
  const live = (i: number) => lines[i] !== "\u0000drop" && !/^\s*#/.test(lines[i]);
  const call = lines.findIndex((l, i) => live(i) && CALLS_CHECKS.test(l));
  if (call < 0) return [];
  const pr = lines.findIndex((l, i) => live(i) && /^\s+pull_request:\s*(\{\s*\}|null|~)?\s*(#.*)?$/.test(l));
  const prInline = lines.some((l, i) => live(i) && /^on:\s*(\[[^\]]*\bpull_request\b[^\]]*\]|pull_request)\s*(#.*)?$/.test(l));
  if (pr < 0 && !prInline) return [];
  const findings: Finding[] = [];
  const inserts: { at: number; line: string }[] = [];
  const why = "a layer-pr-checks caller must start on `labeled`, or adding `release` runs nothing and every PR runs the fast tier only (full=false)";
  if (pr < 0) {
    findings.push({ file: rel, line: lines.findIndex((l) => /^on:/.test(l)) + 1, have: "on: pull_request", want: null, why: `${why}: write \`pull_request: { types: [opened, synchronize, reopened, ready_for_review, labeled] }\`` });
  } else {
    const ind = indentOf(lines[pr]);
    let types = -1;
    for (let i = pr + 1; i < lines.length && (lines[i].trim() === "" || indentOf(lines[i]) > ind); i++)
      if (live(i) && /^\s*types:/.test(lines[i])) types = i;
    if (types < 0) {
      const want = `${" ".repeat(ind + 2)}types: [opened, synchronize, reopened, ready_for_review, labeled]`;
      findings.push({ file: rel, line: pr + 1, have: lines[pr].trim(), want: want.trim(), why });
      lines[pr] = lines[pr].replace(/:\s*(\{\s*\}|null|~)?\s*(#.*)?$/, ":");
      inserts.push({ at: pr + 1, line: want });
    } else {
      const m = lines[types].match(/^(\s*types:\s*\[)([^\]]*)\](.*)$/);
      const names = m ? m[2].split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")) : [];
      if (!m) {
        // A block list: `types:` with `- opened` lines under it.
        let has = false;
        let last = types;
        for (let i = types + 1; i < lines.length && /^\s*-\s/.test(lines[i]); i++) {
          last = i;
          if (/^\s*-\s*["']?labeled["']?\s*(#.*)?$/.test(lines[i])) has = true;
        }
        if (!has) {
          const want = lines[last].replace(/-\s*.*$/, "- labeled");
          findings.push({ file: rel, line: types + 1, have: lines[types].trim(), want: want.trim(), why });
          inserts.push({ at: last + 1, line: want });
        }
      } else if (!names.includes("labeled")) {
        const want = `${m[1]}${[...names.filter(Boolean), "labeled"].join(", ")}]${m[3]}`;
        findings.push({ file: rel, line: types + 1, have: lines[types].trim(), want: want.trim(), why });
        lines[types] = want;
      }
    }
  }
  // The workflow's own concurrency group: keyed by the ref alone, a no-op label
  // (`ready-to-merge`) cancels the PR's real run.
  const conc = lines.findIndex((l, i) => live(i) && /^concurrency:\s*$/.test(l));
  if (conc >= 0) {
    for (let i = conc + 1; i < lines.length && (lines[i].trim() === "" || indentOf(lines[i]) > 0); i++) {
      if (!live(i) || !/^\s*group:/.test(lines[i]) || lines[i].includes("noop-label")) continue;
      const g = lines[i].match(/^(\s*group:\s*)(["']?)(.*)\$\{\{\s*github\.ref\s*\}\}(.*)$/);
      const cancels = lines.slice(conc + 1, i + 4).some((l) => /^\s*cancel-in-progress:\s*(?!false\b)\S/.test(l));
      if (!cancels) break;
      const want = g ? `${g[1]}${g[2]}${g[3]}\${{ ${NOOP_LABEL} && format('noop-label-{0}', github.run_id) || github.ref }}${g[4]}` : null;
      findings.push({ file: rel, line: i + 1, have: lines[i].trim(), want: want?.trim() ?? null, why: "a `labeled` run for any label but `release` or `preview` must get its own concurrency group, or it cancels the PR's real run" });
      if (want) lines[i] = want;
      break;
    }
    // Its cancel-in-progress: cancelling on every pull_request event lets a
    // `ready_for_review` cancel the full tier the `release` label started.
    for (let i = conc + 1; i < lines.length && (lines[i].trim() === "" || indentOf(lines[i]) > 0); i++) {
      const c = live(i) ? lines[i].match(/^(\s*cancel-in-progress:\s*)(.*?)\s*(#.*)?$/) : null;
      if (!c || c[2] === "false" || c[2].includes("github.event.action == 'synchronize'")) continue;
      const v = c[2].replace(/^["']|["']$/g, "");
      const expr =
        v === "true" ? `github.event_name != 'pull_request' || ${HEAD_EVENT}`
        : /^\$\{\{\s*github\.event_name\s*==\s*'pull_request'\s*\}\}$/.test(v) ? `github.event_name == 'pull_request' && ${HEAD_EVENT}`
        : null;
      const want = expr ? `${c[1]}\${{ ${expr} }}${c[3] ? ` ${c[3]}` : ""}` : null;
      findings.push({ file: rel, line: i + 1, have: lines[i].trim(), want: want?.trim() ?? null, why: `only an event that moves the head or starts a tier may cancel the run in flight, or a \`ready_for_review\` cancels the full tier the \`release\` label started: cancel on \`${HEAD_EVENT}\` only` });
      if (want) lines[i] = want;
      break;
    }
  }
  // The calling job skips a no-op label.
  const callInd = indentOf(lines[call]);
  let job = call - 1;
  while (job >= 0 && (lines[job].trim() === "" || /^\s*#/.test(lines[job]) || indentOf(lines[job]) >= callInd)) job--;
  if (job >= 0 && /^\s*[A-Za-z0-9_-]+:\s*$/.test(lines[job])) {
    let jobIf = -1;
    for (let i = job + 1; i < lines.length && (lines[i].trim() === "" || indentOf(lines[i]) >= callInd); i++)
      if (live(i) && indentOf(lines[i]) === callInd && /^\s*if:/.test(lines[i])) jobIf = i;
    if (jobIf < 0) {
      const want = `${" ".repeat(callInd)}if: ${JOB_IF}`;
      findings.push({ file: rel, line: job + 1, have: lines[job].trim(), want: want.trim(), why: "the job calling layer-pr-checks skips a `labeled` run for any label but `release` or `preview`" });
      inserts.push({ at: job + 1, line: want });
    } else if (!lines[jobIf].includes("labeled")) {
      findings.push({ file: rel, line: jobIf + 1, have: lines[jobIf].trim(), want: null, why: `the job calling layer-pr-checks skips a \`labeled\` run for any label but \`release\` or \`preview\`: add \`${JOB_IF}\` to its if` });
    }
  }
  for (const { at, line } of inserts.sort((a, b) => b.at - a.at)) lines.splice(at, 0, line);
  return findings;
}

/** The `name:` of the merge guard's pull-request signal; a caller lists it under `workflow_run.workflows`. */
export const MERGE_GUARD_TRIGGER_NAME = "Merge guard trigger";
/** Where a layer keeps the merge guard's pull-request signal. */
export const MERGE_GUARD_TRIGGER_FILE = ".github/workflows/merge-guard-trigger.yml";
/** The pull-request types the guard re-judges on (those the `pull_request_target` caller listed). */
export const MERGE_GUARD_PR_TYPES = ["opened", "synchronize", "reopened", "ready_for_review", "converted_to_draft", "labeled", "unlabeled", "edited"] as const;
/**
 * The merge guard's pull-request signal, as every layer holds it. It has no
 * token and decides nothing: a PR may edit it in its own head, and the worst
 * that does is that no signal comes, which leaves the status unposted.
 * It names no layer, since the layers below this one hold it too
 * (\`check:reference-direction\`).
 */
export const MERGE_GUARD_TRIGGER_TEXT = `# Written by \`bun run cat workflow-pins --write\`: do not edit.
#
# The merge guard's pull-request signal. It holds no token, checks nothing out
# and decides nothing: it only finishes, and \`.github/workflows/merge-guard.yml\`,
# which runs on \`workflow_run\` from the default branch, then judges the PR and
# posts the \`merge-guard\` status. A PR may edit this file in its own head; the
# worst that does is that no signal comes, and the status stays unposted.
# Why not \`pull_request_target\`: the header of the shared
# \`layer-merge-guard.yml\` that \`merge-guard.yml\` calls.
#
# TRIGGERS, ACTUAL: \`pull_request\` only, by the owner's decision of 2026-11-17
# (no \`pull_request_target\`). The \`workflow_run\` named above is the
# caller's trigger, not this file's.

name: ${MERGE_GUARD_TRIGGER_NAME}
run-name: "${MERGE_GUARD_TRIGGER_NAME} #\${{ github.event.pull_request.number }}"

on:
  pull_request:
    types: [${MERGE_GUARD_PR_TYPES.join(", ")}]

permissions: {}

jobs:
  signal:
    name: Ask the merge guard to judge this PR
    runs-on: ubuntu-24.04
    timeout-minutes: 2
    permissions: {}
    steps:
      - name: Signal
        run: echo "the merge guard judges this PR when this run completes (workflow_run, from the default branch)"
`;

const CALLS_GUARD = /^\s*(-\s+)?uses:\s*\S*\/layer-merge-guard\.yml(@|\s|$)/;

/**
 * A caller of `layer-merge-guard.yml` must not run on `pull_request_target`,
 * and must hear {@link MERGE_GUARD_TRIGGER_NAME} on `workflow_run` (see the
 * header). Judges `lines` in place, fixing the usual caller shape; every
 * finding is trailing, since the re-pin train cannot push workflow files.
 */
export function mergeGuardCaller(lines: string[], rel: string): Finding[] {
  const live = (i: number) => lines[i] !== "\u0000drop" && !/^\s*#/.test(lines[i]);
  if (!lines.some((l, i) => live(i) && CALLS_GUARD.test(l))) return [];
  const on = lines.findIndex((l, i) => live(i) && /^on:\s*(#.*)?$/.test(l));
  if (on < 0) {
    return [{ file: rel, line: 1, have: "on: …", want: null, why: "a merge-guard caller needs a block `on:` with `workflow_run` for the merge guard trigger: fix it by hand", trailing: true }];
  }
  /** [start, end) of each event under `on:`. */
  const events = new Map<string, [number, number]>();
  let end = on + 1;
  for (let i = on + 1; i < lines.length; i++) {
    if (lines[i].trim() === "" || /^\s*#/.test(lines[i])) continue;
    if (indentOf(lines[i]) === 0) break;
    end = i + 1;
    const k = lines[i].match(/^  ([A-Za-z_]+):/);
    if (k) events.set(k[1], [i, i + 1]);
    else {
      const last = [...events.values()].at(-1);
      if (last) last[1] = i + 1;
    }
  }
  const findings: Finding[] = [];
  const prt = events.get("pull_request_target");
  if (prt) {
    findings.push({ file: rel, line: prt[0] + 1, have: lines[prt[0]].trim(), want: "(removed)", why: `the merge guard no longer runs on \`pull_request_target\`: pull-request events reach it through ${MERGE_GUARD_TRIGGER_FILE} on \`workflow_run\``, trailing: true });
    for (let i = prt[0]; i < prt[1]; i++) lines[i] = "\u0000drop";
  }
  const why = `a merge-guard caller hears \`${MERGE_GUARD_TRIGGER_NAME}\` on \`workflow_run\`, or no label, push or edit of a PR re-judges it`;
  const wr = events.get("workflow_run");
  if (!wr) {
    const add = [`  workflow_run:`, `    workflows: ["${MERGE_GUARD_TRIGGER_NAME}"]`, `    types: [completed]`];
    findings.push({ file: rel, line: on + 1, have: "on:", want: add.map((x) => x.trim()).join(" "), why, trailing: true });
    lines.splice(end, 0, ...add);
    return findings;
  }
  let wfs = -1;
  // A flow mapping on the key's own line (`workflow_run: { workflows: [...], types: [completed] }`),
  // the shape every layer's caller was written in; else a `workflows:` line under the key.
  if (/^\s*workflow_run:\s*\{.*\bworkflows:\s*\[/.test(lines[wr[0]])) wfs = wr[0];
  else for (let i = wr[0] + 1; i < wr[1]; i++) if (live(i) && /^\s*workflows:/.test(lines[i])) wfs = i;
  if (wfs < 0) {
    findings.push({ file: rel, line: wr[0] + 1, have: lines[wr[0]].trim(), want: null, why: `${why}: add a \`workflows:\` list by hand`, trailing: true });
    return findings;
  }
  const inline = lines[wfs].match(/^(\s*(?:workflow_run:\s*\{.*?\b)?workflows:\s*\[)([^\]]*)\](.*)$/);
  if (inline) {
    const names = inline[2].split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    if (names.includes(MERGE_GUARD_TRIGGER_NAME)) return findings;
    const want = `${inline[1]}${[...inline[2].split(",").map((x) => x.trim()).filter(Boolean), `"${MERGE_GUARD_TRIGGER_NAME}"`].join(", ")}]${inline[3]}`;
    findings.push({ file: rel, line: wfs + 1, have: lines[wfs].trim(), want: want.trim(), why, trailing: true });
    lines[wfs] = want;
    return findings;
  }
  let last = wfs;
  let has = false;
  for (let i = wfs + 1; i < lines.length && /^\s*-\s/.test(lines[i]); i++) {
    last = i;
    if (lines[i].replace(/^\s*-\s*/, "").replace(/\s*#.*$/, "").replace(/^["']|["']$/g, "") === MERGE_GUARD_TRIGGER_NAME) has = true;
  }
  if (has) return findings;
  if (last === wfs) {
    findings.push({ file: rel, line: wfs + 1, have: lines[wfs].trim(), want: null, why: `${why}: list it under \`workflows:\` by hand`, trailing: true });
    return findings;
  }
  const want = lines[last].replace(/-\s*.*$/, `- "${MERGE_GUARD_TRIGGER_NAME}"`);
  findings.push({ file: rel, line: wfs + 1, have: lines[wfs].trim(), want: want.trim(), why, trailing: true });
  lines.splice(last + 1, 0, want);
  return findings;
}

/**
 * The signal file a repository with a merge-guard caller must hold: a
 * trailing finding (with `write`, the file is written) when it is missing or
 * is not {@link MERGE_GUARD_TRIGGER_TEXT}.
 */
export function mergeGuardTrigger(root: string, callsGuard: boolean, write: boolean): Finding[] {
  if (!callsGuard) return [];
  const f = join(root, MERGE_GUARD_TRIGGER_FILE);
  const have = existsSync(f) ? readFileSync(f, "utf8") : null;
  if (have === MERGE_GUARD_TRIGGER_TEXT) return [];
  if (write) writeFileSync(f, MERGE_GUARD_TRIGGER_TEXT);
  return [{
    file: MERGE_GUARD_TRIGGER_FILE,
    line: 1,
    have: have === null ? "(missing)" : "(differs from the canonical signal)",
    want: "(the canonical merge guard trigger)",
    why: "the merge guard hears pull-request events through this permissionless `pull_request` signal",
    trailing: true,
  }];
}

export function run(root: string, write: boolean): { findings: Finding[]; fixed: number } {
  const refs = lockedRefs(root);
  const repos = lockedRepos(root);
  const { owner: ownOwner, repo: own } = ownSlug(root);
  const all: Finding[] = [];
  let fixed = 0;
  let callsGuard = false;
  for (const f of workflowFiles(root)) {
    const before = readFileSync(f, "utf8");
    if (before.split("\n").some((l) => !/^\s*#/.test(l) && CALLS_GUARD.test(l))) callsGuard = true;
    const { findings, text } = judgeFile(root, f, before, own, refs, repos, ownOwner);
    all.push(...findings);
    if (write && text !== before) {
      writeFileSync(f, text);
      fixed += findings.filter((x) => x.want !== null || x.why.startsWith("tools-ref")).length;
    }
  }
  const trigger = mergeGuardTrigger(root, callsGuard, write);
  all.push(...trigger);
  if (write) fixed += trigger.length;
  return { findings: all, fixed };
}

if (import.meta.main) {
  const write = process.argv.includes("--write");
  const rootArg = process.argv.find((a, i) => i > 1 && !a.startsWith("--"));
  // The repository being judged is the one the command runs in (a layer's
  // tools are mounted inside it), so no schema import: this runs on a bare clone.
  const root = resolve(rootArg ?? git(process.cwd(), ["rev-parse", "--show-toplevel"]) ?? process.cwd());
  let result;
  try {
    result = run(root, write);
  } catch (e) {
    console.log(`  ✗ index.lock.json is unreadable: ${(e as Error).message}`);
    process.exit(2);
  }
  console.log("Shared workflows pinned to index.lock.json:");
  if (result.findings.length === 0) {
    console.log("  ✓ every first-party call is pinned");
    process.exit(0);
  }
  for (const f of result.findings) {
    console.log(`  ${write && f.want !== null ? "✎" : f.trailing ? "⚠" : "✗"} ${f.file}:${f.line}  ${f.have}`);
    console.log(`      ${f.why}${f.want ? `\n      want: ${f.want}` : ""}`);
  }
  if (write) {
    const left = result.findings.filter((f) => f.want === null && !f.why.startsWith("tools-ref"));
    console.log(`  rewrote ${result.fixed} line(s)${left.length ? `; ${left.length} need a hand pin or fix` : ""}`);
    process.exit(left.length ? 1 : 0);
  }
  // input-site: env WORKFLOW_PINS_STRICT #4e1adbf3 — when 1, trailing pins fail the check too
  const strict = process.env.WORKFLOW_PINS_STRICT === "1";
  const failing = result.findings.filter((f) => strict || !f.trailing);
  console.log("  run `bun run cat workflow-pins` in an agent session (it needs to push .github/workflows)");
  process.exit(failing.length ? 1 : 0);
}

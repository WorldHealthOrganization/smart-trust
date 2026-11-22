---
name: pickup
description: Pick up / continue work on one or more existing open PRs efficiently. Resolves each PR's REAL branch + title + checklist + reviews + CI in one batched pass, classifies CI as billing-vs-real, then dispatches one worktree sub-agent per PR with a filled-in brief, and applies the safe class of review-nit fixes (eval→ast.literal_eval, dead-code/unused-var removal, etc.). Use when the user says "pick up PR N", "continue 1543/1576/1571", "work these PRs", "address the review on PR N", or "take over PR N".
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, Agent, ToolSearch, AskUserQuestion
---

# Pickup Skill

Continue work on existing open change proposals — pull requests (PRs) —
with minimal wasted tokens. This skill
exists because the expensive failure mode is **acting on a remembered or
assumed branch name / scope** and then re-discovering reality mid-task.
The cure is: resolve ground truth first, in one batch, then dispatch.

> Read repo-root `AGENTS.md` first. This skill operates under the
> branch/PR workflow, the project's production-vs-exploratory and
> content validation discipline, and CI-billing-failure rules. It does
> not override them.

## Hard rules

1. **NEVER trust a remembered branch name or PR title.** A PR number is
   the only stable handle. `git ls-remote` / a branch you "recall" is
   not — branch names drift and a PR number you were given may map to a
   *different* PR than its scope suggests. Always resolve `head.ref`,
   `title`, and body checklist by reading the PR (the *read change proposal*
   [forge-operation Tool](../../../skills/tools/folio-core/skills-and-tools.md#the-forge-operations-one-tool-node-each)) for the literal number before doing anything.

2. **A review targets a commit SHA — re-verify the nit is still live.**
   Gemini/Copilot review the commit at review time. Later commits on the
   branch may have already fixed the flagged issue. Before "fixing"
   anything from a review, `grep` the *current* file: if `eval(` /
   the unused symbol / the dead dict is already gone, reply noting it's
   resolved — do **not** re-apply or hallucinate a fix.

3. **Verify the file before trusting any description of it** — including
   the review's, the PR body's, and your own earlier read if the output
   looked corrupted. Read the real bytes (capture to a temp file and
   Read it if terminal display garbles output).

4. **Commit-early in every sub-agent.** Long sub-agents hit idle/stream
   timeouts. A sub-agent that explores for 80 tool-calls then dies
   without committing loses everything. Brief sub-agents to commit after
   the first substantive edit and push after each commit.

5. **Classify CI before diagnosing it.** Multiple jobs failing in ≤5 s with
   identical `started_at` is the GitHub Actions **billing** signature, not a
   code failure ([`integration-watcher`](integration-watcher.md) §5f). Do not push retrigger
   commits; note it and move on. Real failures take ≥30 s.

6. **Never merge.** Merge needs explicit user permission via
   `/prepare-merge`. This skill prepares and reports; it does not merge.

## Arguments

```
/pickup <PR#> [<PR#> ...]            # full pickup: discover + dispatch each
/pickup <PR#> --reviews-only         # just apply the safe review-nit fixes
/pickup <PR#> --discover-only        # print the resolved brief, do not dispatch
```

With **no arg**, ask the user which open PR(s) to pick up (offer the
recently-updated `claude/*` PRs, listed with the *list change proposals* [forge-operation Tool](../../../skills/tools/folio-core/skills-and-tools.md#the-forge-operations-one-tool-node-each)).

## Procedure

### Step 0 — Load tools

Resolve the forge-operation Tools from the `tools` graph, picking the node for
the forge the checkout's remote is on
([`skills-and-tools`](../../../skills/tools/folio-core/skills-and-tools.md#the-forge-operations-one-tool-node-each)).
This skill uses *read change proposal* (details, check runs, reviews, review
comments), *list change proposals*, *comment on change proposal* and *request
review*.
Where the session offers the Tool's MCP arm, those tools are deferred — load
them before Step 1; otherwise its shell arm serves. If neither is reachable,
say so and stop: a PR not resolved is not ground truth.

### Step 1 — Resolve ground truth (ONE batched pass per PR)

For each PR number, in a single message issue parallel calls:

- *read change proposal* → `head.ref` (the REAL branch), `title`,
  `body` (checklist), `base.ref`, `mergeable_state`, `state`.
  **Act on `mergeable_state` only when it reads `dirty`.** This endpoint can
  serve a merged PR's PRE-MERGE view for a long time, so `clean` and
  `unknown` can both be describing a PR that is already gone; `unknown`
  additionally means *not computed yet* rather than *cannot be determined*. For "has this landed?", ask git:
  `git merge-base --is-ancestor origin/<head> origin/<base>`.
- its check runs → CI state.
- its reviews and review comments → review
  bodies + inline threads (these are often rate-limited; tolerate
  failure and proceed with what you have).

Parse the body for unchecked `- [ ]` items — that is the work queue.
Classify CI per Hard Rule 5.

If `--discover-only`: print, per PR, the resolved branch, title,
unchecked checklist items, CI verdict (billing/real/green), and open
review nits. Stop.

### Step 2 — Triage review nits into safe vs unsafe

**Safe class (auto-apply after re-verifying live per Hard Rule 2):**
- `eval(` / `exec(` → `ast.literal_eval` (or a real parser).
- Unused function / import / variable / dict removal (dead code).
- Obvious typos in comments/docstrings.
- f-string / format trivialities, missing `r` on regex literals.

**Unsafe class (never auto-apply — `AskUserQuestion` or defer):**
- Anything touching math/numerics, a witness value, or a canonical
  formula (production-vs-exploratory discipline applies).
- Anything changing a formal statement, a proof, or a content validation
  invariant.
- Architectural / multi-file refactors, API changes.
- A reviewer suggestion that conflicts with the PR's stated intent.

### Step 3 — Dispatch one worktree sub-agent per PR

For each PR with non-trivial remaining work, spawn a background
`Agent(isolation: "worktree", run_in_background: true)`. The brief MUST
contain (filled from Step 1, not assumed):

- the **resolved** branch name (`git fetch origin <ref>` +
  `git checkout -B <ref> origin/<ref>`; "do NOT create a new branch");
- the literal PR title + the unchecked checklist items;
- the relevant AGENTS.md discipline pointers for that PR's domain
  (content validation / production-vs-exploratory / formal-proof /
  precision-goals — whichever apply);
- **commit-early-and-push** instruction (Hard Rule 4) with the session
  URL line for commit bodies and 4× exp-backoff push retry;
- "validate before pushing content (`bun run validate <paper>`); never
  add a `status` field; do NOT open a new PR (it exists); do NOT merge";
- "if blocked on a bad premise / a gate / a missing toolchain, STOP and
  report — do NOT fabricate work or numbers."

Keep each brief **single-focus** where possible; a sub-agent with one
clear deliverable is far less likely to time out than one with a broad
survey. For purely mechanical review-nit fixes, do them inline (Step 4)
rather than spawning an agent.

### Step 4 — Apply safe review-nit fixes inline

For `--reviews-only` or small nit batches, do it in the foreground via a
temp worktree (keeps the working branch clean):

```bash
git worktree add -f /tmp/pick-wt <resolved-branch>
# edit in /tmp/pick-wt, re-verify the nit is live first
python3 -c "import ast,sys; ast.parse(open(P).read())"   # syntax gate for .py
# run the script/test if cheap, to confirm no behavior change
git -C /tmp/pick-wt commit -am "<msg>"; push with retry
git worktree remove --force /tmp/pick-wt
```

Commit message: `style(<area>): <fix> — address <reviewer> review`.
Commit body ends with the session's attribution lines.

### Step 5 — Reply frugally + report

- Reply to a review **only** if it resolves the thread or raises a
  question — be frugal. For "already fixed in a later
  commit" nits, one short note is enough; don't reply per-nit.
- If Copilot's review errored ("unable to review"),
  request its review again (the *request review* [forge-operation Tool](../../../skills/tools/folio-core/skills-and-tools.md#the-forge-operations-one-tool-node-each)).
- Report per PR: resolved branch, what was done / dispatched, commit
  SHAs, CI verdict, blob URLs (`.md` primary), and any blocked items
  with reasons. Never claim a formal artifact compiles/verifies unless a
  checker actually confirmed it; say "verification pending" otherwise.

## Worktree hygiene

Sub-agent worktrees are auto-locked while running. After completion,
`git worktree prune` then `git worktree remove --force
.claude/worktrees/agent-<id>` for finished ones. Remove any `/tmp/*-wt`
you created. Never `rm -rf` a tracked path to "clean up" — check
`git ls-tree` first (a path tracked on `base` is not leftover junk).

## Anti-patterns this skill prevents

| Anti-pattern | Cost seen | Guard |
|---|---|---|
| Dispatch on assumed branch name | 3× ~10 min wasted sub-agents | Hard Rule 1 / Step 1 |
| Re-fix an already-fixed review nit | hallucinated edits | Hard Rule 2 / Step 2 |
| Trust corrupted tool output | wrong edit target | Hard Rule 3 / Step 4 |
| Sub-agent times out uncommitted | full progress loss | Hard Rule 4 / Step 3 |
| Diagnose billing CI as a code bug | retrigger churn | Hard Rule 5 / Step 1 |
| `rm -rf` a base-tracked dir | deleted real files | Worktree hygiene |

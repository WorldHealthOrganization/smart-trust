---
# cat-tools-pp9g
$schema: bean/1.0.0
title: 'Pre-push: the fast gates run on the committer''s machine, and a tree-keyed record CI can honour with deferred verification'
status: completed
type: feature
priority: normal
tags:
    - ci-speed
    - f017
    - 4rbc
created_at: 2026-11-05T08:20:00Z
updated_at: 2026-11-08T14:35:00Z
parent: folio-assistant-fn8q
---

The layer half of **folio-assistant-fn8q** (gates before push, epic `k3vv`),
which is the work item; this bean holds what was built here and the design.

Asked by the owner through the "CI pipeline performance analysis" session
(folio-assistant): *"all speed improvements; can agents and coders who commit
the code do this work?"*. Agent containers run the same pinned Bun as CI, so
the fast set can run there, before the push, instead of only on a runner after
it.

## Off by default (2026-11-05, after the measurement)

A typical push in a composed agent container (4 CPUs, cold cache) took
**70 min** even with the whole suite held out (`skill:register:check` 18 min,
`uml:overview:check` 11 min). So both hooks are now **off unless the checkout
opts in** (`CAT_PREPUSH_GATES=1`, or `git config cat.gates.prePush true`); off,
a push goes at once, says so, and logs an `off` entry. What a time-bounded
subset should hold is the owner's open decision.

## 1. git's pre-push hook (built)

`scripts/git-hooks/pre-push`, installed by `scripts/git-hooks/install.sh`,
runs `scripts/pre-push-gates.ts --git-hook <remote>`:

- only the checked-out commit is judged, and only when no tracked file
  differs from HEAD; a dirty tree is "not judged" (allowed, logged), never a
  refusal, since `state:mount` itself rewrites folio-assistant's `.gitignore`
  whenever main's ignore block lags a mounted graph. A pushed commit that is not
  HEAD is allowed unjudged, because the branch store pushes
  `<commit>:refs/heads/cat/...` from the same repository on every
  `beans:claim` / `state:push`, and refusing those would break claiming;
- it runs `bun run cat gates --report <git dir>/cat-gates/last-report.json`,
  the fast set derived from the workflow. Gates whose inputs are unchanged
  since they last passed are SKIPPED by the f017 input-hash cache, which is
  the "only what the change affects" part. Measured on `4rbc`: nearly every
  gate declares `{tracked}`, so a real change re-asks nearly all of them. The
  narrow, strace-derived read sets of the CI cone exist only in main's CI
  cache, so they do not help here; making them fetchable locally is a
  possible follow-up;
- exit 0: a record is written (section 3) and the push goes;
- exit 1: refused **only for a new failure**: a gate red now that was green on
  the push's base in this same environment (the remote branch's current tip,
  i.e. the previous push, else the merge base with `origin`'s default). That
  is CI's own "no new failures" rule. Every run keeps its per-gate outcomes in
  `<git dir>/cat-gates/results/<tree>.json` so the next push has a base, and
  `pre-push-gates.ts --baseline` records them for HEAD (e.g. on main after a
  cold start);
- a red with no green base to compare against, a gate that changed the tree,
  exit 2, or no `cat` runner (a layer cloned on its own): pushed, said so,
  logged, and no record, so CI runs everything as it does today.

**Why not refuse on any red** (2026-11-05, from the CI-analysis session): in a
fresh folio-assistant agent container (mounted from the lock, `bun install`,
`state:mount`, `smart:pages`, `ig-index:build`, no `derive:publish`),
`CI=1 bun run cat gates` reddened 11 `bun test` cases that pass in CI on the
same tree (folio-assistant#2946), for want of publish-time pages and of a
faster machine (5000 ms timeouts). Refusing on those would block good pushes.
Running the producers CI runs first (`derive:publish`) is the other fix; it is
left for when its cost in a container is measured, since the baseline rule
already keeps an environment red from refusing.

**Affected tests only (owner, 2026-11-05).** Measured in a freshly mounted
folio-assistant checkout on 4 CPUs: the whole fast set took 55 min, 31 of
them in the whole-suite `bun test` (19 412 pass, 80 fail, mostly failing on
main too). The owner chose: before a push, the fast gates *minus* that suite
(`gates --except "bun test"`, named `heldOut` in the report and the record),
plus only the test files whose relative-import closure holds a changed file
(`scripts/affected-tests.ts`). A runtime change (lockfile, manifest, bunfig,
tsconfig, a test preload), or no base to diff against, selects all of them,
and those are left to CI. A failing affected test refuses only if it passes
with the changed paths swapped back to the base in the working tree (index
untouched, restored to HEAD after). The closure does not see fixture reads,
walks or spawns (bean `4rbc`), so CI's whole suite still catches those.

**Bypass**: `CAT_GATES_BYPASS='<reason>' git push ...`, appended with the refs
and time to `<git dir>/cat-gates/push.log`. `git push --no-verify` skips git's
hook and git gives the hook no way to log that; the Claude hook (below)
refuses `--no-verify` without a reason.

## 2. The Claude Code hook (built; adoption is per index)

Agent containers are cloned fresh and never run `install.sh`, so they get the
same check as a `PreToolUse` hook on `Bash`:
`scripts/git-hooks/claude-settings.pre-push.json` is the block to merge into an
index's `.claude/settings.json`:

```json
{ "hooks": { "PreToolUse": [ { "matcher": "Bash", "hooks": [ {
  "type": "command",
  "command": "f=\"$CLAUDE_PROJECT_DIR/cat-harness-tools/scripts/git-hooks/claude-pre-push.sh\"; [ ! -f \"$f\" ] || sh \"$f\"",
  "timeout": 1800 } ] } ] } }
```

`claude-pre-push.sh` starts bun only when the tool call mentions `push`, so
every other Bash call costs one shell `case`; the `[ ! -f ]` guard makes it a
no-op where the cat-harness-tools pin predates the hook.

It reads the tool call, passes anything that is not a `git push` (or is a dry
run) at once, resolves the refspec sources (HEAD when none is named), and
decides exactly as the git hook does. A refusal exits 2, which blocks the call
and hands the agent the failing gates. Because a pass writes the tree's
record, git's own hook, if installed, finds the record and does not run the
gates a second time.

**Follow-ups, outside this layer:** add the block to folio-assistant's
`.claude/settings.json`; document it in `prepare-merge` §Guardrails and in
`bean-coordination` (both in cat-harness `skills/`): "a push runs the fast
gates; a red one blocks it; bypass with a stated reason".

## 3. The tree-keyed record, and CI honouring it with deferred verification

### Built: the record

`scripts/gate-record.ts`, schema `cat-local-gate-record/v1`, written only on a
pass, to `<git common dir>/cat-gates/records/<tree>.json`:

| field | why |
|---|---|
| `tree` | the key: the gates judge files, so an amend of the message or a rebase that lands on the same tree is the same judgment |
| `commit` | informative; the commit the run was made for |
| `set`, `gates` | the fast or whole set, and every command in it (`GatesReport.commands`, added for this) |
| `skipped` | gates the f017 cache answered; never counted as asked |
| `tools.bun`, `tools.git`, `tools.platform` | the same tree under another Bun is a different run; `covers` requires the same Bun. The workflow and `bun.lock` are files of the tree, so the key already fixes the gate list and the dependency set |
| `runBy` | `agent` (CLAUDECODE set) or `human` |
| `startedAt`, `finishedAt` | |

It is also attached to the commit as a git note under `refs/notes/cat-gates`
(`git config cat.gates.noteRecords false` turns that off), and pushed with the
branch when `git config cat.gates.pushRecords true` is set. Default off,
because nothing reads it on the remote yet.

### Design: CI honours the record (follow-up in folio-assistant)

The same trust model as agent-built previews (folio-assistant#2881,
`feature-staging.yml` and `preview-verify-sweep.yml`): an artifact the
committer built is accepted on the critical path and re-verified off it.

1. **Fetch.** The PR job fetches `refs/notes/cat-gates` and reads the note on
   the PR head.
2. **Honour only an exact match.** All of:
   - `record.tree == git rev-parse <head>^{tree}`;
   - the PR head contains its base (`git merge-base --is-ancestor <base> <head>`),
     so the merge commit CI would test has the same tree as the head. A branch
     behind its base runs everything: the record judged a tree that will not land;
   - `record.tools.bun` equals the workflow's pinned Bun, and
     `record.tools.platform` is linux-x64 (the runner's);
   - `record.gates` equals the fast set `bun run cat gates --list` derives on
     that tree. The check is cheap and catches a record made by an older reader;
   - the note was pushed by an account with write access, the same trust as the
     code itself.
3. **Skip, said as such.** Each gate the record covers is reported
   `SKIPPED — passed locally on tree <t> (<runBy>, <finishedAt>), verification
   deferred`, never as passed. That is the CI cone's wording rule.
4. **Verify off the critical path.** A sweep workflow (the shape of
   `preview-verify-sweep.yml`) re-runs the full fast set on every honoured head
   with no cache. It writes a commit status `gates/verified` that the merge
   queue requires, so nothing lands unverified: the critical path is shorter,
   the evidence is not weaker.
5. **A mismatch revokes.** A record that said pass where the sweep is red is a
   false claim. The sweep opens an issue naming the record, the tree and the
   differing gates. For a period, CI stops honouring records whose `runBy` and
   pusher match, and keeps running the full set for them, until the cause is
   understood. The mismatch is also evidence of the difference that 4rbc and
   f017 hunt: an input the local run did not see.

**Why it is sound**: the record is never the verdict that merges; the sweep
is. The record only reorders the work: a green PR shows sooner, and the
merge-gating run happens later and off the PR's critical path.

## Measured (2026-11-05, composed folio-assistant checkout, 4 CPUs)

All in a fresh checkout mounted from the lock (`mount-from-lock.sh`, 10 s;
`bun install`, 1 s; `state:mount`, 62 s; `ig-index:build`, 29 s).

| what | measured |
|---|---|
| typical push through the hook (one-file change, cold cache, `bun test` held out) | **4224 s (70 min)**; gate run wall 3620 s, 294 gates |
| longest gates (pool CPU-sum) | `skill:register:check` 1086 s, `uml:overview:check` 662 s, `kind:register:check` 229 s, `kg:audit:check` 115 s |
| serial setup inside the gate set | `state:mount` x8, 284 s; `ig-index:build` x4, 85 s |
| whole-suite `bun test` | 1858 s (31 min): 19 412 pass, 80 fail, mostly failing on main too |
| affected-test selection, last 25 cat-harness-tools commits | median **1** test file, max 1059 (a hub module), "all" for 3 runtime changes |
| same tree pushed again | 0 s (the record) |
| `derive:publish` in an agent container | 833 s, then exit 1: GitHub releases API 403 through the proxy |
| `state:mount`'s remote fan-out after a lock mount (cat-harness-tools#1489) | main 48.5 / 52.3 / 58.8 s; #1489 **1.1 / 1.2 / 1.2 s**, nothing fetched |

Findings this measuring turned up, each fixed in its own PR:

- `gates` crashed with a stack overflow (`push(...lines)` in
  `input-trace.ts`) part-way through a large run, so the first "55 min"
  figure covered only 70 of 295 gates (cat-harness-tools#1490).
- `remote-mount.test.ts` hydrated-mount tests hit bun's 5 s default under load
  (cat-harness-tools#1488, 30 s).
- `state:mount` rewrites folio-assistant's tracked `.gitignore` when main's
  ignore block lags, so a dirty tree is "not judged", never refused.
- A branch-store push (`<sha>:refs/heads/cat/...`) is not HEAD, so it is left
  to CI, never refused.
- Selecting every test behind a computed import put 433 of 1533 test files
  behind a few hub modules; the selection walks past them instead.

The CI side (deferred verification) is folio-assistant#2957 (honour a record:
identical tree, same bun and platform, first attempt only, pending
`gates/verified` set first) and #2958 (the sweep re-runs the run and resolves
the status; a red re-run revokes and opens an issue). Both are off until the
repository variable `CQG_HONOUR_LOCAL_RECORDS` is set.

## Completed (2026-11-08)

Parent `folio-assistant-fn8q` is completed and all PRs for this work item are merged on `main`:

- `litlfred/cat-harness-tools#1488` (`35e9fe06`): `remote-mount.test.ts` hydrated-mount test timeout raised to 30 s under load.
- `litlfred/cat-harness-tools#1489` (`42778580`): `state:mount` skips remote fan-out when every lock mount is current (48–59 s down to 1.1–1.2 s).
- `litlfred/cat-harness-tools#1490` (`23147a7f`): `input-trace.ts` avoids `push(...lines)` stack overflow on large gate runs.
- `litlfred/folio-assistant#2957` (`0d486d9b7e04`): `cqg` deferred verification hook for local gate records.
- `litlfred/folio-assistant#2958` (`3f2aeaa881de`): `cqg` sweep re-verifies gates skipped on a local record off the critical path.
- `litlfred/cat-harness-tools#1572` (`e7dc68c5`): `pre-push: stop attaching local gate records for CI (owner's ruling)` — local pre-push hook remains opt-in (`CAT_PREPUSH_GATES=1` / `cat.gates.prePush`) without attaching git-note records for CI.
- `litlfred/folio-assistant#2989` (`acadc5dccb29`): `cqg: CI never honours a local gate record (owner's ruling)`.

The remaining follow-up discovered while re-timing `pp9g` (mounted layers dirtied during a local `gates` run) is tracked in `cat-tools-sm8r` under epic `folio-assistant-1xhc`.



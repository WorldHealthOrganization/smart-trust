---
part-of: integration-watcher
description: >
  Detail for `integration-watcher`, split out of it so the parent stays a
  short entry point. NOT a skill of its own — it is reached through the
  parent, and section numbers are the parent's.
---

# integration-watcher — §0b and §5, the idle backlog

What a watcher does when nothing is arriving: the 5-minute idle trigger (§0b)
and the backlog sweep it runs (§5), including the handover issue template. A
watcher processing events never reaches it.

**Section numbers are the parent's** — `parent §5a` and `parent §5m` resolve
to this file.

## 0b. Idle-time backlog policy (5-minute trigger)

Per `idle-backlog` (opt-in `cat-harness.work-plan`) (the 5-minute idle
trigger): when this watcher has been idle for > 5 minutes (no
substantive output beyond TICK heartbeats or empty acks),
automatically start processing backlog without waiting for the user
to prompt. Walk the priority order:

1. **Session todos** (work items work-plan).
2. **Current-PR todos** — open-PR body checklist + unresolved
   review-comment threads on the branch's PR (via
   `mcp__github__pull_request_read get_review_comments` and `get` for
   the body).
3. **Integration-watcher queue items** — this watcher's own
   `beans/<name>-queue.json` first, then sibling watchers'. Prefer
   items whose `block_or_script` overlaps the current PR's scope.
4. **Refresh stale sidecars + witnesses.** The QA pipeline depends on
   `*.qa.json` sidecars and `*.witness.json` files staying in sync
   with the source they audit. Treat the following as actionable
   backlog whenever idle:

   - **Sidecar staleness** — any block where either:
     (a) the SHA-256 prefix of the current source file content differs
     from the value stored under `source_hashes.{...}` in the
     `.qa.json`, OR
     (b) the SHA-256 prefix of the current checker script differs from
     the `criteria.<crit>[-1].reviewer.script_hash` value stored for
     the criterion's most recent entry. (Both stored hashes are
     12-character SHA-256 prefixes computed by the qa-sweep code;
     recompute with the same algorithm — see
     `pipeline/qa-sweep.ts` for the canonical helper.)
     Refresh by deleting the stale `criteria.<crit>` entry from the
     `.qa.json` and running
     `bun run pipeline/qa-sweep.ts <path> --only <crit>`
     (or invoke `/integration-audit <axis>` for a whole axis at once).
   - **Section-title sidecar staleness** — the chapter-scoped
     `content/<paper>/section-title-audit.qa.json` sidecars are a
     *separate* kind (title/structure machine findings + agent
     title-coherence verdicts), refreshed by
     `qa-section-title-audit.ts`, **not** qa-sweep. Regenerate with
     `bun run pipeline/qa-section-title-audit.ts --report-only
     --write-sidecar --thorough`. The `--thorough` flag folds every
     contained block's source content + descendant subsections into a
     per-section subtree hash, so a recorded title verdict re-opens
     (`pending`) when any descendant drifts. Keep the committed
     sidecars in thorough mode.
   - **Witness staleness** — any `*.witness.json` where either:
     (a) `witness.scriptCommitSha` differs from the current `HEAD` git
     commit SHA on the producer script's containing file
     (`git log -1 --format=%H -- <producer>`), OR
     (b) `witness.scriptHash` (SHA-256 prefix of the producer script's
     file content) differs from a freshly-computed hash of the current
     producer script. Refresh by re-running the producer with
     `2>&1 | tee /tmp/<script>.log` per the long-compute logging
     discipline.
   - **Detection budget** — capped at ≤ 10 sidecars / ≤ 3 witnesses
     per idle pass to avoid burying the visible queue items; remaining
     stale entries get logged for the next idle window.
   - **No silent regen** — every refresh that changes a sidecar or
     witness gets a commit on the current branch with a
     `chore(qa-sweep|witness)` message naming the producer + criterion
     + count of entries updated.
   - **Witness producer ≠ available** — if a witness's producer script
     crashes (e.g. blocked on a host fetch, a long compute killed), do
     NOT delete the sidecar. File a queue item naming the producer +
     the specific blocker and move on.

5. **Cross-cutting cleanups** (bare-URL reference upgrades, deferred
   bibliography items, glossary backfills).

For this skill's children specifically:

- The watcher's queue file is the primary backlog source (item 3).
  When triggered, read the queue, pull the highest-priority
  `needs-author` or unresolved `triage` item, and apply the §4 → §5 →
  §6 child-specific procedure on it.
- If the queue is empty/all-terminal, fall through to items 4–5 (stale
  sidecars and witnesses, cross-cutting cleanups). Don't sit idle if there's reachable
  cleanup work.
- The "pause" command from the user IS a terminal state — do not
  pursue backlog after the user says "pause" or "stop until I'm back".
  Only the explicit "resume" / "continue" restart command lifts the
  pause.

Watcher sessions spend long stretches idle once the in-flight tranche lands,
and productive idle is working the next queue item, not heartbeats.

## 5. Idle backlog sweep

When the queue has been quiescent for ≥ 10 minutes (no main commits, no
PR events, no in-flight discharge attempts), pull the next backlog item.

### 5a. Discovery (run once at session start, refresh every 50 items)

Children fill **Slot G** with the domain's enumeration recipe (typically
a `find` + `grep` pipeline OR an existing aggregator script).

### 5b. Prioritisation

Children fill **Slot H** with the domain's ranking rule. Common factors:

1. Severity (critical > major > minor).
2. Downstream dependents (more dependents → earlier) via `uses[]`.
3. Last-audit recency (older → earlier) from `queue.audited[]`.
4. Alphabetical as tie-breaker.

### 5c. Per-item processing

Apply §4 — exactly the same pipeline as for incoming events. The
`source` field on each queue item becomes `backlog`.

### 5d. Quiescence + heartbeat — AUTO-PULL FROM QUEUE WHEN IDLE

A backlog item is preempted by any incoming event. Resume the backlog
when the queue is quiescent again. The number of in-flight backlog items
is capped by §5m's parallelism cap (currently 4) when items are
independent; items sharing state serialise.

**Auto-pull policy (MANDATORY).** On every Monitor TICK heartbeat where:

1. No incoming event has arrived during this TICK window
2. The count of items currently in `status: in-progress` is below the
   parallelism cap (per §5m, default 4)
3. `beans/${NAME}-queue.json` contains at least one item with `status:
   queued` (or `status: needs-author` whose author ask has been
   outstanding ≥ 7 days — the §5e re-ask cadence)

→ **Pull the highest-priority queued item per §5b and start §5c
processing on it immediately.** Do not wait for a user prompt. The
heartbeat one-liner is for periods when the queue is *empty*, NOT for
periods when the queue is non-empty and the agent is choosing not to
work.

Sub-agent dispatch. For long-running items the watcher should launch the
work via `Agent(run_in_background=true)` so the foreground stays
responsive. Update the item's status to `in-progress` immediately on
dispatch and back to `resolved` / `needs-author` on completion.

Foreground vs background. Use foreground for items whose findings the
watcher itself must consume to decide what to queue next. Use background
for items whose deliverable is a standalone PR / commit / handover doc.

**Empty-queue heartbeat.** Only when the queue truly has no queued or
eligible needs-author items, and the session has been entirely quiescent
for ≥ 60 minutes, emit a one-liner:

> `<watcher-name>` idle — backlog at N items, queue at M items (0
> eligible for auto-pull), in-progress at K items, next refresh in
> <next discovery time>.

…and keep the Monitor armed. (If the queue has eligible items but the
agent didn't auto-pull, that is a policy violation — fix the watcher's
TICK handler, do not work around with the one-liner.)

### 5d-bis. Own-PR-CI-wait counts as idle (MANDATORY)

After you push a PR you authored this session, **do not stop**. The
webhook subscription will deliver CI/review events when they arrive;
meanwhile the agent is idle in §5d's sense and MUST pull the next
backlog item:

1. **Push + subscribe + immediately re-enter §5d auto-pull.**
2. **Pick a non-overlapping item.** The new item's scope must not touch
   files modified in the in-flight PR. Use `git diff origin/main..HEAD
   --name-only` on the in-flight branch to compute the exclusion set.
3. **Open the next item on a NEW branch off `origin/main`** — not off
   the in-flight PR's branch.
4. **Webhook events still preempt.**
5. **Exhaust the queue, not your patience.** Continue batching until (a)
   the queue is empty, (b) every remaining item touches files in an
   in-flight PR, or (c) the user says "stop" / "park" / "switch to X".

### 5e. Idle author-ask dispatcher

When the watcher enters an idle window AND the queue contains items
needing author input, batch the open asks and surface them via
`AskUserQuestion` (foreground) OR as a single consolidated own-PR
comment (PR-driven session) OR as a "Pending author asks" section in the
ledger (headless).

Triggers (in priority order):

1. Items with `status: needs-author` that have never been asked
   (`asked_author_at: null`).
2. Items with `status: queued` that have aged > 24 h without any
   discharge attempt and are in the **Author-assist** band.
3. Items with `status: needs-author` that were asked > 7 days ago and
   never resolved — **re-ask once**, then mark `wontfix` with `reason:
   author-unresponsive`.

Per round, pull **up to 3** asks, group by block, surface as one
consolidated message. After each ask, set `asked_author_at: "<ISO ts>"`.
Cap consecutive asks per block at 3; beyond that mark `wontfix` with
`reason: ask-fatigue`.

**Anti-pattern:** never auto-mark a `needs-author` item as `resolved`
based on inferred user assent. Only an explicit author reply or commit
closes it.

### 5f. Witness-drift CI failure pattern (RECOVERY RECIPE)

A compute/witness validation CI job re-runs the project's computations,
regenerates witnesses, and fires a drift check. It triggers on formal /
compute source edits AND on any `*.witness.json` / `*.derivation.json`
change.

**Failure mode:** even a comment-only edit can trigger validate.
Validate runs many scripts; one regenerates a witness that has drifted
on main since the last refresh (e.g. a `files_scanned` count moved when
a new probe landed without a witness refresh). The drift check fires.

**Sub-case: quick-fail = billing.** If a CI job fails in **under ~60
seconds**, the runner almost never reached the validators. This is a
billing / queue / quota condition on the CI account, **not** a content
failure. Treat as a flake: do NOT rebase, do NOT regenerate witnesses,
do NOT diagnose validators. Document in ledger as `quick-fail /
billing` and proceed per §5g step 5(b).

**Recovery recipe** (apply IN ORDER) for genuine multi-minute validate
failures:

1. **Pull fresh main.** `git fetch origin main`. If ≥ 5 commits landed,
   jump straight to step 2.
2. **Rebase.** `git rebase origin/main`. Witness conflicts are expected
   on the auto-regenerated audit witnesses.
3. **Take main's witnesses.** `git checkout --ours <witness>` for each
   conflicted file (in rebase context `--ours` = main). `git add
   <witness>`.
4. **Continue.** `git rebase --continue`. If the same conflict reappears
   on a later commit, repeat step 3.
5. **Force-push.** `git push --force-with-lease`.

**Do not** hand-edit witness JSON, do not regenerate witnesses on your
branch as a "fix" (by the time CI runs, main moves again), and do not
rebase reactively after every single CI failure — only after exhausted
local diagnosis.

### 5g. Watch PRs you prepare

When a watcher (or any skill it dispatches) **prepares a PR**, the
watcher **must** add the new PR to its subscription set immediately and
follow up on review activity: respond to review comments where you can,
ask the author where you cannot, and once done ask the author whether to
merge, with the link.

Per prepared PR:

1. **Subscribe.** Right after `create_pull_request`, call
   `mcp__github__subscribe_pr_activity` with the new PR number. Add to
   the ledger under "watching".
2. **Request automated reviews from the available bots.** Call
   `mcp__github__request_copilot_review`. Any other automatic reviewer
   (e.g. `gemini-code-assist`) runs on PR open if configured; if it
   doesn't post within a few minutes, check for a quota-limit comment
   and document in the ledger. Don't wait for human review.
3. **Triage every review event** per coordinate §5a:
   - `accept` → fix the small thing, push
   - `accept-with-modification` → fix differently, reply
   - `reject-with-reason` → reply on the thread
   - `escalate` → ask the author via §4e
4. **Pre-push stale-base check.** Every fix-push triggers a fresh CI
   run. Before each fix-push, run `git fetch origin main` and check the
   delta. If main moved ≥ 3 commits and any touch your PR's diff scope,
   rebase first (per §5f).
5. **Done check + merge via `/prepare-merge-auto`.** When (a) every open
   review thread is resolved or replied to AND voice has been applied or
   noted n/a (§5h), (b) every CI check is green OR documented as a flake
   (§5f), (c) the diff still reflects the original intent — invoke
   `/prepare-merge-auto`. The skill handles sibling coordination, final
   rebase, review-comment resolution, structured user questions (if
   blocked), and merge.
6. **Stop on merge.** Once merged (or closed), call
   `mcp__github__unsubscribe_pr_activity`. Record outcome in ledger.

7. **Rebase spawned PRs on main movement.** Every time a new commit
   lands on `origin/main` and the §3 / §4 per-event triage completes,
   walk **every PR this watcher has opened that is still open** and
   ensure each one is current with `origin/main`:

   ```bash
   # One `git fetch origin` outside the loop refreshes every
   # remote-tracking ref the loop will use.
   git fetch origin

   # Extract branches under the "### Watching" subsection. The closing
   # pattern is `^## ` (next top-level header), NOT `^### `.
   pr_branches=$(awk '/^### Watching/,/^## /' \
       "beans/${NAME}-ledger.md" \
       | grep -oE 'claude/iw-[a-z0-9-]+' | sort -u)

   for pr_branch in $pr_branches; do
     pr_num=$(gh pr list --head "$pr_branch" --state open \
              --json number --jq '.[0].number')
     [ -n "$pr_num" ] || continue   # closed / no open PR; skip

     behind=$(git rev-list --count "origin/$pr_branch..origin/main")

     # Diff-scope overlap: which files did MAIN change since the branch
     # diverged, intersected with files the BRANCH changed since
     # divergence? Use merge-base, not a two-tip diff.
     base=$(git merge-base "origin/main" "origin/$pr_branch")
     # `xargs -r` skips the inner command when the file list is empty.
     touches_diff=$(
       git diff --name-only "$base" "origin/$pr_branch" \
       | xargs -r -I {} git log --oneline "$base..origin/main" -- {} \
       | wc -l
     )

     # Rebase trigger: ≥ 3 commits behind OR ≥ 1 file in the
     # intersection of (main-changed-since-base) ∩ (branch-changed).
     if [ "$behind" -lt 3 ] && [ "$touches_diff" -eq 0 ]; then
       continue
     fi

     # Rebase in a worktree. Use a SUBSHELL so the per-iteration
     # `trap … EXIT` is scoped to this iteration.
     (
       worktree=$(mktemp -d /tmp/iw-rebase.XXXXXX)
       trap 'git worktree remove --force "$worktree" 2>/dev/null; \
             rm -rf "$worktree"' EXIT

       git worktree add "$worktree" "origin/$pr_branch" >/dev/null

       # Explicit if/then/else so rebase-conflict and push-fail are
       # distinguishable.
       if ( cd "$worktree" && git rebase origin/main ); then
         if ( cd "$worktree" && git push --force-with-lease \
                origin "HEAD:$pr_branch" ); then
           echo "REBASED + PUSHED $pr_branch"
         else
           echo "PUSH FAILED on $pr_branch (lease rejected / remote moved) — retry next cycle"
         fi
       else
         ( cd "$worktree" && git rebase --abort 2>/dev/null ) || true
         echo "REBASE CONFLICT on $pr_branch — flag to author (§4e)"
       fi
       # trap fires on subshell exit, cleaning THIS iteration's worktree.
     )

     # Update ledger row with last-rebase-against-main SHA on success.
   done
   ```

   Witness-drift conflicts on the auto-regenerated audit witnesses
   auto-resolve via the §5f recipe. Substantive conflicts halt the
   rebase and surface as an author ask per §4e. This step keeps spawned
   PRs current **automatically** between main-event triages.

### 5j. Backlog-found issue — spin up your own PR

When the **idle backlog sweep** (§5) finds an issue that is NOT already
addressed by an open PR, the watcher's default action is to **create a
PR on its own branch** to resolve it, then follow §5g.

Workflow:

1. **Cluster aggressively — one branch / one PR per related tranche.**
   Group nearby backlog items (same chapter, same file, same finding
   kind) so one PR addresses a coherent tranche, not a single one-line
   fix. **Default to "big batch".** Sequencing within the PR: stack
   commits per sub-group, each on the same branch so reviewers read one
   diff.
2. **Branch.** Create a new branch via `mcp__github__create_branch`,
   named using the **integration-watcher convention**:

   ```
   claude/iw-<TYPE>-<DESCRIPTIVE-STUB>
   ```

   - `<TYPE>` — short tag for which watcher is spinning up the PR
     (matching the child's domain prefix), or `meta` for changes to the
     integration-watcher skill family itself.
   - `<DESCRIPTIVE-STUB>` — kebab-case slug naming the issue, 3-6 words
     that read clearly in a `gh pr list` output.

   The `iw-` infix is the **mandatory marker** that ties the branch back
   to the integration-watcher family — the discovery handle any
   watcher-spawned-PR sweep can grep. Random suffixes are not part of
   the convention; on collision append `-v2` / `-v3`, don't randomise.
3. **Apply fixes.** Use `mcp__github__push_files` or `git push` from a
   temp local branch.
4. **Open PR** via `mcp__github__create_pull_request` with a descriptive
   title + body citing the backlog source.
5. **Subscribe + request copilot review** per §5g step 1-2.
6. **Triage** review threads per §5g step 3.
7. **Voice + done check + merge prompt** per §5h and §5g step 5.

**When to escalate to the user instead of opening a PR:**

| Condition | Action |
|-----------|--------|
| Backlog item is one quick fix (< 5 min, < 50 lines) and clearly mechanical | Open PR directly, don't ask first |
| Backlog item touches > 5 files OR introduces new content blocks OR makes a semantic claim | Surface to user via §4e first; only open PR after user confirms |
| **Backlog item is VERY large** (> 200 lines, > 20 files, semantic refactor, unfamiliar domain) | **Do NOT open a PR.** Write a **handover document** at `docs/audits/<YYYY-MM-DD>-<short-task>-handover.md`. See §5k. |

### 5k. Handover doc for very-large backlog issues

When a backlog issue exceeds the watcher's discharge capacity, produce a
handover doc rather than attempt the fix:

```markdown
# Handover: <issue title>

**Scope:** <one paragraph>
**Discovered by:** `<watcher-name>` backlog sweep on <date>
**Severity:** <critical | major | minor>
**Estimated effort:** <hours / days>

## Background
<context — why this matters, where the issue lives>

## What the watcher found
<verbatim queue items + evidence>

## Suggested approach
1. <step 1>
2. <step 2>

## Specialist skill recommended
`<skill-name>` (collaborator role)

## Acceptance criteria
- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] CI green (or §5f flake documented)
- [ ] Voice sweep applied
```

Then surface to user via §5e: "I found a very-large issue (<title>).
Handover doc at `<url>`. Should I dispatch `<specialist-skill>` to take
it, hold for a future session, or expand the watcher to attempt it?"

### 5i. Sibling-PR findings — post comment, don't fix

When a watcher detects an in-scope finding on **a PR it did not create**
(a sibling PR owned by another agent or a human author), the watcher
**must not** push a fix to the sibling branch. Instead, post a single
coordination comment on the sibling PR:

```markdown
**<watcher-name> sibling-PR ask — `<block-or-script>`**

- Finding: <one sentence, with severity>
- File: <github-blob-url to `.md` on the sibling PR head>
- Evidence: `<file:line>` — `<offending text>`
- Attempted: (none — not auto-fixing on sibling branches per §5i)
- Suggested fix: <one-paragraph proposal>
- Owner-agent action: address on your branch and reply with the commit
  SHA, or reply with rationale for skipping.
```

Rationale: cross-branch fixes silently diverge. The right move is to
surface the finding, suggest the fix, and let the owner integrate.

**Rate-limit.** One sibling-PR comment per finding per round. If a
sibling PR accumulates ≥ 3 unaddressed findings, batch them into a
single follow-up comment (one round only); after that, mark the PR's
items `wontfix-sibling-unresponsive` and surface to the author per §5e.

**Exceptions** (when direct cross-branch action IS appropriate):
- Cherry-picking a sibling's commit into your branch — that's pull, not
  push.
- The author explicitly authorises the cross-branch action.

### 5h. Post-completion voice review on prepared PRs

When a prepared PR (per §5g) lands its **last substantive fix**, run
`one-voice-audit` on the **diff scope** before the merge prompt:

- **PR touches `.md` content** → run the §1 greps (status leaks, emoji,
  work-tracker words, first-person tone, unicode crashes) on the diff.
  Apply mechanical fixes. Push as `style: voice sweep on PR diff`. Then
  the §5g step 5 merge prompt.
- **PR is content-free** (only formal-layer, `.ts`, `.py`, witness JSON,
  or skill `.md`) → voice is a **no-op**; record that in the ledger and
  the merge-prompt reply ("voice: n/a, PR scope is X only").

### 5l. Resume protocol — suggest next action on session start

When a watcher starts (fresh session OR `/integration-watch`
invocation), **before** arming the Monitor, compute the resume state and
surface a structured suggestion to the user.

**Procedure:**

1. **Load persisted state.** If `beans/${NAME}-queue.json` exists,
   parse it. Read `reviewed_up_to[<criterion>]`, `items[]` with `status
   ∈ {queued, in-progress, needs-author}`, and `audited[]`.

2. **Compute the unreviewed-commits queue.** For each criterion `C`:

   ```bash
   # Explicit refspec (coordinate.md §8a) — CUR below reads the tracking ref.
   git fetch origin '+refs/heads/main:refs/remotes/origin/main' 2>/dev/null
   # jq --arg passes $C safely (no shell-quoting injection).
   LAST=$(jq -r --arg c "$C" '.reviewed_up_to[$c] // empty' "$QUEUE")
   CUR=$(git rev-parse origin/main)
   if [ -n "$LAST" ] && [ "$LAST" != "$CUR" ]; then
     # If main was force-pushed (history rewrite) `git log $LAST..$CUR`
     # would error. Fall back to "history diverged" handling.
     if git merge-base --is-ancestor "$LAST" "$CUR" 2>/dev/null; then
       git log --reverse --format='%H %s' "$LAST..$CUR" > "/tmp/_${NAME}_${C}_missed"
     else
       printf 'HISTORY_DIVERGED %s last=%s cur=%s\n' "$C" "$LAST" "$CUR" \
         > "/tmp/_${NAME}_${C}_missed"
     fi
   elif [ -z "$LAST" ]; then
     # No prior pointer (first run). Fall back to "backlog only" mode.
     printf 'NO_PRIOR_POINTER %s\n' "$C" > "/tmp/_${NAME}_${C}_missed"
   else
     : > "/tmp/_${NAME}_${C}_missed"   # LAST == CUR: nothing new
   fi
   ```

   The result per criterion: a list of commit SHAs not yet audited.
   Trigger §3 filter on each; only the in-scope ones become §4
   dispatches.

3. **Compose the resume-suggestion summary** (full-context preamble per
   §4e), then ask the user via `AskUserQuestion` what to do next.
   Standard 4-option chip set:

   ```markdown
   `<watcher-name>` resume — session state:

   | Indicator | Value |
   |-----------|------:|
   | Open queue items (queued + in-progress + needs-author) | N |
   | Unreviewed main commits per criterion (sum across Slot D) | M |
   | Last fully-audited main HEAD (across all criteria) | <SHA[:12]> |
   | Current main HEAD | <SHA[:12]> |
   | Delta | <N commits> |

   Top-3 oldest unaddressed asks: …
   Top-3 highest-severity queue items: …
   Newest in-scope main commit not yet audited: <SHA[:12]> "<msg>"
   ```

   Then the AskUserQuestion:
   - Option A: **Triage unreviewed commits first** (recommended when
     delta > 0 and any are in-scope)
   - Option B: **Continue backlog sweep** (recommended when delta == 0
     or the backlog has needs-author items)
   - Option C: **Dispatch a specific chapter / target** (free-form
     fallback)
   - Option D: **Just watch passively** — arm Monitor, no proactive work

4. **Record on every full sweep.** After §4 scans the **entire** missed
   range `LAST..CUR` under criterion `C`, update `reviewed_up_to[C] =
   CUR` — the scanned-up-to-and-including HEAD, **not** just the newest
   in-scope commit. The pointer advances when the scan is *complete*,
   regardless of how many commits passed §3. After §5 backlog sweep
   completes a block `B`, update `audited[B] = { ts, sha: <main HEAD at
   sweep time>, criteria: [<Slot D criteria checked>] }`.

5. **Resume-suggestion frequency.** Run at session start and whenever
   the user types `/integration-watch resume` or `<watcher>:status`.

The combination of `reviewed_up_to[criterion] +
audited[block].{sha,criteria}` makes the audit ledger fully replayable.

### 5m. Sequential-by-default; parallel agents require explicit consent

**Don't spawn more than one agent at a time without explicit consent.**

**Default rule:** while idle, the watcher does its own work
**sequentially in the foreground** — one backlog item / one PR triage /
one criterion sweep at a time. Foreground reads (`Read`, `Grep`, `Bash`
for inspection) can still run in parallel within a single response; the
constraint is on **agent dispatch** (`Agent(...)` calls).

**Explicit-consent escalation:** if the watcher believes a parallel
batch is genuinely justified, it must (1) surface an `AskUserQuestion`
describing the proposed batch (count, per-agent scope, expected total
wall time); (2) wait for affirmative consent ("continue" / "proceed" /
"go ahead" / explicit `yes`; silence does not); (3) cap the granted
batch at the explicitly-named size (default 4 if the user says "parallel
ok"); subsequent rounds need fresh consent.

**Anti-parallel cases** (always sequential even with consent):

- Anything touching the same `beans/${NAME}-queue.json` write (race).
- Anything touching the same exclusive build lock.
- Anything that depends on a prior step's output (rebase → validate,
  format → lint).
- Tasks where the user is mid-asking.

**Acceptable parallel-without-consent exceptions** (narrow):

- Multiple `Read` / `Grep` / `Bash`-inspection tool calls in a single
  response — these are not agent spawns.
- The §4b QA-specialist dispatch when reacting to an incoming event and
  the specialists are read-only — but if the dispatch would exceed 3
  agents, ask first.

**Default invariant:** in an idle window with K ≥ 2 independent tasks,
the watcher **picks the highest-priority one, works it
foreground-sequential, and ships before reaching for the next.** Batch
consent is the escape hatch, not the default.


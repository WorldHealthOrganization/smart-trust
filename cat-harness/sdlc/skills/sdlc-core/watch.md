---
name: watch
description: Background-watch a branch (default origin/main) or a GitHub PR for new activity while you work, and on every event report whether to integrate / whether it conflicts with the current branch / whether it lets you simplify exposition / proofs / computations
user_invocable: true
---

# /watch — background watcher with integration check

A unified watcher that handles **branches** (poll `git ls-remote`) and
**change proposals** — pull requests, PRs — (subscribe to their activity
through the session platform; subscribing is not a forge operation).  On every event,
walk the §3 integration checklist and either act, defer, or flag the
user.

## Invocation

The user's request maps to one of three modes; pick the right one
without asking:

| user phrase | mode | how |
|-------------|------|-----|
| "watch main" / "watch upstream" / no target | **branch:main** | poll `origin/main` every 5 min |
| "watch PR 516" / "watch the PR" / "watch this PR" | **pr:N** | subscribe to its activity — the session platform's subscription (event-driven) |
| "watch branch foo/bar" / "watch claude/x-y" | **branch:foo/bar** | poll `origin/foo/bar` every 5 min |
| "watch foo/bar PR 42" | **pr:42** + maybe **branch** | subscribe + poll |

If ambiguous, default to **branch:main**.

## 1.  Stash the baseline

Before arming anything, record the current state so the §3 review
compares cleanly:

```bash
# Explicit refspec, ALWAYS. `git fetch origin <BRANCH>` writes FETCH_HEAD and
# refreshes refs/remotes/origin/<BRANCH> only when the clone's configured
# refspec covers it — and exits 0 either way. A baseline read from a tracking
# ref that was never updated is not a baseline.
git fetch origin "+refs/heads/<BRANCH>:refs/remotes/origin/<BRANCH>" 2>/dev/null
# Sanitize branch name for use in a file path: replace `/` with `_`
# (e.g. `feature/foo` → `feature_foo`).  Without this, branches with
# slashes silently land in non-existent directory trees.
SAFE_BRANCH=$(printf '%s' "<BRANCH>" | tr '/' '_')
git rev-parse "origin/<BRANCH>" > "/tmp/_watch_baseline_${SAFE_BRANCH}.sha"
```

For PR mode, instead capture the latest PR head SHA: read PR N with the
*read change proposal* [forge-operation Tool](../../../skills/tools/folio-core/skills-and-tools.md#the-forge-operations-one-tool-node-each) and stash its head commit SHA.

## 2.  Arm the watcher

### Branch mode — Monitor with poll loop

Use the `Monitor` tool, `persistent: true`, 5-minute poll:

```
Monitor:
  description: "origin/<BRANCH> new commits"
  persistent: true
  command: |
    BRANCH="<BRANCH>"
    last=$(git ls-remote origin "$BRANCH" | cut -f1)
    while true; do
      cur=$(git ls-remote origin "$BRANCH" 2>/dev/null | cut -f1)
      if [ -n "$cur" ] && [ "$cur" != "$last" ]; then
        git fetch origin "$BRANCH" 2>/dev/null
        # one line per new commit, oldest first
        git log --reverse --oneline "$last..$cur" | head -20
        last=$cur
      fi
      sleep 300
    done
```

Each new commit becomes one notification line.

### PR mode — activity subscription

Subscribe to the PR's activity through the session platform (in a Claude
Code remote session, its PR-activity subscription). This is not a forge
operation, so no forge Tool node offers it.  Already
event-driven — no polling needed.  The harness delivers
`<github-webhook-activity>` events for comments, CI status, reviews,
and merges.  See the existing PR-subscription guidance in the system
prompt for handling.

## 3.  Per-event integration checklist

For every notification (branch commit or PR event), run through these
**four questions in order** — stop at the first "no" or "no action":

### Q1 — Should we integrate?

- Is the change on a file we touch in this branch?  Quick check:
  `git diff --name-only HEAD <NEW_SHA> -- $(git diff --name-only $(git merge-base HEAD origin/main)..HEAD)`.
- If **yes** and the change is small, rebase / pull now.
- If **yes** but large, defer until the immediate task ships and add
  a TODO.
- If **no overlap**, skip Q2/Q3/Q4 and acknowledge with a one-liner.

### Q2 — Does it conflict?

- Try a dry rebase in a fresh worktree.  Use `mktemp -d` so the
  path is unique (avoids collisions with previous failed runs and
  with parallel `/watch` invocations) and clean up unconditionally
  via `trap`:

  ```bash
  PROBE=$(mktemp -d /tmp/rebase-probe.XXXXXX)
  trap 'git worktree remove --force "$PROBE" 2>/dev/null; rm -rf "$PROBE"' EXIT
  git worktree add "$PROBE" HEAD >/dev/null
  ( cd "$PROBE" && git rebase "origin/<BRANCH>" )
  status=$?
  # trap fires on EXIT
  ```

- Conflicts (`status != 0`) → first attempt **auto-resolve** for
  the recurring drift-conflict pattern (see §2a below); only flag
  the user if auto-resolve fails or the conflict is non-trivial
  (overlapping logic edits, schema rewrites, etc.).

#### §2a — Auto-resolve drift-conflict pattern (CI-regenerated artifacts)

Some artifacts (`*.witness.json` sidecars, generated caches, derived
reference files) are routinely regenerated by the CI validate job and
frequently conflict on rebase against fast-moving `main`.

These conflicts are **always** the same shape: our branch's
committed artifact was regenerated against an older main; main now
has a fresher version. Resolution is mechanical: regenerate
against current main and recommit.

The recipe (run on the **real** branch, not the probe worktree):

```bash
# When `git rebase origin/<BRANCH>` halts with a regenerated artifact
# in the conflict list, do NOT hand-merge the JSON. Instead:

# 1. If the conflicting commit was a pure regen of these generated
#    artifacts (no other changes), skip it — main already has the regen:
git diff --name-only --cached | grep -qE '\.witness\.json$' && \
  ! git diff --name-only --cached | grep -vE '\.witness\.json$' && \
  git rebase --skip

# 2. Otherwise, abort the rebase, regenerate the artifacts
#    on the rebased branch, then re-rebase. This produces a clean
#    apply because the regenerated artifact now matches main.
git rebase --abort
git rebase origin/<BRANCH>   # re-rebase, skipping bad commits as above
# regenerate the affected artifacts via the project's generator(s), e.g.
bun run cat regen
git add <regenerated-artifact-paths>
git commit -m "Regen generated artifacts post-rebase against latest main"
git push --force-with-lease
```

Only flag the user if:

- The conflict is in a **source file** (`.py`, `.lean`, `.ts`,
  `.md`) — those are real semantic conflicts that need human
  judgment.
- The conflict is in a generated artifact whose regenerated content
  differs **substantively** from a simple drift (e.g. a numerical
  value changed, not just a timestamp/hash) — that means a CI-run
  generator on main produced different output, which deserves a
  closer look before blindly accepting.
- The auto-resolve recipe itself fails (regen script errors out,
  push rejected for non-fast-forward reasons, etc.).

For generated artifacts specifically: if upstream regenerated files
our branch also touched, prefer **rebase-and-regenerate** over
hand-merging.  Drift is structural; merging is fragile.

### Q3 — Can we reuse?

Apply four reuse questions:

1. **Definitions / lemmas / helpers / witnesses** — does the new
   commit add something our branch is duplicating, paraphrasing, or
   reinventing?  Replace with `uses[]` / a citation and delete the
   local stand-in.
2. **Proofs** — does a new lemma or tactic discharge a hypothesis,
   collapse a chain, or close a gap?  Apply via the project's
   proof-simplification / build-fix skills.
3. **Exposition** — does our `.md` re-derive what main now defines
   upstream?  Replace with a forward-reference; route through the
   project's accuracy / readability skills.
4. **Computation** — does a new script or witness supersede a
   hand-rolled loop or stale witness in our branch?  Swap in and
   regenerate the artifact. (See §2a for the routine drift-conflict
   pattern.)
   - When the upstream commit adds or modifies a `prop:` / `thm:` /
     `lem:` / `cor:` block (or its sibling formalization), delegate to
     the project's compute-integration watcher to check whether the new
     claim is wired into the production compute chain. Capture the
     verdict here and feed it into Q4.

### Q3a — Did upstream land a new skill file?

For each main-refresh, check whether a skill directory the layer declares
in its `kg` graph (`skill_list` names them) gained a new file between this
branch's prior baseline and the new `origin/main`:

```bash
git diff --name-only --diff-filter=A "$LAST_BASE..origin/main" -- <skill-dirs>
```

For each new skill file:

1. **Read its frontmatter** — extract `name`, `roles`, `description`,
   and any `inherits` field.
2. **Match against branch scope** — does the skill's description
   overlap with what this branch is doing? Heuristics:
   - skill description mentions a file kind / domain / pattern
     that appears in this branch's `git diff origin/main..HEAD
     --name-only`, OR
   - skill is a new integration-watcher child (`inherits:
     local/integration-watcher`) and your branch is itself an
     integration-watcher PR, OR
   - skill is a content-block QA skill (e.g. `one-voice-*`,
     `proof-*`, `compute-*`) and your branch touches `.md` /
     `.ts` / `.lean` content blocks.
3. **Surface to the user via `AskUserQuestion`** with the standard
   3-chip pattern:

   > New skill `<name>` landed on main:
   > > `<one-line description from frontmatter>`
   >
   > This branch's scope overlaps because `<one-line match
   > rationale + file paths>`.
   >
   > 1) **Adopt now** — invoke the skill on the relevant subset of
   >    this branch's diff before continuing.
   > 2) **Defer to follow-up branch** — record the decision and
   >    note for the next branch; don't change this branch.
   > 3) **Not relevant** — record so the watcher doesn't re-prompt
   >    on future main-refreshes.

4. **Record the decision** as a note on the watcher's work item (or in chat for
   the bare `/watch` flow) so subsequent main-refreshes don't re-prompt for
   the same skill.

This rule applies to **skill files only**. Skills landing on sibling PRs that
haven't merged yet do NOT trigger this check — only `main` commits
count, mirroring the §2 "watch origin/main" scope.

### Q4 — Report or act?

- **Acted** (made the change):  one-line summary + the new commit SHA.
- **Will act after current task**:  add a TODO with what + why.
- **Skipped**:  one-line reason ("no overlap", "blocked on $TASK").

## 4.  Stop the watcher

Stop when the branch ships (PR merged, or you switch branches):

- Branch mode:  call `TaskStop` on the Monitor task ID.
- PR mode:  the harness auto-unsubscribes when the PR merges/closes;
  otherwise unsubscribe through the session platform.

## 5.  Common upstream patterns (heuristics)

- **Artifact drift**: upstream regenerated generated artifacts
  (`*.witness.json`, caches) while we also modified them →
  rebase-and-regenerate, never hand-merge.
- **Toolchain version bumps**: a dependency/toolchain hash changed →
  check our branch's toolchain pin aligns before continuing a build.
- **Schema or generator changes**: run `bun run cat regen` before
  continuing.
- **Routine review-cycle commits** (Gemini/Copilot fixes on unrelated
  PRs):  almost always Q1 = no overlap = skip with one-liner.

## 5b.  Monitor-timeout recovery (MANDATORY when re-arming)

Background Monitors time out (`[Monitor timed out — re-arm if needed]`).
**Do not just re-arm and continue** — between the last event and the
timeout, main may have moved substantially. Mandatory steps on
timeout-recovery:

```bash
# Compare the stashed baseline against the WATCHED BRANCH's actual head.
#
# This fetched `main` and then measured `origin/<BRANCH>` — a different ref
# from the one it refreshed. The recovery step that exists to catch what was
# missed while the watcher was down therefore compared the baseline against a
# tracking ref nothing had updated, found them equal, and reported 0 missed
# every time. Fetch the ref you are about to read, with an explicit refspec so
# the tracking ref is actually written.
git fetch origin "+refs/heads/<BRANCH>:refs/remotes/origin/<BRANCH>" 2>/dev/null
SAFE=$(echo "<BRANCH>" | tr '/' '_')
LAST=$(cat /tmp/_watch_baseline_${SAFE}.sha 2>/dev/null || echo "")
CUR=$(git rev-parse origin/<BRANCH>)
if [ "$LAST" != "$CUR" ]; then
  MISSED=$(git log --oneline "$LAST..$CUR" 2>/dev/null | wc -l)
  echo "MISSED $MISSED commits while watcher was down"
  git log --oneline "$LAST..$CUR" | head -10
  # Update baseline AFTER reporting
  git rev-parse origin/<BRANCH> > /tmp/_watch_baseline_${SAFE}.sha
fi
```

If `MISSED >= 5` OR any missed commit touches a file in your branch's
diff, run the §3 integration checklist on the missed range BEFORE
arming a fresh monitor.

This catches main moving many commits ahead during a long focused session
while the watcher is timed out.

## 6.  Output style

Follow [`interaction-modality`](../../../skills/conduct/conduct-core/interaction-modality.md):

- One sentence per commit / event by default
- Numbered choices when integration is non-obvious
- Run small fixes proactively; flag big ones

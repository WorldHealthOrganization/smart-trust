---
# folio-assistant-0s6w
$schema: bean/1.0.0
title: 'MERGE VERIFICATION: reading merge-tree''s rc through a command substitution reports the WRONG exit status, and it reads as clean'
status: completed
type: bug
priority: normal
created_at: 2026-10-03T02:07:04Z
updated_at: 2026-10-04T06:03:36Z
parent: folio-assistant-hfag
---

A merge steward verifies mergeability with `git merge-tree --write-tree` and reads the exit
code: **rc=0 clean, rc=1 CONFLICT, rc>=2 an ERROR that is not clean**. On 2026-10-03 that
read was wrong for a whole session, in one specific shell form, and it reported **clean**.

## The defect

```sh
git merge-tree --write-tree origin/main "$sha" >/dev/null 2>&1
echo "merge-tree rc=$?"                                                   # CORRECT
echo "merge-tree vs main($(git rev-parse --short origin/main)) rc=$?"     # WRONG — always 0
```

Bash expands the whole word before running `echo`. The command substitution
`$(git rev-parse …)` **runs a command**, and that resets `$?`. So the second form reports
`git rev-parse`'s exit status — which is 0 whenever the ref exists — and never
`merge-tree`'s.

The failure is silent and confident. It does not print a warning or an empty value; it
prints `rc=0`, which is the exact string a steward is looking for.

## Measured consequence

PR #1939 was declared clean on that form and the merge was then **refused by GitHub with
HTTP 405, "Pull Request has merge conflicts."** Re-measuring with the correct form against
the same base gave **rc=1 with three conflicts** — `beans/README.md`,
`cat-harness/docs/_data/harness.json`, `cat-harness/docs/assets/library/index.json`.

**No bad merge resulted, and the reason matters: GitHub's merge API is an independent
gate.** It refuses a conflicted merge whatever the client believes. So the only thing
standing between a mis-read `rc` and a wrong merge was the forge, not the steward's own
check. The same session used the correct form on #1894, #1942 and #1944, and the broken
form on #1946 and #1939; #1946 merged, so it was genuinely clean — confirmed by the forge
accepting it, not by the check.

## Why this is worth a bean rather than a habit

It is the `1xhc` shape applied to a steward's instrument rather than to a gate: **a check
that cannot answer emitted a plausible answer.** Every other instance recorded in this
corpus emits nothing and is read as clean; this one emits `rc=0` and is read as clean. That
is strictly worse, because there is no silence to notice.

It also generalises past `merge-tree`. Any `rc=$?` preceded in the same word by a command
substitution has the bug — a timing `$(date)`, a sha `$(git rev-parse …)`, a count
`$(wc -l < f)`. That is a common shape in a status line.

## Done when
- [x] the shell rule is written where a steward reads it before verifying a merge — `$?`
      must be captured into a variable on the line AFTER the command, before any other
      command runs, including one inside a substitution
- [x] the merge-pipeline scripts are checked for the same shape (`merge-train.ts`,
      `merge-overlap.ts`, `merge-leftover.ts`, `bean-rollover.ts`, `mvp-status.ts` read
      `rc` from `spawnSync` rather than a shell, so they are likely clean — VERIFY rather
      than assume)
- [x] a NEGATIVE control recorded: a known-conflicted pair whose rc must read 1, so a
      future change to the reporting cannot silently reintroduce a constant 0
- [x] stated plainly that GitHub's 405 is a backstop and not a substitute: a steward who
      relies on it learns of a conflict only at merge time, after announcing the PR clean

## Summary of Changes

- **Rule written** in `skills/sdlc/sdlc-core/prepare-merge.md`, where a steward reads it before verifying a merge: capture `$?` on the line after the command; both trap shapes named; GitHub's 405 stated as a backstop, not a check.
- **Scripts verified, not assumed — and one was wrong.** `merge-train.ts` (`parseMergeTree`), `merge-overlap.ts`, `merge-leftover.ts`, `bean-rollover.ts` read status from `spawnSync` and are clean. **`mvp-status.ts` was not:** git 2.43 exits **1** for a ref it cannot merge (unfetched, mistyped) with NO tree on stdout, and `conflicts()` read code 1 as 'conflicted' with zero paths — so an unfetched PR head counted as no contention instead of undetermined. Fixed: the merged tree's id on stdout's first line decides. The contract this bean opened with (rc>=2 = error) is itself wrong for that case.
- **A live instance of the shell trap, fixed:** `publish-gh-pages.sh` did `if ! restore-staging …; then rc=$?; …; exit "$rc"` — `$?` there is `! cmd`'s status, 0, so a refused publish exited 0 (a green step that published nothing). Now `cmd || rc=$?`. It was the only instance among tracked scripts and workflows.
- **Negative controls:** `merge-train.test.ts` builds a known-conflicted pair (must read 1 with its path), an unmergeable ref (must parse to undefined in both parsers), and the shell trap itself (wrong form prints rc=0 where the right one prints rc=1). `shell-exit-status.test.ts` fails on either trap shape in any tracked .sh or workflow. Mutation-checked: removing the tree guard, or restoring the old publish script, each fails a test.

## The same root in a second shape — a COMPOUND command's exit status

2026-10-03, while absorbing `main` into #1943. The regeneration was launched as

```sh
bun run cat regen > log 2>&1; RC=$?; echo "REGEN_EXIT=$RC" >> log; tail -20 log
```

and the harness reported **"completed (exit code 0)"**. `bun run cat regen` had
exited **1** — `Cannot find module '../../bootstrap-tools/schemas/graph'`,
because a fresh `git worktree` does not populate submodules. A shell's exit
status is its LAST command's, so the status that reached the caller was
`tail`'s, and the failing build was announced as a success.

This is this bean's defect, not a new one: a status read from the wrong
command. The original shape takes it from a command substitution inside the
same word (`echo "rc=$(cmd) ... $?"`); this shape takes it from the last link
of a `;`-chain. In both the number is well-formed, plausible and about
something else — which is why neither is caught by reading the output.

**The rule covers both and is one sentence:** the status must be the only thing
the command produces, or it is not that command's status.

```sh
# wrong — reports `tail`'s status
cmd > log 2>&1; echo done; tail log
# right — nothing after it, and the status is re-raised deliberately
cmd > log 2>&1
RC=$?
exit $RC
```

Re-running it that way gave the true `REGEN_EXIT`, which is how the submodule
failure was found at all.

Measured here, unchanged: no `.ts` script in this repository reads a status
this way — they all use `spawnSync` and read `.status`. The exposure is in
**shell invocations an agent composes in a turn**, which no gate sees, so this
entry is the whole mitigation and the reason it is written down.

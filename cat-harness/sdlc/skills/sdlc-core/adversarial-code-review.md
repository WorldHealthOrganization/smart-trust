---
name: adversarial-code-review
description: >
  Review a pull request an agent touched by building the strongest case that it
  is wrong, unsafe, or not what it claims, and record the verdict where the
  merge gate reads it: one `merge-review/v1` file per head, on the
  `merge-reviews` state branch, never in the pull request itself. Covers who
  may review, what the whole-diff scope is, the RED FLAG categories and their
  evidence rule, the one rebuttal round, overrides, and how a per-head verdict
  composes with a merge train.
allowed-tools: Read Bash Grep Glob
---

# Adversarial code review

The `Task_Review` step of
[`code-change-review.bpmn`](../../processes/code-change-review.bpmn),
for a change an agent touched. Its verdict is what `check:adversarial-review`
reads. The gate is warn-only: a missing, stale or failing verdict is reported,
not blocking, until an owner promotes the gate.

## Who may review

**Not the author.** A different session id from every `Claude-Session:` /
`Agent-Session:` trailer on `merge-base..head`; a different model family when
one is configured. The gate checks the session, and refuses a verdict that does
not record the reviewer's session and model.

## The stance

*Construct the strongest case that this change is wrong, unsafe, or not what
it claims.* It is the stance of [`generalise-the-fix`](generalise-the-fix.md)
and `devils-advocate-watcher` (opt-in `cat-harness.editorial`),
applied to a diff. The claim under test is the
pull request's description and the `## Done when` of the work item it names.

## Scope: the whole diff, or `unknown`

1. Review `git diff <merge-base>..<head>`, file by file. Count every changed
   file into `coverage.files_total`.
2. A generated file that a check reproduces may be skipped, **by name**, in
   `coverage.skipped` with its reason. Nothing is skipped silently.
3. If you cannot read the whole diff, set `coverage.truncated: true` and
   `result: "unknown"`. Never `pass` on part of a diff.

## What you look for

The RED FLAG categories are closed and live in `schemas/sdlc/red-flag.ts`:
`security`, `data-loss`, `correctness`, `false-green`, `provenance`,
`scope-breach`, `irreversible-action` and `licence`. Read the definitions
there rather than from a copy. Beyond the categories, ask:

- can a new or changed check report green without evaluating its subject?
- does prose (a skill, the PR body, the work item) assert something the code does
  not do? That is [`narrative-asserts-code`](narrative-asserts-code.md);
- does the change reach outside its work item, or hand-edit a generated file?

**A finding is blocking only with evidence**: a reproducible observation, such
as an input and its wrong output, or a command and what it printed. Without
one it is recorded as a `suggestion`. The author may answer each flag once;
then the verdict is final.

## Recording the verdict

The verdict lives on its own state branch, **never in the pull request**.
Committing it into the pull request moves the head it names, which makes it
stale at once.

1. `bun run cat state:mount` mounts the `merge-reviews` graph at
   `merge-reviews/`.
2. Write `merge-reviews/<head sha>.json`, a `merge-review/v1` document:
   `pr`, `repository` (`owner/repo`, so the store's viewer can link the pull
   request), `base_sha`, `head_sha` and `reviews[]`. Each review records:
   - `reviewer {by, session, model}`;
   - `author_sessions`, from the trailers;
   - `skill_hash`, the sha256 of this file as you ran it;
   - `at` and `coverage`;
   - `result` (`pass`, `fail` or `unknown`);
   - `flags[]`, each with `id`, `category`, `severity`, `weight`, `where`,
     `evidence` and `status: "open"`.
3. Push with `bun run cat state:push`, never `git push` from the mount.
4. Check it: `bun run cat check:adversarial-review --head <sha> --base <base>`.

A push to the pull request after the review leaves the verdict naming a commit
that is no longer the head. The gate reports that as `stale`, and the review
runs again on the new head.

## Overrides

A flag is never deleted. A person with standing overrides it with a
`qa-review` decision (who, when, why, flag id), which sets
`status: "overridden"`. The gate passes `resolved` and `overridden` flags and
holds on `open`.

## In a merge train

A review is per **head**, because it reviews a change, not an accident of
batching. A pull request in a [`merge-queue`](merge-queue.md) train keeps the
verdict on its own head; a pull request taken out of the train keeps it too,
because its head did not move. A conflict resolved **by hand** while building
the train is a change of its own and needs its own review. The compile gates,
not the review, run again on the train's combined result.

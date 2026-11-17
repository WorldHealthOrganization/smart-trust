---
name: render-logging
description: >-
  Log every render to the publish branch — what was published, removed,
  restored or deliberately retained — to an append-only log that lives beside
  what it describes. Use when adding or removing anything on `gh-pages`, when
  asking "what happened to this preview", or before writing a workflow step
  that deletes a published artefact.
agents:
  - platform-boundary-guard
  - ci-health-watcher
---

# Render logging — the publish branch keeps its own history

## The question it exists to answer

> **What happened to `branches/<slug>`, and why?**

A preview can be cleaned up because its pull request closed, removed by a
dispatch somebody confirmed, or deleted by an unrelated merge to `main`.
Without a record on the publish branch itself, which one happened is not
recoverable.

## Append-only, and never anything else

A removal is a **new entry**, not the erasure of an old one. The pair — the
`rendered` and the `removed` that follows it — IS the history.

`scripts/render-log.ts` offers no verb that could lose an entry: no
`--remove`, no `--edit`, no id to overwrite. The never-delete property is a
shape of the tool, so a caller cannot be written wrongly.

**Emptying a log is a person's decision**, taken deliberately, with the
confirmation every durable artefact here requires
([`deletion-requires-confirmation`](../../conduct/conduct-core/deletion-requires-confirmation.md)). No
tool and no workflow does it.

## The four events, and why `retained` earns its place

| event | what it records |
|---|---|
| `rendered` | published, or re-published over itself — so "when was this last built" needs no commit archaeology |
| `removed` | taken down. **Requires a reason**, refused without one |
| `restored` | carried across a full-replace deploy by `restore-staging`. Its own event, because "somebody pushed this branch" and "an unrelated merge nearly deleted it" are different facts |
| `retained` | a removal was **considered and refused**. Also requires a reason |

`retained` answers *"why is this still up"*: a preview still standing because a
liveness signal fired leaves no trace otherwise.

## Where it lives, and why that is structural

`_render-log/<YYYY-MM-DD>.jsonl`, at the **root of the publish branch**.

**Outside `branches/`, deliberately.** The cleanup runs
`rm -rf "branches/$SLUG"`, and a branch named to collide with a directory under
`branches/` slugifies to exactly that name. A store outside `branches/` is
unreachable by that command whatever the slug says; a guard you have to
remember is weaker than a location that cannot be reached.

**One file per UTC day**, not one growing file and not one per entry. Six
workflows publish to this branch; a read-modify-write of a single file loses
whatever landed in between, and the tool appends a line rather than rewriting.
One file per entry would make "what happened this week" a directory walk.

## It does NOT survive a deploy on its own — this is the part to get right

`docs-site.yml` is a **full replace**: `git rm -r --ignore-unmatch '*'` over
the whole branch, then copies `_site` in. It is the only one of this
repository's six `gh-pages` publishers without `keep_files: true`, and it is
the one that fires on every push to `main`.

So **the log is carried across that deploy by `restore-staging.ts`**,
unconditionally — not gated on open pull requests the way previews are. A
preview belongs to an open PR; a log entry about a *closed* one is exactly
what nothing would carry, and exactly what a reader needs most. A log a
deploy truncates is worse than no log, because a reader will believe its
entries persisted.

`docs-site.yml` runs `restore-staging.ts` **from `main`**, so a change to what
the restore carries is not in force until it merges.

**`--verify` checks the carried prefixes as well as `branches/`**, because a
verifier blind to half of what the restore carried reports a clean run over
the loss it exists to catch. A lost
prefix is reported as **not recoverable by re-running anything**: a preview can
be rebuilt from its workflow, and a record of what was already removed
cannot.

Only the prefixes the restore reported as `carried` are verified. A determined
`absent` was never there to lose, and asserting on it would fail every deploy
before the first entry is ever written.

`CARRIED_PREFIXES` is where that is declared; it is a **list**, so another
carried store is a new row, not a new code path. The carry runs **before** the
preview check, so the log is carried even when there are no previews.

A carry that could not be determined is **not a warning**. It collapses into
the restore's own `unknown`, exit 2, which fails the deploy step: continuing
would run the full replace and delete the record. A determined *absence* — the
branch is readable and has no log yet — is reported rather than omitted,
because "there is no log yet" and "the carry never ran" look identical in a
silent report and only the second is a defect.

## Who writes an entry

Every path that can change `branches/` writes one, and
`scripts/tests/workflow-yaml.test.ts` asserts that by job rather than leaving
it to be remembered:

| path | event | how it lands |
|---|---|---|
| `feature-staging.yml` → `stage` | `rendered` | the **same commit as the deploy**. The entry goes to the root `_render-log/`, never into `_site`, which would land it at `branches/<slug>/_render-log/` — inside the directory a cleanup removes |
| `feature-staging.yml` → `stage`, preview cap | `removed`, one per rotated preview | the **same commit as the deploy**, written by `staging-rotate.ts`; the reason names the size budget, and the summary gives slug, age and size |
| `feature-staging.yml` → `cleanup`, confirmed | `removed` | the **same commit as the removal** |
| `feature-staging.yml` → `cleanup`, refused | `retained` | its own commit |
| `feature-staging.yml` → `cleanup-dispatch` | `removed` | the **same commit as the removal** |
| `docs-site.yml` → restore | carried, not written | `restore-staging.ts` |

**The reason is the gate's own, never a restatement of one branch of it.**
`cleanup` emits `merged | labelled | closed-unmerged-and-unlabelled` and the
entry carries that value. A hardcoded reason would name the wrong rule for some
of them, and a wrong reason reads as evidence.

**A removal and its record are one commit.** A separate log push can fail on
its own and leave a preview that vanished with nothing saying why.

**The `rendered` and `retained` entries are `continue-on-error`.** A preview
that deployed and whose entry did not is a gap in the record, not a failed
deploy, and failing the job there would turn a logging problem into a lost
review surface. The step goes red in the run, so the gap is visible. A
`removed` entry has no such fallback and needs none: it cannot fail separately
from the removal it describes.

## Writing an entry

```sh
bun run cat-harness-tools/scripts/render-log.ts --dir <gh-pages-checkout> \
  --event rendered --kind staging-preview --path branches/<slug> --slug <slug> \
  --summary "preview published" --branch "$BRANCH" --commit "$SHA" --run "$RUN_URL"
```

The tool **writes into a directory and never pushes**. The workflows that call
it already hold a `gh-pages` checkout with their own retry and concurrency
handling; a second pusher racing those is a new way to lose a deploy. One job
knows how to push, this one knows what to write.

Reading back: `--read [--day YYYY-MM-DD]`. It **exits 1 when any line could
not be read**, and prints which — a short count must be visible as short,
never passed off as complete. Same rule as
[`ci-health`](../../process/process-core/ci-health.md): could-not-determine is never rendered as clean.

## A path is checked by VALUE, never trusted by provenance

`--path` is refused unless it is `/` or a sequence of plain segments — no
`..`, no leading `/`, no backslash.

The staging slug sanitiser **can** emit `..` (input `..` gives output `..`),
and is safe only because git rejects every ref name containing it. That invariant holds for a slug taken from a ref and **does not hold** for
one taken from a dispatch input — and `cleanup-dispatch` takes exactly that.
So the check is on the value, not on where it came from.

## It is a specialisation of `folio-log/v1`, not a rival

`schemas/sdlc/log-entry.ts` already answers "what does an entry look like", and a
render entry reuses those spellings: `id`, `at`, `summary`, `detail`,
`references`, `capture`. Three things differ, each deliberately:

| | activity log | render log |
|---|---|---|
| subject | what an **agent** did | what was **published** |
| store | `fsh-guts/logs/`, in the repo | the publish branch |
| published | **no** | **yes** |

An agent's audit trail is not published; a record of what is on the publish
branch belongs where its subject's absence can be seen.

## Related

| | |
|---|---|
| the process | [`staging-render-log.bpmn`](../../../processes/ui/staging-render-log.bpmn) |
| the entry shape it specialises | `schemas/sdlc/log-entry.ts`, `sdlc/skills/sdlc-core/activity-log.md` |
| how the publish branch keeps the log across a deploy | `scripts/restore-staging.ts` |

---
# folio-assistant-mjl3
$schema: bean/1.0.0
title: 'artefact-verification.json merges are CORRECTLY refused and must stay refused: it reads like a generated sidecar, has no writer, and carries authored reasons'
status: completed
type: task
priority: normal
created_at: 2026-10-03T17:41:35Z
updated_at: 2026-10-07T06:31:00Z
parent: folio-assistant-d33q
---

A **preventive** record, not a defect: this bean exists so the next agent that
meets this refusal twice does not "fix" it by widening a glob — which is the
mistake `merge-conflict-patterns` names in its own opening and which I came within
one step of making.

## Where it came from

Swept the merge-main bot's refusals across all 13 open `merge-main` PRs on
2026-10-03, while #2029 added the one real gap (`prov-qaqc`). Five PRs refused, on
six distinct paths. `cat-harness/scripts/artefact-verification.json` is the **only
one that recurs** — #1958 and #1955 — so it is the one that looks like an omission.

## Why it is not

It reads like a generated sidecar: under `scripts/`, a `.json`, keys derived from
`package.json`. Two facts, read rather than inferred, rule out a `take-base`:

- `cat-harness/scripts/task-io.ts:109` classifies `check:artefact-verification` as
  `READ_ONLY`. **No script writes this file.** A pattern's `regen` step runs the
  stale check's writer; there is none, so `take-base` here is a silent *discard*,
  not a resolution.
- Its own `_comment` requires every `none` entry to carry **a reason, in prose**,
  and states the file *"may only SHRINK as entries move from `none` to `verified`"*.
  A branch that adds a gated check adds an authored sentence. Taking base drops
  exactly that sentence.

So a two-branch conflict here is a genuine editorial merge: both reasons are wanted,
and which survives is a judgement. **Human merge is the correct cost of the file's
shape**, not a hole in the catalogue.

## The one thing that would change this

If a writer is ever added — a `--write` that composes the derived key set and
carries forward existing reasons — then the file becomes regenerable and a
`take-base` + `regen` pattern becomes correct. That is the falsifier, and it is a
change to `check-artefact-verification.ts`, not to the catalogue.

## Done when

- [x] the reasoning above is reachable from the catalogue itself, so a sweep finds
  it without re-deriving: a comment in `merge-conflict-patterns.ts` naming this
  path as deliberately unlisted, with the two facts and this bean id
- [ ] (not this bean) if a writer is added, the pattern is added with it

The second item is deliberately left open rather than scheduled: nothing today
wants a writer, and inventing one to make merges cheaper would be adding a
mechanism to serve the merge tool rather than the gate.

_2026-10-07T04:31:18Z_ — Claimed by claude/mjl3-close-landed-artefact-verification — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Evidence
- Landed on `main` in commit `832a7f354698fdeb3cfd5a1f66604d710c4ece97`: declared `id: "artefact-verification"` in `cat-harness/scripts/merge-conflict-patterns.ts` as a named refusal with `strategy: "refuse"`, explaining the two facts (READ_ONLY in `task-io.ts`, authored prose reasons) and referencing bean `mjl3`.
- Tested in `cat-harness/scripts/tests/merge-base.test.ts` (`artefact-verification.json refuses BY NAME, which an unclassified path does not`), re-verified passing via `bun test cat-harness/scripts/tests/merge-base.test.ts -t "artefact-verification.json refuses BY NAME"`.

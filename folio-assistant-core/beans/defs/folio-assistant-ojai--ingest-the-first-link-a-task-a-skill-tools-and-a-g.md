---
# folio-assistant-ojai
$schema: bean/1.0.0
title: 'INGEST: the first link — a Task, a skill, Tools and a generated page for how a file REACHES uploads/'
status: completed
type: feature
priority: normal
created_at: 2026-09-30T00:00:23Z
updated_at: 2026-10-07T20:30:00Z
parent: folio-assistant-slw1
---

Owner, 2026-09-29: *"generate documentation from Tool documentation of the
upload Task/Skill as first step of document ingestion process."*

## Brief — what, why, what is known, how, what would falsify it

**What.** Build the chain the owner asked for, whose first link is missing.
There is no Task, no skill and no Tool for the act of *putting a file into
`uploads/`*, so there is nothing for a generated page to be generated FROM.

**What is known, with provenance** (all re-measured on this branch,
2026-09-29/30, not quoted from prose):

| fact | how measured |
|---|---|
| `document-ingestion.bpmn` starts at `StartEvent_Dropped`, *"A file lands in uploads/"* — an EVENT; its first activity is `Task_Detect` | read the file |
| `document-intake` triggers on *"User drops a file into `uploads/`"* | `skills/authoring/folio-paper-adapter/document-intake.md` |
| the ingest Tools take a file already present — *"The upload to ingest, under the declared `uploads` graph"* | `cat-harness/tools/index.ts`, `ingest-stdlib` / `ingest-extended` |
| three commits in the whole history added files to `uploads/` through the GitHub web UI: `c8349950fa5`, `f4ddfc65c8d`, `b8549160bb1` — each author `Carl Leitner`, committer `GitHub`, subject `Add files via upload` | `git log -- cat-harness/uploads uploads`, then `git log -1 --format` per commit |
| `c8349950fa5` has ONE parent, `9698eff0f87`, itself a merge of PR #1493 — so it was committed straight onto `main`, skipping the PR where CI runs | `git log -1 --format='%P'`, `git log --oneline -3` |
| the web UI commits to the path being VIEWED, so at the repo root the files land at the root rather than in the declared queue — 11 files / 17.2 MB once did | bean `eq01` (completed), re-read today |
| no recorded `document-ingestion` workflow instance exists | `grep -l document-ingestion beans/workflows/*.json` → none; the six instances are `Process_CRDM` and `Process_CodeChangeReview` |

**How.** Four layers, in the order the chain needs them: a first Task in the
BPMN; a skill governing the arrival routes; Tool node(s) for the act; a
generator that renders the Tool documentation as a page, with `--check`, in the
gate set.

**What would falsify the approach.** Two things, both checked rather than
assumed. (1) A recorded instance of `document-ingestion` past `Task_Detect`
would mean inserting a step ahead of it invalidates committed state — then the
right answer is to report and stop. Checked: none exists. (2) The owner named
three arrival routes. If "handed to an agent in a conversation" is not a
mechanism but a PERSONA performing one of the other two, forcing three rows
would put a fiction in a skill. Measured below.

**Not doing.** Not touching the five existing `callActivity` subprocesses, not
changing `document-intake` (it governs what happens after arrival, correctly),
not re-deciding where `uploads/` lives (`eq01` settled that), and not adding a
`dropbox`-style ingress.

## Done when

- [x] `document-ingestion.bpmn` carries a first activity between the start
      event and `Task_Detect`, with both a `skill ref` and a bean op, and
      `render:bpmn:check` is green
- [x] a registered skill governs the arrival routes, `skill:register:check` green
- [x] Tool node(s) in the `tools` graph carry the documentation
- [x] a generator with `--check`, in the gate set, renders that documentation
- [x] `bun run cat gates` green

## Completed on landed evidence

- Implementation landed on `main` in PR #1533 (commit `b88d3eacfbf5`): first ingestion link documented and generated with `document-ingestion` task, skill, and tools.
- Verified on `origin/main`.

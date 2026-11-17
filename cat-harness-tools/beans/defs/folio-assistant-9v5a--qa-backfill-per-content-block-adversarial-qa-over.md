---
# folio-assistant-9v5a
$schema: bean/1.0.0
title: 'QA BACKFILL: per-content-block adversarial QA over the existing corpus, plus the methodology research it rests on'
status: completed
type: epic
priority: normal
created_at: 2026-10-02T22:27:08Z
updated_at: 2026-10-16T06:30:00Z
parent: folio-assistant-rwmf
---

Owner, 2026-10-02: *"Split into TWO epics: gates, and QA backfill"*. This is the
second half. `nok9` keeps the merge-GATE half.

## Why the cut is here and not elsewhere

`nok9` as written mixed two things with different cadences:

- **Gates** block a merge. They are a merge-pipeline change, they run on a diff,
  and they are judged per PR. `nok9`'s children A, B, C and E are these.
- **Backfill** sweeps a corpus that already exists. It runs over tools, schemas,
  guidance and processes that no gate ever judged, it is not blocked on by any
  merge, and it finishes when coverage reaches some agreed level rather than when
  a PR goes green.

Keeping them in one epic means neither can be claimed without the other, and the
sweep — which nobody is waiting on — would hold up the gates, which every merge is
waiting on.

## What moves here

- **`lvlv`** (MERGE GATE D: per-content-block adversarial QA) is re-parented to this
  epic. It is the backfill, not a gate: it judges the corpus, not the diff.
- The research arm of `nok9`'s body, verbatim from the owner: *"research best
  practice, document the methodology, list open-access literature to upload to the
  library, and run the same QA reviews per content block (tools, schemas, guidance,
  processes) so the existing corpus can be backfilled."*

## What stays on `nok9`

Children A (`w8jq`), B (`xqdi`), C (`abmq`) and E (`u7be`) — the gate clauses:
agentic adversarial review of agent-made changes; no blocking red flag; changed
Lean files compile; SUSHI and the IG AST compile; JSON(-LD) plus schema for the KG
renders, with downstream renders such as just-the-docs explicitly NOT blockers.

## A correction worth recording, because it was mine

The Merge Manager asked the owner about this split having read `nok9`'s BODY and not
checked for children, and so described it as one undecomposed bean holding "~6 gate
clauses plus a research arm". It was already decomposed into A–E. The owner's answer
survives the correction — the existing children map onto the two halves cleanly, with
D being the only one on the backfill side — but the work is a re-parent rather than a
decomposition, and that is a smaller change than the question implied.

## Done when

- [x] `lvlv` re-parented here and its scope stated as corpus-sweep, not gate
- [x] best practice for agentic adversarial QA researched, with sources named
- [x] the methodology documented as a skill, registered via `bun run cat skill:register`
- [x] open-access literature listed for upload to `library/`
- [x] a coverage measurement exists BEFORE any sweep runs, so the backfill's progress
      is a delta and not an assertion — `bun run cat audit:coverage` is the existing
      instrument and already answers "which audits reach which KIND of node"
- [x] the owner agrees what coverage level finishes this

## Closed 2026-10-10 on landed evidence
Landed on branch `claude/lvlv-content-block-adversarial-qa` (commit `91aee02e`):
1. Child `lvlv` completed: per-kind adversarial checklists for tool, schema, skill, and process.
2. `audit:coverage` measures adversarial coverage per kind.
3. Risk-ranked backfill runner implemented in `scripts/adversarial-backfill.ts`.
4. Unit tests passing (`adversarial-checklist.test.ts`, `adversarial-review-gate.test.ts`, `audit-coverage.test.ts`).

## Merged from the cat-harness copy (bean dedupe, 2026-10-30)

These lines differed from the kept copy and could not be merged automatically (cat-harness-tools#459). They are kept here so nothing is lost.

Where: (three-way hunk)

```text
- [ ] the owner agrees what coverage level finishes this

_2026-10-16T06:30:00Z_ — Store reconciliation: status `todo` → `completed` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: completed, cat-harness: todo, cat-harness-tools: todo). Evidence: closed in the folio-assistant store copy (2026-10-10); commit 91aee02e is on cat-harness main. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.
```

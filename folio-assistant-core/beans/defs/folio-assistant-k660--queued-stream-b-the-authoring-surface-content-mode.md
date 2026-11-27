---
# folio-assistant-k660
$schema: bean/1.0.0
title: 'QUEUED STREAM B: the authoring surface — content model, memory and voice (0lmb + 8jt6 + 2upx, 16 open beans)'
status: scrapped
type: task
priority: normal
created_at: 2026-09-22T18:29:28Z
updated_at: 2026-10-10T16:40:53Z
parent: folio-assistant-0lmb
---

## What this is

A **queued** stream: not claimed, not started. One of three queue entries
covering the 49 beans the three-GOAL split parked, created 2026-09-22 when the
owner asked that a finishing stream be given the next piece of work rather than
going idle.

Status is `todo` deliberately — see the sibling entry under `slw1` for why a
queue entry that claims itself in advance is the exact defect stream 4 exists
to fix.

## Scope

Three epics that share one question — **what an author and an agent actually
touch** (16 open):

| epic | open | |
|---|---|---|
| `0lmb` | 8 | CONTENT MODEL: block kinds, adapters and the authoring surface |
| `8jt6` | 6 | MEMORY & TODOS: notes an agent or a person carries, attached to the graph |
| `2upx` | 2 | DOCUMENTATION: one SDO voice, RFC 2119 levels |

`0lmb`: `55ao` (a first-class `recommendation` block kind for document folios —
note `AGENTS.md` currently records that there is **no** `recommendation` block
kind, so this is a reversal to check with the owner before building), `bqrg`
(`stripLeanComments` implemented six times — converge on `lean-lexer.ts`),
`cz17` (migrate `dak.json` in; **blocked** on WHO's DAK Logical Model being
final in FHIR), `jg8s`, `6xaz` (pdf-structure infers a TOC from a worked
EXAMPLE and ships it as the document's own structure), `lqo9` (glossary),
`06e3` (docs-auto handler).

`8jt6`: `h32d` (one schema for memory and todos, attachable to any KG node),
`7sf1` (move `MEMORY.md` into the kg graph), `y1w9` (**113 skills are bound to
no role or process, so nothing hands them to an agent**), `3025`
(folio-paper-adapter: 44 of 47 skills have no role), `xeer`.

`2upx`: `88mg` (one voice over bootstrap and cat-harness docs).

## Why these three belong together

`y1w9` and `3025` say **157 skills between them reach no agent** — they exist,
they are correct, and no role or process hands them to anybody. That is not a
memory problem; it is the same gap `2upx` describes as a voice problem and
`0lmb` as an authoring-surface problem. Splitting them across three sessions
would produce three partial answers to one question.

`cz17` is **blocked on a standards body** and must not be scheduled as though
it were tractable: `bean-blocking`'s rule is that an external block's expiry is
a *re-ask date*, not a takeover date, and inventing a date to take over WHO's
FHIR timeline would be fabricating a schedule for somebody else.

## Before starting

- Re-measure; these counts are from 2026-09-22.
- `55ao` contradicts a statement in `AGENTS.md`. Put the reversal to the owner
  before building it, as selectable options.

## Done when

- [ ] A session is launched against this entry and moves it to `in-progress`
- [ ] `y1w9` + `3025`: every skill either reaches an agent through a role or
      process, or is recorded as deliberately unreachable with a reason
- [ ] `55ao` decided by the owner, not by an agent reading two contradictory docs


## Reasons for Scrapping

Scrapped 2026-10-10 by the bean-backlog drain (lane C). This is a queue entry
from the 2026-09-22 three-GOAL split, and the repo separation overtook it:
- **Done:** `bqrg`, `lqo9`, `06e3` and `6xaz` are completed.
- **Decided:** `55ao` is owner-ruled (Q1–Q3) and tracked on its own.
- **Blocked upstream:** `cz17`, on WHO's Logical Model.
- **In no bean store any more:** `y1w9`, `3025`, `h32d`, `7sf1`, `xeer` and
  `88mg`. The skill-reachability question they carried is a harness concern
  (roles, processes), so it belongs to the cat-harness stores.

The parent epic `0lmb` stays open over the real remaining children.


## Reasons for Scrapping

Mirror copy. Scrapped in folio-assistant-core's store by drain lane C (folio-assistant-core#28): a queue entry the repo separation overtook.



## Reasons for Scrapping

Scrapped 2026-10-10 by the bean-backlog drain (lane C). This is a queue entry
from the 2026-09-22 three-GOAL split, and the repo separation overtook it:
- **Done:** `bqrg`, `lqo9`, `06e3` and `6xaz` are completed.
- **Decided:** `55ao` is owner-ruled (Q1–Q3) and tracked on its own.
- **Blocked upstream:** `cz17`, on WHO's Logical Model.
- **In no bean store any more:** `y1w9`, `3025`, `h32d`, `7sf1`, `xeer` and
  `88mg`. The skill-reachability question they carried is a harness concern
  (roles, processes), so it belongs to the cat-harness stores.

The parent epic `0lmb` stays open over the real remaining children.

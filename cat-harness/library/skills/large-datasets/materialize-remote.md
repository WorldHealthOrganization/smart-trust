---
name: materialize-remote
description: >
  Landing remote content locally — the five gates, the three states, and the
  two purposes. One process, shared by catalogue import and harness bootstrap,
  plus the refresh that is not a re-import.
---

# Materializing remote content

**One process for every caller that lands remote content locally.**

| caller | remote source | held locally | refresh |
|---|---|---|---|
| the IRIS replica | IRIS | selected items | `refresh-materialized` |
| `bootstrap` | a harness | the `cat-harness` checkout | `upstream-pins.json` |

`bootstrap/workflows/initialize-harness.bpmn` fetches a harness that **is**
remote content and lands it locally; `upstream-pins.json` exists because that
copy goes stale.

Diagrams: [`materialize-remote.bpmn`](../../processes/materialize-remote.bpmn)
and [`refresh-materialized.bpmn`](../../processes/refresh-materialized.bpmn).
Schema: the `folio-materialization/v1` record (`MaterializationSchema`, owned
by the content layer above this one — named here, not linked). Nothing here restates
either — where they disagree, the schema wins and this file is wrong.

## Ask the purpose FIRST

`working` or `archival`, before any gate, because three of the five mean
different things under each.

| | `working` | `archival` |
|---|---|---|
| what is kept | derived content — sections, OCR | the **original bytes** |
| retention | expires; re-fetchable | **no expiry, by design** |
| `sourceLoss` | unanswered | **discharged** |
| fixity | not needed | **required** |

A process that gated first and asked afterwards would be judging a copy whose
obligations it did not yet know.

## The five gates

Each is a decision a **person** makes; none is answerable from a file. A gate
that only warns is a gate nobody fails.

1. **Size** — what fraction, and what the whole would cost. **Refuse when you
   cannot tell**: "three items" with no denominator is not a size answer.
2. **Restrictions** — *"no restrictions known in context"* is a **state**, not a
   green light. `unknown` is never rendered as `permitted`.
3. **Copyright** — per bitstream, and separately for the derived work.
   `LICENSE-CONTENT.md` exists here and the ingestion pipeline does not read it.
4. **Retention** — what expires this copy. A copy with no expiry cannot be told
   from an abandoned one.
5. **Source loss** — what survives if the origin goes. **Only an archival copy
   discharges this.** Origins do disappear: a regional repository instance can
   be merged away, taking its handles with it.

## Three states, and no default

`referenced` (it exists, we know where, we hold no bytes) · `materialized` ·
`unknown`. A node that has not declared one is **invalid**, not `unknown` — "the
author did not say" and "the author said they could not tell" are different
facts, and only the second is actionable.

A refusal is the process **working**. The node stays `referenced`, the graph
still knows it exists, and the refusing gate's basis is recorded so the next
agent does not re-litigate it.

## Refresh is not re-import

Three answers, not one: what changed upstream, what changed **locally**, and
what to do when both. A materialized copy edited in place is not a copy —
overwriting it destroys work whose existence was never established;
`check:materialized-fixity` detects it.

**An archival copy is never refreshed.** Re-fetching it discards the state it
exists to keep. It gets a **fixity check** instead — has *our* copy rotted —
which is a different question with a different remedy: restore from backup,
never re-download.

## Before you enumerate anything

`cat-harness/schemas/library/source-descriptor.ts` answers the question that comes
*before* the gates: how to enumerate a corpus and ask it for a subset. Check
`subsetIsSelfContained` first — when it is `false` (mathlib), close the request
over its dependencies **before** gating, because the size being gated is the
closure's, not the request's.

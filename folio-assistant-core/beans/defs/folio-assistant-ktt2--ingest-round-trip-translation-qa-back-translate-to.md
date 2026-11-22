---
# folio-assistant-ktt2
$schema: bean/1.0.0
title: 'INGEST: round-trip translation QA — back-translate to catch semantic drift and bad terminology'
status: completed
type: task
priority: normal
created_at: 2026-09-16T06:43:50Z
updated_at: 2026-10-10T17:29:35Z
parent: folio-assistant-slw1
---

## What

Back-translate each localized narrative into its source language and compare
meaning with the original. Flag semantic mismatch and bad terminology.

## Why a round trip rather than a forward check

A forward-only check asks "is this fluent target-language text?" — which a
confident mistranslation passes. The round trip asks whether the MEANING
survived, which is the property actually wanted, and it needs no reference
translation to work.

## What it cannot do

It can establish that two readings differ. **Which one is right is a human
call** — the diagram routes a flagged passage to a reviewer rather than
auto-correcting it.

## Done when

The round trip runs over every localized narrative in the completeness gate,
mismatches become reviewer-adjudicated findings, and a terminology miss is
distinguishable in the output from a general semantic drift.

Diagram: `processes/ingest-l1-completeness-gate.bpmn`, `Task_RoundTrip`.

## 2026-09-19T17:15Z — already answered, and better than this bean asked for

**No code written, deliberately.** Checked before building, and the substance of
this bean is already implemented in `content/pipeline/translation-block-qa.ts`
— in the one form that is honest.

### The round trip is DECLARED and deliberately has no entry

Verified in the output, not taken from the docstring: the criterion
`translation-semantic-roundtrip` exists in the sidecar shape with an **empty
entry list**, and `translation-block-qa.test.ts` proves an agent-supplied
verdict merges into it when one exists. So the slot is real, visibly empty, and
ready — rather than absent, which would read as "nobody thought of it".

The reasoning, already recorded there and better than this bean's framing:

> The only back-translation available offline is reversing the PO's own
> msgid→msgstr map, which returns the source **exactly, always** — a similarity
> of 1.0 that measures the lookup table, not the translation. A score computed
> that way would be a verdict with a script's name on it and no content, which
> is worse than the gap: a reader who sees a green round-trip stops asking.

That is this bean's "Why a round trip rather than a forward check" carried one
step further: a round trip with a *dependent* translator is not a round trip.

### "A terminology miss distinguishable from semantic drift" — already true

`translation-terms-preserved` is a **separate criterion** from the semantic one,
covering acronyms, numbers and URLs that must survive. So the distinction this
bean asks for exists structurally, not as a note in a report.

### Why "Done when" cannot be satisfied today, with numbers

1. **Zero narratives exist.** Every `narrative` record in `library/` is
   `not-authored` (`ju0u`), so there are no localized narratives to round-trip.
2. **Zero translated blocks.** `bun run cat translation:block-qa` reports
   **`Wrote 0 sidecar(s); 609 (block, locale) pair(s) have no translation`** —
   even the three deterministic criteria have nothing to run over.
3. **No independent translator.** Point 3 is the one that does not go away when
   content arrives, and it is the same class of blocker as `68dt`: a capability
   this environment lacks, for a service rather than a package.

### Blocked

- **waits on**: an independent back-translator — a model or MT service that has
  not seen the source. Plus content to run it over (`d5f1` / `1r0p` produce the
  localized narratives; both carried a block against `68dt`, and as of
  2026-09-22 each is **not blocked on `68dt`** because it completed).
- **since**: 2026-09-19.
- **expires**: 2026-10-19. Re-measure rather than trusting this.
- **handoff**: **do not build a PO-reversal round trip to close this.** It
  returns 1.0 always and would make the gap invisible, which is the one outcome
  worse than the gap. If a translator becomes available, the slot is already
  there — supply agent entries for `translation-semantic-roundtrip`; no schema
  change is needed.



## Handover 2026-10-06 — PAUSED until the repo separation lands (Session F, GOAL 5)

Owner ruling, relayed by the coordinating session (session_012qoycyCSGidZqW245vXhze): repo separation is the primary goal, content authoring/review/publication goes to folio-assistant-core while cat-harness keeps the methods, and that 'needs to be done before F'. This bean resumes AFTER the split. **The code it touches may have moved to folio-assistant-core by then — re-locate it before editing, and re-measure.** Open questions on it are being put to the owner by the coordinating session, one at a time; the answer will be recorded here, not assumed.

## Owner ruling 2026-10-06: an agent back-translates, and that mechanism already exists

Asked in https://claude.ai/code/session_012qoycyCSGidZqW245vXhze. **The owner chose the agent back-translator** and added, verbatim: *"should already be ethe skill."*

**Verified: it is.** `cat-harness/content/pipeline/translation-roundtrip.ts` records an agentic semantic round trip as witnesses on a block's translation sidecar, with two parties kept apart:
- the **back-translator** sees only the target-language text;
- the **adjudicator** sees the original and the back-translation, and rules.

Both are recorded, and they are governed by the `untainted-verification` skill (`UntaintedDispatch`, `mergeUntainted`). `translation-manager.md` §5 documents the criterion. This bean's 2026-09-19 entry predates that code, which is why it read as unbuilt.

**What is left:** run it over the translations that now exist (who-iris in the six UN languages, #2229), and wire the L1 completeness gate's `Task_RoundTrip` to it. Then close this bean on that evidence. This waits until after the content split.


## 2026-10-10: gate wired; the run is still open (bean-backlog drain, lane C)

**Done:** the first of the two items the 2026-10-06 ruling left. The
completeness gate's `Task_RoundTrip`
(`processes/library/ingest-l1-completeness-gate.bpmn`) no longer reads "NOT
IMPLEMENTED" and no longer points at `document-intake`. It now names:
- the two skills that govern the round trip: `translation-manager` (§5) and
  `untainted-verification`;
- the Tool that records it: `translation-roundtrip-record`;
- the criterion it writes: `translation-semantic-roundtrip`;
- the separate terminology criterion: `translation-terms-preserved`;
- the rule that an empty entry list is "not yet run", never a pass;
- the PO-reversal prohibition from 2026-09-19.

The step's derived strings were updated with it: the 5 `.pot` templates under
`translations/*/processes/` (line refs shifted, sorted as pot-extract sorts)
and the generated `kg-bpmn-activities` glossary entry.

**Still open, so the bean stays `todo`:** running the agentic round trip over
the translations that exist (who-iris in the six UN languages, #2229), and
adjudicating what it flags. That run belongs in the who-iris instance and
needs dispatched back-translator and adjudicator agents. Close this bean on
that run's sidecars.


## Summary of Changes

Closed 2026-10-10 on the owner's instruction ("ktt2: do so"), with both items
of the 2026-10-06 ruling done:

1. **Gate wired** (core PR #31): `Task_RoundTrip` names the agentic round trip,
   its criterion and the separate terminology criterion.
2. **Run over the translations that exist** (who-iris PR #35, merged). This
   covered 600 strings: `site/iris-site.po` and `glossary/who-iris--who-terms.po`
   in ar, es, fr, ru and zh.
   - Each string was back-translated by an agent that saw **only the
     `msgstr`**. It was limited to one Read and one Write, and recorded
     `TOOLS_USED: Read,Write`.
   - A separate adjudicator saw **only the `msgid`, its note and the
     back-translation**, and tagged each finding `[term]` or `[sense]`.
     That tagging is the terminology-versus-semantic distinction the Done-when
     asks for.
   - **Result: 532 pass, 66 warn, 2 fail.** By locale: ar 113/7/0, es 113/7/0,
     fr 112/8/0, ru 90/28/2, zh 104/16/0.
   - The earlier 580/580 (bean `lffo`) was self-checked by the translating
     agent. This independent run is the measurement that one could not be.
   - The report is `qa-results/v1`, derived by
     `who-iris/scripts/translation-roundtrip-report.ts` from the committed agent
     outputs. It goes stale when a catalogue changes, and `--check` and a test
     guard it.

**Mismatches become reviewer-adjudicated findings:** the 68 flagged entries are
queued for a reviewer as `folio-core-2mb0`. Nothing was auto-corrected.

**Stated limit:** the bean was written for *localized narratives*. None exist
yet: figure narratives are English drafts (`d5f1`, now `cat-tools-e1lo`). The
same mechanism applies to them unchanged when they are translated.


## Summary of Changes

Mirror copy. Completed in folio-assistant-core's store by drain lane C: who-iris#35 ran an untainted round trip over 600 who-iris strings (ar, es, fr, ru, zh): 532 pass, 66 warn, 2 fail, superseding lffo's self-checked 580/580. Follow-ups: folio-core-2mb0 (reviewer queue for the 68 findings), folio-core-shsz → cat-tools-bbnd (translation info drawer).



## 2026-10-10: gate wired; the run is still open (bean-backlog drain, lane C)

**Done:** the first of the two items the 2026-10-06 ruling left. The
completeness gate's `Task_RoundTrip`
(`processes/library/ingest-l1-completeness-gate.bpmn`) no longer reads "NOT
IMPLEMENTED" and no longer points at `document-intake`. It now names:
- the two skills that govern the round trip: `translation-manager` (§5) and
  `untainted-verification`;
- the Tool that records it: `translation-roundtrip-record`;
- the criterion it writes: `translation-semantic-roundtrip`;
- the separate terminology criterion: `translation-terms-preserved`;
- the rule that an empty entry list is "not yet run", never a pass;
- the PO-reversal prohibition from 2026-09-19.

The step's derived strings were updated with it: the 5 `.pot` templates under
`translations/*/processes/` (line refs shifted, sorted as pot-extract sorts)
and the generated `kg-bpmn-activities` glossary entry.

**Still open, so the bean stays `todo`:** running the agentic round trip over
the translations that exist (who-iris in the six UN languages, #2229), and
adjudicating what it flags. That run belongs in the who-iris instance and
needs dispatched back-translator and adjudicator agents. Close this bean on
that run's sidecars.


## Summary of Changes

Closed 2026-10-10 on the owner's instruction ("ktt2: do so"), with both items
of the 2026-10-06 ruling done:

1. **Gate wired** (core PR #31): `Task_RoundTrip` names the agentic round trip,
   its criterion and the separate terminology criterion.
2. **Run over the translations that exist** (who-iris PR #35, merged). This
   covered 600 strings: `site/iris-site.po` and `glossary/who-iris--who-terms.po`
   in ar, es, fr, ru and zh.
   - Each string was back-translated by an agent that saw **only the
     `msgstr`**. It was limited to one Read and one Write, and recorded
     `TOOLS_USED: Read,Write`.
   - A separate adjudicator saw **only the `msgid`, its note and the
     back-translation**, and tagged each finding `[term]` or `[sense]`.
     That tagging is the terminology-versus-semantic distinction the Done-when
     asks for.
   - **Result: 532 pass, 66 warn, 2 fail.** By locale: ar 113/7/0, es 113/7/0,
     fr 112/8/0, ru 90/28/2, zh 104/16/0.
   - The earlier 580/580 (bean `lffo`) was self-checked by the translating
     agent. This independent run is the measurement that one could not be.
   - The report is `qa-results/v1`, derived by
     `who-iris/scripts/translation-roundtrip-report.ts` from the committed agent
     outputs. It goes stale when a catalogue changes, and `--check` and a test
     guard it.

**Mismatches become reviewer-adjudicated findings:** the 68 flagged entries are
queued for a reviewer as `folio-core-2mb0`. Nothing was auto-corrected.

**Stated limit:** the bean was written for *localized narratives*. None exist
yet: figure narratives are English drafts (`d5f1`, now `cat-tools-e1lo`). The
same mechanism applies to them unchanged when they are translated.

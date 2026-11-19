---
$schema: folio-methodology/v1
name: madr
title: MADR — Markdown Architectural Decision Records
origin: >
  Michael Nygard, "Documenting Architecture Decisions" (2011), for the ADR form;
  MADR (github.com/adr/madr) for the Markdown template with an explicit
  Considered-Options section.
applies-when: >
  **Bean context** — the owner's binding, 2026-09-20. When a bean records a
  decision, this is the form. Not for the decision METHOD (see `kepner-tregoe`)
  and not for a recurring rule (see `dmn`).
---

# MADR — the record, not the method

**Adopted whole, 2026-09-20.** The owner's binding: *"MADR is guidance in bean
context."* So a work item that records a decision carries these sections; a work item that
records work does not need them.

## Its sources: what is held, what is unreachable, and why `evidence` is absent

**Attempted 2026-09-22, and the attempt is recorded because it did not
succeed.** `origin` cites two things and neither is in a library.

| cited | status | direct link |
|---|---|---|
| the **adr/madr** repository, for the Markdown template | **bytes fetched and queued**, not ingested | <https://github.com/adr/madr> |
| Nygard (2011), "Documenting Architecture Decisions", for the ADR form | **unreachable from this container** | <https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions> |

The repository's own bytes were fetched from `raw.githubusercontent.com` —
README, LICENSE, CHANGELOG and all four templates, MIT OR CC0-1.0 — and they
confirm what this file says about the form: `template/adr-template.md` carries
an explicit **Considered Options** section, which is the thing MADR adds to
Nygard's shape.

**They are in `uploads/`, not `library/`, and that is the honest state.**
The ingest pipeline has no rung that reads markdown, and the archive rung
stages but cannot be promoted — `l1-blocks` derives a manifest from a
`structure.json` that only the PDF rungs write. So there is nothing to cite.
Work item `ke1w` (filed as `t3n8`, re-id'd by `4vg7`) carries the measurement and the per-file hashes.

**`evidence` is therefore absent rather than pointing at the queued archive.**
A `library/` reference means a source a reader can open from this checkout;
an archive whose entries are listed but never extracted is not that, and citing
it would put the more reassuring of the two available answers on the record.
`check:methodology-evidence` reports this node as unbacked, which is correct.

**Nygard's post could not be captured at all.** `archiving-web-pages` says the
default is both a PDF capture and the page's own bytes; here neither is
reachable, and the whole of `cognitect.com`, `doi.org` and `adr.github.io` fail
through this container's proxy. That is a fact about this agent, not about the
literature: the post is open on the web and a person can fetch it in a second.

## Why the record is a separate adoption from the method

`kepner-tregoe` tells you how to reach the decision. MADR tells you what survives
of it a month later. They are independent: a decision reached by any method can be
recorded in this form, and this form constrains no method.

**The gap this closes:** before this,
[`decision-audit`](../skills/process/process-core/decision-audit.md) recorded *why this* —
and nothing recorded *what else, and why not*. A rejected option with no record is
a dead end nobody marked, and the next agent walks into it. That is exactly the
argument `bean-coordination` makes for `scrapped` over deleted.

## The sections

- **Status** — proposed / accepted / superseded-by, and by what.
- **Context and problem statement** — what forces the decision. One paragraph.
- **Decision drivers** — the MUSTs and WANTs, if `kepner-tregoe` was used.
- **Considered options** — **at least two, every one real.** One option is not a
  choice; a straw option is worse than a short list.
- **Decision outcome** — what was chosen, and the one sentence of why.
- **Consequences** — good and bad, stated as consequences rather than hopes. The
  bad ones are the point: an outcome with no stated cost has not been analysed.
- **Pros and cons of the options** — per rejected option, why it lost. This is
  the section that stops the decision being re-litigated from scratch.

## The one-sentence form, for when the full record is too much

Zdun et al.'s Y-statement, adopted as MADR's short form rather than as a separate
methodology:

> In the context of **⟨use case⟩**, facing **⟨concern⟩**, we decided for
> **⟨option⟩** and against **⟨alternatives⟩**, to achieve **⟨quality⟩**,
> accepting **⟨downside⟩**.

It carries the rejected alternatives and the accepted downside, which are the two
things a bare "we decided X" loses.

## Refusals

- **Never fewer than two considered options.** If there genuinely was only one,
  the record says *why no alternative existed* — that is a finding about the
  constraint, not a decision. **This one is checked**: `bun run cat health` reports
  `bean-thin-decision-records` over the work item store, at `minor`, because it maps
  analytical debt rather than breaking a consumer. It reports the SUBJECT COUNT
  beside it (`bean-decision-records`) on purpose — the finding can only fire on a
  work item that count includes, so a detector that stops matching shows as zero
  subjects instead of as a clean run. Measured when it landed, 2026-09-20: two
  records in the store, both with three options, so it locks in a property the
  store has rather than demanding work.

  The check refuses the shortcut the rule invites: its remedy offers *why no
  alternative existed* and says outright not to invent a straw option to reach
  two. A criterion that could be satisfied by padding would make the records
  worse than no criterion.
- **Never rewrite a superseded record.** Mark it superseded and link forward.
  Editing it erases the fact that the decision changed, which is the same erasure
  `decision-audit` refuses when it says overruling is recorded rather than erased.
- **Consequences are not benefits restated.** If every consequence listed is good,
  the section is empty.

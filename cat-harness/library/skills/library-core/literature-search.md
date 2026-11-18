---
name: literature-search
description: >
  Finding the source a node cites but does not hold — memory first, then this
  repository, then open-access services. Always produce a DIRECT download link.
  Read before recording that a citation cannot be found, and before appraising
  any source you have not opened. Its central rule: a blocked network is not a
  missing document, and the two must never share a report.
---

# Literature search — finding the source a citation points at

A node cites a source. Nothing in any declared library holds it. This skill is
the step between those two facts and `library-ingestion`, which takes over once
a file exists.

**It runs on a measurable trigger, not a feeling:** a `origin`, `evidence`,
`source` or bibliography reference whose target does not resolve to an entry in
any library the layer declares. The methodology graph is where this bites
hardest — `methodology-adoption` requires that an adopted methodology be
"external and named", with "an origin: authors, a publication, a standards
body" — and a front-matter string nothing can follow satisfies that requirement
only on paper.

## Look in this order, and stop at the first hit

**1. Memory.** The `memory` graph and agent memory under
`.claude/agent-memory/`. A source located once and found unreachable is worth
recording; re-deriving that costs the same search twice and reaches the same
wall.

**2. This repository.** Every declared `library` and `uploads` directory, not
one of them. A layer may declare several — ask the declaration, do not
assume a path. A file sitting in `uploads/` is **found but not ingested**, which
is a different finding from not found, and it is the cheapest possible outcome:
hand it to `library-ingestion` and stop.

**3. Open-access services.** DOI resolution through the publisher, then the
open-access aggregators and repositories — Unpaywall, OpenAlex, Crossref, DOAJ,
CORE, arXiv, PubMed Central, Zenodo, HAL, and a standards body's own site where
the origin names one. `archiving-arxiv` and `archiving-web-pages` cover the
fetch once a URL is in hand.

**Open access only.** What this finds is committed into a library in a public
repository, so a paywalled PDF is not a candidate whatever its availability to
the person searching. When only a paywalled copy exists, that is an outcome to
report (below), not a licence to take it. A publisher's own free-to-read landing
page, a preprint, an author copy in an institutional repository and a standards
body's public specification are all fine.

## Always give the direct link

Every outcome carries a **direct download link** — the URL that yields the file
itself, not a search page, not a DOI landing page, not "search for it on X".

A landing page is acceptable *in addition*, never *instead*. The person reading
this has limited hand function; "you can find it by searching" converts a
finished search into their work, which is the whole thing this skill exists to
absorb.

## Three outcomes, and the middle one is the point

There are **three**, not two, and collapsing the middle into the third is the
failure this skill is written to prevent.

### 1. Found and fetched

The file is in `uploads/`. Hand to `library-ingestion` and say which service it
came from, so the provenance is checkable.

### 2. Found, but this agent cannot fetch it

**The document exists, its location is known, and something in the way this
agent is running stopped the transfer** — a proxy refusal, a TLS failure, a
robots policy, a rate limit, a login wall, a network the container cannot reach.

**Report this as a located document, never as a missing one.** Say all of:

- **what the item IS** — full citation: authors, year, title, venue, volume,
  pages, DOI. Enough that a person recognises it without opening anything.
- **what it contains**, in a sentence, and its extent if known (pages, format).
  This is what lets the person judge whether it is worth their trouble.
- **the direct download link**, as above.
- **why the fetch failed**, in plain words — "the agent proxy returned 403",
  "the publisher requires a login", "the host is not reachable from this
  container". Not "could not retrieve".
- **what to do with it**: drop the file into `uploads/` and the ingest runs.

Then record it in the work plan as blocked on a fetch, with what it waits on —
`bean-blocking`'s rules apply, expiry included.

> **A network restriction is a fact about this agent, not about the
> literature.** Reported as "not found" it becomes a fact about the world, and
> the next agent re-runs the identical search, hits the identical wall, and
> reports the identical wrong conclusion. Worse, a methodology whose source was
> *found and blocked* reads exactly like one whose source does not exist, and
> the first is a five-minute human action while the second may mean the
> methodology should not have been adopted.

### 3. Not found

Nothing open-access resolves to it. Say what was searched — the services, not
"a search was done" — and what the closest candidates were and why each was
rejected. A rejected candidate with no record is a dead end the next agent walks
back into, which is `bean-coordination`'s argument for `scrapped` over deleted,
applied to a search.

**"Not found" for a source that is merely paywalled is wrong.** That is outcome
2 with "the only copies are behind a paywall" as the reason.

## Never fill the gap with recall

**Do not paraphrase, summarise, quote or characterise a source you have not
opened.** Not from training, not from a secondary source, not from an abstract
read in a search result, unless the abstract is what you say you read.

This is the rule the whole evidence base rests on. A methodology file that
renders a method from the agent's recollection and cites a paper nobody fetched
is *worse* than one with no citation at all: it carries the authority of a
reference while resting on nothing, and there is no way for a reader to tell it
apart from a faithful rendering.

Where a source is read **through** another — a review paper reporting a primary
one — say so at each claim. `methodologies/swot.md` is the worked example:
Humphrey, Weihrich, Dealtry, Wheelen & Hunger, Hill & Westbrook, Mintzberg and
Dess et al. are all read through one review, every attribution is marked
second-hand, and the file says the origin of the method is contested rather than
repeating the usual story as fact.

## What this skill does NOT do

- **It does not appraise.** Certainty of a body of evidence is
  `evidence-appraisal` against the grading system the folio declares, and for a
  health recommendation that is `grade`. Finding a paper says nothing about
  whether it is any good.
- **It does not ingest.** `library-ingestion` owns `uploads/` → `library/`, and
  the ingest chooses its own rung.
- **It does not decide which methodology to use.** That is
  `methodology-adoption`, which this skill *feeds*: the evidence behind a
  methodology is an input to selecting it.
- **It does not judge whether a gap matters.** It reports the gap. Whether a
  methodology with no reachable source should still be adopted is the owner's
  call, and `deletion-requires-confirmation`'s posture applies — report, with
  what is missing, and wait.

## Related

- [`library-ingestion`](library-ingestion.md) — the next step, once a file exists
- [`methodology-adoption`](../../../skills/process/process-core/methodology-adoption.md) — what requires an origin in
  the first place, and the selection question this feeds
- [`evidence-appraisal`](../../../skills/authoring/content-lifecycle/evidence-appraisal.md) — appraising
  what was found
- [`evidence-review`](../../../skills/authoring/authoring-core/evidence-review.md) — separation of appraiser from drafter
- `bean-blocking` (opt-in `cat-harness.work-plan`) — recording outcome 2 so it does not read
  as abandoned

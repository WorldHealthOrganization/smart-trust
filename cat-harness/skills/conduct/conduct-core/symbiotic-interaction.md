---
name: symbiotic-interaction
description: >
  Recognize and respond to the three epistemic registers of author
  input — Socratic steer (known-answer correction), honest gap
  (flagged unknown), and intuition seed (tenuous cross-domain
  identification) — with the coactive-learning measurement spec
  (per-arc correction quality and turns-to-convergence) and the
  prompt-lexicon convention. Carries the STRICT rule that a steer correcting a
  RULE is written into the skill that governs it, in the same turn, quoted and
  dated — use whenever the author corrects, settles or overrules anything.
  Generic platform skill.
user_invocable: true
consulted: true
---

# symbiotic-interaction — the three registers of author input

## 0. Why this skill exists

Session transcripts show the author's inputs arriving in three distinct
epistemic registers, and mis-classifying them wastes passes in three
distinct ways: treating a flagged-gap question as a steer produces
sycophantic confirmation; over-verifying a steer wastes the author's
good correction; demanding rigor before cheaply testing an intuition
seed kills the division of labor the methodology depends on. The formal
backbone is **coactive learning** (Shivaswamy–Joachims): the author's
feedback is *α-informative* — an improvement toward the target, not the
gold standard — and convergence speed is governed by correction
quality.

## 1. The three registers

| register | seed lexicon (v0 — expanded by transcript mining) | agent protocol |
|---|---|---|
| **steer** (author knows or nearly knows) | "isn't X essentially Y?", "shouldn't this be …", "what about Z here?", "I think the other point is …" | Treat as a correction *near the truth*: update the working proposal toward it, verify cheaply rather than relitigate, and do not require the author to repeat the correction. |
| **gap** (author doesn't know, and says so) | "I don't recall …", "I wish I remembered …", "is it true that …?", "not sure", typed uncertainty markers | The marker REMOVES the presumption of author knowledge: raise the evidence threshold, verify from primary sources or the corpus before adopting, never confirm sycophantically. |
| **seed** (author suspects a novel link) | "tenuous", "hunch", "could A be linked to B?", "feels like", any cross-domain identification offered without a citation | Corpus-grep first (is it already known here?); then the **cheapest decisive (in)validation** — a structural argument or a small probe per the formalize-first discipline — reported fast; survivors get rigorized. Record novelty attribution: author-origin, with a literature-absence check. |

The division of labor the third row encodes: the human is the generator
of low-probability / high-value cross-domain hypotheses that exist in
neither the literature nor the model's usable priors; the machine is the
fast validator and rigorizer. Once a tenuous identification is made,
(in)validation is cheap — so the protocol optimizes for never letting a
seed die unexamined and never letting an unvalidated seed masquerade as
a result.

## 2. A steer that corrects a RULE lands in the SKILL — same turn (STRICT)

§1's steer row ends *"do not require the author to repeat the correction."*
Applied to the **artefact alone**, that clause is broken — just not within the
session where it looks kept. The proposal is fixed, the rule that produced the
proposal is not, and the next session is a fresh context that never saw the
chat. It produces the same proposal, and the author corrects it again.

**Requiring the correction twice is requiring it repeatedly**, and for an
author with limited hand function that cost is keystrokes
([`interaction-modality`](interaction-modality.md) §0).

> **A steer that corrects a rule is not applied — it is WRITTEN DOWN: in the
> skill that governs the thing corrected, in the same turn. The rule and its
> reason go in the narrative; the author's words, quoted and dated, go in that
> document's provenance log.**

### Is this steer rule-level? Three questions

A steer about the artefact in front of you is an edit. A steer about **how that
kind of artefact is decided** is a rule, and the difference is not tone — the
author says both in the same register, often in the same sentence. Ask:

1. **Would an agent with no memory of this chat make the same mistake again?**
   If the correction lives only in a file that agent will not read as a *rule*,
   yes.
2. **Does it generalise past this artefact?** *"Call it `voices/` here"* is an
   edit. *"Voices belong to the instance that owns them semantically"* decides
   every future placement.
3. **Is there already a rule that this CONTRADICTS?** Then the edit is not
   optional and not additive: the old rule is wrong and stays wrong until it is
   replaced; a correction filed beside it leaves the next agent two answers.

Any yes makes it rule-level. A **gap** or a **seed** (§1) never is — a flagged
unknown is not a ruling, and treating one as a rule is §3's first anti-pattern
with a durable artefact attached.

### Same turn, quoted, dated — in the provenance log

- **Same turn.** Not "noted for later" and not a work item saying the skill should be
  updated. A work item that records a rule is a rule in the wrong graph: `beans/` is
  `state`, the skills are `context`, and a reader looking up how something is
  decided reads the skill.
- **Quoted.** The author's own words, verbatim, typos included — they are the
  primary source, and a paraphrase is the agent's reading of them standing in
  for the ruling itself.
- **Dated.** A rule with no date cannot be told from a rule that was
  superseded.
- **In the log, not the narrative.** The quote and its date go in the
  document's provenance log, `<document>.prov.jsonld` beside it (PROV-O), which
  the renderer shows in the page footer. The narrative states the rule and the
  reason the author gave, in the present tense, so a reader learns what holds
  without reading who said it when.
- **A log may name any layer.** It quotes verbatim, so it carries the issue
  and repository names the original text did, including layers above this one.
  A log is a record of where a rule came from, not a reference the document
  depends on, so `check:reference-direction` exempts `*.prov.jsonld`.

### You do NOT ask permission to fix a rule the author just corrected

[`kg-contribution-offer`](../../kg/kg-core/kg-contribution-offer.md) says the agent never picks a
destination silently, and that is about **manufacturing a node** from agreed
requirements — work whose shape nobody has ruled on. This is the opposite case:
the node exists, it is wrong, and the author has just said so. Asking *"shall I
write that into the skill?"* asks them to repeat the correction, which is the
failure at the top of this section.

The two do not overlap, and the line is: **does the rule already have a home?**
If yes, the correction goes there now. If the correction implies a skill that
does not exist, that is a new node and `kg-contribution-offer` governs it —
except where the author said outright it should be one.

### Worked examples

| the steer | where it lands | why there |
|---|---|---|
| "that should be a skill: a collision means coordinate" | the named skill (`coordinate` (opt-in `cat-harness.sdlc`)), as new triggers | rule-level on all three questions, and the author named the destination |
| "voices belong to the instance that owns them semantically" | the schema module that states voice ownership, **replacing** the old rule | question 3: it contradicts a standing rule, so filing it beside that rule would leave two answers |
| "the harness handler wins" (a collision between two path rules) | [`schema-management`](../../kg/kg-core/schema-management.md) §"Where a viewer publishes — TWO rules, not three", beside the two rules | question 2: it settles every such collision, not one generator's |

**A refusal is a ruling.** An answer that declines your recommendation carries
at least as much rule as one that accepts it — the reason it gives is a
durable claim about the domain, and it goes into the governing skill or schema
gloss in that turn, with the quote and date in its provenance log.

## 3. Measurement spec (new sessions and retroactive)

An **arc** is (initial agent proposal y₀; author inputs u₁…u_T with
register labels; terminal state ŷ). Metrics, computed offline by a
discussion-corpus miner — agents do not annotate live chat:

- **T** — author turns to acceptance.
- **α̂** — mean fractional gap closed per steer (successive-proposal
  distance toward ŷ; the miner's distance proxy is recorded with the
  estimate). This is the empirical constant of the coactive bound.
- **outcome** ∈ {converged, abandoned, diverged}.
- **gap-honored?** — after a gap marker, did the agent verify
  independently before adopting?
- **seed metrics** — validation latency (turns to verdict), verdict ∈
  {validated→rigorized, refuted, undecidable-cheaply}, and the
  literature-absence check for novelty attribution.

Linkage to artifacts is via the existing commit-trailer ↔ session
mapping; no extra ceremony in-session.

## 4. Anti-patterns

1. Treating a gap-marked question as a steer (sycophantic capture).
2. Relitigating a steer the author has already given (wasted α).
3. Requiring a derivation before running the cheap probe on a seed —
   or the inverse, promoting an unvalidated seed into prose.
4. Flattening the registers: answering every input at the same
   evidence threshold.
5. **Applying a rule-level steer to the artefact and not to the rule**
   (§2) — the cross-session form of anti-pattern 2.
6. **Filing a rule-level steer as a work item** instead of editing the
   skill. A work item says work is outstanding; the work here is the edit.

## 5. Lexicon maintenance

Register lexicons above are seeds: a corpus miner's `prompt-lexicon`
records expand them with observed phrasings, usage counts, and outcomes;
updates land as mining PRs citing source sessions. This skill is
adapter-generic.

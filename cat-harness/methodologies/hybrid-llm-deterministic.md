---
$schema: folio-methodology/v1
name: hybrid-llm-deterministic
title: Hybrid LLM/deterministic — the model proposes a RULE, machinery validates and runs it
origin: >
  Felix Neubauer, Jürgen Pleiss and Benjamin Uekermann, "AI-assisted JSON
  Schema Creation and Mapping" (arXiv:2508.05192v2), University of Stuttgart.
  The authors' own word for it is a *"hybrid approach that combines large
  language models (LLMs) with deterministic techniques"*. Open access, read
  whole and ingested here — unlike most nodes in this graph, the primary IS
  held. It is a tool paper reporting one implementation (MetaConfigurator), so
  what is adopted below is the METHOD it generalises, and §"Where this
  rendering stops" says which parts were left behind.
evidence:
  - library/arxiv-2508.05192v2
applies-when: >
  **An agent must produce an artefact that something downstream will act on.**
  Use it when a language model is in the loop and a wrong output would be
  acted on rather than merely read — a schema, a mapping, a classification, a
  branch, a judgement. It answers *how to get the output safely*, never *which
  option to choose*: a one-off choice among options is `kepner-tregoe`, a
  recurring rule is `dmn`, certainty of evidence is `grade`, the record of a
  decision is `madr`, who is involved is `raci`, and situation analysis is
  `swot`. Those pick an answer; this one constrains how an answer is produced.
  Not applicable where no model is involved, and unnecessary where the output
  is only ever read by a person who will notice it is wrong.
---

# Hybrid LLM/deterministic — generate the rule, then execute it

**Adopted 2026-09-23.** The source was uploaded, ingested whole through the
`pdf-structure` rung (12 outline entries, structure read rather than inferred)
and read before this node was written.

## The load-bearing idea, in one sentence

> **Have the model emit a RULE that deterministic machinery then validates and
> executes — not the RESULT.**

The paper's schema-mapping half is the clean case (§III-B): rather than asking
the model to transform a document, it asks for a **JSONata expression**, checks
that expression parses, and then runs it deterministically over the data. The
model never touches the data at scale. Its output is a program, and a program
can be checked before it is trusted in a way a transformed dataset cannot.

That inversion is what makes the rest of the method work, and it is the part
worth carrying anywhere. A generated *result* must be verified by inspecting
every item; a generated *rule* is verified once and then applies at any volume.

## The five safeguards, as the source enumerates them

§III-A, numbered there and renumbered nowhere here:

| # | safeguard | what it refuses |
|---|---|---|
| 1 | **Prompt construction and context management** — the tool builds the prompt, sets the model's role, and states the expected output format | an ad-hoc prompt nobody can reproduce |
| 2 | **Integrated validation and visualization** — output is validated and shown immediately | an unvalidated artefact entering the system |
| 3 | **Scalability through targeted context** — send the user-selected *sub*-schema, never the whole thing | degradation the model will not report |
| 4 | **Automated response post-processing** — strip code fences and language hints | a wrapper artefact read as content |
| 5 | **Human-in-the-loop editing** — on incomplete or incorrect output the *raw* response is shown, and the person corrects, accepts or discards | a silent accept |

**Safeguard 5 shows the raw response, and that detail is the method rather than
an implementation nicety.** A tool that hides the failed output leaves the
person deciding whether to trust something they cannot see.

## Why the safeguards exist — three cited failure modes

The source does not assert that models need guarding; it cites three
measurements (§II-B), and they are reproduced here because a reader is entitled
to check them rather than take the premise:

- LLMs **can be distracted by irrelevant context** — Shi et al., ICML 2023.
- Accuracy **drops on low-probability inputs even for deterministic tasks** —
  McCoy et al., arXiv:2309.13638.
- Reasoning **degrades as input length increases, before the context window is
  reached** — Levy et al., arXiv:2402.14848.

The third is why safeguard 3 is about *targeted* context rather than merely
*sufficient* context: staying under the window is not the same as staying in
the range where the model reasons well. **These three are second-hand here** —
cited by the ingested source, not themselves ingested, and marked as such per
`literature-search` §"Never fill the gap with recall".

The source also reports, from Buss et al. on LLM schema mapping, that *"due to
the difficult nature of data integration, human-in-the-loop approaches are
required"* — which is safeguard 5 arrived at independently.

## Bounded truncation — the one technique worth naming separately

§III-B. Where the input is too large, the source does not summarise it and does
not silently clip it. It **recursively truncates arrays to length n and object
properties to 8n**, halving n from 64 until the document is under 64 KB or
n = 2 — properties trimmed more conservatively than array items, because array
items tend to share a schema while properties usually differ.

The part that makes it a method rather than a hack: **the schema inferred from
the COMPLETE document is included in the prompt**, so what truncation removed
is still described even though it is no longer present. The source states the
consequence rather than hiding it — there is an upper bound on document
complexity that this supports.

## What it refuses

- **Never let the model's output be the thing that is acted on, where a rule
  could be generated instead.** That is the whole method; everything else is
  support.
- **Never send the whole context because it fits.** Fitting the window is not
  the criterion — safeguard 3 and the Levy et al. finding are about the range
  in which reasoning holds, which is smaller.
- **Never accept silently on failure.** Safeguard 5 requires the raw response
  to be visible to the person who is being asked to accept it.
- **Never treat syntactic validation as semantic validation.** The source is
  explicit that its JSONata check is *"for syntactical correctness (not
  semantics)"*. A method that blurred those would present an expression that
  parses as an expression that is right.

## Where this rendering stops

`methodology-adoption` step 2: both halves stated.

**Adopted** — the rule/result inversion, the five safeguards, the three cited
failure modes, bounded truncation with schema preservation, and the
syntactic/semantic distinction.

**Not adopted, and deliberately** — every tool choice in the paper.
MetaConfigurator, JSONata, `gpt-4o-mini`, `jsonhero/schema-infer` and the
OpenAI-compatible endpoint are one instantiation. The owner's instruction on
ingesting this source, 2026-09-23: *"do not need to match tools in paper,
start with process, determine most appropriate tools (known or which can be
added)."* A node that named those tools would be adopting an implementation
and calling it a method.

**Not assessed** — the paper's chemistry application example (§IV) is a
demonstration, not an evaluation. It reports no accuracy measurement, no
baseline and no comparison, so **nothing here rests on a claim about how well
the approach performs.** The source does not make such a claim, and this node
must not manufacture one.

## How this platform applies it

This repository was already navigating the deterministic-to-agentic spectrum
before this node existed, through four mechanisms that do not refer to each
other. That application — and the open research questions this source bears on
— is in the skill:
[`skills/process/workflow/deterministic-and-agentic.md`](../skills/process/workflow/deterministic-and-agentic.md).
The method lives here once; the skill names it and does not restate it.

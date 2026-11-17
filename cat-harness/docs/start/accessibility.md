---
layout: default
title: Accessibility
nav_order: 11
supported_locales: ["ar", "zh", "en", "fr", "ru", "es"]
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Accessibility
{: .no_toc }

This page answers two questions:

1. What are the options for disability support here, and what is best practice?
2. What are the options for forcing agentic Q&A into guided questions that
   follow DMN logic and can serve several interaction modalities?

They turn out to be the same question asked from two ends, which is why they
share a page. The implementing skill is
[`interaction-modality`]({{ '/reference/skill-instructions/interaction-modality.html' | relative_url }}).

1. TOC
{:toc}

---

## 1. The failure this is about

An agent that asks a good question in an unusable form has asked nothing.

The usual shape of it: a long open prompt — *"Tell me about the folio you have
in mind, what content types you expect, and how you'd like it organised"* — sent
to somebody for whom typing is slow and painful. The reply comes back short. The
agent reads shortness as low engagement and asks another open question. Nobody
in that exchange has done anything obviously wrong, and the conversation is
already failing.

The rule:

> **A question's cost is paid by the person answering it.** Design the question
> so that the cheapest possible answer is still a complete one.

Selectable options are a better question than an open one for nearly everybody,
and cost nothing to the person who would rather type anyway. Treating that as an
accommodation rather than as the default is how it ends up applied only after
someone has had to ask.

## 2. Options for disability support — what is actually on the table

Four independent axes. A person can be on more than one, and none of them is a
diagnosis — they are choices about the interface.

### 2.1 Limited hand function / dexterity

The axis that changes an agent's behaviour most, and the one most often reduced
to "make the buttons bigger".

| do | why |
|---|---|
| Every question is a **selection**, numbered | typing is the expensive act |
| **Four options or fewer** | beyond that, split the question |
| One **recommended** option, stated **first** and marked | a person who does not want to decide can pick the first thing and be right |
| **Say what happens if they say nothing**, then do that | silence must never block the work |
| **Batch** decisions so one answer covers several | each round trip costs keystrokes |
| Announce long-running work; do not ask permission for it | confirmation prompts are the hidden tax |
| Free text always *available*, never *required* | the option list is a floor, not a ceiling |

In rendered output: **WCAG 2.2 SC 2.5.8 Target Size (Minimum)** — 24 × 24 CSS px
— and **2.5.7 Dragging Movements**: anything draggable needs a non-drag
alternative.

### 2.2 Low vision

Large type, real contrast, never information carried by colour alone, short
lines, and narrow tables — a wide table is unreadable at 200 % zoom and worse
through a screen reader. ASCII diagrams do not survive either; use a real image
with real alt text.

Criteria: **1.4.4 Resize text** (200 % without loss), **1.4.3 Contrast
(Minimum)**, **1.4.1 Use of Colour**, **1.4.10 Reflow**, **2.4.7 Focus Visible**.

### 2.3 Audio / voice

Answers that read aloud cleanly: no code fences inside prose, no tables, no "see
the diagram above", identifiers spelled out on first use, one idea per sentence,
and **one question at a time**. A four-option list works spoken; a four-column
table does not.

### 2.4 Cognitive load and plain language

Shorter sentences, jargon expanded on first use, no nested clauses, and a
predictable order of operations. This is where the "four options" limit actually
comes from — W3C's **COGA** guidance and **WCAG 3.1** — and it is also simply
the right default for a second-language reader, which for a WHO SMART Guideline
is most of the audience.

### 2.5 Best practice, named so it can be checked

Not "follow accessibility guidelines" but specific documents, so a claim here
can be verified rather than trusted:

| standard | what it covers | why it applies here |
|---|---|---|
| **WCAG 2.2 Level AA** | the rendered output — docs site, viewer, generated PDF | the baseline everything else references |
| **WCAG 2.2's new SC** — 2.5.7, 2.5.8, 3.3.7 | dragging, target size, redundant entry | 3.3.7 is the one that changes agent design: **do not make someone enter the same information twice** |
| **W3C COGA** | cognitive and learning disabilities | §2.4 above |
| **EN 301 549** | EU public-sector procurement | makes WCAG AA a legal requirement in the contexts a guideline lands in |
| **Section 508** | US federal procurement | the same, in the US |
| **ATAG 2.0** | tools that *produce* content | **the one usually missed.** folio-assistant is an authoring tool: Part A is the tool being usable, Part B is the tool helping the author produce accessible output |

ATAG Part B is the part a content platform can uniquely deliver: alt-text presence, heading order, table headers and language
tagging in *published* folios are checks the QA sweep can carry, and no amount
of making the editor accessible substitutes for them.

### 2.6 What is implemented today

| | where |
|---|---|
| Agent-facing preferences, committed, read at session start | `memory/interaction.json`, surfaced by `scripts/session-start-coord-sweep.sh` |
| The rules an agent follows when asking | [`interaction-modality`]({{ site.baseurl }}/reference/skill-instructions/interaction-modality.html) |
| Reader-facing controls on this site | the gear in the sidebar header — larger text, higher contrast, underlined links, reduced motion |
| Reduced motion honoured without being asked | `prefers-reduced-motion` media query, and it seeds the panel's default |

**The two preference stores are deliberately separate.** `memory/interaction.json`
is committed, agent-facing, and about the conversation. The site control is
per-viewer `localStorage`, never leaves the browser, and is about reading. A
reader who is not the author choosing large type must not silently reconfigure
how an agent talks to the author.

### 2.7 What is not done

Stated rather than implied, because a half-claimed accessibility feature is
worse than an absent one:

- **No ATAG Part B checks in the QA sweep.** Nothing yet verifies that a
  published folio has alt text, correct heading order or table headers.
- **No audit of generated PDFs.** The document render path goes through
  weasyprint/prince/wkhtmltopdf and tagged-PDF output has not been checked.
- **No screen-reader testing.** The site controls are built to the criteria and
  have not been driven with NVDA, JAWS or VoiceOver. Built to spec is not the
  same as verified.
- **Audio modality is described, not implemented.** The rules are written down;
  no voice channel is wired up.

## 3. Forcing agentic Q&A into guided questions

The answer is a separation.

### 3.1 Two things that look like one

**What to ask next** is a *decision*. Inputs are the facts known so far; output
is the id of the next question, or `none` when enough is known. It belongs in a
DMN table, is reviewable by whoever owns the process, and is identical for every
user.

**How to render the question** is the *modality*. A numbered list in chat;
spoken alternatives, one at a time, over audio; large-type radio buttons on a
web page. The decision table never learns about any of this.

```
 facts ──▶ [ next-question.dmn ] ──▶ question id ──▶ renderer(profile) ──▶ user
   ▲                                                                        │
   └──────────────────── answer recorded as a new fact ─────────────────────┘
```

One logic, four surfaces. Add a modality by adding a renderer; the interview
does not change. Change the interview by editing a table; no renderer changes.

### 3.2 Four properties this buys

1. **The question set is finite and reviewable.** You can read the table and
   know every question the agent is able to ask. An improvising agent offers no
   such guarantee, and cannot be reviewed before it meets a user.
2. **It terminates.** A table whose output can be `none` has a stopping
   condition.
3. **Asking becomes obligatory rather than optional.** This is the trick
   [`folio-intent.dmn`](getting-started.html#why-two-rules-return-ask-and-why-that-is-the-point)
   already uses: `ask` is an *outcome of the table*, so the agent cannot route
   past it. An agent that decides for itself whether to ask will, under any
   pressure to seem helpful, decide not to.
4. **A skipped question is auditable.** The facts are recorded; replay the table
   and see which rule fired.

### 3.3 The options, and what each costs

Four ways to do this, in increasing order of ambition. Only the first is built.

| option | what it is | cost |
|---|---|---|
| **A — decision-per-gateway** *(built)* | each ambiguous branch point in a BPMN carries `cat-harness.processes:decision`; the table returns the branch, `ask` included | no interview state machine — the *process* is the state. Cannot express "ask these four in any order" |
| **B — a question set behind one gateway** | a `next-question.dmn` looping until it returns `none`; answers accumulate as facts | one more table and a fact store; the loop is the process's own, so nothing new executes |
| **C — DMN-driven forms** | the same table renders a form on the site, not only a chat exchange | needs a fact schema and a renderer per modality; the table is unchanged |
| **D — full DMN/BPMN interview engine** | sub-processes per topic, boundary events for "I changed my mind" | real engine work, and the FEEL subset would have to grow |

### 3.4 Limits, stated plainly

- **The FEEL subset is small.** `src/workflow/decision-table.ts` implements
  equality, comparison and one-of. Ranges, `not()` and function calls are
  *refused* rather than silently mis-evaluated — a table that returns an answer
  and is not the table on the page is worse than one that throws.
- **An open question is not a decision.** "What is this paper about?" does not
  belong in a table, and forcing it there produces a worse interview.
- **A conversation is not a wizard.** A user must always be able to say
  something the table did not anticipate. That is what the "tell me more" option
  is for, and it is not optional garnish.
- **Guided does not mean interrogating.** The largest accessibility win
  available is the question you did not have to ask — every fact the agent reads
  from the filesystem is one fewer.

## See also

- [Getting started](getting-started.html) — the intent decision table in use
- [`interaction-modality` skill]({{ '/reference/skill-instructions/interaction-modality.html' | relative_url }})
- [Publication workflow](https://litlfred.github.io/folio-assistant/folio-assistant-core/process/publication-workflow.html) — every process in the repo

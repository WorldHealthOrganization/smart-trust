---
$schema: folio-methodology/v1
name: automatic-term-extraction
title: Automatic term extraction — propose candidate terms from prose, rank them, and let a person decide
origin: >
  Automatic term extraction (ATE) as surveyed by Hanh Thi Hong Tran, Matej
  Martinc, Jaya Caporusso, Antoine Doucet and Senja Pollak, "The Recent
  Advances in Automatic Term Extraction: A survey" (arXiv:2301.06767v1, CC BY
  4.0), ingested whole and read. The C-value measure for nested multi-word
  units is Katerina T. Frantzi and Sophia Ananiadou, "Extracting Nested
  Collocations", COLING 1996 (ACL Anthology C96-1009, CC BY-NC-SA 3.0),
  ingested whole and read; its equations were checked against the printed
  page, because the Anthology's own text layer is a poor OCR. The later
  C-value/NC-value papers that apply the measure to terms (Frantzi, Ananiadou
  & Tsujii 1998; Frantzi, Ananiadou & Mima 2000) are not open access and are
  not held.
evidence:
  - library/arxiv-2301.06767v1
  - library/frantzi-ananiadou-1996-c-value
applies-when: >
  **Finding which words and phrases in a body of prose are the TERMS of its
  domain, so that a glossary can be proposed from the text rather than typed
  from memory.** It answers *which strings are candidate terms, ranked*. Every
  output is a candidate: a person decides what is a term and writes its
  definition (`glossary-terms`: an extractor writes `candidate`, only a person
  moves one to `authored`). Not for assigning terms from a closed controlled
  vocabulary (`skill-pipeline-subject-indexing`), not for keywords that
  summarise one document against the others (`lsi`, `correspondence-analysis`,
  the keyword graph), and not for reading definitions a source already states
  in its own glossary section, which are copied verbatim and need no
  extraction.
---

# Automatic term extraction: candidates from prose, ranked, judged by a person

**Adopted 2026-11-10** (cat-harness#1144 follow-up, owner card Q-IDX-1 = A),
so that the glossary skills that read prose for terms rest on a published
method rather than on a house heuristic.

## Its sources: what is held

| source | held | what this node takes from it |
|---|---|---|
| Tran et al. 2023, survey | ✅ `library/arxiv-2301.06767v1` | the task and its two steps (§1), the feature families (§5.1, Fig. 2), the evaluation methods and measures (§6, Fig. 4), nested terms as the main open problem (§8.1) |
| Frantzi & Ananiadou 1996 | ✅ `library/frantzi-ananiadou-1996-c-value` | the C-value measure and its algorithm (§3, equations 1–3), and the human judge as the last step |
| Frantzi, Ananiadou & Tsujii 1998; Frantzi, Ananiadou & Mima 2000 | ❌ not held | C-value applied to terms, and NC-value's context weighting. Nothing here depends on them; they are named so that a reader does not take this node's C-value for theirs |

## The task, in the survey's words

> "ATE systems usually employ a two-step procedure: (1) extracting a list of
> candidate terms, and (2) determining which candidate terms are correct using
> supervised or unsupervised techniques." (§1)

The candidates come from preprocessing (tokenisation, lemmatisation, POS
tagging, chunking). The second step scores them with features from six
families (§5.1, Fig. 2): shape, linguistic, frequency, statistical,
contextual and variational. The statistical family splits in two. Some
measures need no reference corpus, such as **C-value**, TF-IDF and lexical
cohesion. Others compare the domain text with a general one, such as
weirdness, domain relevance and termhood.

## C-value, as Frantzi & Ananiadou define it (§3)

C-value scores a candidate string `a` by how often it occurs, how long it is,
and how often it occurs **inside longer candidates**. It exists for nested
units: a phrase such as "Wall Street" that occurs mostly inside longer ones
("Wall Street Journal") and would score low on its own frequency.

| case | C-value(a) |
|---|---|
| `a` has the same frequency as a longer candidate that contains it (it only ever occurs inside that one) | `0`: not a candidate |
| `a` is not a substring of any extracted candidate | `(|a| − 1) · n(a)` (eq. 2) |
| `a` occurs inside one or more longer candidates, not always the same one | `(|a| − 1) · (n(a) − t(a) / c(a))` (eq. 3) |

`n(a)` is the frequency of `a`, `|a|` its length in words, `t(a)` its total
frequency inside longer candidates, and `c(a)` the number of those longer
candidates. The algorithm visits n-grams from the longest down, after a
minimum frequency cut-off, and revises `t` and `c` of every substring as it
goes. The more different longer candidates contain `a`, the smaller
`t(a)/c(a)` and the higher its C-value.

Two limits the paper states itself. It measured no precision or recall,
because those *"depend on the definition of collocation and they are domain
dependent"* (§4). And it presents the method as **semi-automatic**: *"It is
the human judge that will give the final decision"* (§3). The 1996 paper is
about collocations; applying it to terms is its own stated future work (§6),
done in the papers that are not held.

## How a result is judged (survey §6)

Three evaluation methods: human judges, a dictionary, or a gold standard
list. Three scopes: all results, part of them, or the top k. With a gold
standard the measures are precision, recall and F1. The survey notes that
*"the performance of different approaches is often not directly
comparable"* because the setups differ.

Here, the gold standard for a layer is its own **authored** glossary terms:
precision is the share of candidates a person accepted, and recall is the
share of authored terms that the extractor proposed.

## Nested terms are the hard case (survey §8.1)

Nested terms are *"words or phrases that are both terms themselves and parts
of longer terms"*. The most common error the survey reports for current
systems is that they predict only the shorter, nested term instead of the
whole multi-word term, or the other way round. This is the case C-value was
built for, and it is why C-value is the statistical measure this node names.

## What this platform adopts, and what it refuses

**Adopted:**
- the two steps, candidates then scoring;
- C-value as the first scoring measure, because it needs no reference corpus
  and it addresses nested terms;
- evaluation against the layer's authored terms, reported as precision and
  recall, and never as one score.

**Refused:**
1. **An extracted term is never a definition.** It enters the glossary as
   `candidate`, with no definition until a person writes one. This is the
   1996 paper's human judge, and it is `glossary-terms`' existing rule.
2. **A score is not a decision.** The ranking orders the review queue. A
   cut-off may shorten the queue, but it never promotes a term.
3. **A measure the sources do not define is not added under this node's
   name.** NC-value's context weights, or the log-length variant of C-value,
   come in with their own held source or not at all.

## How it is performed here

The glossary skills that read prose for terms name this node in their
`uses-methodology`, and the Tool that computes C-value satisfies them. Both
live in the content layer, which links down to here. The Tool's test
reproduces Table 2 of the 1996 paper. By default it applies the paper's
method as published, which on ordinary prose ranks function phrases such as
"it is" first (the paper: many candidates *"may seem unimportant"*, §4).

---
$schema: folio-methodology/v1
name: correspondence-analysis
title: Correspondence analysis for retrieval — decompose the departure from independence, not the counts
origin: >
  Correspondence analysis is Jean-Paul Benzécri's (L'Analyse des Données,
  1973) and is set out in Michael Greenacre, Theory and Applications of
  Correspondence Analysis (Academic Press, 1984) and Correspondence Analysis in
  Practice (3rd ed., 2017). Its application to information retrieval, and the
  comparison with latent semantic analysis this node rests on, is Qianqian Qi,
  David J. Hessen and Peter G. M. van der Heijden, "Improving information
  retrieval through correspondence analysis instead of latent semantic
  analysis", Journal of Intelligent Information Systems (2023),
  doi:10.1007/s10844-023-00815-y — open access, ingested whole and read.
evidence:
  - library/qi-hessen-vanderheijden-2023-ca-vs-lsa
applies-when: >
  **The same question as `lsi` — which units of a prose graph are close in
  what they are about — when the answer must not be dominated by how LONG a
  unit is or how COMMON a term is.** CA removes those margins by construction,
  so it is the method to reach for when LSI's first dimensions are margins
  (a first dimension with no negative pole) or when the question is which
  units are UNUSUAL — outlier pages, specimen text, a list among prose. It
  answers *which units have similar term profiles, relative to independence*.
  Like `lsi`, every output is a PROPOSAL. Not for choosing between the two
  methods by blending them (`methodology-adoption` §"Parallel, not
  composable"), not for a controlled vocabulary
  (`skill-pipeline-subject-indexing`), and not for any decision.
---

# Correspondence analysis: the SVD of the standardised residuals

**Adopted 2026-09-29** (work item `ansc`, issue #1482), as option G of the LSI
work, and measured against LSI on this repository's one ground truth before
being adopted.

## Its sources: what is held

| source | held | what this node takes from it |
|---|---|---|
| Qi, Hessen & van der Heijden 2023 | ✅ `library/qi-hessen-vanderheijden-2023-ca-vs-lsa` | the definition (§2.2), the retrieval use and the transition formula, the weighting and `α` variants (§3), the worked example the engine is tested on (Table 1, Fig. 1) |
| Greenacre 1984 / 2017 | ❌ not held | cited by Qi et al. for the method; nothing here depends on it beyond what Qi et al. restate |
| Benzécri 1973 | ❌ not held | the origin, for attribution only |

## The load-bearing idea, in the paper's words

> "the solution of LSA is a mix of the associations between documents and
> terms, and marginal effects arising from the lengths of documents and
> marginal frequencies of terms" — and "CA ignores the information on marginal
> frequency differences between documents and between terms from the solution
> by preprocessing the data, and it only focuses on the relationships between
> documents and terms" (§2.1).

## The method, as Qi et al. define it (§2.2)

| # | step | definition |
|---|---|---|
| 1 | proportions | `P = F / N` for the document × term count matrix `F`; row masses `r = P1`, column masses `c = Pᵀ1` |
| 2 | residuals | `S = D_r^{-½}(P − E)D_c^{-½}` with `E = rcᵀ`, the expected proportions under independence. `‖S‖²` is the **total inertia**, *"the Pearson χ² statistic divided by sample size"* |
| 3 | SVD | `S = UΣVᵀ`; keep `k` |
| 4 | coordinates | standard `Φ = D_r^{-½}U`, `Γ = D_c^{-½}V`; documents at `ΦΣ`, terms at `ΓΣ`. *"Euclidean distances between the rows of ΦkΣk ... approximate χ²-distances between the rows ... of F"* |
| 5 | margins removed | `Σ_i r_i φ_ik = 0 = Σ_j c_j γ_jk` — every dimension is orthogonal to the margins |
| 6 | new document | the transition formula (eq. 8): *"a new document d ... can be projected onto the k-dimensional subspace by placing it in the weighted average of the column points using (d / Σ d_j) Γk"* |
| 7 | variants | weighting the raw matrix before CA (§3.1) and a singular-value exponent `α` (§3.2): coordinates `ΦΣ^α` |

**What the paper found:** on four datasets, *"CA always performs better than
LSA"* in mean average precision, under each of four feature extractions;
weighting the input *"can improve CA; however, it is data dependent and the
improvement is small"*; `α` *"often improves the performance of CA; however,
the extent of the improvement depends on the dataset and the number of
dimensions"*; and *"cosine similarity performs better than the Euclidean
distance and dot similarity"* (§6).

## Measured here, 2026-09-29

On the one ground truth this repository has — the epics 250 open work items were
already filed under, leave-one-out over 21 epics, on the work item store as it
stood **before** the LSI-driven re-filing (after it, LSI would be scored
against its own proposals):

| method | agree | paired with | only this one | only the other | exact McNemar |
|---|---|---|---|---|---|
| CA, raw, k=100 | 146 | LSI, raw, k=100 (136) | 27 | 17 | p = 0.17 |
| CA, raw, k=100 | 146 | LSI, log-entropy, k=100 (149) | 13 | 16 | p = 0.71 |
| CA, raw, k=200 | 157 | LSI, log-entropy, k=200 (153) | 19 | 15 | p = 0.61 |

**The direction agrees with Qi et al. on the same feature extraction (CA over
raw-count LSA); the size is not significant at n = 250; and weighted LSI
closes the gap.** Neither method is shown better at filing work items, so the
filing default stays `lsi` and this node is a parallel track, not a
replacement.

**Two observations on the IRIS replica library (342 sections)**, recorded as
observed here, not as claims from a held source:

- LSI's dimension 1 places **all 342** sections on one side — a margin, as Qi
  et al. describe. CA's dimension 1 splits them 46 / 296 — a contrast. The
  paper's central claim holds on this corpus.
- CA's leading dimensions are carried by the most **distinctive** profiles:
  the style manual's list of place names, and the Lorem-ipsum and font-specimen
  pages. The χ² metric weights a rare profile heavily. That makes CA the
  sharper instrument for finding outlier pages, and a noisier one for reading
  themes.

## What this platform adopts, and what it refuses

**Adopted:** steps 1–6 on the RAW counts (the paper: processing the raw matrix
*"is considered an integral part of CA"*); cosine for comparison; `α` and a
weighted input available as options, off by default, because the paper finds
their gain data-dependent and this repository measured none that is
significant.

**Refused**, for the same reasons as `lsi` and with the same numbering:
a CA cosine is never merged with a lexical match (1); a dimension is not a
topic until a person names it (2); CA output never writes a relation (3); it
is never evidence for a claim in content (4). And one of its own:

5. **A unit with no indexed term is not placed.** Its profile is undefined, so
   its row is taken as zero — it is dropped from the analysis and scores 0
   against everything, rather than being given a made-up position.

## How it is performed here

`pipeline/ca.ts`, sharing `lsi.ts`'s term matrix and randomized SVD
(Halko et al.) so that a comparison is between decompositions and not between
vocabularies. The residual matrix is never formed: products with `S` and `Sᵀ`
are one sparse product plus a rank-one correction each. `ca.test.ts` checks
it against the paper's Table 1: the first two principal inertias (0.475,
93.2 %; 0.017, 3.4 %), their sum equal to χ²/N, jaguar between the cat and car
terms, every dimension centred on the masses, and the transition formula
returning each document to its own coordinates. `bun run cat lsi:epics --method ca`
runs it on the work item store; the skill is
[`lsi-indexing`](../skills/kg/graph-management/lsi-indexing.md).

---
$schema: folio-methodology/v1
name: lsi
title: Latent Semantic Indexing — retrieve and relate by co-occurrence structure, not by shared words
origin: >
  Scott Deerwester, Susan T. Dumais, George W. Furnas, Thomas K. Landauer and
  Richard A. Harshman, "Indexing by Latent Semantic Analysis", Journal of the
  American Society for Information Science 41(6):391–407 (1990), for the
  method. Susan T. Dumais, "Improving the retrieval of information from
  external sources", Behavior Research Methods, Instruments & Computers
  23(2):229–236 (1991), for the log-entropy term weighting. Michael W. Berry,
  Susan T. Dumais and Gavin W. O'Brien, "Using Linear Algebra for Intelligent
  Information Retrieval", SIAM Review 37(4):573–595 (1995), for folding-in and
  updating. Thomas K. Landauer, Peter W. Foltz and Darrell Laham, "An
  Introduction to Latent Semantic Analysis", Discourse Processes 25:259–284
  (1998), and Thomas K. Landauer and Susan T. Dumais, "A Solution to Plato's
  Problem", Psychological Review 104(2):211–240 (1997), for the cognitive
  reading of the same computation (there called LSA), which this node does NOT
  adopt. Nathan Halko, Per-Gunnar Martinsson and Joel A. Tropp, "Finding
  Structure with Randomness", SIAM Review 53(2):217–288 (2011;
  arXiv:0909.4061v2), for the randomized SVD this platform computes it with —
  an implementation source, not part of the method.
evidence:
  - library/deerwester-1990-indexing-by-lsa
  - library/landauer-foltz-laham-1998-intro-lsa
  - library/arxiv-0909.4061v2
  - library/qi-hessen-vanderheijden-2023-ca-vs-lsa
  - library/arxiv-2202.02427v1
applies-when: >
  **Finding or relating units of text that discuss the same thing in different
  words, across a corpus too large to read whole, where no controlled
  vocabulary has been assigned.** Use it to ask "what else in this graph is
  about this?", to propose a home for an unfiled item among existing groups,
  to find near-duplicates, and to surface clusters nobody named. It answers
  *which units are close in co-occurrence structure*. It does NOT answer
  whether a unit is relevant, correct, or a dependency: every output is a
  PROPOSAL a person or an agent confirms. Not for assigning terms from a
  controlled vocabulary (`skill-pipeline-subject-indexing`), not for judging
  an assignment (`consensus-grounded-subject-evaluation`), and not for any
  decision (`kepner-tregoe`, `dmn`).
---

# Latent Semantic Indexing: the vocabulary problem, answered with a truncated SVD

**Adopted 2026-09-29** (work item `ansc`, issue #1482). **Checked against its
primary source the same day**, after the owner supplied the PDFs.

## Its sources: what is held, what is not

The node was first written with no source reachable — the container's egress
policy answers 403 to `lsa.colorado.edu`, `arxiv.org` and `en.wikipedia.org`.
The owner uploaded the papers; they were ingested through `library-ingestion`
and this node was rewritten against them. **Two sentences of the first draft
were wrong and are corrected below** (the choice of `k`, and stemming).

| source | held | what this node takes from it |
|---|---|---|
| Deerwester et al. 1990 | ✅ `library/deerwester-1990-indexing-by-lsa` | the method, read whole |
| Landauer, Foltz & Laham 1998 | ✅ `library/landauer-foltz-laham-1998-intro-lsa` | the only HELD description of log-entropy weighting (its p. 17) |
| Halko, Martinsson & Tropp 2011 | ✅ `library/arxiv-0909.4061v2` | the engine's algorithm (Algorithms 4.4 and 5.1) |
| Qi, Hessen & van der Heijden 2023 | ✅ `library/qi-hessen-vanderheijden-2023-ca-vs-lsa` | the critique in §"What it is not good at" |
| Hang, Schnabel, Yang & Neville 2022 | ✅ `library/arxiv-2202.02427v1` | a parallel track for incremental updating; not adopted |
| Dumais 1991 | ❌ not held | cited for the log-entropy FORM the engine uses — unverified, see below |
| Berry, Dumais & O'Brien 1995 | ❌ not held | cited for updating — the claim the node relies on is also in Deerwester 1990, footnote 3 |
| Landauer & Dumais 1997 | ❌ not held | the cognitive reading, refused |

## The load-bearing idea, in the paper's words

> "users want to retrieve on the basis of conceptual content, and individual
> words provide unreliable evidence about the conceptual topic or meaning of a
> document. There are usually many ways to express a given concept, so the
> literal terms in a user's query may not match those of a relevant document.
> In addition, most words have multiple meanings" — Deerwester et al. 1990, §1.

The paper names the two sides **synonymy** (hurts recall) and **polysemy**
(hurts precision), and its empirical premise is Furnas et al.'s: *"two people
choose the same main key word for a single well-known object less than 20% of
the time"* (§2). And it is explicit about what "semantic" means — only this:

> "By 'semantic structure' we mean here only the correlation structure in the
> way in which individual words appear in documents" — §2, footnote 1.

## The method, as the 1990 paper defines it

| # | step | what the paper does |
|---|---|---|
| 1 | **Units and vocabulary** | title + abstract as the document; *"all terms occurring in more than one document and not on a stop list of 439 common words used by SMART"* (§5). No stemming. Terms in one document, or evenly in all, *"have little or no influence on the SVD solution"* (fn. 6) |
| 2 | **Term × document matrix** | raw counts: *"each cell indicates the frequency with which each term occurs in each document"* (§5). The paper deliberately adds **no** weighting, stemming or phrases, *"in order to better evaluate the utility of the basic representation technique"* |
| 3 | **Truncated SVD** | `X = T₀S₀D₀′`; keep the `k` largest singular values; `X̂ = TSD′` *"is the matrix of rank k which is closest in the least squares sense to X"* (§4.2.1) — the Eckart–Young theorem, stated there without the name |
| 4 | **Choose `k`** | *"The proper way to make such choices is an open issue"*; the paper uses *"an operational criterion - a value of k which yields good retrieval performance"* (§4.2.1). It works with **50–100** factors, reports ~100, and on MED precision rises from .25 to .52 as `k` goes 10 → 100 (§5.1, Fig. 5). Solutions are **nested**: the first 10 coordinates of a 100-factor solution are the 10-factor solution (fn. 9) |
| 5 | **Compare** | documents by rows of `DS`, terms by rows of `TS`, term-to-document by `TS^½` against `DS^½` — *"it is not possible to make a single configuration of points in a space that will allow both between and within comparisons"* (§4.2.3) |
| 6 | **Query (folding-in)** | a query is a *pseudo-document*: `Dq = Xq′TS⁻¹`, *"placing the pseudo-document at the centroid of its corresponding term points"*, then scaled by `S` for document comparisons (§4.2.4). Retrieve by cosine |
| 7 | **Update** | *"simply folding-in new terms or documents will result in a somewhat different space than would have been obtained had these objects been included in the original analysis ... How much of this can be done without rescaling is an open research issue"* (§3.2, fn. 3; again §6). **An index is therefore stale by construction once its corpus changes** — the property the QA criterion checks |

**The paper does not interpret the dimensions:** *"We make no attempt to
interpret the underlying factors, nor to 'rotate' them to some meaningful
orientation"* (§4.1).

## What the paper found, exactly

- **MED** (1,033 abstracts, 30 queries, 5,823 terms, k = 100): average
  precision .51 vs .45 for term matching, *"a 13% improvement"*; the gain is
  at high recall, because *"latent semantic indexing is designed primarily to
  handle synonymy problems (thus improving recall); it is less successful in
  dealing with polysemy (precision)"* (§5.1). The authors warn MED *"may have
  resulted in unrealistically good results"* — it was built from keyword
  searches, so it is unusually well-segmented.
- **CISI** (1,460 abstracts, 35 queries): .11 for both LSI and term matching;
  SMART, which stems, did better (.14). Re-run on SMART's own terms, LSI tied
  SMART at .14. So: *"Stemming ... seems to capture some structure that LSI
  was unable to capture"* (§5.2).
- Their own summary: *"modestly encouraging"* — better than term matching in
  one standard case and equal in the other (§5.3), and *"a potential component
  of a retrieval system, rather than as a complete retrieval system"* (§6).

## What this platform adopts, and what it refuses

### Adopted

- Steps 1–7. Units are the graph's own nodes — a library **section**, a skill
  file, a work item — because the KG already chunks semantically (work item `p2en`).
- **Log-entropy weighting by default, which the 1990 paper does not use.** The
  paper asks for weighting to be added (*"refinements such as stemming,
  phrases, term-weighting ... generally result in performance improvements"*,
  §5) and Landauer, Foltz & Laham (1998, p. 17) describe the customary
  transform: *"the word frequency (+ 1) in each cell is converted to its log.
  Second, ... entropy, of each word is computed as −Σ p log p over all entries
  in its row, and each cell entry then divided by the row entropy value."*
  **The engine uses a different form of the same idea** — global weight
  `1 + Σ p log p / log n`, i.e. one minus the normalised entropy — which is the
  form attributed to Dumais (1991). That paper is not held, so the attribution
  is unverified; the held source's form (divide by entropy) is not what runs.
  Measured here, on the one task that has a ground truth (epic filing,
  2026-09-29): log-entropy 59 % vs tf-idf 52 % agreement. `raw` is available
  and is what the engine's test uses, against the paper's worked example.
- The first dimension is reported but **read as a margin, not a theme** — see
  Qi et al. below.
- Recompute rather than fold in whenever the input fingerprint changes: at
  this corpus size a rebuild takes about a second. Folding-in is used only for
  things that are not units of the index (a query, a branch, a PR).

### Refused, with reasons

1. **A latent cosine is never merged with a lexical match.** `graph-search`
   refuses to rank because a made-up order hides that everything matched
   equally. A cosine is defined, but it answers a different question — and
   the paper itself positions LSI as *"a potential component"*, beside term
   matching rather than instead of it.
2. **A dimension is not a topic until a person names it.** The paper makes
   *"no attempt to interpret the underlying factors"*; dimension summaries are
   published for review, not as labels.
3. **LSI output never writes a relation.** It proposes a parent for a work item, a
   `uses[]` candidate, a duplicate pair; it writes none. `uses[]` is the
   editorial relation and a score would destroy its signal.
4. **LSI similarity is never evidence for a claim in content.** It is a
   retrieval aid. Nothing it computes enters a proof, a formal statement, a
   recommendation or a GRADE judgement.
5. **The cognitive reading is not adopted.** Landauer, Foltz & Laham (1998) and
   Landauer & Dumais (1997) present the same computation as a theory of human
   meaning. The 1990 paper claims only correlation structure (fn. 1), and so
   does this platform.
6. **No stemming — and this is a cost, not a free lunch.** Stemming is
   language-specific and the corpus is multilingual by design, so it is not
   done. **The first draft of this node said LSI recovers much of what
   stemming would; the paper's own CISI result says otherwise**, and its
   authors write that in theory LSA can extract commonalities between stemmed
   forms but *"In practice, we may often have insufficient data to do so"*
   (§5.2). The loss is accepted, and stated.

## What it is not good at

- **Polysemy.** *"every term is represented as just one point in the space. ...
  a word with more than one entirely different meaning (e.g. "bank"), is
  represented as a weighted average"* (§6).
- **The first dimensions carry margins, not meaning.** Qi, Hessen & van der
  Heijden (2023) show *"The initial dimensions extracted by latent semantic
  analysis (LSA) of a document-term matrix ... mainly display marginal effects,
  which are irrelevant for information retrieval"* — document length and
  overall term frequency. Observed here: dimension 1 of both the IRIS replica and
  skills indexes has **no negative pole at all**, the signature of a margin.
- **Word order and negation.** A bag of words; the paper lists *"a method of
  handling negation"* among refinements it did not add (§5.3).
- **`k` has no rule.** The paper says so, and the calibration here (59–63 %
  over k = 50–250) found the choice barely matters for filing.
- **Search is exhaustive.** *"the only way documents can be retrieved is by an
  exhaustive comparison of a query vector against all stored document
  vectors"* (§6) — fine at thousands of units.

## The parallel tracks, and why they are not this node

| track | answers | why it is separate |
|---|---|---|
| lexical search (`graph-search`) | which nodes contain these words, and what is adjacent | exact, explainable, no score; LSI sits beside it |
| **correspondence analysis** (Qi et al. 2023) | the same retrieval question, by an SVD of the **standardised residuals** from the independence model rather than of the weighted counts | its own node, [`correspondence-analysis`](correspondence-analysis.md) (adopted 2026-09-29): margins removed, χ² structure. Measured here against this node on work item filing: no significant difference (McNemar p = 0.17–0.71) — **not blended into this one** |
| incremental compositional embeddings (Hang et al. 2022) | how to place newly arriving nodes without retraining: explicit vectors for the stable node type, the rest *"represent[ed] implicitly, through a composition function based on their interactions"* | the same shape as folding-in (a new document = centroid of its terms), but a learned model evaluated on recommendation; not adopted |
| dense neural embeddings (`docs/proposals/rag-document-ingestion.md`) | the same question, from a model pre-trained elsewhere | needs a model download (403 in the sandbox), not reproducible from the corpus alone |
| `skill-pipeline-subject-indexing` | which controlled-vocabulary terms a work should carry | closed vocabulary, policy-governed; LSI has no vocabulary to validate against |

**Pick one per question** (`methodology-adoption` §"Parallel, not
composable").

## How it is performed here

The skill is [`lsi-indexing`](../skills/kg/graph-management/lsi-indexing.md); the
engine is `pipeline/lsi.ts`, computed by Halko et al.'s randomized
subspace iteration (their Algorithm 4.4: Gaussian test matrix, oversampling
p = 10, re-orthonormalisation between every pass) and direct SVD of the small
matrix (Algorithm 5.1). **One deviation, stated:** the small SVD is taken from
the eigendecomposition of `BBᵀ`, which squares the condition number and so
loses relative accuracy on the smallest retained singular values; acceptable
for ranking, not for reporting those values to many digits.
`pipeline/lsi.test.ts` checks the engine against the 1990 paper's own
worked example: the nine singular values of its 12 × 9 matrix to the two
decimals printed, and the query *"human computer interaction"* retrieving c3
and c5, which share no term with it.

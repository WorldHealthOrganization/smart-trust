---
name: lsi-indexing
description: >-
  Build, read and audit a Latent Semantic Indexing index over a declared prose
  graph — a library, the skills, the work items, docs — to find units that discuss
  the same thing in different words, near-duplicates, outlier clusters, and a
  proposed home for unfiled work. Every output is a proposal; LSI never writes
  a relation.
graph-typologies:
  - library
  - skills
  - beans
  - docs
uses-methodology:
  - lsi
  - correspondence-analysis
---

# LSI indexing — the platform's application of `methodologies/lsi.md`

**The method is the node, not this file.** [`lsi`](../../../methodologies/lsi.md)
carries what LSI is, its sources, and the six refusals. This skill says how to
run it here and how to read what comes back. Where the two disagree, the node
wins.

## When to reach for it

| you are asking | use |
|---|---|
| "which nodes contain these words?" | `graph-search` — lexical, exact, no score |
| **"has anyone worked this topic in *other* words?"** | `bun run cat lsi query "<text>" --instance <i> --graph <g>` |
| "is this new bean / section a restatement of an existing one?" | the sidecar's `nearDuplicates` |
| "what is this graph about, as a whole?" | the sidecar's `dimensions` (read both poles) |
| "is there junk in this library — boilerplate, specimen text, a bad page?" | the sidecar's `narrowDimensions` |
| "which epic does this bean / branch / PR belong under?" | `bun run cat lsi:epics` |

Run the lexical search FIRST. LSI supplements an empty or thin lexical result;
it never replaces a lexical hit, and its hits are always reported under their
own label (`latent only` vs `lexical+latent`) — refusal 1.

## Commands

```sh
bun run cat lsi index --instance <instance> --graph library      # build + write the sidecar
bun run cat lsi index --instance <instance> --graph library --doc 9789241548960-eng   # one document
bun run cat lsi query "certainty of the evidence" --instance <instance> --graph library
bun run cat lsi:audit                                          # which graphs need one; is each fresh?
bun run cat lsi:epics --out <file.md> [--prs <open-prs.json>]  # epic-filing proposal
bun run cat lsi:near "<planned bean title>"                    # before `beans create`
bun run cat-harness-tools/pipeline/graph-search.ts "<q>" --latent   # lexical + graph, THEN a separate latent list
```

**From an MCP host**: the `lsi_query` tool (Tool node `lsi-query`), with the
query as `text` and optional `instance` / `graph`. On a shell the query goes on
STDIN (`echo "<q>" | bun run cat lsi query --instance <iris-replica> --graph library`),
because free text never goes on a command line.

A **unit** is the graph's own chunk: a library **section** (what ingestion
already produced), otherwise one markdown file. Units under 20 tokens are
skipped — too little vocabulary to place.

## Beyond the beans: other graphs in `lsi:near`

`lsi:near` also searches every graph a layer declares under
`lsiUnitProviders` in its `<instance>.json`: content **blocks** (core) and
**Lean declarations** (sci). It prints **one list per graph**. Scores from two
separately built indexes are not comparable, so the lists are never merged
into one ranking.

Each list starts with **explicit** references: a block `@id` or a Lean name
written in the query text. These are deterministic and unscored. The latent
hits come after them, labelled `lexical+latent` or `latent only`. A graph
that could not be indexed is shown as **not searched**, never as "no hits".

```sh
bun run cat lsi:near "<planned bean title>" --graphs blocks,lean-decl --root lean-decl=<lean dir>
```

## Cross-document links — a floor, and hubs reported, not penalised

`bun run cat lsi links --instance <i> --graph <g>` proposes links between units of
DIFFERENT documents in one graph: each unit's best other-document match, only
at cosine ≥ 0.5 (`LINK_FLOOR`), with the units that are "nearest" to many
others listed as **hubs** to discount. Most units get no link when the median
best match is low, and that is the honest answer.

**There is no hub PENALTY.** A CSLS-style penalty (`2·cos − r(a) − r(b)`) made
ranking worse on reader-labelled pairs (real-vs-spurious AUC 0.96 with plain
cosine, 0.75–0.79 with the penalty): a hub is often central because it is
genuinely on-topic. The floor is a house number fitted to 15 labelled
examples.

## Keywords — the per-unit view

The weighted matrix says which terms characterise each unit before the index
reduces it to k dimensions. `keywordsOf(matrix, cols, texts, top, headings)`
keeps that view: a unit's (or a
pooled set of units') top terms and two-word phrases, from the same weights.
Its first consumer is `bun run cat library:keywords` (per library section and per
document, written as `keywords.json` and shown in the library viewer). The
scoring rules are documented with `keywordsOf` in `pipeline/lsi.ts`,
and the ingestion skill that runs it says when (`skill_fetch
l1-document-ingestion`, §"Keywords"). Reuse it for any unit set the index
covers — work items, chapters — rather than writing a second term weighting.

## Correspondence analysis — the parallel track

[`correspondence-analysis`](../../../methodologies/correspondence-analysis.md)
is a separate method over the same term matrix (`pipeline/ca.ts`):
the SVD of the χ² residuals, so no dimension carries document length or term
frequency. `bun run cat lsi:epics --method ca` runs it on the work item store.
**It is not significantly better or worse than LSI at filing work items** (exact
McNemar p = 0.17–0.71), so LSI stays the default. Reach for CA
when an LSI dimension 1 has no negative pole, or when the question is which
units are UNUSUAL — CA's leading dimensions go to the most distinctive
profiles. Pick one per question; never average the two scores.

## On ingestion — the index refreshes itself

`bun run cat ingest … --promote` ends by re-indexing the library it wrote into
and printing, for the promoted document only, its near-duplicate section
pairs and any narrow dimension it carries. **Advisory**: an index is not part
of L1, so a failure prints "not refreshed — this is not a pass" and the
ingest still succeeds. Read the lines while the document is fresh: a narrow
dimension on a new document is almost always boilerplate, specimen text or a
mis-extracted page, and it is cheapest to mark now.

## Where to LOOK at an index

**Its health** is in the repository health report: `bun run cat health`,
check `lsi-indexes`. It lists every declared prose graph that needs an index
and lacks a fresh one, with the command that builds it, and each stored
index's narrow-dimension and near-duplicate counts. **Its content** (the
dimensions as two poles, the near-duplicate pairs, the narrow-dimension
units) is the sidecar below; read it with `lsi query` or open the file.

`bun run cat lsi:viz` writes the **Indexing evidence** page at
`/cat-harness/lsi/` (`/lsi/` is its declared alias). Until cat-harness#1144 it
drew the indexes; the owner (2026-11-08) made it the evidence chain instead.
For each indexing method (this one, `correspondence-analysis`,
`skill-pipeline-subject-indexing`, `consensus-grounded-subject-evaluation`) it
shows the held papers it rests on, the skills that declare `uses-methodology`
for it, the Tools that satisfy those skills, and the processes that call
them. It also lists the indexing skills that apply no method, such as
glossary work and lexical search, as having no evidence yet. So a skill that
reads this index (keywords, `lsi:near`, `graph-search --latent`) gets the
papers as its evidence by declaring `uses-methodology: lsi`. cat-harness
DECLARES the page (`visualisers` entry `lsi`, `renderedBy: lsi-viewer`), so it
appears on the navbar and the central **Published graphs** page with no
further wiring. The page is excluded from every index's units.

## Where the index lives, and what is stored

`test/results/lsi/<instance>/<graph>.lsi.json` — the fingerprint,
parameters, retained variance, per-dimension pole terms, each unit's three
nearest neighbours, and the findings. **Not the vectors**: a rebuild is about a
second per few hundred units, and a float dump is not reviewable.

That path is the **working copy, and nothing under it is committed**. The
record is the commit-keyed entry the CI job `qa-publish` stores on the orphan
`qa-reports` branch (`main/<sha>/`, `pr/<n>/<sha>/`). The readers cope with its
absence: with no `test/results/lsi/` in the checkout, the verdict
rebuilds the index in memory and judges that run, writing nothing, and the
health check reads the indexes by ref through `qa-store` (`main`). Anything
but a hit is `unknown`, never "no index is missing".

**The Indexing evidence page is never committed.** It is declared under
`builtAtPublish` in `cat-harness.json` (`docs/en/cat-harness/lsi/`), because
it joins every instance's methodologies, skills, Tools and processes, so it
moves with the index's pins, not with one commit. It reads no stored index;
`--detail` and `--ref` are accepted and ignored.

**A merge strategy does not stop a generated file conflicting**, even when the
file is reproducible and take-base plus a regeneration converges. An SVD
rotation is globally sensitive: one sentence added to one skill rewrites most
of a sidecar's `dimensions` and `neighbours`, so there is no small diff to
merge. A declared strategy (`derived-results`/take-base) settles **how** a
conflict is resolved, never **whether** one arises. Ask of a conflicting
generated file **"what is this file's record, and is `main` it?"** Where the
answer is no, take the file off `main`.

**State graphs are indexed on demand, never stored.** The `beans` graph
changes on nearly every commit; a stored index would be stale on every PR and a
merge-conflict magnet. `lsi:epics` rebuilds it each run.

## Reading a sidecar

- **`retained`** — share of ‖A‖²_F the rank-`k` approximation keeps. It is not
  a quality score; a low value on a large heterogeneous graph (work items: ~45 %)
  is expected.
- **Dimension 1 is usually a margin.** Qi et al. (2023): LSA's first
  dimensions mainly carry document length and overall term frequency. A
  dimension with no negative pole is that signature — skip it when reading
  themes.
- **`dimensions`** — a dimension is a *contrast*, so read the positive and
  negative poles together. Refusal 2: it is not a topic until a person names
  it.
- **`narrowDimensions`** — a dimension ≥ 80 % of whose mass sits on ≤ 3 units
  (or 1 %). Almost always non-prose: Lorem-ipsum layout filler, font
  specimens, a mis-extracted page. Treat as an ingestion finding.
- **`nearDuplicates`** — cosine ≥ 0.95. In the work item store these are work items
  filed twice. A duplicate work item
  is **scrapped with a pointer**, never deleted (`bean-coordination`).

## The need-an-index audit

`bun run cat lsi:audit` walks every declared graph of a prose kind across every
layer and writes `test/results/lsi-need-an-index.qa-results.json`
(`qa-results/v1`).

| result | means |
|---|---|
| `n/a` | below the threshold — **not judged**, which is not the same as fine |
| `fail` | needs an index and has none, or its fingerprint no longer matches |
| `pass` | has a fresh index |

The threshold (≥ 100 units and ≥ 20,000 words) is a **house** number with its
basis stated in `scripts/lsi.ts`; the method gives no corpus-size rule. It
reports and does not gate (exit 0), like `check:methodology-evidence`;
`--strict` exits 1 for a caller that has decided; no CI step runs it yet.

### The same verdict in the audited record — `kg:audit`'s `tool-downstream-fresh`

LSI is the first member of the **downstream-tool family**. The
`lsi-index` Tool node declares `downstream`, and every `bun run cat lsi index`
writes a `folio-tool-run/v1` record — outcome and input fingerprint, on
success AND on failure — under `test/results/tool-runs/lsi-index/`. The
verdict reads three states:

| state | meaning | green? |
|---|---|---|
| fresh | a successful run's recorded fingerprint matches the graph now | yes |
| stale | the graph changed since the recorded run | no |
| not-run / failed | no run record, or the last run failed | **never** |

A sidecar on disk with no run record is `not-run`: a file is not evidence the
run that should keep it current succeeded. `kg:audit` carries this as
`tool-downstream-fresh` on the `lsi-index` Tool (`minor`), one finding per
graph, using the same verdict function as `lsi:audit`. Its finding text carries **no
counts**, so the kg-qa sidecar moves only when a verdict flips.

Two chains keep the indexes fresh, so the criterion stays quiet in
ordinary work:

- **a skill edit** — `skill:register` runs `lsi:skills` before `kg:audit`, and
  CI checks it with `lsi:skills:check`;
- **an ingest** — `--promote` re-indexes the library (§"On ingestion").

A graph that needs an index and has none is a standing `minor` finding on the
`lsi-index` Tool, so "needs one and has none" is a fact in the audited record.

## Epic filing — the qou hierarchy, proposed by evidence

The qou project-management skills (`todo-manager`, `session-intent`) require
every piece of work to sit under a parent work item. `lsi:epics` proposes that
parent for each open work item with no epic, each unmerged branch and each open PR:

1. **explicit first** — a `parent:` chain that reaches an epic, or a work item id
   named in a branch's commit messages (case-insensitive, merge commits
   excluded);
2. **latent second** — cosine to each open epic's centroid (the epic plus all
   descendants of every status, each normalised; leave-one-out for the work item
   being scored). A branch or PR is folded in from its name and commits.

It prints a **calibration line**: of the work items already under an epic, how
often LSI's best guess is the current epic (about 59 % against 21 classes,
flat across k = 50–250; log-entropy beats tf-idf). Read every proposal in that
light.

**A disputed filing is not a misfiling.** A work item filed by *symptom*
(translation catalogues under CI RELIABILITY because they turned `main` red)
may be filed by LSI by *subject* (TRANSLATION). Both are defensible; which axis an epic means is a decision for
the owner, not for the score.

**Never apply the proposal in bulk.** `beans update <id> --parent <epic>` is
done one work item at a time by somebody who read both the work item and the epic.

---
# folio-assistant-34cm
$schema: bean/1.0.0
title: The committed site build under cat-harness/docs/ is 44% of all merge conflicts, and the publish workflow rebuilds it anyway
status: completed
type: bug
priority: normal
created_at: 2026-10-03T08:34:21Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-hfag
---

Owner, 2026-10-03: *"I want you to examine each of the conflicted PR as they
come in to figure out how we can reduce the conflicts/ignore them."* This is
that measurement, taken over the whole open queue at once rather than per PR,
because the answer is a distribution and not a property of any one PR.

## The measurement

Every conflicted path of every open non-draft PR, against `main` `d089aca9616`,
classified with **main's own** `merge-conflict-patterns.ts` (see
`merge-conflict-patterns` rule 3 — classifying from a stale tree over-reports):

| | |
|---|---|
| distinct conflicted paths | 404 |
| path-instances (a path × the PRs conflicting on it) | **704** |
| generated | 591 |
| generated-regions | 57 |
| **authored** | **56 — 8 %** |

Where those 704 live:

| area | instances | share | distinct paths |
|---|---|---|---|
| `cat-harness/docs/` — the committed site build | **308** | **44 %** | 110 |
| `cat-harness/test/results/` — Arc 3fva's target | 239 | 34 % | 186 |
| everything else | 130 | 18 % | 96 |
| `beans/` — `fs43`'s target | 13 | 2 % | 2 |
| `cat-harness/uml/` | 9 | 1 % | 6 |

Worst single paths, by how many PRs collide on them: the LSI trio
(`docs/lsi/index.md`, `test/results/lsi/cat-harness/skills.lsi.json`,
`test/results/tool-runs/lsi-index/cat-harness/skills.tool-run.json`) at **14
PRs each**, then `beans/README.md` at 11, `docs/glossary/index.md` at 10.

## Two remedies are already closed, and the corpus says so

Not re-derived here — `.gitattributes` carries both, and its own write-up
corrects an earlier stronger claim:

1. **`-diff -merge` does not reduce the conflict COUNT.** Measured in a scratch
   repository: both sides changing the file still exits 1 with the path
   unresolved. It buys one clean whole-file conflict instead of markers inside
   a blob, plus a collapsed review diff. Bean `eqxp` claimed an entry would cut
   a real merge from five conflicts to two; that is false and corrected there.
2. **An auto-resolving merge driver needs `git config merge.*.driver`**, which
   is per-checkout — it would work in one clone and nowhere else, CI included.
   Deliberately rejected.

`.gitattributes`'s closing line is the finding this bean quantifies:

> *"Removing these conflicts, rather than tidying them, needs the files off
> `main` altogether."*

## The part that is new: the declared arc targets the SECOND-largest share

`fs43` takes `beans/` off `main` — **2 %**. Arc 3fva (#1764, #1801) takes
`cat-harness/test/results/` off `main` — **34 %**. The largest single source,
the committed site build at **44 %**, has no arc at all.

**And it is the most defensible of the three to remove, because the publish
workflow already rebuilds it.** `.github/workflows/docs-site.yml` runs
`gen-schema-docs`, `gen-skill-docs`, `gen-docs-pages`, `schema:viz`,
`library:viz`, `uploads:viz`, `voices:viz`, `handler:index`,
`translation:index` and `glossary-export` before composing and publishing. So
the committed copies under `cat-harness/docs/` are **not what a reader
fetches**. They exist so a `:check` can detect that somebody did not run a
generator — and the publish step fixes that case regardless.

So 44 % of the merge cost of this repository is paid to keep a drift signal
whose only failure mode the deploy already repairs.

## What this does NOT argue

- **Not that the `:check`s are worthless.** `audit:coverage`'s argument holds:
  a printed verdict cannot tell "never measured" from "measured clean". But
  that argument is about *verdicts* — QA sidecars, witnesses, health reports —
  not about a RENDERING of a source that is itself committed. `docs/glossary/`
  is derivable from the schema files beside it; a sidecar's attestation is not
  derivable from anything.
- **Not a glob over `docs/`.** `.gitattributes` names the test that matters:
  *"does its producer carry anything forward from the existing file"*. Some of
  `docs/` is authored (`docs/guides/`, `docs/proposals/`). The conflicts are
  concentrated in the generated subtrees — `docs-auto/**`, `glossary/**`,
  `lsi/**`, `qa/**`, the per-locale glossaries.
- **Not that `fs43` or Arc 3fva are misprioritised as work.** Both have reasons
  beyond conflict count (clone cost, `gh-pages` weight, evidence provenance).
  The claim is narrower: if the GOAL is fewer conflicts, the ranking is
  docs 44 % > results 34 % > beans 2 %, and only the first is unaddressed.

## Done when

- [x] A decision on the generated subtrees of `cat-harness/docs/`: off `main`
      (a `cat/<harness>/docs` special branch, or built-only), or kept with the
      44 % accepted and written down as accepted — settled in the Built-only direction by the owner's 2026-10-14 ("B1", widened the same day: *"fix all, in proper way"*) `builtAtPublish` ruling (`cat-harness/schemas/built-at-publish.ts` and `cat-harness/cat-harness.json` `builtAtPublish`, 168 literal entries), alongside the 2026-10-08 repository split (`ar1s`) removing `cat-harness/` from `folio-assistant` `main`
- [x] The decision distinguishes RENDERINGS (derivable from committed sources)
      from VERDICTS (carry something forward) — per `.gitattributes`'s own test (`BuiltAtPublishCauseSchema = z.enum(["checkout", "state"])` in `cat-harness/schemas/built-at-publish.ts` for checkout- and state-dependent renderings vs commit-keyed QA verdicts on `cat/cat-harness/qa-reports` under Arc `3fva` and `cat/cat-harness/merge-reviews` under `w8jq`)
- [x] If they come off `main`, the `:check`s that read them still answer, or
      are retired with their reason (`cat-harness/schemas/built-at-publish.test.ts` enforcing `.gitignore` equality and untracked status on `main`, `isBuiltAtPublish(...)` in `:check` gates, and `bun run cat derive:publish` in `cat-harness-tools/scripts/derive-at-publish.ts`)
- [x] This distribution is re-measured afterwards, so the claim is verified
      rather than assumed (re-measured 2026-10-22 below: `cat-harness/docs/` conflicts dropped from 44% → 0%)

## Not decided here

Whether the LSI trio is worth separate treatment. It is the worst single
collision in the store — 14 PRs each on three files, 42 instances, 6 % of
everything — and two of the three are under `test/results/` while one is under
`docs/`, so it straddles the two arcs. It may deserve its own answer before
either arc lands.

## Owner ruling, 2026-10-03: a special branch `cat/cat-harness/auto-docs`

Owner, on being shown the distribution: *"i think we need a special branch
cat/cat-harness/auto-docs"*. That is the remedy `.gitattributes` names — the
files off `main` altogether — applied to the 44 % share.

The name fits the declared convention `cat/<harness>/<subgraph>` and the
harness owns the branch, so by `rva2` the declaration goes in **cat-harness's
own** declaration, not a central table. By `esz4` the branch owes a README
stating what it is, how and when it was generated — and this one is a better
fit for that than any existing special branch, because its contents are a pure
rendering with a single writer.

### What the owner's question "is it mostly timestamp & things?" actually measured

**No — and that matters for the design.** Between `main` and #1888's head, 491
files under `docs/` differ over 34,253 changed lines, of which only **912
(2.7 %)** carry a timestamp. The rest is substance: inlined JS and CSS, JSON-LD
payloads (`skos:definition`, `@value`), prose, table rows. The largest are
`docs/todos/index.html` (+1589) and seven `library/*/index.html` at ~+710 each.

Two honest caveats on that number:

- It is `main` vs a PR head, so it measures **divergence** — both sides
  regenerated — not one PR's own churn. Divergence is the right measure for
  *conflicts*, but it is not "what this PR changed".
- The seven near-identical library diffs suggest a shared template with
  per-instance substitution; their added-line hashes are NOT identical, so a
  single duplicated inlined blob was checked and **ruled out**. The
  amplification mechanism is unconfirmed and should not be asserted.

The consequence for the branch: because the churn is real content rather than a
stamp, **stripping volatile fields would not have fixed this** (the `y7b3`
remedy), and neither would `-merge`. Only moving the files helps.

### Scope: 1862 tracked files under `cat-harness/docs/`, and not all of them move

Candidates for the branch — pure renderings with a single writer:

| subtree | files | writer |
|---|---|---|
| `docs/reference/**` | 330 | `gen-schema-docs`, `gen-skill-docs` — AGENTS.md: never hand-edit |
| `docs/uml/**` | 126 | `uml:overview` |
| `docs/cat-harness/**` | 120 | `gen-docs-auto`, `library:viz` |
| `docs/{ar,es,fr,ru,zh}/**` | 70 | the per-locale glossary |
| `docs/glossary/**`, `docs/todos/**` | 20 | `glossary:page`, `gen-docs-pages` |

Must STAY on `main` — authored: `docs/guides/**` (14), `docs/proposals/**` (34),
`docs/wireframes/**` intent (192 mixed), `docs/_includes/**` (9), and the
authored halves of `docs/assets/**` (609 mixed — `work-plan.js` and
`work-plan.css` are authored, `assets/beans/index.json` is generated).

`docs/assets/**` and `docs/site/**` (183) are the two that need per-path
judgement rather than a glob — the same trap `.gitattributes` names.

### What the branch does NOT solve on its own

The `:check` gates read the committed copies to detect drift. Moving the files
means each one must either read the branch, or be retired with its reason
stated. That is the real work of this bean, and it is why the 44 % has survived
this long: the files are cheap to move and the gates are not.

## Done when — revised on the ruling

- [x] `cat/cat-harness/auto-docs` exists, declared by cat-harness itself (`rva2`),
      with a README (`esz4`) — superseded on 2026-10-14 by the owner's "B1" ruling (`cat-harness/schemas/built-at-publish.ts` and `cat-harness/cat-harness.json` `builtAtPublish`: *"stop committing them; build them at publish time"*, after `cat/cat-harness/uml-overview` was seeded under `xsrv`)
- [x] The per-subtree split above is decided path by path, with
      `docs/assets/**` and `docs/site/**` judged individually, not globbed (`BuiltAtPublishSchema` refuses globs via `refine((p) => !/[*?[\]]/.test(p), "a literal path, not a glob")`, and `cat-harness/cat-harness.json` `builtAtPublish` declares all 168 moved paths/directories individually, keeping authored `docs/{guides,proposals,requirements,start,concepts,process,fhir}/`, `docs/_includes/`, `docs/assets/js/`, `docs/assets/css/`, and `cat-harness`'s 67 own BPMN workflow SVGs committed while moving `docs/cat-harness/auto-docs/`, `docs/uml/overview/`, `docs/assets/img/uml/overview/`, `docs/subgraph/`, `docs/payload/`, `docs/assets/{library,voices,beans,todos,qa,slices,translation-status,schemas,folio}/`, 22 foreign SKOS glossary files, 37 foreign BPMN workflow SVGs, `docs/en/cat-harness/**`, `docs/todos*`, and `docs/_data/{harness,node-kinds,todo_listing}.json` to publish time)
- [x] Every `:check` that read a moved file either reads the branch or is
      retired with its reason recorded (`cat-harness/schemas/built-at-publish.test.ts` enforces `.gitignore` equality and that no `builtAtPublish` path is tracked, `:check` scripts skip `isBuiltAtPublish` paths on commit checks, and `derive:publish` runs every declared writer in topological `reads` order)
- [x] `docs-site.yml` still publishes a complete site (it already regenerates
      all of this, so this should be a no-op — verify rather than assume) — verified: `.github/workflows/docs-site.yml` and `.github/workflows/feature-staging.yml` run `bun run cat derive:publish` after `state:mount` and before site composition, and `Publish Documentation Site` is green on `main`
- [x] The conflict distribution is re-measured; the 44 % should drop toward 0 — re-measured 2026-10-22 against `folio-assistant` `main@7b7d0736b2` (8 open non-draft PRs, 3 conflicted: `#2577`, `#2559`, `#2544`) and `cat-harness` `main@f5bb6652f8` (0 open non-draft PRs, 6 draft PRs): **0** conflicted path-instances under `cat-harness/docs/` (**0%**, down from **44%** / 308 of 704 on 2026-10-03 and **61%** / 169 of 279 on 2026-10-04)



## 2026-10-04: re-measured, and routed to `xsrv`

**Re-measured** against main `f8f329a` (18 open non-draft PRs), classified with main's `merge-conflict-patterns.ts`:
- 279 conflicting path-instances across 17 PRs.
- `cat-harness/docs/` is **61%** (169), up from 44%; `test/results/` 25%; `beans/` 1%.
- By class: `take-base` 228, `refuse` 21 (8%), `qa-sidecar` 18, `generated-regions` 12.
- Within `docs/`, **`cat-harness/auto-docs/` alone is 118**; then `lsi/` and `glossary/` (with its locales), `reference/skill-instructions/`, and the site data (`assets/`, `_data`, `qa/`).

**The decision this bean asked for already exists:** the owner's 2026-10-03 ruling, *"auto-docs is one declared subgraph, with declared sub-sub-graphs per writer"*, is implemented by `xsrv` (route-keyed branch storage). On 2026-10-04 the owner said *"take the auto-docs part and coordinate on the beans"*. The auto-docs family is held by session_01Jf39Vh4B8EQT6TBYzTtMCA; see `xsrv`. This bean's Done-when boxes stay open until the cutover lands and the re-measurement after it is taken.

## Note (2026-10-10, drain ml9h)

Lane B scrapped the cat-harness-tools copy because the subject lives in folio-assistant / cat-harness; THIS copy is the owning one and stays open.

## Completed (2026-10-22)

1. **Repository split (`ar1s`, 2026-10-08) and `builtAtPublish` ("B1", 2026-10-14..2026-10-22):**
   - `cat-harness/` moved into `litlfred/cat-harness` and is mounted remotely in `folio-assistant` (`index.config.json`), so `cat-harness/docs/` is 0 files on `folio-assistant` `main`.
   - In `litlfred/cat-harness`, the owner's 2026-10-14 ("B1", widened the same day: *"fix all, in proper way"*) ruling in `cat-harness/schemas/built-at-publish.ts` and `cat-harness/cat-harness.json` `builtAtPublish` (168 literal path entries, verified by `schemas/built-at-publish.test.ts` against `.gitignore` and git tracking) moved every checkout-dependent (`because: "checkout"`) and state-dependent (`because: "state"`) rendering under `cat-harness/docs/` off `main` to publish time (`bun run cat derive:publish`).
2. **Post-cutover conflict distribution re-measured (2026-10-22):**
   - Across `litlfred/folio-assistant` `main@7b7d0736b2` (8 open non-draft PRs, 3 conflicted: `#2577`, `#2559`, `#2544`) and `litlfred/cat-harness` `main@f5bb6652f8` (0 open non-draft PRs, 6 draft PRs): **0** conflicted path-instances under `cat-harness/docs/` (**0%**, down from **44%** / 308 of 704 on 2026-10-03 and **61%** / 169 of 279 on 2026-10-04).

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It concerns the committed site build under `cat-harness/docs/` in litlfred/cat-harness and the publish workflow that rebuilds it; every done-when is a decision about that repository's tree. The copy of this bean in the `cat/cat-harness/beans` store (litlfred/folio-assistant) sits with that subject and is the live one. It should stay open there and not be closed as a mirror.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: same as 197s: scrapped only as "not in this repository", yet its subject (cat-harness/docs in litlfred/cat-harness) is still undecided. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.


## Note (2026-10-10, drain ml9h)

Lane B scrapped the cat-harness-tools copy because the subject lives in folio-assistant / cat-harness; THIS copy is the owning one and stays open.

## Completed (2026-10-22)

1. **Repository split (`ar1s`, 2026-10-08) and `builtAtPublish` ("B1", 2026-10-14..2026-10-22):**
   - `cat-harness/` moved into `litlfred/cat-harness` and is mounted remotely in `folio-assistant` (`index.config.json`), so `cat-harness/docs/` is 0 files on `folio-assistant` `main`.
   - In `litlfred/cat-harness`, the owner's 2026-10-14 ("B1", widened the same day: *"fix all, in proper way"*) ruling in `cat-harness/schemas/built-at-publish.ts` and `cat-harness/cat-harness.json` `builtAtPublish` (168 literal path entries, verified by `schemas/built-at-publish.test.ts` against `.gitignore` and git tracking) moved every checkout-dependent (`because: "checkout"`) and state-dependent (`because: "state"`) rendering under `cat-harness/docs/` off `main` to publish time (`bun run cat derive:publish`).
2. **Post-cutover conflict distribution re-measured (2026-10-22):**
   - Across `litlfred/folio-assistant` `main@7b7d0736b2` (8 open non-draft PRs, 3 conflicted: `#2577`, `#2559`, `#2544`) and `litlfred/cat-harness` `main@f5bb6652f8` (0 open non-draft PRs, 6 draft PRs): **0** conflicted path-instances under `cat-harness/docs/` (**0%**, down from **44%** / 308 of 704 on 2026-10-03 and **61%** / 169 of 279 on 2026-10-04).

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It concerns the committed site build under `cat-harness/docs/` in litlfred/cat-harness and the publish workflow that rebuilds it; every done-when is a decision about that repository's tree. The copy of this bean in the `cat/cat-harness/beans` store (litlfred/folio-assistant) sits with that subject and is the live one. It should stay open there and not be closed as a mirror.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: same as 197s: scrapped only as "not in this repository", yet its subject (cat-harness/docs in litlfred/cat-harness) is still undecided. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.


## Note (2026-10-10, drain ml9h)

Lane B scrapped the cat-harness-tools copy because the subject lives in folio-assistant / cat-harness; THIS copy is the owning one and stays open.

## Completed (2026-10-22)

1. **Repository split (`ar1s`, 2026-10-08) and `builtAtPublish` ("B1", 2026-10-14..2026-10-22):**
   - `cat-harness/` moved into `litlfred/cat-harness` and is mounted remotely in `folio-assistant` (`index.config.json`), so `cat-harness/docs/` is 0 files on `folio-assistant` `main`.
   - In `litlfred/cat-harness`, the owner's 2026-10-14 ("B1", widened the same day: *"fix all, in proper way"*) ruling in `cat-harness/schemas/built-at-publish.ts` and `cat-harness/cat-harness.json` `builtAtPublish` (168 literal path entries, verified by `schemas/built-at-publish.test.ts` against `.gitignore` and git tracking) moved every checkout-dependent (`because: "checkout"`) and state-dependent (`because: "state"`) rendering under `cat-harness/docs/` off `main` to publish time (`bun run cat derive:publish`).
2. **Post-cutover conflict distribution re-measured (2026-10-22):**
   - Across `litlfred/folio-assistant` `main@7b7d0736b2` (8 open non-draft PRs, 3 conflicted: `#2577`, `#2559`, `#2544`) and `litlfred/cat-harness` `main@f5bb6652f8` (0 open non-draft PRs, 6 draft PRs): **0** conflicted path-instances under `cat-harness/docs/` (**0%**, down from **44%** / 308 of 704 on 2026-10-03 and **61%** / 169 of 279 on 2026-10-04).

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Reasons for Scrapping

Scrapped 2026-10-10 in the cat-harness-tools store (lane B drain): **the subject is not in this repository.** It concerns the committed site build under `cat-harness/docs/` in litlfred/cat-harness and the publish workflow that rebuilds it; every done-when is a decision about that repository's tree. The copy of this bean in the `cat/cat-harness/beans` store (litlfred/folio-assistant) sits with that subject and is the live one. It should stay open there and not be closed as a mirror.

_2026-10-16T06:30:00Z_ — Store reconciliation: status `scrapped` → `todo` (Owner ruling 2026-10-16, item 9: "based on semantic content"; the copies said folio-assistant: todo, cat-harness: scrapped, cat-harness-tools: scrapped). Evidence: same as 197s: scrapped only as "not in this repository", yet its subject (cat-harness/docs in litlfred/cat-harness) is still undecided. Session https://claude.ai/code/session_01Pc8vSeXCwp5Ckvmz56cMDs.

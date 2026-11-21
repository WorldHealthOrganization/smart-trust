---
name: merge-conflict-patterns
description: >
  Merge the base branch in and resolve, without a person, only the conflicts a
  DECLARED pattern covers — generated files, generated README regions, QA
  sidecars — then prove the result with the gate set. Refuses the whole merge
  when any conflict is authored or undeclared. Use for "merge main", "resolve
  the conflicts", "the PR is conflicted again", "auto-resolve", and when adding
  a pattern for a new kind of churn. Also governs what a merge steward does
  with a merge-train member it had to refuse: one deduplicated work item under the
  PR's own epic, a hand-back to the owning session with a fail condition, one
  dispatched agent when nobody owns it, one PR comment, and the close.
user_invocable: false
---

# Merge-conflict patterns — what a merge may resolve on its own

`bun run cat merge:main` is the command; `sdlc/processes/merge-base.bpmn` is the
process it executes, called from `Task_PrepareMerge` in
`code-change-review.bpmn`. The patterns themselves are data in
`cat-harness-tools/scripts/merge-conflict-patterns.ts`. This page says what each one
is FOR, so a reader can tell a deliberate refusal from a gap.

Most `main`-into-branch merges that conflict do so only on generated files,
and every one of those resolves the same way — take the base's copy,
regenerate — so resolving them by hand costs an agent a round and the PR
another CI run for nothing.

## The three rules that make it safe

1. **All or nothing.** Every conflicted path is classified before anything is
   touched. One refusal ABORTS the merge and restores the tree. Resolving nine
   generated files and leaving one authored conflict half-done reads as
   progress, and is not.
2. **Proved, not assumed.** After resolving, `bun run cat regen` asks the checks
   the CI workflow runs (under `merge:main`, those whose inputs either side
   changed since the fork point; `--full-regen` asks every one) and runs each stale one's writer until the tree
   settles. Anything `unrepaired` aborts the merge. No pattern names its own
   check: the gate set is derived from the workflow and cannot drift, a
   hand-kept list of check names can.

3. **Classify with the BASE's patterns, not your tree's.** `pathClass` reads
   `PATTERNS` from the checkout it is running in. A branch that forked before a
   pattern was declared therefore classifies by the OLD declaration, and every
   path in a newly-declared family reads `authored` — the one verdict that
   routes work to a person.

A path that **no** pattern names is refused. Adding automation is adding a
pattern, deliberately, with its reason — never widening a glob on a hunch.

### Applying rule 3

A stale tree can be wrong in either direction. A pattern the base has added
makes it over-report authored conflicts, which sends a person work the base
already declares mechanical. A pattern the base has narrowed, reordered or
retired makes it under-report: it takes a side on a path the base now
refuses. So `git fetch`, and classify with the BASE's own `merge-base.ts`
(from a worktree of the tools at the base, `git worktree add --detach <dir>
origin/<base>`), run against your checkout with `--root <your checkout> --base origin/<base>`
(add `--dry-run` to classify and change nothing). `merge-main.yml` does the
same: it checks out main's tools and runs main's `merge-base.ts --root` on the
PR's branch. The number that decides whether a human is needed must come from
the declaration the merge will actually be resolved under.

## A merge round — run each check ONCE

Most of a round of folding `main` into a PR is the same question asked twice.
What each step costs and adds:

| step | cost | what it adds |
|---|---|---|
| `merge:main`, including its own regen | 5–10 min — regen 238–309 s with nothing stale, 601–639 s when a writer runs | THE regen; rule 2 above |
| `skill:register` | 1–2 min | the derived artefacts the merge left owed |
| a standalone `regen` after `merge:main` | 4–5 min | **nothing** for the merge — same tree; it can only add a pair already stale on both parents, which CI reports anyway |
| full local `bun run cat gates` | ~24 min (1429 s), nearly all `bun test` (~21.8k tests) on 3–4 local cores | what CI's sharded run says in ~5 min, 4 ways |
| `regen` again in a fresh checkout, to prove a no-op | 4–5 min | what CI's own clean checkout already proves |

The timings in this section were recorded by 2026-10-08, when cat-harness
was seeded. Re-measure with `bun run cat measure:merge-round`
before you quote them.

Three of five rows repeat a measurement somebody else, or the same command,
has already made. So:

### When every conflict is generated — the trimmed round

"Generated" means every conflicted path was resolved by a declared
`take-base`, region or sidecar pattern below, and the merge brought in no
authored change of yours to reconcile.

1. **`bun run cat state:mount`, then `bun run cat merge:main`.** `merge:main`'s regen
   IS the regen. Do not run another one after it.
2. **`bun run cat skill:register` until `bun run cat skill:register:check` passes.**
   The chain can need two passes: one writer's output is another's input.
3. **Targeted checks, and only these:**
   - `skill:register:check` and `kg:detangle:check` — the two reds a
     generated-only merge actually hit in CI;
   - `subgraph:jsonld:check` — a merge or edit that changes a skill also
     changes its payload hash; `skill:register` does not run
     `subgraph:jsonld`, so run the writer (`bun run cat subgraph:jsonld`) when the
     check is red;
   - `check:declared-paths` (never with `--update` here) and
     `check:process-index`;
   - `bun run typecheck`, and `bun run cat lint` at **0 errors**;
   - **the deletion audit** —
     `git diff --name-status --diff-filter=D HEAD^1 HEAD -- '*/test/results/*'`
     must list only files `main` itself deleted. A gitignored-but-tracked file
     is dropped by a merge silently, local checks stay green because the
     writer recreated it on disk, and CI's fresh checkout fails.
     `merge:main` refuses such a drop itself (§"When one side deleted
     the file"); after a hand merge, restore each one main still tracks with
     `git checkout HEAD^2 -- <path>`;
   - **submodule pins equal to `main`'s** —
     `git ls-tree HEAD bootstrap bootstrap-tools` against
     `git ls-tree origin/main bootstrap bootstrap-tools`. Not
     `git submodule status`: [`merge-queue`](merge-queue.md) §"`git add -A`
     after a merge silently reverts the submodule gitlinks" says why it cannot
     see this;
   - the `fsh-guts` mount is **not committed** — `git diff --stat
     origin/main HEAD -- fsh-guts` is empty;
   - `git merge-tree --write-tree origin/main HEAD` reports **0 conflicts**,
     with the exit status captured on the next line
     ([`prepare-merge`](prepare-merge.md) step 4).
4. **Push, never with force.** CI's sharded run is the full gate set. Skip the
   local full `bun run cat gates` and the fresh-checkout regen for this kind of
   merge: each repeats something CI does better.

### When it is NOT generated-only — keep the full local run

**An AUTHORED file conflicted, or the merge touched code** (a script, test,
schema or workflow that conflicted or that you reconciled by hand, on either
side): run the full local `bun run cat gates` before pushing,
and read [`prepare-merge`](prepare-merge.md) §"What a green LOCAL run entitles
you to claim" before quoting it. The targeted list above is chosen for a merge
that changed only artefacts with one right answer; it cannot see a semantic
conflict such as an import of a module the other side moved
([`merge-queue`](merge-queue.md) §"A train admits only members that STACK
cleanly").

### Four things a round needs to know

- **`merge:main` has no "continue after a manual fix" mode.** When one path
  blocks it, it aborts and restores the tree (rule 1). Do its steps by hand:
  `git merge origin/main`, fix the blocking path, then resolve each declared
  path by **its own pattern's strategy**, never with one command for all of
  them, and stage each with `git add -f <path>`:
  - `take-base`: `git checkout --theirs <path>` when `main` kept the file;
    `git rm <path>` when `main` deleted it, since a modify/delete has no stage
    to check out (§"When one side deleted the file").
  - `owned-tree`: take each parent's committed blob, as `takeOwnedTree` does
    (§"`subgraph-index` and `subgraph-payload`"). Never `--theirs`: in a
    rename/rename it writes conflict-marked bytes under a hash name.
  - `readme-generated-regions`: edit the conflict markers in place, hunk by
    hunk, as `resolveGeneratedRegions` does. A hunk inside a generated region
    may take either side, because regen rewrites the region. A hunk outside
    one, or one that moves a region boundary, is an authored conflict. Never `--theirs`: it replaces the whole README
    and drops the branch's own edits to it, including the ones git merged
    cleanly.

  Then run the regen it would have run, and both `droppedInMerge` checks it
  would have run: once after resolving, and once after regen and `git add -A`,
  before committing. Each path `git diff --cached --name-only --diff-filter=D HEAD`
  lists must be one `main` deleted since the merge base, and each path
  `git diff --cached --name-only --diff-filter=D MERGE_HEAD` lists must be one
  the branch deleted since the merge base. After regen, a writer's own
  deletion also passes, but only when the file is gone from disk too.
- **Give the regen a long leash.** Cold, it needed ≥1200 s of wall time
  (recorded by 2026-10-08; `bun run cat measure:merge-round` re-measures). Run it
  in the background rather than under a default 2-minute tool timeout, which
  kills it part-way and leaves a half-written tree.
- **`merge:main` commits with git's default message.** Amend that commit to
  add the session's trailers (`git commit --amend`) before pushing — it is
  your unpushed commit, so this is not a rewrite of shared history.
- **Do not fold `main` in while another big PR is minutes from landing.** Wait
  for it. Merging now buys a second round the moment it lands
  ([`merge-queue`](merge-queue.md)).

## A pattern is not always the answer — ask what the file's record is

**Read this before declaring a pattern for a path that already has one.** The
registry answers *how* a conflict is resolved. It never answers *whether* one
arises, and reaching for it a second time on the same path is the move to
stop and check.

A declared pattern settles a file whose content is a function of the TREE,
and settles nothing about one whose content is a function of the machine that
built it — there, take-base is a loop. This section is about a third case: the
content *is* tree-determined, the pattern *does* resolve it, and the path
still conflicts on every merge. The LSI indexes are the example: a one-sentence
edit to one skill rewrites most of `skills.lsi.json` (an SVD rotation is
globally sensitive), so the file conflicts on nearly every merge, and the
pattern only makes each conflict cheap — and no check on `main` judges those
bytes.

So the question to ask is not *which strategy*, it is:

> **What is this file's record, and is `main` it?**

- **`main` is the record** — an authored file, or a generated one a reader
  navigates to by name. Declare the pattern; that is what the registry is for.
- **`main` is not the record** — the file's record is the `qa-reports` entry
  for its commit, or a build output, and the copy on `main` is a duplicate kept
  in step by a gate. Then **take it off `main`**, and keep the declaration for
  the branches still carrying it, where the base has deleted the file and
  take-base resolves that too (see the next section).
- **Part of it is, and part is not** — the common case, and the one to look for
  before concluding either of the above. Cut by **what each value is a function
  of**: a value the TREE determines stays committed and is reviewable; a value
  determined by some other artefact's CONTENT is produced where that artefact
  lives. `docs/lsi/index.md` is the worked example — front matter, prose and
  the verdict table stay, each index's size, poles and findings go — and the
  front matter is *why* it could not be taken off whole: it declares the
  harness tile, so an uncommitted page is a page with no way in.

**The trap on the way out.** Taking a page off its store and leaving it
committed can make it *worse*: a page computed from `qa-reports` at `main`
reads the **latest published entry**, so the committed copy goes stale whenever
anyone else pushes. Whatever stays committed must be computed from the tree.

`.gitattributes` reached the same conclusion from the `-merge` side and states
it plainly: *"Removing these conflicts, rather than tidying them, needs the
files off `main` altogether."* Two things make that safe rather than merely
tidy, and both are checks, not care: every reader must already cope with the
file's absence, and something must still PRODUCE it where its record lives —
`qa:refresh` decides that **per writer**, so a family can be removed on its
own.

## When one side deleted the file

A modify/delete conflict has no stage for the side that deleted it, so
`checkout --theirs` (or `--ours`) has nothing to take. Every resolving
strategy takes the **base's side of the deletion** instead: its copy when the
base kept the file, `git rm` when the base removed it — `takeBase` in
`merge-base.ts`. Regeneration recreates the file if it is still
produced. Classification is by path, so an authored path in a modify/delete
conflict is refused exactly like any other conflict on it. The `owned-tree`
patterns are the exception. They read which **parent commits** hold the path
rather than which stages exist, because in a rename/rename "no stage 3" does
not mean the base deleted anything (see `subgraph-payload` below).

**Taking a deletion is the ONLY way a merge may drop a path, and
`merge-base.ts` checks this before every merge commit.** `droppedInMerge` compares the index with the merge base and both
parents. A path either parent tracks that the result lacks is a drop, unless
one side deleted it since the merge base. A path both parents hold, or one a
side added, must survive. The check runs twice. Right after resolution, before
anything else is staged, every drop is refused. After regen and `add -A`, only
a drop the disk still holds is refused, because a writer may delete what it
owns: `subgraph:jsonld` replaces a content-addressed payload when the merge
changes its node, and its `:check` proves that. The check exists because of
the gitignored-but-tracked files under `*/test/results/`. Once one of them
leaves the index, regen rewrites it on disk and `git add -A` does not stage it
again, since it is now untracked and ignored. The failure signature is
**green locally, red in CI**, with the check reporting the file missing ("has
none"). `git add -A` is not what removes such a file: it only fails to
restore one that something else (such as a `git rm`) already removed from the
index. The refusal line says when the dropped file
is still on disk, which is the case that local checks cannot see.

## The patterns

### `kg-qa-manifest` — take the base, regenerate

`**/test/results/**/kg-qa.manifest.json`. One per layer (hosted ones one level deeper), holding only the
auditor's script hash, so any change to `kg-audit.ts` restamps every one at
once. It holds no attestation.

### `qa-results` — take the base, regenerate

`**/*.qa-results.json`. Whole-artefact QA results, rewritten whole by their
producer. They change whenever any finding does.

### `derived-results` — take the base, regenerate

kg-qa sidecars, LSI indexes, detangle sidecars, tool-run records and translation-qa sidecars under `test/results/`.
Recomputed from the whole corpus, so any concurrent skill or schema change
touches them.

Attestations live in `test/attestations/`, which no pattern names and a merge
therefore refuses; `test/results/` is not committed on `main`, and a branch
still carrying a sidecar takes the base's side. The **LSI** half is untracked
on `main`; the globs are kept for branches still carrying it (§"A pattern is
not always the answer").

### `auto-docs` — take the base, regenerate

The generated docs index pages, already `-merge` in `.gitattributes`. One page
per directory, so a new file anywhere changes one.

### `uml` — take the base, regenerate

Generated overview diagrams and their SVGs.

### `prov-qaqc` — take the base, regenerate

The PROV-O QA/QC report (`docs/prov-qaqc/`) and its per-instance logs
(`docs/assets/prov/`). Generated WHOLE from the workflow instances under
`beans/workflows/`, so any branch that records an instance — which every branch
doing process work does — rewrites the index page and adds a `.prov.jsonld`.

The globs are instance-agnostic (`**/docs/prov-qaqc/**`), like
`derived-results` and unlike `glossary`: a dependent folio runs `prov:qaqc`
over its own instances and writes the same two shapes under its own root.

It names no check of its own, per rule 2: `regen` runs `prov:qaqc` because
`check:prov-qaqc` is a workflow gate, and a pattern that named its own check
would be a hand-kept list able to drift from the workflow.

### `glossary` — take the base, regenerate

The generated glossary and LSI pages: whole-corpus aggregates where concurrent
term additions always collide.

The **LSI page**'s per-index detail is added by the docs-site build rather than
committed, and what is left is a function of the tree. The glossary page has no equivalent split: every number on it is a term
count over the whole corpus, so there is no half that only the tree moves. That
is the second branch of §"A pattern is not always the answer" — `main` is still
the glossary page's record, and declaring the strategy is all there is to do.

### `translated-glossary` — take the base, regenerate

`cat-harness/docs/{ar,es,fr,ru,zh}/glossary/index.md`. The per-locale glossary
pages `glossary-page.ts` writes whole beside the English one (`check:glossary`),
so they collide exactly when it does. Only the glossary
page is named: the rest of each locale directory is authored translation, and
a locale no generator writes (`de/`) is refused.

### `viewer-pages` — take the base, regenerate

`docs/external-schemas/index.md`, `docs/methodologies/index.md`,
`docs/processes/*.md`, `docs/qa/index.html` and
`docs/translation-status/index.html`: whole-file viewer pages, each with its
writer's `--check` in the CI workflow (`external-schemas:viz`,
`methodologies:viz`, `processes:viz`, `state:visualizer`,
`translation:status`). A new schema, diagram or translation anywhere rewrites
them.

It also holds `state:visualizer`'s other pages, `docs/{beans,todos,health,
issue-marks,swimlane-glossary,uploads}/index.html`, each headed "Generated by
scripts/state-visualizer.ts". **`docs/uploads/index.html` is the viewer OF
`uploads/`, not an upload**, and the `uploads` refusal's `**/uploads/**` would
catch it; first match wins, so the viewer entries sit above the refusal.

`docs/fsh-guts/index.md` is not committed: it is derived from `fsh-guts/`,
which is kept on a branch, so it is built at publish by `derive:publish` and a
merge cannot meet it. That is the general answer for any derived page
whose input lives on a branch — see
[`directory-conventions`](../../../skills/kg/kg-core/directory-conventions.md)
§"The storage clock" — and is better than a take-base pattern, which only
makes the collision cheap. The archive itself (`fsh-guts/**`) is kept content
and stays refused.

### `viewer-namespace` — take the base, regenerate

`docs/cat-harness/{catalogue,folio,library,schemas,uploads,voices}/**`: the
pages `gen-library-viz`, `gen-folio-viz` and `gen-schema-viz` place through
`viewerPlacement`, each rewritten whole from the corpus and checked by its
`:viz --check`. As above, its `uploads/` pages render uploads rather than
being them. `auto-docs/` under the same prefix
keeps its own `auto-docs` entry.

### `navbar-include` — take the base, regenerate

`docs/_includes/generated/**`: the navbar/footer include written whole by
`gen-navbar-include.ts` (`navbar:include --check`). Any new page, graph or tile
rewrites it. Its authored neighbours in `docs/_includes/` stay refused.

### `viewer-nav-qa` — take the base, regenerate

`test/results/viewer-nav/viewer-nav.qa.json`: `check-viewer-nav`'s mechanical
layout verdict over every viewer page. Recomputed from the pages, and it
carries no reviewer's attestation.

### `handler-index` — take the base, regenerate

`docs/cat-harness/published-graphs.md`, the handler's index of every published
graph and declared viewer, written whole by `gen-handler-index.ts`
(`handler:index:check`). Any new graph or viewer rewrites it.

### `skos-glossary-export` — take the base, regenerate

`**/docs/assets/glossary/*.skos.jsonld`: the published SKOS export, written
whole by `glossary:export` (`glossary-export.ts`, gated by `glossary:check`).
Every layer's export restamps whenever any declared role, skill or term moves, so
two PRs that touch unrelated skills still collide here.

**It is not the ledger, and that distinction is the whole safety argument.**
`glossary-ledger.json` carries forward: `glossary-export.ts` reads the prior
ledger and preserves a concept's earlier names as `skos:hiddenLabel`, so taking one side would drop a term's history. The ledger sits one
level up from `generated/` and matches no glob here — verified, and pinned by
a test. This is `.gitattributes`'s rule applied to a resolver: the test is not
*is it generated* but **does its producer carry anything forward**.

`.skos.jsonld` does not match `site-data`'s `cat-harness/docs/assets/**/*.json`
— `.jsonld` is not `.json` — which is why it needed its own entry rather than
falling through.

### `glossary-generated` — take the base, regenerate

`**/glossary/generated/**`: the per-instance generated glossary JSON, same
writer and same check as `skos-glossary-export`. The glob stops at `generated/`, so the sibling ledger is untouched.

### `skill-instructions` — take the base, regenerate

`**/docs/reference/skill-instructions/**`: skill instruction bodies, written
whole by `skills:docs` (`gen-skill-docs.ts`'s `OUT_DIR`, gated by
`skills:docs:check`). Never hand-edit it.

Safe because `emit()` is compare-or-write with no merge — under `--check` it
compares and records drift, otherwise it writes the content whole — so nothing
is carried forward from the file on disk.

**The authored neighbour is the skill itself.** `skills/**/*.md` is the SOURCE
these pages are generated from and stays `refuse`; a test pins that pair,
because resolving the generated copy while taking a side on the source is the
mistake this entry would otherwise invite.

### `docs-pages` — take the base, regenerate

The `cat-harness/docs/**.md` pages `gen-docs-pages.ts` writes whole from the
authored blocks under `cat-harness/docs/source/<slug>/` (`docs:pages`, gated
by `docs:pages:check`). Each one says so in its own front matter:

```
generated: scripts/gen-docs-pages.ts — do not hand-edit; run `bun run cat docs:pages`
```

**Safe because nothing is carried forward.** `emit()` is compare-or-write: the
only read of a prior page is inside its `--check` branch, for the comparison,
and every other read in the script is of an INPUT (`readBlock` over
`docs/source/`, BPMN XML, manifests). Its one walk of the output directory
skips files carrying the generated marker. **Confirm the writer by reading the
script, not by how whole-file it looks.**

**Gated on EXACT content, which is why `take-base` is verifiable rather than
merely convenient.** The generator's own docblock says a difference in a `page`
is "somebody who added a node, renamed a block, ran a first sweep, or moved a
sidecar, and did not regenerate". So after `take-base`, `docs:pages:check`
proves the regenerated page is right — the resolution is not trusted, it is
checked.

**The slugs are ENUMERATED, not globbed, and that is deliberate.**
`cat-harness/docs/*.md` and `guides/` mix generated pages with authored ones
(`architecture.md`, `index.md`, `agent-onboarding.md`, …). A directory glob
would take a side on authored prose — the one thing a resolver must never do. The cost is that a
page added to `docs/source/` is **refused until its slug is declared here**,
which is the safe direction to be wrong in, and a test reads the pages' own
front matter from the TREE so the enumeration cannot go quietly stale.

**That test must read the front matter, not the file**: the generated body of
this skill, `docs/reference/skill-instructions/merge-conflict-patterns.md`,
quotes the marker in the code fence above, and a detector that reads a
quotation as a declaration finds its own documentation
([`audit-coverage`](../../../skills/kg/kg-core/audit-coverage.md)). That
page's front matter names `gen-skill-docs.ts`, and `skill-instructions` is
declared before `docs-pages`, so the first match gives it the right owner.

**The authored neighbour is the source, and it stays refused.**
`cat-harness/docs/source/process-publication-workflow/every-workflow-in-the-repo.md`
is the hand-written INPUT for `docs/process/publication-workflow.md`. Even
when both sides only *added* rows, a union of additions is a property of that
layer and not of the path. A test pins the pair, and pins that nothing under `content/`
is claimed at any depth.

### `health-report` — take the base's measurement

`test/health/results/*.health-report.json`. Not a derivation of the tree but a
**measurement** of external state (publish branch, clone size, the work plan),
written by `bun run cat health` and refreshed daily on the base by the
health-check workflow, so the base's copy is simply the newer measurement and
a branch's older one carries nothing worth keeping. `check:harness-state`
judges its producer hash; if the merge changed the producer, `bun run cat health`
rewrites it.

### `qa-witnesses` — take the base, regenerate

`test/results/witnesses/**`: witness projections (`qa-witness/v1`) and page
verdict indexes, written by `gen-docs-pages.ts` from the kg-qa sidecars and the
live subject. A projection, never an attestation, and the docs-site build
regenerates them at publish.

### `pot-templates` — take the base, regenerate

`translations/**/*.pot`: gettext templates extracted from the English pages by
`pot-for-pages.ts` (`translation:pot:check`), so every edit to a source page
rewrites its template in every locale. The `.po` files beside them are
**authored translations** and stay refused.

### `site-data` — take the base, regenerate

Generated site data indexes under `docs/assets/**/*.json` and `docs/_data/`.

### `subgraph-index` and `subgraph-payload` — owned tree, regenerate

`**/docs/subgraph/**` holds the subgraph JSON-LD indexes. `**/docs/payload/sha256/**`
holds the content-addressed payloads (`<hex>` is the sha256 of its bytes, with
a `<hex>.json` sidecar beside it). `bun run cat subgraph:jsonld` writes both
directories **whole**, and it deletes every file in them that it did not write.
Any skill edit rewrites an index and moves a payload.

**Why not `take-base`.** When both sides change one node's payload, git reads
it as a **rename/rename**. The base's hex goes to the branch's hex on one side
and to main's hex on the other. Git leaves the old name at stage 1 only, the
branch's new name at stage 2 only, and main's at stage 3 only. Both new stages
hold git's three-way merge of the two bodies, **with conflict markers**. So
`take-base` fails in two ways:

- It reads "stage 2 only" as "the base deleted it" and `git rm`s the branch's
  new payload. That is a path the branch **added**, so `droppedInMerge` refuses
  it at the `resolved` checkpoint.
- `checkout --theirs` writes marked bytes under a name that is the hash of
  other bytes.

**The `owned-tree` strategy** (`takeOwnedTree` in `merge-base.ts`) reads the
parents' **commits**, never the stages. For each path:

- it takes the base's committed blob when the base has the path;
- it takes the branch's committed blob when only the branch has it;
- it removes the path only when neither parent has it, which is a deletion both
  sides made.

The resolution therefore drops nothing a parent holds, and every kept payload
holds the bytes its name hashes. The orphan it keeps is the writer's to remove.
The writer is named in the pattern as `prunedBy: "subgraph:jsonld"`, a writer
and not a check: `regen` still derives the check from the CI workflow. When
`regen` runs that writer, the writer deletes the orphan.

**Both `droppedInMerge` checkpoints still hold, and they are why this works.** The
`resolved` checkpoint sees no drop. The `staged` checkpoint sees the writer's
deletion of the superseded payload, a path the branch added, and allows it
because the disk no longer holds it either. That is the legitimate replacement
of a content-addressed payload, which a single post-regen check would have
refused. The test fixture in `merge-base.test.ts` covers this, and so does its
refusal sibling, which shows that `take-base` on the same merge is refused.

**Adding another `owned-tree` pattern** needs a writer that deletes what it
did not write. Without one, the kept orphan survives `regen`, and only the
writer's `:check` can catch it. The test requires every `owned-tree` pattern
to name a `prunedBy` script that has a `:check` twin. Under `--no-regen` (a
merge train), the orphan stays in the member's merge commit until the train's
final `regen`.

### `navbar-rail-data` — owned tree, regenerate

`**/docs/assets/navbar/rail-*.js` is the navbar's shared rail data. Each file
is named `rail-<hash>.js` after the content hash of the rail JSON it carries
(`lib/harness-rail.ts`), so a changed rail is a **new** file and the old one is
orphaned. `bun run cat navbar:assets` deletes every rail file no committed page
names, and `navbar:assets:check` fails on one. Both sides of a merge add their
own hash, which is why this is `owned-tree` and not `take-base`, for the same
reason as `subgraph-payload` above.

The neighbours `navbar.js` and `navbar.css` are **not** covered: they have
fixed names and a byte-for-byte check, and stay refused.

`seed:ready` reads the same declaration: deleting or renaming an `owned-tree`
path is not a move of the layer, because a regen renames it anyway.

### `readme-generated-regions` — hunk by hunk

Directory READMEs mix authored prose with generated regions
(`<!-- kg:subgraph:begin -->` … `:end -->`) whose file counts and listings
change on every concurrent addition. A hunk **inside** a region takes the
base's side and the generator rewrites the region; a hunk in authored prose,
or one that moves a region boundary, **refuses**. File-count churn is resolved
here; the README keeps its exact counts.

### `standalone-baseline` — take the base, regenerate NOTHING

`cat-harness-tools/scripts/standalone-baseline.json`, `check:standalone`'s list of
accepted standalone failures. It is the one take-base
pattern with **no** regeneration, because it is a ratchet. Re-measuring after a
merge would write any new standalone failure into the list unreviewed, which
is exactly what the gate exists to stop. Git conflicts on it only when BOTH sides
changed the list, so taking the base is fail-closed: if this side's change was
a new failure, its CI goes red until its author runs `bun run
standalone:baseline` on purpose; if it was a fix, all that is lost is a shorter
list, and the check reports it.

### `beans` — refused, by declaration

**Before you go looking for the other session, check whether there is one.**
A `beans/defs/**` conflict has two causes and they need different handling:

| cause | how to tell | what to do |
|---|---|---|
| two sessions edited one work item | the default branch's claim note names a branch that is not yours | a coordination question — talk to them |
| **one session**: the claim landed on the default branch, the completion stayed on the branch | the note names **your own** branch | no coordination needed; keep the completing value and the note |

The second is `beans:claim`'s **normal path**, not an edge case: it pushes the
claim to the default branch so a sibling sees it before your PR exists, and
your branch then edits the same work item to finish it.

`claim-bean.ts` brings the claim COMMIT into the claiming branch after the
push: a fast-forward when the branch has nothing of its own yet, otherwise a
merge commit. The claim is then in the branch's merge base, so finishing the
work item merges cleanly (copying only the claim's text still conflicts on
`updated_at`, and **a conflicted PR gets no CI at all**).

The conflict therefore means the claim could NOT be brought in: a detached
checkout, local edits in the way, or a merge that would conflict. `beans:claim`
says so (`NOT in this branch's history`) and falls back to the text mirror
(`mirrorClaimNote`). Resolve the remainder by merging the default branch in, or
by keeping the completing branch's value and the note — and **never by unioning
the front matter**, since a duplicated `updated_at` is
`check-bean-front-matter`'s recorded defect. Work item definitions are authored
work-plan state; two sessions editing one work item is a coordination question
(`bean-coordination`).

### `artefact-verification` — refused, by declaration

`scripts/artefact-verification.json`, the per-check consumer-verification
declaration. **This is the entry that exists to stop a sweep, not to resolve
one** — and the one most likely to be globed by mistake, because it reads like a
generated sidecar (under `scripts/`, a `.json`, its key set derived from
`package.json`).

Two facts, either one sufficient:

- `task-io.ts` classifies `check:artefact-verification` as `TREE_READER`, which has no outputs. **No
  script writes the file**, so `regen` has no writer to run and `take-base` is a
  silent *discard* rather than a resolution.
- Its own `_comment` requires every `none` entry to carry **a reason, in prose**,
  and says the file *"may only SHRINK"*. A branch that adds a gated check adds
  an authored sentence — precisely what taking base would drop.

So a conflict here is a genuine editorial merge: both reasons are wanted, and
which survives is a judgement. Human merge is the cost of the file's shape, not
a hole in this catalogue.

**The falsifier:** if a `--write` is ever added that
composes the derived key set and carries existing reasons forward, the file
becomes regenerable and this entry becomes `take-base`. Nothing today wants such
a writer, and adding one to make merges cheaper would be building a mechanism to
serve the merge tool rather than the gate.

### `uploads` — refused, by declaration

Uploaded source material: provenance-bearing input, never regenerated.

## Adding a pattern

1. Measure first: replay recent merges with `git merge-tree --write-tree` and
   look at what the conflicting **lines** are, not just which files.
2. Add an entry with its `why` and the narrowest glob that covers it. Order
   matters: the first match decides.
3. Add a test that the unsafe neighbour is refused, not only that the case
   resolves.
4. Add a section here.

## In CI — opt in with the `merge-main` label

`.github/workflows/merge-main.yml`, which lives in the folio-assistant index
and not in this repository, is a second CALLER of the same command, never a
second resolver. It runs main's `merge-base.ts --root` on the PR's branch
(rule 3). It runs on a push to `main`, when the label is added, when a
labelled PR is marked ready for review, and by hand:

- **A sweep (a push to `main`, or a dispatch naming no PR) merges only a
  labelled PR that CONFLICTS with `main`.** A PR that merges cleanly is
  skipped, because its `pull_request` CI already tests the merge ref (owner
  ruling 2026-11-05, [`branch-freshness`](branch-freshness.md)). Adding the
  label, or a dispatch naming the PR, still merges a clean one.
- **Same-repository PRs only, and never a draft.** A labelled draft is picked
  up when it is marked ready.
- **Runs queue; they are not cancelled in progress.** For one PR, runs started
  by a push to `main` queue behind each other. A run of any other event (the
  label, ready-for-review, a dispatch) cancels an earlier run of the same
  event. Runs of different events can run at once, and the one that pushes
  second is rejected without overwriting anything.

- **It pushes only a proved merge**, as a fast-forward of the branch it checked
  out; if the author pushed meanwhile the push is rejected and nothing is
  overwritten.
- **A refusal pushes nothing** and lists the ✗ paths in its comment. Adding a
  pattern stays a person's change, made here. It does NOT label the PR: **a
  label asserting "a person is needed" outlives the condition that set it**
  (`merge-queue` §"A hold has an EXPIRY and a trigger, or it outlives its
  reason"). **The reason lives in the comment, which is dated and names the
  run.**
- **A declared resolution that FAILS is a refusal too**, not an unexplained
  red job. If taking the base or resolving a region throws, `merge-base`
  prints `  ✗ <path>  [<pattern>: could not resolve] — <git's first error
  line>` and aborts, so the bot's comment names the path and the error.
  Staging a conflicted path uses `git add -f` in both resolvers (git exits 1
  when staging an unmerged ignored path), safe because the path is one git
  listed as unmerged. `regen` reporting an unrepaired
  check is still a red job: that is a defect for a person to read, not a
  conflict.
- **One comment per PR, edited in place** on every run — except a run that
  was **cancelled** (a newer label or ready-for-review run superseded it) or whose merge step
  reported no status, which leaves the comment untouched. The text is composed by
  `cat-harness-tools/scripts/merge-main-comment.ts`, which is unit-tested.
- **The merge commit is still judged by CI**: pushed with the
  `PUSH_BRANCH_TRIGGERING_CI` credential (the harness GitHub App, or a
  repository secret of that name) when one is available, otherwise followed by a dispatch of
  `code-quality-gates.yml` on the branch, because a GITHUB_TOKEN push triggers
  no workflow.

GitHub runs no `pull_request` CI on a conflicted PR, and `main` can move faster
than an agent round. Use the label on a PR that is waiting on
review rather than on its author; leave it off a branch somebody is pushing to.

## When a merge-train member is refused: bean, hand back, or dispatch

A train is built in one of two ways, and they treat conflicts differently.
The **automated** train (`bun run cat merge:train`, which `merge-train.yml`
runs; the workflow is proposed in
[folio-assistant#2960](https://github.com/litlfred/folio-assistant/pull/2960)) runs `merge-base.ts --no-regen` for each member, then one
`bun run cat regen`, then one CI run. A conflict that a declared
generated-path pattern covers is resolved at train time, and a conflict in a
hand-written file refuses the member (owner ruling 2026-11-05, "Resolve
generated only"; [`merge-queue`](merge-queue.md) §"The automated merge train",
proposed in [cat-harness#1053](https://github.com/litlfred/cat-harness/pull/1053)).
A steward's **hand** train admits only members that stack with no conflict at
all ([`merge-queue`](merge-queue.md) §"A train admits only members that STACK
cleanly"), so it refuses a conflicted member before merging it. In either
train, a member is also **refused** when the train's combined result fails a
gate that the member alone did not fail. The steward
drops it and the train goes on without it. `sdlc/processes/merge-refusal.bpmn`
executes what happens to the dropped member. The author's side, the queue
and the bounce-back are [`merge-queue`](merge-queue.md); the hand-back format
is the [`agent-handoff`](agent-handoff.md) skill.

A refusal has one of three causes: a conflict on a path refused by
declaration (two PRs editing one work item, say), an authored or undeclared path,
or a gate the combination fails that each member passed alone. Each refusal
becomes a work item, because a PR comment or a chat message leaves nothing in the
work plan to say it happened.

### 1. Open one bean per refused PR, and check before you create

`beans create` dedupes on nothing (see `todo-manager` §"Check before you
create"). The title carries the PR number, so the check is exact:

```bash
beans list --json --search 'title:"Merge refused: #1822"' \
  | jq -r '.[] | select(.title | startswith("Merge refused: #1822 "))
                | select(.status != "completed" and .status != "scrapped") | .id'
```

- **An open work item already exists** for this PR: do not create a second one.
  Add the new refusal to it under `## Attempts` with `--body-append` (never
  `--body-file`, which replaces the body).
- **Otherwise create one**: `type: bug`, titled
  `Merge refused: #<n> <first refused path or gate>`. `--parent` and the
  create are one action (`todo-manager` §"After you create").

**The parent is the epic or story the PR's own work belongs to,** not the
steward's epic. Find it in this order: the work item the PR's branch adds or claims
(`git diff --name-only origin/main...<head> -- beans/defs/`), then a work item id in
the PR body or commit messages. Parent the refusal under **that work item's parent**
when the PR's work item is a task, or under the PR's work item itself when it is an epic
or story. Then mark it `--blocking <the PR's bean>`. Only when the PR names no
work item at all does it go under the steward's own merge-gate epic, and the work item
body says so.

The body records what the owning session needs in order to act without asking:

```markdown
PR #1822, head <sha> (the sha the train used), dropped from train
`<train name>` (its other members, and the base sha it merged onto).

## Refused
- `cat-harness/scripts/gen-library-jsonld.ts`: authored conflict, no declared
  pattern. Overlaps #1881, which is already in main.

## Done when
- [ ] the PR's head merges main with `bun run cat merge:main` and no refusal, and
      CI is green on that head
- [ ] the PR re-enters a train with a new `ready: <sha>`, and lands
```

For a combined-gate refusal, list the gate, its first failing line, and
**which other members** the train held, because the fix may belong to either
side.

### 2. Hand it back to the owning session, with a fail condition

The owning session is the one in the PR's `Claude-Session:` trailer, or in its
body. Hand the work item back to it in `agent-handoff` form: the steward is the
**coordinator and verifier**, the owning session is the **executor**, and the
owner rules on anything authored. The work item carries:

- `## Roles`: steward (coordinator, verifier, closes), owning session
  (executor), owner (authored conflicts, any exception).
- `## Report to`: the PR. One line per event:
  `<id>: started`, `<id>: done <sha>`, `<id>: blocked <why>`.
- `## Done when`: as above. The verifier is the next train, not the executor's
  own log.
- `## Fails if`, the **fail condition**, which is when the steward takes the
  work item back:
  - no `started` line on the PR **within 4 hours** (these hours are as of
    2026-10-08, when cat-harness was seeded; `merge-manager-watcher` acts at
    2+ hours and `merge-queue` calls a PR `stale` after 24, and the owner
    decides which governs);
  - or no push to the PR branch **within 24 hours**;
  - or the owning session is **gone**: archived, failed, or unknown to
    `get_session`;
  - or the executor reports `blocked` on something it cannot settle.

Send the hand-back to the session itself (`send_message`), as **one line**
that names the work item and the branch, never the instructions. The instructions
are in the work item, on the branch. After that, the steward does not edit the
work item, except to add a further refusal (§1), record a dispatch (§3) or close it (§5). Anything else it learns goes to the PR (`agent-handoff` §1).

**The fail condition is a takeover, not a reminder, and that differs from
`agent-handoff` §7 on purpose.** There, the executor is in another environment
and the coordinator *cannot* do the step, so an expiry only means asking
again. Here, the work is in this repository and an agent can do it, so a
missed deadline moves to §3. The one thing that is never done is putting a
second writer on a branch whose first writer may still be live: before taking
over, read the work item's holder note and the PR's last push (`bean-coordination`
§"A quiet claim").

### 3. When no live owner can be reached, dispatch one agent

If the owning session is gone, or the fail condition has fired, dispatch **one**
agent on the PR's branch (`dispatch-agent`). One agent is not a swarm; a
second one is, and needs the owner's per-swarm permission (`swarm-management`).
Its budget is modest: one fix, one push, one report.

- **It may do** what the patterns would have done had they been declared: bring
  main in with `merge:main`, regenerate, and fix a gate failure that has one
  mechanical answer. It pushes merge commits only, and never force-pushes.
- **It may not decide an authored conflict.** Two sibling PRs editing one
  work item, one script changed differently on both sides, or a page over its
  budget only in combination: each of these
  is a choice between authors. The agent writes the question to the owner on
  the PR, with both sides quoted, the options and a default, and stops
  (`interaction-modality` §4.1).
- **It signs `ready:` only once it is the owning session.** `merge:guard`
  takes the PR's own session from the last session id in the PR body
  (`signingSession` in `merge-guard.ts`), and accepts a `ready: <sha>` marker
  only from that session. When the owning session is gone, the agent becomes
  the owner the way [`merge-queue`](merge-queue.md) §"Stalled for days" step 3
  describes, with the owner's go-ahead as there. It edits the body's session line to its own session, records
  "taken over from <old> (gone)", and then marks the PR ready and signs. The
  steward never edits that line to itself, and never signs: while a Merge
  Manager is active, check 2 refuses a merging session that marked the PR
  ready itself.
- **The dispatch is recorded on the work item** by the steward, before the agent
  starts: `## Attempts`, with the date, the reason the fail condition fired,
  the agent's session or task id, and the budget.

Two failed attempts with the same cause go to the owner instead of a third
dispatch (`agent-handoff` §7).

### 4. Comment on the PR once, and edit that comment

One comment per refused PR, **edited in place** as the work item moves on, as
`merge-main.yml` does with its own comment. It names the work item, the head sha,
the train, the refused paths, and who holds the fix (the owning session, a
dispatched agent, or the owner). A second refusal of the same PR updates the
same comment. Remove `ready-to-merge` ([`merge-queue`](merge-queue.md)).

### 5. Close the bean when the PR's fate is settled

The steward is the verifier, so the steward closes:

- **the PR lands**: `completed`, with the merge commit as evidence;
- **the PR is closed unmerged**: `scrapped`, with the reason and a link. The
  work item is never deleted (`bean-coordination`).

A fix that is pushed but has not landed does not close the work item. The member
must survive a train first. A refusal work item left open after its PR has gone is
a stale hold.

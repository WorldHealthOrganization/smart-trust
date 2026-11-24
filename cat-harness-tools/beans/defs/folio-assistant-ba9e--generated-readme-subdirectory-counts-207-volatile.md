---
# folio-assistant-ba9e
$schema: bean/1.0.0
title: 'Generated README subdirectory counts: 207 volatile integers across 54 READMEs — move them to the _data layer'
status: completed
type: task
priority: normal
created_at: 2026-10-02T22:34:28Z
updated_at: 2026-10-04T12:13:31Z
parent: folio-assistant-hfag
---

Child of `y7b3` part 2, which the owner left as "decide later" on 2026-09-30
with three options on the table (band the count, drop it, keep it exact).
**Owner chose a fourth on 2026-10-02: pull the count dynamically from the KG
JSON-LD rather than freeze it into committed markdown.**

## Why that is the right answer and the other three are not

The repository had already reached this conclusion from the opposite
direction. `.gitattributes` lines 85-92, measured in a scratch repository:

> `-merge` does NOT reduce the NUMBER of conflicts ... What it buys is one
> clean whole-file conflict to resolve by regenerating ... **Removing these
> conflicts, rather than tidying them, needs the files off `main`
> altogether.**

And a custom merge driver is refused on purpose (`.gitattributes` line 23):
it needs per-checkout `git config merge.*.driver`, so it "would work here and
nowhere else, including CI".

Banding only lowers the frequency; a band crossing still conflicts. Dropping
the count loses what the owner asked for on 2026-09-29 (a large instance
shows a count instead of listing every file). Taking it off `main` is the
only option that removes the class.

## The measured size of the class — wider than `y7b3` states

`y7b3` measured one file. Measured 2026-10-02 across the checkout:

| | |
|---|---|
| generated READMEs carrying a `\| N files \|` subdirectory row | **54**, across 14 instances |
| such rows in total | **207** |
| worst single file | `cat-harness/library/README.md`, 40 rows |
| `beans/README.md`, the one `y7b3` measured | 4 rows |

So this is a class fix for 54 files, which is the argument for fixing it in
the writer rather than per file.

## Why `_data` is the landing place, measured

`classify()` from `merge-conflict-patterns.ts`, run 2026-10-02:

| path | strategy |
|---|---|
| `cat-harness/docs/_data/harness.json` | **`take-base`** |
| `beans/README.md` | `generated-regions` |
| `package.json` | `refuse` |

`merge-conflict-patterns.ts:171` already globs
`cat-harness/docs/_data/**` under the `site-data` pattern. **So a count moved
into `_data/` is auto-resolved by machinery that exists**, with no new
pattern, no `.gitattributes` entry and none of the per-checkout git config the
repository rejected. A README is not eligible for the same treatment because
it carries authored prose outside the markers, which is exactly the
carry-forward test `.gitattributes` states.

## Separately, and smaller: the count should not read the WORKTREE at all

`bootstrap-tools/scripts/git-files.ts:23` runs
`git ls-files --cached --others --exclude-standard`. `--exclude-standard`
keeps ignored junk out (the `__pycache__` case in that module's header), but
`--others` still counts an untracked file nobody ignored, so a transient from
an earlier step moves a committed count and reddens
`readme:subgraphs:check` for nobody's fault. Train 6 hit this.

Counting `--cached` only makes the count a function of the COMMIT,
reproducible by anyone at that sha. The nuance that keeps it honest: during a
`readme:sync` the files just written are untracked, so `--cached` alone would
undercount until they are staged -- which is why the merge-train process now
carries an explicit clean-tree precondition on `Task_Admit` rather than
assuming one.

## Not a one-repo change

The renderer is `bootstrap-tools/scripts/subgraph-readmes.ts` (a PINNED
submodule); the `_data` writer and the Jekyll include are `cat-harness`. So it
is a two-repo change and was deliberately NOT bundled into #1894, which would
have meant a submodule bump inside a process PR.

## Done when
- [x] `bootstrap-tools`: subdirectory rows render a marker invariant under
      adding one file, not an integer; counts written to the KG JSON-LD as `fileCount` (see below)
- [x] `bootstrap-tools`: `filesIn` counts the committed tree (`--cached`),
      with the staging nuance above handled rather than ignored
- [x] `cat-harness`: the page resolves the live count (from the published KG JSON-LD, see below)
- [x] `readme:subgraphs:check` green with a transient file present in the tree
      — the regression test for the Train 6 failure
- [x] `y7b3` part 2 checked off, with this bean named as its answer

_2026-10-04T05:43:41Z_ — Claimed by claude/zealous-thompson-y8dcf1-ba9e — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


## Corroboration, 2026-10-04: FIVE stalings in one day across FOUR branches

Not a new finding — this bean's premise, measured again from the inside while doing
unrelated work. Every one was `cat-harness/scripts/README.md`, and every one cost a
commit, a push and a CI cycle:

| # | branch | what moved | conflicted? |
|---|---|---|---|
| 1 | `claude/uoij-kind-register` | two files ADDED (`kind-register.ts`, `kind-table.ts`) | no |
| 2 | `claude/xsrv-route-publish` | one file ADDED (`route-publish.test.ts`) | no |
| 3 | `claude/uoij-kind-register` | `main` DELETED two `.json` files: 480 → 478 | **no** |
| 4 | `claude/xsrv-route-reader` | `main` added two: regenerated during a merge | yes, `generated-regions` |
| 5 | `claude/xsrv-route-reader` | `partition/` 4 → 2 files, minutes after #4 | no |

### The two things the day added to what this bean already says

**A count can go stale through a CLEAN merge, which no merge pattern can catch.**
`readme-generated-regions` resolves this file when it *conflicts*. Cases 1, 2, 3 and 5
did not conflict — the sides touched different lines, git merged them, and the surviving
integer simply became false. There is no conflict to apply a pattern to. Only the owning
`--check` notices, which means it is found by CI after a push rather than before one.

**Case 5 is the sharpest.** It went stale **minutes after** I regenerated it inside the
very merge of case 4, on the same branch. `main` merged 4 PRs in the hour; a regeneration's
shelf life is shorter than the time between a push and its CI run. So "regenerate before
pushing" is not a workaround for this class — it is a race the author loses.

Both support this bean's own conclusion rather than qualifying it: banding lowers the
frequency and would not have helped any of these five, and dropping the count loses what
the owner asked for. The counts have to come off `main`.

### One caution for whoever builds it

The dynamic source must be reachable at RENDER time without a network hop, or the page
degrades to no count where today it degrades to a wrong one — and a wrong count is at
least visibly wrong to a gate, which is how all five of these were caught.



## Summary of Changes (closed 2026-10-04)

All landed on `main`:
- **bootstrap-tools#8** (merge commit 08e42b8): rows invariant under adding a file; `filesIn` reads `--cached`; untracked files are a printed finding.
- **folio-assistant#2044**: pins it; `kg-export` writes `fileCount` on every Subgraph node.

**Where the count landed, and why not `_data`.** The owner's 2026-10-02 ruling at the top of this bean is *"pull the count dynamically from the KG JSON-LD"*. `_data` was this bean's own proposal for reaching that, and the JSON-LD meets the ruling directly. It is a build output, so it is never committed and cannot conflict.

**Evidence that a page shows it, measured on the live site.**
- `cat-harness.jsonld` on `gh-pages` was built from main 8274562 at 2026-10-04T10:32Z.
- It carries `fileCount` on 27 Subgraph nodes (e.g. `directory/tools` 7, `directory/code-lists` 14), and its `@context` declares the term.
- The KG viewer (`<site>/cat-harness/`) lists every declared property of a selected node, so it renders the count unflagged, read from that document at page load.

**Not done here:** the Subgraph facet's numbers still count graph nodes, not files. That is deliberate: those numbers state what clicking the facet returns.

---
# folio-assistant-27u0
$schema: bean/1.0.0
title: 'check:anchor-names was blind to 2 of 4 base spellings: 75 ascents unseen, 9 real findings, and it printed a green check'
status: completed
type: bug
priority: high
created_at: 2026-09-27T05:47:27Z
updated_at: 2026-09-27T05:47:27Z
parent: folio-assistant-1xhc
---

Found 2026-09-27 while reading `check-translation-catalogue.ts`, which arrived on
`main` in the 36 commits merged into `claude/brave-hypatia-r820sf`. Its docblock
justified deriving the instance root locally with *"because no module exports
it"*. That claim is false — `cat-harness.ts:2702` exports `instanceRootFor` — and
checking it opened the real defect one level down.

## The defect

`check:anchor-names` enforces a definitional rule: `REPO_ROOT`/`REPO`/`repoRoot`
must land on the repository root, `INSTANCE_ROOT`/`instanceRoot` on a directory
carrying its own declaration. It finds ascents with one regex, whose BASE
alternation was:

    (?:import\.meta\.dir|__dirname)

Two spellings of "the directory holding this file". This repository uses four.
The portable-ESM `dirname(fileURLToPath(import.meta.url))` and the CJS
`dirname(__filename)` were **not matched at all**, so an ascent written either
way was not an ascent as far as the check could tell.

## Measured, on `main` at `e6404bc80de`

    before   1465 files, 429 declared ascents, 0 findings, rc=0
             "every name that claims an anchor lands on it"
    after    1465 files, 504 declared ascents, 9 findings, rc=1

**75 ascents were invisible, and 9 of them were findings** the check would have
reported. Every one is the same shape: an anchor named `REPO_ROOT` or `REPO`
landing on `cat-harness/`, which is an INSTANCE root.

    cat-harness/test/a11y.e2e.ts                        REPO
    cat-harness/content/pipeline/lean-compile-audit.ts  REPO_ROOT
    cat-harness/content/pipeline/gen-site-jsonld.ts     REPO_ROOT
    cat-harness/content/pipeline/translation-index.test.ts  REPO_ROOT
    cat-harness/content/pipeline/generate-lean-stubs.ts REPO_ROOT
    cat-harness/content/pipeline/qa-sweep.ts            REPO_ROOT
    cat-harness/content/pipeline/proof-axis-dashboard.ts    REPO_ROOT
    cat-harness/scripts/gen-docs-pages.ts               REPO_ROOT
    cat-harness/scripts/tests/liquid-includes.test.ts   REPO_ROOT

## All nine were name-wrong, not depth-wrong — established, not assumed

The question that decides the cost is whether each value is *used* as a repo root
(depth wrong, behaviour change to fix) or as an instance root (name wrong, pure
rename). Every one is the latter, and the callees say so: `siteDirFor(X)`,
`folioDir(X)`, `qaCriteriaFor(X)`, `siteRoot(X)` and `join(X, "content", "docs")`
all take an INSTANCE root.

Two files had already written the answer down beside the wrong name:

- `gen-docs-pages.ts` called **`repoRootFor(REPO_ROOT)`** on its own anchor —
  converting it to the real repository root, which is only meaningful if the
  author knew the value was an instance root.
- the same file's comment read *"`todos/` sits at the repository root while this
  generator's `REPO_ROOT` is the cat-harness instance"*.

So the renames are nominal: 84 occurrences across 9 files, none of the consts
exported, so each rename is file-local. `bunx tsc --noEmit` is what makes a
partial rename impossible to ship.

## Why this is `b963`'s re-rooted-ascent shape, and why `a6kl` did not cover it

`qa-sweep.ts` is the clearest instance. Its comment said *"repo root, computed
from this file's location (`content/pipeline/qa-sweep.ts` -> repo root is two
levels up)"*, and that was **true before the split**: two levels up from
`content/pipeline/` used to be the repository. The split under `cat-harness/`
changed what the ascent lands on and left both the name and the comment behind.

`a6kl` swept this class already and found nothing live — correctly, because it
swept the **CWD**-vs-instance-root defect (`resolve(".")`), enumerating "6 gates
resolve a root from the CWD". An `import.meta.dir` ascent is *immune* to that
one: it does not depend on the invocation directory at all. It breaks on a
different event — the file moving, or the tree moving under it — which is exactly
what the split did.

## The check's own defect class, turned on itself

An ENUMERATION that must be edited when a new spelling appears is one that will
be wrong. That is `6tkl`'s argument — *"a list that has to be edited when a
directory is added is a list that will be wrong, and the fix is to ask the
filesystem rather than to lengthen it"* — applied to the matcher instead of the
corpus, and stated in the docblock two functions above the regex that broke it.

Unlike a corpus there is no filesystem to ask: a base is a syntactic form, so the
list stays a list. What replaces the missing guarantee is a case **per spelling**
in `check-anchor-names.test.ts`. Both directions mutation-tested: breaking only
the `__filename` alternative reddens exactly the 2 CJS cases and leaves ESM
green; breaking the `fileURLToPath` alternative reddens 4, including *"a
correctly-named anchor in a dirname() spelling stays clean"*, which proves that
case is not vacuous.

## A count in this bean was wrong once, and the correction is the point

A first draft of the docblock said **25** invisible ascents, not 75. The 25 came
from my probe, which scanned only the 24 files declaring an anchor-NAMED const,
while the check reads all 1465 and matches every name. The narrower population
was the measurement's, not the defect's. Corrected before landing, and left named
in the docblock rather than silently replaced.

## Done when

- [x] the two missing base spellings are matched
- [x] the 9 findings are resolved — all as renames, no ascent depth changed
- [x] a test per spelling, mutation-tested in both directions
- [x] `check:anchor-names` clean: 504 ascents, 0 findings
- [x] `qa-sweep.ts`'s comment corrected, since it asserted the repo-root reading
- [ ] `bun run cat gates` clean on the final tree (running)

## Not done here, and deliberately

The docblock claim that opened this — *"no module exports it"* in
`check-translation-catalogue.ts` — is **left as it stands**. It is false as
written, but the 16 files deriving an instance root from their own location are
now all *guarded*, which is the property that matters, and `instanceRootFor`
answers a different question (walk up until a declaration is found) than these
ascents do (assert a known depth). Whether the ~16 should call it instead of
counting `..` is a design question with a real argument on each side, and it is
not this bean's to settle.

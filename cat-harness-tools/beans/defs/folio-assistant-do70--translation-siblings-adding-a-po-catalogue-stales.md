---
# folio-assistant-do70
$schema: bean/1.0.0
title: 'SIBLINGS: seven generated artefacts go stale when a catalogue or a BEAN changes, and no gate names its remedy — reuse skills:register''s converging chain'
status: completed
type: task
priority: normal
created_at: 2026-09-26T10:05:01Z
updated_at: 2026-10-07T17:37:00Z
parent: folio-assistant-1xhc
---

Found 2026-09-26 by paying the cost, then reading PR #1361 and finding the
mechanism already built for a sibling problem.

## What it cost, measured on one change

Adding 10 `.po` catalogues (#206, PR #1369) left **six** generated artefacts
stale. I discovered them one at a time, from failing gates, across three full
`bun run cat gates` runs:

| gate that went red | what regenerates it |
|---|---|
| `translation:block-qa:check` | `bun run cat translation:block-qa` |
| `translation:status:check` | `bun run cat translation:status` |
| `state:visualizer:check` | `bun run cat state:visualizer` |
| `docs:harness:check` | `bun run cat docs:harness` |
| `gen-docs-pages.ts --check` | `bun run cat-harness/scripts/gen-docs-pages.ts` |
| `translation:index:check` | `bun run cat translation:index` |

Nothing in the repository says that adding a catalogue entails those six. Each
gate names its own stale file correctly and none names the remedy, so the list is
reconstructed from CI by whoever changes a catalogue next. **Two of the three gate
runs existed only to find the next name on this list.**

## The mechanism exists — do not design a second one

PR #1361 (bean `nfv3`) built exactly this for skills, after **seven merges in
three days** each landed a skill file without its manifest entry, reference page
and `kg-qa` sidecar. `bun run skills:register` performs the chain, and its two
findings are the ones this bean would otherwise have to rediscover:

- **A gate that states the defect and not the remedy** is how six checks come to
  mean "read the corpus and work it out". Its failure now names the command.
- **One pass is not a fixed point** — measured there when `docs:auto` staled
  behind `glossary:page`. The chain ITERATES and asserts convergence against the
  `:check` forms rather than running a fixed number of passes.

The second is not hypothetical here: `gen-docs-pages` writes
`docs/_data/translation-qa-pages.json` from the sidecars that
`translation:block-qa` writes, and `state:visualizer` reads what `gen-docs-pages`
produced. Ordered wrongly, one pass leaves a stale file behind and the run looks
clean.

## Done when

- [ ] one command regenerates every artefact derived from `translations/`, built
      on `skills:register`'s shape — iterate, then ASSERT convergence against the
      `:check` forms, never a fixed pass count
- [ ] each of the six gates above names that command in its failure text, so an
      author has somewhere to look rather than a list to rebuild from CI
- [ ] MEASURED AFTER: adding a catalogue to a clean tree and running the one
      command leaves `bun run cat gates` with no stale-artefact failure — falsified by
      doing it, not by reading the script
- [ ] the dependency order is DERIVED or asserted, not written down in a comment
      that a later generator can fall out of step with

## Not in scope

The merge-side gap — a gate passing on every PR head while `main` takes an
unregistered artefact through a merge the gate never ran on the merged tree. #1361
names it and leaves it open as `check:merged`, bean `nytj`. Same shape, one level
up, and already recorded; this bean is the author-side command only.


## Two corrections to this bean, from trying to satisfy it

### It is SEVEN artefacts, and the seventh is not a translation artefact at all

`docs/_data/harness.json` embeds a **bean count**. Creating this task's three
beans took it 362 → 365 and turned `docs:harness:check` red, with nothing in the
change touching a translation. So the edge is **bean → `harness.json`**, and it
fires on every bean any session creates, not on catalogue changes.

That widens the bean rather than confirming it: the author-side command this asks
for cannot be `translation:register`, because the artefacts that go stale are not
selected by what you changed. They are selected by what *reads* what you changed,
and beans and catalogues are read by an overlapping set.

### I nearly recorded an ordering cycle that is not there

My first reading of the failure was that `gen-docs-pages` re-staled what
`docs:harness` had just written — an ordering dependency, which is what the
`skills:register` precedent had primed me to look for. **Measured: it does not.**
Running `gen-docs-pages` alone leaves `docs:harness:check` green, and the whole set
converged **after one pass** once the bean count was written. The red was my own
bean edit, arriving after the previous regeneration.

So the `#1361` finding that *"one pass is not a fixed point"* is real **there** and
is NOT reproduced **here**. Kept as a design requirement for the command — assert
convergence rather than assume it — but this bean must not cite a cycle it did not
observe. The distinction matters because a tool built to break a cycle that does
not exist would be justified by nothing.

### What the evidence actually supports

- seven generated artefacts, discovered one at a time from failing gates across
  four full `bun run cat gates` runs;
- **no gate names its remedy**, so the list is rebuilt from CI each time;
- the dependency set is per-READER, not per-directory — which is why writing it
  down as a list in a comment would be wrong, and why the last Done-when item asks
  for it DERIVED or asserted.


## THIRD correction — the ordering dependency is real, and my retraction over-corrected

The section above says *"I nearly recorded an ordering cycle that does not exist"*
and that `gen-docs-pages` alone leaves `docs:harness:check` green. **That test was a
no-op, and the conclusion drawn from it was too strong.**

Established by reading the code rather than by running it again:
`sync-docs-harness.ts` calls `readTileCounts(parsed)`, and the projection it parses
is `docs/assets/beans/index.json` — **which `gen-docs-pages` writes.** So
`harness.json` embeds counts derived from another generator's output, and the
order is fixed:

```
gen-docs-pages  →  docs:harness
```

Run the other way, `harness.json` keeps the previous count and
`docs:harness:check` is red. Demonstrated on the 2026-09-26 merge of `origin/main`
(38 commits, which brought new beans): `docs:harness` → `gen-docs-pages` →
`state:visualizer` left `docs:harness:check` FAILING, and a second `docs:harness`
cleared it.

### Why the earlier test proved nothing, which is the part worth keeping

I ran `gen-docs-pages` alone on a tree where **nothing had changed the bean or QA
counts**. It rewrote the projections with identical numbers, `harness.json` was
already consistent with them, and the check stayed green — so the run exercised the
dependency with **nothing to propagate**. A dependency test needs a change to
propagate, and mine had none. The green was information about my fixture, not about
the pipeline.

### What is and is not true

| | |
|---|---|
| an ordering dependency `gen-docs-pages` → `docs:harness` | **yes**, derived from the reader |
| a CYCLE (mutual staling) | no — not observed, and not implied by the above |
| "one pass is not a fixed point" in the #1361 sense | **yes, in the wrong order**; one pass suffices in the right one |

So the design requirement stands and is sharper than before: the command must
**assert** convergence, and its order is **derivable** — from which generator reads
whose output, exactly as the last Done-when item asks. `readTileCounts` is the
edge, written down in one place, which is why deriving it is possible rather than
aspirational.

This is the third correction on this bean, all three from trying to satisfy it.
Left in sequence rather than rewritten into a clean account, because the sequence
is the evidence for the last Done-when item: an order recorded in prose drifts, and
mine drifted twice inside one session.


## 2026-09-26 — measured again, and the `harness.json` case has a stated principle against it

Hit on PR #1419 (`e8m3`). `docs:harness:check` red; established as `main`'s
rather than the PR's by regenerating on **both** sides and diffing. The
staleness is one line and byte-identical on pristine `origin/main` and on the
branch:

```diff
       "id": "beans",
-      "count": 394,
+      "count": 396,
       "unit": "beans"
```

**It is the bean census.** That is why this row keeps coming back and why no
feature PR can carry the fix: regenerating it inside one collides with every
sibling doing the same, and it re-stales the next time anybody runs
`beans create`.

`AGENTS.md` already states the rule this violates, for a different artefact:

> The file COUNTS are printed rather than recorded — a census moves on any
> commit and a gate keyed on it is stale by default; `hasFiles` carries the
> only thing it decides.

`audit-coverage` was built that way on purpose. `harness.json` records the
count instead, so it inherits exactly the staleness that design avoids. That
suggests a **second route** alongside this bean's converging-chain remedy, and
they are not alternatives — the chain makes the remedy discoverable, this makes
one row stop needing a remedy at all:

- for `harness.json`'s `count`, ask whether the number must be **recorded** or
  merely **rendered**. A navbar badge can count at render time; if it can, the
  field comes out and this row leaves the chain permanently.

Not started, and not this PR's to decide: whether the badge may be computed at
render time is a question about the docs site's build, not about beans.

One thing the diff method is worth keeping for on its own: the checker's message
says `docs/_data/harness.json`, but the file is at
`cat-harness/docs/_data/harness.json`. A `git diff` on the path the error prints
shows nothing, which reads as "no staleness" and is how I nearly closed this as
a non-finding.


_2026-09-29_ — **Re-parented `bzyu` → `1xhc`** by subject, per todo-manager §"WHICH parent" (owner choice '1 2 3' on the LSI epic-filing proposal, bean ansc). Seven artefacts going stale with no gate naming the remedy is a gate problem; catalogues were only the trigger.

## Completed on landed evidence
Landed on main in PR #1426 (harness.json census and sibling generated artefacts sync).

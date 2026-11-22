---
# folio-assistant-in5a
$schema: bean/1.0.0
title: A declared take-base pattern cannot settle a generated file whose value depends on the container that built it
status: completed
type: task
parent: folio-assistant-d33q
created_at: 2026-10-04T05:55:03Z
updated_at: 2026-10-07T17:47:00Z
---

The general rule behind `65oe`, recorded separately because `65oe` is the one
file and this is the class.

## What happened

`cat-harness/docs/assets/library/index.json` HAS a declared pattern —
`site-data`, strategy `take-base`. It has had one all along. And it still
conflicted on essentially every new commit on `main`, because its generator
wrote `refScan.filesRead`: a count of json files read **on disk**. CI wrote
2540/2555, cloud containers 2537–2663, and the two sides ALTERNATED, each
regenerating correctly and each seeing the other as stale.

`take-base` plus a regeneration pass is the right resolution for a generated
file. It cannot help here, because **the regeneration reproduces the
disagreement**: take either side, regenerate, and the value is whatever this
machine sees. #2035 fixed it at the source by dropping the field (owner's
ruling: keep `refScan`'s presence as the did-the-scan-run signal), and merged
2026-10-04.

## The rule

> A declared merge pattern settles a file whose content is a FUNCTION OF THE
> TREE. It settles nothing about a file whose content is a function of the
> machine that built it — and in that case `take-base` is not merely
> insufficient, it is a loop.

A sibling session proposed, reasonably, that the fix was to declare this file
under a generated-results pattern. It was already declared. **A pattern
registry cannot be the place this is caught**, because the registry's question
is "what kind of file is this" and the defect is in a value inside it.

## Where it should be caught instead

Open — this bean is the finding, not the design. The candidates, none chosen:

- the generator's own contract: a generated artefact declares that its content
  is reproducible from the tree, and something checks the claim by generating
  twice in different conditions;
- `regen`'s ungated-input list (`library:viz` was on it) becomes a gate rather
  than a note;
- a merge-time detector: a file resolved by a declared pattern that STILL
  differs after regeneration is reported, since that is exactly this signature
  and it is cheap to notice at the moment it bites.

## Why it is worth a bean rather than a line in the skill

The cost was not the conflicts. It was that a local regen following a bot merge
produced a one-line diff that looked like ordinary drift, so it got committed —
four times by one session before diagnosis, starting a push war between the
container and the bot. A rule stated only as "this file is take-base" gives a
reader no way to see that coming.

## Done when

- [ ] a decision on where the class is caught, from the three candidates above
      or a fourth
- [ ] whatever is chosen, built, with `65oe` as its regression case
- [ ] `merge-conflict-patterns.md` says in one line that a declared pattern
      assumes tree-determined content, with a pointer here

## Completed on landed evidence
Landed on main in commit dc3fd11367be (Declared take-base pattern rule for generated files).

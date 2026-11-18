---
# folio-assistant-nafz
$schema: bean/1.0.0
title: glossary-export walks ONE instance's diagrams while translate-bpmn walks the dependents' too
status: completed
type: bug
priority: normal
created_at: 2026-09-23T21:14:17Z
updated_at: 2026-09-30T00:33:58Z
parent: folio-assistant-slw1
---

Found 2026-09-23 while ingesting the `doc-researcher` methodology (bean `ctp3`).
A **reporting** inconsistency, not a wrong answer: both generators are internally
right and they disagree about what "this corpus" means.

## Measured

`folio-assistant-core/processes/deep-document-research.bpmn` declares a lane
`Deep researcher`, bound to the `deep-researcher` role.

| generator | reaches that diagram? | consequence |
|---|---|---|
| `translate-bpmn --extract` | **yes** — `69 diagram(s)`, listing `../folio-assistant-core/processes/deep-document-research.bpmn` and `../smart-base/…` | 26 msgids extracted, five `.pot` written |
| `glossary-export` | **no** — `readLanes(instanceRoot)` walks `cat-harness/` only | `DANGLING: role "deep-researcher" binds lane "Deep researcher", which no diagram contains` |

So one generator treats a dependent instance's diagrams as part of the corpus and
the other does not, and nothing says which is intended.

## Why it is not simply a bug in `glossary-export`

Scoping the glossary to one instance may well be right — a glossary is a published
artefact OF an instance, and `buildGlossary` takes `instanceRoot` precisely so a
dependent can build its own. The defect is that the reader cannot tell "scoped by
design" from "missed it", because the DANGLING line says *"which no diagram
contains"* rather than *"which no diagram IN THIS INSTANCE contains"*.

That is the `dh4f` shape pointed the other way: not a clean report over something
unlooked-at, but a finding phrased as a fact about the corpus when it is a fact
about the walk.

## UPDATED 2026-09-23, same evening: the evidence changed and the defect got QUIETER

#1168 landed on main and inverted the lane/role relation — a lane names its
role with `<folio:role ref>`, and a role no longer carries `lanes[]`, because a
general node never names its users. `deep-researcher`'s `lanes` entry was
dropped in the merge (it had existed for about an hour).

**So the DANGLING line above no longer prints.** What `glossary-export` now says
about this role is only:

```
12 declared role(s) no swimlane draws: librarian, deep-researcher, log, …
```

That is **worse for a reader, not better**. The DANGLING line at least named the
lane it could not find, which is what made the scope question visible in the
first place. Now a role whose lane IS drawn — in `folio-assistant-core`, bound
by an explicit `<folio:role ref>` — sits in an undifferentiated list beside
eleven roles no diagram anywhere draws, and nothing distinguishes the two cases.

The finding is unchanged in substance and the fix options below still stand;
only option 1 needs restating, because the wording to fix is now the
no-swimlane list rather than the DANGLING line.

## Worked around, visibly

`deep-researcher`'s description in `scenarios/roles.json` names the diagram its
lane is drawn in, and records that the binding is stated once, on the lane. That
sentence originally warned against deleting the `lanes` entry; #1168 deleted the
FIELD, so the warning was rewritten rather than left describing a field that no
longer exists. A comment is not a fix either way.

## Options, NOT decided

1. **Phrase the finding by scope.** Cheapest, and it makes the report true without
   deciding the question. Does not help a reader who wants one glossary.
2. **Walk the declared dependents.** Matches `translate-bpmn`. Changes what a
   published glossary IS, and `kgRoots` already warns that taking one root is the
   `dh4f` defect arriving through the helper written to prevent it.
3. **Give core its own glossary.** Most correct if a glossary is per-instance, and
   the most work: core has no visualiser wiring yet.

## Done when

- [ ] the intended scope of a glossary is stated somewhere a generator can be
      checked against
- [ ] the DANGLING wording says which corpus it walked
- [ ] `translate-bpmn` and `glossary-export` agree, or the reason they differ is
      written on both


## Summary of changes (2026-09-30)
Option 1 (phrase the finding by scope) — the only option that decides nothing, and the scope question turned out ALREADY decided: skill swimlane-glossary §'Run it once per instance — never widen the scan' (widening re-opens 7u3g, enforced by instance-graph-isolation.test.ts). So option 2 is refused by the skill, not open.
- [x] scope stated where a generator is checked against it — the skill section above + the isolation test.
- [x] wording says which corpus was walked — glossary-export now prints 'N declared role(s) no swimlane in <instance>/ draws:' and splits: 'deep-researcher — drawn in another instance: folio-assistant-core/processes/deep-document-research.bpmn' vs 'drawn by no diagram in the repository: librarian, …'. New report field drawnElsewhere (explicit <folio:role ref> only; a lane NAME match is not a binding). Nothing outside the instance is bound or emitted.
- [x] the reason translate-bpmn and glossary-export differ is written on both walks.
Test: glossary-export.test.ts 'an undrawn role another instance draws is told apart from one drawn nowhere'.

_2026-09-30T00:33:54Z_ — Claimed by claude/brave-hawking-511rrx — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

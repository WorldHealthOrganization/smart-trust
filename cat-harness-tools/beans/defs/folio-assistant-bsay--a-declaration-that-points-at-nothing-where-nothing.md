---
# folio-assistant-bsay
$schema: bean/1.0.0
title: 'A declaration that points at nothing, where nothing can fail: three live cases and the gate that reports two of them and exits 0'
status: completed
type: task
priority: normal
created_at: 2026-09-27T06:13:41Z
updated_at: 2026-09-27T07:07:40Z
parent: folio-assistant-1xhc
---

## The three cases, measured on `8cce91e4eab`

### 1. A banner naming a page that does not exist -- detected by NOTHING

`SAME_BASENAME_DIFFERENT_DOCUMENT["kg-navigation"]` in `gen-skill-docs.ts`
named a twin published as `local-kg-navigation`. That page does not exist and
cannot: the `local-` prefix comes from `.claude/skills/local/`, which holds
three skills and `kg-navigation` is not one. So the live
`kg-navigation.html` -- the page a reader is sent to for *how to find the skill
you need* -- carried:

```text
**This is the skill `skill_fetch` serves.** A stub of the same name is
published as [Reading a knowledge graph before you have anything
(bootstrap)](local-kg-navigation.html); it only points here.
```

(Fenced at column 0 rather than blockquoted: `check:subgraphs` reads a
`](...)` in a blockquote as a real link and reported THIS TEXT as dangling --
quoting a broken link is how you mint another one.)

The entry was correct when `tdmg` added it. `pve3` then ruled bootstrap's
skills out of this instance and the second document stopped publishing, while
the entry stayed. The table is consulted for a name being PUBLISHED and never
asked whether the partner is -- the check ran on the wrong side of the
relation. Worse than the `SKILLS_CATEGORIES["bootstrap"]` heading of the same
week, because a reader ACTS on a banner.

`reportOrphans` cannot see it: an orphan is a page with no source, and this is
a LINK to a page that was never a page.

### 2 and 3. Two broken `coverage.visualiser` refs -- REPORTED, and unable to fail

    cat-harness.json  skills            -> .../index/skills/cat-harness/index.html
    cat-harness.json  swimlane-glossary -> .../glossary/glossary/index.html

Real pages: `.../index/skills/skills/index.html` and
`.../glossary/swimlane-glossary/index.html`. Same cause in both -- `docs-auto`
keys its sub-page on the DECLARED ID, the id moved (`cat-harness` -> `skills`,
bean `iwtn`), and the ref did not.

**I expected these to be unmeasured. They are not**, and that correction is the
useful half of this bean. `check:subgraph-coverage` names both exactly, and
exits 0. It is advisory by design (`2krx`) with `--strict` reserved for *"the
day the number is low enough to hold"* -- and `--strict` fails on ANY major,
which includes the 20-of-22 `undeclared` backlog. So the switch cannot be
turned on, and the backlog held the broken pointers hostage. `1xhc` again: a
finding measured, printed, and structurally unable to fail.

## The fix

- Both refs repointed.
- The `kg-navigation` entry removed, with the ruling recorded in its place --
  the `bootstrap` precedent: a stale entry reads as an unfinished job, so
  deleting it silently invites the next agent to re-add it.
- `CoverageFinding.unmet: "undeclared" | "unresolvable"`. A FIELD, not a test
  on `detail`: the exit rule acts on it, and a rule that reads prose breaks
  when the prose improves. `severity` cannot carry it -- both are `major`,
  which is precisely why `--strict` could not separate them.
- An unresolvable ref is now **fatal with no switch**. Not a tightening of the
  advisory: the file's own exit comment already said *"a declared-but-missing
  target is already a defect rather than a backlog item"*; what it lacked was a
  way to act on it. `2krx`'s advisory rationale is about unmet OBLIGATIONS, not
  wrong declarations. Count is 0 after the two repairs, so the ratchet is free.
- `unpublishedTwins` guards case 1, fatal in writing mode too: the wrong banner
  is already on disk by the time it runs and a re-run does not unwrite it.

## Falsified by breaking, both ways

- Re-added the `kg-navigation` entry: guard names it, exit 1. Removed: exit 0.
- Re-broke the `skills` ref: check names it, exit 1. Repaired: exit 0.
- Vacuity controls in both test suites -- `unpublishedTwins(table, [])` must
  name every twin, and `auditAll`'s `undeclared` bucket must stay non-empty, or
  "no unresolvable findings" would pass over an axis reporting nothing.

## Not doing

The `serialisations` / `undeclared` backlog (2 of 22 declare a renderer) -- a
decision, not a defect, and `2krx` is right that a gate firing on twenty of
twenty-two subjects is one people learn to skim. And no sweep of the other
lookup tables: `SKILLS_CATEGORIES` measures 22 keys against exactly 22
reachable identifiers, a bijection, so it wants a guard rather than a sweep.

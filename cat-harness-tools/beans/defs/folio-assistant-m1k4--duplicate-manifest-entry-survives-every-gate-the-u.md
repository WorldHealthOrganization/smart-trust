---
# folio-assistant-m1k4
$schema: bean/1.0.0
title: DUPLICATE manifest entry survives every gate — the uniqueness check uses a Set, which collapses it
status: completed
type: task
priority: normal
created_at: 2026-09-26T08:05:18Z
updated_at: 2026-09-26T08:54:33Z
parent: folio-assistant-1xhc
---

Measured on `origin/main` at `0c5086db6c1`, 2026-09-26.

`cat-harness/skills/process/workflow/package-manifest.json` lists **14** skills of which
**13 are distinct**. `release-epic-planning` appears **twice**.

    skills entries: 14 | distinct: 13
    DUPLICATES: {'release-epic-planning': 2}

## Why no gate sees it

`scripts/tests/skill-manifest-coverage.test.ts:133`:

    const listed = new Set(p.listed);

A `Set` is the right structure for asking *"is this skill covered?"* and it is
structurally incapable of answering *"is it covered once?"* — the duplicate is
collapsed before the assertion runs. The check is not lax here; it is answering
a different question and cannot be asked this one. `bun test` over that file:
**4 pass, 0 fail**, with the duplicate present.

## Where it came from, and why that matters more than the entry

This is `6ptx`'s cost, realised. Two sessions independently repaired the same
defect — `release-epic-planning.md` arriving unlisted — and both appended the
entry:

- `#1364` (*"FOURTH OCCURRENCE, fixed in the same pass"*)
- `#1383` (*"remove `roles`, append the skill to the workflow package manifest"*)

Each was correct alone. Applied together they compose into a state neither
intended and no gate rejects. **That is the argument for coordination stated as
a defect rather than as an opinion**: the cost of duplicated repair is not only
the wasted session-hours the earlier bean measured, it is artefacts that are
wrong in a way the test suite is blind to.

## Done when

- [x] The duplicate is removed from `skills/process/workflow/package-manifest.json`.
- [x] A gate asserts each manifest lists every skill **exactly once** — the
      complement of the coverage question, not a widening of it. It must fail
      on today's `main` before the removal and pass after, or it is not testing
      what it claims.
- [x] Every other `package-manifest.json` is checked for the same shape. One
      duplicate found by accident says nothing about the rest, and this one was
      found only because a merge-preview was being inspected for another
      reason.

## Resolved 2026-09-26

**TWO duplicates, not one.** The sweep the third box asked for found a second
immediately: `folio-core` listed `decision-methodology-selector` twice. 21
distinct manifests checked, 2 carrying a duplicate, both now 0.

### Both were created by a MERGE, and one of them was mine

Walked each file's history rather than inferred:

| manifest / entry | how it became 2 |
|---|---|
| `folio-core` / `decision-methodology-selector` | `7296cb442fe` added it (**this session**, porting a base-branch fix), `5286dea8ea7` added it (a sibling, same fix, same day), **`9e6ddb41b7e` — this session's own merge — made it 2** |
| `workflow` / `release-epic-planning` | `1b962ab310c` (#1364) added it, `11a2186b4d8` (#1383) added it, **`cf466e2ba8a` — a merge — made it 2** |

Two sessions each append the same *correct* entry; git appends both array
elements; nothing rejects the composition. Neither author did anything wrong
and neither could have seen it.

**The commit that created the first one claimed `152/154` gates and `700`
e2e passing.** Both numbers were true. That is the whole argument for a gate
over a review habit: the verification was real and could not reach this.

### The gate

`skill-manifest-coverage.test.ts`, one test, and deliberately the *complement*
of the coverage question rather than a widening of it — coverage asks "is this
listed?" and answers it with a `Set`, which is correct there and structurally
incapable of answering "listed once?".

Falsified in both directions: re-adding the entry `main` carries today fails it,
naming `workflow/release-epic-planning`; removing it passes. It fails on the
real state of `main`, which is the only check that proves it is not vacuous.

Verified: `bun run cat gates` 152 of 154 — the two being the `t8g3` translation
drift the owner is holding red by decision — and `bunx playwright test` **700
passed, 0 failed**.

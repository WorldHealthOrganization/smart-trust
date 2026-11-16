---
# folio-assistant-z6xd
$schema: bean/1.0.0
title: 'FALSE COVERAGE: three gates declare @covers themes and none reads the themes graph — the kind reads covered over ground nothing reaches'
status: completed
type: bug
priority: normal
created_at: 2026-09-30T11:28:43Z
updated_at: 2026-10-06T19:30:00Z
parent: folio-assistant-1swy
---

Found 2026-09-30 during a goal review, and confirmed independently before
being written down.

`bun run cat audit:coverage` reports the `themes` graph kind as:

```json
{"kind": "themes", "state": "covered", "directories": ["who-iris/themes"],
 "criteria": [], "gates": ["bun run cat check:theme-art:check",
 "bun run cat theme:page:check", "bun run cat themes:css:check"],
 "typed": true, "hasFiles": true}
```

**None of those three gates reads the `themes` graph.** All three read
`cat-harness/schemas/themes.ts` — the platform's own twelve themes, which the
graph-kind registry explicitly says are *not* this graph: *"They are furniture
in `cat-harness/schemas/themes.ts` … a palette read off a WHO style guide is
subject matter, and subject matter does not live in the platform."*

Measured: `grep` for `who-iris/themes`, `graphKinds.*themes` and
`directoriesForGraph.*themes` in `gen-themes-css.ts`, `render-theme-sheet.ts`
and `check-theme-art.ts` — **zero hits in all three**. The one directory
declared for the kind (`who-iris/themes/`, holding `iris-web` and
`who-wpro-publication`) is reached by none of them, and `criteria` is empty.

## This is the defect `@covers` was built to prevent

`audit-coverage`'s own skill says the gate half is **declared rather than
inferred** because inferring it *"would credit a gate that reads `beans/defs/`
incidentally"*. A declaration removes that — but only while the declaration is
TRUE. Here three gates assert coverage of a kind they never open, so the report
reads `covered` over ground nothing reaches. **Worse than an undeclared gate**,
which at least counts itself as a gap and keeps every verdict an upper bound.

**And the first of the three lines was mine.** `gen-themes-css` was annotated
`@covers themes` on 2026-09-24 in the batch that closed bean `3srh`, from the
script's title rather than its scan set — the exact mistake `3srh`'s own summary
says it avoided by *"reading each one's actual SCAN SET rather than its title"*.
Two siblings then copied the pattern onto `render-theme-sheet` and
`check-theme-art`. So the convention's author got its first instance wrong and
the error propagated by imitation, which is the strongest argument for checking
a declaration mechanically rather than trusting it.

## Why it matters now rather than eventually

`themes` is the kind that carries PER-INSTANCE theming, and bean `v8n5`
(2026-09-30) independently measured the consequence: *"The harness surfaces do
not use them. The board tile, the navbar entry and any sticky resolve a `theme`
name against the platform's own themes."* So the one kind whose coverage matters
for GOAL 3's themed harness is the one reading falsely covered.

## Done when

- each of the three either reads the `themes` graph, or its `@covers` names
  what it actually grades (the platform theme module is not a declared graph, so
  `@covers none` with a reason may be the honest answer for all three);
- something reads `who-iris/themes/themes.ts`, or `themes` reports its true
  state — `typed-only` at best, since `ThemeSchema` does validate it;
- a check catches the general case: **a gate declaring `@covers <kind>` that
  never resolves a directory of that kind.** Without that, the next wrong
  declaration is found by a person again. This is the part that stops the class
  rather than the instance.

---

## 2026-09-30 — resolved: the three declarations corrected, and a gate that truly covers the kind

### What the three gates actually read

Measured on merged main, with the right key (`graphKinds`, not `graphs`):

| script | reads | the `themes` graph? |
|---|---|---|
| `check-theme-art.ts` | `readDeclaration` + `THEME_LAYOUTS` | no — declared theme **art** |
| `gen-themes-css.ts` | `THEMES` | no — the **platform's** themes, in code |
| `render-theme-sheet.ts` | `THEMES` + `readDeclaration` | no — both of the above |

The who-iris declaration is explicit that these are different objects:
*"These are NOT the platform's twelve themes: those are cat-harness's own
furniture, and a palette read off a WHO style guide is subject matter."*

All three now declare `@covers none` with their real subject. Exactly one script
in the corpus declares `@covers themes`, and a test asserts that.

### The honest state, measured before building anything

Removing the three false declarations turns `themes` into **`typed-only`** — 3
files, 0 criteria, 0 gates — and `audit:coverage:strict` exits 1. So the truthful
state was a finding, exactly as this bean predicted, and a data-only fix would
have reddened CI. `typed-only` is still a finding: typing a node is not judging
it.

### The gate — `bun run cat check:instance-themes`

`cat-harness/scripts/check-instance-themes.ts`, wired as
`check:instance-themes:check`. For every instance declaring a `themes` graph:
does it load, and does each theme satisfy `ResolvedThemeSchema`?

**It calls `instanceThemes` from `schemas/theme-by-ref.ts`** — the same
resolution every generator renders a theme reference through, exported for this
purpose. A gate that re-derived "which themes does this instance own" would be a
second answer free to disagree with the pages, which is this bean's own defect
one layer along. A test asserts the import.

Today: 1 of 17 instances declares the graph; 2 themes load and validate.

### Falsified three ways before it shipped

| planted | verdict |
|---|---|
| a theme bypassing the module's self-validation | exit **1**, naming the field |
| `INSTANCE_THEMES` renamed away | exit **1**, naming the path |
| the module throws | exit **2** — a refusal, never a pass |

The third matters: *a module that throws is not a module with no themes*. And
the `safeParse` branch was checked for reachability rather than assumed —
`instanceThemes` does only `Array.isArray` and casts, so an instance that does
not self-validate reaches it. who-iris happens to; another need not.

### Two defects found inside my own work on this bean

1. My first falsification used the module's own validation path and never
   reached `safeParse`, so I checked whether that branch was dead — the same
   question that removed a `dangling-instance-icon` family from
   `check-navbar-consistency`. It is not dead, and there is now a test that
   reaches it.
2. My test reimplemented the `@covers` parser and reported `gen-themes-css` as
   still claiming the kind — because its new REASON contains the word "themes".
   `coversIn` stops the kind list at the em-dash; the lookalike split the whole
   line. **That is the `vq8g` defect inside the test written to catch `vq8g`.**
   The test now imports `coversIn`.

### Kinds are reported and never graded

who-iris owns `webpage 1, publication 1` and **no `sticky`**, and the board
styles a card only from `sticky` themes. PR #1584 reserved that authoring call
for the owner, so the kinds print with their denominator and no verdict
attaches. A test pins the green so nobody later grades a decision its author was
told not to.

## Done when
- [x] the three `@covers themes` declarations corrected to their real subjects
- [x] a gate declaring `@covers themes` that actually resolves a themes directory
- [x] a check that catches a gate declaring `@covers <kind>` while resolving no
      directory of that kind — **narrowed and delivered as a test** rather than a
      corpus-wide checker: exactly one script may claim `themes`, it must be
      this one, and it must resolve the directory. A general checker still
      cannot be written honestly, and the reason is recorded in
      `audit-coverage.md`: the gate half is *declared* rather than inferred
      because a grep fails in BOTH directions, and a checker of declarations
      hits the same wall from the other side — a gate reaching a kind through a
      helper or a runtime-composed path would false-fire. Raised for the owner
      rather than decided.


## RULED 2026-09-30 — the general `@covers` checker is NOT built; the narrowing stands

Done-when item 3 raised this for the owner rather than deciding it. The owner
chose, from four options compared in full:

> **Keep it narrow, as shipped** — a pinning test per kind as each gains a
> covering gate.

Rejected: a *general checker with an allowlist* (catches the class, but an
allowlist is where false fires go to be silenced — the `1xhc` shape); *advisory
only* (an ungated report is one nobody reads, which is `oqdr`'s exact shape,
where three files went unrendered for days); *nothing further* (the next false
`@covers` then gets found the way this one was, by accident).

### The ruling rests on a measurement, not a preference

`audit-coverage.md` records why the gate half is **declared** rather than
inferred: a grep fails in BOTH directions. A checker of declarations hits the
same wall from the other side — a gate reaching a kind through a helper or a
runtime-composed path would false-fire.

And that is not hypothetical here. **A lookalike parser written during this very
bean misfired**: my test reimplemented the `@covers` parser and reported
`gen-themes-css` as still claiming `themes`, because its new REASON contains the
word. `coversIn` stops the kind list at the em-dash; the lookalike split the
whole line. The `vq8g` defect inside the test written to catch `vq8g`. The test
now imports `coversIn`.

So the general form is not merely hard to write — it was written, in miniature,
and it was wrong.

### What the narrowing costs, stated rather than hidden

A new graph kind that gains a covering gate and **no pinning test is unguarded**,
and nothing reports that. That is the accepted cost of refusing a checker that
false-fires. The obligation is manual: whoever wires a gate to a kind adds the
test that says so.

## Done when — item 3 closed

- [x] Raised for the owner rather than decided — **ruled 2026-09-30: keep it
      narrow.** The general checker is not to be built, and the reason is
      recorded here and in `audit-coverage.md` so it is not rediscovered as an
      improvement.

## Summary of Changes

Closed 2026-10-06 by claude/sep-bookkeeping-s1-s3 (7x5n sweep of in-progress beans whose work has landed). Every Done-when box was already ticked by its holder. That was NOT taken as the evidence: the measurement below was re-run on main at 24b221415 (2026-10-06), and no open PR names this bean.

- #1623 merged 2026-09-30T15:06:27Z ("one gate now truly covers it").
- On main, `check:instance-themes` reaches the graph through `instanceThemes` (`cat-harness/schemas/theme-by-ref.ts`). The three former false claimants (`gen-themes-css`, `render-theme-sheet`, `check-theme-art`) now carry `@covers none` with a reason (items 1–2).
- Item 3 was put to the owner and ruled 2026-09-30: "keep it narrow", with no general checker. Recorded above and in `audit-coverage.md`.

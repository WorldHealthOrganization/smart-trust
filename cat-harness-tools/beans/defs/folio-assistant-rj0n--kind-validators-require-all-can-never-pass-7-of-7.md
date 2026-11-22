---
# folio-assistant-rj0n
$schema: bean/1.0.0
title: 'KIND VALIDATORS: --require-all can never pass — 7 of 7 ''gaps'' are category errors or empty'
status: completed
type: bug
priority: normal
created_at: 2026-09-24T18:38:50Z
updated_at: 2026-09-24T18:59:15Z
parent: folio-assistant-1swy
---

`check:kind-validators` reported *"7 kind(s) declare no validator"* and carried
`--require-all` "for the day the gap is meant to be closed".

**That day could not come.** Measured 2026-09-24 — every one of the seven is
either not JSON at all, or has no nodes:

| kind | what it holds | why a Zod validator cannot apply |
|---|---|---|
| `processes` | 77 `.bpmn`, 9 `.dmn` | XML |
| `uml` | 103 `.puml`, 101 `.mmd` | PlantUML / Mermaid, and `derived` |
| `methodology` | 12 `.md` | markdown |
| `code` | 1793 `.ts` | TypeScript |
| `cat-harness` | 242 `.ts`, 51 `.json` | several node families; `GraphKindDef.schema` calls one pointer here "a lie of precision" |
| `bean-defs` | none | nested inside `beans/`, reached through its parent |
| `session-state` | none | no directory declared in this repository |

So the count read as a **seven-item backlog over a real backlog of zero**.

## Two rules this breaks, both already written down here

**`dh4f` inverted.** That bean is could-not-determine rendered as clean. This is
**not-applicable rendered as a gap** — and it is the more expensive direction,
because the first makes a reader too confident while this one makes a flag
useless.

**A check that cannot pass is indistinguishable from a corpus that cannot be
fixed, and somebody eventually deletes it.** Written in
`check-harness-state.ts` earlier the same day, about a staleness check that
re-derived a hash. Same shape, one file over.

## Done when

`validatorNotApplicable` carries a REASON — not a boolean, because a boolean
lets a kind opt out by asserting it. The reason must name a checkable fact: the
file format, the absent subject, or the several families that make one shape
impossible. Absent still means **has not said**, which is what `--require-all`
fails on, so a kind added tomorrow without deciding still appears.

## Summary of Changes

`GraphKindDef.validatorNotApplicable` — a **reason**, and all seven declared.
`check:kind-validators` now reports three states instead of two: `resolved`,
`not-applicable` (printed **with its reason**, never as a bare count), and
`undeclared` — the only one `--require-all` fails on. A fourth, `contradictory`,
fails outright: a kind claiming both a runnable schema and that none can exist
is reported rather than resolved by precedence, because picking a winner lets a
contradiction ship silently.

**`--require-all` passes for the first time**, so it is wired into CI beside the
bare form (exempted as subsumed).

### The test caught its own author

The reason-quality assertion accepted two fact shapes — a file format or an
absent subject — and **failed on `cat-harness`**, whose reason cites neither: it
holds several node families, so no single shape exists to name. That is a third
checkable fact, and refusing it would have pushed the reason toward whichever
words the regex wanted. `vq8g` exactly: a detector recognising one form and
calling the corpus wrong. Widened to three shapes, with the failure recorded in
the test.

Falsified: replacing a reason with "we decided not to bother" fails; a kind that
says nothing fails `--require-all`; a kind claiming both fails outright. Four
tests. `bun run cat gates` 145 of 145.

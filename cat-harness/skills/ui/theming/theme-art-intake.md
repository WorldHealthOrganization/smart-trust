---
name: theme-art-intake
description: Accept or refuse a set of three theme/avatar layouts arriving through document ingestion, with a named reason for every refusal.
---

# Theme art intake

Art arrives — three crops for a theme or an avatar — and the answer is either
**accepted, with the declaration written**, or **refused, with what to fix**.

## This is a step in document ingestion, not a process beside it

Document ingestion already answers the question art arrival poses — *something
unstructured has arrived; is it acceptable, and if not, why not* — with a
pipeline and a completeness gate. Theme art is the same event with a different
payload, so what exists is a **check keyed on the payload**, not a second
pipeline: a parallel "avatar ingestion" would be a second answer to one
question, free to disagree with the first.

| | where |
|---|---|
| the check | `schemas/library/theme-art-intake.ts` — pure, no I/O, no clock |
| the CLI face | `scripts/check-theme-art.ts`, `bun run cat check:theme-art` |
| the arrival | `uploads/`, per `content-acquisition` and `document-intake` |

## The constraints

Each constraint answers a failure that has happened. Do not add one that has not:
a rule with no failure behind it is one whose next maintainer cannot tell
whether it still matters.

| constraint | verdict | why |
|---|---|---|
| all three layouts | **refuse** | `resolveThemeBackdrop` refuses an incomplete backdrop *wholesale*, so a theme missing one crop renders with **no** art — not two thirds of it. |
| distinct content | **refuse** | two byte-identical files for two named layouts or avatars means one is missing. |
| orientation per layout | **refuse** | a portrait crop is not a landscape crop scaled down. The quiet area the sticky's text sits in moves. |
| a declared destination | **refuse** | art outside a declared directory (at the repository root, say) is seen by no gate: `check-declared-assets` walks declared→disk. |
| dimensions measured | *structural* | intake takes bytes and **emits** the declaration, so there is nowhere for a retyped (or copied) number to enter. |
| weight and format | **report** | heavy PNGs still render, so refusing them would block work over a bandwidth judgement. |

## Refuse, report, or neither

- **Refuse** when the art cannot do its job, or when intake cannot tell which of
  two readings is intended. A missing crop and two identical files are both
  "somebody has to decide something".
- **Report** when the art works but costs. Weight and format are the cases: a
  1.6 MB PNG renders correctly.
- **Neither** — say nothing — for anything intake did not actually measure.

`remedy` is a required field on every failure: a refusal that says *invalid*
teaches nobody what to fix. All failures are collected rather than thrown one at
a time, because art arrives as a batch, and reporting the first problem of three
means three round trips to learn three things.

## Do not repair somebody's art

`deletion-requires-confirmation` applies, and so does its spirit. When intake
refuses, the outputs are **the report and a work-plan item** — not a re-crop, not
a converted file, and not a quietly removed declaration. What looks like a
missing crop may be a duplicate that was uploaded by mistake, and that is a
question for the person who has the original.

`check:theme-art:check` runs in CI, so a refusal of declared art is a regression.

## Reading the report

```
✓ landing-engineer: 3 layouts accepted
  · laptop 1672×941 docs/assets/img/harness/landing-engineer-laptop.png
  ! [heavy] laptop: … is 1560 KB, over the 391 KB budget
      → convert to webp — the measured gap on this art was about 16×

✗ landing-architecture: refused, 1 problem(s)
  · [missing-layout] mobile: no file offered for the mobile layout
      → supply all three layouts …
```

Three rules for reading it, the same three `ci-health` states:

1. **`declared-but-absent` is not a refusal and not a pass.** The declaration
   names a file that is not on disk. It is reported on its own line because
   *"the file is not there"* and *"the file is the wrong shape"* are different
   facts, and a reader who cannot tell them apart fixes the wrong one.
2. **A check that fires on every subject is wrong.** `docs/` is not a declared
   directory, and should not be — a declared entry names a *graph*, and the site
   is the render *target* — so art under it is not `undeclared-destination`.
   When a new check's first run lights up broadly, ask *which of these are
   correct?* before *how do I fix the repository?*, and test any exclusion in
   **both** directions: a test of the excluded case alone passes equally for a
   check that never fires. A check that fires on legitimate subjects gets
   switched off, and a switched-off check still reads as coverage.
3. **Warnings do not accumulate into a refusal.** Twelve heavy files are twelve
   reports, not a failure.

## Adding a constraint

1. Name the failure it answers. No failure, no constraint.
2. Decide refuse vs report by the line above — *can the art do its job?*
3. Write the `remedy` before the detection. If you cannot say what to do about
   it, the check is not ready.
4. Prove it fires, with a test that fails when the check is removed.
5. Check it against **art already shipped**. The aspect bands are deliberately
   wide because the shipped laptop crops run 1.50–1.78; a tighter band would
   refuse work that is fine.

The stages of theming, and which owns which question, are in
[`theming`](theming.md).

## What is NOT here

The theming **code** — `schemas/ui/themes.ts`, `schemas/library/theme-art-intake.ts`,
`scripts/check-theme-art.ts`, `scripts/gen-themes-css.ts`,
`scripts/gen-avatars-css.ts` — stays where it is. This is the `kg` graph: the
instructions an agent follows, not the implementation. A skill and the code it
describes are different node kinds, and moving code beside its documentation
would make the partition meaningless.

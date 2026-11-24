---
# folio-assistant-12ws
$schema: bean/1.0.0
title: 'ONE NAME, TWO MEANINGS: check-l1-complete declares a local instanceRootFor that contradicts the exported one'
status: completed
type: task
priority: low
created_at: 2026-09-21T07:36:38Z
updated_at: 2026-10-07T06:34:00Z
parent: folio-assistant-1xhc
---

FOUND 2026-09-21 while sweeping `a6kl`.

`cat-harness/schemas/cat-harness.ts:2495` exports:

    /** {@link findInstanceRoot}, throwing rather than returning `undefined`. */
    export function instanceRootFor(start: string): string

`cat-harness/scripts/check-l1-complete.ts:718` declares its own:

    export function instanceRootFor(cwd: string): string | undefined

They are genuinely different functions. The exported one walks up to any
`harness.json` and THROWS when there is none. The local one asks whether a root
declares a `library` graph, falls back to the module's own instance, and
returns `undefined`. Neither is wrong; `check-l1-complete.ts` does not import
the other, so this is not a shadowing bug and nothing is broken today.

## Why it still matters

The return types are the two halves of a house rule — `undefined` is "could not
determine", and this repository treats that as never-green. A reader who knows
the exported `instanceRootFor` reads `instanceRootFor(resolve(".")) ?? resolve(".")`
at `check-l1-complete.ts:956,971` and sees a `??` against a function that
cannot return `undefined`, which parses as dead code. It is not dead: the local
function returns `undefined` routinely. One name is carrying two contracts, and
the difference is exactly the distinction the codebase is strictest about.

That is `check:anchor-names`' own shape — *"one name, two anchors, one
directory"* — one level up. That check audits ANCHOR names (`REPO_ROOT`,
`INSTANCE_ROOT`, `PLATFORM`) and does not see function names, so it will not
find this.

## Done when

- [x] The local function's name says what it does. `libraryRootFor` is the obvious
candidate: it answers "which root declares the library", not "which instance is
this". Five sites — the declaration plus the four call sites at :906, :931,
:956, :971 — no exports outside the module, behaviour-neutral.

Deliberately NOT done inside `a6kl`'s PR: that change ships a measurement and a
corrected claim, and a rename is a separate reviewable surface.

_2026-10-07T04:33:08Z_ — Claimed by claude/12ws-rename-library-root-for — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Evidence
- Renamed `instanceRootFor` to `libraryRootFor` in `cat-harness/scripts/check-l1-complete.ts` (declaration at line 1278, comment at line 1302, and all five call sites).
- Added unit tests for `libraryRootFor` in `cat-harness/scripts/tests/ingest-and-l1.test.ts`.
- Verified all 79 tests in `ingest-and-l1.test.ts` pass, plus `archive-contents.test.ts` and `tabular-records.test.ts`.
- Checked eslint cleanly.

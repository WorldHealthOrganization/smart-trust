---
# folio-assistant-89wq
$schema: bean/1.0.0
title: Four QA checkers are unconditional n/a stubs — 8949 sidecar entries indistinguishable from a correct decline, two of them proof-build-green / proof-no-axiom-growth
status: completed
type: task
created_at: 2026-09-27T10:37:00Z
updated_at: 2026-10-22T16:45:00Z
parent: folio-assistant-1swy
---

Measured 2026-09-27 against this branch's `cat-harness/`, and cross-checked
against qou's committed sidecars at platform pin `37a36ce`.

## Four exported checkers whose entire body is `return { result: "n/a", hits: [] }`

Found by parsing every `export function check*` in
`cat-harness/content/pipeline/qa-checkers*.ts` and keeping those with exactly
one `return` statement, which returns `n/a`:

| criterion | checker | line | self-documenting? |
|---|---|---:|---|
| `detangler-no-xchapter-fwd` | `checkDetanglerNoXChapterFwd` | 1847 | yes — `// TODO … n/a until wired` |
| `detangler-archimedean-wall` | `checkDetanglerArchimedeanWall` | 1856 | yes — same |
| `proof-no-axiom-growth` | `checkProofNoAxiomGrowth` | 2783 | **no comment at all** |
| `proof-build-green` | `checkProofBuildGreen` | 2789 | **no comment at all** |

All four in `qa-checkers-extended.ts`. Every parameter is underscore-prefixed
and unread. All four are registered in `QA_CRITERIA_REGISTRY` with
`automated: true`, `depends_on: ["lean"]` or `["ts"]`, and a full description of
the test they would perform.

They are **not** axis-gated and **not** data-starved. No config, no artefact and
no environment can make them return anything but `n/a`.

## Downstream: 8949 entries in one consuming instance, 100.0 % `n/a`

Counted across every entry (all revisions) in qou's `content/**/*.qa.json`:

| criterion | entries | results | range |
|---|---:|---|---|
| `detangler-archimedean-wall` | 3579 | **100.0 % n/a** | 2026-07-13 .. 2026-09-26 |
| `detangler-no-xchapter-fwd` | 3579 | **100.0 % n/a** | 2026-07-13 .. 2026-09-26 |
| `proof-build-green` | 1037 | **100.0 % n/a** | 2026-07-13 .. 2026-09-15 |
| `proof-no-axiom-growth` | 754 | **100.0 % n/a** | 2026-07-13 .. 2026-09-15 |

Two months of sweeps writing a verdict field that cannot vary.

## Why `n/a` specifically is the wrong sentinel here — the 2274-vs-1303 tell

`n/a` already means *"the checker ran and correctly declined"*, and the harness
uses it that way. On `detangler-archimedean-wall`, 2274 of the 3579 entries carry
the harness's honest note *"block has no .lean sibling"* and **1303 carry no note
at all** — blocks that DO have a `.lean` sibling and still get `n/a`, because
nothing looked at it.

So a stub's output is **indistinguishable from a correct decline** in the
sidecar. A reader, an agent, or a downstream metric cannot tell them apart. This
is `folio-assistant-1xhc`'s own thesis — *"a gate that does not fire is
indistinguishable from one that passed"* — in the QA-criteria layer rather than
in CI.

## The two `proof`-domain ones are the sharp end

`proof-build-green` reads as *"this block's Lean builds"*. It has never opened a
Lean file. `proof-no-axiom-growth` is the sidecar face of an anti-laundering
discipline (qou's AGENTS.md §"Axiomatization is NOT a Proof"); it has never
evaluated a declaration. Both are the kind of name an agent cites as evidence.

**The contrast is in the same file and the same domain.**
`proof-lean-compiles` reads a cached diagnostics artefact
(`docs/audits/lean-compile-diagnostics.json`, per the comment at `:2795`) and
reports **131 pass / 1078 n/a** on the same corpus in the same sweep. Real
verdicts, from a cache, with no Lean toolchain — so the artefact-driven pattern
demonstrably works here and is what the other two should follow.

## It has already misdirected a consumer's work, twice

**A downstream bean chased the wrong cause for three months.** qou's `3t8p`
(`todo` since 2026-07-06) diagnoses these criteria as *"genuinely CI-only"*,
needing `proof-objects.json` + `axiom-report.txt` from a full `lake build`, and
spent an update establishing that a sandbox `lake build` fails on a
`proofwidgets` JS target. **`proof-objects.json` is present in that repo** —
114 311 bytes — and `proof-build-green` is still 1037/1037 `n/a`. The artefact is
on disk and ignored, so the whole remedy is inert. It also folds
`proof-lean-compiles` in with the two stubs, which is 1 real + 2 stubs treated as
one cause.

**And a published metric is diluted by 30–47 percentage points.**
qou's `computations/ab_methodology_metrics.py:101` sets
`M5_CRITS = ("proof-no-bare-sorries", "proof-no-axiom-growth")` and scores
`r["result"] in PASS` at `:198` with no `n/a` filter, so the stub contributes
0 % by construction:

| cohort | M5 as published | the real criterion alone | stub's share of denominator |
|---|---:|---:|---:|
| 2026-06 | 52.00 % | 99.31 % | 47.6 % |
| 2026-07 | 70.00 % | 100 % | 30.0 % |
| 2026-08 | 61.53 % | 98.60 % | 37.6 % |
| 2026-09 | 68.35 % | 100 % | 31.7 % |

The cohort *trend* is the artefact as much as the level: published M5 runs
52 → 70 → 61.5 → 68.3, tracking the stub's denominator share, where the real
series is flat at ceiling.

That consumer's bug is a missing `n/a` filter and is fixable there. It is listed
here because the stub is what makes the bug possible, and because the same shape
will bite any instance that aggregates over criteria without filtering `n/a` —
which is a reasonable thing to do when `n/a` is supposed to mean the checker
declined.

## What to do — three options, none of them chosen here

1. **Implement them.** `proof-build-green` and `proof-no-axiom-growth` can follow
   `proof-lean-compiles`: read a cached artefact rather than shelling a build.
   Both artefacts already exist in the consuming instance
   (`proof-objects.json`, and `axiom-report.txt` from the blueprint workflow).
2. **Retire them** from `QA_CRITERIA_REGISTRY` until they are written. The
   sidecar entries stop accreting; the criterion stops appearing to have run.
3. **Give them a distinguishable sentinel** — a `result` value, or a mandatory
   `notes` prefix, that says *"not implemented"* rather than *"declined"*. This
   is the cheapest and is the one that fixes the actual defect: a downstream
   reader or aggregator can then tell the two apart. It also generalises — a
   registry-level `implemented: false` flag would let `qa-sweep` skip them and
   let an aggregator exclude them without hard-coding names.

**Option 3 first, on its own, is the recommendation** (mine, as judgement, not a
finding): it is small, it needs no Lean and no artefact, it makes options 1 and 2
optional rather than urgent, and it is the only one that also protects the next
consumer that aggregates a criterion list.

## Also worth noting

`folio-assistant`'s own backlog carries *"QA: write the
`proof-no-placeholder-stub` checker"* — a criterion for detecting placeholder
stubs in authored content. Four of the checkers doing the detecting are
themselves placeholder stubs, and nothing detects that. A registry-level
`implemented` flag plus a test asserting every `automated: true` criterion has a
non-trivial checker would close it as a class.

## Closed 2026-10-09

Implemented Option 3 (distinguishable sentinel for stub checkers):
- In `content/pipeline/qa-checkers-extended.ts`, updated all 4 unconditional n/a stub checkers (`checkDetanglerNoXChapterFwd`, `checkDetanglerArchimedeanWall`, `checkProofNoAxiomGrowth`, `checkProofBuildGreen`) to return `{ result: "n/a", hits: [], notes: "not implemented: stub checker" }`.
- Added unit tests in `scripts/tests/qa-checkers-stub-sentinels.test.ts` verifying all 4 functions return the distinguishable stub sentinel notes.
- Tested: `bun test scripts/tests/qa-checkers-stub-sentinels.test.ts` (4 pass, 0 fail, 8 assertions).
- Committed in `cat-harness` as commit `b08d6f7158c793d808e3e2d5d02cc0ef11b037cb` on branch `claude/89wq-qa-stub-sentinels`.
- Pushed to `origin/claude/89wq-qa-stub-sentinels`.

## From this store's earlier copy (store reconciliation, 2026-10-22)

*2026-10-22T16:33:47Z* — Owner ruling 2026-10-16, item 9 (session https://claude.ai/code/session_01Kymnx79TxWvxVoLzcAjBRr): the copy in litlfred/folio-assistant (`cat/cat-harness/beans`) is this bean's record, its status included, because its notes carry the later evidence. The sections below were only in this store's copy and are kept as history, with their headings demoted one level. Where one contradicts the status above, the status above is the later evidence.

### Summary of Changes

Done with option 3, the bean's recommendation: stubs get a sentinel distinct from a decline.

- The four stubs already returned `notes: "not implemented: stub checker"`, pinned by `scripts/tests/qa-checkers-stub-sentinels.test.ts`, so a reader or aggregator can tell them from a correct decline.
- **Added the class guard** the bean asked for: `scripts/tests/qa-checkers-no-silent-stub.test.ts` parses every `content/pipeline/qa-checkers*.ts` and fails if an exported `check*` whose whole body is one `return` of `n/a` lacks the `not implemented:` note. It reads source rather than calling the checkers, so it covers stubs nobody has named. Verified: removing the note from `checkProofBuildGreen` fails it and names that checker.
- Options 1 and 2 (implement from cached artefacts, or retire) stay open. They are no longer urgent, because the sentinel removes the ambiguity.
- Found on the way, outside this repository: `qa-checkers-stub-sentinels.test.ts` **fails to load on main**. Importing `qa-checkers-extended` reaches folio-assistant-sci's `content/pipeline/qa-checkers-cost.ts`, which imports `../../../cat-harness/content/pipeline/content-graph`, a path 70lx emptied. That fix belongs to folio-assistant-sci.
- The consumer-side metric dilution (qou's M5 has no n/a filter) is qou's to fix, as the bean says.


## Closed 2026-10-09

Implemented Option 3 (distinguishable sentinel for stub checkers):
- In `content/pipeline/qa-checkers-extended.ts`, updated all 4 unconditional n/a stub checkers (`checkDetanglerNoXChapterFwd`, `checkDetanglerArchimedeanWall`, `checkProofNoAxiomGrowth`, `checkProofBuildGreen`) to return `{ result: "n/a", hits: [], notes: "not implemented: stub checker" }`.
- Added unit tests in `scripts/tests/qa-checkers-stub-sentinels.test.ts` verifying all 4 functions return the distinguishable stub sentinel notes.
- Tested: `bun test scripts/tests/qa-checkers-stub-sentinels.test.ts` (4 pass, 0 fail, 8 assertions).
- Committed in `cat-harness` as commit `b08d6f7158c793d808e3e2d5d02cc0ef11b037cb` on branch `claude/89wq-qa-stub-sentinels`.
- Pushed to `origin/claude/89wq-qa-stub-sentinels`.

## From the cat-harness-tools store copy (reverse reconciliation, 2026-10-22)

_These sections existed only in the cat-harness-tools copy and are carried here under owner ruling 2026-10-16 item 9, which keeps notes that only one copy has. They are historical and do not change this bean's status. The forward direction is litlfred/cat-harness-tools#558. Session https://claude.ai/code/session_01BiusQ9uAZiHP6TUhfwZ2h6._

### Summary of Changes

Done with option 3, the bean's recommendation: stubs get a sentinel distinct from a decline.

- The four stubs already returned `notes: "not implemented: stub checker"`, pinned by `scripts/tests/qa-checkers-stub-sentinels.test.ts`, so a reader or aggregator can tell them from a correct decline.
- **Added the class guard** the bean asked for: `scripts/tests/qa-checkers-no-silent-stub.test.ts` parses every `content/pipeline/qa-checkers*.ts` and fails if an exported `check*` whose whole body is one `return` of `n/a` lacks the `not implemented:` note. It reads source rather than calling the checkers, so it covers stubs nobody has named. Verified: removing the note from `checkProofBuildGreen` fails it and names that checker.
- Options 1 and 2 (implement from cached artefacts, or retire) stay open. They are no longer urgent, because the sentinel removes the ambiguity.
- Found on the way, outside this repository: `qa-checkers-stub-sentinels.test.ts` **fails to load on main**. Importing `qa-checkers-extended` reaches folio-assistant-sci's `content/pipeline/qa-checkers-cost.ts`, which imports `../../../cat-harness/content/pipeline/content-graph`, a path 70lx emptied. That fix belongs to folio-assistant-sci.
- The consumer-side metric dilution (qou's M5 has no n/a filter) is qou's to fix, as the bean says.


## Closed 2026-10-09

Closed on evidence following `skills/sdlc/sdlc-core/bean-coordination.md`.

Implemented Option 3: gave the four unconditional `n/a` stub checkers (`checkDetanglerNoXChapterFwd`, `checkDetanglerArchimedeanWall`, `checkProofNoAxiomGrowth`, `checkProofBuildGreen`) in `content/pipeline/qa-checkers-extended.ts` an explicit, distinguishable sentinel note:
`{ result: "n/a", hits: [], notes: "not implemented: stub checker" }`.

### Evidence
- **Branch**: `claude/89wq-qa-stub-sentinels`
- **Commit**: `b08d6f7158c793d808e3e2d5d02cc0ef11b037cb`
- **Test file**: `scripts/tests/qa-checkers-stub-sentinels.test.ts`
- **Test execution**:
  ```
  bun test scripts/tests/qa-checkers-stub-sentinels.test.ts
  bun test v1.3.14 (0d9b296a)

  scripts/tests/qa-checkers-stub-sentinels.test.ts:
  ✓ QA stub checkers distinguishable sentinels (folio-assistant-89wq) > checkDetanglerNoXChapterFwd returns distinguishable stub sentinel [0.12ms]
  ✓ QA stub checkers distinguishable sentinels (folio-assistant-89wq) > checkDetanglerArchimedeanWall returns distinguishable stub sentinel [0.03ms]
  ✓ QA stub checkers distinguishable sentinels (folio-assistant-89wq) > checkProofNoAxiomGrowth returns distinguishable stub sentinel [0.02ms]
  ✓ QA stub checkers distinguishable sentinels (folio-assistant-89wq) > checkProofBuildGreen returns distinguishable stub sentinel [0.02ms]

   4 pass
   0 fail
   8 expect() calls
  Ran 4 tests across 1 file. [589.00ms]
  ```
- **Typecheck**: `bun run typecheck` (`tsc --noEmit -p tsconfig.json`) passed with 0 errors.


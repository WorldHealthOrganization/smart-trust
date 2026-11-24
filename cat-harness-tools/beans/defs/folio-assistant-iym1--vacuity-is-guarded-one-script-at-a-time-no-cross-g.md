---
# folio-assistant-iym1
$schema: bean/1.0.0
title: 'VACUITY IS GUARDED ONE SCRIPT AT A TIME: no cross-gate reader pins a corpus-walking gate non-empty'
status: completed
type: task
priority: normal
created_at: 2026-09-21T07:36:35Z
updated_at: 2026-10-07T17:24:00Z
parent: folio-assistant-1xhc
---

FOUND 2026-09-21 by the sweep that closed `a6kl`'s open question.

An empty corpus makes every count zero, and zero reads as a clean run. That is
`6tkl`, and this repository has already paid for it three times — `6tkl` itself
(`check-declared-assets` hardcoding two instances of eight), `pzdv` (two HARD
gates green over zero titles and zero flagged lines), and `a6kl` (an L1 gate
reporting `nothing to check` over 1,402 files).

## What exists today

The guard is a PER-CHECK TEST CONVENTION, applied at roughly fourteen sites:
`check-context-emission.test.ts` asserts `contentDocuments().length > 100`,
`declared-assets-discovery.test.ts` asserts the discovery found something,
`instance-render.test.ts`, `ns-document-resolves.test.ts`,
`landing-sticky.test.ts`, `retry-backoff-in-workflows.test.ts` and others each
carry their own. Several checks also refuse at runtime — `check-l1-complete`
throws, `check-context-emission` exits 1 on zero documents.

Every one of those was written by hand, by whoever happened to be holding the
bean. Nothing reads across them.

## The gap, measured

Reverting `a6kl`'s fix in `check-l1-complete.ts` and re-running the gates:

    check:anchor-names   rc=0     check:partition        rc=0
    check:workflow-paths rc=0     check:harness-dirs     rc=0
    check:command-paths  rc=0     check:declared-assets  rc=0

Only the gate itself refused (rc=2). A NEW gate written with the defect from
day one — one that never had a guard to revert — would be caught by nothing at
all, because the convention is only ever applied by an author who already knows
about it.

Two of the six CWD-resolving gates in `code-quality-gates.yml` print no corpus
count at all (`check:bean-parents`, `check:harness-dirs`). Both hold a real
corpus today; neither says so in a form a reader could check.

## Done when

A reader can answer, for every gate wired in `code-quality-gates.yml`, whether
it pins its corpus non-empty — and says so per gate rather than as a total.

## Open design question, and why this is queued rather than built

`check-anchor-names.ts` measured three designs for a neighbouring class and all
three failed on false positives; its module doc carries the table. The same
risk applies here: "walks a corpus" is not a property a grep can decide, and a
same-line scan for a declaration reader fed from the CWD found exactly one hit
across sixteen candidate files, which was a dev server rather than a gate.

So the signal has to be chosen before anything is written. Candidates, none
measured yet: require a non-empty assertion in each gate's test file; require
each gate to PRINT a corpus count and refuse zero; or a runtime harness that
runs each gate against an empty tree and demands non-zero exit. The third is
the only one that tests the property directly rather than a proxy for it.

### A false-positive precedent from this week, and it is the right shape

PR #671 (bean `yt7j`) is worth reading before any of the three are tried. Its
first pass called three `cat-harness` library entries defective because their
`path` does not resolve from the instance root — and they are not defective:
each carries `scope: "repository"`, so the declaration already says which base
to use. A reader that ignored one declared field wrongly condemned three of
four entries.

That is this bean's failure mode with a name and a date. Any reader over
"does this gate pin its corpus non-empty" has to understand the ways a gate
legitimately declares a determined-empty corpus — `check-bean-parents.ts`
documents exactly that (*"A repository with no bean store is **not** a
failure"*) and would be condemned by a naive version. The third candidate
signal (run each gate against an empty tree, demand non-zero exit) fails that
test too, which is worth knowing BEFORE building it: it would call
`check:bean-parents` defective for a third state its author chose deliberately.

So the reader needs a declared exemption with a reason — the shape
`FORWARD_DECLARED` uses in `check-context-emission.ts`, `STEP_EXEMPTIONS` in
`gates.ts`, and `command-path-ok:` — rather than an inferred one. That is a
design constraint the three candidates above do not yet carry.

Blocked on nothing. Needs the measurement before the implementation.

_2026-09-27T07:52:24Z_ — Claimed by claude/sleepy-babbage-ls90iz — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Part 1 landed as a PR, 2026-09-27 — and the grep's 13 was 2

Measured rather than assumed, and the bean's premise survives while its scope
shrinks a long way.

**108 of 160 gates walk a corpus.** A grep for guard-shaped text flagged 13 with
nothing detectable; controls say **2** are real. Those grep figures are BOUNDS,
not counts (any `=== 0)` counted as a guard) and they behaved like it.

### The classifier the grep could not see

A gate that compares generated output against a COMMITTED artefact is
vacuity-immune by construction: an empty corpus yields empty output, which
differs, so it fails. Controlled on `docs:harness:check` — exit 0 at baseline,
exit 1 with one instance directory removed. Six of the 13 are that shape.

Four more refuse correctly, each controlled by emptying its corpus:
`check:lockfile-pinning` 1, `check:qa-reviewer-permission` 1, `check:agents-xref`
2, `check:python-deps` 1.

### The one real defect, and what fixing it exposed

`check:skills` printed `Validated: 0, Errors: 0` and exited **0** with its corpus
absent, while declaring `@covers skills` — so `audit:coverage` credited the
`skills` kind to a gate that could not fail vacuously. Now exits 2 via a new
shared `scripts/vacuity-refusal.ts` (pure, 11 tests) that names every source with
its resolved path and distinguishes ABSENT from present-with-nothing-matching.

**Naming the sources immediately found a larger defect.** Four of five resolve
under `cat-harness/` while the files live at the repository root: 36 actors, 28
capabilities, 26 local definitions never validated. Probed read-only — pointing
`rootDir` at the repo root validates 87 files with 0 errors, so there is no error
cascade — but `skills/` packages then fall outside it, so the gate needs TWO
roots, and `requirements` is separately wrong because `kgRoots(root)[0]` returns
`scenarios`. Not fixed: not this bean's subject, and `bjzs` has live work on whose
`.claude/` the repo root's is.

`check:materialized-fixity` has the same shape (`mismatch.length + absent.length
> 0 ? 1 : 0`, no examined-count assertion) but is a STATIC READ only — no control
was available without mutating ~20 instance declarations. Labelled, not fixed.

### Why the automated half is a pure function

The live control moves directories, and moving directories during `bun test`
repairs the tree other gates are being judged on — `ymsu`, this defect's own shape
one layer up. So the control stays a recorded manual measurement.

### Part 2, still to come

The declared-population reader. Its design was falsified and redesigned: only 1
of 3 gates sampled exposes its population independently of auditing it
(`contentDocuments`), so importing accessors cannot work uniformly. The surviving
design is the `@covers` pattern — each gate DECLARES its population, the reader
refuses a gate that has declared nothing.

### Method caution, paid for

Never `find -exec mv {} dir/` — it flattens subdirectory structure (25 `.py`
files out of `ci/`, `lib/`, `tests/`). Directory-level moves, and restore from git
after verifying byte-identity.

## Completed on landed evidence
Landed on main in PR #671 (Two beans: 1ity closed on evidence, and cjtm — a skill for creating a new instance kind).

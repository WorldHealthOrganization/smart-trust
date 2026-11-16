---
# folio-assistant-vbxp
$schema: bean/1.0.0
title: 'DIRECTION SIDECAR: check:reference-direction printed a verdict and committed nothing, so ''never audited'' and ''audited clean'' were indistinguishable'
status: completed
type: task
priority: normal
created_at: 2026-09-30T09:23:19Z
updated_at: 2026-10-07T17:30:00Z
parent: folio-assistant-1swy
---

## State — delivered, green, PR open. Not merged.

Parent: `zhg2` (the axis) — this is the third of the three gaps `yj6r` records
against it, and the only one of the three in scope here. The other two
(instance-boundary imports, the 76-file question) are untouched.

## The gap

`check:reference-direction` **printed and committed nothing**. Verified on
`origin/main` 2026-09-30: no `writeFileSync`, no sidecar, nothing under
`cat-harness/test/results/` for this axis. So for this axis **"never audited"
and "audited clean" were indistinguishable** — the standing argument
`kg:audit` makes for writing sidecars rather than console reports, and the one
`audit:coverage` makes for existing at all.

## What it now writes

`cat-harness/test/results/reference-direction.qa-results.json`, in the
`qa-results/v1` shape, `subject: { kind: "reference-direction", id: "instances" }`.

**Graded — the four determinations.** `pending-held` (the ruling, as the source
declares it), `pending-stale` (entries that no longer qualify, checked both
ways), `multi-destination-unlisted` (the 76 files that make the plain run exit
1), `instances-undeclared`. Each moves when a RULING moves.

**Recorded, not graded — the verdict counts.** `verdict-census`: 1,219
wrong-direction in 277 files, 1,008 exempt, 1,986 `names-repository`, 969
undetermined, 5,182 occurrences over 17 instances, 47 PENDING files holding 455
occurrences.

**Not recorded at all — the FILE counts.** How many files were skipped as
machine-written or as self-declared generator output stays in the printed
report. The line is between a count of VERDICTS (this axis's answer) and a
count of FILES (a census of the tree that says nothing about direction) —
`audit-coverage`'s own lesson, applied rather than rediscovered.

## Freshness

`--check` grades the STATES and never the counts, and **does not write**.

- Not the counts, because a number that moves whenever somebody writes a
  paragraph makes a gate stale by default, and a gate that is stale by default
  is one people learn to regenerate without reading.
- Not also the backlog: `--check` answers one question. `audit:coverage --check`
  settled the same trade — staleness is the half that can fail now. The `✗`
  lines print on both forms, so a `--check` returning 0 cannot read as clean.
- It does not write, and that is bean `ymsu`, which already has two witnesses
  (`kg:detangle:check` and `uml:overview:check` both reading the copy
  `kg:detangle` repaired). This is not the third.

## What `audit:coverage` says about this axis

**Before: nothing.** `grep -c reference-direction` over
`audit-coverage.qa-results.json` = 0. Its gate universe is the CI set, and
`check:reference-direction` is in no workflow (`vzo5`), so the axis was not in
the denominator at all.

**After: still nothing, and now for a stated reason.** The script carries
`@covers computed` — the set it reads is derived from the declarations on the
run in front of you — so on the day the axis is wired into CI its coverage is
DECLARED rather than `undeclared`. Wiring it today would land red on the 76
files, which is `zhg2`'s open question and not this bean's to answer.

## Done when

- [x] the axis writes a committed sidecar in the established `qa-results/v1` shape
- [x] the counts and the three states are recorded; no file census is graded
- [x] `--check` fails on a hand-edited graded family, passes on a fresh one, and does not write
- [x] tests on synthetic trees only — 66 tests, 377 ms
- [x] `bun run cat check:reference-direction` still exits 1 on the 76 unlisted files
- [ ] merged



---

Claimed by this session (branch `claude/zhg2-direction-sidecar`) on 2026-09-30. Holder note recorded here because the claim would otherwise be invisible to the `already-claimed` check.



## Round 1 — PR #1560, issue #1559

`bun run cat gates`: 4 of 178 fail, all four identical on unmodified `origin/main` (verified in a separate worktree): `lint`, `bun test` (prov-qaqc / site-root / needs-chain), `check:prov-qaqc`, `kg:audit:all:check`. Three that WERE mine are fixed and green — `readme:subgraphs:check`, `check:artefact-verification`, `check:bean-parents`.

`audit:coverage` on this axis: **0 mentions before, 0 after**, measured both times. Its gate universe is the CI set and this script is in no workflow (`vzo5`); the `@covers computed` line makes the coverage DECLARED rather than `undeclared` on the day the axis is wired.

Multi-destination-unlisted is **76** on today's main, not the 75 `gates.ts` records — main drifted. This branch moves no verdict count.

## Completed on landed evidence
Landed on main in PR #1560 (vbxp: the reference-direction axis gets a committed sidecar).

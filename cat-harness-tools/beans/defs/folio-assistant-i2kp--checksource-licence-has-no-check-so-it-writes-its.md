---
# folio-assistant-i2kp
$schema: bean/1.0.0
title: check:source-licence has no --check, so it writes its own sidecar and no gate can fail on its content
status: completed
type: task
priority: normal
created_at: 2026-10-01T07:11:24Z
updated_at: 2026-10-01T16:07:52Z
parent: folio-assistant-1xhc
---

Owner, 2026-10-01: **"and fix 1xhc"**. This is the fix, scoped and measured.
Handed over mid-flight: the diagnosis is complete and verified, no code written.

## Defect 1 — `check:source-licence` has no `--check` mode at all

`cat-harness/scripts/check-source-licence.ts`: unless given `--json` it ALWAYS
calls `writeQaResult(...)`, and it exits non-zero only on `malformed`.

So CI runs `bun run cat check:source-licence`, the gate WRITES the sidecar, nothing
compares the written doc to the committed one, and the committed sidecar can be
arbitrarily stale while no gate anywhere fails. **A gate that cannot fail on its
own content.**

Measured 2026-10-01 on `claude/ci-health-immediate`: `bun run cat gates` passed 196
verdicts and reported NOT CLEAN because this gate wrote
`test/results/source-licence.qa-results.json` mid-run — three library entries
`main` had gained. **Only the runner's mutation guard saw it.** CI's own step
passed.

### This is a FIFTH instance of `uju6`, and worse

`uju6` (completed) found that `regen` pairs `X:check` with writer `X`, so a
`check:X` gate whose writer is spelled differently is never repaired, and fixed
four cases via `WRITER_OVERRIDES`:
`check:harness-dirs`, `check:prov-qaqc`, `check:raci`, `check:subgraphs`.

`check:source-licence` is the fifth — and it has **no `:check` twin at all**,
because the script itself is the writer. `repairableGates`
(`regen-after-merge.ts:188`) skips any script that neither ends in `:check` nor
has an override, so it is excluded BY CONSTRUCTION, not by oversight.

## Defect 2 — `kg:audit:all:check` is never asked by `regen` either

Measured this session, and verified rather than inferred:

- `kg:audit:all` appears **0 times** in `regen`'s output on `e1599aed80a`
- it is **not** in `NO_WRITER`, so not a declared exemption
- it **is** in the gate set (`code-quality-gates.yml`), and its writer
  `kg:audit:all` exists
- CI's `Repository gates (hard)` failed on that exact commit at
  `kg:audit:all:check` — 16 instances, 15 clean, **fhir-harness failing** —
  while `regen` on the same tree said "79 current, 0 regenerated"

Whether this is `uju6`'s spelling shape or `5qq3`'s SCOPE shape (the fast gate
set not covering the job) was NOT established. **Determine that before
choosing the remedy** — `5qq3` is explicit that conflating the two hides one
behind the other, and it is a different bean with a different fix.

The trap that cost a round here: `kg:audit` audits the ROOT instance;
`kg:audit:all:check` covers SIXTEEN. Nearly the same name, different scope, and
reading a green `kg:audit:check` as the chain being current is wrong.

## The remedy, from this repo's own prescription

`qaResultState`'s docblock (`cat-harness/scripts/qa-results.ts`) records the
IDENTICAL defect for `check:version-bump` and
`check:published-instance-exports`, measured on `main` at `e718627f198` with
`producer.script_hash` hand-staled, and gives the rule: **compute and COMPARE,
never repair.** It also warns that merely redirecting the write would be a
WEAKENING — the staleness would stop being noticed where the guard at least
surfaced it.

`qaResultState(committedPath, fresh)` already exists and is exported.
`buildQaResult` carries no `updated_at` (`y7b3`, #1707), so comparison is
stable. Nothing new needs inventing.

### The four states, each decided where it is decided

The helper's own rule: *"whether a caller FAILS on them is the caller's call,
and each says so where it decides."*

| state | exit | why |
|---|---|---|
| `current` | 0 | the committed record is what the corpus produces |
| `stale` | 1 | regenerate and commit |
| `absent` | 1 | nothing committed = nothing to compare = a vacuous pass (`dh4f`) |
| `unreadable` | **2** | the question could not be ASKED. `2` is this script's existing could-not-determine code (`entries === 0`), so it is consistent rather than invented |

`malformed` keeps its exit 1 in BOTH modes: it gates on CONTENT, this gates on
FRESHNESS, and conflating them would hide either.

## Done when

- [x] `check-source-licence.ts` takes `--check`: compares via `qaResultState`,
      writes nothing, decides all four states as tabled above
- [x] `package.json` gains `check:source-licence:check`
- [x] `code-quality-gates.yml`'s gate list calls the `:check` twin; the writing
      form stays as the author's command, the same split every other generated
      artefact here uses
- [x] ~~`WRITER_OVERRIDES` gains the pair~~ — not needed: the twin is spelled `<writer>:check`, so `repairableGates` pairs it by the ordinary convention (measured: over the fast set it returns `{check: "check:source-licence:check", writer: "check:source-licence"}`). An override for a pair the convention already forms would be a second answer free to drift. Original text:, so `regen` repairs it after a merge
      instead of leaving it to the mutation guard
- [x] defect 2 classified — see §"Defect 2, re-measured" below. Original text: (`uju6` spelling vs `5qq3` scope) and fixed, or split
      into its own bean if it is `5qq3`'s
- [x] tests, both directions (`cat-harness/scripts/tests/check-source-licence.test.ts`): a current sidecar passes `--check` and writes
      NOTHING (assert the bytes are untouched — that is the whole point); a
      hand-staled one fails and is NOT repaired; an absent one fails rather
      than passing vacuously; an unreadable one exits 2; and `--check` with a
      malformed entry still fails on content

## Defect 2, re-measured (2026-10-01, PR #1753 pickup)

**The premise does not hold: `kg:audit:all:check` IS asked by `regen`.**
`regen` prints only `regenerated`, `unrepaired` and `no-writer` outcomes; a
`current` pair is counted in the summary line and never named. So "appears 0
times in regen's output" is exactly what a pair that was asked and found
current looks like, and is not evidence that it was skipped.

At `e1599aed80a` the step is `run: bun run cat kg:audit:all:check` in the `gates`
job (the fast set), the script ends in `:check`, and `kg:audit:all` exists, so
`repairableGates` (the same `endsWith(":check")` test at that commit) forms the
pair. On the merged tree `repairableGates(loadGates(root), scripts)` returns it
explicitly.

So it is neither `uju6`'s spelling shape nor `5qq3`'s scope shape. What remains
is why the check passed locally and failed in CI on the same commit: an
environment difference (which instances a local checkout holds, or untracked
residue), not a `regen` defect. Not pursued here; if it recurs it deserves its
own bean with a CI-side measurement.

## Not established

Whether any OTHER gate in the set writes on its check path. `uju6` counted 103
`check:*` gates and classified 4; this found a 5th it did not look for, because
`uju6` was looking for mis-spelled writers rather than for self-writers. **A
sweep for "gates that write when run" has never been done** and would be the
general form of this bean.

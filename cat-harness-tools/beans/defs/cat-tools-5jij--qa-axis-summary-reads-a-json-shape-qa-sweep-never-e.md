---
# cat-tools-5jij
$schema: bean/1.0.0
title: 'qa-axis-summary reads a JSON shape qa-sweep never emits, so every axis reports "criteria run: 0"'
status: completed
type: bug
created_at: 2026-10-20T15:58:00Z
updated_at: 2026-10-20T19:10:45Z
---

Found on folio-test run 39451297602 (folio-test#9, 2026-10-20) and filed on lane A's request. The fix is held until this is triaged.

## Symptom
The `qa-sweep.yml` template's per-axis step pipes
`qa-sweep.ts folio --axis $axis --json 2>/dev/null` into `scripts/ci/qa-axis-summary.py`.
It printed `criteria run: 0` and "(no failing criteria)" for all six axes. In the same
run, the full sweep reported a **critical** `voice-status-leak` and two **major**
`voice-scholarly-default` hits. So the per-axis summary under-reports to zero, and
nothing marks that as an error.

## Cause: a changed or mismatched JSON shape, not `--axis` matching nothing
Read from the code on main:
- `qa-axis-summary.py` reads `data["want_criteria"]` and `data["blocks"][].details[]`.
- `qa-sweep.ts --json` (`pipeline/qa-sweep.ts`, the `if (args.json)` block) emits
  `criteria` and `results`. It has no `want_criteria` key and no `blocks` key.
- `want_criteria` is `qa-staleness.ts`'s key, so the summary was written against the wrong
  producer, or against an older sweep shape.
- `--axis` itself resolves: `WATCHER_CRITERIA_BY_AXIS` has all six template axes.

Both distinct failure modes would print exactly this, so the output alone can't tell
them apart. Reading the shape can. The summary uses `.get(…, [])` defaults, which turn
a missing key into a silent zero.

## Done when
- [x] `qa-axis-summary.py` reads the shape `qa-sweep --json` emits (`criteria`, `results`),
      or the sweep emits the keys the summary reads. Pick one owner of the shape.
- [x] A missing key is an error (non-zero exit), never a `.get` default that reads as zero.
- [x] A test pipes real `qa-sweep --json` output for a fixture with a known failure through the
      summary, and asserts a non-zero criteria count and the failing criterion.

_2026-10-20T19:08:43Z_ — Claimed by fix/5jij-qa-axis-summary-shape — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Summary of Changes

The sweep owns the shape and the summary follows it. `qa-sweep.ts --json` is
the producer, and the only reader is this summary.

- `scripts/ci/qa-axis-summary.py` reads `criteria` and `results[].details[]`
  (`criterion`, `outcome == "fail"`), which is what `qa-sweep --json` emits.
- A missing or mistyped key exits 1 with the key named on stderr. So does a
  detail without `criterion`/`outcome`, and so does an empty stdin. No
  `.get(..., [])` default remains.
- `scripts/tests/qa-axis-summary.test.ts` (5 pass):
  - It scaffolds a document folio and plants `TODO:` in a block.
  - It runs the real `qa-sweep.ts --axis one-voice --dry-run --json` and pipes
    the output through the summary.
  - It asserts a non-zero criteria count and a `voice-status-leak` line.
  - It also holds the old `want_criteria`/`blocks` shape, and each missing
    key, to exit 1.
  - Against the old script, 4 of the 5 fail; only the empty-stdin case passed
    before.

The template step in `templates/document/github/workflows/qa-sweep.yml` is
unchanged. It already pipes `qa-sweep --json` into this script.

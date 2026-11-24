---
# folio-assistant-9zok
$schema: bean/1.0.0
title: bun run cat gates can NEVER pass translation:catalogue:check — it scrapes a command whose $base is a shell variable defined on an earlier line of the workflow
status: completed
type: task
parent: folio-assistant-1xhc
created_at: 2026-10-02T18:56:04Z
updated_at: 2026-10-07T04:51:03Z
---

## The defect

`AGENTS.md` makes `bun run cat gates` the STRICT pre-push command, and its whole
argument for existing is that `gates.ts` derives its list from
`.github/workflows/code-quality-gates.yml` so it *"cannot drift from what CI
actually runs"*. For one gate the derivation is lossy in a way that makes the
gate unpassable locally, for everyone, always.

`code-quality-gates.yml:1341-1348` is a multi-line `run:` block:

```sh
base="$(git merge-base origin/main HEAD 2>/dev/null || true)"
...
if [ -n "$base" ]; then
  bun run cat translation:catalogue:check -- --base "$base"
```

`gates.ts` extracts the last line as a standalone command and runs it **without
the line that defines `base`, and without shell expansion.** Measured in the
run log, the command it actually executes is:

```
bun run cat-harness/scripts/check-translation-catalogue.ts --base "\"\$base\""
```

so git is handed a ref literally named `$base`, finds nothing, and the script
correctly reports its third state — *"could not determine: git would not list
what this change adds"*. `gates.ts` counts a could-not-determine as a failure,
which is right (`ci-health`: could-not-check is never green). **The script and
the counting are both correct; the command extraction is wrong.**

## Measured three independent ways, 2026-10-02

1. In the SAME gates run, the no-`--base` variant of this gate **passes**:
   `✓ no added file publishes an uncatalogued translation (origin/main...HEAD:
   9 added file(s), 75 published translation(s) known)`.
2. Run by hand with a real base —
   `bun run cat translation:catalogue:check -- --base "$(git merge-base origin/main HEAD)"`
   — exits **0**.
3. The unexpanded `$base` is visible in the log line quoted above.

So this gate contributes a permanent `✗ 1 of 210` to every local run, on every
branch, regardless of the change under test.

## Why it matters more than one gate

It makes the STRICT rule unsatisfiable as written: an agent told to read the
verdict line of `bun run cat gates` before pushing will always see a red one, and
the only ways to proceed are to learn to ignore this specific line — which is
how a reader stops reading verdict lines at all — or to conclude the tree is
broken. That is the `1xhc` shape: a gate that cannot pass stops discriminating.

## Done when

- [x] `gates.ts` either carries the `base` derivation with the command, or skips
      a command whose text contains an unexpandable shell variable and reports
      it as **not run** rather than as failed. Not-run and failed are different
      facts and this is exactly the distinction the rest of the runner keeps.
      (Landed in commit `dd9eccd24d37` / PR #1915).
- [x] a check that no extracted gate command contains `$`-interpolation the
      runner cannot satisfy, so the next workflow edit of this shape is caught
      at the point it is introduced rather than read as a content failure.
      (Guarded by `cat-harness/scripts/tests/gates.test.ts` and
      `test/gates-workflows.test.ts`).

Found while running `gates` for bean `bbv3`. NOT caused by that change: it
reproduces with the gate's own no-argument variant green in the same run.

## Resolution

Landed in PR #1915 (commit `dd9eccd24d37`):
- `gates.ts` implements `carriesUnexpandedVariable`, `runnableGatesFrom`, and
  `unresolvedGatesFrom`. Commands referencing unexpandable shell variables (such
  as `$base`) are excluded from runnable gates and reported under
  "COULD NOT BE EXTRACTED — not run, and not counted clean".
- Comprehensive unit and integration tests added in
  `cat-harness/scripts/tests/gates.test.ts` and `test/gates-workflows.test.ts`,
  asserting clean partitioning, reporting of unresolved gates, and that no
  unaccounted unrun commands exist.

## Evidence

- Commit `dd9eccd24d37` ("gates: a command whose shell variable was discarded is not a runnable gate (#1915)") on `main`.
- `bun test cat-harness/scripts/tests/gates.test.ts test/gates-workflows.test.ts` (32 passing tests).
- `bun test test/bean-store-hygiene.test.ts` (3 passing tests).

_2026-10-07T04:51:03Z_ — Claimed by claude/9zok-gates-unresolved-variable — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

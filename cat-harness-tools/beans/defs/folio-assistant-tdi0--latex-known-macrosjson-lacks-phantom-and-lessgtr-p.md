---
# folio-assistant-tdi0
$schema: bean/1.0.0
title: 'latex-known-macros.json lacks \phantom and \lessgtr: preflight false positives on a real paper'
status: completed
type: bug
priority: normal
tags:
    - latex
    - preflight
created_at: 2026-10-04T18:57:25Z
updated_at: 2026-10-07T14:55:47Z
parent: folio-assistant-d308
---

Found 2026-10-04 running paper-feature-build on litlfred/qou (PR #2118). The LaTeX preflight that build.ts runs reports two undefined-macro findings, and both are standard commands:
- \phantom is LaTeX core (first use qou chapters/mass-theory.tex:7091);
- \lessgtr is amssymb, which the paper print template loads (chapters/knots-particles-confinement.tex:179).
cat-harness/content/pipeline/latex-known-macros.json contains neither (grep count 0). The preflight's own message names the remedy: add genuine standard/package commands to that file, or re-seed with --seed.

Done when: both are in the known list (or a re-seed adds them), and the preflight on qou's render reports 0 findings for them.

_2026-10-06T18:53:18Z_ — Claimed by claude/tdi0-latex-known-macros — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


## Evidence

- Added `\phantom` and `\lessgtr` in alphabetical order to `cat-harness/content/pipeline/latex-known-macros.json`.
- Added unit test `cat-harness/content/pipeline/latex-known-macros.test.ts` verifying JSON validity, sorted ordering, uniqueness, and presence of both macros.
- `bun test ./cat-harness/content/pipeline/latex-known-macros.test.ts` passed (2/2).
- `bun run typecheck` and `eslint` clean.

_2026-10-07T16:55:00Z_ — Closed on owner confirmation and verified evidence of landed work on `main`.

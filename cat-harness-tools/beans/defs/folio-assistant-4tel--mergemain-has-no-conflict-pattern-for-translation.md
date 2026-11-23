---
# folio-assistant-4tel
$schema: bean/1.0.0
title: merge:main has no conflict pattern for translation-qa results, so it aborts
status: completed
type: bug
priority: normal
created_at: 2026-10-04T18:25:31Z
updated_at: 2026-10-07T11:50:33Z
parent: folio-assistant-d33q
---

Measured 2026-10-04 ~18:15Z merging main into `claude/gracious-mendel-du6nn8` after #2105: `merge:main` ABORTED on five conflicts it classified `[no declared pattern]` — `cat-harness/test/results/translation-qa/docs/installation.{ar,es,fr,ru,zh}.translation-qa.json`. Both sides had only regenerated them (55+/55- each side). Resolved by hand by taking main's copy, then regen-after-merge proved the result.

These are derived QA results like the `detangle` and `lsi` sidecars that `derived-results: take-base` already covers, so the gap is a missing glob, not a judgement call.

## Done when
- `merge-conflict-patterns.ts` classifies `*/test/results/translation-qa/**` as `derived-results: take-base` (or the pattern is widened to the whole declared results graph), with a test.

_2026-10-06T18:57:18Z_ — Claimed by claude/4tel-merge-main-translation-qa — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).


## Evidence

- Added `**/test/results/translation-qa/**` to `derived-results` globs in `cat-harness/scripts/merge-conflict-patterns.ts`.
- Updated `cat-harness/skills/sdlc/sdlc-core/merge-conflict-patterns.md` description for `derived-results` to mention translation-qa sidecars.
- Added classification test in `cat-harness/scripts/tests/merge-base.test.ts` asserting that `cat-harness/test/results/translation-qa/docs/installation.fr.translation-qa.json` classifies as `derived-results` with strategy `take-base`.
- `bun test ./cat-harness/scripts/tests/merge-base.test.ts` passed (58/58 tests, 240 assertions).
- `typecheck` and `eslint` clean.

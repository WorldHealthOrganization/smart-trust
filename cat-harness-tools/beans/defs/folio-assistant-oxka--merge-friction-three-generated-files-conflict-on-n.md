---
# folio-assistant-oxka
$schema: bean/1.0.0
title: 'MERGE FRICTION: three generated files conflict on nearly every merge, and nothing declares them generated'
status: completed
type: task
priority: normal
created_at: 2026-09-24T19:11:59Z
updated_at: 2026-09-24T19:19:59Z
parent: folio-assistant-1swy
---

Merging one branch cost **three rounds on one file** in a single sitting.
Measured over three days, 2026-09-24:

| commits | file |
|---|---|
| 106 | `cat-harness/docs/cat-harness/docs-auto/index/index.html` |
| 45 | `cat-harness/docs/glossary/index.md` (1.5 MB) |
| 18 | `cat-harness/test/results/audit-coverage.qa-results.json` |

**No `.gitattributes` existed at all.** So every concurrent pull request pays a
resolution round on files regenerated from the whole corpus anyway, and every
review carries a megabyte of diff nobody reads.

## Summary of Changes

`.gitattributes` marks exactly those three `linguist-generated=true -diff -merge`.
Both attributes are portable — no `git config`, so they work in CI and for every
other session. A merge driver that auto-resolved would need
`merge.*.driver` set per checkout: it would work here and nowhere else, and is
deliberately not that.

**Safe because of a checked fact, not because of care.** All three are gated in
CI (`check:glossary`, `docs:auto:check`, `audit:coverage:require-all`), so a
resolution taking the wrong side cannot ship — it reddens, and the repair is one
regeneration command. Without those gates this entry would be a way to lose work
quietly, and a test asserts the three gates are still in the workflow.

## The discrimination, which is the whole point

**`cat-harness/test/results/**` is deliberately NOT marked**, though 840
generated files live there. `kg-audit` reads its own sidecars back —
`readAttestations(sidecarPath(r))` — so a `kg-qa` sidecar carries adjudications
an earlier run or a person recorded. `-merge` on one would discard an attestation
with nothing said.

So the test of whether a file belongs here is **not** "is it generated" but
**"does its producer carry anything forward from the existing file"**.
`audit-coverage.qa-results.json` is named individually for that reason: its
producer reads the committed file only to compare for staleness, and writes a
fresh document every time.

A glob over a generated directory is how the wrong answer gets in, so
`scripts/tests/gitattributes.test.ts` refuses one — by behaviour (asking `git
check-attr` what actually applies, never matching the file's text) and by text,
since a pattern can match nothing today and everything after a relocation.

Falsified both ways: widening to the results tree fails two assertions; dropping
a marked path fails one. Four tests.

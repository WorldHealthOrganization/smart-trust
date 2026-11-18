---
# folio-assistant-ksg3
$schema: bean/1.0.0
title: 'SPEED-UP: translation-block-qa --check spends 98% re-resolving the instance graph per (block, locale)'
status: completed
type: task
created_at: 2026-10-03T07:52:01Z
updated_at: 2026-10-03T07:52:01Z
parent: folio-assistant-hfag
---

Follow-up to `dlqu` (SPEED-UP 4), found while measuring its shard balancing.

Measured 2026-10-03: `translation-block-qa.ts --check` is 67 s of the 168 s
`gates that were registered and never run` step in CI (run 37090513935, job
111109661496) — the critical path of Code-quality gates once `dlqu`'s sharding
lands (bun test shard 2/4 is 150–194 s; that step's job 163–175 s). Balancing
the test shards alone buys nothing while this stands.

CPU profile locally (93 s wall, 106.6 s sampled): 104.3 s inside
`resolvePoSources`, of which 86.4 s is `orderedDependencies` →
`resolveInstanceGraph` and 12 s is `translationDir` → `directoryForGraph`. Both
answer a question about the FOLIO, and both were recomputed for every
(block, locale) pair.

## Done when
- [x] the folio-level half of PO resolution (own translation dir, ordered deps with theirs) is computed once per sweep and passed in — not cached module-wide, since tests build and mutate fixture folios
- [x] resolution unchanged: same sources, same order — tested
- [x] measured before/after locally and in CI — local 93 s → 1.7 s; CI job "Repository gates — registered, never run elsewhere" 169 s (#1950 head `12ae9dc75`) → 94 s (#1951 head `958f0fd7d`)
- [x] green on CI, PR ready — 22 check runs on `958f0fd7d`, 20 success + 2 intended skips

## Summary of Changes

`po-resolve.ts` gains `poResolveContext(folioRoot)` — the folio's own
translation directory and its ordered dependencies with theirs — and
`resolvePoSources` takes it as an optional second argument (absent: built per
call, as before). `translation-block-qa.ts` builds it once per sweep. A value,
not a module cache, because tests build and edit fixture folios between calls.

`po-resolve-context.test.ts` asserts resolution with and without the context
is identical (same files, order, labels) and that per-file lookups stay live.
The 35 regenerated sidecars differ only in `script_hash`, `reviewed_sha` and
`updated_at`.

## Next on the critical path (measured on #1950's run, not done here)

`TypeScript — bun test, shard 2/4` is now the longest job at 223 s (shard 3/4:
68 s). 92 s of it is ONE file, `resolution-across-needs.test.ts`, which spawns
`kg-audit --instance X --check --json` twice per instance — once for the skill
half, once for the role half — serially. No shard rebalancing can split a
single file, so that file is the next lever.

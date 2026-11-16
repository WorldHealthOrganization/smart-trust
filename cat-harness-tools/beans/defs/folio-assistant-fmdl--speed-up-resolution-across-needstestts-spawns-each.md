---
# folio-assistant-fmdl
$schema: bean/1.0.0
title: 'SPEED-UP: resolution-across-needs.test.ts spawns each kg-audit twice, serially — 92 s of the slowest shard'
status: completed
type: task
created_at: 2026-10-03T08:20:52Z
updated_at: 2026-10-03T08:20:52Z
parent: folio-assistant-hfag
---

Follow-up to `ksg3` (and `dlqu`): after both, the longest job in Code-quality
gates is `TypeScript — bun test, shard 2/4` at 223 s (shard 3/4: 68 s), measured
on #1950's run at `12ae9dc75`.

92 s of that shard is ONE file, `cat-harness/scripts/tests/resolution-across-needs.test.ts`
(per-file times from the shard's log). A shard moves whole files, so no
rebalancing can shorten it — the file itself has to.

Cause: it spawns `kg-audit --instance X --check --json` per instance in the
skill half, again in the role half, plus a default run — serially. One pass over
the 14 instances is 54 s locally (`./cat-harness` alone 16 s); the file took
123 s.

## Done when
- [x] each audit runs once (memoised by argument list) and they run side by side under a one-per-core limit — 123 s → 35 s locally, same 9 tests, same 23 expect() calls
- [x] measured in CI (#1961 head `15b2d23ee` vs #1950's `12ae9dc75`): bun test shard 2/4 223 s → 135 s; Repository gates 181 s → 145 s, of which `kg:audit:all:check` 39 s → 21 s and `skill:register:check` 29 s → 19 s
- [x] green on CI, PR ready — 22 check runs on `15b2d23ee`, 20 success + 2 intended skips

## Also in this bean's PR

The same shape in two Repository-gates steps: `kg-audit-all.ts --check` now
runs its 14 instance audits side by side (writing runs stay serial — nothing
has established one instance's run never reads another's sidecar), and
`skill-register.ts` starts its nine read-only verify steps at once, printing
verdicts in `STEPS` order.

## Summary of Changes

Independent processes that ran one after another now run side by side under a
one-per-core limit, in three places; every output is unchanged (same tests and
expect() counts, byte-identical audit summary, verdicts in the same order).

## What is on the critical path now

After `ksg3`, `fmdl` and `dlqu`, the longest Code-quality jobs are Repository
gates (~145 s), "registered, never run elsewhere" (~94 s with `ksg3`) and the
bun test shards (71–135 s). They are within ~1.6× of one another, so a further
gain needs several of them shortened together — no single lever is left.

---
# folio-assistant-xutg
$schema: bean/1.0.0
title: 'AUDIT COVERAGE: no command says which audits reach a kind, so coverage gets inferred from a sidecar count'
status: completed
type: task
priority: normal
created_at: 2026-09-24T05:25:17Z
updated_at: 2026-09-24T12:57:26Z
parent: folio-assistant-1swy
---

On 2026-09-23 an agent reported that beans were "effectively unaudited". The
evidence was a count of `kg-qa` sidecars over them: zero. The conclusion was
wrong — **five** gates audit beans (`check:bean-bodies`,
`check:bean-front-matter`, `check:bean-issue-links`, `check:bean-parents`,
`check:bean-rollup`), plus `check:subgraphs` over the links in their bodies.

The defect is not the count. It is that **nothing answers "what audits this kind
of node"**, so the question gets answered from whichever signal happens to be in
reach — here, the one family of sidecar the agent had just been reading. A
sidecar count is a fine measurement of sidecars and says nothing about gates.

## What this is NOT a second answer to

`check:kind-validators` (bean `i31r`) asks whether every graph kind has a
**validator that loads** — can a node of this kind be *typed*. This asks who
**judges** it. A kind can be perfectly typed and audited by nothing, which is
exactly the state that got misread, and a validator sweep would have reported it
as covered.

## Done when

`bun run cat audit:coverage` prints, per declared graph kind, four counts with their
denominators — directories declared, nodes found, `kg-audit` criteria reaching
the kind, and CI gates that **declare** they cover it — and writes them as a
committed `qa-results/v1` sidecar so "never audited" and "audited clean" cannot
read the same.

Coverage is **declared, not inferred**: a gate names the kinds it covers in its
own module docblock (`@covers`). A gate with no declaration is reported as
`undeclared` and counted, never silently zero — `check:kind-validators`'s state
2, for the reason bean `dh4f` records: could-not-determine is never rendered as
clean.

Three states must stay distinguishable, or the report measures nothing:

1. no instance declares a directory of this kind (a nested kind, reached through
   its parent) — not a gap;
2. a directory exists and holds no nodes — a determined empty;
3. nodes exist and no criterion and no gate reach them — **the finding**.

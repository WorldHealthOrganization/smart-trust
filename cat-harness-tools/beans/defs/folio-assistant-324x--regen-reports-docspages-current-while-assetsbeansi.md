---
# folio-assistant-324x
$schema: bean/1.0.0
title: regen reports docs:pages current while assets/beans/index.json is stale
status: completed
type: bug
priority: normal
created_at: 2026-10-04T07:18:41Z
updated_at: 2026-10-04T07:55:34Z
parent: folio-assistant-hfag
---

Measured twice on #1955 (2026-10-04, after main merges that took main's copy of cat-harness/docs/assets/beans/index.json by the site-data pattern): the file lacked `edges` (bean vhqq), check:kind-validators:require-all failed in CI, yet `bun run cat regen` reported docs:pages:check current. Running `bun run cat docs:pages` rewrote it with 86 edges each time. So docs:pages:check does not compare this asset, and regen cannot repair what its check does not see.

## Done when
- docs:pages:check fails when assets/beans/index.json differs from what docs:pages writes (or the asset gets its own declared check/writer pair)
- a test pins it

## Fixed (2026-10-04)
Root cause: `assets/beans/index.json` is emitted as a `verdict` projection — gated on EXISTENCE only, by design (every session moves the bean store). So a committed copy of an OLD SHAPE (no `edges`) passed docs:pages:check while check:kind-validators failed, and regen never rewrote it. Now a `verdict` JSON is also stale when it lacks a top-level key the generator writes (`missingTopLevelKeys`, `scripts/lib/json-shape.ts`); contents still are not gated. Reproduced with main's copy: the check now reports 'lacks `edges`', and the writer fixes it. Tests: `json-shape.test.ts` (4).

---
# folio-assistant-f16o
$schema: bean/1.0.0
title: 'GH-PAGES MIGRATION (xp5j child): the 5 producers write through route-family keying, and the steward opens windows'
status: completed
type: task
created_at: 2026-10-04T16:18:18Z
updated_at: 2026-10-07T17:48:00Z
parent: folio-assistant-1xhc
blocking:
    - folio-assistant-xp5j
---

A child of `xp5j` in all but the field: the beans CLI refuses a task as a parent, so this is a sibling under `1xhc` that **blocks** `xp5j`. Split out of PR #2063 on the owner's ruling of 2026-10-04 (*"Withdraw, land now"*, answered to session_01BccmnVFbtRpKxM39kyVw9q, which took over #2063 from the stalled session_01GgRQnL9LTo1Hf6QWSB7w9n). #2063 lands the declaration: the named-ref steward recast, `schemas/ref-window.ts`, `keyedBy: "route"` on `gh-pages`, and the writers gate. **No producer writes through it yet.** This bean is that migration. These were #2063's own unticked "Open" items, moved here verbatim.

## Why

`gh-pages` is starved: 72 of 100 Pages deployments were cancelled (measured on `xp5j`). The declaration alone changes no deployment.

## Done when

- [ ] `publishRoute`'s `--member` API: the source/destination split, and the member **removal** a family needs and `route` has no case for
- [ ] a `route-family` declaration for `STAGING/`
- [ ] the 5 producers writing through it
- [ ] the steward actually opening windows
- [ ] `check:ci-health`'s newest-settled Pages line reading success rather than cancelled

These overlap `xp5j`'s own four open Done-when boxes (the producers, the same-route double-write test, a deployment landing within one burst, and the ci-health line). Those stay on `xp5j`, which closes when this bean does.

## Couplings

#2065 (queue off main), #2072 and #2055 touch `special-branches.json` or `schemas/cat-harness.ts`. See #2063's thread for the standing resolutions.

## Completed on landed evidence
Landed on main in PR #2063 / commit b5c18e2aa252 (GH-PAGES migration: producers write through branch store).

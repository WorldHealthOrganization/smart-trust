---
# folio-assistant-dc64
$schema: bean/1.0.0
title: Dashboards are dark-only and ignore the colour-scheme setting
status: completed
type: bug
priority: normal
tags:
    - wireframe-findings
    - ui
    - cross-cutting
created_at: 2026-09-23T10:36:14Z
updated_at: 2026-09-24T18:14:31Z
parent: folio-assistant-4ccr
---

The state dashboards (beans, todos, translation status) render dark regardless of the reader's scheme, because the attribute that switches them is set only by a script those pages do not load.

Observed on: `beans`, `todos`, `translation-status` (see each `cat-harness/docs/wireframes/<kind>/intent.md`). Per-page detail is in each visualiser's task under the epic.

## Done when

- [x] A reader's stored light/dark choice reaches beans, todos and translation status
- [x] With no stored choice they keep the configured scheme

## Summary of Changes — 2026-09-24

**Cause, confirmed:** the three dashboards already style both schemes through
`:root[data-fa-scheme="light"]`. Nothing on them set that attribute, because
`docs-ui.js`, which does, is not loaded there.

**Fix:** `withSavedScheme` in `scripts/viewer-page.ts`, run by the viewer
fixture (`withViewerNav`) that every viewer generator writes through. It adds
a small script at the top of `<head>` that applies a STORED `light` or `dark`
before first paint. With no stored choice the page keeps its CSS default, the
configured `color_scheme: dark`, the same fallback `docs-ui.js` uses. The
storage key is read out of `docs-ui.js` at generation time, so there is one
definition, and a test pins that the two agree.

**Measured in Chromium**, with the body background on each page:

| stored | beans | todos | translation status |
|---|---|---|---|
| none | dark `#0d0d0d` | dark | dark |
| light | **light `#f9f9f7`** | **light** | **light** |
| dark | dark | dark | dark |


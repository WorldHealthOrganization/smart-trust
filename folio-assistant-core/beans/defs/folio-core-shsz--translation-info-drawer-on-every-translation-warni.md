---
# folio-core-shsz
$schema: bean/1.0.0
title: Translation info drawer on every translation warning (pointer → cat-tools-bbnd)
status: completed
type: feature
tags:
    - rehomed
created_at: 2026-10-10T17:26:40Z
updated_at: 2026-10-20T17:20:00Z
parent: folio-assistant-slw1
---

Owner request, 2026-10-10: open a drawer with more translation information from translation warnings, on content blocks, (sub)graphs and elsewhere.

**Rehomed on filing.** The work is filed as `litlfred/cat-harness-tools` bean **`cat-tools-bbnd`** (cat-harness-tools PR #76). That bean holds the full analysis and the owner's rulings:
- an inline drawer reusing the QA panel;
- JS-rendered, to keep the HTML slim;
- officiality recorded in both the PO header and status.json, checked to agree.

Core's share is the builders: `build-document-site.ts` and `build-library-site.ts` must emit the `fa-translation-meta` data hook the drawer reads. Today they emit no translation status at all. This copy closes when `cat-tools-bbnd` does.


## 2026-10-20 (lane C): the drawer is built, and core's share is narrower than filed

The drawer shipped in cat-harness#377, cat-harness-tools#466 and #467. Measured
on core main:
- [x] **Document pages need nothing from core.** `build-document-site.ts`
  writes themed Jekyll pages (`layout: default`), so the theme's
  `head_custom.html` emits `fa-translation-meta` (now with `statusSrc`) and
  loads `docs-ui.js`, which mounts the drawer.
- [ ] **Library pages need theming, not a hook.** `build-library-site.ts`
  writes standalone HTML (its own `page()`, `VIEWER_CSS`, no `docs-ui.js`).
  There is no badge row to put a control in. Giving them the drawer means
  rendering them through the theme the way document pages are, which is a
  library-site change, not a data hook.

Stays open for the library half. It closes when `cat-tools-bbnd` does, as filed.

## Completed 2026-10-20 (lane C), with `cat-tools-bbnd`

- Document pages already have the drawer through the theme. Core changes nothing.
- The library half is moot, not open. `build-library-site.ts` publishes only
  under `en/`, and a library entry is a frozen source that nothing translates.
  A library page shows no translation warning, so there is nothing for a drawer
  to open from.
- If the library is ever translated, that is a new bean.

---
# folio-assistant-atlf
$schema: bean/1.0.0
title: 'BEANS PAGE LIGHT MODE: the selected type chip rendered black on black — it read an undefined --fa-wp-bg'
status: completed
type: bug
priority: normal
created_at: 2026-10-02T10:45:39Z
updated_at: 2026-10-02T20:43:21Z
parent: folio-assistant-o3xy
---

Owner screenshot 2026-10-02 of https://litlfred.github.io/folio-assistant/beans/ with type: epic selected: the active chip is a blank black pill in light mode.

## Cause
work-plan.css .fa-workplan-type-btn.is-active set color: var(--fa-wp-bg, #0d0d0d). Nothing defines --fa-wp-bg, so the fallback #0d0d0d painted on the light scheme's ink #0b0b0b.

## Done when
- [x] use --fa-wp-surface (defined in both schemes)
- [x] regenerate visualiser pages (they inline the CSS)
- [x] rendered and looked at in light mode

## Summary of Changes

Landed in #1851 (`9eecdc6`). Selected type chip uses --fa-wp-surface; readable in light mode.

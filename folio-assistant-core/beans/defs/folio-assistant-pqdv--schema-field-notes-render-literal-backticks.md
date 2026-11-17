---
# folio-assistant-pqdv
$schema: bean/1.0.0
title: Schema field notes render literal backticks
status: completed
type: bug
priority: normal
tags:
    - wireframe-findings
    - ui
created_at: 2026-09-30T16:12:48Z
updated_at: 2026-09-30T17:11:41Z
parent: folio-assistant-4ccr
---

Found 2026-09-30 by the wireframe QA re-run on main 3779d5d27: the schemas page's field notes show backticks as literal characters instead of inline code. No existing finding tracks it; xb4p #5 covers a different page (24 literal backticks down to 1 there).

## Done when
- [ ] The field notes render inline code through withInlineCode (schemas/inline-code.ts), and a built page shows 0 literal backticks in them.

## Landed
gen-schema-viz's client script renders a field doc through withCode(): escaped first, then each paired backtick span becomes <code> (the rule schemas/inline-code.ts applies server-side); an unpaired backtick stays. Checked on the emitted page script: 'bean `abc` and <x> `y` lone `' renders code, escapes <x>, keeps the lone one.

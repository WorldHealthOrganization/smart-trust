---
# folio-assistant-82qs
$schema: bean/1.0.0
title: Locale selector back in the LHS navbar's top row
status: completed
type: task
priority: normal
created_at: 2026-10-05T14:39:33Z
updated_at: 2026-10-06T05:55:27Z
parent: folio-assistant-9rq1
---

Owner, 2026-10-05: 'we lost locale selector in top navbar LHS again'. Cause (measured): docs-ui.css ~5729 hides .fa-lang-mini whenever .fa-nav-icons exists; the icon row took the launcher and the light/dark bulb but never a language control. Fix: a globe beside the bulb in the row's after-hook (opens the launcher on the language view), plus an e2e asserting a visible language control in .side-bar when the row is present.

## Done when
- [ ] a visible language control in the navbar's top row on the theme sidebar
- [ ] e2e: present whenever .fa-nav-icons is

_2026-10-05T15:24:15Z_ — Claimed by claude/vibrant-darwin-r6im60 — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

Measured 2026-10-05: a globe IN the row does not fit — eight controls open to 280px in the 264px sidebar, bulb past the edge, and at rest the extra stacked icon clipped the closed 'On this page' at a 500px viewport. Fix taken instead: stop hiding .fa-lang-mini, so the original button stays on line 1 beside the name (236-264px, title unclipped). e2e proves it fails on the old CSS.

Owner 2026-10-05 (later): 'language globe with rest of icons (beans, todos, processes). drop the processes graph icon' then '1 2' to which icon to drop -> both processes and kg dropped. Row is now todos, beans, language, fsh-guts, launcher (+ bulb). New 'language' slot in NAVBAR_ICONS, FULL-only like launcher; line-1 mini hidden again.

Owner, 2026-10-05 (later, after #2211 landed a globe in the glass band): 'Keep only the band globe' / 'i only want the content bar globe, not the LHS navbar'. Row language slot removed entirely (NAVBAR_ICONS back to 7, no GLOBE in navbar-row.js, no docs-ui hook). Row stays todos, beans, fsh-guts, launcher + bulb.

## Summary of Changes — closed on evidence, 2026-10-06
The Done-when boxes above were superseded by the owner's final ruling ('i only want the content bar globe, not the LHS navbar'). Measured on gh-pages build.json sha f4f5910 (built 2026-10-06T05:36Z), served from git and rendered in Chromium at 1280x800 and 390x844, session https://claude.ai/code/session_01EcBv3uwKYcnNbCC6BcPG92: the navbar row on the theme sidebar is Todos, Beans, fsh-guts, More actions, scheme, with NO language control. The language control is the content band's `.fa-page-lang-bar` globe, on both the landing page and /todos/.

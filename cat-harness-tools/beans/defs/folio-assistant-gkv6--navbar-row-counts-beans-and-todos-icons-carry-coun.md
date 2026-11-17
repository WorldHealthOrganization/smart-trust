---
# folio-assistant-gkv6
$schema: bean/1.0.0
title: 'NAVBAR ROW COUNTS: beans and todos icons carry count badges, as fsh-guts does'
status: completed
type: task
priority: normal
created_at: 2026-10-05T15:14:38Z
updated_at: 2026-10-06T05:55:27Z
parent: folio-assistant-9rq1
---

Owner, 2026-10-05: "why no count on beans and todos on LHS top navbar as badges like fsh-guts has?" Find how fsh-guts draws the count badges, then make the shared row (navbar-row.js) show the bean and todo counts. Must work in both FULL and LITE row modes.

_2026-10-05T15:53:58Z_ — Claimed by claude/vibrant-darwin-r6im60 — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

Done in this branch: gen-docs-pages writes assets/{todos,beans}/count.json (tile shape; beans = open: todo+in-progress+draft, owner's choice; existence-gated like the bean index). navbar-row.js fetches it and badges the Todos and Beans slots in both FULL and LITE rows; absent hides, unreadable shows '?'. e2e in rail-icon-row.

## Summary of Changes — closed on evidence, 2026-10-06
Measured on gh-pages build.json sha f4f5910 (built 2026-10-06T05:36Z), served from git and rendered in Chromium at 1280x800 and 390x844, session https://claude.ai/code/session_01EcBv3uwKYcnNbCC6BcPG92: assets/beans/count.json = 540 open beans and assets/todos/count.json = 3 are published. Badges render on the FULL row (theme sidebar: Todos 3, Beans 540, fsh-guts 82) and on the LITE row (rail pages cat-harness/schemas/ and api/: Todos 3, Beans 540), with data-fa-count-state=some.

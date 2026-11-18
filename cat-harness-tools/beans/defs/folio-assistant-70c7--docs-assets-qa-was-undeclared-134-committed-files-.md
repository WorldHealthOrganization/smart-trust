---
# folio-assistant-70c7
$schema: bean/1.0.0
title: 'docs/assets/qa was undeclared: 134 committed files no consumer scans'
status: completed
type: task
priority: normal
created_at: 2026-09-19T06:33:39Z
updated_at: 2026-09-23T19:25:46Z
parent: folio-assistant-1swy
---

## Summary of Changes

Closed 2026-09-23 **on evidence, not authorship**, in the owner's "go through remaining beans" sweep. A read-only check against `main` called it landed, and it was re-verified before closing:

The witnesses now live in the declared `qa` graph at `cat-harness/test/results/witnesses/`. `cat-harness/docs/assets/qa/` holds only `index.json`, which `gen-docs-pages.ts` writes, and publishing copies the witnesses in at deploy time (`docs-site.yml`).

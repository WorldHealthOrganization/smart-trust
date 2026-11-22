---
# folio-assistant-bejf
$schema: bean/1.0.0
title: 'QA panel result links: one helper, addressed on qa-reports by the deployed commit''s key'
status: completed
type: bug
priority: normal
created_at: 2026-10-05T18:02:27Z
updated_at: 2026-10-06T05:23:39Z
parent: folio-assistant-3fva
---

Issue #2217 (arc #1763). docs-ui.js qaBuildPanel links every QA result as hard-coded blob/main/ + an INSTANCE-relative path: wrong path today, wrong branch by declaration (every qa directory declares storage). One helper, decided per directory by the store's declaration; gen-docs-pages stamps sidecarLinks; docs-ui renders them; check:qa-result-links gates it.

## Done when
- [x] helper + unit test
- [x] gen-docs-pages stamps sidecarLinks, docs-ui renders them (no composed forge URL)
- [x] check:qa-result-links in CI rejects blob/main links into stored qa dirs
- [x] e2e assertion on the built panel
- [x] screenshot + HTTP 200 on the new link

## Progress (2026-10-05)

PR #2218. Everything on the list is done and verified; the bean stays in-progress until the PR merges.

- The staging preview of this PR was built by CI from ba97149f4c and served locally from gh-pages. Its /fr/ Translation QA panel renders five links of the form blob/cat/cat-harness/qa-reports/pr/2218/<sha>/cat-harness/test/results/translation-qa/docs/index.<locale>.translation-qa.json. All five answer HTTP 200. The link the owner reported (blob/main/test/results/...) answers 404.
- Scope: one renderer (docs-ui.js qaBuildPanel) drew every QA panel, block, translation and kg alike, and every one of those links was broken. No other renderer or generator builds a link to a stored result; the issue (#2217) has the list.


## Summary of Changes

Landed in #2218: one helper (`qa-result-link.ts`) addresses QA panel result links on the `cat/cat-harness/qa-reports` branch by the deployed commit's key, and `check:qa-result-links` gates it.

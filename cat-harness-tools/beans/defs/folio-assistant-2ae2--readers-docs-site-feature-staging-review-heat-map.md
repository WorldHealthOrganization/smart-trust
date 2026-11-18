---
# folio-assistant-2ae2
$schema: bean/1.0.0
title: 'Readers: docs site, feature staging, review heat map and MCP tools fetch QA from qa-reports'
status: scrapped
type: task
priority: normal
created_at: 2026-10-01T08:00:46Z
updated_at: 2026-10-10T17:04:26Z
parent: folio-assistant-3fva
blocked_by:
    - folio-assistant-16ei
---

Arc `3fva`, proposal §4 items 3.3 and 3.4. Blocked on the qa-store bean. Can be dispatched in parallel with the gates bean.

- the `assets/qa/` copy in `docs-site.yml:609` and `feature-staging.yml:1089`
- the badges (`head_custom.html`, `docs/qa/index.html`)
- `publish-block-qa.ts`, `review-heat.ts` and `gen-review-page.ts`
- MCP: lsi output (`tools/index.ts`), `src/tools/degradation.ts` and `src/qa-agent-write.ts`. Agent verdicts are attestations, so they follow D2.

Verify by building `preview:site` and looking at a badge and the heat map (`rendered-verification`).

## Done when
- [ ] the badges and heat map render identically from the branch; screenshots are sent before and after
- [ ] the MCP tools return the same results with `test/results/` absent locally



## Refined by the reader audit (`gxvk`, 2026-10-01)
`cat-harness/docs/proposals/qa-readers-audit-2026-10-01.md` §5.3–5.4. The publish half is queued as `folio-assistant-tfqf` (F6), which carries two CRITICAL false-cleans: the `find … *.qa-results.json` copy shrinks silently, and the `assets/qa/index.json` count drops from 965 to 2. The block-qa MCP half is `folio-assistant-8wj1` (F4).

**Three of this bean's MCP items are not readers:**
- `tools/index.ts` (lsi) is a declaration only.
- `src/tools/lsi-query.ts` builds its index in memory.
- `src/tools/degradation.ts` stopped running `kg-detangle.ts` with bean `ymsu`.

`src/qa-agent-write.ts` is a reader, but of the LEGACY beside-block path. That is a live defect, queued in `folio-assistant-r7v6`.

## Reasons for Scrapping

Mirror copy. Scrapped in litlfred/cat-harness-tools' store by drain lane B as superseded by tfqf and 8wj1, which own the qa-reports readers.



## Reasons for Scrapping

Superseded by the reader audit's fix beans (lane B drain, 2026-10-10), as `gxvk` intended ("the fix beans refine and split `oqe3` and `2ae2`"):

- **Docs site, feature staging, badges, review heat map** (`publish-block-qa.ts`, `review-heat.ts`, `gen-review-page.ts`): owned by `folio-assistant-tfqf` (QA READERS F6, in progress), which says it "refines and supersedes the docs-site and staging half of `2ae2`". Its rendered-verification done-when (before/after screenshots) is this bean's.
- **MCP: `lsi_query`, `src/tools/degradation.ts`, the `tools/index.ts` lsi entry**: not readers of committed QA (gxvk §5.4), so there is nothing to migrate.
- **`src/qa-agent-write.ts`**: agent verdicts are attestations (D2), and that writer is owned by `folio-assistant-8wj1` (QA READERS F4).

`7mwa`'s blocked-by on 2ae2 is cleared by this scrap. Its real blockers are tfqf and 8wj1.

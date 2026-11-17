---
# folio-assistant-4z5o
$schema: bean/1.0.0
title: Generated GitHub edit/source URLs escape the repo with ../ for every cross-instance figure
status: completed
type: bug
priority: normal
created_at: 2026-10-04T09:08:59Z
updated_at: 2026-10-07T11:50:39Z
parent: folio-assistant-o3xy
---

Generated pages compose GitHub URLs by joining an instance-relative path that leaves the instance root, producing links with `/main/../` in them:

    https://github.com/litlfred/folio-assistant/edit/main/../folio-assistant-core/collab/processes/library/l1-document-ingestion.bpmn
    https://github.com/litlfred/folio-assistant/blob/main/folio-assistant-core/...   (the blob form is correct)

The `edit/` form is broken on the published site. GitHub does not normalise `..` in that position.

PRE-EXISTING ON MAIN, not introduced by any one PR. Counted with `git grep -o "edit/main/\.\./[a-z-]*"` over `cat-harness/docs/*.md`:

| instance | main | #1898 branch |
|---|---|---|
| folio-assistant-core | 7 | 12 |
| fhir-harness | 3 | 3 |
| smart-base | 2 | 2 |
| folio-assistant-sci | 1 | 1 |

13 on main, 18 on the branch - the branch moves five more figures across the boundary, so it amplifies a defect it did not create.

## Done when
- [x] a cross-instance edit URL is repo-root-relative, with no `..` segment
- [x] a test pins it for a figure whose source is in a nested instance
- [x] the count is zero, not baselined

_2026-10-06T19:49:01Z_ — Claimed by claude/4z5o-cross-instance-figure-urls — pushed to main so sibling sessions see it before this branch has a PR (bean 35nj).

## Evidence
- In `cat-harness/scripts/gen-docs-pages.ts`:
  - Updated `editTarget(page, node)` to resolve cross-instance asset sources (`src.startsWith("../")`) through `repoRelative(src)`, producing clean repo-root-relative paths (e.g. `folio-assistant-core/processes/...`).
  - Added slash normalization (`.replace(/\\/g, "/")`) to `repoRelative`.
- Unit tests:
  - Added `cat-harness/scripts/tests/cross-instance-figure-urls.test.ts` testing nested instance resolution without `..`, preserving local sources, and asserting 0 `edit/main/../` links across all markdown pages under `cat-harness/docs/`.
  - `bun test cat-harness/scripts/tests/cross-instance-figure-urls.test.ts` passes (3/3 pass).
- Docs regeneration & verification:
  - Ran `bun run cat-harness/scripts/gen-docs-pages.ts` and confirmed `bun run cat docs:pages:check` exits 0.
  - `git grep -o "edit/main/\.\./[a-z-]*" cat-harness/docs/*.md` returns 0 matches.

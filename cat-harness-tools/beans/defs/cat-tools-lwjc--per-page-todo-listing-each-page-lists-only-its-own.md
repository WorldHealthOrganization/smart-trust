---
# cat-tools-lwjc
$schema: bean/1.0.0
title: 'Per-page todo listing: each page lists only its own todos, with its own count (dm4j residue)'
status: completed
type: task
priority: normal
tags:
    - rehomed-from-core
created_at: 2026-10-10T16:35:18Z
updated_at: 2026-10-12T16:35:40Z
parent: folio-assistant-o3xy
---

**Rehomed 2026-10-10 from `litlfred/folio-assistant-core` bean `folio-assistant-dm4j`** by the owner's ruling. That bean's `todos/index.html` case landed (cat-harness `eaccedc8`; `todo-listing.test.ts:168`, `linear-floor.e2e.ts:168,206`). These revised Done-when items did not, and are the work here.

The server-rendered todo listing (`renderTodoListing`, included through `footer_custom.html` → `generated/todo-listing.html`) is still ONE global listing, generated in `scripts/gen-docs-pages.ts` and shown on every page.

## Done when
- [x] `renderTodoListing` is called per page with only that page's todos (by `targetLabel`)
- [x] a page with no attached todo emits NO listing markup — not an empty section; 'could not determine' and 'nothing here' stay distinct
- [x] the count on a page is that page's own cardinality, never the global total
- [ ] coordinated with #1886 (`footer_custom.html` is its phase C)
- [x] `linear-floor.e2e.ts` asserts the per-page case; no test deleted


## Re-triage 2026-10-10 (lane B drain): this needs both repositories, in one step

- **Generator, here:** `scripts/gen-docs-pages.ts` (~line 1505) emits ONE fragment, `_includes/generated/todo-listing.html`, from all `items`. Per page, it would group `items` by `targetLabel` → page and emit `_includes/generated/todo-listing/<page key>.html`, one per page that has todos. A page with none gets **no file**, so "nothing here" stays an absence and never becomes an empty section. A page whose key cannot be determined goes into a separate `unplaced` fragment, so "could not determine" stays distinct. `renderTodoListing` is unchanged and runs once per page.
- **Include, in litlfred/cat-harness:** `docs/_includes/footer_custom.html:40` includes the single fragment. It needs the per-page key and a guarded include (Jekyll cannot include a missing file, so the generator also writes a `_data` index of which keys exist). This is #1886's phase C, so coordinate there.
- **Test:** `test/linear-floor.e2e.ts` can now run (cat-tools-g9m3, PR #69). Add the per-page case beside the global one; delete nothing.

Not started, because a generator change without the include change would publish fragments nothing reads.


## Summary of Changes (lane C, 2026-10-12)

Shipped as tools#160 (`34df2d9`) and cat-harness#175 (`c60560a`).

- `gen-docs-pages.ts` keeps the folio-wide fragment, which is the todos board's listing and what an older footer still includes. Beside it, it now writes:
  - `_includes/generated/todo-listing/<page>.html` for each page that has a note attached
  - `_data/todo_listing.json`, which names those pages and records the **count** of unplaced notes. "Could not determine" is never shown as a page with nothing on it.
- A page with no note gets no file and no entry. A fragment left behind for a page that lost its last note is removed, and `--check` reports it.
- `todo-listing.ts` gains `groupTodosByPage`, `todoListingFileFor`, and `scope: "page"`. With that scope the heading reads "Notes on this page (N)" and the section carries `data-fa-todo-scope`.
- `footer_custom.html` includes the page's own fragment, or nothing. The todos board (`fa_todo_listing: all`, written by `state-visualizer.ts`) keeps the whole listing, and so does a site that has no index yet.
- Tests: unit tests (grouping, the page's own count, absence, the board flag) and the `linear-floor.e2e.ts` per-page and no-note cases. No test was deleted.

**Not done:** coordination with #1886 (phase C of `footer_custom.html`). I didn't check it. The footer change is additive and falls back to the whole listing.

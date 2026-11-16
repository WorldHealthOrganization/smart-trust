---
name: folio-file-list
description: >-
  Render a folio at its smallest useful level: the list of files it holds, as
  one just-the-docs page. Use when a folio needs a page and the full viewer is
  not available, when checking that the harness can render the folio it hands
  its dependents, or before adding a file to `folio/` (regenerate the page).
allowed-tools: Read Bash
---

# Folio file list: the harness's minimal folio rendering

Work item `ohx6`, owner ruling 2026-10-10: cat-harness carries its own minimal
renderer, and what it renders is a list of files.

## Run it

```sh
bun run folio:render          # write folio/index.md
bun run folio:render:check    # exit 1 when folio/index.md is stale
```

Regenerate whenever a file under `folio/` is added, removed or resized; the
check fails otherwise.

## What it lists, and what it does not

Every file under `folio/`, recursively and sorted, with its size. Not listed:
the page itself (`index.md`), the renderer's own directory (`render/`) and
dot-files.

## One list, two levels of polish

`folioFileList` in `folio-render/file-list.ts` is the only answer to "which
files does this folio hold". The full folio viewer (cat-harness-tools
`gen-folio-viz.ts`) shows the same list as its 'list' view by calling it, not
by listing again. A second listing would be free to disagree with this one.

## What this is not

Not the just-the-docs pipeline: that stays in the content core. This
writes one page with just-the-docs front matter, which that pipeline or any
Jekyll site can serve, and which reads as a plain table on GitHub.

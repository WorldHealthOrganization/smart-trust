---
name: visual-diff
description: >-
  Pictures of a changed figure, diagram or table, before and after, and how
  much of it changed. Says when to use it, what the percentage means and must
  NOT be read as, what a missing picture means, and how the staging job and
  the review process call it. Use when a reviewer asks "what does this
  figure look like now", when a table's markup diff is unreadable, or when a
  staging preview's pictures are missing.
user_invocable: true
allowed-tools: Read Grep Glob Bash
---

# Visual diff — see a figure change

> Skill id: `visual-diff` · Package: `sdlc-core`

For a figure, a diagram, a table, an equation or a simulator, the change a
reviewer must judge is how the block LOOKS. The Markdown or SVG diff of a
recoloured bar chart is noise. So the staging job pictures each such block on
both sides, and the review page shows the pictures.

For a before/after of anything the staging job does not picture (page
chrome, scroll behaviour, a PDF page, an IG page, a slide), and for the rules
every reviewer-facing pair follows, see
[`before-after-preview`](before-after-preview.md).

## Design rules

- **A Skill and a Tool, built into the processes.** The steps live in the
  `folio-block-screenshots` Tool and in this skill. The staging workflow and
  the review process CALL them; nobody copies them.
- **No new dependency.** The pictures are taken with Playwright, which the
  platform already uses, and the comparison runs in Chromium's own canvas, so
  nothing new needs a licence.
- **One key or one click; never a drag.** The page offers four views as
  radio buttons, not a slider.

## What the reviewer sees

On the review page, a visual block opens on **"Pictures, before and
after"**. It shows:

1. a sentence stating how much changed: "12.3% of the block's pixels
   changed", or "No pixel changed beyond anti-aliasing", or "Only one side
   could be pictured";
2. four views, each one click (or an arrow key):

| view | shows |
|---|---|
| **Changed pixels** | the after picture faded to grey, with every changed pixel marked in magenta |
| **Before** | the block on the published site |
| **After** | the block on this preview |
| **Both** | before and after side by side |

When a build published no pictures, the block opens **side by side** (the
live pages in frames) instead, because the page takes the first view that
can run and lists the block's kind.

## What the percentage means, and must NOT be read as

| it is | it is not |
|---|---|
| the share of the block's pixels, in the larger of the two pictures, that differ by more than a small tolerance (24 of 255 per channel, to absorb anti-aliasing) | whether the change is right. A one-pixel line through a chart can be the whole point |
| counted over the larger picture, so a block that grew counts the new area as changed | a measure of text change: a reworded caption moves many pixels |
| of the **light** theme only | a check of dark mode |

**Zero** means nothing changed that the eye would see. A block the
ChangeSet lists as changed with 0% is still worth a look at its markup:
the change may be in alt text, a label or a link.

## When a picture is missing

A missing picture is **said, never drawn blank**:

| message | means | what to do |
|---|---|---|
| "Not on main: this block is new." | an added block has no before | nothing: there is nothing to compare |
| "Its page is not in the published site" | the before side has no page for the block's document | the document is new, or main was never published. A folio publishes main when its staging caller lists `push` to main; the build log warns when `_main-site.json` is absent |
| "Its anchor is not on the … page" | the page exists, but has no `<a id="<label>">` for the block | the block was renamed without `renamedFrom`, or the build dropped it. Check the `id-stable` QA criterion |

## How a picture is taken

The site build writes an empty `<a id="<label>">` before each labelled
block. There is no element that wraps the block. So a block's picture is the
region from its anchor down to the **next** anchor, as wide as the anchor's
container. A page with anchors out of order pictures the wrong region, so if
a picture looks wrong, check the anchors first.

## The Tool

```sh
# how many blocks would be pictured (no browser needed)
bun run <platform>/cat-harness-tools/scripts/block-screenshots.ts --changeset _site/changeset.json --count

# picture and compare
bun run <platform>/cat-harness-tools/scripts/block-screenshots.ts \
  --changeset _site/changeset.json --base pages --head _site --out _site
```

It writes `visual-diff.json` (`folio-visual-diff/v1`) and `visual/*.png`
next to the site. The review page reads `../visual-diff.json`.

## Where it runs in the processes

- **`folio-staging.yml`**, step "Picture changed figures, diagrams and
  tables". It runs after the step "Choose the before side", which picks:
  - **main's site**, at the publish branch's root, published by the same
    workflow's `publish-main` job on every push to main;
  - **for a stacked PR**, its base branch's preview, `branches/<base-slug>/`,
    so the pictures and the ChangeSet compare with the same branch. When the
    base has no preview, main's site is used and the
    banner, the review page and the PR comment all say so.

  It installs Chromium only when `--count` is above zero.
- **`publish-main`** (same workflow) deletes only files its own manifest,
  `_main-site.json`, lists. `branches/`, `_render-log/` and anything a person
  put at the root are never touched, and the first publish removes nothing.
- **`content-change-review.bpmn`**, task *Compare main vs staging*. The
  reviewer's comparison names this skill beside `staging-review`, so a
  reviewer handed that task is told the pictures exist.

## Tests

- `cat-harness-tools/scripts/tests/block-screenshots.test.ts`: the pixel compare,
  the tolerance, a size change, block selection, and page paths (including
  `..` being refused).
- the tools layer's `test/block-screenshots.e2e.ts`: the whole Tool in Chromium.
  It covers a recoloured block, an unchanged block, a new block, and a
  missing anchor.
- the tools layer's `test/review-visual.e2e.ts`: the renderer, keyboard only.

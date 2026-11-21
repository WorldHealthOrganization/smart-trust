---
name: review-heatmap
description: >-
  The review page's heat map: a section-by-metric table that tells a reviewer
  of a large document where to look first. Says what each column MEANS and
  what it must NOT be read as, where each number comes from, what a column
  says when a build lacks its data, and how the colour was chosen. Use when a
  reviewer or author asks "where do I start", reads a number off the heat map,
  or asks why coverage or QA say "no data"; and before adding a column.
user_invocable: true
allowed-tools: Read Grep Glob
---

# Review heat map — where to look first

> Skill id: `review-heatmap` · Package: `folio-core`

The review page (`review/` in a folio's staging preview) opens with a table.
It has **one row per section**, in reading order, and **one column per
measure**. The darker a cell, the more there is. Every cell also shows its
number, so colour never carries the meaning alone. A section's name moves
focus to that section in the list of changes below it.

It is **not** the block-dependency heat map in `content-graph`. That one
draws which blocks depend on which, for a paper's structure; this one is
about a REVIEW.

## What each column means, and must not be read as

| column | counts | from | must NOT be read as |
|---|---|---|---|
| **Changed blocks** | blocks in the section that the ChangeSet lists: added, removed or changed | `changeset.json` | how much text changed. A one-word edit and a rewrite each count 1. |
| **Open comments** | review comments still `open` or `addressed`, with defects counted in brackets | `review-comments.json` | how bad the section is. One comment may be about the whole section, and a question is not a defect. |
| **Stale comments** | open comments whose block changed AFTER the comment was made (its recorded hash differs from the block's current one) | `review-comments.json` + `blocks.json` | wrong or obsolete. It means **re-read the block before replying**, because the reviewer saw an earlier version. |
| **Review coverage** | "3 of 5 reviewed": the section's added or changed blocks, and how many have a reviewer VERDICT on their **current** version. Shaded by what is still unreviewed. | `review-comments.json`'s `verdicts` + `blocks.json` | "every comment is resolved". **Resolved comments are not a verdict**: a question answered is not a block judged. A verdict on an earlier version is shown on the block and does NOT count, so an edit after review reopens exactly the blocks it touched. A file with no `verdicts` field reads "no data", never "0 reviewed". |
| **QA** | the section's blocks whose latest QA verdicts FAIL (with the worst severity), and those whose verdicts are STALE or that were never audited | `block-qa.json`, published by the `folio-block-qa-summary` Tool after the staging job sweeps the build | a pass. A block counts as failing only on a verdict NEWER than the block; an older verdict makes it stale, and stale outranks passing. A section gets a row for QA alone only if something there fails or is stale. |

**A column with no data says so in every row** ("not published", or "no
data" when a build lacks the file). It is never 0 and never blank: zero
reads as "measured, and nothing there".

Orphaned comments (their block is gone) have no section. They are counted
in a last row, "(listed in no section)", because an open comment is still
open.

## Where the QA column's data comes from

The staging workflow first sweeps the build (its `qa_sweep` input, on by
default), then runs the `folio-block-qa-summary` Tool
(`cat-harness-tools/scripts/publish-block-qa.ts`). The Tool reads each block's
`block-qa/v1` verdicts, runs no checker itself, and writes `block-qa.json`.
So the column reports THIS build's script-checkable criteria. Criteria that
need an agent's judgement are not run by the sweep. Each block is one of:

- **failing**: a fresh verdict failed;
- **stale**: nothing fresh failed, but some verdict predates the block's
  files;
- **passing**: every latest verdict is fresh and none failed;
- **unaudited**: no verdict at all.

**"Passing" says what was judged.** Each block also carries
`needsAgent`: its applicable criteria declared `automated: false` that have
no fresh verdict. Which criteria count comes from each criterion's own
declaration, gated as the sweep gates it (`applies_to`, the folio's active
voices). The column then reads either:
- **"N passing on scripts only (M criteria need an agent)"**; or
- **"passing, every applicable criterion judged"**.

A summary without `needsAgent` reads "passing (this build does not say
whether agent-judged criteria were run)", never "all judged": a verdict never
given is not a pass.

Freshness is the QA sweep's own rule, including the `uses`-graph hash that
graph-scoped criteria depend on; without it every graph-scoped criterion
reads stale straight after a sweep.

The QA sweep writes verdicts under the layer root; the summary also reads,
second, under the directory the sweep was run on, so verdicts an older sweep
wrote there are still found.

## How the colour was chosen

This follows the dataviz skill:
- **Scale.** One hue (blue), sequential, in three ordinal steps. Each
  column is scaled to its own maximum, by thirds; zero has no fill.
- **Light theme:** steps 250 / 400 / 550.
- **Dark theme:** steps 600 / 500 / 400, chosen for the dark surface rather
  than flipped from the light ones.
- **Validation.** Both ramps pass `validate_palette.js --ordinal`: they are
  monotone, their steps are visibly apart, and the lightest clears 2:1
  against the surface.
- **Ink.** Every cell's text colour clears 4.7:1 against its fill.

The table is a real `<table>` with row and column headers, so it is its own
table view for a screen reader. Every cell also has a hover title saying what
it counts.

## Where it lives

- `cat-harness-tools/scripts/review-heat.ts`: `computeHeat` (the numbers),
  `heatBucket` (the thirds) and `renderHeat` (the table). The page embeds
  all three with `toString()`, so the tested functions are the ones that run.
- `blocks.json` carries each block's `section`, so a comment on an
  UNCHANGED block still lands in its section's row.

## Adding a column

1. **Say what it counts and what it must not be read as**, in the table
   above, before writing code.
2. Its data must be **published in the preview**, never read from an
   agent's `/tmp`.
3. Add it to `computeHeat` and `renderHeat`, with a test for its "no data"
   state as well as its numbers.

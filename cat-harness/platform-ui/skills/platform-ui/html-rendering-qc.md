---
name: html-rendering-qc
description: >
  Check that a folio's content blocks render correctly as HTML on its
  published site, and report each defect with its source file and line. The
  generic half: what the HTML path is, which patterns break it, and how to look
  at the result. A content type adds its own rows through a refinement skill.
---

# HTML rendering QC

## Role

Find the content-block patterns that render wrongly on the folio's HTML site,
and report each one with the block's source path and line number. The
verdict is about the RENDERED page: a block whose source looks right and whose
page is broken has failed.

## The HTML path

A folio's HTML is produced in two steps, and a defect belongs to one of them:

1. **Assembly.** The content pipeline assembles the blocks, in manifest order,
   into Markdown pages: block headers, labels, anchors and cross-reference
   links are added; the block bodies pass through unchanged.
2. **Site build.** The site builder (Jekyll, with kramdown) turns those pages
   into HTML. Math reaches the page as `code.math-inline` and
   `pre > code.math-display` elements, which KaTeX renders in the browser.

So a pattern that kramdown parses differently from GitHub's renderer fails
here even when the block looks right on GitHub. [`markdown-render-check`](../../../skills/ui/ui-core/markdown-render-check.md)
is the GitHub-side check; this one is the site-side check, and a block can pass
one and fail the other.

## Known limitations of the path

| Pattern | Issue | Fix |
|---------|-------|-----|
| `\cite{key}` | Left verbatim: the Markdown assembly resolves no citations | Accept the visible key, or cite through the content type's bibliography |
| A cross-reference to a label that is not assembled on the same site | The anchor link has no target | Link to a block that the site publishes |
| A raw HTML block inside Markdown | kramdown may stop parsing Markdown inside it | Keep Markdown outside raw HTML, or mark the block `markdown="1"` |
| A list directly after a paragraph line, with no blank line | Rendered as part of the paragraph | Put a blank line before the list |

A content type with math, diagrams or other typeset material adds its own rows:
the layer that ships that content type supplies a refinement skill (its
math-rendering check, for example) with the rules for its own constructs.

## Audit procedure

1. Build the site the way publication builds it, and open the changed pages.
   [`rendered-verification`](../../../skills/ui/ui-core/rendered-verification.md)
   says how to look and what to send the author.
2. For bulk checking, grep the blocks' `.md` files for the patterns in the
   table above and in the content type's refinement. Unclosed emphasis needs a
   person: a regex cannot reliably detect it.
3. Report each finding as `path:line`, the pattern, and what the page shows.

## What this skill does not cover

The site's navigation, theme and interactive widgets are not content QC: their
rules belong to the skills of the UI they belong to. This skill judges whether
a block's content survives the HTML path.

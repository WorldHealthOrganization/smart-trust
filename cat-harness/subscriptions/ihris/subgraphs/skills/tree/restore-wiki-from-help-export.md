---
name: restore-wiki-from-help-export
description: >
  Restore iHRIS wiki pages from MediaWiki HTML exports found inside release
  tarballs (the manage-help / qualify-help modules) or elsewhere, into
  library/ihris-wiki as Markdown sections de-duplicated by title.
input: src/schemas/skills/restore-wiki-from-help-export/input.schema.json
output: src/schemas/skills/restore-wiki-from-help-export/output.schema.json
---

# Restore wiki pages from an HTML export

The iHRIS 4.x help modules ship **MediaWiki page exports** of the *Osi* wiki's
user manual. `<title>` ends in ` - Osi`, and the article body is `#bodyContent`.
The same page often ships twice (Manage and Qualify) and in two editions
(`x.html`, `x_4.0.html`).

## Rules

- **One section per page title**, slugged. If two copies differ after
  conversion, keep both (`--variant-N`). Never pick one silently.
- Front matter records every file that shipped the page (`shippedIn`) and the
  licence it came under.
- Strip MediaWiki chrome (`#jump-to-nav`, `#siteSub`, `#toc`, `.printfooter`,
  `.catlinks`) before converting with `markdownify`.
- Do not "fix" the prose. It is a restoration, and editorial changes belong in
  a folio that cites it.

Known follow-up: links still point at the original `ihris_*.html` filenames
and should be rewritten to section ids.

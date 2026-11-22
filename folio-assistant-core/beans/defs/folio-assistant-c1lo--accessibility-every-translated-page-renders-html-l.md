---
# folio-assistant-c1lo
$schema: bean/1.0.0
title: 'ACCESSIBILITY: every translated page renders <html lang="en-US"> — the layout ignores the page''s lang, and Arabic gets no dir="rtl"'
status: scrapped
type: bug
priority: high
created_at: 2026-09-30T11:56:26Z
updated_at: 2026-09-30T12:45:37Z
parent: folio-assistant-o3xy
---

Found 2026-09-30 building the site locally (bean c592) and reading the rendered HTML, not the markdown.

Measured on a preview-site build of this branch: fr/index.html, ar/index.html and ar/glossary/index.html all open with <html lang="en-US">, and no page carries dir="rtl". The markdown declares lang: fr / lang: ar in front matter; the just-the-docs layout never reads it. Pre-existing and site-wide — every translated page, not only the new glossary ones.

Why it is high: WCAG 2.2 SC 3.1.1 (Language of Page) is Level A. A screen reader reads the French and Chinese pages with English pronunciation rules, and Arabic lays out left-to-right. The repository's own rule (bean gjli) is that UI follows accessibility guidelines.

## Done when
- [ ] the rendered <html> carries lang from the page's front matter (site default otherwise)
- [ ] ar pages carry dir="rtl" (and the navbar/tables survive it — look at a built page, not the markdown)
- [ ] a check over a BUILT site (preview-site output), since the defect is invisible in the source



## Scrapped 2026-09-30: a false finding, and a duplicate of the fixed `zru7`
The measurement above was made on a `preview-site.sh` build, which did not run CI's post-build pass `set-html-lang.ts`. Bean `zru7` added that pass on 2026-09-27, and it deliberately rejected a layout override because it would vendor the pinned theme. On a real build of this branch, after that pass, `ar/glossary/` is `<html lang="ar" dir="rtl">` and `fr/glossary/` and `zh/glossary/` are `lang="fr"` and `lang="zh"`. `--check` reports 0 pages to correct out of 1355 that declare a locale.
The cause was the preview, not the site. `preview-site.sh` now runs `set-html-lang.ts` after the mount, as CI does, so the next local build does not show this defect again.

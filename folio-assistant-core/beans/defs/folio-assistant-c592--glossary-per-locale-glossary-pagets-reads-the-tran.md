---
# folio-assistant-c592
$schema: bean/1.0.0
title: 'GLOSSARY PER LOCALE: glossary-page.ts reads the translated .po catalogues and renders each locale''s terms'
status: completed
type: task
priority: normal
created_at: 2026-09-30T09:07:22Z
updated_at: 2026-09-30T11:56:26Z
parent: folio-assistant-lqo9
---

The one unchecked item of epic lqo9's Done when, split out 2026-09-30 so the epic's open work is a bean rather than a line: 'Labels and definitions are extracted to .pot like BPMN labels [done] ... and render per locale (next step: needs the glossary page to read the .po, which is a change to glossary-page.ts)'.

Surfaced by check:bean-rollup once lqo9's last two children (ftu0, x5o1) closed: an epic at todo with no open child asserts work its own subtree denies. The work IS still live; it had no bean.

## Done when
- [ ] folio-assistant-core/scripts/glossary-page.ts reads the glossary .po for each locale that has one and renders translated prefLabel / definition per locale
- [ ] an untranslated term shows the source text marked as untranslated, never silently English
- [ ] check:glossary covers the per-locale pages


## Measured 2026-09-30, before building — nothing to render yet
20 glossary templates exist (cat-harness/translations/<locale>/glossary/*.pot — incl. who-style-guide--who-terms.pot), and **no translated .po beside any of them**. (cat-harness/translations/<locale>/glossary.po is a different file: terminology hints for translation-block-qa.) Building per-locale rendering now would publish five locales in which every term reads 'untranslated'. Whether to build the rendering ahead of translations, or wait for the first .po, is put to the owner.


## Summary of changes (2026-09-30) — owner: 'do full translation, show it all works, do the builds, all machinery/tools/skills/assets'
- **Translations**: 20 .po files (62 glossary terms × ar, es, fr, ru, zh — 310 entries) plus the locale page's own strings (glossary-page.pot/.po, 14 × 5). UNOFFICIAL and agent-drafted, following the repository's precedent (header + 'Last-Translator: folio-assistant agent (drafted, unofficial)'; issue #206 = human sign-off). Code, identifiers and standard names kept; one rendering per defined term per locale. Every file read back by the repo's own parsePo: 310/310 non-empty.
- **Machinery**: glossary-page.ts readGlossaryTranslations (through glossary-pot's own potPath), renderLocalePage (the SOURCE page's structure, so translation:drift passes; a missing translation shows the source marked _(untranslated)_), withTranslations (published SKOS carries prefLabel/definition per @language — verified: 6 languages on quality-of-the-evidence). glossary-pot writes the page-strings template (ui-string entries, the kg-viewer-strings pattern). check:glossary covers the pages, the SKOS and orphans; glossary:pot:check the templates.
- **Latent defect fixed on the way**: glossary-pot never declared a PotEntryKind (required since 2026-09-27) and compiled only because folio-assistant-core/scripts is outside tsconfig's include; pot-extract gains 'glossary-term'.
- **Skill**: glossary-terms §'Translations and the per-locale pages'.
- **Tests**: glossary.test.ts +3 (untranslated marked, never dropped; a translation reaches page and SKOS; the shipped locales translate every authored term).
- **Built**: preview-site builds; ar/fr/zh glossary pages render with translated headings (read from the built HTML).
- **Not done, recorded**: scheme TITLES stay in English (only term strings are templated); and the built pages say <html lang="en-US"> — site-wide, pre-existing, filed as its own high-priority accessibility bug.

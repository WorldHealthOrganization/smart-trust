---
$schema: folio-memory/v1
id: locale-directories-are-declared-not-inferred
label: trap
summary: "a page is a translation because it declares `lang`, never because of its directory's name"
createdAt: 2026-09-19
roles:
  - code-reviewer
references:
  - kind: agent
    id: platform-boundary-guard
---
`docs/fr/index.md` is French because it carries `lang: fr` and
`translation_source: index.md`. **Never** match a directory name against a
list of language subtags: a `no/` chapter is hidden, a `translated-fr/` one is
shown as source, and neither announces itself. Do **not** add a graph typology for
translated content — a translation is the same kind of thing as the page it
translates, differing by a field the FILE declares. Translatability is a
property of a FORMAT within a content type (`schemas/translation-tools.ts`,
`isTranslatable`), per the owner: *"its not so much the node schema itself but
its content (e.g. markdown, bpmn) should be translatable"*. `nav_exclude: true`
is the half JS cannot do — just-the-docs builds the nav once, for every
reader, before anybody picks a locale. Full rule:
`skills/library/library-core/translation-manager.md#the-navbar-filters-by-locale`.

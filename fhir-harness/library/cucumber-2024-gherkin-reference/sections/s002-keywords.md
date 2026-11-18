---
doc_id: cucumber-2024-gherkin-reference
doc_title: "Gherkin Reference"
section_id: s002-keywords
section_title: "Keywords"
file: "content/docs/gherkin/reference.md"
lines: 40-64
source_sha256: 50bdb1f828b4178c
granularity: heading
---
# Keywords

Each line that isn't a blank line has to start with a Gherkin *keyword*, followed by any text you like. The only exceptions are the free-form descriptions placed underneath `Example`/`Scenario`, `Background`, `Scenario Outline` and `Rule` lines.

The primary keywords are:

- [`Feature`](#feature)
- [`Rule`](#rule) (as of Gherkin 6)
- [`Example`](#example) (or `Scenario`)
- [`Given`](#given), [`When`](#when), [`Then`](#then), [`And`](#and-but), [`But`](#and-but) for steps (or [`*`](#Asterisk))
- [`Background`](#background)
- [`Scenario Outline`](#scenario-outline) (or [`Scenario Template`](#scenario-outline))
- [`Examples`](#examples) (or [`Scenarios`](#examples))

There are a few secondary keywords as well:

- `"""` (Doc Strings)
- `|` (Data Tables)
- `@` (Tags)
- `#` (Comments)

{{% note "Localisation"%}}
Gherkin is localised for many [spoken languages](#spoken-languages); each has their own localised equivalent of these keywords.
{{% /note %}}

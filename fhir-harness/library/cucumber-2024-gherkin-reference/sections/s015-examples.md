---
doc_id: cucumber-2024-gherkin-reference
doc_title: "Gherkin Reference"
section_id: s015-examples
section_title: "Examples"
file: "content/docs/gherkin/reference.md"
lines: 419-433
source_sha256: 50bdb1f828b4178c
granularity: heading
---
### Examples

A `Scenario Outline` must contain one or more `Examples` (or `Scenarios`) section(s). Its steps are interpreted as a 
template
which is never directly run. Instead, the `Scenario Outline` is run *once for each row* in
the `Examples` section beneath it (not counting the first header row).

The steps can use `<>` delimited *parameters* that reference headers in the examples table.
Cucumber will replace these parameters with values from the table *before* it tries
to match the step against a step definition.

You can use parameters in `Scenario Outline` descriptions as well.

You can also use parameters in [multiline step arguments](#step-arguments).

---
doc_id: cucumber-2024-gherkin-reference
doc_title: "Gherkin Reference"
section_id: s018-data-tables
section_title: "Data Tables"
file: "content/docs/gherkin/reference.md"
lines: 493-505
source_sha256: 50bdb1f828b4178c
granularity: heading
---
## Data Tables

`Data Tables` are handy for passing a list of values to a step definition:

```gherkin
Given the following users exist:
  | name   | email              | twitter         |
  | Aslak  | aslak@cucumber.io  | @aslak_hellesoy |
  | Julien | julien@cucumber.io | @jbpros         |
  | Matt   | matt@cucumber.io   | @mattwynne      |
```
Just like `Doc Strings`, `Data Tables` will be passed to the step definition as the last argument.

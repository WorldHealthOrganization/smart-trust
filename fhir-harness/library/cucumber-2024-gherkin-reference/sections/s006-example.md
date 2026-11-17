---
doc_id: cucumber-2024-gherkin-reference
doc_title: "Gherkin Reference"
section_id: s006-example
section_title: "Example"
file: "content/docs/gherkin/reference.md"
lines: 146-163
source_sha256: 50bdb1f828b4178c
granularity: heading
---
## Example

This is a *concrete example* that *illustrates* a business rule. It consists of
a list of [steps](#steps).

The keyword `Scenario` is a synonym of the keyword `Example`.

You can have as many steps as you like, but we recommend 3-5 steps per example. Having too many steps will cause the example to lose its expressive power as a specification and documentation.

In addition to being a specification and documentation, an example is also a *test*. As a whole, your examples are an
*executable specification* of the system.

Examples follow this same pattern:

- Describe an initial context (`Given` steps)
- Describe an event (`When` steps)
- Describe an expected outcome (`Then` steps)

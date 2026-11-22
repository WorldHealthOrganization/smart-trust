---
doc_id: cucumber-2024-gherkin-reference
doc_title: "Gherkin Reference"
section_id: s008-given
section_title: "Given"
file: "content/docs/gherkin/reference.md"
lines: 189-207
source_sha256: 50bdb1f828b4178c
granularity: heading
---
### Given

`Given` steps are used to describe the initial context of the system - the *scene* of the scenario.
It is typically something that happened in the *past*.

When Cucumber executes a `Given` step, it will configure the system to be in a well-defined state,
such as creating and configuring objects or adding data to a test database.

The purpose of `Given` steps is to **put the system in a known state** before the user (or external system) starts interacting with the system (in the `When` steps).
Avoid talking about user interaction in `Given`'s. If you were creating use cases, `Given`'s would be your preconditions.

It's okay to have several `Given` steps (use `And` or `But` for number 2 and upwards to make it more readable).

Examples:

- Mickey and Minnie have started a game
- I am logged in
- Joe has a balance of £42

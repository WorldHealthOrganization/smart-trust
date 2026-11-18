---
doc_id: cucumber-2024-gherkin-reference
doc_title: "Gherkin Reference"
section_id: s010-then
section_title: "Then"
file: "content/docs/gherkin/reference.md"
lines: 227-246
source_sha256: 50bdb1f828b4178c
granularity: heading
---
### Then

`Then` steps are used to describe an *expected* outcome, or result.

The [step definition](/docs/cucumber/step-definitions) of a `Then` step should use an *assertion* to
compare the *actual* outcome (what the system actually does) to the *expected* outcome
(what the step says the system is supposed to do).

An outcome *should* be on an **observable** output. That is, something that comes *out* of the system (report, user interface, message), and not a behaviour deeply buried inside the system (like a record in a database).

Examples:

- See that the guessed word was wrong
- Receive an invitation
- Card should be swallowed

While it might be tempting to implement `Then` steps to look in the database - resist that temptation!

You should only verify an outcome that is observable for the user (or external system), and changes to a database are usually not.

---
doc_id: cucumber-2024-gherkin-reference
doc_title: "Gherkin Reference"
section_id: s009-when
section_title: "When"
file: "content/docs/gherkin/reference.md"
lines: 208-226
source_sha256: 50bdb1f828b4178c
granularity: heading
---
### When

`When` steps are used to describe an event, or an *action*. This can be a person interacting with the system, or it can be an event triggered by another system.

Examples:

- Guess a word
- Invite a friend
- Withdraw money

{{% note "Imagine it's 1922" %}}
Most software does something people could do manually (just not as efficiently).

Try hard to come up with examples that don't make any assumptions about
technology or user interface. Imagine it's 1922, when there were no computers.

Implementation details should be hidden in the [step definitions](/docs/cucumber/step-definitions).
{{% /note %}}

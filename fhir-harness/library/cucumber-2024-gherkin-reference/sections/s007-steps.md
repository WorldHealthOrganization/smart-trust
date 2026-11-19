---
doc_id: cucumber-2024-gherkin-reference
doc_title: "Gherkin Reference"
section_id: s007-steps
section_title: "Steps"
file: "content/docs/gherkin/reference.md"
lines: 164-188
source_sha256: 50bdb1f828b4178c
granularity: heading
---
## Steps

Each step starts with `Given`, `When`, `Then`, `And`, or `But`.

Cucumber executes each step in a scenario one at a time, in the sequence you’ve written them in.
When Cucumber tries to execute a step, it looks for a matching step definition to execute.

Keywords are not taken into account when looking for a step definition. This means you cannot have a
`Given`, `When`, `Then`, `And` or `But` step with the same text as another step.

Cucumber considers the following steps duplicates:

```gherkin
Given there is money in my account
Then there is money in my account
```

This might seem like a limitation, but it forces you to come up with a less ambiguous, more clear
domain language:

```gherkin
Given my account has a balance of £430
Then my account should have a balance of £430
```

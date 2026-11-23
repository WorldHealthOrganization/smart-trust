---
doc_id: cucumber-2024-gherkin-reference
doc_title: "Gherkin Reference"
section_id: s005-rule
section_title: "Rule"
file: "content/docs/gherkin/reference.md"
lines: 107-145
source_sha256: 50bdb1f828b4178c
granularity: heading
---
## Rule

The (optional) `Rule` keyword has been part of Gherkin since v6. 

{{% note "Cucumber Support for Rule"%}}
The `Rule` keyword is still pretty new. It has been ported in a lot of Cucumber implementation already.
Yet if you encounter issues, check the documentation of your Cucumber implementation to make sure it supports it.
{{% /note %}}

The purpose of the `Rule` keyword is to represent one *business rule* that should be implemented.
It provides additional information for a feature.
A `Rule` is used to group together several scenarios
that belong to this *business rule*. A `Rule` should contain one or more scenarios that illustrate the particular rule.

For example:

```gherkin
# -- FILE: features/gherkin.rule_example.feature
Feature: Highlander

  Rule: There can be only One

    Example: Only One -- More than one alive
      Given there are 3 ninjas
      And there are more than one ninja alive
      When 2 ninjas meet, they will fight
      Then one ninja dies (but not me)
      And there is one ninja less alive

    Example: Only One -- One alive
      Given there is only 1 ninja alive
      Then he (or she) will live forever ;-)

  Rule: There can be Two (in some cases)

    Example: Two -- Dead and Reborn as Phoenix
      ...
```

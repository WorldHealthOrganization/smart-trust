---
doc_id: cucumber-2024-gherkin-reference
doc_title: "Gherkin Reference"
section_id: s001-gherkin-reference
section_title: "Gherkin Reference"
file: "content/docs/gherkin/reference.md"
lines: 1-39
source_sha256: 50bdb1f828b4178c
granularity: heading
---
---
title: Gherkin Reference
subtitle: "Cucumber syntax: Given, When, Then"
---
Gherkin uses a set of special [keywords](#keywords) to give structure and meaning to
executable specifications. Each keyword is translated to many spoken languages;
in this reference we'll use English.

Most lines in a Gherkin document start with one of the [keywords](#keywords).

Comments are only permitted at the start of a new line, anywhere in the feature file. They begin with zero or more spaces,
followed by a hash sign (`#`) and some text.

Block comments are currently not supported by Gherkin.

Either spaces or tabs may be used for indentation. The recommended indentation
level is two spaces. Here is an example:

```gherkin
Feature: Guess the word

  # The first example has two steps
  Scenario: Maker starts a game
    When the Maker starts a game
    Then the Maker waits for a Breaker to join

  # The second example has three steps
  Scenario: Breaker joins a game
    Given the Maker has started a game with the word "silky"
    When the Breaker joins the Maker's game
    Then the Breaker must guess a word with 5 characters
```

The trailing portion (after the keyword) of each step is matched to
a code block, called a [step definition](/docs/cucumber/step-definitions).

Please note that some keywords *are* followed by a colon (`:`) and some *are not*. If you add a colon after a keyword
that should not be followed by one, your test(s) will be ignored.

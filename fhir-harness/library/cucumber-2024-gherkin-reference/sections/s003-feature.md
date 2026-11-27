---
doc_id: cucumber-2024-gherkin-reference
doc_title: "Gherkin Reference"
section_id: s003-feature
section_title: "Feature"
file: "content/docs/gherkin/reference.md"
lines: 65-97
source_sha256: 50bdb1f828b4178c
granularity: heading
---
## Feature

The purpose of the `Feature` keyword is to provide a high-level description
of a software feature, and to group related scenarios.

The first primary keyword in a Gherkin document must always be `Feature`, followed
by a `:` and a short text that describes the feature.

You can add free-form text underneath `Feature` to add more description.

These description lines are ignored by Cucumber at runtime, but are available for reporting (they are included by reporting tools like the official HTML formatter).

```gherkin
Feature: Guess the word

  The word guess game is a turn-based game for two players.
  The Maker makes a word for the Breaker to guess. The game
  is over when the Breaker guesses the Maker's word.

  Example: Maker starts a game
```

The name and the optional description have no special meaning to Cucumber. Their purpose is to provide
a place for you to document important aspects of the feature, such as a brief explanation
and a list of business rules (general acceptance criteria).

The free format description for `Feature` ends when you start a line with the keyword `Background`, `Rule`, `Example` or `Scenario Outline` (or their alias keywords).

You can place [tags](/docs/cucumber/api/#tags) above `Feature` to group related features,
independent of your file and directory structure.

You can only have a single `Feature` in a `.feature` file.

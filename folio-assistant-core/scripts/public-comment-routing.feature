Feature: routing public comments to a technical working group

  @test:scripts/public-comment-routing.test.ts::public-comment-routing::fixedCategoriesAndAliases
  Scenario: only the eight fixed categories, and unambiguous aliases, name a group
    When category labels are mapped to a group
    Then a fixed category in any case and spacing, and an unambiguous alias, name their group
    And an unknown label and an editorial maybe name none

  @test:scripts/public-comment-routing.test.ts::public-comment-routing::humanOverridesAi
  Scenario: a human categorisation overrides the AI one
    When routing is read from AI and human columns
    Then the human column wins over the AI one
    And the AI column is used alone, and other columns or none give no routing

  @test:scripts/public-comment-routing.test.ts::public-comment-routing::primaryAndSecondary
  Scenario: 'A/ B' is a primary and a secondary; a value naming no category is kept raw
    When "Core architects/ WHO" and "HWF team" are routed
    Then the first gives a primary and a secondary group
    And the second names no group and keeps the raw value

  @test:scripts/public-comment-routing.test.ts::public-comment-routing::changeSetPlurality
  Scenario: a change-set takes its comments' plurality; ties go to the more specific domain
    When a change-set's routing is derived from its comments, with and without an override
    Then it takes the plurality, ties going to the more specific domain, with routed, unmapped and total counts
    And a change-set with no routed comment has no group
    And an override sets the group and keeps the derived one

  @test:scripts/public-comment-routing.test.ts::public-comment-routing::routingJsonFillsGaps
  Scenario: routing.json fills what the log left uncategorised; a person's entry beats the log's AI column
    When routing.json entries are combined with the log's columns
    Then an agent's entry fills an uncategorised comment with its confidence and rationale
    And the log's AI column beats an agent's entry
    And a person's entry beats the AI column, and the log's human column beats a person's entry

  @test:scripts/public-comment-routing.test.ts::public-comment-routing::personRulesUnmappedLabel
  Scenario: a person's entry rules on a human label that names no category
    When a human label naming no category is combined with a person's and an agent's entry
    Then the person's entry rules
    And the agent's entry does not

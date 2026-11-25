Feature: C-value candidate terms from prose

  @test:scripts/c-value.test.ts::cValues::reproducesTable2
  Scenario: the measure reproduces the paper's worked example
    When the n-grams of Table 2 of Frantzi & Ananiadou 1996 are scored
    Then every C-value matches the table

  @test:scripts/c-value.test.ts::cValues::wallStreetNestingMatchesThePaper
  Scenario: the nesting counts match the paper's step 6
    When "Wall Street" is scored
    Then it is nested 30 times in 6 longer candidates

  @test:scripts/c-value.test.ts::counting::segmentsStopAtPunctuationAndSkipCode
  Scenario: n-grams do not cross punctuation or code
    When prose with a comma, a code span and a blank line is split
    Then each clause is its own run of words

  @test:scripts/c-value.test.ts::counting::articleEndingNgramsAreDropped
  Scenario: n-grams ending in an article are dropped, as the paper did
    When "see the cat" is counted
    Then "see the" is not a candidate

  @test:scripts/c-value.test.ts::counting::nestedTermScoresZeroAsPublished
  Scenario: a term seen only inside longer candidates scores zero, as published
    When "knowledge graph" occurs only after "a" or "the"
    Then it is not ranked, and no ranked score is zero

  @test:scripts/c-value.test.ts::counting::edgeStopwordsLetTheNestedTermThrough
  Scenario: the edge-stopword option drops function-word edges
    When a text where "knowledge graph" follows "a" twice is ranked with and without the option
    Then it scores 1 as published and 3, the top score, with the option

  @test:scripts/c-value.test.ts::counting::frontMatterIsNotProse
  Scenario: YAML front matter is not counted
    When a Markdown file with front matter is split
    Then only the body's words remain

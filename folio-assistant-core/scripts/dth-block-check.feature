Feature: checking the blocks of a digital transformation handbook

  @test:scripts/dth-block-check.test.ts::lanesOf::lanesOfReadsRefs
  Scenario: reads lane ids and partitionElementRef, with or without a prefix
    When lanes with and without a prefix are read
    Then each gives its id and partitionElementRef, or none

  @test:scripts/dth-block-check.test.ts::check::alignedDthPasses
  Scenario: passes a DTH whose personas, lanes and tables line up
    When a DTH whose personas, lanes and tables line up is checked
    Then there are no errors and the counts are one each, with rules

  @test:scripts/dth-block-check.test.ts::check::personaMissingLinksFlagged
  Scenario: flags a persona with missing links, and a lane bound to someone else
    When a persona lacks its links and a lane names someone else
    Then the errors name each missing link, the wrong partitionElementRef and the undeclared persona

  @test:scripts/dth-block-check.test.ts::check::laneWithoutRefFlagged
  Scenario: flags a process lane with no partitionElementRef
    When a lane has no partitionElementRef
    Then the only error names that lane

  @test:scripts/dth-block-check.test.ts::check::tableWithoutPassageFlagged
  Scenario: flags a decision table that cites no passage, or a missing one
    When a decision table cites no passage, and one cites a missing passage
    Then each is flagged

  @test:scripts/dth-block-check.test.ts::check::proseRepeatingSectionTableFlagged
  Scenario: A prose block that repeats its section's table as flattened PDF text is flagged
    Given a section holding a prose block and a table block
    When the prose is only an intro paragraph
    Then the check reports no error
    When the prose repeats the table's header rows as run-on text
    Then one error is reported per repeated table header, naming the table block

  @test:scripts/dth-block-check.test.ts::repeatedTableMarkers::repeatedTableMarkersMatchSectionTables
  Scenario: Section block lists are extracted and flattened markers matched against section tables
    Given chapter source with two section() calls
    Then each section's block list is extracted
    And a run-on header is a repeated marker only when a section table has that header

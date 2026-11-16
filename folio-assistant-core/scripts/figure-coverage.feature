Feature: how far a folio covers its source's figures

  @test:scripts/figure-coverage.test.ts::figureNumbers::figureNumbersRead
  Scenario: reads Fig., Fig and Figure, and combined captions
    When captions are read for figure numbers
    Then Fig., Fig, Figure and combined captions give their numbers
    And a word starting Fig gives none

  @test:scripts/figure-coverage.test.ts::coverage_states::missingFigureFails
  Scenario: a declared figure with no block is missing, and fails
    When figure 2 is declared with no block
    Then it is missing and the exit code is 1

  @test:scripts/figure-coverage.test.ts::coverage_states::signedExclusionExcluded
  Scenario: a signed-off block exclusion is excluded; an unsigned one stays missing
    When a block exclusion is signed off, and one is not
    Then the signed one is excluded with exit code 0
    And the unsigned one stays missing

  @test:scripts/figure-coverage.test.ts::coverage_states::statesOrdered
  Scenario: orders picture < linked < computable, and cited by a rebuild exclusion
    When blocks give pictures, a linked view, an ArchiMate view, a table and a signed rebuild exclusion
    Then the states are picture, linked, computable, computable and cited
    And the exit code is 0, and 1 when strict

  @test:scripts/figure-coverage.test.ts::coverage_states::reproducesIsLinked
  Scenario: a block that names the figure it reproduces is linked (core#486)
    When a block names the figure it reproduces and another does not
    Then the first is linked and the second a picture

  @test:scripts/figure-coverage.test.ts::coverage_states::reportsUndeclaredAndBadExclusion
  Scenario: reports blocks naming undeclared figures, and bad exclusions
    When a block names an undeclared figure and an exclusion has a bad scope
    Then the undeclared figure and one problem are reported, exit code 1

  @test:scripts/figure-coverage.test.ts::end_to_end::endToEndReadsEntryAndFolio
  Scenario: reads an entry's sections and a folio's blocks
    Given an entry with two figures and a folio with one figure block
    When the script runs
    Then the folio's blocks name figure 1
    And it exits 1 reporting one picture and one missing

  @test:scripts/figure-coverage.test.ts::end_to_end::reproducesNeedsSourceAndComponent
  Scenario: reads meta.reproduces only when it names a source and a component
    When blocks with a full and a partial reproduces are read
    Then only the full one counts as reproducing

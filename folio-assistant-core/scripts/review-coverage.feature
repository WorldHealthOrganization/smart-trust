Feature: the review coverage gate's facts

  @test:scripts/review-coverage.test.ts::buildCoverage::oneUnreadOneDefect
  Scenario: gives the gate's facts: one block unread, one defect open
    When the coverage is built
    Then one block is uncovered and one defect open, with the rendered half absent

  @test:scripts/review-coverage.test.ts::buildCoverage::editReopensBlock
  Scenario: an edit after the verdict reopens that block
    When a block is edited after its verdict
    Then both blocks are uncovered and the verdict is stale

  @test:scripts/review-coverage.test.ts::the_rendered_half_(bean_bnjs)::renderedKnown
  Scenario: every fact is supplied, and the counts are KNOWN when the build published them
    When the coverage is built with the build's rendered facts
    Then every fact is known, with one unreviewed page, one undetermined input and one missed page

  @test:scripts/review-coverage.test.ts::the_rendered_half_(bean_bnjs)::pinsIncludeMissedPages
  Scenario: the pins a page or input verdict may be recorded against include missed pages
    When the pins verdicts may be recorded against are listed
    Then pages include the missed page and inputs list the config

  @test:scripts/review-coverage.test.ts::the_command::commandPrintsFacts
  Scenario: prints only the facts on stdout
    When the command runs
    Then it exits 0 and prints only the facts

  @test:scripts/review-coverage.test.ts::the_command::refusesBaseBranchCommit
  Scenario: refuses to commit verdicts on the base branch, and writes nothing
    When the command commits on the base branch
    Then it exits 1 naming the FEATURE branch and writes nothing

  @test:scripts/review-coverage.test.ts::the_command::commitsOnFeature
  Scenario: commits them on a feature branch, and a second run finds nothing new
    When the command commits on a feature branch, twice
    Then the verdict file is committed once
    And the second run finds nothing new

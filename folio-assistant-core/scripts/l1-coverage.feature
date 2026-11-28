Feature: how far an L1 extraction covers its source's normative sentences

  @test:scripts/l1-coverage.test.ts::the_marker_list_is_closed_(contract_§1)::countsListedMarkers
  Scenario: counts obligation, recommendation, negation and the listed permission forms
    When markers are read from sentences with should, recommends, may be given and is not
    Then they are obligation, recommendation, permission and negation

  @test:scripts/l1-coverage.test.ts::the_marker_list_is_closed_(contract_§1)::shouldNotIsNegationBareMayNone
  Scenario: `should not` is not also `should`, and bare `may` is not a marker
    When "It should not be given." and "This may be associated with fever." are read
    Then the first is negation only and the second has no marker

  @test:scripts/l1-coverage.test.ts::coverage::capturedUnaccountedPerPage
  Scenario: captured, unaccounted, and per-page figures
    When the coverage of the fixture is computed
    Then 5 sentences are normative, 3 captured and 2 unaccounted
    And page 1 is 100% captured and page 3 has no percentage
    And the exit code is 1

  @test:scripts/l1-coverage.test.ts::coverage::signedExclusionAccounts
  Scenario: a SIGNED-OFF exclusion accounts for a sentence; a proposed one does not
    When one exclusion is proposed, then two are signed off
    Then the proposed one leaves its sentence unaccounted
    And signed off, everything is accounted for, 60% captured, exit code 0

  @test:scripts/l1-coverage.test.ts::coverage::refusesBadReasons
  Scenario: refuses a reason outside the fixed list, and a duplicate-of that resolves to nothing
    When exclusion reasons outside the list and a duplicate-of naming nothing are checked
    Then each is a problem, and a duplicate-of naming a captured statement is not
    And an exclusion with reason "boring" is one problem and the exit code is 1

  @test:scripts/l1-coverage.test.ts::coverage::noNormativeExitZero
  Scenario: no normative sentence at all: exit 0, null percentages
    When a text with no normative sentence is covered
    Then the percentages are null and the exit code is 0

  @test:scripts/l1-coverage.test.ts::inputs::formFeedPages
  Scenario: form-feed plain text is pages numbered from 1
    When form-feed text is read
    Then it gives pages 1, 2 and 3

  @test:scripts/l1-coverage.test.ts::inputs::sentenceSplit
  Scenario: sentences split at terminal punctuation followed by a capital
    When "One. Two words.\nThree?" is split
    Then it gives three sentences

  @test:scripts/l1-coverage.test.ts::CLI::cliExitsBelowTarget
  Scenario: exits 1 below target and writes the §4 shape
    When the CLI runs on the fixture
    Then it exits 1 and writes a report with every section and the source's sha256

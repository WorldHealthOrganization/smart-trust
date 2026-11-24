Feature: SDC checks of an IG's Questionnaires

  @test:scripts/sdc-checks.test.ts::assemble::assembleRootWritesOut
  Scenario: a root whose sub-forms are in this IG assembles, and --out writes it
    Given a root Questionnaire whose sub-form is in the IG
    When the checks run for it with an output directory
    Then assemble passes at error severity
    And the assembled Questionnaire is written

  @test:scripts/sdc-checks.test.ts::assemble::missingSubformFails
  Scenario: a sub-form this IG does not hold fails, and fails the run
    Given a root Questionnaire whose sub-form the IG does not hold
    Then assemble fails and the run exits 1

  @test:scripts/sdc-checks.test.ts::assemble::nonRootNotApplicable
  Scenario: a Questionnaire that is not a root is not-applicable, never a pass
    Given a Questionnaire that is not a root
    Then assemble is not applicable

  @test:scripts/sdc-checks.test.ts::template_extraction_and_population,_against_the_IG's_fixtures::extractPopulatePass
  Scenario: both pass when the libraries produce what the fixtures expect
    Given a Questionnaire and fixtures the libraries meet
    Then template extraction and population pass

  @test:scripts/sdc-checks.test.ts::template_extraction_and_population,_against_the_IG's_fixtures::unmetExpectationNamed
  Scenario: an expectation the libraries do not meet is a failure that names it
    Given fixtures expecting a Condition to be extracted and a name to be populated that the libraries do not produce
    Then template extraction fails, saying the expected Condition was not extracted
    And population's finding names the item "name"

  @test:scripts/sdc-checks.test.ts::template_extraction_and_population,_against_the_IG's_fixtures::noFixtureSaid
  Scenario: no fixture is said, never passed
    Given a Questionnaire with no fixtures
    Then template extraction and population are "no-fixture"

  @test:scripts/sdc-checks.test.ts::behavioural_tests_are_warn-only::noTestFileWarns
  Scenario: no test file: no-fixture, a warning
    Then a behavioural check with no test file is "no-fixture" at warning severity

  @test:scripts/sdc-checks.test.ts::behavioural_tests_are_warn-only::failingBehaviourNeverFails
  Scenario: a failing behavioural test never fails the run
    Given a behavioural test file and no toolkit on disk
    Then the behaviour check could not determine, at warning severity
    And the run exits 0

  @test:scripts/sdc-checks.test.ts::behavioural_tests_are_warn-only::toolkitRunNoInstall
  Scenario: with the toolkit installed, the IG's test is run with auto-install off; a failure is a warning
    Given the toolkit installed and a behavioural test that fails
    Then the test is run with "--no-install test"
    And the check fails at warning severity with the output as its finding
    And the run exits 0

  @test:scripts/sdc-checks.test.ts::containsAndCanonicalBundle
  Scenario: contains: objects by key, arrays by any element
    Then an object contains another by key and an array by any element
    And a different value is not contained
    And a canonical bundle for another version has no entry

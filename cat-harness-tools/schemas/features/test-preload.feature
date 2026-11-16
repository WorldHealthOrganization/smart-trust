# The suite-wide test timeout set by schemas/test-preload.ts reaches every test file
# bun runs, not only the first. Each Scenario names the test that executes it.
Feature: The test preload's suite timeout reaches every file

  @test:schemas/test-preload.test.ts::a_second_test_file_gets_the_suite_default_too
  Scenario: A second test file gets the suite default timeout too
    Given two temporary test files, each with one test that sleeps 5.3 seconds
    When bun test runs both under this repository's test preload
    Then the output never says "timed out"
    And it reports 2 pass

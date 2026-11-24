# scripts/backoff-sleep.ts is the one shared backoff that workflow retry loops call; these
# tests read its source with comments stripped. Each Scenario names the test that executes it.
Feature: Workflow retry loops share one backoff

  @test:scripts/tests/sdlc/retry-backoff-in-workflows.test.ts::the_shared_implementation_is_the_one_`retry.ts`_defines::it_calls_`waitFor`_rather_than_reimplementing_the_doubling
  Scenario: The backoff script calls waitFor rather than reimplementing the doubling
    # Gap: only the source text is checked; no wait is run
    Given the source of scripts/backoff-sleep.ts with its comments stripped
    Then it imports "waitFor"
    And it calls "waitFor(attempt"
    And it does not contain its own "2 ** (attempt" arithmetic

  @test:scripts/tests/sdlc/retry-backoff-in-workflows.test.ts::the_shared_implementation_is_the_one_`retry.ts`_defines::a_bad_attempt_number_refuses_rather_than_becoming_a_short_wait
  Scenario: A bad attempt number refuses rather than becoming a short wait
    # Gap: only checks the source contains an exit with code 2; no bad attempt number is passed
    Given the source of scripts/backoff-sleep.ts with its comments stripped
    Then it contains "process.exit(2)"

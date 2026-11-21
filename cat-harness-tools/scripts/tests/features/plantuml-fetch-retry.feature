# The PlantUML jar download retries, and says why it failed (a layer's PR,
# 2026-11-17). Each Scenario names the test that executes it.
Feature: The PlantUML jar download retries

  @test:scripts/tests/plantuml-fetch-retry.test.ts::fetchWithRetry::a_refused_request_then_a_good_one_returns_the_bytes
  Scenario: A refused request is retried
    Given a download that is refused once and then succeeds
    When the jar is fetched
    Then the bytes of the second attempt are returned

  @test:scripts/tests/plantuml-fetch-retry.test.ts::fetchWithRetry::every_attempt_failing_returns_the_last_reason_and_the_attempt_count
  Scenario: Every attempt fails
    Given a download that answers 503 every time
    When the jar is fetched
    Then the last status and the number of attempts are reported

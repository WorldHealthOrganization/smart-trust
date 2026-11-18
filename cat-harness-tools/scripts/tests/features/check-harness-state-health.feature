# The health-producer gate in scripts/check-harness-state.ts judges only this repository's own
# health report, and gives a report from an old producer one grace period before it is a finding.
# Each Scenario names the test that executes it.
Feature: Health-report producer freshness

  @test:scripts/tests/check-harness-state-health.test.ts::judgeHealthReport::a_report_from_the_current_producer_is_current_at_any_age
  Scenario: A report from the current producer is current however old it is
    Given a health report whose producer script hash is "new", updated 500 hours ago
    When it is judged against the current producer hash "new"
    Then there is no finding

  @test:scripts/tests/check-harness-state-health.test.ts::judgeHealthReport::a_report_from_an_old_producer_passes_inside_the_grace_period
  Scenario: A report from an old producer passes inside the grace period
    Given a health report whose producer script hash is "old"
    When it is judged against the current producer hash "new" 8 hours after its update
    Then there is no finding
    And there is still no finding exactly at the grace-period limit

  @test:scripts/tests/check-harness-state-health.test.ts::judgeHealthReport::past_the_grace_period_it_is_a_finding_naming_both_hashes
  Scenario: Past the grace period an old producer is a finding naming both hashes
    Given a health report from producer hash "old" updated one hour past the grace period
    When it is judged against the current producer hash "new"
    Then the finding's detail contains "at old"
    And it contains "now new"

  @test:scripts/tests/check-harness-state-health.test.ts::judgeHealthReport::no_readable_date_gets_no_grace
  Scenario: A report with no readable date gets no grace
    Given a health report from producer hash "old" with no updated_at
    When it is judged against the current producer hash "new"
    Then the finding's detail contains "no readable updated_at"

  @test:scripts/tests/check-harness-state-health.test.ts::judgeHealthReport::a_report_with_no_producer,_or_that_does_not_parse,_is_still_a_finding
  Scenario: A report with no producer, or that does not parse, is a finding
    When the report "{}" is judged
    Then the finding's detail contains "records no producer"
    And when the unparseable report "{" is judged, the detail contains "does not parse"

  @test:scripts/tests/check-harness-state-health.test.ts::isOwnHealthReport::the_repository's_own_report_is_judged;_a_mounted_instance's_is_not
  Scenario: Only the repository's own health report is judged
    Given the repository "/r" with instance roots "/r/cat-harness-tools" and "/r/who-iris"
    Then "/r/test/health/results/repository.health-report.json" is the repository's own report
    And the report under "/r/cat-harness-tools/health/" is not
    And the report under "/r/who-iris/test/health/results/" is not

  @test:scripts/tests/check-harness-state-health.test.ts::isOwnHealthReport::a_prefix_that_is_not_a_directory_boundary_does_not_count_as_inside_an_instance
  Scenario: A name prefix that is not a directory boundary is not inside an instance
    Given the repository "/r" with an instance root "/r/who-iris"
    Then "/r/who-iris-notes/x.json" counts as the repository's own report

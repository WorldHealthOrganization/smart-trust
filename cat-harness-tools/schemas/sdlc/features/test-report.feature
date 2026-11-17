# Specifies schemas/sdlc/test-report.ts: per-case verdicts, a per-plan rollup
# that agrees with them, and never a total across plans (bean ygzh, ruling
# py74).
Feature: A test report's rollup agrees with its per-case verdicts

  Background:
    Given a completed report for plan "crdm-detect" v1 run by the SUT actor "claude-code", with cases "a" and "b" passed by a script reviewer and a rollup computed from the cases

  @test:schemas/sdlc/test-report.test.ts::a_summary_may_not_disagree_with_its_details::a_rollup_computed_from_the_cases_parses
  Scenario: A rollup computed from the cases parses
    When the report is parsed with the test report schema
    Then it parses

  @test:schemas/sdlc/test-report.test.ts::a_summary_may_not_disagree_with_its_details::a_rollup_that_over-counts_passes_is_refused,_naming_the_bucket
  Scenario: A rollup that over-counts passes is refused
    When the rollup claims 3 passes
    Then the report is refused with the first issue at rollup.pass

  @test:schemas/sdlc/test-report.test.ts::a_summary_may_not_disagree_with_its_details::the_rollup_counts_the_CURRENT_verdict_—_a_later_human_fail_overrides_an_earlier_script_pass
  Scenario: The rollup counts each case's current verdict
    Given case "a" has a script pass followed by a human fail
    When the report is parsed
    Then the rollup is 1 pass and 1 fail
    And a rollup counting every entry (2 passes, 1 fail) is refused

  @test:schemas/sdlc/test-report.test.ts::a_summary_may_not_disagree_with_its_details::not-applicable_is_spelled_`n/a`,_block-qa's_spelling_—_never_py74's_`na`
  Scenario: Not-applicable is spelled n/a
    When case "a" has the result "n/a"
    Then the report parses
    And a result spelled "na" is refused

  @test:schemas/sdlc/test-report.test.ts::a_summary_may_not_disagree_with_its_details::a_skip_must_say_why_—_an_unexplained_skip_cannot_be_told_from_a_case_nobody_ran
  Scenario: A skip must give a reason
    When case "a" is skipped without a reason
    Then the report is refused
    And a skip with the reason "needs network" parses

  @test:schemas/sdlc/test-report.test.ts::a_rollup_per_plan,_never_a_total_across_plans_(py74)::a_report_names_ONE_plan;_a_second_plan_or_a_total_is_refused,_not_stripped
  Scenario: A report names one plan and carries no total
    When the report carries a plans list, a top-level total, or a total inside its rollup
    Then each is refused

  @test:schemas/sdlc/test-report.test.ts::a_rollup_per_plan,_never_a_total_across_plans_(py74)::rollupPanels_gives_one_panel_per_report,_keyed_by_plan,_and_NO_total_anywhere
  Scenario: rollupPanels gives one panel per report, keyed by plan
    Given three reports: two for "crdm-detect" with different SUTs and one for "workflow-complete"
    When rollupPanels is computed
    Then its keys are "crdm-detect" and "workflow-complete"
    And "crdm-detect" has two panels
    And no "total" appears anywhere in the panels
    And every panel's rollup has exactly the buckets fail, n/a, pass, skipped and warn

  @test:schemas/sdlc/test-report.test.ts::`running`_is_never_a_pass::a_running_report_with_every_case_passing_so_far_is_`unknown`,_not_`ok`
  Scenario: A running report is unknown even when every case passed so far
    Given the report with status "running" and no completed_at
    When it is parsed and its verdict computed
    Then its rollup has no failures
    And the verdict is "unknown"

  @test:schemas/sdlc/test-report.test.ts::`running`_is_never_a_pass::a_terminal_status_needs_completed_at,_and_running_must_not_carry_one
  Scenario: completed_at is required exactly when the status is terminal
    When the completed report has no completed_at
    Then it is refused
    And a running report with completed_at is refused

  @test:schemas/sdlc/test-report.test.ts::`running`_is_never_a_pass::aborted_without_a_failure_is_`unknown`;_with_one_it_is_a_`finding`
  Scenario: An aborted report is unknown without a failure and a finding with one
    When the report is aborted with every case passing
    Then the verdict is "unknown"
    And an aborted report in which case "a" failed is a "finding"

  @test:schemas/sdlc/test-report.test.ts::`running`_is_never_a_pass::a_completed_report_in_which_nothing_passed_has_shown_nothing_—_`unknown`
  Scenario: A completed report with no pass is unknown
    Given case "a" is n/a and case "b" is skipped with a reason
    When the verdict is computed
    Then it is "unknown"

  @test:schemas/sdlc/test-report.test.ts::`running`_is_never_a_pass::completed,_something_passed,_nothing_failed_—_`ok`;_warn_does_not_block
  Scenario: A completed report with a pass and a warn is ok
    Given case "a" passed and case "b" warned
    When the verdict is computed
    Then it is "ok"

  @test:schemas/sdlc/test-report.test.ts::the_system_under_test_never_writes_its_own_verdict::a_verdict_whose_reviewer_actor_is_the_SUT_is_refused
  Scenario: A verdict reviewed by the SUT's actor is refused
    Given case "a"'s verdict has a reviewer whose actor is "claude-code"
    When the report is parsed
    Then it is refused

  @test:schemas/sdlc/test-report.test.ts::the_system_under_test_never_writes_its_own_verdict::…and_so_is_one_whose_reviewer_id_is_the_SUT
  Scenario: A verdict reviewed by the SUT's id is refused
    Given case "a"'s verdict has a reviewer whose id is "claude-code"
    When the report is parsed
    Then it is refused

  @test:schemas/sdlc/test-report.test.ts::checked_against_the_plan_it_claims_to_execute::a_terminal_report_that_never_reached_case_`c`_is_a_mismatch
  Scenario: A completed report missing a planned case is a mismatch
    Given a plan "crdm-detect" v1 with cases a, b and c
    When the completed report with cases a and b is checked against it
    Then the only mismatch is "unexecuted-case"

  @test:schemas/sdlc/test-report.test.ts::checked_against_the_plan_it_claims_to_execute::a_running_report_is_not_yet_short_of_anything
  Scenario: A running report has no mismatches yet
    Given the plan with cases a, b and c
    When a running report with cases a and b is checked against it
    Then there are no mismatches

  @test:schemas/sdlc/test-report.test.ts::checked_against_the_plan_it_claims_to_execute::a_verdict_for_a_case_the_plan_lacks,_and_a_version_drift,_are_both_reported
  Scenario: An unknown case and a plan version drift are both reported
    Given the plan v1 with cases a, b and c
    When a report claiming plan v2 with cases a, b, c and z is checked against it
    Then the mismatches are "plan-version" and "unknown-case"

  @test:schemas/sdlc/test-report.test.ts::where_it_is_written::tests/<plan-id>/<sut>/<run-id>/_on_the_qa-reports_branch
  Scenario: The report path is tests/<plan-id>/<sut>/<run-id>/
    When the report path is computed
    Then it is "tests/crdm-detect/claude-code/r1/test-report.json"

  @test:schemas/sdlc/test-report.test.ts::where_it_is_written::a_segment_that_could_escape_its_directory_is_refused
  Scenario: A path segment that escapes its directory is refused
    When the report path is computed for a SUT actor "../main"
    Then it throws

  @test:schemas/sdlc/test-report.test.ts::the_graph_typology_it_is_held_under::registered,_not_renderable,_and_`state`_—_a_run_writes_it
  Scenario: The test-report typology is registered state a process writes
    When the "test-report" graph typology is looked up
    Then it is registered
    And it is not renderable
    And its layer is "state"
    And a process may write it

  @test:schemas/sdlc/test-report.test.ts::the_graph_typology_it_is_held_under::a_different_kind_from_`qa-report`_and_`test-plan`,_on_purpose
  Scenario: test-report, qa-report and test-plan are distinct kinds
    When the graph typology IRIs of "qa-report", "test-plan" and "test-report" are computed
    Then they are three distinct IRIs

# check:prs-have-runs: a head whose runs all exist but never executed
# (`action_required`) is "blocked", a finding of its own (bean 1acg). Each
# Scenario names the test that executes it.
Feature: A pull request whose runs never executed is a finding

  @test:scripts/tests/prs-have-runs.test.ts::verdictFor_—_blocked_is_a_finding::a_head_whose_runs_all_failed_to_execute_is_NOT_clean
  Scenario: A head whose runs all failed to execute is not clean
    Given one pull request row in state "blocked"
    When the sweep's verdict is computed
    Then the verdict is "findings"

  @test:scripts/tests/prs-have-runs.test.ts::verdictFor_—_blocked_is_a_finding::an_executed_run_is_still_clean,_so_the_fix_discriminates
  Scenario: A head with an executed run is clean
    Given one pull request row in state "has-run"
    When the sweep's verdict is computed
    Then the verdict is "clean"

  @test:scripts/tests/prs-have-runs.test.ts::verdictFor_—_blocked_is_a_finding::blocked_beside_a_clean_head_still_makes_the_sweep_a_finding
  Scenario: A blocked head beside a clean one makes the sweep a finding
    Given a row in state "has-run" and a row in state "blocked"
    When the sweep's verdict is computed
    Then the verdict is "findings"

  @test:scripts/tests/prs-have-runs.test.ts::verdictFor_—_blocked_is_a_finding::`unknown`_still_outranks_a_blocked_finding
  Scenario: An unknown head outranks a blocked one
    Given a row in state "blocked" and a row in state "unknown"
    When the sweep's verdict is computed
    Then the verdict is "unknown"

  @test:scripts/tests/prs-have-runs.test.ts::verdictFor_—_blocked_is_a_finding::a_too-new_head_is_not_a_finding,_blocked_or_otherwise
  Scenario: A too-new head is not a finding
    Given one pull request row in state "too-new"
    When the sweep's verdict is computed
    Then the verdict is "clean"

  @test:scripts/tests/prs-have-runs.test.ts::verdictFor_—_blocked_is_a_finding::no_rows_at_all_is_not_a_finding_—_there_was_nothing_to_judge
  Scenario: No rows at all is clean
    Given no pull request rows
    When the sweep's verdict is computed
    Then the verdict is "clean"

  @test:scripts/tests/prs-have-runs.test.ts::render_—_the_blocked_section_says_what_to_do_and_what_NOT_to::blocked_heads_get_their_own_section,_not_the_`no_run`_one
  Scenario: Blocked heads get their own section
    Given one row in state "blocked"
    When the report is rendered with a minimum age of 15
    Then it contains "whose runs EXIST and did not execute"
    And it does not contain "## 1 with no run"

  @test:scripts/tests/prs-have-runs.test.ts::render_—_the_blocked_section_says_what_to_do_and_what_NOT_to::it_forbids_clearing_them_by_dispatch_—_that_is_what_masked_this
  Scenario: The blocked section forbids clearing the heads by dispatch
    Given one row in state "blocked"
    When the report is rendered
    Then it contains "Do NOT dispatch these to clear them"
    And it cites "#1829"

  @test:scripts/tests/prs-have-runs.test.ts::render_—_the_blocked_section_says_what_to_do_and_what_NOT_to::the_run_count_is_carried_through,_so_`existed`_is_visible
  Scenario: The blocked section carries the run count
    Given one blocked row whose detail is "3 run(s), none executed"
    When the report is rendered
    Then it contains "3 run(s), none executed"

  @test:scripts/tests/prs-have-runs.test.ts::render_—_the_blocked_section_says_what_to_do_and_what_NOT_to::a_no-run_head_keeps_its_own_advice,_unchanged
  Scenario: A no-run head keeps its own section
    Given one row in state "no-run"
    When the report is rendered
    Then it contains "with no run"
    And it does not contain the blocked section's heading

  @test:scripts/tests/prs-have-runs.test.ts::render_—_the_blocked_section_says_what_to_do_and_what_NOT_to::both_kinds_together_produce_both_sections
  Scenario: Both kinds together produce both sections
    Given a row in state "no-run" and a row in state "blocked"
    When the report is rendered
    Then it contains both "with no run" and "whose runs EXIST and did not execute"

  @test:scripts/tests/prs-have-runs.test.ts::render_—_the_blocked_section_says_what_to_do_and_what_NOT_to::a_clean_sweep_names_neither_—_an_empty_section_would_read_as_a_finding
  Scenario: A clean sweep renders neither section
    Given one row in state "has-run"
    When the report is rendered
    Then it contains neither the blocked section nor "## 1 with no run"

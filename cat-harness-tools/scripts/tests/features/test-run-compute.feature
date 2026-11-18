# Test runs the checkout does not hold are computed, never written to the tree
# (cat-harness-tools#1191). Each Scenario names the test that executes it.
Feature: Computed test runs

  @test:scripts/tests/test-run-compute.test.ts::test_runs_the_checkout_does_not_hold_are_computed,_never_written_to_the_tree::a_writer_is_chosen_only_for_the_directory_its_runs_belong_in
  Scenario: A writer is chosen by its directory
    Then for "/w/cat-harness/test/results" the writer is "eval:crdm-detect"
    And for "/w/other/test/results" there is none

  @test:scripts/tests/test-run-compute.test.ts::test_runs_the_checkout_does_not_hold_are_computed,_never_written_to_the_tree::qa:refresh_still_runs_every_test-run_writer
  Scenario: qa:refresh runs every test-run writer
    Then every test-run writer's id is among the qa:refresh writers

  @test:scripts/tests/test-run-compute.test.ts::test_runs_the_checkout_does_not_hold_are_computed,_never_written_to_the_tree::no_writer_for_the_directory_is_a_reason,_so_the_caller_keeps_unknown
  Scenario: No writer for the directory is a reason
    When test runs are computed for "/nowhere/test/results"
    Then the reason says "no declared writer"

  @test:scripts/tests/test-run-compute.test.ts::test_runs_the_checkout_does_not_hold_are_computed,_never_written_to_the_tree::a_failing_writer_is_a_reason_and_leaves_no_directory_behind
  Scenario: A failing writer is a reason
    # Gap: the title says no directory is left behind; the body checks only the reason.
    When test runs are computed with a writer "bad" whose script does not exist
    Then the reason says "writer bad exited"

  @test:scripts/tests/test-run-compute.test.ts::test_runs_the_checkout_does_not_hold_are_computed,_never_written_to_the_tree::a_computed_run_is_named_as_the_file_it_stands_for
  Scenario: A computed run is named as its file
    Then a computed "a.test-run.json" is named "test/results/a.test-run.json (computed in this run)"

  @test:scripts/tests/test-run-compute.test.ts::test_runs_the_checkout_does_not_hold_are_computed,_never_written_to_the_tree::a_computed_run_is_written_to_the_temporary_directory_only
  Scenario: A computed run is written to a temporary directory
    # Gap: returns early with no assertion when no sibling cat-harness checkout exists, so it can pass without checking anything; even when it runs it lists the temporary directory but does not check the tree is untouched.
    Given a sibling cat-harness checkout
    When its test runs are computed
    Then the temporary directory holds exactly "crdm-detect-eval.test-run.json"

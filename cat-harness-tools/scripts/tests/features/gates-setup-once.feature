# scripts/gates.ts runs each CI setup step once per local `gates` run: a repeat of a
# listed setup step is skipped and reports the first run's exit, while checks always run.
# Each Scenario names the test that executes it.
Feature: Setup steps run once per local gates run

  @test:scripts/tests/gates-setup-once.test.ts::a_listed_setup_step_runs_the_first_time_and_is_skipped_after,_with_the_first_run's_exit
  Scenario: A listed setup step runs the first time and is skipped after with the first run's exit
    Given a fresh setup-once record
    When "bun run cat state:mount" has not run yet
    Then it is not reported as already run
    And after it is recorded with exit 1 it is reported as already run with exit 1
    And recording a later exit 0 leaves the reported exit at 1

  @test:scripts/tests/gates-setup-once.test.ts::a_check_that_repeats_is_never_skipped:_it_may_judge_what_a_step_in_between_wrote
  Scenario: A check that repeats is never skipped
    Given a fresh setup-once record
    When "bun run cat check:extracted-references" is recorded with exit 0
    Then it is still not reported as already run

  @test:scripts/tests/gates-setup-once.test.ts::the_list_names_the_setup_steps_the_workflow_repeats_per_job,_and_no_check
  Scenario: The run-once list names the per-job setup steps and no check
    Given the list of run-once setup steps
    Then it contains "bun install --frozen-lockfile", "bun run cat state:mount" and "bun run cat ig-index:build"
    And no entry in it contains "check"

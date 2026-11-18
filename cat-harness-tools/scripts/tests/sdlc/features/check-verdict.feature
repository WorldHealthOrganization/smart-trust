# src/workflow/check-verdict.ts classifies a commit's check runs as pass, fail, pending or undetermined, explains a
# superseded run, and maps each state to an exit code. Each Scenario names the test that executes it.
Feature: A commit's check runs give one of four verdicts

  @test:scripts/tests/sdlc/check-verdict.test.ts::verdictOf_—_the_four_states_stay_four::every_check_clean_is_a_PASS
  Scenario: Every check clean is a pass
    Given check runs concluded "success" and "skipped"
    When the verdict is taken
    Then it is "pass"

  @test:scripts/tests/sdlc/check-verdict.test.ts::verdictOf_—_the_four_states_stay_four::`neutral`_is_clean_—_it_is_a_verdict_of_'nothing_to_say',_not_a_failure
  Scenario: A neutral conclusion is clean
    Given one check run concluded "neutral"
    When the verdict is taken
    Then it is "pass"

  @test:scripts/tests/sdlc/check-verdict.test.ts::verdictOf_—_the_four_states_stay_four::a_CANCELLED_run_is_UNDETERMINED,_not_a_failure_—_the_bug_this_exists_for
  Scenario: A cancelled run is undetermined, not a failure
    Given "Repository gates (hard)" concluded "success" and "build-and-deploy" concluded "cancelled"
    When the verdict is taken
    Then it is "undetermined"
    And it names "build-and-deploy"

  @test:scripts/tests/sdlc/check-verdict.test.ts::verdictOf_—_the_four_states_stay_four::a_STALE_run_is_UNDETERMINED_too_—_GitHub_marks_it_when_a_NEWER_run_supersedes
  Scenario: A stale run is undetermined
    Given one check run concluded "success" and another "stale"
    When the verdict is taken
    Then it is "undetermined"

  @test:scripts/tests/sdlc/check-verdict.test.ts::verdictOf_—_the_four_states_stay_four::a_FAILURE_beside_a_cancellation_is_still_a_FAIL_—_failure_wins
  Scenario: A failure beside a cancellation is a fail
    Given check run "a" concluded "failure" and "b" concluded "cancelled"
    When the verdict is taken
    Then it is "fail"
    And it names only "a"

  @test:scripts/tests/sdlc/check-verdict.test.ts::verdictOf_—_the_four_states_stay_four::PENDING_beats_cancelled_—_an_in-flight_run_may_yet_fail,_so_nothing_is_concluded
  Scenario: A run still in progress beside a cancellation is pending
    Given check run "a" in progress and "b" concluded "cancelled"
    When the verdict is taken
    Then it is "pending"

  @test:scripts/tests/sdlc/check-verdict.test.ts::verdictOf_—_the_four_states_stay_four::`timed_out`_and_`action_required`_are_failures
  Scenario: Timed-out and action-required runs are failures
    Given one check run concluded "timed_out"
    When the verdict is taken
    Then it is "fail"
    And a run concluded "action_required" is also "fail"

  @test:scripts/tests/sdlc/check-verdict.test.ts::the_vacuous_cases_—_`dh4f`,_where_nothing_looked_and_it_read_as_clean::NO_check_runs_is_UNDETERMINED,_never_a_pass
  Scenario: No check runs at all is undetermined
    Given an empty list of check runs
    When the verdict is taken
    Then it is "undetermined"
    And its reason contains "NOT a pass"

  @test:scripts/tests/sdlc/check-verdict.test.ts::the_vacuous_cases_—_`dh4f`,_where_nothing_looked_and_it_read_as_clean::an_unreadable_response_is_UNDETERMINED,_never_a_pass
  Scenario: An unreadable response is undetermined
    Given no check-run response
    When the verdict is taken
    Then it is "undetermined"
    And its reason contains "NOT a pass"

  @test:scripts/tests/sdlc/check-verdict.test.ts::the_vacuous_cases_—_`dh4f`,_where_nothing_looked_and_it_read_as_clean::only_teardown_jobs_is_UNDETERMINED_—_they_carry_no_verdict_about_the_tree
  Scenario: Only teardown jobs is undetermined
    Given only "cleanup" and "cleanup-dispatch", both concluded "skipped"
    When the verdict is taken
    Then it is "undetermined"

  @test:scripts/tests/sdlc/check-verdict.test.ts::the_vacuous_cases_—_`dh4f`,_where_nothing_looked_and_it_read_as_clean::a_teardown_job_does_NOT_mask_a_real_failure_beside_it
  Scenario: A teardown job does not mask a real failure
    Given "cleanup" concluded "skipped" and "a" concluded "failure"
    When the verdict is taken
    Then it is "fail"

  @test:scripts/tests/sdlc/check-verdict.test.ts::explainSuperseded_—_WHOSE_contention,_which_the_check_run_cannot_say::the_branch_HAS_moved:_name_the_superseding_commit_and_where_to_look_next
  Scenario: A moved branch names the superseding commit
    Given the branch's newer commits "aaa older" and "bbb newer"
    When the supersession is explained
    Then the explanation contains "bbb newer"
    And it says "Judge the newer commit instead"

  @test:scripts/tests/sdlc/check-verdict.test.ts::explainSuperseded_—_WHOSE_contention,_which_the_check_run_cannot_say::the_branch_has_NOT_moved:_refuse_to_assume_concurrency
  Scenario: An unmoved branch is not assumed to be concurrency
    Given no newer commits on the branch
    When the supersession is explained
    Then the explanation says the branch "has NOT moved"
    And it does not say "concurrency, not a failure"

  @test:scripts/tests/sdlc/check-verdict.test.ts::exitCodeFor_—_undetermined_has_its_OWN_code,_and_it_is_never_0::pass_0,_fail_1,_undetermined_2,_pending_2
  Scenario: Each verdict state has its exit code
    Given the four verdict states
    When each is mapped to an exit code
    Then pass is 0, fail is 1, undetermined is 2 and pending is 2

  @test:scripts/tests/sdlc/check-verdict.test.ts::exitCodeFor_—_undetermined_has_its_OWN_code,_and_it_is_never_0::no_state_maps_to_0_except_pass_—_asserted_as_an_ABSENCE
  Scenario: Only pass maps to exit code 0
    Given the states pass, fail, pending and undetermined
    When those mapping to exit code 0 are listed
    Then the list is only "pass"

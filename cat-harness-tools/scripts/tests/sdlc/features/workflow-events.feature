# src/core/workflow-events.ts reads which workflows are required, conditional or not declared for an event,
# and scripts/check-head-has-run.ts matches a head's runs against them, keeping blocked apart from absent.
# Each Scenario names the test that executes it.
Feature: Workflows owed for an event, and whether they ran

  @test:scripts/tests/sdlc/workflow-events.test.ts::triggerFor_—_the_three_states::an_unfiltered_event_is_REQUIRED
  Scenario: An event with no filters is required
    Given a workflow named "Gates" triggered on pull_request with no filters
    When its trigger for pull_request is read
    Then it is required, named "Gates", with no filters

  @test:scripts/tests/sdlc/workflow-events.test.ts::triggerFor_—_the_three_states::a_path-filtered_event_is_CONDITIONAL,_and_says_which_filter_made_it_so
  Scenario: A path-filtered event is conditional and names the filter
    Given a workflow triggered on pull_request with a "paths" filter
    When its trigger for pull_request is read
    Then it is conditional with filters "paths"

  @test:scripts/tests/sdlc/workflow-events.test.ts::triggerFor_—_the_three_states::CONDITIONAL_is_not_a_synonym_for_`paths`_—_every_narrowing_key_counts
  Scenario: Every narrowing key makes an event conditional, not only paths
    Given a pull_request trigger with types [opened], paths and branches
    When its trigger for pull_request is read
    Then it is conditional with filters "branches", "paths" and "types"

  @test:scripts/tests/sdlc/workflow-events.test.ts::triggerFor_—_the_three_states::a_`types:`_list_that_keeps_every_default_PR_type_is_no_narrowing:_still_REQUIRED_(bean_dft1)
  Scenario: A types list that keeps every default PR type is no narrowing
    Given a pull_request trigger with types opened, synchronize, reopened and ready_for_review
    When its trigger for pull_request is read
    Then it is required with no filters
    And a types list of opened, synchronize, reopened and closed is also required

  @test:scripts/tests/sdlc/workflow-events.test.ts::triggerFor_—_the_three_states::a_`types:`_list_missing_a_default_PR_type_still_narrows:_CONDITIONAL
  Scenario: A types list missing a default PR type is conditional
    Given a pull_request trigger with types opened and ready_for_review
    When its trigger for pull_request is read
    Then it is conditional with filters "types"

  @test:scripts/tests/sdlc/workflow-events.test.ts::triggerFor_—_the_three_states::the_default-types_rule_does_not_hide_another_filter_beside_it
  Scenario: The default-types rule does not hide a filter beside it
    Given a pull_request trigger with the default types and a "paths" filter
    When its trigger for pull_request is read
    Then it is conditional with filters "paths" only

  @test:scripts/tests/sdlc/workflow-events.test.ts::triggerFor_—_the_three_states::an_event_the_workflow_does_not_declare_is_NOT-DECLARED,_not_a_missing_required
  Scenario: An event the workflow does not declare is not-declared
    Given a workflow triggered only on schedule
    When its trigger for pull_request is read
    Then it is not-declared

  @test:scripts/tests/sdlc/workflow-events.test.ts::triggerFor_—_the_three_states::the_list_and_scalar_forms_of_`on:`_carry_no_filters,_so_they_are_REQUIRED
  Scenario: The list and scalar forms of "on:" are required
    Given one workflow with "on: [pull_request, push]" and one with "on: pull_request"
    When each trigger for pull_request is read
    Then both are required

  @test:scripts/tests/sdlc/workflow-events.test.ts::triggerFor_—_the_three_states::a_workflow_with_no_`name:`_falls_back_to_its_path,_as_GitHub_does
  Scenario: A workflow with no name is named by its path
    Given a workflow at ".github/workflows/x.yml" with no "name:"
    When its trigger for pull_request is read
    Then its name is ".github/workflows/x.yml"

  @test:scripts/tests/sdlc/workflow-events.test.ts::triggerFor_—_the_three_states::a_YAML_1.1_parser's_`on:_->_true`_key_would_not_blind_the_scan
  Scenario: An "on:" key read as true by a YAML 1.1 parser still yields the events
    Given a workflow whose trigger key is written "true:" holding pull_request
    When its trigger for pull_request is read
    Then it is required

  @test:scripts/tests/sdlc/workflow-events.test.ts::scanTriggers::drops_not-declared,_keeps_required_and_conditional_apart
  Scenario: A scan drops not-declared workflows and keeps required and conditional apart
    Given a tree with an unfiltered "Gates", a path-filtered "Drift" and a scheduled "Nightly"
    When the triggers for pull_request are scanned
    Then nothing is unreadable
    And the triggers are "Drift" conditional and "Gates" required, with no "Nightly"

  @test:scripts/tests/sdlc/workflow-events.test.ts::scanTriggers::an_absent_workflow_directory_is_UNREADABLE,_never_an_empty_required_set
  Scenario: An absent workflow directory is unreadable, not an empty required set
    Given a root with no workflow directory
    When the triggers for pull_request are scanned
    Then there are no triggers and exactly one unreadable entry

  @test:scripts/tests/sdlc/workflow-events.test.ts::scanTriggers::one_unparseable_file_does_not_discard_the_others,_and_is_reported
  Scenario: One unparseable file is reported without discarding the others
    Given a tree with a valid "gates.yml" and an unparseable "broken.yml"
    When the triggers for pull_request are scanned
    Then the triggers are just "Gates"
    And the unreadable file is the workflow directory's "broken.yml"

  @test:scripts/tests/sdlc/workflow-events.test.ts::coverageFor_—_the_bug_this_bean_is_about::a_PUSH_run_of_a_workflow_is_not_its_PULL_REQUEST_run
  Scenario: A push run does not satisfy the pull_request requirement
    Given a required "Gates" and a conditional "Drift" for pull_request
    And a single push run of "Drift"
    When coverage for pull_request is computed
    Then "Gates" is required, not ran, and absent
    And "Drift" is not ran

  @test:scripts/tests/sdlc/workflow-events.test.ts::coverageFor_—_the_bug_this_bean_is_about::a_DISPATCH_run_of_the_required_workflow_does_not_satisfy_it_either
  Scenario: A dispatch run does not satisfy the pull_request requirement
    Given a required "Gates" for pull_request and a workflow_dispatch run of "Gates"
    When coverage for pull_request is computed
    Then "Gates" has not ran

  @test:scripts/tests/sdlc/workflow-events.test.ts::coverageFor_—_the_bug_this_bean_is_about::the_matching_run_satisfies_it
  Scenario: A pull_request run of the required workflow satisfies it
    Given a required "Gates" and a successful pull_request run of "Gates"
    When coverage for pull_request is computed
    Then "Gates" has ran

  @test:scripts/tests/sdlc/workflow-events.test.ts::coverageFor_—_the_bug_this_bean_is_about::a_run_of_an_unrelated_workflow_satisfies_nothing
  Scenario: A run of an unrelated workflow satisfies nothing
    Given a pull_request run of "Something Else"
    When coverage for pull_request is computed
    Then not every required workflow has ran

  @test:scripts/tests/sdlc/workflow-events.test.ts::coverageFor_—_the_bug_this_bean_is_about::unreadable_files_are_carried_through_to_the_caller,_not_swallowed
  Scenario: Unreadable files are carried through to the coverage result
    Given a scan of a root with no workflow directory
    When coverage for pull_request is computed with no runs
    Then the coverage holds one unreadable entry

  @test:scripts/tests/sdlc/workflow-events.test.ts::coverageFor_—_the_bug_this_bean_is_about::an_action_required_run_of_the_right_workflow_and_event_does_NOT_satisfy_it
  Scenario: An action_required run of the right workflow and event does not satisfy it
    Given a pull_request run of "Gates" concluded action_required
    When coverage for pull_request is computed
    Then "Gates" has not ran

  @test:scripts/tests/sdlc/workflow-events.test.ts::coverageFor_—_the_bug_this_bean_is_about::it_is_`blocked`,_NOT_`absent`_—_the_two_need_opposite_advice
  Scenario: An action_required run is blocked, not absent
    Given a pull_request run of "Gates" concluded action_required
    When coverage for pull_request is computed
    Then "Gates" is blocked

  @test:scripts/tests/sdlc/workflow-events.test.ts::coverageFor_—_the_bug_this_bean_is_about::no_run_at_all_stays_`absent`,_so_the_blocked_state_did_not_swallow_it
  Scenario: No run at all stays absent
    Given no runs
    When coverage for pull_request is computed
    Then "Gates" is absent

  @test:scripts/tests/sdlc/workflow-events.test.ts::coverageFor_—_the_bug_this_bean_is_about::startup_failure_is_the_same_class_—_a_run_whose_jobs_never_started
  Scenario: A startup_failure run is blocked
    Given a pull_request run of "Gates" concluded startup_failure
    When coverage for pull_request is computed
    Then "Gates" is blocked

  @test:scripts/tests/sdlc/workflow-events.test.ts::coverageFor_—_the_bug_this_bean_is_about::a_FAILED_run_executed:_it_is_a_verdict_about_the_tree,_not_a_missing_gate
  Scenario: A failed run counts as ran
    Given a pull_request run of "Gates" concluded failure
    When coverage for pull_request is computed
    Then "Gates" is ran

  @test:scripts/tests/sdlc/workflow-events.test.ts::coverageFor_—_the_bug_this_bean_is_about::an_in-flight_run_(null_conclusion)_is_not_treated_as_unexecuted
  Scenario: An in-flight run with no conclusion counts as ran
    Given a pull_request run of "Gates" with a null conclusion
    When coverage for pull_request is computed
    Then "Gates" is ran

  @test:scripts/tests/sdlc/workflow-events.test.ts::coverageFor_—_the_bug_this_bean_is_about::one_EXECUTED_run_settles_it_even_beside_a_blocked_sibling
  Scenario: One executed run settles it beside a blocked sibling
    Given two pull_request runs of "Gates", one action_required and one success
    When coverage for pull_request is computed
    Then "Gates" is ran

  @test:scripts/tests/sdlc/workflow-events.test.ts::coverageFor_—_the_bug_this_bean_is_about::a_blocked_DISPATCH_run_does_not_rescue_the_pull_request_requirement
  Scenario: A successful dispatch run does not rescue a blocked pull_request run
    Given an action_required pull_request run and a successful workflow_dispatch run of "Gates"
    When coverage for pull_request is computed
    Then "Gates" is blocked

  @test:scripts/tests/sdlc/workflow-events.test.ts::coverageFor_—_the_bug_this_bean_is_about::a_conditional_workflow_also_reports_blocked_rather_than_silently_not-run
  Scenario: A conditional workflow with an action_required run is blocked
    Given a pull_request run of the conditional "Drift" concluded action_required
    When coverage for pull_request is computed
    Then "Drift" is blocked and has not ran

  @test:scripts/tests/sdlc/workflow-events.test.ts::executed_—_the_predicate_the_two_sweeps_share::action_required_and_startup_failure_did_not_execute
  Scenario: action_required and startup_failure runs did not execute
    Given runs concluded action_required and startup_failure
    When each is asked whether it executed
    Then both answer false

  @test:scripts/tests/sdlc/workflow-events.test.ts::executed_—_the_predicate_the_two_sweeps_share::success,_failure,_cancelled_and_a_null_conclusion_all_did
  Scenario: Runs with any other conclusion, or none, did execute
    Given runs concluded success, failure, cancelled, stale, timed_out and null
    When each is asked whether it executed
    Then each answers true

  @test:scripts/tests/sdlc/workflow-events.test.ts::blockedRequiredAdvice::it_names_the_bot-actor_cause_rather_than_calling_the_absence_unexplained
  Scenario: Blocked advice names the bot-actor cause rather than an unexplained absence
    Given the blocked workflow "Code-quality gates"
    When the blocked-required advice is written
    Then it contains "github-actions[bot]" and "NOT a fork"
    And it does not contain "unexplained"

  @test:scripts/tests/sdlc/workflow-events.test.ts::blockedRequiredAdvice::it_does_NOT_tell_the_operator_to_dispatch_—_that_is_what_masked_this
  Scenario: Blocked advice does not tell the operator to dispatch
    Given the blocked workflow "Code-quality gates"
    When the blocked-required advice is written
    Then it contains "Do NOT read a `workflow_dispatch` green"
    And it does not contain "Dispatching against this ref is safe"

  @test:scripts/tests/sdlc/workflow-events.test.ts::blockedRequiredAdvice::it_names_the_one_change_that_fixes_the_class,_and_whose_it_is
  Scenario: Blocked advice names the fix and whose it is
    Given the blocked workflow "Code-quality gates"
    When the blocked-required advice is written
    Then it contains "#1829", "INSTALL THE HARNESS", "PUSH_BRANCH_TRIGGERING_CI" and "owner's to make"
    And it does not contain "MERGE_MAIN_TOKEN"

  @test:scripts/tests/sdlc/workflow-events.test.ts::blockedRequiredAdvice::it_says_the_run_existed,_which_is_the_half_the_`no_run`_wording_loses
  Scenario: Blocked advice says the runs existed but none executed
    Given the blocked workflows "Gates" and "Other"
    When the blocked-required advice is written
    Then it contains "Gates, Other" and "NONE of them executed"

  @test:scripts/tests/sdlc/workflow-events.test.ts::missingRequiredAdvice::on_a_conflicted_PR_it_says_merge_the_base_in,_and_NEVER_dispatch
  Scenario: On a conflicted PR the advice is to merge the base in, never to dispatch
    Given the missing workflow "Gates" on a conflicted PR
    When the missing-required advice is written
    Then it contains "MERGE THE BASE BRANCH IN" and "Do NOT dispatch"

  @test:scripts/tests/sdlc/workflow-events.test.ts::missingRequiredAdvice::on_a_mergeable_PR_dispatching_is_offered,_because_the_refs_agree
  Scenario: On a mergeable PR dispatching is offered
    Given the missing workflow "Gates" on a mergeable PR
    When the missing-required advice is written
    Then it contains "safe HERE"

  @test:scripts/tests/sdlc/workflow-events.test.ts::missingRequiredAdvice::on_an_unknown_merge_state_it_refuses_to_recommend_a_dispatch
  Scenario: On an unknown merge state no dispatch is recommended
    Given the missing workflow "Gates" with an unknown merge state
    When the missing-required advice is written
    Then it contains "by hand" and not "safe HERE"

  @test:scripts/tests/sdlc/workflow-events.test.ts::missingRequiredAdvice::it_names_the_workflows,_so_the_reader_need_not_go_looking
  Scenario: Missing-required advice names the workflows
    Given the missing workflows "Gates" and "Other" on a mergeable PR
    When the missing-required advice is written
    Then it contains "Gates, Other"

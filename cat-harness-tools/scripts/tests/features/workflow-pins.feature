# Shared-workflow calls follow index.lock.json (security audit S1).
# Each Scenario names the test that executes it.
Feature: Workflow pins

  Background:
    Given a lock pinning cat-harness-tools to a commit, judged for repository "smart-x"

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins::a_branch_call_to_a_mounted_layer_moves_to_the_lock's_commit
  Scenario: A branch call to a mounted layer moves to the lock's commit
    Given a call to cat-harness-tools' layer-pr-checks at "@main"
    Then there is one finding and the call is rewritten to the lock's commit with "# index.lock.json"

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins::a_call_already_at_the_lock's_commit_is_current
  Scenario: A call at the lock's commit is current
    Then a call at the lock's commit has no findings

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins::this_repository's_own_workflow_becomes_a_same-commit_local_call
  Scenario: The repository's own workflow becomes a local call
    Given a call to "litlfred/smart-x/.github/workflows/build.yml@main"
    Then it is rewritten to "uses: ./.github/workflows/build.yml"

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins::tools-ref:_main_under_a_layer-pr-checks_call_is_dropped,_other_inputs_stay
  Scenario: tools-ref main is dropped, other inputs stay
    Given a layer-pr-checks call at "@main" with inputs "mode: index" and "tools-ref: main"
    Then the findings are about index.lock.json and about tools-ref
    And the rewritten text has no tools-ref but keeps "mode: index"

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins::an_unmounted_layer_at_a_branch_is_reported_and_left_for_a_hand_pin
  Scenario: An unmounted layer at a branch is reported, not rewritten
    Given a call to "litlfred/other" at "@main"
    Then the finding wants no commit and the text still says "@main"

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins::an_unmounted_layer_pinned_by_hand_to_a_commit_is_accepted;_comments_are_ignored
  Scenario: A hand-pinned unmounted layer is accepted
    Given a commented-out branch call and a real call to "litlfred/other" at a full commit
    Then there are no findings

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins:_a_commit_pin_behind_the_lock::is_a_trailing_finding_(warn),_and_--write_still_moves_it
  Scenario: A commit behind the lock is trailing and still moved
    Given a call to cat-harness-tools at another commit
    Then there is one trailing finding and the call is rewritten to the lock's commit

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins:_a_commit_pin_behind_the_lock::a_branch_is_never_trailing
  Scenario: A branch is never trailing
    Then a cat-harness-tools call at "@main" gives a finding that is not trailing

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins:_layers_under_more_than_one_owner::a_call_under_the_old_owner_moves_to_the_owner_the_lock_names,_even_at_the_right_commit
  Scenario: A call under the old owner moves to the lock's owner
    Given the lock names smart-base under WorldHealthOrganization and the repository is owned by WorldHealthOrganization
    And a call to "litlfred/smart-base" at the locked commit
    Then there is one non-trailing finding and the call is rewritten under WorldHealthOrganization

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins:_layers_under_more_than_one_owner::a_harness_layer_that_stays_under_litlfred_is_judged_from_a_WHO_repository
  Scenario: A layer that stays under litlfred is pinned from a WHO repository
    Given a call to cat-harness-tools' layer-pr-checks at "@main" from a WorldHealthOrganization repository
    Then it is rewritten under litlfred at the lock's commit

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins:_layers_under_more_than_one_owner::this_repository's_own_workflow_under_a_non-litlfred_owner_becomes_a_local_call
  Scenario: The own workflow under another owner becomes local
    Given a call to "WorldHealthOrganization/smart-x/.github/workflows/build.yml@main"
    Then it is rewritten to "uses: ./.github/workflows/build.yml"

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins:_layers_under_more_than_one_owner::third-party_actions_are_not_judged
  Scenario: Third-party actions are not judged
    Then steps using actions/checkout and actions/setup-node give no findings

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins:_a_layer-pr-checks_caller_starts_on_`labeled`::--write_adds_`labeled`,_the_no-op_label_group_and_the_job's_if;_a_second_pass_is_clean
  Scenario: A layer-pr-checks caller without `labeled` is fixed
    Given a caller whose pull_request types omit "labeled", with a concurrency group keyed by github.ref
    Then three findings add "labeled", key a no-op label's group by its run, and skip the calling job on a no-op label
    And judging the rewritten text gives no findings

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins:_a_layer-pr-checks_caller_starts_on_`labeled`::a_pull_request_with_no_types_gets_a_types_line
  Scenario: A pull_request with no types gets one
    Then a types line ending in "labeled" is written under pull_request

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins:_a_layer-pr-checks_caller_starts_on_`labeled`::a_block_list_of_types_gets_`-_labeled`
  Scenario: A block list of types gets "- labeled"
    Then "- labeled" is appended to the list

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins:_a_layer-pr-checks_caller_starts_on_`labeled`::a_workflow_that_does_not_call_layer-pr-checks,_or_not_on_pull_request,_is_not_judged
  Scenario: Other workflows are not judged
    Then a workflow calling another file, or not on pull_request, gives no findings

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins:_a_layer-pr-checks_caller_starts_on_`labeled`::a_job_if_without_the_label_clause_is_reported_for_a_hand_fix
  Scenario: A job if without the label clause is left for a hand fix
    Then the finding on the job's if wants no rewrite

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins:_a_merge-guard_caller_leaves_pull_request_target::--write_drops_pull_request_target_and_adds_the_signal_to_workflow_run;_the_findings_trail;_a_second_pass_is_clean
  Scenario: A merge-guard caller on pull_request_target is moved to the signal
    Given a caller of layer-merge-guard on pull_request_target, issue_comment and workflow_run of "Layer PR checks"
    Then two trailing findings drop pull_request_target and add "Merge guard trigger" to workflow_run's workflows
    And judging the rewritten text gives no findings

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins:_a_merge-guard_caller_leaves_pull_request_target::a_block_list_of_workflows_gets_the_signal;_a_caller_with_no_workflow_run_gets_one
  Scenario: The signal is added to a block list, or a workflow_run is added
    Then a block list of workflows gets "- Merge guard trigger", and a caller with no workflow_run gets one listing it

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins:_a_merge-guard_caller_leaves_pull_request_target::a_workflow_that_does_not_call_layer-merge-guard_is_not_judged
  Scenario: Other workflows are not moved
    Then a workflow calling another file gives no findings

  @test:scripts/tests/workflow-pins.test.ts::workflow-pins:_a_merge-guard_caller_leaves_pull_request_target::the_signal_file_is_written_when_missing_or_changed,_and_is_then_current
  Scenario: The signal file is written and kept canonical
    Given a repository with a merge-guard caller and no merge-guard-trigger.yml
    Then a trailing finding reports it missing, and --write writes the canonical signal
    And a signal edited away from the canonical text is reported again

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

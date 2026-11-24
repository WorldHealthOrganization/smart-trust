# scripts/merge-queue-store.ts records a merge-queue decision onto its state branch
# through real git against a local bare remote, with no pull request to main.
# Each Scenario names the test that executes it.
Feature: A merge-queue decision is pushed to its branch

  @test:scripts/tests/sdlc/merge-queue-push.test.ts::a_decision_reaches_the_branch_without_a_pull_request::mount,_record,_push_—_and_the_entry_is_on_the_tip,_read_back_through_a_second_store
  Scenario: A recorded decision is pushed and reads back from the branch tip
    Given a checkout declaring the queue on the branch "cat/cat-harness/merge-queue" and a bare remote carrying it
    When the queue tip is mounted and a decision for PR 2065 is recorded
    Then the mount is "mounted"
    And the decision is written and its push is "pushed"
    And a second store over the same remote reads the entry with PR 2065 and the same decidedBy
    And the checkout's own branch has no commit

  @test:scripts/tests/sdlc/merge-queue-push.test.ts::a_decision_reaches_the_branch_without_a_pull_request::a_sibling's_write_to_the_SAME_entry_is_a_conflict,_and_nothing_is_pushed_over_it
  Scenario: A sibling's write to the same entry is a conflict and is not overwritten
    Given a mounted queue tip
    And a sibling store that then pushes its own decision for PR 2065 with a different decidedBy
    When this steward records its decision for PR 2065
    Then the decision is written locally and its push is "conflict"
    And a fresh store over the remote still reads the sibling's decidedBy
    And the mounted queue still holds this steward's decision

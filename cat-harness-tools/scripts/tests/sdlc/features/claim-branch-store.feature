# scripts/claim-bean.ts claimOnBranchStore claims a bean on the tip-keyed beans branch store after the cutover,
# exercised against a real bare git remote so a sibling's write is a real conflict.
# Each Scenario names the test that executes it.
Feature: Claiming a bean on the branch store

  @test:scripts/tests/sdlc/claim-branch-store.test.ts::claiming_on_the_branch_store::a_clean_claim_lands_on_the_tip,_in-progress,_with_the_claim_note
  Scenario: A clean claim lands on the tip as in-progress with a claim note
    Given a beans branch store holding a "todo" bean fx-aaaa
    When the bean is claimed for "my-branch"
    Then the result is "pushed"
    And the bean on the tip reads "status: in-progress"
    And it carries "Claimed by my-branch" and cites "bean 35nj"

  @test:scripts/tests/sdlc/claim-branch-store.test.ts::claiming_on_the_branch_store::the_bytes_are_the_SAME_TRANSFORM_the_filesystem_writer_uses_—_not_a_second_spelling
  Scenario: The claimed bean's bytes match the filesystem writer's transform
    Given a beans branch store holding a "todo" bean
    When the bean is claimed for "my-branch"
    Then the result is "pushed"
    And the tip text equals setFieldInText to in-progress plus appendNoteToText with the claim note, timestamps aside

  @test:scripts/tests/sdlc/claim-branch-store.test.ts::claiming_on_the_branch_store::A_SIBLING_THAT_WROTE_FIRST_IS_A_CONFLICT,_caught_on_the_first_attempt_—_bean_35nj
  Scenario: A sibling's earlier claim makes ours already-claimed, and its write stands
    Given a sibling store has already pushed the bean as in-progress "Claimed by their-branch"
    When the bean is claimed for "my-branch"
    Then the result is "already-claimed" with heldBy "their-branch"
    And the tip still carries "Claimed by their-branch" and not "Claimed by my-branch"

  @test:scripts/tests/sdlc/claim-branch-store.test.ts::claiming_on_the_branch_store::THE_REAL_CONFLICT:_a_sibling_writes_BETWEEN_our_read_and_our_write_—_`expect`_catches_it
  Scenario: A sibling writing between our read and our push is caught as a conflict
    Given a beforePush hook that has a sibling store push its own claim of the bean
    When the bean is claimed for "my-branch"
    Then the hook ran
    And the result is "already-claimed" with a reason saying "between this read and this write"
    And the tip carries "Claimed by their-branch" and not "Claimed by my-branch"

  @test:scripts/tests/sdlc/claim-branch-store.test.ts::claiming_on_the_branch_store::already_in-progress_with_no_readable_holder_is_`held-unknown`,_never_a_silent_pass
  Scenario: An in-progress bean with no readable holder is held-unknown
    Given a beans branch store whose bean is already "in-progress" with no claim note
    When the bean is claimed for "my-branch"
    Then the result is "held-unknown"

  @test:scripts/tests/sdlc/claim-branch-store.test.ts::claiming_on_the_branch_store::a_closed_bean_is_`already-closed`,_carrying_the_status_it_was_closed_as
  Scenario: A closed bean is already-closed with its closing status
    Given a beans branch store whose bean is "completed"
    When the bean is claimed for "my-branch"
    Then the result is "already-closed" with closedAs "completed"

  @test:scripts/tests/sdlc/claim-branch-store.test.ts::claiming_on_the_branch_store::`dry-run`_reports_without_writing
  Scenario: A dry run reports the claim without writing it
    Given a beans branch store holding a "todo" bean
    When the bean is claimed for "my-branch" as a dry run
    Then the result is "pushed" with a reason saying "would claim"
    And the bean on the tip still reads "status: todo"

  @test:scripts/tests/sdlc/claim-branch-store.test.ts::claiming_on_the_branch_store::an_unknown_id_is_`unknown`_with_a_reason,_not_a_claim_of_something_else
  Scenario: An unknown id is unknown with a reason
    Given a beans branch store holding bean fx-aaaa
    When the id "nope" is claimed
    Then the result is "unknown" with a reason saying no bean matches "nope"

  @test:scripts/tests/sdlc/claim-branch-store.test.ts::claiming_on_the_branch_store::`fell-back`_is_NEVER_returned_here_—_after_the_cutover_a_PR_branch_has_no_beans/_to_hold_a_claim
  Scenario: A claim on the branch store never falls back
    Given branch stores whose bean is "todo", "in-progress" or "completed"
    When the bean is claimed in each, and the id "nope" is claimed
    Then no result is "fell-back"

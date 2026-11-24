# .github/workflows/standing-repin.yml's PR step, run against stub gh and git:
# it never merges and never asks for auto-merge, on any trigger, and labels the
# PR needs-repin for the merge manager (owner, 2026-11-13, card "C. No auto-merge").
# Each Scenario names the test that executes it.
Feature: Standing repin leaves the merge to the merge manager

  @test:scripts/tests/sdlc/standing-repin-merge.test.ts::standing_repin_never_merges:_it_labels_needs-repin_on_every_trigger::the_step_labels_with_needs-repin_and_has_no_merge_method
  Scenario: The PR step labels with needs-repin and carries no merge method
    Given the "Open or update the one repin PR" step of standing-repin.yml
    When its environment and script are read
    Then REPIN_LABEL is "needs-repin"
    And there is no METHOD and no "--auto" in the script

  @test:scripts/tests/sdlc/standing-repin-merge.test.ts::standing_repin_never_merges:_it_labels_needs-repin_on_every_trigger::%s:_the_new_PR_is_labelled_needs-repin,_and_auto-merge_is_never_asked_for
  Scenario Outline: Every trigger labels the new PR needs-repin and never asks for auto-merge
    Given no open repin PR
    When the step runs for a <event> event
    Then it opens the repin PR, labels it "needs-repin" and turns auto-merge off
    And no call asks for "--auto"
    And the step summary says this workflow never merges it

    Examples:
      | event               |
      | workflow_dispatch   |
      | schedule            |
      | repository_dispatch |

  @test:scripts/tests/sdlc/standing-repin-merge.test.ts::standing_repin_never_merges:_it_labels_needs-repin_on_every_trigger::a_run_updating_the_open_repin_PR_labels_that_PR_and_turns_its_auto-merge_off
  Scenario: A run updating the open repin PR labels it and turns its auto-merge off
    Given an open repin PR #7
    When the step runs for a workflow_dispatch event
    Then no PR is created
    And #7 is retitled, labelled "needs-repin" and has auto-merge disabled

  @test:scripts/tests/sdlc/standing-repin-merge.test.ts::standing_repin_never_merges:_it_labels_needs-repin_on_every_trigger::a_label_that_cannot_be_added_fails_the_run,_so_the_merge_manager_is_not_left_unaware
  Scenario: A label that cannot be added fails the run
    Given gh refuses to add the label
    When the step runs for a schedule event
    Then the step fails
    And no call asks for "--auto"

  @test:scripts/tests/sdlc/standing-repin-merge.test.ts::standing_repin_creates_the_needs-repin_label_where_the_repository_has_none_(owner,_card_2026-11-18)::a_repository_without_the_label_gets_it_created,_before_the_PR_is_labelled
  Scenario: A repository without the needs-repin label gets it created before the PR is labelled
    Given a repository whose labels do not include "needs-repin"
    When the PR step runs
    Then it creates "needs-repin" with a colour and a description
    And then labels the PR "needs-repin", and the run passes

  @test:scripts/tests/sdlc/standing-repin-merge.test.ts::standing_repin_creates_the_needs-repin_label_where_the_repository_has_none_(owner,_card_2026-11-18)::a_repository_that_has_the_label_is_left_as_it_is:_no_create,_no_--force
  Scenario: A repository that has the label is left as it is
    Given a repository that has "needs-repin"
    When the PR step runs
    Then it creates no label and labels the PR

  @test:scripts/tests/sdlc/standing-repin-merge.test.ts::standing_repin_creates_the_needs-repin_label_where_the_repository_has_none_(owner,_card_2026-11-18)::the_create_is_idempotent:_a_refused_create_is_a_warning,_and_the_labelling_still_decides
  Scenario: A refused create is a warning, and the labelling still decides
    Given a repository without the label whose label create is refused
    When the PR step runs
    Then it never passes --force to a label command
    And it still labels the PR, and the run passes

  @test:scripts/tests/sdlc/standing-repin-merge.test.ts::standing_repin_creates_the_needs-repin_label_where_the_repository_has_none_(owner,_card_2026-11-18)::a_label_that_still_cannot_be_added_after_the_create_fails_the_run,_as_before
  Scenario: A label that cannot be added after the create still fails the run
    Given a repository without the label, where adding the label fails
    When the PR step runs
    Then the run fails

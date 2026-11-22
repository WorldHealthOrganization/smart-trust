# .github/scripts/layer-pr-checks/state-pin.sh, driven through bash against stand-in remotes: the
# branch-kept graphs are served at the run's pinned tips, and a branch main's record does not name
# (seeded after main's last push, dth-sfp#13) is served at the run's live read, not as absent.
# Each Scenario names the test that executes it.
Feature: The state mount serves a branch seeded or moved forward after main's record

  @test:test/layer-state-pin.test.ts::state-pin.sh_and_branches_seeded_after_main's_record::pinned_tips_are_served_as_pinned,_not_at_the_remote's_tip
  Scenario: Pinned tips are served as pinned
    Given a remote whose beans branch moved past the pinned commit
    When state-pin.sh serves the pin
    Then the mirror serves beans at the pinned commit

  @test:test/layer-state-pin.test.ts::state-pin.sh_and_branches_seeded_after_main's_record::without_a_live_read,_a_branch_the_record_lacks_is_absent,_as_before
  Scenario: Without a live read a branch the record lacks is absent
    Given a pin that names the repository with no branches
    When state-pin.sh serves the pin with no live read
    Then the mirror serves no branch

  @test:test/layer-state-pin.test.ts::state-pin.sh_and_branches_seeded_after_main's_record::a_branch_the_record_lacks_is_served_at_the_live_read's_tip
  Scenario: A branch the record lacks is served at the live read's tip
    Given main's record names the repository with no branches
    And the run's live read has beans and todos
    When state-pin.sh serves the pin with the live read
    Then the mirror serves beans and todos at the live read's tips

  @test:test/layer-state-pin.test.ts::state-pin.sh_and_branches_seeded_after_main's_record::the_record's_tips_win_over_the_live_read_for_a_branch_both_name
  Scenario: The record's tips win for a branch both name
    Given main's record pins beans at an older commit
    And the run's live read has beans at a newer commit and todos
    When state-pin.sh serves the pin with the live read
    Then beans is served at the record's commit and todos at the live read's

  @test:test/layer-state-pin.test.ts::state-pin.sh_and_branches_seeded_after_main's_record::a_beans_branch_whose_live_tip_descends_from_the_record's_is_served_at_the_live_tip
  Scenario: A beans branch moved forward since the record is served at the live tip
    Given main's record pins a beans branch at a commit
    And two approval records were pushed on top of it since
    When state-pin.sh serves the pin with the live read
    Then the mirror serves beans at the live tip

  @test:test/layer-state-pin.test.ts::state-pin.sh_and_branches_seeded_after_main's_record::a_beans_branch_whose_live_tip_does_not_descend_from_the_record's_keeps_the_record's_tip
  Scenario: A rewritten beans branch keeps the record's tip
    Given main's record pins a beans branch at a commit
    And the live tip does not descend from it
    When state-pin.sh serves the pin with the live read
    Then the mirror serves beans at the record's commit

  @test:test/layer-state-pin.test.ts::state-pin.sh_and_branches_seeded_after_main's_record::a_beans_branch_whose_record_tip_lies_beyond_the_fetched_history_keeps_the_record's_tip
  Scenario: A record tip beyond the fetched history keeps the record's tip
    Given the live tip is two commits ahead of the record's
    And STATE_PIN_DEPTH is 1
    When state-pin.sh serves the pin with the live read
    Then the mirror serves beans at the record's commit

  @test:test/layer-state-pin.test.ts::state-pin.sh_and_branches_seeded_after_main's_record::a_branch_other_than_beans_that_moved_keeps_the_record's_tip
  Scenario: A moved branch other than beans keeps the record's tip
    Given main's record pins todos at a commit
    And the live todos tip descends from it
    When state-pin.sh serves the pin with the live read
    Then the mirror serves todos at the record's commit

  @test:test/layer-state-pin.test.ts::state-pin.sh_and_branches_seeded_after_main's_record::a_repository_the_record_does_not_name_is_pinned_at_the_live_read
  Scenario: A repository the record does not name is pinned at the live read
    Given main's record names no repository
    And the run's live read has todos
    When state-pin.sh serves the pin with the live read
    Then the repository is rewritten to a mirror serving todos

  @test:test/layer-state-pin.test.ts::state-pin.sh_and_branches_seeded_after_main's_record::a_live-read_path_that_does_not_exist_changes_nothing
  Scenario: A missing live read changes nothing
    Given a live-read path with no file
    When state-pin.sh serves the pin
    Then it rewrites the one pinned repository

  @test:test/layer-state-pin.test.ts::state-pin.sh_and_branches_seeded_after_main's_record::the_workflow_keeps_the_live_read_before_the_record_replaces_it,_and_hands_it_to_the_mount
  Scenario: The workflow keeps the live read and hands it to the mount
    Given layer-pr-checks.yml
    Then the pin step copies state.json to state-live.json before main's record replaces it
    And every state mount passes state-live.json to state-pin.sh

# The milestone closure: transitive, cycle-safe, and with three status
# buckets. Each Scenario names the test that executes it.
Feature: Rolling beans up to their milestones

  @test:scripts/tests/milestone-rollup.test.ts::milestoneRollup::rolls_a_two-level_closure_up_and_derives_the_share_from_the_counts
  Scenario: A two-level closure rolls up and the share comes from the counts
    Given a milestone with an epic holding completed, scrapped, todo and in-progress tasks
    When the beans are rolled up
    Then there is one milestone with 5 descendants, 1 epic, 2 closed, 3 open, 2 in progress, 1 todo, and a share of 2/5

  @test:scripts/tests/milestone-rollup.test.ts::milestoneRollup::descends_through_an_epic_nested_under_an_epic
  Scenario: The closure descends through an epic nested under an epic
    Given a milestone, an epic, an epic under it and a completed task under that
    When the beans are rolled up
    Then the milestone has 3 descendants, 1 closed, and 1 direct epic

  @test:scripts/tests/milestone-rollup.test.ts::milestoneRollup::terminates_on_a_parent_cycle_instead_of_hanging
  Scenario: A parent cycle terminates instead of hanging
    Given three epics in a chain under a milestone, the rollup counts 3 descendants
    When the chain is re-parented into a cycle unreachable from the milestone
    Then the rollup returns with the milestone empty and the three epics counted as open orphans

  @test:scripts/tests/milestone-rollup.test.ts::milestoneRollup::counts_a_status_in_neither_set_on_its_own,_in_neither_figure
  Scenario: A status in neither set is counted on its own
    Given a milestone's epic holding a parked task and a completed task
    When the beans are rolled up
    Then one is unclassified, one closed, one open (the epic), and the share is 1/2 over the classified beans

  @test:scripts/tests/milestone-rollup.test.ts::milestoneRollup::reports_open_beans_under_no_milestone,_and_does_not_count_them_as_any_milestone's
  Scenario: Open beans under no milestone are reported and not counted as any milestone's
    Given a milestone's epic with a todo task, and a loose epic with two open tasks and a completed one
    When the beans are rolled up
    Then the milestone has 2 descendants, there are 3 open orphans and 6 open beans in all
    And the 2 covered open beans, the 3 orphans and the open milestone sum to the open total

  @test:scripts/tests/milestone-rollup.test.ts::milestoneRollup::gives_a_milestone_with_no_descendants_a_null_share_rather_than_0%
  Scenario: A milestone with no descendants has a null share
    When a lone milestone is rolled up
    Then it has no descendants and its share is null

  @test:scripts/tests/milestone-rollup.test.ts::milestoneRollup::orders_milestones_by_id,_so_a_report_does_not_reorder_between_runs
  Scenario: Milestones are ordered by id
    When milestones zzz, aaa and mmm are rolled up
    Then they come back aaa, mmm, zzz

  @test:scripts/tests/milestone-rollup.test.ts::milestoneRollup::orders_milestones_by_title,_numerically,_so_GOAL_1..10_read_in_order_whatever_their_ids
  Scenario: Milestones are ordered by title, numerically
    Given milestones titled GOAL 5, 2, 10, 1 and 3 under unrelated ids
    When they are rolled up
    Then they come back in goal order 1, 2, 3, 5, 10

  @test:scripts/tests/milestone-rollup.test.ts::milestoneRollup::counts_a_duplicated_id_once_and_reports_that_it_was_duplicated
  Scenario: A duplicated id is counted once and reported
    Given two beans with one id under a milestone's epic
    When the beans are rolled up
    Then one duplicate id is reported, the milestone has 2 descendants, 2 are covered open, and the totals reconcile

  @test:scripts/tests/milestone-rollup.test.ts::milestoneRollup::returns_no_milestones,_rather_than_throwing,_for_a_store_with_none
  Scenario: A store with no milestones returns none
    Given an epic and its task with no milestone
    When the beans are rolled up
    Then there are no milestones, 2 open orphans and none covered

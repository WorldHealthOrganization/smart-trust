# scripts/bean-burndown-feed.ts builds the epic and milestone burndown feed from day snapshots of
# the bean store branch, fetching that branch's history into a local ref first.
# Each Scenario names the test that executes it.
Feature: Bean burndown feed

  @test:scripts/tests/bean-burndown-feed.test.ts::burndownTargets::open_milestones_and_epics_only,_in_id_order
  Scenario: Only open milestones and epics are burndown targets, in id order
    Given beans e2 (todo epic), m1 (in-progress milestone), e1 (completed epic), t1 (todo task) and e0 (scrapped epic)
    When the burndown targets are chosen
    Then they are e2 and m1, in that order

  @test:scripts/tests/bean-burndown-feed.test.ts::buildBurndownFeed::columns_align_with_the_shared_day_axis;_a_day_before_the_epic_existed_is_null,_not_0
  Scenario: Series columns follow the shared day axis, with null before the epic existed
    Given three day snapshots where epic "e" first appears on the second day with children k1 and k2
    And on the third day k1 is completed and k2 keeps an unrecognised status
    When the feed is built for epic "e"
    Then the feed is available, carries the store location and has days 2026-10-01, 2026-10-02 and 2026-10-03
    And the commits are the 12-character prefixes of each snapshot's commit
    And the series for "e" has open null, 1, 0, closed null, 0, 1 and other null, 1, 1

  @test:scripts/tests/bean-burndown-feed.test.ts::buildBurndownFeed::no_targets_is_an_empty_series_list_over_a_real_day_axis,_not_an_unavailable_feed
  Scenario: No targets gives an empty series list over the real day axis
    Given the same three day snapshots
    When the feed is built with no targets
    Then the series list is empty
    And the feed still has 3 days

  @test:scripts/tests/bean-burndown-feed.test.ts::fetchBeanHistory::fetches_the_store_branch_into_a_local_ref_the_snapshots_read_from
  Scenario: The store branch is fetched into a local ref the snapshots read from
    Given an upstream repository whose "cat/x/beans" branch has a commit on 2026-10-20 with epic "e" and task "k" open, and one on 2026-10-21 with "k" completed
    And a shallow clone of it with no checkout
    When the bean history is fetched for that branch
    Then the result is the branch's history ref
    And the snapshots read from that ref give days 2026-10-20 and 2026-10-21 with epic "e" open 1, 0 and closed 0, 1
    And when a branch mount records the first day's commit as the mounted tip, the mounted tip is that commit
    And fetching again pins the ref so the snapshots give only day 2026-10-20

  @test:scripts/tests/bean-burndown-feed.test.ts::fetchBeanHistory::an_unreachable_branch_is_a_reason,_never_an_empty_history
  Scenario: An unreachable store branch gives a reason, not an empty history
    Given an empty git repository
    When the bean history is fetched for branch "nope" from a web location that does not exist
    Then the result carries a reason

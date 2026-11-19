# scripts/epic-burndown.ts counts an epic's open and closed descendant beans per snapshot, parses a bean's front matter,
# and reads one snapshot per day from the bean store's git history.
# Each Scenario names the test that executes it.
Feature: Epic burndown from bean history

  @test:scripts/tests/epic-burndown.test.ts::pointFor::counts_the_transitive_closure,_and_an_unknown_status_on_its_own
  Scenario: An epic's point counts its transitive descendants, with unknown statuses apart
    Given epic "E" with feature "F" under it, tasks under both with statuses completed, scrapped, draft and "weird", and an unrelated todo
    When the point for "E" is computed
    Then it is present with 2 open, 2 closed, 1 unclassified and 5 in total

  @test:scripts/tests/epic-burndown.test.ts::pointFor::an_epic_not_yet_in_the_store_is_no_data,_not_zero
  Scenario: An epic absent from the snapshot has no data rather than zero
    Given a snapshot holding only an unrelated bean
    When the point for "E" is computed
    Then it is not present and its open, closed and total counts are null

  @test:scripts/tests/epic-burndown.test.ts::pointFor::a_parent_cycle_is_counted_once_and_does_not_hang
  Scenario: A parent cycle is counted once without hanging
    Given epics "E" and "G" each parented by the other, and a task under "G"
    When the point for "E" is computed
    Then it has 2 open and 2 in total

  @test:scripts/tests/epic-burndown.test.ts::parseBeanState::reads_id,_status,_type_and_parent;_refuses_a_file_with_no_front_matter
  Scenario: A bean's front matter gives its id, status, type and parent
    When a bean file whose front matter names "fa-x", status "todo", type "task" and parent "fa-e" is parsed
    Then exactly those four fields are returned
    When text with no front matter is parsed
    Then nothing is returned

  @test:scripts/tests/epic-burndown.test.ts::snapshotsFromGit::one_point_per_day_from_the_store's_history,_the_archive_included
  Scenario: The burndown has one point per day with a commit, reading the archive too
    Given a scratch git repository where epic "E" and tasks "t1" and "t2" appear on 2026-10-02, "t1" is completed later that day, and "t2" is completed into the archive on 2026-10-04
    When the burndown of "E" is read from 30 days of history
    Then the points are 2026-10-01 with no data, 2026-10-02 with 1 open and 1 closed, and 2026-10-04 with 0 open and 2 closed
    And 2026-10-03, which had no commit, has no point
    When the burndown is read from only 2 snapshots
    Then the days are 2026-10-02 and 2026-10-04

# StateStore over a real bare remote: paths relative to the declared
# directory, writes that splice and never overwrite blind, and concurrent
# edits that lose nothing. Each Scenario names the test that executes it.
Feature: State store

  Background:
    Given a state branch seeded with a manifest, beans/defs files including a nested one, a valid and an invalid JSON file, and todos/t.md

  @test:scripts/tests/state-store.test.ts::paths_are_relative_to_the_DECLARED_directory::a_read_names_the_file,_never_the_directory's_prefix
  Scenario: Reads name files relative to the declared directory
    Given a store for beans-defs at beans/defs
    Then its branch path is beans/defs, and a.md's is beans/defs/a.md
    And reading a.md hits with its front matter, and nested/c.md hits

  @test:scripts/tests/state-store.test.ts::paths_are_relative_to_the_DECLARED_directory::a_`..`_segment_is_refused,_so_one_id_cannot_read_another's_state
  Scenario: A .. segment is refused
    Then the branch path "../../todos/t.md" throws a usage error
    And the todos store can read t.md

  @test:scripts/tests/state-store.test.ts::paths_are_relative_to_the_DECLARED_directory::listDir_and_readTree_are_scoped_to_the_directory
  Scenario: Listing and tree reads are scoped
    Then the directory lists a.md, bad.json, nested and obj.json
    And the tree holds beans/defs/nested/c.md and nothing under todos/

  @test:scripts/tests/state-store.test.ts::paths_are_relative_to_the_DECLARED_directory::readJson_parses,_and_unparseable_JSON_is_corrupt_rather_than_missing
  Scenario: readJson parses, and bad JSON is corrupt
    Then obj.json hits with n 1
    And bad.json is "corrupt" and nope.json is a "miss"

  @test:scripts/tests/state-store.test.ts::writes_splice,_and_never_overwrite_blind::a_write_lands_at_the_directory's_path_on_the_branch
  Scenario: A write lands at the directory's path
    When new.md is written expecting it absent
    Then it is pushed at beans/defs/new.md
    And todos/t.md is carried across unchanged

  @test:scripts/tests/state-store.test.ts::writes_splice,_and_never_overwrite_blind::an_`expect`_the_tip_disagrees_with_is_a_conflict_that_pushes_nothing
  Scenario: A stale expectation is a conflict
    Given one container read a.md and another then rewrote it
    When the first writes a.md expecting the blob it read
    Then the result is a conflict naming beans/defs/a.md and the expected blob
    And the tip is unchanged

  @test:scripts/tests/state-store.test.ts::two_sessions_editing_the_SAME_bean_—_bean_2h76's_measurement::update()_re-reads_and_re-applies,_so_neither_edit_is_lost
  Scenario: update re-applies after a race so neither edit is lost
    Given a sibling appends to a.md and pushes while this update is mid-write
    When this update appends to a.md
    Then it is pushed after the race
    And a.md keeps its front matter and both appended lines

  @test:scripts/tests/state-store.test.ts::two_sessions_editing_the_SAME_bean_—_bean_2h76's_measurement::update()_reports_conflict_rather_than_looping_forever_when_it_cannot_settle
  Scenario: update reports a conflict when it cannot settle
    Given a sibling rewrites a.md before every push
    When an update is tried with 2 attempts
    Then it is a conflict "after 2 read-modify-write attempts"

  @test:scripts/tests/state-store.test.ts::two_sessions_editing_the_SAME_bean_—_bean_2h76's_measurement::a_creator_that_loses_the_race_is_told,_not_silently_second
  Scenario: A second creator of a file is told
    Given another container created fresh.md
    When this one creates fresh.md expecting it absent
    Then the result is a conflict

  @test:scripts/tests/state-store.test.ts::two_sessions_editing_the_SAME_bean_—_bean_2h76's_measurement::update()_on_unchanged_content_pushes_nothing
  Scenario: An update that changes nothing pushes nothing
    When a.md is updated to its own content
    Then the result is "unchanged" and the tip is unchanged

  @test:scripts/tests/state-store.test.ts::the_declaration_is_the_source_of_the_branch::openFor_refuses_an_id_no_declaration_carries
  Scenario: openFor refuses an undeclared id
    Then opening a store for an id no declaration carries throws a usage error

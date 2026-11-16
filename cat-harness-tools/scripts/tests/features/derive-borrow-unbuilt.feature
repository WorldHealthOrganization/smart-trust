# scripts/derive-at-publish.ts: a preview build borrows main's copy of an index writer's
# outputs instead of running it. unbuiltOnlyBy names the artefacts that copy leaves unbuilt,
# and the writer then runs. Each Scenario names the test that executes it.
Feature: A borrowed index copy that misses a newly declared artefact does not stand in for the writer

  @test:scripts/tests/derive-borrow-unbuilt.test.ts::unbuiltOnlyBy::names_a_declared_directory_the_borrowed_copy_left_absent
  Scenario: A directory declared after main's copy was made is named
    Given main's copy of "node-kind:pages" holds "bean/" and not "work-plan/"
    When the artefacts only "node-kind:pages" builds are checked
    Then "cat-harness/work-plan/" is named

  @test:scripts/tests/derive-borrow-unbuilt.test.ts::unbuiltOnlyBy::an_empty_directory_is_not_built
  Scenario: An empty directory counts as not built
    Given a declared directory with no files in it
    When the artefacts only its writer builds are checked
    Then it is named

  @test:scripts/tests/derive-borrow-unbuilt.test.ts::unbuiltOnlyBy::nothing_when_every_artefact_of_the_writer_is_built
  Scenario: A borrowed copy that covers every artefact is kept
    Given every artefact of "node-kind:pages" holds a file
    When the artefacts only "node-kind:pages" builds are checked
    Then nothing is named

  @test:scripts/tests/derive-borrow-unbuilt.test.ts::unbuiltOnlyBy::ignores_artefacts_another_writer_also_builds,_or_only_other_writers_build
  Scenario: Artefacts shared with or owned by another writer are not this writer's to rebuild
    Given an unbuilt artefact written by two writers and one written only by another writer
    When the artefacts only "node-kind:pages" builds are checked
    Then nothing is named

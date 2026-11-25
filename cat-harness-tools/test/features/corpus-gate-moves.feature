# changedContentFiles in src/workflow/corpus-gate.ts turns git name-status lines into the
# content files the corpus gate must judge. Each Scenario names the test that executes it.
Feature: Corpus gate treats moves by similarity

  @test:test/corpus-gate-moves.test.ts::changedContentFiles::a_pure_move_is_not_an_edit
  Scenario: A pure move is not an edit
    Given a rename line with similarity R100
    When the changed content files are listed
    Then the list is empty

  @test:test/corpus-gate-moves.test.ts::changedContentFiles::a_move_that_also_edits_keeps_its_new_path
  Scenario: A move that also edits is listed at its new path
    Given a rename line with similarity R087 from "folio/d/a/t.md" to "folio/d/b/t.md"
    When the changed content files are listed
    Then the list is "folio/d/b/t.md"

  @test:test/corpus-gate-moves.test.ts::changedContentFiles::modified_and_added_files_are_kept
  Scenario: Modified and added files are listed
    Given an M line for "folio/d/a/p.md", an A line for "folio/d/a/q.ts" and a blank line
    When the changed content files are listed
    Then the list is "folio/d/a/p.md" and "folio/d/a/q.ts"

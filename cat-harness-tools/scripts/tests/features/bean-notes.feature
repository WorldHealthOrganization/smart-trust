# scripts/bean-notes.ts writes each branch's notes on a bean to a file of its own under beans/notes/,
# named from the note's front matter, and checks the notes and their index; run against scratch
# git repositories with real merges. Each Scenario names the test that executes it.
Feature: Bean notes merge without conflict

  @test:scripts/tests/bean-notes.test.ts::two_branches'_notes_on_ONE_bean,_same_day:_disjoint_paths,_and_git_merges_them_cleanly
  Scenario: Two branches' notes on one bean on the same day get disjoint paths and git merges them cleanly
    Given a scratch repository on main with bean "folio-assistant-ob3m"
    And branches "claude/finding-3" and "claude/finding-10" each adding a note dated "2026-10-02" without the index
    When both branches are merged into main
    Then the two note paths differ
    And both merges succeed with no "CONFLICT"
    And both note files exist
    And the bean file's only commit is still "base"

  @test:scripts/tests/bean-notes.test.ts::with_the_regenerated_index_committed_too,_the_ONLY_conflict_is_the_index,_and_the_declared_pattern_resolves_it
  Scenario: With the regenerated index committed too, the only conflict is the index and its declared pattern resolves it
    Given two branches each adding a note and committing the regenerated beans/notes/README.md
    When the first is merged into main and main is merged into the second
    Then the merge fails with only beans/notes/README.md conflicted
    And that path's merge strategy is "generated-regions"
    And resolving its generated regions and regenerating the index leaves no findings and no staleness
    And the index names both "claude/finding-3" and "claude/finding-10"

  @test:scripts/tests/bean-notes.test.ts::the_convention_it_replaces_—_both_branches_appending_to_the_bean_—_conflicts,_and_the_bot_refuses_it
  Scenario: Both branches appending to the bean, the convention replaced, conflicts and the bot refuses it
    Given branches "claude/append-a" and "claude/append-b" each appending a section to the bean file
    When both are merged into main
    Then the second merge reports "CONFLICT"
    And the bean file's merge strategy is "refuse"

  @test:scripts/tests/bean-notes.test.ts::one_branch's_second_note_on_a_bean_is_a_section_in_its_own_file,_not_a_new_file
  Scenario: One branch's second note on a bean is a section in its own file, not a new file
    Given a note "first" on branch "claude/x" dated "2026-10-02"
    When a note "second" on the same branch dated "2026-10-03" is added
    Then it is written to the same file
    And that file holds the sections "## first" and "## second"
    And the check finds nothing

  @test:scripts/tests/bean-notes.test.ts::the_name_is_derived_from_the_note's_own_front_matter;_a_hand-named_note_is_a_finding
  Scenario: A note's name is derived from its own front matter and a hand-named note is a finding
    Given a note added on branch "claude/x" dated "2026-10-02"
    Then its path ends with the derived note file name
    When it is renamed by hand to "folio-assistant-ob3m.md" and the notes are checked
    Then the only finding is that file
    And it says the file was "named by hand"

  @test:scripts/tests/bean-notes.test.ts::a_file_without_the_tag,_or_naming_a_bean_that_does_not_exist,_is_a_finding_—_never_skipped
  Scenario: A file without front matter, or a note naming a bean that does not exist, is a finding
    Given a notes directory holding "loose.md" with plain prose
    And a correctly named note for bean "folio-assistant-zzzz", which does not exist
    When the notes are checked
    Then a finding says "no front matter"
    And a finding says "no declared definitions directory holds" the bean

  @test:scripts/tests/bean-notes.test.ts::two_branch_names_that_slug_alike_are_refused_at_write_time_rather_than_merged_into_one_file
  Scenario: Two branch names that slug alike are refused at write time rather than merged into one file
    Given branch names "a/b" and "a-b", which slug alike
    And a note added on branch "a/b"
    When a note on branch "a-b" for the same bean and date is added
    Then it throws naming "another branch"

  @test:scripts/tests/bean-notes.test.ts::a_stale_index_fails_the_check
  Scenario: A stale notes index fails the check
    Given a note added on branch "claude/x"
    And beans/notes/README.md overwritten with just a heading
    When the notes are checked
    Then the index is stale

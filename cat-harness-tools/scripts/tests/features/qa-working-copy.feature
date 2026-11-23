# The QA working copy is stamped with the tree it was built from, and regen
# rebuilds it before any pass would read a stale one (bean 7how). The fixture
# repository's QA writer copies src.txt into the ignored qa/ root. Each
# Scenario names the test that executes it.
Feature: The QA working copy is never read when built from another tree

  @test:scripts/tests/qa-working-copy.test.ts::the_stamp_says_which_tree_the_copy_was_built_from::no_stamp_is_STALE,_never_current_—_a_copy_nobody_stamped_could_be_from_any_tree
  Scenario: An unstamped copy is stale
    Given a qa/ copy written by hand with no stamp
    Then the working copy state is "stale"

  @test:scripts/tests/qa-working-copy.test.ts::the_stamp_says_which_tree_the_copy_was_built_from::built_here,_nothing_moved:_CURRENT,_and_a_second_ensure_builds_nothing
  Scenario: A copy built here with nothing moved is current
    When the working copy is ensured
    Then it ran successfully, changing "qa/copy.txt"
    And the state is "current"
    And ensuring again does not run

  @test:scripts/tests/qa-working-copy.test.ts::the_stamp_says_which_tree_the_copy_was_built_from::a_tracked_edit_makes_it_STALE,_and_ensure_rebuilds_and_reports_what_changed
  Scenario: A tracked edit makes the copy stale and ensure rebuilds it
    Given the working copy built
    When src.txt is edited
    Then the state is "stale" because the "tree changed"
    When the working copy is ensured
    Then it changes "qa/copy.txt" and the state is "current"

  @test:scripts/tests/qa-working-copy.test.ts::the_stamp_says_which_tree_the_copy_was_built_from::COMMITTING_does_not_stale_the_copy_—_the_digest_is_of_content,_not_of_git's_bookkeeping
  Scenario: Committing does not stale the copy
    Given edits to src.txt and a new file, and the working copy built
    When everything is committed
    Then the state is "current"

  @test:scripts/tests/qa-working-copy.test.ts::the_stamp_says_which_tree_the_copy_was_built_from::an_untracked,_non-ignored_file_is_part_of_the_tree_too
  Scenario: An untracked, non-ignored file is part of the tree
    Given the working copy built
    When a new untracked file is written
    Then the state is "stale"

  @test:scripts/tests/qa-working-copy.test.ts::the_stamp_says_which_tree_the_copy_was_built_from::the_copy_edited_or_partly_deleted_since_it_was_built_is_STALE_(the_#2267_partial_tree)
  Scenario: A copy edited or partly deleted since it was built is stale
    Given the working copy built
    When qa/copy.txt is edited by hand
    Then the state is "stale" because the "QA tree changed"
    When it is rebuilt and qa/copy.txt deleted
    Then the state is "stale"

  @test:scripts/tests/qa-working-copy.test.ts::the_stamp_says_which_tree_the_copy_was_built_from::a_failed_step_leaves_NO_stamp,_so_a_half-built_copy_never_reads_as_current
  Scenario: A failed step leaves no stamp
    Given the working copy built and src.txt then edited
    When the working copy is ensured with a step that exits 3
    Then it ran, not ok, with exit 3
    And there is no stamp and the state is "stale"

  @test:scripts/tests/qa-working-copy.test.ts::the_stamp_says_which_tree_the_copy_was_built_from::force_builds_even_when_current
  Scenario: force builds even when current
    Given the working copy built
    When it is ensured with force
    Then it ran

  @test:scripts/tests/qa-working-copy.test.ts::the_stamp_says_which_tree_the_copy_was_built_from::a_generator_running_INSIDE_a_build_does_not_ask_for_another_(no_recursion_through_readme:subgraphs)
  Scenario: A generator inside a build does not ask for another
    Given the building flag set
    When a current working copy is required
    Then no stamp is written

  @test:scripts/tests/qa-working-copy.test.ts::the_stamp_says_which_tree_the_copy_was_built_from::a_build's_steps_run_with_the_building_flag_set
  Scenario: A build's steps run with the building flag set
    When the working copy is ensured with a step that tests the building flag is 1
    Then it ran successfully

  @test:scripts/tests/qa-working-copy.test.ts::the_stamp_says_which_tree_the_copy_was_built_from::qaChanged_sees_edits,_additions_and_deletions
  Scenario: qaChanged sees edits, additions and deletions
    Given maps {x:1, y:2} and {x:1, y:3, z:4}
    Then the changed keys either way are "y" and "z"

  @test:scripts/tests/qa-working-copy.test.ts::regen_rebuilds_the_copy_before_a_pass_reads_it::FALSIFIER:_a_writer_changes_what_the_QA_copy_is_built_from_—_the_copy_is_rebuilt_and_its_reader_re-asked
  Scenario: A writer changing the copy's source rebuilds the copy and re-asks its reader
    Given a world where writer "s" changes src, and "u:check" reads the qa copy
    When regen runs to a fixpoint with the rebuild hook
    Then it settles, building the copy once in pass 2
    And src, qa and the reader's output all reach 2, both pairs "regenerated"

  @test:scripts/tests/qa-working-copy.test.ts::regen_rebuilds_the_copy_before_a_pass_reads_it::without_the_hook_the_same_run_settles_on_a_page_built_from_the_OLD_copy_—_what_the_hook_prevents
  Scenario: Without the hook regen settles on a page built from the old copy
    Given the same world
    When regen runs to a fixpoint without the rebuild hook
    Then it settles with the reader's output still 1

  @test:scripts/tests/qa-working-copy.test.ts::regen_rebuilds_the_copy_before_a_pass_reads_it::a_stale_copy_at_the_start_is_rebuilt_in_pass_1_and_its_reader_asked_though_--changed_declined_it
  Scenario: A stale copy at the start is rebuilt in pass 1 though --changed declined its reader
    Given a world whose copy is stale at the start, and a first pass that declines every pair
    When regen runs to a fixpoint with the rebuild hook
    Then the copy is built in pass 1, the reader's output reaches 2, "u:check" is "regenerated", and it settles

  @test:scripts/tests/qa-working-copy.test.ts::regen_rebuilds_the_copy_before_a_pass_reads_it::a_current_copy_builds_nothing_and_changes_no_selection
  Scenario: A current copy builds nothing
    Given a world where everything is current
    When regen runs to a fixpoint with the rebuild hook
    Then nothing is built, one pass runs, and both pairs are "current"

  @test:scripts/tests/qa-working-copy.test.ts::regen_rebuilds_the_copy_before_a_pass_reads_it::a_copy_that_cannot_be_built_ends_the_run_—_it_is_never_read_half-built
  Scenario: A copy that cannot be built ends the run
    Given a rebuild hook that throws "qa:refresh exited 1" after pass 1
    When regen runs to a fixpoint
    Then it rejects with "qa:refresh"

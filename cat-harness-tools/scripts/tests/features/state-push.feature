# state:push round trips through a real remote: mount, edit on disk, splice,
# without losing a sibling's write or the bytes, modes and symlinks.
# Each Scenario names the test that executes it.
Feature: Pushing mounted state

  @test:scripts/tests/state-push.test.ts::what_the_mount_holds_becomes_a_splice::no_mount_is_reported,_not_mistaken_for_nothing_to_push
  Scenario: No mount is reported as such
    Given a checkout that has not mounted state
    When state is pushed
    Then the result is "no-mount" and the report names state:mount

  @test:scripts/tests/state-push.test.ts::what_the_mount_holds_becomes_a_splice::nothing_to_push_is_not_an_error
  Scenario: Nothing to push
    Given a clean mount
    When state is pushed
    Then the result is "nothing"

  @test:scripts/tests/state-push.test.ts::what_the_mount_holds_becomes_a_splice::a_dry_run_names_each_change_and_sends_nothing
  Scenario: A dry run names each change
    Given a mount with one file edited, one created and one deleted
    When a dry run push is made
    Then the result is "would-push" and the report names the update, create and delete
    And the tip is unchanged

  @test:scripts/tests/state-push.test.ts::what_the_mount_holds_becomes_a_splice::an_edit_lands,_and_a_sibling's_write_to_ANOTHER_file_survives_it
  Scenario: An edit lands and a sibling's write to another file survives
    Given a sibling pushes todos/sib.md and this checkout edits todos/a.md
    When state is pushed
    Then it is pushed, the branch has the edit, the sibling's file and the manifest

  @test:scripts/tests/state-push.test.ts::what_the_mount_holds_becomes_a_splice::a_sibling's_edit_to_the_SAME_file_is_a_conflict,_nothing_is_pushed,_and_the_edit_is_kept
  Scenario: A sibling's edit to the same file is a conflict
    Given a sibling pushes a change to todos/a.md and this checkout edits it too
    When state is pushed
    Then the run fails with todos in "conflict"
    And the branch keeps the sibling's text, the local edit is kept, and the report names todos/a.md

  @test:scripts/tests/state-push.test.ts::what_the_mount_holds_becomes_a_splice::a_mount_whose_declaration_was_removed_is_still_pushed_—_its_edits_are_not_stranded
  Scenario: A mount whose declaration is gone is still pushed
    Given the declaration file is deleted and todos/a.md edited
    When state is pushed
    Then it is pushed and the branch holds the edit

  @test:scripts/tests/state-push.test.ts::an_emptied_mount_is_not_pushed_as_a_deletion_(bean_sp0e)::a_mount_whose_files_are_all_gone_is_refused,_and_the_branch_keeps_them
  Scenario: An emptied mount is refused
    Given the todos directory is removed
    When state is pushed
    Then it is not pushed, todos is refused, the report names --allow-empty and the tip is unchanged

  @test:scripts/tests/state-push.test.ts::an_emptied_mount_is_not_pushed_as_a_deletion_(bean_sp0e)::--allow-empty_deletes_the_graph_when_that_is_meant
  Scenario: --allow-empty pushes the deletion
    Given the todos directory is removed
    When state is pushed with allow-empty
    Then it is pushed and the tip moves

  @test:scripts/tests/state-push.test.ts::an_emptied_mount_is_not_pushed_as_a_deletion_(bean_sp0e)::deleting_SOME_files_is_an_ordinary_edit_and_still_pushes
  Scenario: Deleting some files is an ordinary edit
    Given one file of the mount is deleted
    When state is pushed
    Then it is pushed

  @test:scripts/tests/state-push.test.ts::an_emptied_mount_is_not_pushed_as_a_deletion_(bean_sp0e)::the_flag_is_understood
  Scenario: --allow-empty is a known flag
    Then --allow-empty is not an unknown argument

  @test:scripts/tests/state-push.test.ts::an_emptied_mount_is_not_pushed_as_a_deletion_(bean_sp0e)::deleting_more_than_50%_of_a_mount's_files_without_replacement_is_refused_unless_--allow-mass-delete_is_passed_(bean_1ple)
  Scenario: A mass deletion needs --allow-mass-delete
    Given three of four mounted files are deleted
    When state is pushed
    Then it is not pushed, todos is refused, the report names --allow-mass-delete and the tip is unchanged
    And pushing with allow-mass-delete succeeds and moves the tip
    And --allow-mass-delete is a known flag

  @test:scripts/tests/state-push.test.ts::bytes,_modes_and_symlinks_round-trip_through_the_commands::a_binary_arrives_unchanged_on_the_mount
  Scenario: A binary is mounted unchanged
    Given a branch holding a PDF
    When it is mounted
    Then todos/doc.pdf has the same bytes

  @test:scripts/tests/state-push.test.ts::bytes,_modes_and_symlinks_round-trip_through_the_commands::a_new_binary,_an_executable_bit_and_a_symlink_are_pushed_as_git_records_them,_and_mount_back_the_same
  Scenario: Binaries, executable bits and symlinks round-trip
    Given a new binary, an executable script and a symlink in the mount
    When state is pushed
    Then the branch holds the binary's bytes, mode 100755 for the script and a 120000 link to a.md
    And a second checkout mounts the same binary, an executable script, the symlink and the PDF

  @test:scripts/tests/state-push.test.ts::arguments_it_does_not_understand_stop_it_before_it_pushes::an_unknown_flag_is_refused
  Scenario: Unknown flags are refused
    Then --help is unknown
    And --force after a valid --id is unknown

  @test:scripts/tests/state-push.test.ts::arguments_it_does_not_understand_stop_it_before_it_pushes::the_flags_it_knows_pass,_with_their_values
  Scenario: Known flags pass with their values
    Then --id, -m with a message, --dry-run and --json are all understood
    And no arguments are understood

  @test:scripts/tests/state-push.test.ts::arguments_it_does_not_understand_stop_it_before_it_pushes::a_valued_flag_with_no_value_is_refused,_not_read_as_the_next_flag
  Scenario: A valued flag with no value is refused
    Then a bare -m is reported as needing a value
    And --id followed by --dry-run is reported as --id needing a value

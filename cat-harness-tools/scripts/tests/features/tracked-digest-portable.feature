# The {tracked} digest is the same for the same tree on any machine
# (RECIPE_VERSION 5). Each Scenario names the test that executes it.
Feature: Portable tracked-tree digest

  Background:
    Given an origin repository ignoring "node_modules/" and "*.log" with one committed source file, cloned twice as "a" and "b"

  @test:scripts/tests/tracked-digest-portable.test.ts::a_portable_{tracked}_digest::two_checkouts_of_one_tree,_one_of_which_ran_state:mount,_have_one_digest
  Scenario: state:mount does not move the digest
    Given "a" ran state:mount, adding "beans/x.md" and its ignore block
    And "b" has the same "beans/x.md" untracked, with no ignore block
    Then git status of "a" shows ".gitignore" and of "b" shows "beans/"
    And both have the same tracked digest

  @test:scripts/tests/tracked-digest-portable.test.ts::a_portable_{tracked}_digest::what_a_file_holds_still_moves_it,_untracked_or_ignored
  Scenario: A file's contents still move the digest
    Given "a" ran state:mount
    When the mounted file is edited
    Then the digest changes
    When an ignored "debug.log" is added
    Then the digest changes again

  @test:scripts/tests/tracked-digest-portable.test.ts::a_portable_{tracked}_digest::an_edit_to_.gitignore_outside_the_block_still_moves_it
  Scenario: Editing .gitignore outside the block moves the digest
    Given "a" ran state:mount
    When "*.tmp" is added to .gitignore outside the block
    Then the digest changes

  @test:scripts/tests/tracked-digest-portable.test.ts::a_portable_{tracked}_digest::an_ignored_file_is_named_by_the_git_blob_id_hash-object_gives,_so_committing_it_does_not_move_the_digest
  Scenario: An ignored file is named by its blob id
    Given an ignored "debug.log" and the digest taken
    When it is un-ignored, committed, and the ignore restored and committed
    Then its index id equals what hash-object gives
    And the digest is the same as when it was ignored

  @test:scripts/tests/tracked-digest-portable.test.ts::a_portable_{tracked}_digest::an_ignored_broken_symlink_is_named_by_its_target,_not_undetermined
  Scenario: An ignored broken symlink does not leave the digest undetermined
    # Gap: the title says it is named by its target; the body checks only that a digest string is produced.
    Given an ignored symlink "dangling.log" to "nowhere"
    Then the digest is determined

  @test:scripts/tests/tracked-digest-portable.test.ts::withoutStateIgnoreBlock_undoes_withStateIgnoreBlock::the_markers_are_state-mount.ts's
  Scenario: The ignore markers are state-mount's
    Then the state ignore markers are state-mount's begin and end markers

  @test:scripts/tests/tracked-digest-portable.test.ts::withoutStateIgnoreBlock_undoes_withStateIgnoreBlock::appended_to_%p_(%s),_the_block_strips_back_to_the_same_text
  Scenario Outline: An appended block strips back to the same text
    Given a .gitignore that is <shape>
    When a state block for "beans" and "qa" is added
    Then it contains the begin marker
    And stripping it gives the stripped original, with a final newline

    Examples:
      | shape                          |
      | empty                          |
      | ending in a newline            |
      | without a final newline        |
      | holding a blank line           |

  @test:scripts/tests/tracked-digest-portable.test.ts::withoutStateIgnoreBlock_undoes_withStateIgnoreBlock::a_block_replaced_in_place,_with_other_lines_after_it,_strips_to_those_lines
  Scenario: A block replaced in place strips to the same lines
    Given a .gitignore with a state block followed by "z/"
    When the block is replaced with one for "other"
    Then stripping gives the same as stripping the original

  @test:scripts/tests/tracked-digest-portable.test.ts::withoutStateIgnoreBlock_undoes_withStateIgnoreBlock::unpaired_markers_are_left_as_they_are
  Scenario: Unpaired markers are left alone
    Then a .gitignore with a begin marker and no end marker strips to itself

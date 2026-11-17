# What scripts/check-agent-entry-links.ts and the link parser of src/core/markdown-links.ts do: find the files an agent reads first
# (AGENTS.md, CLAUDE.md, GEMINI.md) and check their links, counting a whole-line "@path" import and a link through a declared move.
# Each Scenario names the test that executes it.
Feature: Links out of the agent entry files

  @test:scripts/tests/agent-entry-links.test.ts::`@path`_is_a_link_—_the_stub's_only_reference::a_whole-line_@import_is_parsed
  Scenario: A whole-line @import is parsed as a link
    When "# CLAUDE.md", a blank line and "@AGENTS.md" are parsed for links
    Then the one link target is "AGENTS.md"

  @test:scripts/tests/agent-entry-links.test.ts::`@path`_is_a_link_—_the_stub's_only_reference::an_email_address_is_NOT_a_link
  Scenario: An email address is not a link
    When "mail me at foo@bar.com" is parsed for links
    Then no link is found

  @test:scripts/tests/agent-entry-links.test.ts::`@path`_is_a_link_—_the_stub's_only_reference::a_mid-line_@handle_is_NOT_a_link
  Scenario: A mid-line @handle is not a link
    When "thanks @someone for the fix" is parsed for links
    Then no link is found

  @test:scripts/tests/agent-entry-links.test.ts::`@path`_is_a_link_—_the_stub's_only_reference::an_@word_with_no_extension_is_NOT_a_link
  Scenario: An @word with no file extension is not a link
    When "@AGENTS" is parsed for links
    Then no link is found

  @test:scripts/tests/agent-entry-links.test.ts::`@path`_is_a_link_—_the_stub's_only_reference::leading_whitespace_is_allowed_—_the_directive_is_still_whole-line
  Scenario: An indented @import is still a whole-line link
    When "  @AGENTS.md" is parsed for links
    Then the one link target is "AGENTS.md"

  @test:scripts/tests/agent-entry-links.test.ts::`@path`_is_a_link_—_the_stub's_only_reference::a_BROKEN_@import_is_reported_dead,_with_the_path_named
  Scenario: A broken @import is reported dead with its path named
    Given a scratch tree whose "stub.md" imports "@MISSING.md", which does not exist
    When "stub.md" is audited
    Then the exit code is 1
    And the report names "MISSING.md"

  @test:scripts/tests/agent-entry-links.test.ts::`@path`_is_a_link_—_the_stub's_only_reference::a_RESOLVING_@import_passes
  Scenario: A resolving @import passes the audit
    Given a scratch tree with "AGENTS.md" and a "stub.md" that imports "@AGENTS.md"
    When "stub.md" is audited
    Then the exit code is 0

  @test:scripts/tests/agent-entry-links.test.ts::discovery,_not_a_hardcoded_list::entry_files_at_the_root_and_one_level_down_are_found
  Scenario: Entry files at the root and one directory down are found
    Given a scratch tree with "AGENTS.md" and "CLAUDE.md" at the root and "bootstrap/AGENTS.md"
    When the entry files are found
    Then they are "AGENTS.md", "CLAUDE.md" and "bootstrap/AGENTS.md" in that order

  @test:scripts/tests/agent-entry-links.test.ts::discovery,_not_a_hardcoded_list::node_modules_and_dot-directories_are_not_walked
  Scenario: node_modules and dot-directories are not walked
    Given a scratch tree with a root "AGENTS.md" and an "AGENTS.md" inside both "node_modules" and ".git"
    When the entry files are found
    Then only the root "AGENTS.md" is found

  @test:scripts/tests/agent-entry-links.test.ts::discovery,_not_a_hardcoded_list::an_empty_tree_finds_nothing_—_which_the_CLI_treats_as_exit_2,_not_a_pass
  Scenario: An empty tree yields no entry files
    # Gap: the CLI's exit 2 on an empty result is not exercised; only the finder's empty list is checked.
    Given an empty scratch directory
    When the entry files are found
    Then the list is empty

  @test:scripts/tests/agent-entry-links.test.ts::this_repository,_right_now::the_entry_files_are_found,_and_there_is_more_than_one
  Scenario: This repository has more than one entry file
    Given this repository
    When the entry files are found
    Then more than one is found

  @test:scripts/tests/agent-entry-links.test.ts::this_repository,_right_now::AGENTS.md_is_among_them_—_it_is_the_file_the_banner_sends_everyone_to
  Scenario: This repository's entry files include an AGENTS.md
    Given this repository
    When the entry files are found
    Then one of them is an "AGENTS.md"

  @test:scripts/tests/agent-entry-links.test.ts::this_repository,_right_now::%s_at_the_root_has_no_dead_links
  Scenario: Each entry file name at the repository root has no dead links
    Given each entry name "AGENTS.md", "CLAUDE.md" and "GEMINI.md" at this repository's root
    When that file is audited against the repository's publish targets
    Then the exit code is 0, or 2 when the file does not exist
    And an exit code of 1 fails with the audit report

  @test:scripts/tests/agent-entry-links.test.ts::a_link_into_a_moved_path::resolves_at_the_new_path_in_the_window,_and_is_reported_as_moved,_not_dead
  Scenario: A link into a moved path resolves at the new path within the move window and is reported as moved
    Given a scratch tree whose layer "a" declares a move from "old" to "new" until "2026-12-31"
    And an "AGENTS.md" that links to "a/old/x.md", which exists only as "a/new/x.md"
    When "AGENTS.md" is audited with the moves resolved as of "2026-11-05"
    Then the exit code is 0
    And the report says "0 dead", "1 through a declared move" and "moved (a:old)"

  @test:scripts/tests/agent-entry-links.test.ts::a_link_into_a_moved_path::past_`until`_the_move_gives_no_relief:_the_link_is_dead
  Scenario: Past its until date a move gives no relief and the link is dead
    Given a scratch tree whose layer "a" declares a move from "old" to "new" until "2026-11-04"
    And an "AGENTS.md" that links to "a/old/x.md", which exists only as "a/new/x.md"
    When "AGENTS.md" is audited with the moves resolved as of "2026-11-05"
    Then the exit code is 1
    And the report says "1 dead"

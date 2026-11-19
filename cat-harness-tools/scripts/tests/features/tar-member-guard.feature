# The archive guard, exercised against real tar output (bean 6bhf).
# The predicates are restated in the test file, not imported from the server;
# server-path-sinks.test.ts pins that the server applies them.
# Each Scenario names the test that executes it.
Feature: Tar member guard

  Background:
    Given real tarballs built with tar: a benign one holding "main.tex" and "sub/a b c.tex", one with a symlink to "/etc/passwd", and one with a hard link

  @test:scripts/tests/tar-member-guard.test.ts::tar_is_actually_present,_or_every_assertion_below_is_vacuous::lists_the_benign_archive
  Scenario: tar lists the benign archive
    When the benign archive is listed with "tar tvzf"
    Then the listing is not empty

  @test:scripts/tests/tar-member-guard.test.ts::member_names_are_parsed_as_tar_actually_prints_them::recovers_a_name_containing_spaces_intact_—_the_five-vs-six-field_defect
  Scenario: A member name with spaces is recovered intact
    # Gap: exercises a copy of the name parser restated in the test file, not the server's own code.
    When member names are taken from the benign listing
    Then they include "sub/a b c.tex" and "main.tex" and not "b c.tex"

  @test:scripts/tests/tar-member-guard.test.ts::member_names_are_parsed_as_tar_actually_prints_them::recovers_a_directory_member_with_its_trailing_slash
  Scenario: A directory member keeps its trailing slash
    # Gap: exercises a copy of the name parser restated in the test file, not the server's own code.
    Then the benign listing's member names include "sub/"

  @test:scripts/tests/tar-member-guard.test.ts::member_names_are_parsed_as_tar_actually_prints_them::names_are_not_empty_—_an_empty_name_passes_every_containment_check
  Scenario: No member name is empty
    # Gap: exercises a copy of the name parser restated in the test file, not the server's own code.
    Then every member name of the benign listing is non-empty

  @test:scripts/tests/tar-member-guard.test.ts::the_type_whitelist_closes_the_residual_`--no-same-*`_cannot::accepts_an_archive_of_only_regular_files_and_directories
  Scenario: Regular files and directories pass the type whitelist
    # Gap: exercises a copy of the type whitelist restated in the test file, not the server's own code.
    Then the benign listing has no member refused for its type

  @test:scripts/tests/tar-member-guard.test.ts::the_type_whitelist_closes_the_residual_`--no-same-*`_cannot::refuses_a_SYMLINK_member,_which_writes_through_to_its_target
  Scenario: A symlink member is refused for its type
    # Gap: exercises a copy of the type whitelist restated in the test file, not the server's own code.
    Then the symlink listing has one member refused for its type, a line starting "l"
    And the name checks alone refuse none of its members

  @test:scripts/tests/tar-member-guard.test.ts::the_type_whitelist_closes_the_residual_`--no-same-*`_cannot::refuses_a_HARDLINK_member_for_the_same_reason
  Scenario: A hard-link member is refused for its type
    # Gap: exercises a copy of the type whitelist restated in the test file, not the server's own code.
    Then the hard-link listing has one member refused for its type, a line starting "h"

  @test:scripts/tests/tar-member-guard.test.ts::the_name_checks_still_catch_traversal_by_spelling::refuses_an_absolute_member
  Scenario: An absolute member name is refused
    # Gap: exercises a copy of the name check restated in the test file, not the server's own code.
    Then "/etc/passwd" is refused by name

  @test:scripts/tests/tar-member-guard.test.ts::the_name_checks_still_catch_traversal_by_spelling::refuses_a_`..`_SEGMENT_without_refusing_a_name_that_merely_contains_dots
  Scenario: A ".." segment is refused, dots in a name are not
    # Gap: exercises a copy of the name check restated in the test file, not the server's own code.
    Then "a/../../etc/passwd" is refused by name
    And "..hidden.tex", "a..b.tex" and "fig..1.png" are not

  @test:scripts/tests/tar-member-guard.test.ts::the_name_checks_still_catch_traversal_by_spelling::refuses_a_NUL,_which_truncates_the_path_for_some_syscalls
  Scenario: A NUL in a member name is refused
    # Gap: exercises a copy of the name check restated in the test file, not the server's own code.
    Then a name containing a NUL is refused by name

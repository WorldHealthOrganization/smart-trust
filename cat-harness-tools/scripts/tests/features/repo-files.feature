# repoFiles enumerates the files a gate reads, including work not yet
# committed (bean bgle), and codeWithoutComments lets a gate read code without
# tripping over prose. The untracked-file tests run in a throwaway git
# repository. Each Scenario names the test that executes it.
Feature: A gate sees uncommitted files and reads code without comments

  @test:scripts/tests/repo-files.test.ts::a_gate_can_see_work_that_is_not_committed_yet::an_untracked_file_IS_enumerated
  Scenario: An untracked file is enumerated
    Given a throwaway repository with a committed scripts/tracked.ts and an untracked probe under scripts/
    When its files under "scripts" are enumerated
    Then the probe is among them
    And afterwards the probe exists neither in the throwaway repository nor in this checkout

  @test:scripts/tests/repo-files.test.ts::a_gate_can_see_work_that_is_not_committed_yet::the_OLD_enumeration_misses_it_—_the_bug_is_real,_not_theoretical
  Scenario: A bare git ls-files misses the untracked file
    Given a throwaway repository with a committed scripts/tracked.ts and an untracked probe
    Then git ls-files lists tracked.ts but not the probe
    And the enumeration lists the probe

  @test:scripts/tests/repo-files.test.ts::a_gate_can_see_work_that_is_not_committed_yet::an_IGNORED_file_is_still_excluded_—_--exclude-standard_is_load-bearing
  Scenario: Ignored files are excluded
    When this checkout's files under scripts and schemas are enumerated
    Then none is under node_modules

  @test:scripts/tests/repo-files.test.ts::a_gate_can_see_work_that_is_not_committed_yet::every_path_returned_actually_exists
  Scenario: Every enumerated path exists
    Then every file enumerated under this checkout's schemas exists

  @test:scripts/tests/repo-files.test.ts::a_gate_can_see_work_that_is_not_committed_yet::results_are_de-duplicated_and_sorted
  Scenario: Results are de-duplicated and sorted
    When schemas is enumerated twice over
    Then the list equals its own sorted, de-duplicated form

  @test:scripts/tests/repo-files.test.ts::a_gate_can_see_work_that_is_not_committed_yet::the_extension_filter_narrows_without_changing_the_set's_origin
  Scenario: The extension filter narrows the set
    When this checkout's schemas are enumerated for ".json"
    Then there is at least one, and every one ends in ".json"

  @test:scripts/tests/repo-files.test.ts::a_gate_can_look_at_code_without_tripping_over_prose::a_line_comment_goes,_a_URL_in_a_string_survives
  Scenario: A line comment goes and a URL in a string survives
    When comments are removed from a line holding a URL string and a trailing comment
    Then the URL remains and the comment's text does not

  @test:scripts/tests/repo-files.test.ts::a_gate_can_look_at_code_without_tripping_over_prose::a_block_comment_goes,_including_a_markdown_code_span_in_it
  Scenario: A block comment goes, including a code span in it
    When comments are removed from a doc comment holding a backticked "remote-packages"
    Then "remote-packages" does not remain

  @test:scripts/tests/repo-files.test.ts::a_gate_can_look_at_code_without_tripping_over_prose::a_real_string_literal_is_kept
  Scenario: A string literal is kept
    Then removing comments keeps "skills/remote-packages" from a string literal

  @test:scripts/tests/repo-files.test.ts::a_gate_can_look_at_code_without_tripping_over_prose::a_comment_marker_INSIDE_a_string_is_not_a_comment
  Scenario: A comment marker inside a string is not a comment
    Then removing comments keeps "a // b" from a string

  @test:scripts/tests/repo-files.test.ts::a_gate_can_look_at_code_without_tripping_over_prose::an_escaped_quote_does_not_end_the_string_early
  Scenario: An escaped quote does not end the string early
    Then removing comments from a string holding an escaped quote then "// x" keeps "// x"

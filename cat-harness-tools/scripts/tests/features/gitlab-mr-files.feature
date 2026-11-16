# scripts/gitlab-mr-files.ts (gitlab:mr-files) lists a merge request's changed paths by parsing glab's raw diff,
# validating its one optional argument before glab runs. Each Scenario names the test that executes it.
Feature: Listing a merge request's paths from glab's raw diff

  @test:scripts/tests/gitlab-mr-files.test.ts::gitlab:mr-files_lists_a_merge_request's_paths_from_glab's_raw_diff_(4dbr)::new_side,_deleted_side,_renames,_binaries_and_quoted_paths,_each_once
  Scenario: Every kind of changed path is listed once
    Given a raw diff with a modified file, a deleted file, a rename, a binary change and two C-quoted paths
    When diffPaths reads it
    Then it returns "src/a.ts", "gone.md", "new name.txt", "img.png", a path with a tab in it, and "café", in that order

  @test:scripts/tests/gitlab-mr-files.test.ts::gitlab:mr-files_lists_a_merge_request's_paths_from_glab's_raw_diff_(4dbr)::hunk_lines_that_look_like_headers_are_not_paths
  Scenario: Hunk lines that look like file headers are not taken as paths
    Given the same raw diff, whose hunk holds lines starting "--- " and "+++ "
    When diffPaths reads it
    Then no returned path contains "SQL" or "added line"

  @test:scripts/tests/gitlab-mr-files.test.ts::gitlab:mr-files_lists_a_merge_request's_paths_from_glab's_raw_diff_(4dbr)::git's_C-quoting_is_undone
  Scenario: git's C-quoting is undone
    Given a quoted path holding an escaped double quote and an escaped backslash
    When unquote reads it
    Then the quotes are removed and the escapes are resolved
    And an unquoted "plain" comes back unchanged

  @test:scripts/tests/gitlab-mr-files.test.ts::gitlab:mr-files_lists_a_merge_request's_paths_from_glab's_raw_diff_(4dbr)::the_argv:_a_positive_number_or_none;_anything_else_is_refused_before_glab_runs
  Scenario: The glab argv takes a positive number or none and refuses anything else
    # Gap: only that mrFilesArgv throws is checked here, not that glab is never spawned
    Given no argument, the argument "42", and the bad arguments "0", "-1", "--help", "4 2", "$(x)" and "01"
    When mrFilesArgv builds the argv for each
    Then no argument gives "mr diff --raw --color never"
    And "42" gives "mr diff 42 --raw --color never"
    And every bad argument throws

  @test:scripts/tests/gitlab-mr-files.test.ts::gitlab:mr-files_lists_a_merge_request's_paths_from_glab's_raw_diff_(4dbr)::run_as_a_command:_glab_gets_that_argv_and_the_paths_come_out_one_per_line
  Scenario: Run as a command, glab gets the argv and the paths print one per line
    Given a fake glab on the PATH that records its argv and prints the raw diff
    When the script runs with "7"
    Then it exits 0
    And glab received "mr diff 7 --raw --color never"
    And the output is the six paths, one per line
    And run with "--help" the script exits 2

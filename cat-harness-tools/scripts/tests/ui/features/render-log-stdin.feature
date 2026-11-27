# scripts/render-log.ts takes its prose (summary, reason, detail, format) as one JSON object on
# stdin and refuses the old argv prose flags. Each Scenario names the test that executes it.
Feature: Render log prose arrives on stdin

  @test:scripts/tests/ui/render-log-stdin.test.ts::the_prose_flags_are_REFUSED,_not_ignored::%s_in_argv_exits_2_and_names_itself
  Scenario: A prose flag in argv exits 2 and names itself
    Given a render-log call with a valid stdin summary
    When the flag is also passed in argv, for each of "--summary", "--reason" and "--detail"
    Then the exit code is 2
    And stderr names the flag
    And stderr says prose "no longer travel in argv"

  @test:scripts/tests/ui/render-log-stdin.test.ts::the_prose_flags_are_REFUSED,_not_ignored::all_three_are_named_together_rather_than_one_at_a_time
  Scenario: All three stale prose flags are named in one run
    Given a render-log call with a valid stdin summary
    When "--summary", "--reason" and "--detail" are all passed in argv
    Then the exit code is 2
    And stderr names all three flags

  @test:scripts/tests/ui/render-log-stdin.test.ts::the_prose_flags_are_REFUSED,_not_ignored::refusing_writes_NOTHING_—_a_refusal_is_not_a_log_entry
  Scenario: A refused prose flag writes nothing
    Given an empty log directory
    When render-log is run with "--summary" in argv
    Then the log directory is still empty

  @test:scripts/tests/ui/render-log-stdin.test.ts::stdin_that_is_not_usable_prose_is_exit_2,_never_a_silent_write::%s_is_refused,_and_nothing_is_written
  Scenario: Stdin that is not usable prose is refused and nothing is written
    Given an empty log directory
    When render-log is run with each unusable stdin: none at all, empty, not JSON, a JSON array, a bare string, a non-string summary, a missing summary, and a blank summary
    Then the exit code is 2
    And stderr explains the case, such as "not JSON", "single JSON OBJECT", "must be a string" or "`summary` is required"
    And stderr says "Nothing was written"
    And the log directory is still empty

  @test:scripts/tests/ui/render-log-stdin.test.ts::prose_survives_stdin_verbatim::a_reason_full_of_shell_metacharacters_lands_inert_and_unchanged
  Scenario: A reason full of shell metacharacters lands unchanged
    Given a reason holding quotes, backticks, "$(id)", "&" and "rm -rf /"
    When a "removed" entry is logged with that reason on stdin
    Then the exit code is 0
    And the one written entry's reason equals the input exactly

  @test:scripts/tests/ui/render-log-stdin.test.ts::prose_survives_stdin_verbatim::a_newline_in_the_detail_survives,_which_no_argv_word_carries_comfortably
  Scenario: A newline in the detail survives
    Given a detail with two newlines and a tab
    When an entry is logged with that detail on stdin
    Then the exit code is 0
    And the one written entry's detail equals the input exactly

  @test:scripts/tests/ui/render-log-stdin.test.ts::`format`_is_declared,_and_absence_is_the_default::an_entry_that_declares_nothing_carries_NO_format_field
  Scenario: An entry that declares no format carries no format field
    When an entry is logged with only a summary on stdin
    Then the exit code is 0
    And the written entry has no format field

  @test:scripts/tests/ui/render-log-stdin.test.ts::`format`_is_declared,_and_absence_is_the_default::a_declared_format_is_carried_through
  Scenario: A declared format is carried through
    When an entry is logged with summary "**bold**" and format "markdown"
    Then the exit code is 0
    And the written entry's format is "markdown"

  @test:scripts/tests/ui/render-log-stdin.test.ts::`format`_is_declared,_and_absence_is_the_default::the_format_is_NOT_sniffed_from_markdown-looking_prose
  Scenario: The format is not sniffed from markdown-looking prose
    When an entry is logged with summary "the *only* signal was stale" and no format
    Then the exit code is 0
    And the written entry has no format field

  @test:scripts/tests/ui/render-log-stdin.test.ts::the_rules_that_predate_this_change_still_hold::a_`removed`_entry_with_no_reason_is_still_refused,_now_from_stdin
  Scenario: A removed entry with no reason is still refused
    When a "removed" entry is logged with a stdin summary and no reason
    Then the exit code is 1
    And stderr says a reason is required

  @test:scripts/tests/ui/render-log-stdin.test.ts::the_rules_that_predate_this_change_still_hold::an_unsafe_path_is_still_refused,_and_the_prose_never_reaches_a_file
  Scenario: An unsafe path is still refused and nothing is written
    Given an empty log directory
    When an entry is logged for path "STAGING/../x"
    Then the exit code is 1
    And the log directory is still empty

  @test:scripts/tests/ui/render-log-stdin.test.ts::the_rules_that_predate_this_change_still_hold::a_missing_--dir_is_still_usage,_and_the_usage_SHOWS_the_stdin_shape
  Scenario: A missing --dir is a usage error and the usage shows the stdin shape
    When render-log is run without --dir
    Then the exit code is 2
    And stderr contains "STDIN"
    And stderr contains "jq -n --arg"

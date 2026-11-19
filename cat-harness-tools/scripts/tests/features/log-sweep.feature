# Emptying the activity log one entry, one run, by age or all at once, and the
# guard that keeps the never-delete exception to log entries (owner,
# 2026-09-19; folio-assistant-7uff). Each Scenario names the test that executes it.
Feature: Emptying the activity log

  @test:scripts/tests/log-sweep.test.ts::the_three_operations_the_owner_named::one_entry,_individually
  Scenario: One entry is removed individually
    Given two log entries
    When the log is emptied by one entry's id
    Then one entry is removed and the other survives

  @test:scripts/tests/log-sweep.test.ts::the_three_operations_the_owner_named::a_whole_run_at_once,_by_session
  Scenario: A whole run is removed at once by session
    Given two entries of session run-a and one of run-b
    When the log is emptied for run-a
    Then two are removed and one remains

  @test:scripts/tests/log-sweep.test.ts::the_three_operations_the_owner_named::periodically_—_everything_older_than_a_cutoff
  Scenario: Everything older than a cutoff is removed
    Given entries from January, June and September
    When the log is emptied before July
    Then two are removed and one remains

  @test:scripts/tests/log-sweep.test.ts::the_three_operations_the_owner_named::all_of_it,_and_`all`_has_to_be_asked_for_by_name
  Scenario: All of it, when all is asked for by name
    Given two entries
    When the log is emptied with all
    Then both are removed and the directory is empty

  @test:scripts/tests/log-sweep.test.ts::the_exception_is_for_log_ENTRIES,_not_for_the_directory::a_file_that_does_not_declare_itself_an_entry_is_never_removed
  Scenario: A file that does not declare itself an entry is never removed
    Given one entry and a Markdown file in the log directory
    When the log is emptied with all
    Then only the entry is removed, the Markdown file remains, and the reason it was kept names folio-log/v1

  @test:scripts/tests/log-sweep.test.ts::the_exception_is_for_log_ENTRIES,_not_for_the_directory::valid_JSON_that_is_not_a_log_entry_is_kept_too
  Scenario: Valid JSON that is not a log entry is kept
    Given a workflow-instance JSON file in the log directory
    When the log is emptied with all
    Then nothing is removed and the file remains

  @test:scripts/tests/log-sweep.test.ts::the_exception_is_for_log_ENTRIES,_not_for_the_directory::unreadable_JSON_is_kept,_and_the_reason_says_so
  Scenario: Unreadable JSON is kept, and the reason says so
    Given a truncated JSON file in the log directory
    When the log is emptied with all
    Then it remains and the reason says it is not readable as JSON

  @test:scripts/tests/log-sweep.test.ts::the_exception_is_for_log_ENTRIES,_not_for_the_directory::a_subdirectory_is_not_walked_into_and_not_removed
  Scenario: A subdirectory is not walked into or removed
    Given an entry and a subdirectory in the log directory
    When the log is emptied with all
    Then the subdirectory remains and a kept reason says the sweep removes files only

  @test:scripts/tests/log-sweep.test.ts::the_exception_is_for_log_ENTRIES,_not_for_the_directory::a_symlink_pointing_out_of_the_log_directory_is_refused
  Scenario: A symlink pointing out of the log directory is refused
    Given a symlink in the log directory to a log-shaped file outside it
    When the log is emptied with all
    Then the outside file remains and a kept reason says it is outside the log directory

  @test:scripts/tests/log-sweep.test.ts::what_it_did_NOT_do_is_reported,_not_inferred::`kept`_separates_a_selector_miss_from_a_refusal
  Scenario: kept separates a selector miss from a refusal
    Given an entry of run-a and a stray Markdown file
    When the log is emptied for a session nothing matches
    Then nothing is removed, one file is kept as not matching and one as refused

  @test:scripts/tests/log-sweep.test.ts::what_it_did_NOT_do_is_reported,_not_inferred::the_one-liner_names_the_refusals_and_a_clean_sweep_does_not
  Scenario: The one-liner names the refusals and a clean sweep does not
    Given one entry, swept with all
    Then the description does not say anything was left alone
    And with a stray file present, the description says it was left alone

  @test:scripts/tests/log-sweep.test.ts::what_it_did_NOT_do_is_reported,_not_inferred::`scanned`_is_the_vacuity_guard_on_every_count_above
  Scenario: scanned is the vacuity guard
    When an empty log is emptied, it scanned 0 files
    And with one entry written, it scanned 1

  @test:scripts/tests/log-sweep.test.ts::what_it_did_NOT_do_is_reported,_not_inferred::an_instance_with_no_declared_trashcan_says_so_rather_than_reporting_a_clean_sweep
  Scenario: An instance with no declared trashcan says so
    Given an instance declaring no fsh-guts directory
    When the log is emptied with all
    Then no directories are swept and the description says there is nothing to sweep

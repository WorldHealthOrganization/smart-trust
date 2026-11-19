# The render log (scripts/render-log.ts and schemas/ui/render-log.ts) is append-only, checks every
# path by value, requires a reason for removals and retentions, and reports every line it skips.
# Each Scenario names the test that executes it.
Feature: The render log

  @test:scripts/tests/ui/render-log.test.ts::buildEntry::a_rendered_entry_needs_no_reason
  Scenario: A rendered entry needs no reason
    When a "rendered" entry is built with a summary and no reason
    Then its event is "rendered"
    And it carries the render log schema id

  @test:scripts/tests/ui/render-log.test.ts::buildEntry::a_removal_REFUSES_without_a_reason
  Scenario: A removal is refused without a reason
    When a "removed" entry is built with no reason
    Then it throws "--reason is required"

  @test:scripts/tests/ui/render-log.test.ts::buildEntry::a_retained_entry_refuses_too_—_why_it_is_still_here_is_the_whole_content
  Scenario: A retained entry is refused without a reason
    When a "retained" entry is built with no reason
    Then it throws "--reason is required"

  @test:scripts/tests/ui/render-log.test.ts::buildEntry::capture_is_`on`:_the_log_IS_the_capture,_unlike_the_activity_log
  Scenario: A render log entry's capture is on
    When a "rendered" entry is built
    Then its capture is "on"

  @test:scripts/tests/ui/render-log.test.ts::a_path_is_checked_by_VALUE,_not_trusted_by_provenance::the_escape_the_sanitiser_can_actually_emit_is_refused
  Scenario: The escape the slug sanitiser can emit is refused
    Given the path "STAGING/.."
    Then it is not a safe render path
    And building an entry for it throws "not a safe path"

  @test:scripts/tests/ui/render-log.test.ts::a_path_is_checked_by_VALUE,_not_trusted_by_provenance::refuses_%s
  Scenario: Unsafe render paths are refused
    When each of "/etc/passwd", "a\b", "a//b", "..", "./x" and "a/./b" is checked
    Then none is a safe render path

  @test:scripts/tests/ui/render-log.test.ts::a_path_is_checked_by_VALUE,_not_trusted_by_provenance::accepts_%s
  Scenario: Safe render paths are accepted
    When each of "STAGING/claude-x", "/", "a/b/c" and "a.b-c_d" is checked
    Then each is a safe render path

  @test:scripts/tests/ui/render-log.test.ts::APPEND-ONLY_—_a_removal_never_erases_what_came_before::rendered_then_removed_leaves_BOTH_entries
  Scenario: Rendered then removed leaves both entries
    Given an empty log directory
    When a "rendered" entry and then a "removed" entry with a reason are appended
    Then the day's log reads back events "rendered" then "removed"

  @test:scripts/tests/ui/render-log.test.ts::APPEND-ONLY_—_a_removal_never_erases_what_came_before::the_pair_IS_the_history_—_the_rendered_entry_still_says_what_it_was_for
  Scenario: The rendered entry keeps what it was for after a removal
    Given an empty log directory
    When a "rendered" entry for branch "claude/x" and then a "removed" entry with reason "PR #1 closed" are appended
    Then the first entry read back still has branch "claude/x"
    And the second has reason "PR #1 closed"

  @test:scripts/tests/ui/render-log.test.ts::APPEND-ONLY_—_a_removal_never_erases_what_came_before::re-rendering_the_same_path_appends_rather_than_replacing
  Scenario: Re-rendering the same path appends rather than replaces
    Given an empty log directory
    When three "rendered" entries for the same path are appended
    Then the day's log reads back 3 entries

  @test:scripts/tests/ui/render-log.test.ts::APPEND-ONLY_—_a_removal_never_erases_what_came_before::one_file_per_UTC_day,_so_concurrent_writers_append_rather_than_rewrite
  Scenario: The render log has one file per UTC day
    Then the log path for "2026-09-20T23:59:59.000Z" is "_render-log/2026-09-20.jsonl"
    And the log path for "2026-09-21T00:00:00.000Z" is "_render-log/2026-09-21.jsonl"

  @test:scripts/tests/ui/render-log.test.ts::APPEND-ONLY_—_a_removal_never_erases_what_came_before::the_store_is_OUTSIDE_STAGING/,_so_`rm_-rf_STAGING/$SLUG`_cannot_reach_it
  Scenario: The render log store is outside STAGING/
    Then the log path does not start with "STAGING/"

  @test:scripts/tests/ui/render-log.test.ts::readRenderLogEntry::another_schema_is_refused,_naming_what_it_declares
  Scenario: An entry of another schema is refused, naming that schema
    When an object declaring schema "folio-log/v1" is read as a render log entry
    Then it is refused
    And the reason contains "folio-log/v1"

  @test:scripts/tests/ui/render-log.test.ts::readRenderLogEntry::a_reasonless_removal_is_a_DEFECT,_not_a_clean_skip
  Scenario: A reasonless removal is refused when read
    When a schema-valid "removed" entry with no reason is read
    Then it is refused
    And the reason contains "no reason"

  @test:scripts/tests/ui/render-log.test.ts::readRenderLogEntry::an_unsafe_path_is_refused_even_if_the_schema_is_satisfied
  Scenario: An unsafe path is refused when read even if the schema is satisfied
    When a schema-valid "rendered" entry for path "STAGING/.." is read
    Then it is refused
    And the reason contains "not a safe path"

  @test:scripts/tests/ui/render-log.test.ts::readRenderLog_—_a_short_count_must_be_visible_as_short::a_malformed_line_does_not_stop_the_read,_and_IS_reported
  Scenario: A malformed line does not stop the read and is reported
    Given a log of a good entry, a line "not json", and another good entry
    When the log is read
    Then it yields 2 entries
    And it reports 1 skipped line, line 2

  @test:scripts/tests/ui/render-log.test.ts::readRenderLog_—_a_short_count_must_be_visible_as_short::blank_lines_are_not_entries_and_are_not_defects
  Scenario: Blank lines are neither entries nor defects
    Given a log of one good entry surrounded by blank lines
    When the log is read
    Then it yields 1 entry
    And it reports no skipped lines

  @test:scripts/tests/ui/render-log.test.ts::readRenderLog_—_a_short_count_must_be_visible_as_short::an_entry_of_another_schema_on_one_line_is_reported,_not_silently_dropped
  Scenario: A line of another schema is reported as skipped
    Given a log of one good entry and a line declaring schema "folio-log/v1"
    When the log is read
    Then it yields 1 entry
    And the skipped line's reason contains "folio-log/v1"

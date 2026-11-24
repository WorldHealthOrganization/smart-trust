# src/sessions/staleness.ts reports remote sessions left waiting on a person, and never reads
# an unreadable listing or an undatable row as clean. Each Scenario names the test that executes it.
Feature: Sessions waiting on a person

  @test:scripts/tests/conduct/session-staleness.test.ts::a_session_waiting_on_a_person_is_reported_once_it_is_stale::REQUIRES_ACTION_past_the_threshold_is_a_finding,_and_the_question_comes_with_it
  Scenario: A session requiring action past the threshold is a finding, with its question
    Given a session requiring action, last updated 113 hours ago, asking "Which PRs should I merge?"
    When stale sessions are found
    Then there is one finding, with reason "requires-action"
    And its question is "Which PRs should I merge?"

  @test:scripts/tests/conduct/session-staleness.test.ts::a_session_waiting_on_a_person_is_reported_once_it_is_stale::REQUIRES_ACTION_inside_the_threshold_is_NOT_a_finding
  Scenario: A session requiring action inside the threshold is not a finding
    Given a session requiring action, last updated one hour inside the requires-action threshold
    When stale sessions are found
    Then there are no findings

  @test:scripts/tests/conduct/session-staleness.test.ts::a_session_waiting_on_a_person_is_reported_once_it_is_stale::a_FAILED_session_with_unread_output_is_a_finding
  Scenario: A failed session with unread output is a finding
    Given a session in the failed bucket, unread, last updated 385 hours ago
    When stale sessions are found
    Then the finding's reason is "failed-unread"

  @test:scripts/tests/conduct/session-staleness.test.ts::a_session_waiting_on_a_person_is_reported_once_it_is_stale::a_FAILED_session_somebody_has_READ_is_not_this_check's_business
  Scenario: A failed session somebody has read is not reported
    Given a session in the failed bucket, already read, last updated 385 hours ago
    When stale sessions are found
    Then there are no findings

  @test:scripts/tests/conduct/session-staleness.test.ts::a_session_waiting_on_a_person_is_reported_once_it_is_stale::a_fresh_FAILED_session_is_not_reported_before_one_working_day
  Scenario: A fresh failed session is not reported before the failed-unread threshold
    Given an unread failed session last updated one hour inside the failed-unread threshold
    When stale sessions are found
    Then there are no findings

  @test:scripts/tests/conduct/session-staleness.test.ts::a_session_waiting_on_a_person_is_reported_once_it_is_stale::findings_are_ordered_by_how_long_they_have_waited
  Scenario: Findings are ordered by how long they have waited
    Given session "b" requiring action for 100 hours and session "a" for 300 hours
    When stale sessions are found
    Then the findings are "a" then "b"

  @test:scripts/tests/conduct/session-staleness.test.ts::the_third_state_—_stopped,_but_it_never_said_it_needs_anyone::BLOCKED_bucket_with_a_non-REQUIRES_ACTION_status_is_NAMED,_not_asserted_as_waiting
  Scenario: A blocked session that never declared it needs anyone is named, not asserted as waiting
    Given a session in the blocked bucket with status idle, last updated 113 hours ago
    When stale sessions are found
    Then there is one finding, with reason "blocked-undeclared"
    And the rendered report says the state "CANNOT be told"

  @test:scripts/tests/conduct/session-staleness.test.ts::could-not-determine_is_never_rendered_as_clean::input_that_is_not_JSON_is_unknown,_with_a_reason
  Scenario: Input that is not JSON is unknown, with a reason
    When the rows are read from "{ not json"
    Then the result carries a reason it is unknown

  @test:scripts/tests/conduct/session-staleness.test.ts::could-not-determine_is_never_rendered_as_clean::JSON_with_no_session_array_is_unknown_rather_than_an_empty_result
  Scenario: JSON with no session array is unknown rather than empty
    When the rows are read from "{}"
    Then the result carries a reason it is unknown

  @test:scripts/tests/conduct/session-staleness.test.ts::could-not-determine_is_never_rendered_as_clean::the_unknown_report_says_plainly_that_it_is_NOT_a_pass
  Scenario: The unknown report says plainly it is not a pass
    When an unknown result because of "403" is rendered
    Then the report contains "NOT a pass"

  @test:scripts/tests/conduct/session-staleness.test.ts::could-not-determine_is_never_rendered_as_clean::an_empty_listing_is_examined-nothing,_not_a_pass
  Scenario: An empty listing renders as examined-nothing, not a pass
    When a checked result with no rows read and no findings is rendered
    Then the report contains "EXAMINED NOTHING"

  @test:scripts/tests/conduct/session-staleness.test.ts::could-not-determine_is_never_rendered_as_clean::the_shapes_a_listing_actually_arrives_in_all_parse
  Scenario: The shapes a listing arrives in all parse
    When the rows are read from a bare array, and from objects holding the array under "sessions", "data" and "ccr.data"
    Then each result carries rows

  @test:scripts/tests/conduct/session-staleness.test.ts::a_row_this_cannot_date_is_skipped,_never_treated_as_fresh::a_missing_timestamp_is_skipped
  Scenario: A row with no timestamp is skipped
    # Gap: zero findings is also what a row read as fresh would give; the body cannot tell "skipped" from "treated as fresh"
    Given a session requiring action with no updated time
    When stale sessions are found
    Then there are no findings

  @test:scripts/tests/conduct/session-staleness.test.ts::a_row_this_cannot_date_is_skipped,_never_treated_as_fresh::an_unparseable_timestamp_is_skipped_rather_than_read_as_now
  Scenario: An unparseable timestamp is skipped rather than read as now
    # Gap: zero findings is also what reading the timestamp as now would give; the body cannot tell "skipped" from "read as now"
    Given a session requiring action updated at "not a date"
    When stale sessions are found
    Then there are no findings

  @test:scripts/tests/conduct/session-staleness.test.ts::repo_attribution_and_filtering::the_repo_comes_from_the_session's_declared_source
  Scenario: The repo comes from the session's declared source
    Given a session whose source is "https://github.com/litlfred/folio-assistant"
    When its repo is read
    Then it is "litlfred/folio-assistant"

  @test:scripts/tests/conduct/session-staleness.test.ts::repo_attribution_and_filtering::a_session_declaring_no_source_is_`unknown`,_not_blank
  Scenario: A session declaring no source has repo "unknown"
    Given a session with only an id
    When its repo is read
    Then it is "unknown"

  @test:scripts/tests/conduct/session-staleness.test.ts::repo_attribution_and_filtering::--repo_narrows_to_one_repository
  Scenario: Narrowing to one repository drops sessions of others
    Given stale session "keep" from litlfred/folio-assistant and stale session "drop" from litlfred/qou
    When stale sessions are found for repo "litlfred/folio-assistant"
    Then the findings are only "keep"

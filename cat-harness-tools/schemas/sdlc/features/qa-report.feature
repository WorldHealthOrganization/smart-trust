# Specifies schemas/sdlc/qa-report.ts: a QA report in the shape the upstream
# QAReporter writes, whose summary must agree with its details, and whose
# verdict is never a pass while the run is unfinished.
Feature: A QA report's summary agrees with its details

  Background:
    Given a completed dak-script report with one success, one processed file, one expected file and no missing files, and a summary that counts them

  @test:schemas/sdlc/qa-report.test.ts::a_summary_may_not_disagree_with_the_details_it_summarises::the_matching_case_parses
  Scenario: A summary that matches its details parses
    When the report is parsed with the QA report schema
    Then it parses

  @test:schemas/sdlc/qa-report.test.ts::a_summary_may_not_disagree_with_the_details_it_summarises::a_count_that_does_not_match_its_list_is_REFUSED
  Scenario: A count that does not match its list is refused
    When the summary claims 7 successes
    Then the report is refused
    And the first issue is at summary.total_successes, saying "details holds 1"

  @test:schemas/sdlc/qa-report.test.ts::a_summary_may_not_disagree_with_the_details_it_summarises::EVERY_count_is_checked,_not_just_the_first
  Scenario: Every count is checked
    When all six summary counts are 9
    Then the report is refused with at least six issues

  @test:schemas/sdlc/qa-report.test.ts::a_determined_empty_is_not_a_not-found::expected-and-missing_is_a_legitimate_report
  Scenario: A file that was expected and is missing can be reported
    When "input/dmn/" is both expected and missing, and the counts agree
    Then the report parses

  @test:schemas/sdlc/qa-report.test.ts::a_determined_empty_is_not_a_not-found::missing-but-never-expected_is_REFUSED
  Scenario: A missing file that was never expected is refused
    When "input/dmn/" is missing but not expected
    Then the report is refused with a message containing "never expected"

  @test:schemas/sdlc/qa-report.test.ts::`running`_is_never_a_pass::a_run_that_died_is_representable,_and_carries_no_completion
  Scenario: A running report with no completion parses
    When the report is "running" with all counts zero, empty details and no completion timestamp
    Then it parses

  @test:schemas/sdlc/qa-report.test.ts::`running`_is_never_a_pass::...and_its_verdict_is_`unknown`,_NOT_`ok`
  Scenario: A running report's verdict is unknown
    Given the running report with zero errors
    When its verdict is computed
    Then total_errors is 0
    And the verdict is "unknown"

  @test:schemas/sdlc/qa-report.test.ts::`running`_is_never_a_pass::a_terminal_status_with_no_completion_timestamp_is_REFUSED
  Scenario: A terminal report needs a completion timestamp
    When the completed report's summary has no completion_timestamp
    Then it is refused with the first issue at summary.completion_timestamp

  @test:schemas/sdlc/qa-report.test.ts::`running`_is_never_a_pass::a_completion_timestamp_with_a_non-terminal_status_is_REFUSED
  Scenario: A non-terminal report may not carry a completion timestamp
    When the report's status is "running" but its summary keeps the completion timestamp
    Then it is refused with the first issue at status

  @test:schemas/sdlc/qa-report.test.ts::`running`_is_never_a_pass::the_three_verdicts
  Scenario: The three verdicts: ok, finding and unknown
    When the baseline completed report's verdict is computed
    Then it is "ok"
    And a failed report with one error has the verdict "finding"
    And a running report with zero errors has the verdict "unknown"
    And "failed" is a terminal status while "running" is not

  @test:schemas/sdlc/qa-report.test.ts::the_file_declares_what_it_is::a_document_with_no_`$schema`_tag_is_REFUSED
  Scenario: A report without a $schema tag is refused
    When the report has no $schema
    Then it is refused

  @test:schemas/sdlc/qa-report.test.ts::the_file_declares_what_it_is::an_unknown_producer_is_REFUSED_—_the_discriminator_is_not_cosmetic
  Scenario: An unknown producer is refused
    When the producer is "somebody-else"
    Then the report is refused

  @test:schemas/sdlc/qa-report.test.ts::the_file_declares_what_it_is::an_OPEN_file_status_is_accepted_—_upstream's_set_grows
  Scenario: An unlisted file status is accepted
    When the processed file's status is "skipped_existing"
    Then the report parses

  @test:schemas/sdlc/qa-report.test.ts::the_graph_typology_it_is_held_under::registered,_not_renderable,_and_`state`
  Scenario: The qa-report typology is registered, non-renderable state
    When the "qa-report" graph typology is looked up
    Then it is registered
    And it is not renderable
    And its layer is "state"

  @test:schemas/sdlc/qa-report.test.ts::the_graph_typology_it_is_held_under::a_process_MAY_write_it_—_it_is_the_one_thing_a_run_produces_about_itself
  Scenario: A process may write a QA report
    Then a process may write "qa-report"

  @test:schemas/sdlc/qa-report.test.ts::the_graph_typology_it_is_held_under::it_is_a_DIFFERENT_kind_from_`qa`_and_`health`,_on_purpose
  Scenario: qa-report, qa and health are distinct kinds
    When the graph typology IRIs of "qa", "health" and "qa-report" are computed
    Then they are three distinct IRIs

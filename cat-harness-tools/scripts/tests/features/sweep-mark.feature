# Sweep marks (bean rq8s). Each Scenario names the test that executes it.
Feature: Sweep marks

  @test:scripts/tests/sweep-mark.test.ts::sweep_marks::a_written_mark_reads_back_with_its_age,_and_is_a_valid_folio-sweep-mark/v1
  Scenario: A written mark reads back with its age
    Given a store declaring a marks node
    When a mark for "session-staleness" is written at 09:00 and read at 15:00
    Then it was written, its file is a valid folio-sweep-mark/v1
    And it reads back as marked, 6 hours old, with its read, findings and by
    And its description says "6.0 h ago"

  @test:scripts/tests/sweep-mark.test.ts::sweep_marks::a_later_run_replaces_the_mark_—_one_file_per_check
  Scenario: A later run replaces the mark
    When two marks for the same check are written a day apart
    Then reading at the second time gives the second mark, 0 hours old

  @test:scripts/tests/sweep-mark.test.ts::sweep_marks::no_mark_yet_is_NONE,_and_says_it_is_not_'none_waiting'
  Scenario: No mark yet is none
    Given a store with a marks node and no mark
    Then the mark reads as "none" and its description says 'Not "none waiting"'

  @test:scripts/tests/sweep-mark.test.ts::sweep_marks::a_store_with_no_marks_node_is_UNDECLARED,_and_the_writer_says_so_instead_of_inventing_a_path
  Scenario: A store with no marks node is undeclared
    Given a store with no marks node
    Then reading a mark gives "undeclared" and writing one gives "not-written"
    And the description of an undeclared mark starts "Could not determine"

  @test:scripts/tests/sweep-mark.test.ts::sweep_marks::an_unparsable_or_mismatched_mark_is_CORRUPT,_never_a_mark
  Scenario: An unparsable or mismatched mark is corrupt
    Given the mark file for "session-staleness" holds unparsable JSON
    Then the mark reads as "corrupt"
    Given the file holds a valid mark for check "other"
    Then the mark reads as "corrupt"

  @test:scripts/tests/sweep-mark.test.ts::sweep_marks::the_session_id_comes_from_the_environment_when_it_names_one
  Scenario: The session id comes from the environment
    Then CLAUDE_CODE_REMOTE_SESSION_ID "session_a" gives session id "session_a"
    And an empty environment gives none

  @test:scripts/tests/sweep-mark.test.ts::sweep:mark:check_—_the_gate_that_judges_the_kind_(rq8s,_2026-10-20)::an_empty_store,_and_a_store_of_valid_marks,_have_nothing_wrong
  Scenario: Empty and valid stores have no findings
    Then judging an empty marks store reads 0 with no findings
    And after one valid mark it reads 1 with no findings

  @test:scripts/tests/sweep-mark.test.ts::sweep:mark:check_—_the_gate_that_judges_the_kind_(rq8s,_2026-10-20)::CORRUPTED:_an_unparsable_mark,_a_mark_filed_under_another_check's_name,_and_a_future_date_are_each_a_finding
  Scenario: Corrupted marks are findings
    Given an unparsable "a.json", a valid "b.json", a copy of it as "c.json", and "d.json" dated a day ahead
    When the marks are judged
    Then 4 are read and the findings are "a.json", "c.json" and "d.json"

  @test:scripts/tests/sweep-mark.test.ts::sweep:mark:check_—_the_gate_that_judges_the_kind_(rq8s,_2026-10-20)::a_date_within_a_few_minutes_of_now_is_clock_skew,_not_a_finding
  Scenario: A minute in the future is clock skew
    Given a mark dated one minute after now
    When the marks are judged
    Then there are no findings

  @test:scripts/tests/sweep-mark.test.ts::sweep:mark:check_—_the_gate_that_judges_the_kind_(rq8s,_2026-10-20)::a_store_with_no_marks_node_is_UNDECLARED,_not_an_empty_pass_of_a_store_that_exists
  Scenario: Judging a store with no marks node is undeclared
    Then judging a store with no marks node gives "undeclared"

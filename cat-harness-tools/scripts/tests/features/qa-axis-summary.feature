# scripts/ci/qa-axis-summary.py reads the shape qa-sweep --json emits, and
# refuses any other shape rather than reading it as zero (bean 5jij). Each
# Scenario names the test that executes it.
Feature: The QA axis summary reads what qa-sweep emits

  @test:scripts/tests/qa-axis-summary.test.ts::qa-axis-summary_reads_the_shape_qa-sweep_--json_emits_(5jij)::a_real_one-voice_sweep_with_a_planted_TODO:_criteria_are_counted_and_the_failure_is_named
  Scenario: A real sweep with a planted TODO is counted and its failure named
    Given a new document folio whose overview carries "TODO: finish this section."
    And its one-voice qa-sweep --json output
    When the summary reads it
    Then it exits 0 with a positive "criteria run:" count
    And a line names "voice-status-leak" with a count
    And it does not say "(no failing criteria)"

  @test:scripts/tests/qa-axis-summary.test.ts::qa-axis-summary_reads_the_shape_qa-sweep_--json_emits_(5jij)::the_shape_it_used_to_read_is_an_error,_not_a_zero
  Scenario: The old shape is an error, not a zero
    Given JSON with want_criteria and blocks
    When the summary reads it
    Then it exits 1, stderr names "`criteria`", and stdout is empty

  @test:scripts/tests/qa-axis-summary.test.ts::qa-axis-summary_reads_the_shape_qa-sweep_--json_emits_(5jij)::each_missing_or_mistyped_key_is_an_error
  Scenario: Each missing or mistyped key is an error
    Given JSON missing results, missing criteria, with criteria a string, with a result lacking details, with a detail lacking outcome, or a bare array
    When the summary reads each
    Then each exits 1

  @test:scripts/tests/qa-axis-summary.test.ts::qa-axis-summary_reads_the_shape_qa-sweep_--json_emits_(5jij)::an_empty_stdin_(a_crashed_sweep)_is_an_error
  Scenario: An empty stdin is an error
    When the summary reads empty input
    Then it exits 1

  @test:scripts/tests/qa-axis-summary.test.ts::qa-axis-summary_reads_the_shape_qa-sweep_--json_emits_(5jij)::a_clean_sweep_reports_its_count_and_no_failures
  Scenario: A clean sweep reports its count and no failures
    Given JSON with criteria "a" and "b" and one passing result
    When the summary reads it
    Then it exits 0 and prints exactly "criteria run: 2" and "  (no failing criteria)"

# The typed reports of gates (scripts/gates.ts) and check:merged (scripts/check-merged.ts): the exit code is the
# verdict, and the report's outcome names each code, telling a failed gate from a mutation and from an early stop.
# Each Scenario names the test that executes it.
Feature: Typed reports of gates and check:merged

  @test:scripts/tests/gates-report.test.ts::gates_--report::is_published_as_shared_tool_types
  Scenario: The gates report types are published as shared tool types
    Then TOOL_TYPES includes "GatesReport" and "MergedGatesReport"

  @test:scripts/tests/gates-report.test.ts::gates_--report::--report_takes_a_path,_and_refuses_a_missing_one
  Scenario: --report takes a path and refuses a missing one
    Then with no "--report" argument the report path is undefined
    And "--report /tmp/r.json" gives the path "/tmp/r.json"
    And "--report" with nothing after it throws "needs a path"
    And "--report --all" throws "needs a path"

  @test:scripts/tests/gates-report.test.ts::gates_--report::exit_0_is_a_pass,_and_skipped_gates_stay_listed_apart_from_it
  Scenario: Exit 0 is a pass and skipped gates stay listed
    Given a gates report of 3 gates with one gate skipped as "inputs unchanged"
    When it is finished with exit code 0
    Then its outcome is "pass" and its exit code 0
    And it lists 1 skipped gate
    And it parses unchanged against the GatesReport schema

  @test:scripts/tests/gates-report.test.ts::gates_--report::exit_1_with_a_failed_gate_is_a_fail,_with_its_salient_lines
  Scenario: Exit 1 with a failed gate is a fail carrying its salient lines
    Given a whole-set gates report with a failed gate whose why is "expected 0, got 2"
    When it is finished with exit code 1
    Then its outcome is "fail"
    And its set is "whole"
    And the failed gate's why is ["expected 0, got 2"]

  @test:scripts/tests/gates-report.test.ts::gates_--report::exit_1_with_nothing_failed_but_a_mutation_is_not-clean,_not_a_fail
  Scenario: Exit 1 with nothing failed but a mutation is not-clean
    Given a gates report with no failed gate and mutatedBy "bun test"
    When it is finished with exit code 1
    Then its outcome is "not-clean"

  @test:scripts/tests/gates-report.test.ts::gates_--report::exit_1_with_nothing_recorded_stopped_before_a_verdict,_so_it_is_undetermined
  Scenario: Exit 1 with nothing recorded is undetermined
    Given an empty gates report
    When it is finished with exit code 1
    Then its outcome is "undetermined" and its exit code 1
    And its last undetermined line says "before any verdict"

  @test:scripts/tests/gates-report.test.ts::gates_--report::exit_2,_and_any_other_code,_is_undetermined
  Scenario: Exit 2 and any other code are undetermined
    Given an empty gates report
    Then finished with exit code 2 its outcome is "undetermined"
    And finished with exit code 134 its outcome is "undetermined" with exit code 2

  @test:scripts/tests/gates-report.test.ts::check:merged_--report::a_conflict_names_its_files
  Scenario: A check:merged conflict report names its files
    When a check:merged report is finished with a conflict on "x.ts" and exit code 1
    Then it parses unchanged against the MergedGatesReport schema
    And its conflicts are ["x.ts"]

  @test:scripts/tests/gates-report.test.ts::check:merged_--report::carries_the_inner_gate_run_when_it_wrote_one,_and_ignores_a_file_that_is_not_one
  Scenario: check:merged carries the inner gate report when there is a valid one
    Given a file holding a finished passing gates report and a file holding only an outcome
    Then readInnerReport reads the first with outcome "pass"
    And it reads nothing from the second
    And it reads nothing from an absent file
    And a check:merged report carrying the inner report has gates exit code 0

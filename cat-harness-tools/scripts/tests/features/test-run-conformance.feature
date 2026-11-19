# A test run is checked against the contract of the skill it names (#1168),
# and an absent results directory is not "no runs" (bean 2gst).
# Each Scenario names the test that executes it.
Feature: Test-run conformance

  @test:scripts/tests/test-run-conformance.test.ts::a_test_run_is_checked_against_the_contract_of_the_skill_it_names_(#1168,_B4)::each_state_is_reported_separately,_never_folded_into_a_pass
  Scenario: Each test-run state is reported separately
    Given six test runs: a good crdm-detect run, one with a bad output, one naming an unknown skill, one with no cases, one naming a skill with no contract, and one naming no skill
    When the runs are checked against the harness's skills
    Then 6 runs are counted and 1 is checked
    And "b-bad-output" is nonconforming with "case 1: output"
    And "c-ghost" and "f-unparseable" are unresolved
    And "d-no-cases" and "e-no-contract" are unchecked

  @test:scripts/tests/test-run-conformance.test.ts::an_absent_results_directory_is_not_'no_runs'_(audit_C5,_bean_2gst)::absent:_looked_is_false_and_nothing_is_counted,_so_the_caller_reports_unknown,_not_n/a
  Scenario: An absent directory was not looked at
    When a results directory that does not exist is checked
    Then looked is false and 0 runs are counted

  @test:scripts/tests/test-run-conformance.test.ts::an_absent_results_directory_is_not_'no_runs'_(audit_C5,_bean_2gst)::present_but_empty:_NOT_looked_—_another_writer_may_have_made_it_(cat-harness-tools#759)
  Scenario: A present but empty directory is not looked at
    When an empty results directory is checked
    Then looked is false and 0 runs are counted

  @test:scripts/tests/test-run-conformance.test.ts::an_absent_results_directory_is_not_'no_runs'_(audit_C5,_bean_2gst)::present_but_empty_when_determined_(qa:refresh,_or_a_committed_directory):_looked_—_a_determined_zero_the_caller_may_call_n/a
  Scenario: A determined empty directory was looked at
    When an empty results directory is checked as determined
    Then looked is true and 0 runs are counted
    And a determined check of a directory that does not exist is still not looked

  @test:scripts/tests/test-run-conformance.test.ts::an_absent_results_directory_is_not_'no_runs'_(audit_C5,_bean_2gst)::present_but_empty,_store_hit:_the_store's_runs_are_checked
  Scenario: An empty directory with a store hit was looked at
    # Gap: the title says the store's runs are checked; the store returns no files and only looked is asserted.
    When an empty results directory is checked with a store that answers looked with no files
    Then looked is true

  @test:scripts/tests/test-run-conformance.test.ts::an_absent_results_directory_is_not_'no_runs'_(audit_C5,_bean_2gst)::storeFallback:_miss_or_corrupt_remains_looked=false_(unknown);_hit_checks_files_from_the_store
  Scenario: The store fallback
    # Gap: only a store miss is exercised; the "corrupt" case named in the title is not.
    When an absent directory is checked with a store that misses
    Then looked is false and 0 runs are counted
    When it is checked with a store that returns one good run
    Then looked is true, 1 run is counted and 1 is checked

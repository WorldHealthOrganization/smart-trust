# check:test-budgets: the declared/default split, and the two ways it refuses
# (bean sff8). Each Scenario names the test that executes it.
Feature: Test budgets

  @test:scripts/tests/test-budgets.test.ts::reading_a_junit_document::a_case's_file,_line_and_cost_are_read
  Scenario: A junit case's file, line and cost are read
    Given a junit testcase "n" in "a.test.ts" at line 7 taking 1.5 s
    Then it reads as file "a.test.ts", line 7, name "n", cost 1500 ms

  @test:scripts/tests/test-budgets.test.ts::reading_a_junit_document::a_case_with_no_`file`_is_skipped_rather_than_guessed_at
  Scenario: A case with no file is skipped
    Then a testcase with no file attribute yields no case

  @test:scripts/tests/test-budgets.test.ts::reading_a_junit_document::a_non-numeric_time_is_skipped,_not_read_as_zero
  Scenario: A non-numeric time is skipped
    Then a testcase with time "NaN" yields no case

  @test:scripts/tests/test-budgets.test.ts::reading_a_junit_document::the_suite's_own_wall_clock_is_picked_up,_so_a_reader_can_see_the_load
  Scenario: The suite's wall clock is read
    Given a junit document whose testsuites time is 12.5
    Then the report's suite seconds are 12.5

  @test:scripts/tests/test-budgets.test.ts::a_declared_budget_is_found_in_the_AST,_not_evaluated::a_third_argument_means_declared_—_even_as_an_expression
  Scenario: A third argument declares a budget, even as an expression
    Then 'test("a", () => {}, modules.length * 600);' declares a budget on line 1

  @test:scripts/tests/test-budgets.test.ts::a_declared_budget_is_found_in_the_AST,_not_evaluated::two_arguments_means_it_inherits_the_default
  Scenario: Two arguments inherit the default
    Then a two-argument test call declares no budget

  @test:scripts/tests/test-budgets.test.ts::a_declared_budget_is_found_in_the_AST,_not_evaluated::a_MULTI-LINE_call_reports_its_whole_range
  Scenario: A multi-line call reports its whole range
    Then a test call spanning five lines with a budget reports range 1 to 5

  @test:scripts/tests/test-budgets.test.ts::a_declared_budget_is_found_in_the_AST,_not_evaluated::`it`_counts,_and_so_does_a_modifier_form
  Scenario: it and test.only count
    Then "it" and "test.only" calls with a third argument each declare a budget

  @test:scripts/tests/test-budgets.test.ts::a_declared_budget_is_found_in_the_AST,_not_evaluated::a_THREE-argument_call_that_is_not_a_test_does_not_count
  Scenario: A non-test three-argument call does not count
    Then a three-argument "request" call declares no budget

  @test:scripts/tests/test-budgets.test.ts::a_declared_budget_is_found_in_the_AST,_not_evaluated::`describe`_with_three_arguments_is_not_a_test_budget
  Scenario: describe with three arguments does not count
    Then a three-argument "describe" call declares no budget

  @test:scripts/tests/test-budgets.test.ts::the_report_separates_declared_from_default::an_unreadable_source_is_reported,_and_its_cases_get_NO_share
  Scenario: An unreadable source gets no share
    Given one case whose source file does not exist
    Then the report counts 1 case, 1 declared, lists the file as unreadable, and has no worst cases

  @test:scripts/tests/test-budgets.test.ts::the_report_separates_declared_from_default::bands_count_default-budget_cases_at_or_above_each_share
  Scenario: Bands count only default-budget cases
    # Gap: the only case is unreadable, so every band is zero; no test shows a default-budget case counted in a band.
    Given one case whose source file does not exist
    Then every band's count is 0

  @test:scripts/tests/test-budgets.test.ts::the_report_separates_declared_from_default::zero_cases_yields_zero,_which_`main`_treats_as_exit_2
  Scenario: Zero cases yields zero
    # Gap: the exit 2 of main named in the title is not exercised; only the zero count is.
    Then a junit document with no cases reports 0 cases

  @test:scripts/tests/test-budgets.test.ts::the_report_separates_declared_from_default::the_default_budget_is_bun's,_stated_once
  Scenario: The default budget is 5000 ms
    Then the default budget is 5000 ms

  @test:scripts/tests/test-budgets.test.ts::against_this_repository's_own_sources::`declared-directory-resolves`_is_seen_to_declare_a_budget
  Scenario: declared-directory-resolves declares a budget
    When the source of "cat-harness-tools/scripts/tests/kg/declared-directory-resolves.test.ts" under the checkout's parent is read
    Then at least one declared budget range is found

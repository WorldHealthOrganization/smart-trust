# src/workflow/decision-table.ts evaluates the FEEL unary-test subset DMN tables use, and the process
# model refuses a gateway its table cannot route. Each Scenario names the test that executes it.
Feature: DMN decision tables compute gateway outcomes

  @test:scripts/tests/decision-table.test.ts::the_FEEL_subset::reads_the_tests_the_tables_actually_use
  Scenario: The FEEL unary tests the tables use evaluate correctly
    Given the unary tests "-", "", numbers, comparisons, booleans, quoted strings and comma lists
    When each is evaluated against a value
    Then "-" and "" match anything
    And "0" matches 0 but not 1
    And "> 0", ">= 3", "< 10" and "<= 2" compare numerically
    And "false" matches only false
    And "\"green\"" matches "green"
    And "1, 2, 3" matches 2 but not 4, and "\"a\", \"b\"" matches "b"

  @test:scripts/tests/decision-table.test.ts::the_FEEL_subset::a_test_it_cannot_read_throws_rather_than_quietly_not_matching
  Scenario: An unreadable unary test throws instead of not matching
    Given the unary tests "[1..5]" and "date(x)"
    When each is evaluated
    Then each throws an unsupported-DMN error

  @test:scripts/tests/decision-table.test.ts::the_FEEL_subset::`not(...)`_negates_a_unary-test_list,_because_a_shipped_table_uses_it
  Scenario: A not(...) unary test negates its whole list
    Given negated unary tests over strings, numbers, a list and a comparison
    When each is evaluated
    Then "not(\"green\")" matches "red" but not "green"
    And "not(0)" matches 3 but not 0
    And "not(\"red\",\"green\")" matches "amber" but not "green"
    And "not(> 5)" matches 3 but not 9
    And "not (\"green\")" with a space matches "red"
    And "not()" throws a decision error
    And "not([1..5])" throws an unsupported-DMN error

  @test:scripts/tests/decision-table.test.ts::the_FEEL_subset::comparing_a_number_test_against_a_non-number_is_an_error,_not_false
  Scenario: A numeric test against a non-number throws
    Given the unary test "> 0"
    When it is evaluated against "lots"
    Then it throws a decision error

  @test:scripts/tests/decision-table.test.ts::a_table_must_be_able_to_route_the_gateway_it_backs::an_outcome_with_no_matching_branch_fails_at_load,_not_at_decision_time
  Scenario: A table outcome no branch handles fails when the process is loaded
    Given a DMN table whose only outcome is "passed"
    And a BPMN gateway backed by it whose branches are "yes" and "no"
    When the process model is loaded
    Then loading fails with an unsupported-BPMN error naming "passed"

# scripts/gen-default-boards.ts decides which instantiated harnesses owe a default board
# and writes that board, which shows all contents by having no filter.
# Each Scenario names the test that executes it.
Feature: Default boards for instantiated harnesses

  @test:scripts/tests/gen-default-boards.test.ts::who_owes_a_board::a_DEPENDENCY_is_excluded_too_—_instantiated_is_a_different_fact
  Scenario: Only instantiated harnesses owe a board, not mere dependencies
    Given a fixture checkout declaring layers "one" and "two"
    And a root instance config only for "one"
    When the harnesses owed a board are listed
    Then the list is exactly "one"
    And once an index config lists only "two" as an instance, the list is exactly "two"

  @test:scripts/tests/gen-default-boards.test.ts::who_owes_a_board::the_set_is_sorted,_so_it_is_a_function_of_the_declarations
  Scenario: The set of harnesses owed a board is sorted
    Given the real checkout and the candidates "who-iris", "cat-harness" and "agent-skills" in that order
    When the harnesses owed a board are listed
    Then the list is in sorted order

  @test:scripts/tests/gen-default-boards.test.ts::what_the_board_says::'filled_with_all_contents'_is_the_ABSENT_filter
  Scenario: The default board shows all contents by having no filter
    Given the default board for id "x" titled "X"
    Then it has no filter
    And it parses as a board equal to schema "folio-board/v1", id "x", title "X" and nothing else

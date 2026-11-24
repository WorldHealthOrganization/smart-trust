# scripts/gates.ts refuses to load an empty gate set, and reports a gate set it could not
# derive as neither a pass nor a failure (exit 2). Each Scenario names the test that executes it.
Feature: The gate runner's could-not-determine state

  @test:scripts/tests/sdlc/gates-third-state.test.ts::loadGates_refuses_rather_than_returning_an_empty_set::throws_when_the_workflow_file_is_absent
  Scenario: Loading gates throws when the workflow file is absent
    Given an empty root directory
    When the gates are loaded
    Then it throws

  @test:scripts/tests/sdlc/gates-third-state.test.ts::loadGates_refuses_rather_than_returning_an_empty_set::throws_when_the_workflow_parses_but_yields_NO_commands
  Scenario: Loading gates throws when the workflow yields no commands
    Given a root whose gates workflow declares no jobs
    When the gates are loaded
    Then it throws saying this is "not a clean sweep"

  @test:scripts/tests/sdlc/gates-third-state.test.ts::the_report_that_accompanies_exit_2::says_in_words_that_this_is_neither_a_pass_nor_a_failure
  Scenario: The undetermined report says it is neither a pass nor a failure
    When the undetermined report is made for an error "boom"
    Then it says "could not derive the gate set", "NOT a pass and NOT a failure" and "Exit 2"
    And no line starts with "✓"

  @test:scripts/tests/sdlc/gates-third-state.test.ts::the_report_that_accompanies_exit_2::names_the_file_it_looked_for_and_the_root_it_looked_under
  Scenario: The undetermined report names the workflow file and the root
    When the undetermined report is made under "/some/root"
    Then it names the gates workflow file and "/some/root"

  @test:scripts/tests/sdlc/gates-third-state.test.ts::the_report_that_accompanies_exit_2::carries_the_underlying_cause_rather_than_swallowing_it
  Scenario: The undetermined report carries the underlying cause
    When the undetermined report is made for an error "ENOENT: nope"
    Then it contains "ENOENT: nope"

  @test:scripts/tests/sdlc/gates-third-state.test.ts::the_report_that_accompanies_exit_2::survives_a_non-Error_throw
  Scenario: The undetermined report survives a thrown string
    When the undetermined report is made for the string "just a string"
    Then it contains "just a string"

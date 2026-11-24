# Specifies loadGates (scripts/gates.ts) over the real checkout.
Feature: loadGates returns gates for a real repository

  @test:test/coordinator/gates-third-state-checkout.test.ts::loadGates_refuses_rather_than_returning_an_empty_set::returns_a_NON-EMPTY_set_for_this_repository,_so_the_tests_above_are_not_vacuous
  Scenario: The checkout has gates
    Given the checkout root
    When its gates are loaded without --all
    Then there is at least one gate

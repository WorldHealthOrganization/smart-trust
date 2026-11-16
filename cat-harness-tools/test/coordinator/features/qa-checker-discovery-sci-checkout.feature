# Specifies discoverBlockCheckers, discoverScriptCheckers and
# criterionSubject (pipeline/qa-checker-discovery.ts) with the checkout's
# loaded contributions.
Feature: Every automated QA criterion resolves to a checker, and none is unimplemented

  @test:test/coordinator/qa-checker-discovery-sci-checkout.test.ts::every_automated_criterion_resolves,_from_the_module_the_registry_names::every_automated_block_criterion_resolves
  Scenario: Every automated block criterion has a discovered checker
    Given the automated criteria whose subject is "block"
    When the block checkers are discovered with the checkout's contributions
    Then there are more than 50 such criteria
    And every one has a checker

  @test:test/coordinator/qa-checker-discovery-sci-checkout.test.ts::the_two_disagreements_are_reported,_not_swallowed::nothing_automated_is_unimplemented_right_now
  Scenario: Nothing automated is unimplemented
    Given the block and script checkers discovered with the checkout's contributions
    When their unimplemented lists are read
    Then both are empty

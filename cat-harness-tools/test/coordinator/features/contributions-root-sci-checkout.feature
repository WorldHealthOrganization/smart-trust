# Specifies contributionsRoot (pipeline/repo-root.ts): loading contributions
# from it registers folio-assistant-sci's two cost checkers.
Feature: Loading from contributionsRoot registers the contributed cost checkers

  @test:test/coordinator/contributions-root-sci-checkout.test.ts::contributionsRoot::loading_from_contributionsRoot()_registers_both_contributed_cost_checkers
  Scenario: Both cost checkers are registered
    Given the contributions loaded from contributionsRoot()
    When the QA checkers for "proof-compile-cost" and "proof-no-cost-regression" are looked up
    Then both are registered

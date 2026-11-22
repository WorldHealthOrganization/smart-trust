# pipeline/repo-root.ts's contributionsRoot() is where contributions load from; loading
# from cat-harness/ silently registers no contributed checkers.
# Each Scenario names the test that executes it.
Feature: Where contributions are loaded from

  @test:pipeline/contributions-root.test.ts::contributionsRoot::in_the_platform's_own_repository_it_is_the_repository_root,_not_cat-harness/
  Scenario: In the platform's own repository contributions load from the repository root, not cat-harness/
    Given the platform's own harness root
    When the contributions root is resolved
    Then it is the parent directory of the harness root

  @test:pipeline/contributions-root.test.ts::contributionsRoot::the_control:_loading_from_cat-harness/_registers_neither_cost_checker
  Scenario: Loading contributions from cat-harness/ registers neither cost checker
    Given contributions loaded from the harness root itself
    When the registry is asked for the "proof-compile-cost" and "proof-no-cost-regression" QA checkers
    Then neither is registered

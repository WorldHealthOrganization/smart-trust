# Specifies censusRepository (scripts/root-scan-census.ts) over the checkout.
Feature: The root-scan census covers the repository and says which instances it scanned

  @test:test/coordinator/root-scan-census-checkout.test.ts::the_census_covers_the_repository,_and_says_which_instances_it_scanned_(tqv4)::over_this_repository,_folio-assistant-core's_scripts_are_in_scope
  Scenario: folio-assistant-core's scripts are scanned
    Given the checkout
    When the census is taken
    Then the scope "folio-assistant-core/scripts" is "scanned"
    And some row's file is under "folio-assistant-core/scripts/"

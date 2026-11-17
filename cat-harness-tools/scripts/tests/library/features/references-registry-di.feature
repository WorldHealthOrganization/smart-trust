# The reference database is content, injected by DI; the Proxy lets the
# consumers read references as a plain array.
Feature: The reference registry is injected

  @test:scripts/tests/library/references-registry-di.test.ts::reference_registry_DI::is_unconfigured_before_injection,_and_says_so
  Scenario: An unconfigured registry names its remedy
    Given no reference registry has been configured
    When the registry is read
    Then it throws an error naming configureReferenceRegistry

  @test:scripts/tests/library/references-registry-di.test.ts::reference_registry_DI_—_once_configured::`references`_behaves_as_the_array_the_consumers_expect
  Scenario: The injected references behave as an array
    Given a registry configured with three CSL entries
    Then references has length 3 and its first id is alpha2020
    And map, filter, spread and find over it give the expected results

  @test:scripts/tests/library/references-registry-di.test.ts::reference_registry_DI_—_once_configured::`for…of`_iterates_it
  Scenario: for…of iterates the injected references
    Given a registry configured with three CSL entries
    When references is iterated with for…of
    Then the ids come in order alpha2020, beta2021, gamma2022

  @test:scripts/tests/library/references-registry-di.test.ts::reference_registry_DI_—_once_configured::`referenceMap`_behaves_as_a_Map
  Scenario: The injected reference map behaves as a Map
    Given a registry configured with three CSL entries
    Then referenceMap has size 3, gets gamma2022's title, and does not have "nope"

  @test:scripts/tests/library/references-registry-di.test.ts::reference_registry_DI_—_once_configured::re-injection_swaps_the_data
  Scenario: Re-injecting swaps the data
    Given a registry configured with three CSL entries
    When it is configured again with one entry
    Then references and referenceMap both have size 1

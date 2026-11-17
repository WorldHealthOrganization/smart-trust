# pipeline/qa-criteria-registry.ts registers the detangler-archimedean-wall criterion and the framework and wall domains only when the folio's
# config opts in with the "archimedean-wall" qaAxes entry; each test loads the registry in a subprocess run from a temporary folio. Each Scenario names the test that executes it.
Feature: Folio-optional QA axes

  @test:scripts/tests/folio-optional-axes.test.ts::detangler-archimedean-wall_is_folio-optional::absent_config_key_⇒_not_registered,_and_not_in_the_watcher_bucket
  Scenario: Without qaAxes the wall criterion is neither registered nor watched
    Given a paper folio whose config has no qaAxes
    When the QA criteria registry is loaded there
    Then the optional axes are empty
    And "detangler-archimedean-wall" is neither in the registry nor in the detangler watcher bucket

  @test:scripts/tests/folio-optional-axes.test.ts::detangler-archimedean-wall_is_folio-optional::another_folio's_axis_does_not_open_this_one
  Scenario: Another folio's axis does not register the wall criterion
    Given a paper folio whose qaAxes is "q-usage"
    When the QA criteria registry is loaded there
    Then "detangler-archimedean-wall" is neither in the registry nor in the detangler watcher bucket

  @test:scripts/tests/folio-optional-axes.test.ts::detangler-archimedean-wall_is_folio-optional::opting_in_registers_it,_and_the_watcher_bucket_agrees
  Scenario: Opting in registers the wall criterion and the watcher bucket agrees
    Given a paper folio whose qaAxes is "archimedean-wall"
    When the QA criteria registry is loaded there
    Then the optional axes are "archimedean-wall"
    And "detangler-archimedean-wall" is in the registry and in the watcher bucket
    And there is exactly one more detangler criterion than with no qaAxes

  @test:scripts/tests/folio-optional-axes.test.ts::the_`framework`_domain_is_folio-optional_too::absent_config_key_⇒_no_framework_criteria,_and_no_wall_criteria
  Scenario: Without qaAxes there are no framework or wall criteria
    Given a paper folio whose config has no qaAxes
    When the QA criteria registry is loaded there
    Then it has no framework-domain and no wall-domain criteria

  @test:scripts/tests/folio-optional-axes.test.ts::the_`framework`_domain_is_folio-optional_too::another_folio's_axis_does_not_open_it
  Scenario: Another folio's axis does not open the framework domain
    Given a paper folio whose qaAxes is "q-usage"
    When the QA criteria registry is loaded there
    Then it has no framework-domain criteria

  @test:scripts/tests/folio-optional-axes.test.ts::the_`framework`_domain_is_folio-optional_too::`archimedean-wall`_opens_framework_AND_wall_—_it_is_one_folio's_mathematics
  Scenario: The archimedean-wall axis opens both the framework and wall domains
    Given a paper folio whose qaAxes is "archimedean-wall"
    When the QA criteria registry is loaded there
    Then it has at least one framework-domain and at least one wall-domain criterion

  @test:scripts/tests/folio-optional-axes.test.ts::the_`framework`_domain_is_folio-optional_too::the_fence_changes_the_registry_SIZE,_so_it_is_not_cosmetic
  Scenario: Opting in makes the registry larger
    Given one folio with no qaAxes and one with "archimedean-wall"
    When the QA criteria registry is loaded in each
    Then the framework, wall and detangler criteria together number more with the axis than without

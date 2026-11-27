# Specifies loadProcessModel's enforcement and loadRelaxations and
# validateRelaxations (src/workflow/gate.ts) over the processes the
# checkout's instances ship.
Feature: Content-type processes are advisory, and the shipped relaxations are legal and explained

  @test:test/coordinator/workflow-gate-checkout.test.ts::the_base_is_strict_and_the_content-type_processes_are_not::the_three_per-content-type_processes_are_advisory
  Scenario: The three per-content-type processes are advisory
    Given authoring-a-paper, l2-dak-authoring and l3-fhir-pipeline, found by name
    When each process model is loaded
    Then its enforcement is "advisory"

  @test:test/coordinator/workflow-gate-checkout.test.ts::the_relaxations_this_repo_actually_ships::all_of_them_are_legal_against_the_real_processes
  Scenario: The shipped relaxations are legal and each is attributed and explained
    Given the six shipped process models and the instance's relaxations
    When the relaxations are validated against the models
    Then validation does not throw
    And every relaxation names a package
    And every reason is longer than 20 characters

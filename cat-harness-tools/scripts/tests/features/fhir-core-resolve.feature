# FHIR core types resolved from a layer's declared fhir-core-definitions graph (bean cat-tools-t6fz):
# scripts/schema-graph.ts loadFhirCore. Each Scenario names the test that executes it.
Feature: FHIR core types resolved from the fhir-core graph

  @test:scripts/tests/fhir-core-resolve.test.ts::FHIR_core_types_from_a_declared_fhir-core_graph::maps_a_fhirVersion_to_its_release,_and_says_nothing_for_an_unknown_one
  Scenario: A model's fhirVersion picks its release
    Then 4.0.1 reads from r4, 4.3.0 from r4b, 5.0.0 from r5
    And a version outside the stable releases, or none, picks no release

  @test:scripts/tests/fhir-core-resolve.test.ts::FHIR_core_types_from_a_declared_fhir-core_graph::loads_only_the_referenced_core_type,_from_the_model's_release,_and_resolves_the_edge_to_it
  Scenario: A referenced core type becomes a class, and the edge resolves to it
    Given an R4 logical model whose field "code" is typed Coding, and an r4 release holding Coding and Patient
    When the core types it references are loaded
    Then only Coding is loaded, and the field edge "code" resolves to it with nothing unresolved

  @test:scripts/tests/fhir-core-resolve.test.ts::FHIR_core_types_from_a_declared_fhir-core_graph::reports_an_unread_release,_an_unmaterialised_body_and_an_unstated_version,_and_loads_nothing_for_them
  Scenario: What cannot be read is reported, never guessed
    Given a release whose body is not materialised, a release that is unread, and a model that states no fhirVersion
    Then nothing is loaded for any of them, and each is reported in unread

  @test:scripts/tests/fhir-core-resolve.test.ts::FHIR_core_types_from_a_declared_fhir-core_graph::loads_nothing_when_no_layer_declares_FHIR_core
  Scenario: No declared FHIR core graph
    Then nothing is loaded and nothing is reported

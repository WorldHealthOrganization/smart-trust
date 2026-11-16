# Specifies servedDirectories (scripts/mount-instance-docs.ts) over the
# checkout's real declarations.
Feature: The checkout's declarations serve exactly the artefact indexes and the OpenAPI graph

  @test:test/coordinator/mount-instance-docs-checkout.test.ts::a_served_directory's_bytes_publish_at_/<instance>/<path>_—_bean_680p::the_real_declarations_serve_smart-trust's_and_smart-base's_artefact_indexes_and_smart-trust's_OpenAPI_graph,_and_nothing_else
  Scenario: The served routes are exactly the four declared ones
    Given the checkout's declarations
    When the served directories' routes are listed and sorted
    Then they are smart-base/fhir-artifact-index, smart-trust-phw/fhir-artifact-index, smart-trust/fhir-artifact-index and smart-trust/openapi

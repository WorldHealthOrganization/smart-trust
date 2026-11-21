# scripts/check-instance-graph.ts (check:instance-graph) gates the declaration as well as the graph: every
# instance declares needs and has its own absolute harness IRI, the real gate using kg-export's exportIdentity.
# Each Scenario names the test that executes it.
Feature: The instance graph gate checks each declaration

  @test:scripts/tests/kg/instance-declaration-gate.test.ts::every_instance_declares_`needs`::an_instance_with_no_`needs`_is_a_finding
  Scenario: An instance with no needs is a finding
    Given a temporary repository with instance "floor" declaring empty needs and instance "silent" declaring none
    When the gate collects the repository
    Then the only finding is "undeclared-needs" on instance "silent"
    And the result is not clean

  @test:scripts/tests/kg/instance-declaration-gate.test.ts::every_instance_declares_`needs`::`[]`_declares_the_floor_and_passes
  Scenario: Empty needs declares the floor and passes
    Given a temporary repository with instance "floor" declaring empty needs and "upper" needing "floor"
    When the gate collects the repository
    Then there are no findings
    And the result is clean

  @test:scripts/tests/kg/instance-declaration-gate.test.ts::every_instance_has_its_own_absolute_harness_IRI::distinct_absolute_IRIs_pass,_and_are_reported
  Scenario: Distinct absolute IRIs pass and are reported
    Given a temporary repository with instance "a" needing nothing and instance "b" needing "a"
    And an IRI resolver giving "https://example.org/<name>.jsonld"
    When the gate collects the repository
    Then there are no findings
    And the reported IRIs are "https://example.org/a.jsonld" and "https://example.org/b.jsonld"

  @test:scripts/tests/kg/instance-declaration-gate.test.ts::every_instance_has_its_own_absolute_harness_IRI::no_IRI,_or_a_relative_one,_is_a_finding
  Scenario: A missing or relative IRI is a finding
    Given a temporary repository with instance "a" needing nothing and instance "b" needing "a"
    And an IRI resolver giving no IRI for "a" and the relative "b/b.jsonld" for "b"
    When the gate collects the repository
    Then the findings are two "no-iri"

  @test:scripts/tests/kg/instance-declaration-gate.test.ts::every_instance_has_its_own_absolute_harness_IRI::two_instances_sharing_one_IRI_is_a_finding
  Scenario: Two instances sharing one IRI is a finding
    Given a temporary repository with instance "a" needing nothing and instance "b" needing "a"
    And an IRI resolver giving "https://example.org/same.jsonld" for both
    When the gate collects the repository
    Then the only finding is "duplicate-iri"

  @test:scripts/tests/kg/instance-declaration-gate.test.ts::the_exporter's_IRI_rule_(the_one_the_real_gate_injects)::an_instance_with_its_own_canonicalUrl_sits_at_<canonicalUrl>/<stub>.jsonld_—_no_doubled_segment
  Scenario: An instance with its own canonicalUrl sits at its canonicalUrl with no doubled segment
    Given the real repository's "fhir-harness" instance
    When exportIdentity resolves its canonical IRI
    Then it is "https://litlfred.github.io/folio-assistant/fhir-harness/fhir-harness.jsonld"

  @test:scripts/tests/kg/instance-declaration-gate.test.ts::the_exporter's_IRI_rule_(the_one_the_real_gate_injects)::an_instance_with_no_canonicalUrl_of_its_own_still_publishes_under_the_host's_segment
  Scenario: An instance without its own canonicalUrl publishes under the host's segment
    Given the real repository's "bootstrap" instance
    When exportIdentity resolves its canonical IRI
    Then it is "https://litlfred.github.io/folio-assistant/bootstrap/bootstrap.jsonld"

  @test:scripts/tests/kg/instance-declaration-gate.test.ts::the_exporter's_IRI_rule_(the_one_the_real_gate_injects)::the_real_repository_passes_the_whole_gate
  Scenario: The real repository passes the whole gate
    Given the real repository root
    When the gate collects it with exportIdentity as the IRI resolver
    Then there are no findings
    And every instance has a reported IRI

# targetNamespacesInUse in scripts/external-schemas.ts maps each BPMN targetNamespace to the diagrams that declare it,
# so drift away from the one shared workflows namespace is caught. Each Scenario names the test that executes it.
Feature: Diagrams share one BPMN targetNamespace

  @test:scripts/tests/external-schemas-target-ns.test.ts::targetNamespacesInUse::groups_diagrams_by_the_namespace_they_declare
  Scenario: Diagrams are grouped by the namespace they declare
    Given diagrams a.bpmn and c.bpmn declaring the workflows namespace and b.bpmn declaring "http://folio-assistant.dev/bpmn/b"
    When the namespaces in use are read
    Then the workflows namespace maps to "processes/a.bpmn" and "processes/c.bpmn"
    And "http://folio-assistant.dev/bpmn/b" maps to "processes/b.bpmn"

  @test:scripts/tests/external-schemas-target-ns.test.ts::targetNamespacesInUse::a_diagram_that_declares_none_is_reported,_not_skipped
  Scenario: A diagram with no targetNamespace is reported under the empty namespace
    Given a diagram x.bpmn that declares no targetNamespace
    When the namespaces in use are read
    Then the empty namespace maps to "processes/x.bpmn"

  @test:scripts/tests/external-schemas-target-ns.test.ts::targetNamespacesInUse::the_real_corpus_has_exactly_one,_and_it_is_the_canonical_IRI
  Scenario: The real corpus uses only the canonical workflows namespace
    Given the committed process diagrams
    When the namespaces in use are read
    Then the only namespace is the workflows namespace
    And at least one diagram declares it

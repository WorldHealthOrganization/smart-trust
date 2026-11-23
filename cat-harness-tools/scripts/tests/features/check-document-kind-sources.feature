# scripts/check-document-kind-sources.ts checks that every graph id a document kind's section names in `computedFrom`
# is a graph its instance can reach through its own declaration and the layers it needs.
# Each Scenario names the test that executes it.
Feature: A document kind computes only from graphs its instance can reach

  @test:scripts/tests/check-document-kind-sources.test.ts::what_an_instance_can_name::smart-base_reaches_its_own_library
  Scenario: An instance reaches its own library graph
    Given the graph ids reachable from each instance in the real corpus
    Then smart-base can reach "library"

  @test:scripts/tests/check-document-kind-sources.test.ts::what_an_instance_can_name::a_graph_only_an_instance_ABOVE_declares_is_not_reachable:_fhir-harness_cannot_name_smart-base-findings
  Scenario: A graph declared only by a higher instance is not reachable from below
    Given the graph ids reachable from each instance in the real corpus
    Then smart-base can reach "smart-base-findings"
    And fhir-harness cannot reach "smart-base-findings"

  @test:scripts/tests/check-document-kind-sources.test.ts::the_judgement::a_declared_graph_id_passes
  Scenario: A computedFrom naming a reachable graph passes
    Given a smart-base document kind with one section computed from "library"
    When it is judged
    Then there are no problems and one claim is counted

  @test:scripts/tests/check-document-kind-sources.test.ts::the_judgement::an_undeclared_graph_—_the_external_evidence_nobody_has_ingested_—_is_refused
  Scenario: A computedFrom naming an undeclared graph is refused
    Given a smart-base document kind with one section computed from "cochrane-reviews"
    When it is judged
    Then the only problem names "cochrane-reviews"

  @test:scripts/tests/check-document-kind-sources.test.ts::the_judgement::the_real_corpus_makes_claims,_and_every_one_resolves
  Scenario: Every computedFrom claim in the real corpus resolves
    When the check runs over the real corpus
    Then at least one claim is counted
    And there are no problems

# pipeline/gen-values-jsonld.ts lists every Liquid value reference in a folio's Markdown
# as a values.jsonld node, resolved as the renderers resolve it, with a reason when it does not.
# Each Scenario names the test that executes it.
Feature: The values.jsonld graph of value references

  @test:pipeline/gen-values-jsonld.test.ts::values.jsonld::one_node_per_distinct_reference,_each_with_its_state
  Scenario: Each distinct reference is one node carrying its state
    Given a demo instance with a masses witness value m = "0.51099895069", a pass-through "site.data" instance, and two chapter Markdown files referencing values
    When the values graph is built
    Then its nodes are exactly the four distinct references, the precision-3 and raw m, "data.nope" and "site.data.fhir.version"
    And the precision-3 reference is "resolved", formatted "0.511", with value "0.51099895069" and provenance file "demo/computations/masses.witness.json"
    And the precision-3 reference used twice in a.md lists a.md once in usedIn
    And the raw m reference lists only b.md in usedIn

  @test:pipeline/gen-values-jsonld.test.ts::values.jsonld::an_unresolved_reference_is_a_node_with_its_reason,_a_pass-through_one_awaits_its_pipeline,_a_foreign_one_is_not_ours
  Scenario: An unresolved reference keeps its reason, a pass-through one awaits its pipeline, and a foreign one is left out
    Given the same demo folio
    When the values graph is built
    Then the "data.nope" node is "unresolved" with a reason naming no scalar at "data.nope"
    And the "site.data.fhir.version" node is "pass-through"
    And no node is keyed under "page."

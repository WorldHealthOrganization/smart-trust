# schemas/content/vocab-mapping.ts applies a declared vocabulary mapping and derives JSON-LD
# context bindings from it: a conditional dcterms:title on concept schemes (D1) and fsh-guts
# naming name and description as the main export does (D2). Each Scenario names the test that executes it.
Feature: Vocabulary mappings are applied and bound from their declaration

  @test:scripts/tests/kg/vocab-mapping-apply.test.ts::D1:_a_concept_scheme_that_is_also_a_document_carries_a_derived_dcterms:title::the_condition_is_declared_on_the_row,_as_a_ConceptMap_dependsOn_on_a_declared_attribute
  Scenario: The title condition is declared on the row as a dependsOn on a declared attribute
    Given the "concept-scheme-naming" vocabulary mapping
    When its targets carrying a dependsOn are collected
    Then the only one is code "title", authority "derived", derived from "prefLabel"
    And every attribute it depends on is a declared additional attribute

  @test:scripts/tests/kg/vocab-mapping-apply.test.ts::D1:_a_concept_scheme_that_is_also_a_document_carries_a_derived_dcterms:title::a_scheme_that_is_a_document_gets_the_title,_copied_from_the_label
  Scenario: A concept scheme that is a document gets a title copied from its label
    When the "concept-scheme-naming" mapping is applied to label "x glossary" with isDocument true
    Then the result is prefLabel "x glossary" and title "x glossary"

  @test:scripts/tests/kg/vocab-mapping-apply.test.ts::D1:_a_concept_scheme_that_is_also_a_document_carries_a_derived_dcterms:title::a_scheme_that_is_not_a_document_gets_the_label_only
  Scenario: A concept scheme that is not a document gets the label only
    When the "concept-scheme-naming" mapping is applied to label "x" with isDocument false
    Then the result is prefLabel "x" alone

  @test:scripts/tests/kg/vocab-mapping-apply.test.ts::D1:_a_concept_scheme_that_is_also_a_document_carries_a_derived_dcterms:title::an_emitter_that_does_not_answer_the_condition_is_refused,_not_defaulted
  Scenario: An emitter that leaves the condition unanswered is refused
    When the "concept-scheme-naming" mapping is applied to label "x" with no isDocument
    Then it fails naming "isDocument"

  @test:scripts/tests/kg/vocab-mapping-apply.test.ts::D2:_fsh-guts_maps_name_and_description_exactly_as_the_main_export_does::both_documents_expand_name_and_description_to_the_same_predicates
  Scenario: fsh-guts and the main export expand name and description alike
    Given the fsh-guts export's @context and kg-export's context
    When "name" and "description" are expanded under each
    Then each key expands to the same predicate in both
    And under fsh-guts "name" is rdfs:label's IRI and "description" is dcterms:description's IRI

  @test:scripts/tests/kg/vocab-mapping-apply.test.ts::contextBindings::keeps_a_CURIE_whose_prefix_the_document_declares,_and_expands_one_it_does_not
  Scenario: A CURIE is kept when its prefix is declared and expanded when not
    Given the "kg-node-naming" mapping and a context declaring only "rdfs"
    When its context bindings are derived
    Then name is "rdfs:label" and summary is "rdfs:comment"
    And title and description are the full dcterms IRIs

  @test:scripts/tests/kg/vocab-mapping-apply.test.ts::contextBindings::`only`_keeps_the_named_keys_and_refuses_one_no_row_writes
  Scenario: "only" keeps the named keys and refuses a key no row writes
    Given the "kg-node-naming" mapping
    Then deriving bindings with only "name" gives exactly the key "name"
    And deriving with only "nope" fails naming "nope"

  @test:scripts/tests/kg/vocab-mapping-apply.test.ts::contextBindings::one_key_bound_to_two_predicates_by_two_tables_is_refused
  Scenario: One key bound to two predicates by two tables is refused
    Given the "kg-node-naming" mapping and a "clash" table binding "title" to skos:prefLabel
    When context bindings are derived from both
    Then it fails with "two predicates"

  @test:scripts/tests/kg/vocab-mapping-apply.test.ts::contextBindings::the_role-naming_row_agrees_with_kg-node-naming_on_`title`
  Scenario: The role-naming table agrees with kg-node-naming on title
    When context bindings are derived from "kg-node-naming" and "role-naming" together
    Then title is the dcterms title IRI
    And prefLabel and notation are the SKOS IRIs

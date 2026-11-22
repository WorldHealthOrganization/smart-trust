# A term that restated a published standard is that standard's property, in
# the exporter, the published vocabulary and bootstrap's own graph.
# Each Scenario names the test that executes it.
Feature: Standard properties replace restated terms

  @test:scripts/tests/standard-properties.test.ts::a_term_that_restates_a_standard_is_the_standard's_property::there_are_replaced_terms_at_all_—_an_empty_set_must_not_pass
  Scenario: Some terms are replaced
    Then at least one property gloss has a replacedBy

  @test:scripts/tests/standard-properties.test.ts::a_term_that_restates_a_standard_is_the_standard's_property::every_replacement_resolves_to_an_absolute_IRI_outside_this_platform's_namespaces
  Scenario: Every replacement is an absolute IRI outside the platform
    Then each replaced term's replacement IRI is http(s) and differs from the term's own IRI

  @test:scripts/tests/standard-properties.test.ts::a_term_that_restates_a_standard_is_the_standard's_property::kg-export_writes_each_replaced_key_as_its_replacement,_never_the_retired_term
  Scenario: kg-export maps each replaced key to its replacement
    When the export context is built
    Then each replaced key present maps to its replacement IRI, not the retired one
    And no context key maps to a retired IRI

  @test:scripts/tests/standard-properties.test.ts::a_term_that_restates_a_standard_is_the_standard's_property::a_term_never_replaced_is_still_minted_here
  Scenario: A term never replaced is minted here
    Then performedBy's property IRI is its own term IRI

  @test:scripts/tests/standard-properties.test.ts::a_term_that_restates_a_standard_is_the_standard's_property::the_published_vocabulary_keeps_each_retired_term,_deprecated,_saying_what_replaced_it
  Scenario: The published vocabulary keeps retired terms as deprecated
    When the vocabulary is built
    Then each replaced term is a node marked deprecated with isReplacedBy its replacement
    And the deprecated nodes are exactly the replaced terms

  @test:scripts/tests/standard-properties.test.ts::a_term_that_restates_a_standard_is_the_standard's_property::kg-export_and_bootstrap's_own_graph_name_one_relation_with_one_IRI
  Scenario: kg-export and bootstrap name each shared relation with one IRI
    When the export context and bootstrap's exported graph context are expanded
    Then from/sourceRef, to/targetRef, partOf/isPartOf, holdsGraph/type, requires, title and description each expand to the same IRI
    And requires is dcterms:requires

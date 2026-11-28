# scripts/ns-export.ts builds each publishing layer's namespace (ns) document: a SKOS concept
# scheme holding that layer's block-kind classes, plus the bootstrap vocabulary path.
# Each Scenario names the test that executes it.
Feature: Each layer publishes its own ns document for its block-kind classes

  @test:scripts/tests/kg/ns-export-instance.test.ts::instancesPublishingNs::returns_cat-harness,_folio-assistant-core,_folio-assistant-sci,_smart-base
  Scenario: The layers publishing an ns document are listed in order
    When the instances publishing an ns document are listed
    Then the list is exactly "cat-harness", "folio-assistant-core", "folio-assistant-sci", "smart-base"

  @test:scripts/tests/kg/ns-export-instance.test.ts::each_instance_publishes_its_own_ns_document_for_its_block-kind_classes::folio-assistant-core_ns_document_contains_its_block_kinds_with_SKOS_and_RDFS_fields
  Scenario: The folio-assistant-core ns document holds its block kinds with SKOS and RDFS fields
    When the exact vocabulary of "folio-assistant-core" is built
    Then the document is a skos:ConceptScheme and an owl:Ontology whose id is the layer's concept scheme IRI
    And each of Algorithm, Diagram, Equation, Example, Figure, Prose, Remark, Simulator and Table is an rdfs:Class and skos:Concept
    And each has a label and comment, with prefLabel equal to the label and definition equal to the comment
    And each has its own id as notation, the layer's scheme as inScheme and isDefinedBy, and layer "core"
    And Prose, whose heading is empty, is labelled "Prose" and its definition contains "Shown with no heading"
    And no folio-assistant-sci or smart-base kind is in the document

  @test:scripts/tests/kg/ns-export-instance.test.ts::each_instance_publishes_its_own_ns_document_for_its_block-kind_classes::folio-assistant-sci_ns_document_contains_sci_block_kinds
  Scenario: The folio-assistant-sci ns document holds the sci block kinds
    When the exact vocabulary of "folio-assistant-sci" is built
    Then the document is a skos:ConceptScheme whose id is the layer's concept scheme IRI
    And each of Conjecture, Corollary, Definition, Lemma, Proof, Proposition and Theorem is an rdfs:Class and skos:Concept in that scheme, with its id as notation
    And Theorem has label "Theorem" and definition "Theorem"
    And no folio-assistant-core or smart-base kind is in the document

  @test:scripts/tests/kg/ns-export-instance.test.ts::each_instance_publishes_its_own_ns_document_for_its_block-kind_classes::smart-base_ns_document_contains_smart-base_block_kinds
  Scenario: The smart-base ns document holds the smart-base block kinds
    When the exact vocabulary of "smart-base" is built
    Then the document is a skos:ConceptScheme whose id is the layer's concept scheme IRI
    And it holds 21 smart-base terms
    And smart-base:Persona is an rdfs:Class and skos:Concept in the smart-base scheme

  @test:scripts/tests/kg/ns-export-instance.test.ts::each_instance_publishes_its_own_ns_document_for_its_block-kind_classes::cat-harness_exact_ns_document_contains_harness_terms_and_no_block_kinds
  Scenario: The cat-harness ns document holds no block kinds
    When the exact vocabulary of "cat-harness" is built
    Then the document is a skos:ConceptScheme whose id is the cat-harness concept scheme IRI
    And no folio-assistant-core, folio-assistant-sci or smart-base term is in it
    # Gap: the presence of harness terms is not checked

  @test:scripts/tests/kg/ns-export-instance.test.ts::each_instance_publishes_its_own_ns_document_for_its_block-kind_classes::@context_binds_all_publishing_instance_prefixes
  Scenario: The @context binds every publishing layer's prefix
    When the full vocabulary is built
    Then its @context binds "cat-harness", "folio-assistant-core", "folio-assistant-sci" and "smart-base" each to its namespace

  @test:scripts/tests/kg/ns-export-instance.test.ts::ns:check_fails_on_a_folioType_whose_owner_does_not_publish_an_ns_definition::undefined_block_kind_folioType_is_flagged_in_undefinedTerms
  Scenario: The clean monorepo has no undefined prefixed terms
    # Gap: only the clean case is checked; no undefined folioType is introduced
    When the full vocabulary is built
    Then its report lists no undefined term carrying a prefix

  @test:scripts/tests/kg/ns-export-instance.test.ts::ns:check_fails_on_a_folioType_whose_owner_does_not_publish_an_ns_definition::flags_block_kind_whose_owner_does_not_publish_an_ns_definition
  Scenario: A block kind whose owner publishes no ns definition is flagged
    Given the discovered block kinds plus a kind "weird" with folioType "unpublishing-owner:WeirdKind"
    When the vocabulary is built from those kinds
    Then the report's undefined terms include "unpublishing-owner:WeirdKind"

  @test:scripts/tests/kg/ns-export-instance.test.ts::bootstrapVocabularyPath_resolves_from_both_the_index_root_and_the_cat-harness_root_(bean_63q4)::bootstrapVocabularyPath_returns_<workspace>/bootstrap/ns.jsonld_for_both_roots
  Scenario: The bootstrap vocabulary path is the same from either root
    When the bootstrap vocabulary path is resolved with no root, the cat-harness root, and the workspace root
    Then each is "<workspace>/bootstrap/ns.jsonld"

  @test:scripts/tests/kg/ns-export-instance.test.ts::bootstrapVocabularyPath_resolves_from_both_the_index_root_and_the_cat-harness_root_(bean_63q4)::buildVocabularyOne_builds_bootstrap's_vocabulary_when_given_the_index_root
  Scenario: Bootstrap's vocabulary builds from an index root
    Given a temporary index root holding only bootstrap/bootstrap.json and bootstrap/ns.jsonld, with no .git
    When bootstrap's vocabulary is built from that root
    Then the result is "built" at "https://litlfred.github.io/bootstrap/v0/ns/"
    And its paths are "v0/ns/index.html", "v0/ns/index.jsonld" and "v0/ns/index.json"
    And it holds more than 0 terms

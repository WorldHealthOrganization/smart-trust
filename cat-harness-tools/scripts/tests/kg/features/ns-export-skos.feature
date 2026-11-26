# scripts/ns-export.ts emits the folio vocabulary as SKOS concepts and concept schemes alongside
# its RDFS facts, and takes bootstrap's terms from bootstrap's own file.
# Each Scenario names the test that executes it.
Feature: The folio vocabulary emits SKOS

  @test:scripts/tests/kg/ns-export-skos.test.ts::the_folio_vocabulary_emits_SKOS::it_emits_concepts_AT_ALL_—_the_zero_`fd6i`_measured_must_not_pass
  Scenario: The full vocabulary emits more than 100 SKOS concepts
    When the full vocabulary is built
    Then it holds more than 0 skos:Concept nodes that are not concept schemes
    And it holds more than 100 of them

  @test:scripts/tests/kg/ns-export-skos.test.ts::the_folio_vocabulary_emits_SKOS::every_concept_carries_prefLabel,_definition,_notation_and_inScheme
  Scenario: Every concept carries prefLabel, definition, notation and inScheme
    When the full vocabulary is built
    Then it holds at least one concept
    And no concept lacks a prefLabel, a definition, a notation or an inScheme

  @test:scripts/tests/kg/ns-export-skos.test.ts::the_folio_vocabulary_emits_SKOS::the_SKOS_labels_AGREE_with_the_RDFS_ones_rather_than_drifting
  Scenario: The SKOS labels agree with the RDFS ones
    When the full vocabulary is built
    Then it holds at least one concept
    And every concept's prefLabel equals its label and its definition equals its comment

  @test:scripts/tests/kg/ns-export-skos.test.ts::the_folio_vocabulary_emits_SKOS::`notation`_is_the_CODE_—_unique_across_the_whole_vocabulary
  Scenario: Each notation is unique across the whole vocabulary
    When the full vocabulary is built
    Then it holds at least one concept
    And no two concepts share a notation

  @test:scripts/tests/kg/ns-export-skos.test.ts::the_folio_vocabulary_emits_SKOS::every_`inScheme`_resolves_to_a_scheme_IN_THIS_DOCUMENT
  Scenario: Every inScheme resolves to a scheme in the same document
    When the vocabulary is built for all layers, and for each of "bootstrap", "harness" and "core"
    Then each document holds at least one concept
    And every concept's inScheme is the id of a concept scheme in that document

  @test:scripts/tests/kg/ns-export-skos.test.ts::the_folio_vocabulary_emits_SKOS::a_scheme_is_emitted_only_where_it_has_members_—_never_an_empty_one
  Scenario: A scheme is emitted only where it has members
    When the "bootstrap" vocabulary is built
    Then it holds exactly 1 concept scheme
    And in the vocabulary for all layers and for each of "bootstrap", "harness" and "core", every scheme has a concept inScheme of it

  @test:scripts/tests/kg/ns-export-skos.test.ts::the_folio_vocabulary_emits_SKOS::the_scheme_set_GROWS_with_the_slice_—_derived,_not_hardcoded
  Scenario: The scheme set grows with the layer slice
    When the vocabularies of "bootstrap", "harness" and "core" are built
    Then they hold 1, 2 and 3 concept schemes respectively

  @test:scripts/tests/kg/ns-export-skos.test.ts::the_folio_vocabulary_emits_SKOS::in_--exact_mode_the_DOCUMENT_is_the_scheme,_with_no_duplicate_@id
  Scenario: In exact mode the document is the scheme, with no duplicate @id
    When the exact vocabulary of each of "bootstrap", "harness" and "core" is built
    Then the document is typed skos:ConceptScheme
    And no node in its @graph has the document's own @id
    And every concept's inScheme is the document or a scheme in its graph

  @test:scripts/tests/kg/ns-export-skos.test.ts::the_folio_vocabulary_emits_SKOS::the_document's_@context_binds_skos:,_and_so_does_the_content_context
  Scenario: The document context and the content context both bind skos:
    When the full vocabulary is built
    Then its @context binds "skos" to "http://www.w3.org/2004/02/skos/core#"
    And the content context binds "skos" to the same IRI

  @test:scripts/tests/kg/ns-export-skos.test.ts::the_folio_vocabulary_emits_SKOS::the_locally-declared_namespaces_EQUAL_the_ones_in_jsonld.ts
  Scenario: The namespaces declared in ns-export equal those in jsonld.ts
    When the full vocabulary is built
    Then its @context "skos" equals the SKOS namespace in schemas/kg/jsonld.ts
    And its @context "dcterms" equals the DCTERMS namespace there

  @test:scripts/tests/kg/ns-export-skos.test.ts::the_folio_vocabulary_emits_SKOS::the_RDFS_facts_are_UNTOUCHED_—_this_adds,_it_does_not_replace
  Scenario: The SKOS emission keeps the RDFS facts
    When the full vocabulary is built
    Then it holds at least one concept
    And every concept has a label, comment, isDefinedBy and layer
    And every concept is typed rdfs:Class, rdf:Property or bootstrap:GraphTypology

  @test:scripts/tests/kg/ns-export-skos.test.ts::bootstrap's_terms_have_ONE_source_(owner,_2026-09-30:_how_can_it_not_drift?)::every_bootstrap_node_the_harness_build_holds_IS_bootstrap's_own_file's_node
  Scenario: The harness build's bootstrap nodes are bootstrap's own file's nodes
    Given the @graph of bootstrap's own vocabulary file
    When the full vocabulary is built
    Then its bootstrap: nodes, with their layer field removed, equal that @graph

# Vocabulary mapping tables, relationship and SKOS correspondence, the vocab-map
# Tool and the vocab-mappings:check gate (bean k74z). Each Scenario names the
# test that executes it.
Feature: Vocabulary mapping tables

  Background:
    Given a scheme mapping label, definition and retired to SKOS, and label (derived from prefLabel) and usages to Dublin Core

  @test:scripts/tests/vocab-mapping-fhir.test.ts::relationship_tables::R5_→_R4_→_R5_is_the_identity_on_every_R5_code
  Scenario: R5 to R4 and back is the identity
    Then every R5 relationship mapped to R4 and back is itself

  @test:scripts/tests/vocab-mapping-fhir.test.ts::relationship_tables::every_R4_code_has_an_R5_relationship
  Scenario: Every R4 equivalence maps to an R5 relationship
    Then every R4 equivalence maps to one of the R5 relationships

  @test:scripts/tests/vocab-mapping-fhir.test.ts::relationship_tables::SKOS:_each_match_property_reads_back_as_the_relationship_that_writes_it
  Scenario: SKOS match properties round-trip
    Then every relationship with a SKOS match property reads back as itself
    And "not-related-to" has no SKOS match property
    And "skos:closeMatch" reads as "related-to"

  @test:scripts/tests/vocab-mapping-fhir.test.ts::expandCurie::expands_a_known_CURIE_and_leaves_IRIs,_URNs_and_unknown_prefixes_as_written
  Scenario: Only known CURIEs are expanded
    Then "skos:prefLabel" expands to the SKOS core IRI
    And an http IRI, a URN and "unknown:term" are left as written

  @test:scripts/tests/vocab-mapping-fhir.test.ts::applying_a_table_(the_vocab-map_Tool)::a_derived_target_sits_after_its_source_and_copies_its_value;_absent_values_write_nothing
  Scenario: Applying the table
    Then label, definition, retired false and no usages give prefLabel, title (copied) and definition
    And with retired and usages set, the keys are prefLabel, title, definition, deprecated, usage in that order
    And only a definition gives only definition

  @test:scripts/tests/vocab-mapping-fhir.test.ts::applying_a_table_(the_vocab-map_Tool)::two_rows_writing_one_key_is_refused
  Scenario: Two rows writing one key are refused
    Given the SKOS group twice
    Then applying it throws 'two rows write "prefLabel"'

  @test:scripts/tests/vocab-mapping-fhir.test.ts::applying_a_table_(the_vocab-map_Tool)::a_derived_target_must_name_its_source,_and_only_a_derived_one_may
  Scenario: A derived target must name its source
    # Gap: only the first half is checked; no test shows a non-derived target naming a source being refused.
    Then a derived target with no derivedFrom is refused by the schema

  @test:scripts/tests/vocab-mapping-fhir.test.ts::the_vocab-mappings:check_gate's_own_judgements::a_clean_table_passes;_a_derived_target_with_no_authoritative_source,_and_an_undeclared_prefix,_are_each_a_finding
  Scenario: The gate's findings
    Then the scheme has no findings
    And a table whose derived title has no authoritative prefLabel is a finding 'derives from "prefLabel", which no authoritative target'
    And a group targeting "nope:" is a finding 'uses an undeclared prefix'

# Specifies run and pinnedTerminology (scripts/check-term-mapping.ts): the
# real glossary mapped onto SKOS and FHIR, and how an unusable pinned FHIR
# snapshot is reported.
Feature: Every glossary candidate is mapped to both targets, and an unusable snapshot is a reason

  @test:test/coordinator/term-mapping-checkout.test.ts::corpus_—_the_real_glossary,_asserting_scope_rather_than_a_count::every_candidate_gets_a_row_for_BOTH_targets,_and_fhir_is_never_silently_unmapped
  Scenario: Every candidate has a SKOS and a FHIR row, and FHIR rows are honest about undetermined
    Given the term mappings run over the current directory
    When they are parsed with the term mappings file schema
    Then they parse
    And there is at least one SKOS row and as many FHIR rows
    And a FHIR row carries an undetermined reason exactly when its concept is "undetermined"
    And the FHIR scope has an unreachable reason exactly when some FHIR row is undetermined

  @test:test/coordinator/term-mapping-checkout.test.ts::corpus_—_the_real_glossary,_asserting_scope_rather_than_a_count::the_pin_and_its_snapshot_agree_on_the_version
  Scenario: The real pin and its snapshot agree on the version
    Given the pinned terminology of the current directory
    When it does not load and a reason is returned instead
    Then the reason is not the "holds … while … pins" version disagreement
    When it loads as a terminology rather than a reason
    Then its version matches "v" followed by a digit
    And it equals the version the pin record names

  @test:test/coordinator/term-mapping-checkout.test.ts::corpus_—_the_real_glossary,_asserting_scope_rather_than_a_count::an_unusable_snapshot_is_a_reason,_not_a_silent_zero::a_well-formed_snapshot_still_loads_—_the_control
  Scenario: A well-formed snapshot loads
    Given a pin at v1.0.0 and a well-formed v1.0.0 snapshot with one concept
    When the pinned terminology is read
    Then it is a terminology, not a reason

  @test:test/coordinator/term-mapping-checkout.test.ts::corpus_—_the_real_glossary,_asserting_scope_rather_than_a_count::an_unusable_snapshot_is_a_reason,_not_a_silent_zero::ZERO_concepts_is_undetermined,_not_a_terminology_that_matched_nothing
  Scenario: A snapshot with zero concepts is a reason
    Given a pin at v1.0.0 and a snapshot with no concepts
    When the pinned terminology is read
    Then it is a reason mentioning "NO concepts"

  @test:test/coordinator/term-mapping-checkout.test.ts::corpus_—_the_real_glossary,_asserting_scope_rather_than_a_count::an_unusable_snapshot_is_a_reason,_not_a_silent_zero::a_snapshot_missing_`concepts`_entirely_is_refused_by_the_schema
  Scenario: A snapshot missing concepts is refused by the schema
    Given a pin at v1.0.0 and a snapshot with no concepts field
    When the pinned terminology is read
    Then it is a reason mentioning "PinnedTerminologySchema"

  @test:test/coordinator/term-mapping-checkout.test.ts::corpus_—_the_real_glossary,_asserting_scope_rather_than_a_count::an_unusable_snapshot_is_a_reason,_not_a_silent_zero::a_concept_missing_its_code_is_refused_—_the_cast_accepted_any_shape
  Scenario: A concept missing its code is refused by the schema
    Given a pin at v1.0.0 and a snapshot whose only concept has no code
    When the pinned terminology is read
    Then it is a reason mentioning "PinnedTerminologySchema"

  @test:test/coordinator/term-mapping-checkout.test.ts::corpus_—_the_real_glossary,_asserting_scope_rather_than_a_count::an_unusable_snapshot_is_a_reason,_not_a_silent_zero::the_version_disagreement_is_still_caught,_and_reported_as_itself
  Scenario: A version disagreement is reported as itself
    Given a pin at v2.0.0 and a well-formed v1.0.0 snapshot
    When the pinned terminology is read
    Then it is a reason mentioning "re-snapshot at the pinned tag"

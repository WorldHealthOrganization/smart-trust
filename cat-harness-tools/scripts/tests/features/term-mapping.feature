# The mapping check, and the guard against it silently always saying zero
# (bean 7wou). Each Scenario names the test that executes it.
Feature: Term mapping

  @test:scripts/tests/term-mapping.test.ts::the_index_matches_when_it_should_—_the_non-vacuity_guard::a_prefLabel_match_is_`exact:_mapped`,_and_carries_the_external_URI
  Scenario: A prefLabel match is exactly mapped
    Given authored "Policy" with an exactMatch URI and authored "Actor" with altLabel "Participant"
    And candidates "policy", "Participant" and "Wombat"
    When the candidates are resolved against the SKOS index
    Then "policy" is exact mapped and concept mapped, citing the ODRL Policy URI with "skos:exactMatch"

  @test:scripts/tests/term-mapping.test.ts::the_index_matches_when_it_should_—_the_non-vacuity_guard::an_altLabel_match_is_`concept:_mapped`_but_NOT_`exact`
  Scenario: An altLabel match is concept mapped only
    Then "participant" is exact unmapped and concept mapped, with "skos:closeMatch"

  @test:scripts/tests/term-mapping.test.ts::the_index_matches_when_it_should_—_the_non-vacuity_guard::a_genuine_miss_is_`unmapped`_on_both,_with_no_matches
  Scenario: A miss is unmapped on both
    Then "wombat" is exact and concept unmapped, with no matches

  @test:scripts/tests/term-mapping.test.ts::the_index_matches_when_it_should_—_the_non-vacuity_guard::an_authored_term_is_not_a_candidate,_so_it_never_maps_to_itself
  Scenario: An authored term is not a candidate
    Then no result is for term "actor"

  @test:scripts/tests/term-mapping.test.ts::the_index_matches_when_it_should_—_the_non-vacuity_guard::normalisation_is_substance,_not_typography
  Scenario: Label normalisation ignores typography
    Then "  Policy. " normalises as "policy" does
    And "task   run" normalises to "task run"

  @test:scripts/tests/term-mapping.test.ts::the_index_matches_when_it_should_—_the_non-vacuity_guard::the_committed_projection_KEEPS_the_pair:_exact_and_concept-only_stay_apart_(bean_5yhm)
  Scenario: The per-scheme projection keeps exact and concept apart
    When the results are projected per scheme
    Then "participant" is not exact with concept "platform:actor" and no exact concepts
    And "policy" is exact with the ODRL URI as both concept and exact concept
    And the row lists no undetermined terms

  @test:scripts/tests/term-mapping.test.ts::exactConcepts_names_WHICH_concept_was_exact_(bean_5yhm,_SKOS_publish)::only_the_prefLabel_hit_is_in_exactConcepts;_both_are_in_concepts
  Scenario: Only the prefLabel concept is exact
    Given "Ledger" is concept A's prefLabel and concept B's altLabel
    When candidate "Ledger" is resolved and projected
    Then it is exact, its concepts are A and B, and its exact concepts are A alone

  @test:scripts/tests/term-mapping.test.ts::termState_—_the_one_place_the_record_becomes_a_per-term_answer_(bean_5yhm)::mapped_carries_exact_and_the_concepts
  Scenario: A mapped term state carries exact and the concepts
    Given a row with term "a" mapped to concept "u", not exact
    Then the state of "a" is mapped, not exact, with concepts ["u"]

  @test:scripts/tests/term-mapping.test.ts::termState_—_the_one_place_the_record_becomes_a_per-term_answer_(bean_5yhm)::an_all-undetermined_row_answers_undetermined_with_its_reason_—_never_unmapped
  Scenario: An all-undetermined row answers undetermined
    Given a row of 3 undetermined with reason "host refused"
    Then any term's state is undetermined with that reason

  @test:scripts/tests/term-mapping.test.ts::termState_—_the_one_place_the_record_becomes_a_per-term_answer_(bean_5yhm)::a_mixed_row_reads_its_list;_without_one_it_answers_unknown
  Scenario: A mixed row reads its undetermined list
    Given a row with 1 unmapped and 1 undetermined listing "b"
    Then "b" is undetermined and "a" is unmapped
    And the same row without the list answers "unknown"

  @test:scripts/tests/term-mapping.test.ts::termState_—_the_one_place_the_record_becomes_a_per-term_answer_(bean_5yhm)::no_row,_or_two_rows,_is_unknown
  Scenario: No row or two rows is unknown
    Then with no rows, or two rows for the same scheme, a term is "unknown"

  @test:scripts/tests/term-mapping.test.ts::termState_—_the_one_place_the_record_becomes_a_per-term_answer_(bean_5yhm)::perScheme_names_undetermined_terms_ONLY_when_a_row_is_mixed
  Scenario: The undetermined list is written for a mixed row
    # Gap: the title's "ONLY when mixed" negative is checked elsewhere (the projection test); here only the mixed case is shown.
    Given an unmapped "a" and an undetermined "b" in one scheme
    When they are projected per scheme
    Then the row lists "b" as undetermined
    And "a" reads unmapped and "b" undetermined

  @test:scripts/tests/term-mapping.test.ts::rows_are_keyed_by_(instance,_scheme)_(beans_wvzp,_q3n9)::one_shared_scheme_id_gives_one_row_per_instance
  Scenario: One shared scheme id gives a row per instance
    Given scheme "kg-tools" in "cat-harness" with "policy" and in "fhir-harness" with "Policy" and "Wombat"
    When the results are projected
    Then the kg-tools rows are cat-harness with 1 mapped 0 unmapped, and fhir-harness with 1 mapped 1 unmapped

  @test:scripts/tests/term-mapping.test.ts::rows_are_keyed_by_(instance,_scheme)_(beans_wvzp,_q3n9)::a_term_id_in_two_instances'_schemes_is_resolved,_not_unknown
  Scenario: A term id shared by two instances is resolved for each
    Then "policy" is mapped for both instances
    And "wombat" is unmapped for both

  @test:scripts/tests/term-mapping.test.ts::rows_are_keyed_by_(instance,_scheme)_(beans_wvzp,_q3n9)::an_instance_with_no_such_scheme_has_no_row,_so_it_is_unknown_rather_than_borrowing_another's
  Scenario: An instance without the scheme is unknown
    Then "policy" for instance "who-iris" scheme "kg-tools" is "unknown"

  @test:scripts/tests/term-mapping.test.ts::rows_are_keyed_by_(instance,_scheme)_(beans_wvzp,_q3n9)::every_mapping_names_its_scheme's_instance_and_still_satisfies_the_record_schema
  Scenario: Every mapping names its instance and validates
    Then every mapping satisfies the record schema
    And their instances are cat-harness, fhir-harness, fhir-harness

  @test:scripts/tests/term-mapping.test.ts::rows_are_keyed_by_(instance,_scheme)_(beans_wvzp,_q3n9)::a_mapping_with_no_instance_is_refused:_the_key_is_not_optional
  Scenario: A mapping without an instance is refused
    Then the first mapping with its instance removed fails the schema

  @test:scripts/tests/term-mapping.test.ts::the_fhir_half_resolves_against_a_PUBLISHED_IG_AT_A_VERSION::a_display_match_is_`concept:_mapped`_and_cites_system#code_at_the_version
  Scenario: A FHIR display match cites system#code at the version
    Given a pinned IG snapshot at "v1.0.0" with CDHIv1#1.1 "Targeted client communication"
    When candidate "targeted client communication" is resolved
    Then it is concept mapped to "CDHIv1#1.1" in scheme "who-smart-base@v1.0.0"

  @test:scripts/tests/term-mapping.test.ts::the_fhir_half_resolves_against_a_PUBLISHED_IG_AT_A_VERSION::it_is_closeMatch,_never_exactMatch_—_and_`exact`_stays_unmapped
  Scenario: A FHIR match is a closeMatch
    When candidate "ValueSet" is resolved against the snapshot
    Then its predicate is "skos:closeMatch" and exact is unmapped

  @test:scripts/tests/term-mapping.test.ts::the_fhir_half_resolves_against_a_PUBLISHED_IG_AT_A_VERSION::a_miss_against_a_PRESENT_snapshot_is_`unmapped`,_not_undetermined
  Scenario: A miss against a present snapshot is unmapped
    When candidate "wombat" is resolved against the snapshot
    Then it is concept unmapped with no undetermined reason

  @test:scripts/tests/term-mapping.test.ts::undetermined_is_never_unmapped::no_pinned_snapshot_yields_undetermined_WITH_a_reason
  Scenario: No snapshot is undetermined with a reason
    When a candidate is resolved with the reason "host refused" instead of a snapshot
    Then exact and concept are undetermined with that reason, and the mapping validates

  @test:scripts/tests/term-mapping.test.ts::undetermined_is_never_unmapped::undetermined_with_NO_reason_is_refused_by_the_schema
  Scenario: Undetermined without a reason is refused
    Then a mapping undetermined on both with no reason fails the schema

  @test:scripts/tests/term-mapping.test.ts::undetermined_is_never_unmapped::`mapped`_with_nothing_named_is_refused
  Scenario: Mapped with no matches is refused
    Then a mapping mapped on both with no matches fails the schema

  @test:scripts/tests/term-mapping.test.ts::undetermined_is_never_unmapped::exact-mapped_with_concept-unmapped_is_unreachable_and_refused
  Scenario: Exact mapped with concept unmapped is refused
    Then a mapping exact mapped, concept unmapped, with an exactMatch fails the schema

  @test:scripts/tests/term-mapping.test.ts::a_file_must_say_what_it_did_NOT_ask::a_scope_missing_a_target_is_refused
  Scenario: A scope missing a target is refused
    Given a mappings file whose scope names only "skos"
    Then it fails the schema, and the error mentions "fhir"

  @test:scripts/tests/term-mapping.test.ts::a_file_must_say_what_it_did_NOT_ask::both_targets,_one_of_them_with_an_empty_consulted_list,_parses
  Scenario: Every target with empty consulted lists parses
    Given a mappings file scoping every mapping target with an empty consulted list
    Then it parses

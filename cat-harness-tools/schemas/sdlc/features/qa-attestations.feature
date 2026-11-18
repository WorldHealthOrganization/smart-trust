# Specifies schemas/sdlc/qa-attestations.ts: the attestation store (bean 2gst).
# The schema holds only judgements, a file's path mirrors the derived family's
# tree, and a read answers in one of five states.
Feature: The attestation store holds judgements only, and a read says which state it found

  @test:schemas/sdlc/qa-attestations.test.ts::qa-attestations/v1::a_kg-qa_file_with_pair_attestations_and_voice_reviews_validates
  Scenario: A kg-qa attestation file with pair attestations and voice reviews validates
    Given a kg-qa attestation file for process "Process_P" with one hashed pair attestation and one voice review
    When it is parsed with the QA attestations schema
    Then it parses

  @test:schemas/sdlc/qa-attestations.test.ts::qa-attestations/v1::it_holds_ONLY_judgements:_a_derived_field_is_refused
  Scenario: A derived field is refused
    Given the kg-qa attestation file
    When it also carries criteria or totals
    Then it is refused

  @test:schemas/sdlc/qa-attestations.test.ts::qa-attestations/v1::every_judgement_pins_the_hash_it_attested,_so_staleness_is_detectable
  Scenario: A pair attestation must pin the hashes it attested
    Given a pair attestation without its code_hash
    When the attestation file is parsed
    Then it is refused

  @test:schemas/sdlc/qa-attestations.test.ts::qa-attestations/v1::the_family_is_one_of_the_shared_list:_kg-qa_(bean_2gst),_block-qa_and_translation-qa_(bean_8wj1)
  Scenario: The family is one of the shared list
    Then the attestation families are, in order, kg-qa, block-qa, translation-qa, bib-verification, bib-human-review, requirement-signoff, certification, section-title and adversarial-review
    And an attestation file of family "lsi" is refused

  @test:schemas/sdlc/qa-attestations.test.ts::qa-attestations/v1::the_graph_typology_is_registered,_as_state,_with_this_validator
  Scenario: The attestations graph typology is state, validated by this schema
    When the "attestations" graph typology is looked up
    Then it holds "state"
    And its validator is "schemas/sdlc/qa-attestations.ts#QaAttestationsSchema"

  @test:schemas/sdlc/qa-attestations.test.ts::where_an_attestation_lives::the_same_mirrored_path_as_the_derived_sidecar,_under_<home>/<family>/
  Scenario: An attestation mirrors the derived sidecar's path under <home>/<family>/
    Given the derived sidecar "test/results/kg-qa/skills/pkg/a.kg-qa.json"
    When its attestation path is computed for home "test/attestations" and family kg-qa
    Then it is "test/attestations/kg-qa/skills/pkg/a.attestations.json"

  @test:schemas/sdlc/qa-attestations.test.ts::where_an_attestation_lives::a_sidecar_outside_the_derived_tree_is_a_caller's_bug,_never_a_quiet_miss
  Scenario: A sidecar outside the derived tree throws
    When the attestation path is computed for a sidecar outside the derived root
    Then it throws

  @test:schemas/sdlc/qa-attestations.test.ts::where_an_attestation_lives::an_instance_with_no_declaration_falls_back_to_the_convention
  Scenario: An undeclared instance uses the conventional attestations home
    Given a fresh temporary instance root with no declaration
    When its attestations home is resolved
    Then root and store root are <root>/test/attestations, found "by convention"

  @test:schemas/sdlc/qa-attestations.test.ts::reading_—_five_states,_and_a_miss_or_an_absent_store_is_'never_attested'_only_after_the_prior_is_read::no_store_at_all_is_ABSENT,_not_a_miss_—_the_writer_then_moves_the_prior's_judgements_(owner_ruling_2)
  Scenario: No store at all reads as absent
    Given an attestation path under a fresh temporary home of its own
    When it is read against a store root that does not exist
    Then the state is "absent"

  @test:schemas/sdlc/qa-attestations.test.ts::reading_—_five_states,_and_a_miss_or_an_absent_store_is_'never_attested'_only_after_the_prior_is_read::a_store_path_that_is_not_a_directory_is_UNKNOWN
  Scenario: A store root that is a file reads as unknown
    Given a fresh temporary home of its own
    And the store root is an empty regular file in it
    When the attestation path is read against it
    Then the state is "unknown"

  @test:schemas/sdlc/qa-attestations.test.ts::reading_—_five_states,_and_a_miss_or_an_absent_store_is_'never_attested'_only_after_the_prior_is_read::a_store_with_no_file_for_this_subject_is_a_miss_—_even_with_no_family_tree_under_it_yet
  Scenario: An existing store with no file for the subject reads as a miss
    Given a fresh temporary home of its own
    When the attestation path is read against the home directory, which has no kg-qa tree
    Then the state is "miss"
    And after the kg-qa tree is created, reading against it is still "miss"

  @test:schemas/sdlc/qa-attestations.test.ts::reading_—_five_states,_and_a_miss_or_an_absent_store_is_'never_attested'_only_after_the_prior_is_read::a_conflict-marked_or_invalid_file_is_CORRUPT,_never_an_empty_list
  Scenario: A conflict-marked or invalid file reads as corrupt
    Given a fresh temporary home of its own, with the subject's directory created
    When the attestation file holds git conflict markers
    Then the state is "corrupt"
    And a file with only $schema and family is also "corrupt"

  @test:schemas/sdlc/qa-attestations.test.ts::reading_—_five_states,_and_a_miss_or_an_absent_store_is_'never_attested'_only_after_the_prior_is_read::a_valid_file_is_a_hit,_returned_as_written_—_key_order_included
  Scenario: A valid file reads as a hit, exactly as written
    Given a fresh temporary home of its own, with the subject's directory created
    And a valid attestation file whose pair attestation's keys are not in schema order, written with serialiseAttestations
    When it is read
    Then the state is "hit"
    And the returned file serialises identically to what was written, key order included
    And the raw text ends with a newline

  @test:schemas/sdlc/qa-attestations.test.ts::the_kg-qa_sidecar_no_longer_carries_judgements::KgQaReportSchema_refuses_pair_attestations_and_voice_reviews
  Scenario: The derived kg-qa sidecar carries no judgements
    Given a minimal derived kg-qa report that parses
    When it also carries pair_attestations or voice_reviews
    Then the kg-qa report schema refuses it

  @test:schemas/sdlc/qa-attestations.test.ts::the_certification_family_(bean_zaui)::a_certification_file_validates_against_CertificationAttestationsSchema_and_QaAttestationsSchema
  Scenario: A certification file validates under both schemas
    Given a certification attestation file for a test report, with one signed entry
    When it is parsed with the certification schema and with the QA attestations schema
    Then both parse

  @test:schemas/sdlc/qa-attestations.test.ts::the_certification_family_(bean_zaui)::a_certification_entry_requires_either_verdict_or_decision
  Scenario: A certification entry needs a verdict or a decision
    When the entry has neither verdict nor decision
    Then the certification file is refused
    And an entry with only a verdict parses
    And an entry with only a decision parses

  @test:schemas/sdlc/qa-attestations.test.ts::the_certification_family_(bean_zaui)::certificationPath_resolves_under_<attestationsHome>/certification/
  Scenario: A certification path lies under <home>/certification/
    Given the attestations home "/repo/test/attestations"
    When certification paths are computed for "plan-123", "sub/dir/report.json" and "my-cert.attestations.json"
    Then each is <home>/certification/<id without extension>.attestations.json

  @test:schemas/sdlc/qa-attestations.test.ts::the_certification_family_(bean_zaui)::a_filed_certification_round-trips_cleanly_through_the_store
  Scenario: A filed certification round-trips through the store
    Given an empty temporary store
    When the certification for "tests/plan-1/report-1" is read
    Then it is "absent"
    When the certification file is written
    Then the write reports written
    And reading it back is a hit equal to the file written
    When the identical file is filed again
    Then the write reports not written
    When a second entry by "human:auditor" is appended
    Then the read-back file has two certifications, the second signed by "human:auditor"

  @test:schemas/sdlc/qa-attestations.test.ts::the_certification_family_(bean_zaui)::corrupt_store_handling_returns_corrupt/unknown_and_refuses_write
  Scenario: A corrupt certification file reads as corrupt and is not overwritten
    Given a certification file holding a conflict marker
    When it is read
    Then the state is "corrupt"
    And a write is refused with state "corrupt"
    And the file is unchanged

  @test:schemas/sdlc/qa-attestations.test.ts::the_certification_family_(bean_zaui)::an_unreadable/non-directory_store_root_returns_unknown_and_refuses_write
  Scenario: A store root that is not a directory reads as unknown and refuses writes
    Given an instance whose test/attestations is a regular file
    When a certification is read
    Then the state is "unknown"
    And a write is refused with state "unknown"

  @test:schemas/sdlc/qa-attestations.test.ts::the_`section-title`_family_—_bean_5qy8,_owner's_option_1::a_decided_verdict_per_chapter_and_section_parses,_through_the_shared_union
  Scenario: A section-title verdict per chapter and section parses
    Given a section-title attestation with a passing verdict for chapter "01-intro", section "1.1"
    When it is parsed with the QA attestations schema
    Then it parses

  @test:schemas/sdlc/qa-attestations.test.ts::the_`section-title`_family_—_bean_5qy8,_owner's_option_1::`pending`_is_refused_—_it_is_the_absence_of_a_judgement,_and_the_store_holds_judgements_only
  Scenario: A pending section-title result is refused
    When the verdict's result is "pending"
    Then the section-title schema refuses it

  @test:schemas/sdlc/qa-attestations.test.ts::the_`section-title`_family_—_bean_5qy8,_owner's_option_1::a_verdict_without_the_hash_it_reviewed_is_refused_—_staleness_is_recomputed_from_it
  Scenario: A section-title verdict without its reviewed hash is refused
    When the verdict has no reviewed_hash
    Then the section-title schema refuses it

  @test:schemas/sdlc/qa-attestations.test.ts::the_`section-title`_family_—_bean_5qy8,_owner's_option_1::an_anonymous_verdict_is_refused
  Scenario: An anonymous section-title verdict is refused
    When the verdict's reviewer is empty
    Then the section-title schema refuses it

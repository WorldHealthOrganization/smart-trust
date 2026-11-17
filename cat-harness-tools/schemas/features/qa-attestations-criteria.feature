# schemas/sdlc/qa-attestations.ts holds the block-qa and translation-qa judgements apart from the derived reports, and scripts/migrate-qa-attestations.ts moves them into that store.
# Each Scenario names the test that executes it.
Feature: The block-qa and translation-qa attestation store

  @test:schemas/qa-attestations-criteria.test.ts::the_envelope_—_2gst's,_with_the_8wj1_families_as_union_members::a_block-qa_file_carries_{kind,_id,_path}_as_its_subject_and_validates
  Scenario: A block-qa store file names its subject by kind, id and path and validates
    Given a throwaway layer whose store was seeded with one judgement for the block "seed"
    When the store file for "seed" is read
    Then its subject is kind "block", id "seed", path "seed"
    And it validates against the attestations schema

  @test:schemas/qa-attestations-criteria.test.ts::the_envelope_—_2gst's,_with_the_8wj1_families_as_union_members::a_script_entry,_a_missing_locale_on_translation-qa,_or_a_stray_field_is_refused
  Scenario: The schema refuses a script entry, a translation-qa file without a locale, and a stray field
    Given a block-qa envelope for the block "b"
    Then it validates when its criterion holds an agent judgement
    And it is refused when its criterion holds a script entry
    And a translation-qa envelope with no locale is refused
    And a translation-qa envelope with locale "fr" validates
    And an envelope carrying an extra "totals" field is refused

  @test:schemas/qa-attestations-criteria.test.ts::the_envelope_—_2gst's,_with_the_8wj1_families_as_union_members::the_subject-composed_path_is_the_same_one_attestationPathFor_gives_for_the_derived_report
  Scenario: The store path composed from a subject matches the one derived from its report
    Given a throwaway layer and the translation-qa key for "content/p" in "fr"
    And the derived report path "test/results/translation-qa/content/p.fr.translation-qa.json"
    When the store path is composed from the key and from the derived report
    Then both paths are the same
    And the key derived from the report equals the composed key

  @test:schemas/qa-attestations-criteria.test.ts::split_and_compose::compose(split(x))_is_x_when_judgements_lead,_key_order_included
  Scenario: Splitting then composing criteria gives back the same map when judgements lead
    Given criteria where "a" holds a judgement then a script entry, "b" one script entry and "c" one judgement
    When the criteria are split and the halves composed again
    Then the script half keeps the keys "a", "b", "c" in order
    And the composed map serializes to the same JSON as the original

  @test:schemas/qa-attestations-criteria.test.ts::split_and_compose::a_malformed_entry_is_kept_as_a_judgement,_never_dropped_as_a_script_one
  Scenario: A malformed entry is kept as a judgement on split
    Given a criterion holding an empty entry and a script entry
    When the criteria are split
    Then the judgement half holds one entry for that criterion

  @test:schemas/qa-attestations-criteria.test.ts::read_states::no_store_directory_at_all_is_`absent`_—_not_a_refusal
  Scenario: A layer with no store directory reads as absent
    Given a throwaway layer with no store
    When the attestations for a block are read
    Then the state is "absent"

  @test:schemas/qa-attestations-criteria.test.ts::read_states::present_store,_no_file_for_the_subject:_`miss`;_a_garbled_file:_`corrupt`
  Scenario: A missing subject file reads as a miss and a garbled one as corrupt
    Given a throwaway layer whose store exists
    When the attestations for "content/b" are read
    Then the state is "miss"
    And after "{ nope" is written to its store file the state is "corrupt"

  @test:schemas/qa-attestations-criteria.test.ts::read_states::a_store_file_holding_a_script_entry,_or_naming_another_subject,_is_`corrupt`
  Scenario: A store file with a script entry or another subject's path reads as corrupt
    Given a throwaway layer whose store exists
    When the store file for "b" holds a script entry
    Then reading it gives "corrupt"
    And when the store file names the path "other" for its subject, reading it gives "corrupt"

  @test:schemas/qa-attestations-criteria.test.ts::owner_ruling_2_—_auto-move_on_first_save::(a)_prior_holds_a_judgement,_NO_store:_after_the_write_it_is_in_the_store,_verbatim
  Scenario: With no store, the first save moves a prior judgement into the store verbatim
    Given a throwaway layer with no store
    And a prior report whose criterion holds a script entry and an agent judgement
    When the prior is resolved and finalized with a new script entry
    Then the resolution adopts the prior
    And reading the store gives "hit" holding only the agent judgement
    And the composed criterion is the judgement followed by the new script entry

  @test:schemas/qa-attestations-criteria.test.ts::owner_ruling_2_—_auto-move_on_first_save::(a')_store_present_but_no_entry_for_this_subject:_moved_the_same_way
  Scenario: With a store but no entry for the subject, the first save moves the judgement the same way
    Given a throwaway layer whose store exists but has no file for "b"
    And a prior report holding one agent judgement
    When the prior is resolved and finalized with no script entries
    Then the resolution adopts the prior
    And reading the store for "b" gives "hit"

  @test:schemas/qa-attestations-criteria.test.ts::owner_ruling_2_—_auto-move_on_first_save::(b)_a_CORRUPT_store_file_is_refused:_nothing_to_write_with
  Scenario: A corrupt store file refuses the save and is left untouched
    Given a store file for "b" holding a merge-conflict marker line
    When a prior holding a judgement is resolved
    Then the resolution fails with the state "corrupt"
    And the store file still holds the conflict marker line

  @test:schemas/qa-attestations-criteria.test.ts::owner_ruling_2_—_auto-move_on_first_save::(b')_a_store_path_that_is_not_a_directory_is_`unknown`,_and_refused
  Scenario: A store path that is a file rather than a directory is unknown and refused
    Given a throwaway layer where "test/attestations" is an empty file
    When a block's prior is resolved
    Then the resolution fails with the state "unknown"

  @test:schemas/qa-attestations-criteria.test.ts::owner_ruling_2_—_auto-move_on_first_save::(c)_store_HIT:_the_store_is_the_source,_and_a_prior's_stale_projection_does_not_change_it
  Scenario: On a store hit the store is the source and a stale prior does not change it
    Given a store file for "b" holding the judgements "kept" and "added-later"
    And a prior holding only "kept" and an old script entry
    When the prior is resolved and finalized with a new script entry
    Then the resolution does not adopt the prior
    And the composed criterion is "kept", "added-later", then the new script entry

  @test:schemas/qa-attestations-criteria.test.ts::owner_ruling_2_—_auto-move_on_first_save::(c')_store_HIT_and_the_prior_holds_a_judgement_the_store_lacks:_a_conflict,_refused,_never_dropped
  Scenario: A prior judgement the store lacks is a refused conflict
    Given a store file for "b" holding the judgement "kept"
    When a prior holding the judgement "stray" is resolved
    Then the resolution fails with the state "conflict"

  @test:schemas/qa-attestations-criteria.test.ts::owner_ruling_2_—_auto-move_on_first_save::an_attesting_writer's_new_entry_is_in_the_store_before_the_derived_report_is_composed
  Scenario: An attesting writer's new judgement is stored under the translation-qa path
    # Gap: does not check that the store is written before the derived report is composed
    Given a throwaway layer whose store exists and the translation-qa key for "p" in "fr"
    When the key is resolved with no prior and finalized by an attesting writer with a judgement and a script entry
    Then reading the store gives "hit"
    And the store path ends in "translation-qa/p.fr.attestations.json"

  @test:schemas/qa-attestations-criteria.test.ts::this_repository's_store_is_the_DECLARED_one::no_marker_file_decides_presence
  Scenario: The harness's store is declared, not marked by a file
    Given the harness root
    Then its attestations home is found by its own declaration
    And there is no "test/attestations/attestations.store.json" marker file

  @test:schemas/qa-attestations-criteria.test.ts::the_D2_split,_measured_over_a_fixture_corpus::before:_every_judgement_is_missing_from_the_store;_after:_counted_by_family,_none_missing
  Scenario: The migration moves every fixture judgement and leaves none missing
    Given a fixture corpus of derived reports holding 4 judgements in 3 files and no store
    When the migration is checked before running
    Then some judgements are missing
    And after the migration runs, the check finds nothing unreadable
    And it counts 4 entries in 3 files with attestations
    And it counts 3 for block-qa and 1 for translation-qa
    And none is missing

  @test:schemas/qa-attestations-criteria.test.ts::the_D2_split,_measured_over_a_fixture_corpus::every_judgement_is_byte-identical_in_the_store
  Scenario: Every migrated judgement is held identically in the store
    Given a migrated fixture corpus
    When each derived report with judgements is read against its store file
    Then every store read is a hit
    And each criterion's judgements in the store match those in the report
    And 4 judgements are compared in all

  @test:schemas/qa-attestations-criteria.test.ts::the_D2_split,_measured_over_a_fixture_corpus::every_judgement's_TEXT_is_the_same_bytes_in_the_derived_report_and_in_the_store
  Scenario: Every judgement's text appears byte for byte in both the report and the store
    Given a migrated fixture corpus
    When each judgement is serialized the way its report escapes text
    Then the derived report contains that text
    And the store file contains that text
    And 4 judgements are compared in all

  @test:schemas/qa-attestations-criteria.test.ts::the_D2_split,_measured_over_a_fixture_corpus::ROUND_TRIP:_each_derived_file,_recomposed_from_its_script_half_and_the_store,_is_the_same_bytes
  Scenario: Recomposing each derived report from its script half and the store gives the same bytes
    Given a migrated fixture corpus
    Then 3 derived reports carry judgements
    And each report rebuilt from its script half and its store file equals the original text

  @test:schemas/qa-attestations-criteria.test.ts::the_D2_split,_measured_over_a_fixture_corpus::ROUND_TRIP_through_ruling_2:_with_NO_store,_the_first_save_writes_exactly_the_migrated_store
  Scenario: With no store, first saves build exactly the store the migration builds
    Given a migrated fixture corpus and a fresh copy with no store
    When each fresh report's prior is resolved and finalized with its script half
    Then every resolution adopts the prior
    And the rebuilt report equals the original text
    And each new store file equals the migrated corpus's store file
    And 4 judgements are moved in all
    And a migration check afterwards finds all 4 already held and none missing

  @test:schemas/qa-attestations-criteria.test.ts::the_D2_split,_measured_over_a_fixture_corpus::the_migration_is_idempotent
  Scenario: Running the migration twice adds nothing the second time
    Given a fixture corpus with no store
    When the migration runs
    Then it adds 4 judgements and writes 3 store files
    And a second run adds 0, writes 0 files and finds 4 already held

  @test:schemas/qa-attestations-criteria.test.ts::the_D2_split,_measured_over_a_fixture_corpus::a_store_file_moved_with_its_content_directory_has_its_stale_subject.path_repaired_by_migrateCriteria
  Scenario: The migration repairs a store file whose subject path went stale
    Given a migrated fixture corpus whose store file for "content/a" names the subject path "old/a"
    When the migration is checked
    Then nothing is unreadable and the store file's "subject.path" is reported missing
    And running the migration writes 1 store file
    And a check afterwards finds nothing unreadable and nothing missing

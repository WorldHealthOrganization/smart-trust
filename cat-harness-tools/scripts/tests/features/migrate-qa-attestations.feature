# The attestation migration, kg-qa half (bean 2gst), round-tripped on the
# real corpus. Each Scenario names the test that executes it.
Feature: Migrating kg-qa attestations into the store

  @test:scripts/tests/migrate-qa-attestations.test.ts::the_real_attestation_store::there_is_one,_and_no_kg-qa_sidecar_still_carries_a_judgement
  Scenario: The real store exists and no kg-qa sidecar still carries a judgement
    When the real attestation store and the kg-qa sidecars are read
    Then the store holds at least one file and no sidecar composes any attestations

  @test:scripts/tests/migrate-qa-attestations.test.ts::the_real_attestation_store::round_trip:_put_each_judgement_back_in_a_copy_of_its_sidecar,_migrate,_and_get_the_same_bytes
  Scenario: Each real judgement round-trips through the migration
    Given each store file's judgements put back into a copy of its sidecar
    When the tree is migrated
    Then the one outcome is "moved" and the store file has the original bytes
    And the stripped sidecar equals the committed one, a second migration does nothing, and at least one entry was round-tripped

  @test:scripts/tests/migrate-qa-attestations.test.ts::the_real_attestation_store::owner_ruling_2_on_the_real_corpus:_with_NO_store,_each_prior_sidecar's_judgements_are_what_the_readers_return,_verbatim
  Scenario: With no store, each prior sidecar's judgements are what the readers return
    Given each store file's judgements written into a sidecar and no store directory
    When the pair attestation and voice review readers read it
    Then both read "absent" and return exactly the sidecar's entries, for every store file

  @test:scripts/tests/migrate-qa-attestations.test.ts::the_real_attestation_store::against_history:_every_judgement_the_sidecars_held_before_the_move_is_in_the_store,_unchanged
  Scenario: Every judgement the sidecars held before the move is in the store unchanged
    Given a checkout holding cat-harness's history from before and at the migration
    When the pre-migration sidecars and the stored files at the migration commit are compared
    Then 32 sidecars held 26 baseline and 6 agent pair attestations, and the stored entries equal them
    # Gap: when cat-harness's history is not in the checkout (as in a standalone checkout) the test returns early and asserts nothing.

  @test:scripts/tests/migrate-qa-attestations.test.ts::refusals::a_store_file_holding_DIFFERENT_judgements_is_a_conflict:_neither_file_is_touched
  Scenario: A store file holding different judgements is a conflict
    Given a sidecar and a store file judging the same subject differently
    When the tree is migrated
    Then the outcome is "conflict" and neither file is changed

  @test:scripts/tests/migrate-qa-attestations.test.ts::refusals::a_dry_run_writes_nothing
  Scenario: A dry run writes nothing
    Given a sidecar holding a pair attestation
    When the tree is migrated as a dry run
    Then the outcome is "moved" but no store is created and the sidecar is unchanged

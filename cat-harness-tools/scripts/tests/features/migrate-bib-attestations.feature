# The bibliography attestation migration (qou C9 stories B3, B4): the legacy
# ledger, migrated into the store and read back, is the same bytes in the
# legacy file's style. Each Scenario names the test that executes it.
Feature: Migrating bibliography attestations into the store

  @test:scripts/tests/migrate-bib-attestations.test.ts::before_migration:_the_reader_falls_back_to_the_legacy_file_and_says_so::source_ledger_and_reviews
  Scenario: Before migration the readers fall back to the legacy files and say so
    Given a folio with a Python-style source ledger and a review ledger
    When the source ledger is read
    Then it comes from the legacy file, with a note saying LEGACY, holding every row
    And the human reviews come from the legacy file, holding every review

  @test:scripts/tests/migrate-bib-attestations.test.ts::before_migration:_the_reader_falls_back_to_the_legacy_file_and_says_so::a_writer_writes_back_where_it_read:_the_legacy_file,_not_the_store
  Scenario: Before migration a writer writes back to the legacy file
    When the read source ledger is written back
    Then it goes to the legacy file and no attestation store is created

  @test:scripts/tests/migrate-bib-attestations.test.ts::the_migration_round-trips_byte_for_byte::--apply,_then_the_store_gives_back_the_legacy_bytes;_--check_passes;_a_second_--apply_is_a_no-op
  Scenario: The migration round-trips byte for byte
    Given the legacy ledgers
    Then a check of the verification family is "waiting"
    When both families are applied
    Then verification migrates 5 rows, 3 of them with an unknown verifier, and the review family migrates
    And the source ledger read from the store serialises back to the legacy bytes, with the legacy file still present
    And the reviews read from the store keep their recorded order and serialise back to the legacy bytes
    And a check then reads "migrated" and a second apply writes nothing

  @test:scripts/tests/migrate-bib-attestations.test.ts::the_migration_round-trips_byte_for_byte::one_file_per_reference;_duplicates_share_it;_orphans_file_by_source;_unknown_verifiers_are_marked,_never_attributed
  Scenario: One file per reference; duplicates share it; orphans file by source; unknown verifiers are marked
    When the verification family is applied
    Then a2004's file holds its two rows at positions 0 and 3, neither naming a verifier
    And the orphan with a source file is filed by that source, marked "unknown" with no verified_by
    And the orphan with an external URL is one file under source/external

  @test:scripts/tests/migrate-bib-attestations.test.ts::after_migration:_writers_write_the_store,_and_refuse_what_they_cannot_read::a_change_round-trips_through_the_store;_a_moved_row_leaves_an_empty_(retracted)_file,_not_a_deletion
  Scenario: After migration a change round-trips through the store, and a moved row leaves an empty file
    Given the migrated ledger with the orphan joined to reference c2010
    When it is written
    Then it goes to the store, reads back equal, and the orphan's source file holds no verifications

  @test:scripts/tests/migrate-bib-attestations.test.ts::after_migration:_writers_write_the_store,_and_refuse_what_they_cannot_read::the_schema_refuses_a_row_marked_unknown_that_names_a_verifier,_and_a_reader_throws_rather_than_answer_past_it
  Scenario: A row marked unknown that names a verifier is refused by reader and writer
    Given a migrated reference file whose row is marked unknown though it carried a verifier
    Then reading the source ledger throws a bib attestation error
    And writing the ledger throws too, leaving the file as it was

  @test:scripts/tests/migrate-bib-attestations.test.ts::after_migration:_writers_write_the_store,_and_refuse_what_they_cannot_read::a_corrupt_file_is_never_overwritten
  Scenario: A corrupt store file is never overwritten
    Given a migrated review file replaced by text that is not JSON
    Then reading and writing the reviews each throw, and the file is unchanged

  @test:scripts/tests/migrate-bib-attestations.test.ts::after_migration:_writers_write_the_store,_and_refuse_what_they_cannot_read::a_review_ledger_whose_statusEnum_disagrees_with_the_schema_is_refused,_not_moved
  Scenario: A review ledger whose statusEnum disagrees with the schema is refused
    Given a review ledger with a statusEnum unlike the schema's
    When the review family is applied
    Then it is "refused" and no store directory is created

  @test:scripts/tests/migrate-bib-attestations.test.ts::the_real_folio's_ledgers_round-trip_(FOLIO_BIB_ROUNDTRIP_REPO)::every_row_and_review,_byte_for_byte,_in_a_temporary_copy
  Scenario: The real folio's ledgers round-trip in a temporary copy
    Given FOLIO_BIB_ROUNDTRIP_REPO names a folio checkout
    When its declaration and ledgers are copied and both families applied
    Then both are "migrated"

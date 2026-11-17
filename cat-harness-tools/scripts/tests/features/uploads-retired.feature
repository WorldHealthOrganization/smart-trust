# check:uploads-retired: an ingested upload retires to the fsh-guts archive
# (bean q7ey). Fixtures are layers that declare library/, uploads/ and
# fsh-guts/. Each Scenario names the test that executes it.
Feature: Retired uploads

  @test:scripts/tests/uploads-retired.test.ts::what_counts_as_a_finding::ingested_and_not_archived_→_a_finding_whose_remedy_is_a_MOVE
  Scenario: Ingested and not archived is a retirement finding
    Given "uploads/a.pdf" whose hash a library entry "entry-a" records
    Then there is one finding for "uploads/a.pdf", state "retired", entry "library/entry-a", and no archived copy

  @test:scripts/tests/uploads-retired.test.ts::what_counts_as_a_finding::ingested_AND_already_archived_→_a_finding_whose_remedy_is_a_REMOVAL
  Scenario: Ingested and archived is a duplication finding
    Given "uploads/a.pdf" is ingested and the same bytes are in the archive
    Then there is one finding, state "duplicated", archived at "fsh-guts/uploads/a.pdf"

  @test:scripts/tests/uploads-retired.test.ts::what_counts_as_a_finding::queued_but_never_ingested_is_NOT_a_finding
  Scenario: A queued, uningested file is not a finding
    Given "uploads/unread.pdf" whose hash no entry records
    Then there are no findings and its state is "queued"

  @test:scripts/tests/uploads-retired.test.ts::the_four_ways_the_2026-09-30_sweep_was_wrong::a_RENAMED_archive_copy_still_counts_as_archived_—_hash,_not_filename
  Scenario: A renamed archive copy is matched by hash
    Given "uploads/2509.06388v1.pdf" is ingested and archived under another name
    Then there is one finding, state "duplicated", archived under the "wang-rangaiah" name

  @test:scripts/tests/uploads-retired.test.ts::the_four_ways_the_2026-09-30_sweep_was_wrong::a_queue_that_nests_one_directory_per_source_is_READ,_not_reported_empty
  Scenario: A nested queue is read
    Given "uploads/src-a/paper.pdf" (ingested) and "uploads/src-a/intake.json"
    Then the queue holds both files
    And the one finding is "paper.pdf"

  @test:scripts/tests/uploads-retired.test.ts::the_four_ways_the_2026-09-30_sweep_was_wrong::a_file_beside_an_intake.json_is_the_ADVISORY_shape,_not_the_blocking_one
  Scenario: A file beside intake.json is structured intake
    Given an ingested "src-a/paper.pdf" beside "src-a/intake.json"
    Then its finding's shape is "structured-intake"

  @test:scripts/tests/uploads-retired.test.ts::the_four_ways_the_2026-09-30_sweep_was_wrong::a_bare_drop_is_the_BLOCKING_shape
  Scenario: A bare drop is flat
    Given an ingested "uploads/a.pdf"
    Then its finding's shape is "flat"

  @test:scripts/tests/uploads-retired.test.ts::the_four_ways_the_2026-09-30_sweep_was_wrong::README.md_is_not_a_queue_item
  Scenario: README.md is not queued
    Given the queue holds only "README.md"
    Then the queue is empty

  @test:scripts/tests/uploads-retired.test.ts::the_denominator,_because_a_clean_zero_is_the_failure_mode::an_instance_whose_library_records_no_source_hash_yields_an_EMPTY_ingested_set
  Scenario: No recorded hashes is an empty ingested set
    Given a queued file and no library entries
    Then the ingested set is empty and there are no findings

  @test:scripts/tests/uploads-retired.test.ts::the_denominator,_because_a_clean_zero_is_the_failure_mode::the_ingested_set_is_read_from_the_DECLARATION,_across_every_declared_library
  Scenario: The ingested set is read from the declared library
    Given entries "entry-a" and "entry-b" recording two hashes
    Then the ingested set maps each hash to its entry

  @test:scripts/tests/uploads-retired.test.ts::the_denominator,_because_a_clean_zero_is_the_failure_mode::a_companion_follows_its_source::companionSource_reads_the_relation_off_the_name,_and_only_that_shape
  Scenario: A companion's source is read off its name
    Then "a.pdf.extraction.json" and "a.pdf.extraction.md" are companions of "a.pdf"
    And "a.pdf" and "extraction.json" are companions of nothing

  @test:scripts/tests/uploads-retired.test.ts::the_denominator,_because_a_clean_zero_is_the_failure_mode::a_companion_follows_its_source::beside_a_source_still_in_the_queue_it_is_queued_too_—_the_live_who-iris_case
  Scenario: A companion beside its queued source is queued
    Given "uploads/a.pdf" and its extraction companion are queued and "a.pdf" is archived
    Then there are no findings

  @test:scripts/tests/uploads-retired.test.ts::the_denominator,_because_a_clean_zero_is_the_failure_mode::a_companion_follows_its_source::left_behind_by_a_source_that_DID_retire,_it_is_a_finding
  Scenario: A companion left behind is an orphan
    Given only the extraction companion is queued and "a.pdf" is archived
    Then there is one finding, state "orphaned-companion", archived "a.pdf"

  @test:scripts/tests/uploads-retired.test.ts::the_denominator,_because_a_clean_zero_is_the_failure_mode::a_companion_follows_its_source::source_absent_from_BOTH_queue_and_archive_is_not_guessed_about
  Scenario: A companion whose source is nowhere is not a finding
    Given only the extraction companion is queued and nothing is archived
    Then there are no findings

  @test:scripts/tests/uploads-retired.test.ts::the_denominator,_because_a_clean_zero_is_the_failure_mode::a_companion_follows_its_source::a_companion_in_another_directory_is_not_matched_to_a_same-named_source
  Scenario: A companion is matched within its own directory
    Given "uploads/one/a.pdf" and "uploads/two/a.pdf.extraction.json" are queued and "a.pdf" is archived
    Then the one finding is "uploads/two/a.pdf.extraction.json"

  @test:scripts/tests/uploads-retired.test.ts::the_denominator,_because_a_clean_zero_is_the_failure_mode::resolved-and-empty_is_not_the_same_answer_as_nothing-resolved::a_declared_queue_holding_no_files_RESOLVES_—_determined_empty,_and_a_pass
  Scenario: A declared empty queue resolves
    Given a layer declaring an empty uploads queue
    Then at least one queue resolves and the queue state is empty

  @test:scripts/tests/uploads-retired.test.ts::the_denominator,_because_a_clean_zero_is_the_failure_mode::resolved-and-empty_is_not_the_same_answer_as_nothing-resolved::the_two_states_are_distinguishable_at_all_—_the_premise_the_fix_rests_on
  Scenario: Declared-empty and undeclared are distinguishable
    Then a declared empty queue has empty state but resolves
    And an undeclared directory resolves no queue

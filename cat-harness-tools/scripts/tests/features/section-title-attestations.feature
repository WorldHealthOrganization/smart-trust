# Section-title-audit's verdicts live in the attestations store; its sidecar
# is a derived working copy. Each Scenario names the test that executes it.
Feature: Section-title verdicts in the attestations store

  @test:scripts/tests/section-title-attestations.test.ts::the_store_and_the_legacy_sidecar::a_legacy_sidecar's_DECIDED_slots_move;_pending_ones_carry_no_judgement_and_do_not
  Scenario: Only decided legacy slots move
    Given a legacy sidecar chapter with one passed slot and one pending slot
    When its verdicts are read
    Then only the passed slot "sec:scene" moves

  @test:scripts/tests/section-title-attestations.test.ts::the_store_and_the_legacy_sidecar::a_pre-thorough_slot_with_no_stale_mode_moves_as_`manifest`,_the_mode_the_writer_always_read_it_in
  Scenario: A legacy slot with no stale mode moves as manifest
    Given a decided legacy slot with no stale_mode
    When its verdicts are read
    Then the moved slot's stale_mode is "manifest"

  @test:scripts/tests/section-title-attestations.test.ts::the_store_and_the_legacy_sidecar::with_no_store,_loadVerdicts_reads_the_legacy_sidecar_and_says_how_many_it_moves
  Scenario: With no store the legacy sidecar is read
    Given a folio with a legacy sidecar holding one decided slot and no store
    When the verdicts are loaded
    Then the state is "ok" and 1 verdict is moved

  @test:scripts/tests/section-title-attestations.test.ts::the_store_and_the_legacy_sidecar::saved_verdicts_are_a_valid_section-title_attestations_file,_and_read_back_with_nothing_to_move
  Scenario: Saved verdicts are a valid store and read back
    When one verdict is saved for the folio
    Then it is written at the verdict store path
    And the file validates as section-title attestations
    And loading reads it back as "pass" with nothing moved

  @test:scripts/tests/section-title-attestations.test.ts::the_store_and_the_legacy_sidecar::FALSIFICATION:_a_corrupt_store_refuses_—_nothing_is_written_over_a_store_that_cannot_be_read
  Scenario: A corrupt store is refused
    # Gap: asserts only that loading reports "refused"; it does not check that nothing is written over the store.
    Given a verdict store that is not valid JSON
    When the verdicts are loaded
    Then the state is "refused"

  @test:scripts/tests/section-title-attestations.test.ts::a_slot_counts_a_verdict_only_against_the_hash_it_reviewed::same_hash_in_the_verdict's_own_mode:_the_verdict
  Scenario: The same hash keeps the verdict
    Given a manifest-mode verdict reviewed at hash h1
    When the slot is computed with the current hash h1 under a thorough run
    Then the slot's result is "pass"

  @test:scripts/tests/section-title-attestations.test.ts::a_slot_counts_a_verdict_only_against_the_hash_it_reviewed::FALSIFICATION:_a_changed_hash_re-opens_the_slot,_and_shows_the_stale_verdict
  Scenario: A changed hash re-opens the slot
    When the slot is computed with the current hash h2
    Then the slot is "pending" and its stale verdict is "pass"

  @test:scripts/tests/section-title-attestations.test.ts::a_slot_counts_a_verdict_only_against_the_hash_it_reviewed::the_verdict's_mode_picks_the_hash,_not_the_run's
  Scenario: The verdict's own mode picks the hash
    Given the manifest hash is h1 and the subtree hash differs
    When the manifest-mode verdict's slot is computed under a thorough run
    Then the slot's result is "pass"

  @test:scripts/tests/section-title-attestations.test.ts::the_audit,_end_to_end_on_a_folio::--write-sidecar_writes_the_derived_copy_under_test/results/,_and_commits_nothing_on_main
  Scenario: --write-sidecar writes only the derived copy
    When the audit runs with --report-only --write-sidecar on a folio
    Then it exits 0
    And the derived copy exists and the legacy sidecar does not
    And it reports "0 decided"

  @test:scripts/tests/section-title-attestations.test.ts::the_audit,_end_to_end_on_a_folio::--verdict_writes_the_STORE,_and_the_next_run_carries_it_until_the_manifest_changes
  Scenario: A verdict is stored and carried until the manifest changes
    When a pass verdict is recorded for sec:scene
    Then it exits 0 and the store validates
    And the next audit's derived copy shows sec:scene as "pass"
    And after the chapter manifest is edited the slot is "pending" with a stale "pass" verdict

  @test:scripts/tests/section-title-attestations.test.ts::the_audit,_end_to_end_on_a_folio::`pending`_is_refused_as_a_verdict
  Scenario: pending is refused as a verdict
    When a verdict of "pending" is recorded
    Then the audit exits 2

  @test:scripts/tests/section-title-attestations.test.ts::the_audit,_end_to_end_on_a_folio::FALSIFICATION:_an_unreadable_store_is_exit_2_—_could_not_determine,_never_green
  Scenario: An unreadable store exits 2
    Given a verdict store that is not valid JSON
    When the audit runs with --report-only --write-sidecar
    Then it exits 2

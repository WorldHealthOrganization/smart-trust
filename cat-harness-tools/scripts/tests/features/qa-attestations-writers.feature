# C11, per writer: with the derived prior report absent, every attestation
# survives, read from the attestation store; an unreadable store is exit 4
# (bean 8wj1). The block writers are spawned against a throwaway content
# repository whose store holds an agent adjudication and a human verdict on
# one block. Each Scenario names the test that executes it.
Feature: Every QA writer keeps the stored attestations when there is no prior report

  @test:scripts/tests/qa-attestations-writers.test.ts::block,_script-only_writers_—_prior_ABSENT::qa-sweep_keeps_both_attestations,_leading_their_criterion
  Scenario: qa-sweep keeps both attestations, leading their criterion
    Given the fixture with no derived report
    When qa-sweep runs on the content for "voice-emoji-content"
    Then it exits 0
    And the report and the store both hold the adjudication and the human verdict, the store exactly those two
    And the adjudication is first under "voice-emoji-content"

  @test:scripts/tests/qa-attestations-writers.test.ts::block,_script-only_writers_—_prior_ABSENT::(b)_qa-sweep_with_a_CORRUPT_store_writes_nothing_and_exits_4
  Scenario: qa-sweep with a corrupt store writes nothing and exits 4
    Given the fixture whose store file holds a conflict marker
    When qa-sweep runs on the content
    Then it exits 4 and stderr says "UNKNOWN"
    And no report is written and the store file is unchanged

  @test:scripts/tests/qa-attestations-writers.test.ts::block,_script-only_writers_—_prior_ABSENT::(a)_owner_ruling_2:_NO_store,_a_prior_report_holding_judgements_—_qa-sweep_moves_them_into_a_new_store_as_it_saves
  Scenario: With no store, qa-sweep moves a prior report's judgements into a new store
    Given the fixture with its store removed and a prior report holding both judgements
    When qa-sweep runs on the content
    Then it exits 0
    And the report and the new store both hold the two judgements

  @test:scripts/tests/qa-attestations-writers.test.ts::block,_script-only_writers_—_prior_ABSENT::qa-sweep_with_a_prior_that_carries_a_judgement_the_store's_file_does_not_hold_refuses_(conflict)
  Scenario: qa-sweep refuses a prior holding a judgement the store does not
    Given the fixture and a prior report holding a judgement the store does not hold
    When qa-sweep runs on the content
    Then it exits 4 and stderr says "conflict"
    And the prior report is unchanged

  @test:scripts/tests/qa-attestations-writers.test.ts::block,_script-only_writers_—_prior_ABSENT::integration-audit,_over_a_prior_that_LOST_its_attestations,_puts_them_back
  Scenario: integration-audit puts back attestations a prior report lost
    Given the fixture and a prior report holding only a script verdict
    When integration-audit runs on the content for "voice-emoji-content" without sweeping
    Then it exits 0
    And the report and the store both hold the two judgements

  @test:scripts/tests/qa-attestations-writers.test.ts::block,_attesting_writers_—_prior_ABSENT::qa-merge-findings_records_the_new_adjudication_in_the_store_beside_the_old_ones
  Scenario: qa-merge-findings records a new adjudication beside the stored ones
    Given the fixture and a findings batch with a "warn" from another reviewer
    When qa-merge-findings runs on the batch
    Then it exits 0
    And the report holds the two judgements and the store holds those plus one more

  @test:scripts/tests/qa-attestations-writers.test.ts::block,_attesting_writers_—_prior_ABSENT::qa-agent-entry
  Scenario: qa-agent-entry keeps the stored attestations
    Given the fixture
    When qa-agent-entry records a "pass" on the block's markdown
    Then it exits 0
    And the report holds the two judgements and the store holds those plus one more

  @test:scripts/tests/qa-attestations-writers.test.ts::block,_attesting_writers_—_prior_ABSENT::qa-agent-write
  Scenario: qa-agent-write keeps the stored attestations
    Given the fixture
    When qa-agent-write records a "pass" on the block
    Then it exits 0
    And the report holds the two judgements and the store holds those plus one more

  @test:scripts/tests/qa-attestations-writers.test.ts::block,_attesting_writers_—_prior_ABSENT::an_attesting_writer_with_an_unreadable_store_exits_4_and_writes_nothing
  Scenario: An attesting writer with an unreadable store exits 4 and writes nothing
    Given the fixture whose store file is garbled
    When qa-agent-entry records a verdict
    Then it exits 4
    And no report is written and the store file is unchanged

  @test:scripts/tests/qa-attestations-writers.test.ts::translation_—_prior_ABSENT::the_store's_verdicts_are_merged_in,_on_the_criterion_the_sweep_leaves_empty
  Scenario: The store's translation verdicts fill the criterion the sweep leaves empty
    Given a store holding a round-trip verdict for a subject in "fr"
    And a fresh sweep result whose "translation-semantic-roundtrip" is empty
    When the sweep is merged with the attestations and no prior
    Then the merge succeeds with exactly the stored round-trip verdict on that criterion

  @test:scripts/tests/qa-attestations-writers.test.ts::translation_—_prior_ABSENT::an_unreadable_store_file_is_a_refusal,_never_an_empty_merge
  Scenario: An unreadable translation store file is a refusal
    Given a garbled store file for a subject in "fr"
    When the fresh sweep is merged with the attestations
    Then the merge is not ok

  @test:scripts/tests/qa-attestations-writers.test.ts::translation_—_prior_ABSENT::(a)_owner_ruling_2:_NO_store,_the_prior_carries_the_round-trip_verdicts_—_they_are_kept_and_marked_to_move
  Scenario: With no store, a prior's round-trip verdicts are kept and marked to move
    Given no store and a prior holding a round-trip verdict
    When the fresh sweep is merged with the attestations and the prior
    Then the merge succeeds, marked to adopt, with the round-trip verdict kept
    And no store is created

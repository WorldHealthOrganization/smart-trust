# The e2e fixture helper (test/support/qa-fixture.js) applies verdicts to a
# copy of a QA witness document and fails loudly when its subject is gone
# (bean folio-assistant-iumj). The document holds "a-passes" with a script
# witness, and "voice-status-leak" with an agent then a script witness. Each
# Scenario names the test that executes it.
Feature: The QA fixture helper applies verdicts and refuses a missing subject

  @test:scripts/tests/qa-fixture.test.ts::a_missing_subject_throws,_and_names_itself::an_override_for_a_criterion_the_sidecar_lacks_is_refused
  Scenario: An override for a criterion the sidecar lacks is refused
    When a verdict is applied to "not-here"
    Then it throws "`not-here` is no longer a criterion"

  @test:scripts/tests/qa-fixture.test.ts::a_missing_subject_throws,_and_names_itself::the_error_says_WHY_it_throws_rather_than_defaulting
  Scenario: The error says why it throws
    When a verdict is applied to "not-here"
    Then the error message contains "silently test whichever row sorts"

  @test:scripts/tests/qa-fixture.test.ts::applying_a_verdict::the_verdict,_severity_and_evidence_are_set
  Scenario: The verdict, severity and evidence are set
    When "voice-status-leak" is set to fail, critical, with evidence "f.md:36: x" and only script witnesses
    Then that criterion's result is "fail", severity "critical" and evidence ["f.md:36: x"]

  @test:scripts/tests/qa-fixture.test.ts::applying_a_verdict::the_adjudicating_agent_witness_is_dropped,_leaving_the_script_first
  Scenario: The adjudicating agent witness is dropped
    When "voice-status-leak" is set to fail with only script witnesses
    Then its witnesses' kinds are exactly ["script"]

  @test:scripts/tests/qa-fixture.test.ts::applying_a_verdict::counts_are_RECOMPUTED_from_the_rows,_not_adjusted_by_a_delta
  Scenario: Counts are recomputed from the rows
    When "voice-status-leak" is set to fail
    Then the counts are fail 1, warn 0, pass 1, na 0, unknown 0

  @test:scripts/tests/qa-fixture.test.ts::applying_a_verdict::`state`_follows_the_worst_row,_and_is_left_absent_if_the_doc_had_none
  Scenario: state follows the worst row and is not invented
    Given the document with state "pass"
    When "a-passes" is set to fail
    Then the state is "fail"
    And applying a verdict to the document without state leaves state absent

  @test:scripts/tests/qa-fixture.test.ts::applying_a_verdict::other_criteria_are_untouched
  Scenario: Other criteria are untouched
    When "voice-status-leak" is set to fail
    Then "a-passes" still passes

  @test:scripts/tests/qa-fixture.test.ts::applying_a_verdict::the_corpus_file_itself_is_not_modified
  Scenario: The corpus file itself is not modified
    When "a-passes" is set to fail
    Then the file still parses to the original document

  @test:scripts/tests/qa-fixture.test.ts::marking_a_witness_stale_—_by_id,_never_by_index::the_named_criterion's_first_witness_carries_freshness_and_changed
  Scenario: Marking stale sets the named criterion's first witness
    When "a-passes" is marked stale with changed ["md"]
    Then its first witness has freshness "stale" and changed ["md"]

  @test:scripts/tests/qa-fixture.test.ts::marking_a_witness_stale_—_by_id,_never_by_index::a_DIFFERENT_criterion_is_left_fresh_—_marking_is_not_global
  Scenario: Marking stale leaves a different criterion fresh
    When "a-passes" is marked stale
    Then no witness of "voice-status-leak" has a freshness

  @test:scripts/tests/qa-fixture.test.ts::marking_a_witness_stale_—_by_id,_never_by_index::a_criterion_with_no_witness_throws_rather_than_marking_nothing
  Scenario: Marking stale a criterion with no witness throws
    Given a document whose criterion "bare" has no witnesses
    When "bare" is marked stale
    Then it throws "no witness to mark stale"

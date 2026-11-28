# A qa-sweep re-run replaces a criterion's script entry rather than appending
# one; agent and human entries are kept, and an adjudication leads its
# criterion. A sweep write is modelled as [...preserveNonScriptEntries(prior),
# fresh]. Each Scenario names the test that executes it.
Feature: A sweep replaces the script verdict and an adjudication leads

  @test:scripts/tests/qa-sweep-merge.test.ts::preserveNonScriptEntries::drops_every_script_entry,_keeps_agent_+_human
  Scenario: Script entries are dropped and agent and human entries kept
    Given entries script, agent, script, human
    When the non-script entries are preserved
    Then the kinds are agent, human

  @test:scripts/tests/qa-sweep-merge.test.ts::preserveNonScriptEntries::empty_array_stays_empty
  Scenario: An empty array stays empty
    Then preserving the non-script entries of [] gives []

  @test:scripts/tests/qa-sweep-merge.test.ts::preserveNonScriptEntries::does_not_mutate_its_input
  Scenario: Preserving does not mutate its input
    # Gap: the body checks only that the input's length is unchanged, not its contents.
    Given entries script, agent
    When the non-script entries are preserved
    Then the input still has two entries

  @test:scripts/tests/qa-sweep-merge.test.ts::preserveNonScriptEntries::does_not_throw_on_malformed_/_legacy_sidecar_entries;_preserves_them
  Scenario: Malformed entries are preserved, not thrown on
    Given null, undefined, an entry with no reviewer, one whose reviewer has no kind, a script entry and a human entry
    When the non-script entries are preserved
    Then all but the script entry are kept, including the human entry

  @test:scripts/tests/qa-sweep-merge.test.ts::qa-sweep_script-entry_REPLACE_(task_§5)::§5.1_—_array_length_is_stable_across_two_consecutive_sweeps
  Scenario: Two consecutive sweeps do not grow the array
    When a sweep writes a script entry to an empty criterion and a second sweep writes again
    Then both arrays have one entry, one of them script

  @test:scripts/tests/qa-sweep-merge.test.ts::qa-sweep_script-entry_REPLACE_(task_§5)::§5.2_—_a_pre-existing_human_entry_is_retained_after_a_sweep
  Scenario: A human entry survives a sweep
    Given a human entry and a script entry
    When a sweep writes a fresh script entry
    Then there is one human and one script entry

  @test:scripts/tests/qa-sweep-merge.test.ts::qa-sweep_script-entry_REPLACE_(task_§5)::§5.3_—_a_pre-existing_agent_entry_is_retained_(agents_still_append)
  Scenario: An agent entry survives a sweep
    Given an agent entry
    When a sweep writes a fresh script entry
    Then the kinds are agent, script

  @test:scripts/tests/qa-sweep-merge.test.ts::qa-sweep_script-entry_REPLACE_(task_§5)::§5.4_—_[script_stale,_agent]_→_[agent,_script_fresh]
  Scenario: A stale script before an agent becomes agent then fresh script
    Given a stale script entry and an agent entry
    When a sweep writes a fresh script entry
    Then the kinds are agent, script, and the one script entry is the fresh one

  @test:scripts/tests/qa-sweep-merge.test.ts::qa-sweep_script-entry_REPLACE_(task_§5)::multiple_agent_entries_all_survive_a_script_sweep
  Scenario: Multiple agent entries survive repeated sweeps
    Given two agent entries and a script entry
    When a sweep writes a fresh script entry
    Then there are two agent entries and one script entry
    And a second sweep does not change the length

  @test:scripts/tests/qa-sweep-merge.test.ts::insertAdjudication_—_an_adjudication_leads_its_criterion::[script]_+_agent_→_[agent,_script]
  Scenario: An adjudication goes before the script entry
    Given a failing script entry
    When a passing agent adjudication is inserted
    Then the kinds are agent, script and the first result is "pass"

  @test:scripts/tests/qa-sweep-merge.test.ts::insertAdjudication_—_an_adjudication_leads_its_criterion::the_script_entry_is_KEPT_—_a_disagreement_stays_legible
  Scenario: The script entry is kept behind an adjudication
    Given a failing script entry
    When a passing agent adjudication is inserted
    Then there are two entries and the second is "fail"

  @test:scripts/tests/qa-sweep-merge.test.ts::insertAdjudication_—_an_adjudication_leads_its_criterion::with_no_script_entry_it_appends,_preserving_reviewer_history_order
  Scenario: Without a script entry an adjudication appends
    Given an agent entry by "watcher-a"
    When an agent entry by "watcher-b" is inserted
    Then the first entry precedes the second

  @test:scripts/tests/qa-sweep-merge.test.ts::insertAdjudication_—_an_adjudication_leads_its_criterion::an_existing_agent_entry_still_precedes_the_new_one,_both_before_script
  Scenario: An existing agent entry precedes a new one, both before script
    Given an agent entry and a failing script entry
    When a human entry is inserted
    Then the kinds are agent, human, script

  @test:scripts/tests/qa-sweep-merge.test.ts::insertAdjudication_—_an_adjudication_leads_its_criterion::a_sweep_after_a_merge_is_order-stable_—_the_two_writers_agree
  Scenario: A sweep after a merge keeps the adjudication leading
    Given a passing agent adjudication inserted before a failing script entry
    When a sweep writes a fresh failing script entry
    Then the kinds are agent, script and the first result is "pass"

  @test:scripts/tests/qa-sweep-merge.test.ts::insertAdjudication_—_a_reviewer_supersedes_their_own_earlier_entry::a_re-adjudication_replaces_the_reviewer's_own_earlier_one
  Scenario: A re-adjudication replaces the reviewer's own earlier entry
    Given an entry by "voice-editorial-review" and a failing script entry
    When a new entry by the same reviewer is inserted
    Then the kinds are agent, script and the agent entry is the new one

  @test:scripts/tests/qa-sweep-merge.test.ts::insertAdjudication_—_a_reviewer_supersedes_their_own_earlier_entry::a_DIFFERENT_reviewer's_entry_is_history_and_is_kept
  Scenario: A different reviewer's entry is kept as history
    Given an entry by "one-voice-integration-watcher" and a failing script entry
    When an entry by "voice-editorial-review" is inserted
    Then there are three entries ordered by the earlier reviewer, the new reviewer, then the script

  @test:scripts/tests/qa-sweep-merge.test.ts::insertAdjudication_—_a_reviewer_supersedes_their_own_earlier_entry::a_human_entry_is_never_displaced_by_an_agent_one
  Scenario: A human entry is never displaced by an agent entry
    Given a human entry and a script entry
    When an agent entry is inserted
    Then a human entry remains and there are three entries

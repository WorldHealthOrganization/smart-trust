# The untainted-dispatch mechanism, falsified in both directions.
# Each Scenario names the test that executes it.
Feature: Untainted verification

  Background:
    Given a sound declaration: the checker sees "lean" with "md" and "ts" withheld, the adjudicator sees "md", and a drift statement

  @test:scripts/tests/untainted-verification.test.ts::untaintedPartitionDefects::a_sound_declaration_has_no_defects
  Scenario: A sound declaration has no defects
    Then over the universe md, ts, lean it has no defects

  @test:scripts/tests/untainted-verification.test.ts::untaintedPartitionDefects::undeclared_is_reported,_not_skipped_—_nobody-said_is_not_nothing-to-check
  Scenario: An undeclared partition is a defect
    Then a criterion with no untainted declaration has one defect saying "undeclared"

  @test:scripts/tests/untainted-verification.test.ts::untaintedPartitionDefects::overlap:_a_role_visible_to_BOTH_parties_is_the_vacuous_pass
  Scenario: A role visible to both parties is a defect
    When the adjudicator also sees "lean"
    Then a defect says "grading its own input"

  @test:scripts/tests/untainted-verification.test.ts::untaintedPartitionDefects::unpartitioned:_a_companion_added_to_depends_on_later_lands_in_neither_set
  Scenario: A new companion in neither set is a defect
    When the universe gains "bpmn"
    Then a defect says "unpartitioned" and names "bpmn"

  @test:scripts/tests/untainted-verification.test.ts::untaintedPartitionDefects::phantom:_the_declaration_describes_a_criterion_other_than_this_one
  Scenario: A role outside the universe is a phantom
    When the checker sees "cql" over the universe md, ts
    Then a defect says "phantom" and names "cql"

  @test:scripts/tests/untainted-verification.test.ts::untaintedPartitionDefects::an_empty_drift_statement_is_a_defect_—_it_yields_a_style_review
  Scenario: An empty drift statement is a defect
    When the drift statement is blank
    Then a defect mentions "drift"

  @test:scripts/tests/untainted-verification.test.ts::the_translation_round_trip_as_an_INSTANCE_—_the_genericity,_demonstrated::the_founding_case_declares_cleanly_against_the_generic_type
  Scenario: The translation round trip declares cleanly
    Then the round-trip dispatch over the translation artefacts has no defects

  @test:scripts/tests/untainted-verification.test.ts::the_translation_round_trip_as_an_INSTANCE_—_the_genericity,_demonstrated::its_central_artefact_is_NOT_a_CompanionRole_—_which_is_why_`universe`_is_a_parameter
  Scenario: The round trip's artefact is not a companion role
    Then "po" is not a companion role
    And the round-trip checker sees exactly "po"

  @test:scripts/tests/untainted-verification.test.ts::the_translation_round_trip_as_an_INSTANCE_—_the_genericity,_demonstrated::the_two_visible_sets_are_disjoint_—_the_whole_rule_in_one_line
  Scenario: The round trip's visible sets are disjoint
    Then no role the round-trip checker sees is seen by its adjudicator

  @test:scripts/tests/untainted-verification.test.ts::the_translation_round_trip_as_an_INSTANCE_—_the_genericity,_demonstrated::showing_the_back-translator_the_source_is_caught,_not_merely_discouraged
  Scenario: Showing the back-translator the source is caught
    When the round-trip checker also sees "md"
    Then a defect says "grading its own input"

  @test:scripts/tests/untainted-verification.test.ts::untaintedEntries::the_adjudicator_leads_—_the_first_entry_is_the_operative_one
  Scenario: The adjudicator's entry comes first
    Given an untainted fail verdict by an adjudicator with a checker that used no tools
    Then the first entry is the adjudicator's, with result "fail"

  @test:scripts/tests/untainted-verification.test.ts::untaintedEntries::the_checker_ruled_on_nothing_and_must_not_read_as_a_verdict
  Scenario: The checker's entry is n/a
    Then the second entry is the checker's, with result "n/a" and notes holding its intermediate rendering

  @test:scripts/tests/untainted-verification.test.ts::untaintedEntries::tools_used_is_recorded_rather_than_assumed
  Scenario: The checker's tools used are recorded
    Then the checker's entry records tools_used "none"

  @test:scripts/tests/untainted-verification.test.ts::untaintedEntries::a_checker's_n/a_is_NOT_a_could-not-dispatch_record
  Scenario: A checker's n/a is not could-not-dispatch
    Then the checker's entry is not a could-not-dispatch record

  @test:scripts/tests/untainted-verification.test.ts::could_not_dispatch_—_the_third_state::it_is_structurally_distinguishable_from_every_other_n/a
  Scenario: A could-not-dispatch entry is recognisable
    When a could-not-dispatch entry is made with reason "no subagent capability in this environment"
    Then its result is "n/a", it is recognised as could-not-dispatch, and its notes carry the reason

  @test:scripts/tests/untainted-verification.test.ts::could_not_dispatch_—_the_third_state::a_reasonless_record_is_refused_—_it_cannot_be_told_from_declining_to_try
  Scenario: A could-not-dispatch entry needs a reason
    Then making one with a blank reason throws "needs a reason"

  @test:scripts/tests/untainted-verification.test.ts::could_not_dispatch_—_the_third_state::it_is_NEVER_a_pass
  Scenario: Could-not-dispatch is not verified
    Then a list holding only a could-not-dispatch entry is not verified

  @test:scripts/tests/untainted-verification.test.ts::could_not_dispatch_—_the_third_state::not_attempted_is_not_a_pass_either
  Scenario: No entries are not verified
    Then no list and an empty list are not verified

  @test:scripts/tests/untainted-verification.test.ts::could_not_dispatch_—_the_third_state::a_real_verdict_IS_verified
  Scenario: A real pass verdict is verified
    Then the entries of an untainted pass verdict are verified

  @test:scripts/tests/untainted-verification.test.ts::mergeUntainted::a_sweep_replaces_only_entries_whose_reviewer_is_itself
  Scenario: A sweep keeps the human ruling
    Given existing entries from an earlier agent pair and from a human
    When fresh adjudicator and checker entries are merged in
    Then the entries are the adjudicator's, the checker's and the human's, and the earlier agent's is gone

  @test:scripts/tests/untainted-verification.test.ts::recordUntainted_—_the_attestation_store_is_the_home::with_the_derived_report_ABSENT,_the_verdict_lands_in_the_store_and_no_report_is_invented
  Scenario: With no derived report the verdict goes to the store
    Given a layer holding "content/b.md" and no derived QA report
    When the untainted verdict is recorded
    Then it returns the store's relative path, the store reads back the adjudicator and checker entries
    And no derived report is created

  @test:scripts/tests/untainted-verification.test.ts::recordUntainted_—_the_attestation_store_is_the_home::with_the_derived_report_present,_the_store_is_written_and_the_projection_keeps_script_entries
  Scenario: With a derived report the projection keeps script entries
    Given the derived report holds a script "sweep" entry for criterion "c"
    When the untainted verdict is recorded
    Then the store reads back as a hit
    And the derived report's entries are adjudicator, checker and sweep

  @test:scripts/tests/untainted-verification.test.ts::recordUntainted_—_the_attestation_store_is_the_home::a_corrupt_store_is_UNKNOWN:_refused,_and_neither_file_is_written
  Scenario: A corrupt store is refused
    Given the store file holds "{ not json"
    Then recording throws "UNKNOWN ... corrupt"
    And the store file is unchanged and no derived report exists

  @test:scripts/tests/untainted-verification.test.ts::recordUntainted_—_the_attestation_store_is_the_home::a_subject_that_does_not_exist_is_refused
  Scenario: A missing subject is refused
    Given "content/b.md" is removed
    Then recording throws "does not exist"
    And no attestations directory is created

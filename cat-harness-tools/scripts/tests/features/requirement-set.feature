# The RequirementSet amendment (issue #2405, FR-010 to FR-013, SC-006 to
# SC-008): the bootstrap RequirementSet and its published JSON Schema, the
# requirement-signoff attestation family, and check:requirements. A "human
# sign-off" is litlfred's approval of reqset:x on 2026-10-07 with an
# issue-comment permalink. Each Scenario names the test that executes it.
Feature: Requirement sets and their sign-offs

  @test:scripts/tests/requirement-set.test.ts::SC-007:_the_measles_requirements_set,_as_a_RequirementSet::passes_the_Zod_and_the_published_JSON_Schema
  Scenario: The measles requirements set passes the Zod schema and the published JSON Schema
    Given the measles L1 requirement set fixture
    Then it parses against the RequirementSet Zod schema
    And it validates against bootstrap's published requirement-set JSON Schema

  @test:scripts/tests/requirement-set.test.ts::SC-007:_the_measles_requirements_set,_as_a_RequirementSet::signOffs[0]_is_the_owner's_human_approval_of_2026-10-07,_with_the_issue-comment_permalink
  Scenario: The measles set's first sign-off is the owner's human approval
    Given the measles L1 requirement set fixture
    Then its first sign-off is a human "litlfred" approving to "approved" on 2026-10-07
    And its evidence is the issue-comment permalink on litlfred/test issue 1

  @test:scripts/tests/requirement-set.test.ts::SC-007:_the_measles_requirements_set,_as_a_RequirementSet::check:requirements_finds_nothing_wrong_with_it
  Scenario: check:requirements finds nothing wrong with the measles set
    Given the measles L1 requirement set fixture and every member in force
    When check:requirements checks it
    Then there are no problems

  @test:scripts/tests/requirement-set.test.ts::SC-006:_check:requirements_refuses_a_stage_its_record_does_not_justify_(planted_failures)::`approved`_with_no_human_sign-off_—_none_at_all,_or_only_an_agent's
  Scenario: An approved set needs a human sign-off
    Given a set at stage "approved"
    Then with no sign-off check:requirements asks for a "HUMAN sign-off"
    And with only an agent's sign-off check:requirements reports a problem and the JSON Schema rejects it
    And with the human sign-off check:requirements reports nothing

  @test:scripts/tests/requirement-set.test.ts::SC-006:_check:requirements_refuses_a_stage_its_record_does_not_justify_(planted_failures)::`planned`_with_no_beans
  Scenario: A planned set needs a work plan
    Given a set at stage "planned" with a human sign-off and no work plan
    Then check:requirements names the "work plan" and the JSON Schema rejects it
    And with a work plan of one bean check:requirements reports nothing

  @test:scripts/tests/requirement-set.test.ts::SC-006:_check:requirements_refuses_a_stage_its_record_does_not_justify_(planted_failures)::`cancelled`_with_no_reason
  Scenario: A cancelled set needs a reason
    Given a set at stage "cancelled" with a cancel sign-off giving no reason
    Then check:requirements reports a problem and the JSON Schema rejects it
    And with the reason "superseded by the L2 plan" check:requirements reports nothing

  @test:scripts/tests/requirement-set.test.ts::SC-006:_check:requirements_refuses_a_stage_its_record_does_not_justify_(planted_failures)::past_`approved`_presupposes_an_approval
  Scenario: A stage past approved presupposes an approval
    Given a set at stage "delivered" with a work plan and no sign-off
    When check:requirements checks it
    Then it says the set was "never approved"

  @test:scripts/tests/requirement-set.test.ts::SC-006:_check:requirements_refuses_a_stage_its_record_does_not_justify_(planted_failures)::a_sign-off_scoped_to_something_that_is_neither_the_set_nor_a_member
  Scenario: A sign-off scoped to neither the set nor a member is refused
    # Gap: only that some problem is reported is asserted, not that it is about the sign-off's scope
    Given a draft set with a sign-off scoped to "req:other"
    When check:requirements checks it
    Then it reports a problem

  @test:scripts/tests/requirement-set.test.ts::a_set's_stage_and_its_members'_statuses_stay_independent_—_with_ONE_link::accepted_needs_every_APPROVED_member_in_force
  Scenario: An accepted set needs every approved member in force
    Given a set at stage "accepted" with a work plan and approved and accepted human sign-offs
    Then with its approved member "proposed" check:requirements says it is "not `in-force`"
    And with it in force check:requirements reports nothing

  @test:scripts/tests/requirement-set.test.ts::a_set's_stage_and_its_members'_statuses_stay_independent_—_with_ONE_link::a_deferred_member_does_not_hold_acceptance_back
  Scenario: A deferred member does not hold acceptance back
    Given the accepted set with an approved member in force and a deferred member still proposed
    When check:requirements checks it
    Then it reports nothing

  @test:scripts/tests/requirement-set.test.ts::a_set's_stage_and_its_members'_statuses_stay_independent_—_with_ONE_link::an_in-force_member_does_not_move_its_set
  Scenario: An in-force member does not make a proposed set wrong
    Given a set at stage "proposed" whose member is in force
    When check:requirements checks it
    Then it reports nothing

  @test:scripts/tests/requirement-set.test.ts::FR-011:_a_sign-off_is_an_adjudication_record,_kept_in_the_attestations_graph::its_signer_kinds_ARE_the_QA_reviewer_kinds_—_one_vocabulary,_not_two
  Scenario: The signer kinds are the QA reviewer kinds
    Then the sign-off signer kinds and the QA reviewer kinds are the same set

  @test:scripts/tests/requirement-set.test.ts::FR-011:_a_sign-off_is_an_adjudication_record,_kept_in_the_attestations_graph::the_`requirement-signoff`_family_round-trips,_and_a_stored_sign-off_justifies_the_stage
  Scenario: A stored requirement-signoff record round-trips and justifies the stage
    Given a scratch attestations home
    Then the sign-off path for reqset:x ends "requirement-signoff/x.attestations.json"
    And a requirement-signoff file holding the human sign-off parses as qa-attestations, and one with no sign-offs does not
    When the file is written and its sign-offs read back
    Then an approved set with no inline sign-off is justified by the stored one

  @test:scripts/tests/requirement-set.test.ts::FR-011:_a_sign-off_is_an_adjudication_record,_kept_in_the_attestations_graph::the_inline_and_stored_records_are_one_union,_de-duplicated
  Scenario: Inline and stored sign-offs are one de-duplicated union
    When the same human sign-off is given inline and stored
    Then their union holds it once

  @test:scripts/tests/requirement-set.test.ts::SC-008:_a_sign-off_step_cannot_proceed_on_a_decision_nobody_recorded::the_facts_are_read_off_the_record
  Scenario: The sign-off facts are read off the record
    Then with no sign-off the facts are recorded "no" and outcome "none"
    And with an approval then a later amendment they are recorded "yes" and outcome "amend"

  @test:scripts/tests/requirement-set.test.ts::SC-008:_a_sign-off_step_cannot_proceed_on_a_decision_nobody_recorded::%s:_%s_calls_the_adjudication_with_the_requirement-set_codes,_and_only_a_recorded_sign-off_leaves
  Scenario Outline: The sign-off step calls the requirement-set adjudication and is gated on a recorded sign-off
    # Gap: that every path out of the step passes the gate is not checked; only that the gate exists and one flow runs from it to A_RecordSignoff
    Given the process <file>
    Then its step <step> adjudicates with approve, amend, reject, defer and cancel from "adjudication-requirement-set"
    And its gateway GW_SignoffRecorded decides by "requirement-signoff-recorded.dmn"
    And the node A_RecordSignoff exists with a flow to it from GW_SignoffRecorded

    Examples:
      | file              | step       |
      | crdm-signoff.bpmn | BA_Signoff |
      | crdm-close.bpmn   | BA_Confirm |

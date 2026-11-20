# The engine writes a prov:Activity as it records a step (bean n2l9, issues
# #1180, #1207), its decision records cite agreement, grant and consent, and
# they form a hash-chained log. Each Scenario names the test that executes it.
Feature: PROV records written by the workflow engine

  @test:scripts/tests/prov-record.test.ts::complete()_writes_the_activity_as_it_records_the_step::an_allowed_step_under_a_GitHub_principal_carries_a_valid_prov:Activity
  Scenario: An allowed step under a GitHub principal carries a valid prov:Activity
    Given the first roled step of crdm-requirements
    When it is completed under a GitHub principal in strict mode on block-1
    Then the history entry carries a valid activity naming collaborator, the lane's role and the step as plan
    And it used block-1 and names every policy in force

  @test:scripts/tests/prov-record.test.ts::complete()_writes_the_activity_as_it_records_the_step::no_authorization_context,_no_activity:_nothing_is_recorded_that_was_not_decided
  Scenario: No authorisation context records no activity
    When the step is completed with no authorisation
    Then the history entry carries no activity

  @test:scripts/tests/prov-record.test.ts::a_Tool_activity_on_a_step_is_informed_by_the_step's_own_activity_(bean_w1gy,_folio-assistant#875_FR-005)::the_Tool_activity_names_the_step's_prov:Activity_in_prov:wasInformedBy,_and_still_parses
  Scenario: A Tool activity on a step is informed by the step's own activity
    When the step is completed with authorisation and a Tool activity
    Then the step's activity has an id and the Tool activity names it in prov:wasInformedBy, still valid

  @test:scripts/tests/prov-record.test.ts::a_Tool_activity_on_a_step_is_informed_by_the_step's_own_activity_(bean_w1gy,_folio-assistant#875_FR-005)::no_step_activity:_the_Tool_activity_is_recorded_with_no_link
  Scenario: With no step activity the Tool activity is recorded with no link
    When the step is completed with a Tool activity and no authorisation
    Then there is no step activity and the Tool activity has no wasInformedBy

  @test:scripts/tests/prov-record.test.ts::a_Tool_activity_on_a_step_is_informed_by_the_step's_own_activity_(bean_w1gy,_folio-assistant#875_FR-005)::a_prov:wasInformedBy_the_Tool_supplied_is_kept_and_the_step's_added_beside_it
  Scenario: A Tool's own wasInformedBy is kept and the step's added beside it
    When the step is completed with a Tool activity already informed by upstream#7
    Then its wasInformedBy is upstream#7 and the step's activity

  @test:scripts/tests/prov-record.test.ts::provActivityFor_invents_nothing::a_refused_step,_a_step_with_no_actor,_and_a_step_with_no_lane_role_get_no_activity
  Scenario: A refused step, a step with no actor, no lane role or no policy gets no activity
    Then each of those verdicts yields no activity

  @test:scripts/tests/prov-record.test.ts::provActivityFor_invents_nothing::one_policy_is_written_as_a_string,_several_as_a_sorted_array
  Scenario: One policy is a string, several are a sorted array
    Then one policy is written as itself, and two as a sorted array

  @test:scripts/tests/prov-record.test.ts::the_after-check_reads_the_engine's_record::it_re-checks_the_recorded_principal,_not_a_login_in_`actor`,_and_emits_the_recorded_activity
  Scenario: The after-check re-checks the recorded principal and emits the recorded activity
    Given a step completed with actor "octo" typed and GitHub vouching for collaborator
    When the instance is reported
    Then there is no undeclared-actor finding and the recorded activity is among those emitted

  @test:scripts/tests/prov-record.test.ts::DSA_B4:_PROV_decision_records_cite_agreement_+_grant_and_form_a_hash-chained_log_(bean_3z44)::every_decision_record_cites_its_agreement_(prov:used_DCAT_distribution_+_spdx:checksum),_its_VC_grant,_and_its_hash
  Scenario: A decision record cites its agreement, its grant and its hash
    When a decision record is made with a target, an agreement distribution and a VC grant
    Then it is valid, used the target, the agreement and the grant, cites both, has no previous hash, and its record hash is its own
    And without the agreement it is invalid and the chain check reports missing-agreement
    And an agreement whose id is not an absolute IRI, or a checksum of the wrong length, is refused
    And without the record hash it is invalid and the chain check reports missing-hash

  @test:scripts/tests/prov-record.test.ts::DSA_B4:_PROV_decision_records_cite_agreement_+_grant_and_form_a_hash-chained_log_(bean_3z44)::editing_or_removing_any_past_record_fails_the_chain_check
  Scenario: Editing or removing any past record fails the chain check
    Given three chained decision records
    Then the chain is valid with the expected count and head hash
    And editing the first in place is a hash mismatch at 0
    And re-hashing an edited first breaks the link at 1
    And removing the first, or the middle, breaks a link
    And removing the tail fails on the expected head hash and on the expected count

  @test:scripts/tests/prov-record.test.ts::DSA_B4:_PROV_decision_records_cite_agreement_+_grant_and_form_a_hash-chained_log_(bean_3z44)::complete()_chains_PROV_decision_records_across_workflow_steps_and_reportInstance_flags_tampering
  Scenario: complete() chains decision records across steps and the report flags tampering
    When two roled steps are completed with an agreement
    Then two records are chained from a null previous hash, and the chain verifies
    And the report finds nothing invalid
    And with the first step's entry removed from the history the report flags a broken link

  @test:scripts/tests/prov-record.test.ts::PROV_decision_record_cites_Consent_id_+_versionId_(PCF8,_bean_2egb)::every_consent-based_decision_names_its_Consent_(id_+_versionId)
  Scenario: Every consent-based decision names its Consent id and versionId
    Then a consent reference with an id and a version is valid, and one with an empty version is not
    And a consent decision record carries the consent, is consent-based and is valid
    And a consent-based decision with no consent, or one under a consent policy with no consent, throws

  @test:scripts/tests/prov-record.test.ts::PROV_decision_record_cites_Consent_id_+_versionId_(PCF8,_bean_2egb)::complete()_records_Consent_id_+_versionId_on_consent-based_steps_and_reportInstance_flags_missing_Consent
  Scenario: complete() records the Consent on a consent-based step and the report flags it missing
    When a roled step is completed consent-based with a consent
    Then the recorded activity carries the consent and is consent-based, and the report finds nothing invalid
    And with the consent stripped from the record the report flags missing-consent

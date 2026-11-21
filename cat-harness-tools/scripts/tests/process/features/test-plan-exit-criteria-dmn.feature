# Per-plan exit criteria: a test plan's own DMN table decides its exit
# gateway in test-plan-execution.bpmn; an unresolvable table yields
# undetermined and never falls back to the default; and the
# test-plan-exit-criteria-resolves audit criterion.
Feature: A test plan's exit criteria are decided by its own DMN table, never silently by the default

  @test:scripts/tests/process/test-plan-exit-criteria-dmn.test.ts::per-plan_exitCriteria_DMN_resolution_and_execution_(folio-assistant-4iey)::a_fixture_plan_with_its_own_custom_DMN_table_routes_by_that_table's_rules::resolves_custom_DMN_table_dynamically
  Scenario: A plan's custom DMN table is resolved
    Given a plan whose exitCriteria names Decision_CustomCertification in a custom five-rule DMN file
    When its exit-criteria table is resolved
    Then resolution succeeds with table Decision_CustomCertification of 5 rules

  @test:scripts/tests/process/test-plan-exit-criteria-dmn.test.ts::per-plan_exitCriteria_DMN_resolution_and_execution_(folio-assistant-4iey)::a_fixture_plan_with_its_own_custom_DMN_table_routes_by_that_table's_rules::rule_difference_1:_1_failed_case_with_10_passed_cases_certifies_under_custom_table_(platform_default_refuses)
  Scenario: Under the custom table, 1 failure with 10 passes certifies
    # Gap: the title's "platform default refuses" is not checked; the default table is not evaluated
    Given the custom plan and a completed report with 1 failed and 10 passed cases, the checker agreeing
    When its exit criteria are evaluated
    Then the outcome is "certified" by Rule_Custom_LenientPass
    When an instance of test-plan-execution is advanced to GW_ExitCriteria and the gateway is completed with those facts
    Then the only enabled step is A_RecordCertification

  @test:scripts/tests/process/test-plan-exit-criteria-dmn.test.ts::per-plan_exitCriteria_DMN_resolution_and_execution_(folio-assistant-4iey)::a_fixture_plan_with_its_own_custom_DMN_table_routes_by_that_table's_rules::rule_difference_2:_0_failed_cases_with_2_passed_cases_refuses_under_custom_table_(platform_default_certifies)
  Scenario: Under the custom table, 0 failures with 2 passes is refused
    # Gap: the title's "platform default certifies" is not checked; the default table is not evaluated
    Given the custom plan and a completed report with 0 failed and 2 passed cases, the checker agreeing
    When its exit criteria are evaluated
    Then the outcome is "refused" by Rule_Custom_StrictThreshold
    When an instance is advanced to GW_ExitCriteria and the gateway is completed with those facts
    Then the only enabled step is A_RecordRefusal

  @test:scripts/tests/process/test-plan-exit-criteria-dmn.test.ts::per-plan_exitCriteria_DMN_resolution_and_execution_(folio-assistant-4iey)::an_unresolvable_DMN_yields_undetermined_(could-not-determine)_and_NEVER_falls_back_to_default::non-existent_DMN_file_yields_undetermined_(state:_unknown)_and_routes_to_A_RecordUndetermined
  Scenario: A plan naming a missing DMN file is undetermined
    Given a plan whose exitCriteria names a DMN file that does not exist, and facts the default table would certify
    When its table is resolved
    Then resolution fails with state "unknown" and an error saying "not found"
    When its exit criteria are evaluated
    Then the outcome is "undetermined", the state "unknown", and the note says "could-not-determine"
    When an instance is advanced to GW_ExitCriteria and the gateway is completed with those facts
    Then the only enabled step is A_RecordUndetermined, and the last history note says "undetermined"

  @test:scripts/tests/process/test-plan-exit-criteria-dmn.test.ts::per-plan_exitCriteria_DMN_resolution_and_execution_(folio-assistant-4iey)::an_unresolvable_DMN_yields_undetermined_(could-not-determine)_and_NEVER_falls_back_to_default::existing_DMN_file_with_invalid_decision_ID_yields_undetermined_and_routes_to_A_RecordUndetermined
  Scenario: A plan naming a missing decision in an existing DMN file is undetermined
    Given a plan whose exitCriteria names Decision_NoSuchDecisionId in test-certification.dmn
    When its table is resolved
    Then resolution fails with state "unknown" and an error saying it "has no decision"
    When its exit criteria are evaluated
    Then the outcome is "undetermined", the state "unknown", and the note says "could-not-determine"
    When an instance is advanced to GW_ExitCriteria and the gateway is completed
    Then the only enabled step is A_RecordUndetermined

  @test:scripts/tests/process/test-plan-exit-criteria-dmn.test.ts::per-plan_exitCriteria_DMN_resolution_and_execution_(folio-assistant-4iey)::an_unresolvable_DMN_yields_undetermined_(could-not-determine)_and_NEVER_falls_back_to_default::complete()_with_dynamic_decisionTable=null_routes_to_undetermined_and_refuses_fallback
  Scenario: Completing the gateway with a null decision table routes to undetermined
    Given an instance advanced to GW_ExitCriteria
    When the gateway is completed with decisionTable null, an error "DMN file missing" and certifying facts
    Then the only enabled step is A_RecordUndetermined
    And the last history note says "dynamic decision table unresolvable"

  @test:scripts/tests/process/test-plan-exit-criteria-dmn.test.ts::per-plan_exitCriteria_DMN_resolution_and_execution_(folio-assistant-4iey)::kg-audit:_test-plan-exit-criteria-resolves_criterion::criterion_is_registered_in_schemas/sdlc/kg-qa.ts_with_required_metadata
  Scenario: The audit criterion is registered with its metadata
    Given the KG criteria
    When test-plan-exit-criteria-resolves is looked up
    Then it exists with scope "instance", severity "major", and applies including "graph"

  @test:scripts/tests/process/test-plan-exit-criteria-dmn.test.ts::per-plan_exitCriteria_DMN_resolution_and_execution_(folio-assistant-4iey)::kg-audit:_test-plan-exit-criteria-resolves_criterion::vacuity-guarded:_if_0_plans_checked_->_unknown
  Scenario: Auditing no plans is unknown
    Given no plans
    When the exit-criteria audit is run
    Then the result is "unknown" with a finding saying "0 plans checked"

  @test:scripts/tests/process/test-plan-exit-criteria-dmn.test.ts::per-plan_exitCriteria_DMN_resolution_and_execution_(folio-assistant-4iey)::kg-audit:_test-plan-exit-criteria-resolves_criterion::resolvable_DMN_decision_table_->_pass
  Scenario: A plan whose DMN table resolves passes the audit
    Given the custom plan written to a plan file, with its DMN base
    When the exit-criteria audit is run on it
    Then the result is "pass" with no findings

  @test:scripts/tests/process/test-plan-exit-criteria-dmn.test.ts::per-plan_exitCriteria_DMN_resolution_and_execution_(folio-assistant-4iey)::kg-audit:_test-plan-exit-criteria-resolves_criterion::unresolvable_DMN_decision_table_->_fail_with_major_finding
  Scenario: A plan whose DMN file is missing fails the audit
    # Gap: the title says "major finding"; the finding's severity is not checked
    Given the plan naming a missing DMN file, written to a plan file
    When the exit-criteria audit is run on it
    Then the result is "fail"
    And the first finding says it "does not resolve to an existing .dmn file"

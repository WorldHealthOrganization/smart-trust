# The test process end to end (bean 3o5b, arc 3fva): test-plan-execution.bpmn
# runs a tiny fixture plan against a fixture system under test (an
# air-gapped "tool" actor), the certification DMN has three outcomes, the
# system-under-test actor facet, and the four kg-audit test-plan criteria.
# "To the gateway" means the bean is opened as the caller's and the steps
# A_Request through A_ReExecuteSample complete in order. Each Scenario names
# the test that executes it.
Feature: Executing a test plan

  @test:scripts/tests/test-plan-execution.test.ts::test-plan-execution.bpmn_runs_end_to_end_on_a_fixture_plan::every_lane_binds_its_declared_role,_and_each_step_reports_it_(workflow_next)
  Scenario: Each step reports the role its lane binds
    Given an instance whose bean is opened as a new bean
    When the steps A_Request through A_ReExecuteSample are completed in turn, with the scenarios role graph
    Then A_Request reports test-requester, the next four tester, and A_ReExecuteSample untainted-checker
    And the next enabled step reports certifier

  @test:scripts/tests/test-plan-execution.test.ts::test-plan-execution.bpmn_runs_end_to_end_on_a_fixture_plan::every_activity_names_a_skill_and_a_bean_op;_the_gateway_is_computed
  Scenario: Every activity names a skill and a bean op, and the exit gateway is a decision
    Then every activity names a skill, and every activity but the bean-open and bean-close calls names a work-plan op
    And Call_BeanOpen calls Process_BeanOpen and Call_BeanClose calls Process_BeanClose
    And GW_BeanClosedHow is entered only from Call_BeanClose, and each of the three ends only from GW_BeanClosedHow
    And GW_ExitCriteria is decided by Decision_TestCertification, and Call_Sign calls Process_QaReportSigning

  @test:scripts/tests/test-plan-execution.test.ts::test-plan-execution.bpmn_runs_end_to_end_on_a_fixture_plan::certified:_the_run's_facts_certify,_the_signing_subprocess_runs,_the_instance_completes
  Scenario: An all-pass run certifies, is signed, and completes
    Given an instance at the exit gateway, and a run and report where every case passed
    When the gateway is completed with the facts read off them and an agreeing checker
    Then A_RecordCertification is next
    And the signing subprocess runs, routing an unknown signer reach to Task_HumanSign and storing the signed report
    And A_FileCertification follows, the bean closes as done, and the instance completes through End_Certified

  @test:scripts/tests/test-plan-execution.test.ts::test-plan-execution.bpmn_runs_end_to_end_on_a_fixture_plan::refused:_a_failed_case_ends_at_the_refusal_and_signs_nothing
  Scenario: A failed case is refused and nothing is signed
    Given an instance at the exit gateway, and a report where one case failed
    When the gateway is completed with the facts read off them and an agreeing checker
    Then A_RecordRefusal is next
    And after the bean closes as "not wanted" the instance completes without ever reaching Call_Sign

  @test:scripts/tests/test-plan-execution.test.ts::test-plan-execution.bpmn_runs_end_to_end_on_a_fixture_plan::undetermined:_a_checker_that_disagrees_decides_nothing,_even_on_an_all-pass_report
  Scenario: A disagreeing checker leaves an all-pass run undetermined
    Given an instance at the exit gateway, and a run and report where every case passed
    When the gateway is completed with a disagreeing checker
    Then A_RecordUndetermined is next
    And the bean closes as blocked, recording a blocker, and the instance completes

  @test:scripts/tests/test-plan-execution.test.ts::test-plan-execution.bpmn_runs_end_to_end_on_a_fixture_plan::the_gateway_is_computed:_asserting_the_branch_is_refused
  Scenario: The exit gateway's branch cannot be asserted
    Given an instance at the exit gateway
    When it is completed with the outcome "certified" instead of facts
    Then it throws

  @test:scripts/tests/test-plan-execution.test.ts::test-plan-execution.bpmn_runs_end_to_end_on_a_fixture_plan::a_bean_someone_else_holds_stops_the_run_before_the_request_(bean-open.bpmn)
  Scenario: A bean someone else holds stops the run before the request
    Given an instance whose bean exists and is someone else's
    When bean-open runs and the gateway answers "not yours"
    Then the instance completes through End_BeanNotYours, its history being only the start, the bean-open call, the gateway and that end
    And bean-open left the bean alone and did not claim it

  @test:scripts/tests/test-plan-execution.test.ts::test-plan-execution.bpmn_runs_end_to_end_on_a_fixture_plan::a_step_out_of_order_is_refused_(what_workflow_complete_enforces)
  Scenario: A step out of order is refused
    Given a fresh instance
    When A_Execute is completed
    Then it throws

  @test:scripts/tests/test-plan-execution.test.ts::test-certification.dmn_—_three_outcomes,_and_the_third_is_reached_honestly::complete,_hashed,_agreed,_nothing_failed,_something_passed_→_certified
  Scenario: A complete, hashed, agreed run with passes and no failures is certified
    Given a completed report with a known data hash, no unexecuted case, an agreeing checker, no failure and two passes
    When test-certification.dmn decides
    Then the outcome is "certified"

  @test:scripts/tests/test-plan-execution.test.ts::test-certification.dmn_—_three_outcomes,_and_the_third_is_reached_honestly::a_failure_in_a_trusted_run_→_refused
  Scenario: A failure in a trusted run is refused
    Given the certified facts with one failed case
    When test-certification.dmn decides
    Then the outcome is "refused"

  @test:scripts/tests/test-plan-execution.test.ts::test-certification.dmn_—_three_outcomes,_and_the_third_is_reached_honestly::%s_→_undetermined
  Scenario Outline: A could-not-determine fact makes the outcome undetermined
    Given the certified facts except that <why>
    When test-certification.dmn decides
    Then the outcome is "undetermined"

    Examples:
      | why                                 |
      | the report is running               |
      | the report was aborted              |
      | the data hash is unknown            |
      | a case was not executed             |
      | the checker disagrees               |
      | the checker could not run           |
      | nothing passed                      |

  @test:scripts/tests/test-plan-execution.test.ts::test-certification.dmn_—_three_outcomes,_and_the_third_is_reached_honestly::could-not-determine_outranks_a_failure:_a_failure_in_an_untrusted_run_is_not_yet_a_refusal
  Scenario: Could-not-determine outranks a failure
    Then three failures with an unknown data hash are "undetermined"
    And three failures with a disagreeing checker are "undetermined"

  @test:scripts/tests/test-plan-execution.test.ts::the_system-under-test_actor_facet::sutRefFor_reads_reach_from_the_actor,_and_absent_reach_is_unknown
  Scenario: The SUT reference reads reach from the actor
    Then the fixture tool's SUT reference is kind tool, its id, version 0.1.0 and reach air-gapped
    And an agent's reference carries the model and configuration of the run, and the tool's does not
    And an agent actor with no reach has reach "unknown"
    And an agent with no model or configuration throws naming FR-002, and an actor without the facet has no reference

  @test:scripts/tests/test-plan-execution.test.ts::the_system-under-test_actor_facet::the_kind_is_the_closed_SUT_list
  Scenario: The SUT kind is a closed list
    Then an actor whose SUT kind is "website" does not parse

  @test:scripts/tests/test-plan-execution.test.ts::the_system-under-test_actor_facet::a_person_cannot_be_a_system_under_test
  Scenario: A person cannot be a system under test
    Then a person actor carrying the SUT facet does not parse

  @test:scripts/tests/test-plan-execution.test.ts::the_system-under-test_actor_facet::reach_is_not_restated_on_the_facet
  Scenario: Reach is not restated on the SUT facet
    Then an actor whose SUT facet carries reach does not parse

  @test:scripts/tests/test-plan-execution.test.ts::the_system-under-test_actor_facet::the_actor_registry_reads_the_facet,_and_refuses_it_on_a_person
  Scenario: The actor registry reads the facet and refuses it on a person
    Given an actors directory with an agent carrying a skill SUT facet
    Then reading the registry gives that agent its facet
    When a person carrying the facet is added
    Then reading the registry throws "cannot carry systemUnderTest"

  @test:scripts/tests/test-plan-execution.test.ts::the_system-under-test_actor_facet::the_roles_exist_with_the_kinds_the_process_needs
  Scenario: The roles the process needs exist with the right kinds
    Given the scenarios role graph
    Then certifier inherits stakeholder and is not judgement-only
    And tester admits system actors, and untainted-checker carries the untainted-verification skill

  @test:scripts/tests/test-plan-execution.test.ts::kg-audit:_the_four_test-plan_criteria::every_criterion_is_registered
  Scenario: The four test-plan criteria are registered
    Then test-plan-resolves, test-case-executed-or-skipped, test-data-hash-present and test-sut-not-self-judged are registered kg criteria

  @test:scripts/tests/test-plan-execution.test.ts::kg-audit:_the_four_test-plan_criteria::nothing_to_judge_is_n/a,_never_a_pass_over_nothing
  Scenario: With nothing to judge every criterion is n/a
    When the test-plan audit runs over no plans, runs or reports
    Then every criterion's result is "n/a"

  @test:scripts/tests/test-plan-execution.test.ts::kg-audit:_the_four_test-plan_criteria::a_clean_plan,_run_and_report_pass_all_four
  Scenario: A clean plan, run and report pass all four criteria
    When the audit runs over the fixture plan and an all-pass run and report
    Then every criterion passes

  @test:scripts/tests/test-plan-execution.test.ts::kg-audit:_the_four_test-plan_criteria::the_plan's_exit_DMN_resolves_from_the_instance_root
  Scenario: The plan's exit DMN resolves from the instance root
    Then the fixture plan's exit decision resolves
    And a reference to a decision test-certification.dmn does not hold does not

  @test:scripts/tests/test-plan-execution.test.ts::kg-audit:_the_four_test-plan_criteria::test-plan-resolves:_a_dangling_plan,_an_undeclared_SUT,_and_a_kind_mismatch
  Scenario: test-plan-resolves finds a dangling plan, an undeclared SUT, a kind mismatch and a bad DMN
    Then a run naming no known plan fails
    And a run whose SUT is not a declared actor, is declared as an agent, or has no facet is each named
    And a plan whose exit decision does not resolve is named

  @test:scripts/tests/test-plan-execution.test.ts::kg-audit:_the_four_test-plan_criteria::test-case-executed-or-skipped:_a_missing_case_fails;_a_skip_with_a_reason_passes
  Scenario: test-case-executed-or-skipped fails a missing case and passes a reasoned skip
    Then a report missing one of the plan's cases fails
    And a report skipping a case with a reason passes
    And a report whose plan is not given is "unknown"

  @test:scripts/tests/test-plan-execution.test.ts::kg-audit:_the_four_test-plan_criteria::test-data-hash-present:_an_unknown_data_hash_fails,_on_the_run_and_on_the_report
  Scenario: test-data-hash-present fails an unknown data hash on the run and on the report
    Given a run and a report each with an unknown data hash
    When the audit runs
    Then test-data-hash-present fails with two findings

  @test:scripts/tests/test-plan-execution.test.ts::kg-audit:_the_four_test-plan_criteria::test-sut-not-self-judged:_a_verdict_by_the_system_under_test_is_found_by_name
  Scenario: test-sut-not-self-judged finds a verdict given by the system under test
    Given a report where the SUT actor reviewed the case advances-enabled-step
    When the audit runs
    Then test-sut-not-self-judged fails at that case
    And test-plan-resolves still passes

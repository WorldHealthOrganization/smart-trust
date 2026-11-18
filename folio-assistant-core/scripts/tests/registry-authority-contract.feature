Feature: the external registry's lane in the evidence process

  @test:scripts/tests/registry-authority-contract.test.ts::the_lane_names_the_external_registry,_and_its_task_names_this_contract::trustedLaneNamesRegistry
  Scenario: Task_VerifyAuthority and Gateway_Authoritative sit in Lane_Trusted, which names external-registry
    When the evidence process is loaded
    Then Task_VerifyAuthority and Gateway_Authoritative are in Lane_Trusted, the external-registry role
    And Task_VerifyAuthority requires registry-authority-contract

  @test:scripts/tests/registry-authority-contract.test.ts::the_lane_names_the_external_registry,_and_its_task_names_this_contract::laneHoldsOneActivity
  Scenario: the registry's lane holds one activity, the readout — no step of this layer's own
    When the activities of the trusted lane are listed
    Then the only one is Task_VerifyAuthority

  @test:scripts/tests/registry-authority-contract.test.ts::What_happens_when_it_does_not_answer:_the_work_plan_records_it,_and_nothing_invents_a_verdict::gatewayTwoAnswers
  Scenario: Gateway_Authoritative has two answers: `yes` goes on to grading, `no` opens the bean
    When Gateway_Authoritative's flows are read
    Then yes goes to grading and no to recording the unverified citation
    And that step is the author's and writes the work plan

  @test:scripts/tests/registry-authority-contract.test.ts::What_happens_when_it_does_not_answer:_the_work_plan_records_it,_and_nothing_invents_a_verdict::noRecordsUnverified
  Scenario: run with a `no`, the unverified citation is recorded — it is neither dropped nor attached
    When the process runs to the gateway and answers no
    Then the only enabled step is recording the unverified citation

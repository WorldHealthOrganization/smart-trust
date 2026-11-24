Feature: the workflow gate on process steps

  @test:scripts/tests/workflow-gate.test.ts::the_base_is_strict_and_the_content-type_processes_are_not::baseProcessesStrict
  Scenario: the three content-agnostic processes enforce
    When editing-hci-validation, draft-to-publication and content-lifecycle are loaded
    Then each is strict

  @test:scripts/tests/workflow-gate.test.ts::a_strict_process_refuses_a_step_it_has_not_reached::commitBeforeGateRefused
  Scenario: committing before the findings gate is refused, with what to do about it
    When a fresh editing instance is asked about Task_Commit
    Then it is refused as not enabled, naming workflow-policy.json and that it cannot be relaxed

  @test:scripts/tests/workflow-gate.test.ts::a_strict_process_refuses_a_step_it_has_not_reached::enabledStepAllowed
  Scenario: an enabled step is allowed
    When a fresh instance is asked about the first step
    Then it is allowed

  @test:scripts/tests/workflow-gate.test.ts::a_declared_relaxation_permits_a_step,_and_is_attributed::declaredRelaxationAttributed
  Scenario: the SME branch may be skipped where a package declared it
    When the SME review is asked about without and with a declared relaxation
    Then without it, it is refused
    And with it, it is allowed, attributed to its package with its reason

  @test:scripts/tests/workflow-gate.test.ts::a_declared_relaxation_permits_a_step,_and_is_attributed::otherProcessRelaxationIgnored
  Scenario: a relaxation for a different process does not apply
    When a relaxation for another process is given
    Then the SME review is still refused

  @test:scripts/tests/workflow-gate.test.ts::what_a_package_may_NOT_relax::gateStepsNotRelaxable
  Scenario: the steps that are the gate refuse to be named
    When relaxations name the findings review, the editor decision and the commit
    Then each is refused as relaxable="false"

  @test:scripts/tests/workflow-gate.test.ts::what_a_package_may_NOT_relax::releaseNotRelaxable
  Scenario: release authorisation cannot be relaxed either
    When a relaxation names release authorisation
    Then it is refused as relaxable="false"

  @test:scripts/tests/workflow-gate.test.ts::what_a_package_may_NOT_relax::unknownProcessOrActivityFails
  Scenario: a relaxation naming a process or activity that is not there fails at load
    When relaxations name a process and an activity that are not there
    Then each fails at load naming the problem

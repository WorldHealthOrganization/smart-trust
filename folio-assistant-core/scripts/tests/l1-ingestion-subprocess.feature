Feature: the L1 ingestion process and its phases

  @test:scripts/tests/l1-ingestion-subprocess.test.ts::a_call_activity_resolves_to_the_process_it_names::callActivitiesResolve
  Scenario: l1-document-ingestion's phases are loaded, not left as bare ids
    When l1-document-ingestion is loaded
    Then it has call activities, each loaded as the process it names

  @test:scripts/tests/l1-ingestion-subprocess.test.ts::entering_a_subprocess::phaseOpensItself
  Scenario: the phase opens by itself, and its steps are what is enabled
    When the process reaches the extract phase
    Then the phase is running and its own steps are enabled, each naming its phase

  @test:scripts/tests/l1-ingestion-subprocess.test.ts::entering_a_subprocess::completingCallRefused
  Scenario: completing the call activity itself is refused, and it says what to do instead
    When the call activity itself is completed
    Then it is refused, saying it is a subprocess and naming the steps to do instead

  @test:scripts/tests/l1-ingestion-subprocess.test.ts::entering_a_subprocess::parentAdvancesWhenChildFinishes
  Scenario: the parent advances when the child finishes, and keeps the record
    When every step of the extract phase is completed
    Then the phase is completed, the parent moves on and the history records it

  @test:scripts/tests/l1-ingestion-subprocess.test.ts::the_step_a_caller_names_is_the_leaf::leafCompletedFromParent
  Scenario: completing a child's step by its own id works from the parent
    When a child's step is completed by its own id from the parent
    Then the child's history records it

  @test:scripts/tests/l1-ingestion-subprocess.test.ts::the_step_a_caller_names_is_the_leaf::notEnabledStillRefused
  Scenario: a step that is enabled nowhere is still refused
    When a step that is not enabled and a node that does not exist are completed
    Then each is refused

  @test:scripts/tests/l1-ingestion-subprocess.test.ts::the_gate_answers_for_a_step_inside_a_phase::gateAllowsEnabledPhaseStep
  Scenario: a subprocess step is allowed when it is enabled, and says which phase
    When the gate is asked about an enabled step inside the phase
    Then it is allowed, naming the phase

  @test:scripts/tests/l1-ingestion-subprocess.test.ts::the_gate_answers_for_a_step_inside_a_phase::laterPhaseStepRefused
  Scenario: a step of a phase not yet entered is refused, not reported as unknown
    When the gate is asked about a step of a phase not yet entered
    Then it is refused, not reported as unknown

  @test:scripts/tests/l1-ingestion-subprocess.test.ts::positionOf::positionReportsLeaf
  Scenario: reports the leaf and the phases above it, from state alone
    When the position is read from the state
    Then each entry is the phase and the leaf below it

  @test:scripts/tests/l1-ingestion-subprocess.test.ts::a_bean-marked_step_in_a_phase_is_still_a_work-plan_write::findInModelReachesMarked
  Scenario: findInModel reaches it — a parent-only lookup would find nothing
    When the work-plan steps inside phases are looked for
    Then there are some, not in the parent, each found by findInModel

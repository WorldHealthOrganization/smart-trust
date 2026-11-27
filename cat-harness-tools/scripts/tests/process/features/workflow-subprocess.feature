# A call activity is the process it names, when a loaded file defines it;
# otherwise it stays one opaque step. A call cycle is refused at load.
Feature: A call activity resolves to the process it names

  @test:scripts/tests/process/workflow-subprocess.test.ts::a_call_activity_resolves_to_the_process_it_names::a_call_activity_naming_a_process_no_file_defines_stays_opaque
  Scenario: A call activity naming an undefined process stays a single step
    Given a process whose call activity "Call_Away" names "Process_Elsewhere", which no file defines
    When it is loaded and an instance started
    Then the model has no children
    And the only enabled step is "Call_Away"
    And completing "Call_Away" completes the instance

  @test:scripts/tests/process/workflow-subprocess.test.ts::a_call_activity_resolves_to_the_process_it_names::a_call-activity_cycle_is_refused_at_load,_not_discovered_at_run_time
  Scenario: A call-activity cycle is refused at load
    Given Process_A calling Process_B and Process_B calling Process_A, in two files
    When a.bpmn is loaded
    Then loading rejects with UnsupportedBpmn saying the process is already on the call path

# src/workflow/process-model.ts resolves a callActivity that names a BPMN global task (kept in one shared
# .bpmn holding no process) into a single step, and lets a shared process take inputs; the engine, checklist,
# bpmn-translate and the global-task-shared criterion read them too. Each Scenario names the test that executes it.
Feature: Global tasks shared by bare id

  @test:scripts/tests/global-tasks.test.ts::a_call_activity_naming_a_global_task_runs_as_that_task::the_step_takes_the_global_task's_type,_name,_skill,_documentation_and_policy;_the_lane_stays_the_call's
  Scenario: A call to a global task takes the task's definition and keeps the call's lane
    Given a shared file with global user task "GT_Track" taking input "label" and global script task "GT_Log"
    And two processes in lane "CI" whose calls name them, giving "label" the values "ci-health" and "repo-health"
    When each process is loaded
    Then "Call_Track" is an activity of type "bpmn:UserTask" named "Open or EDIT the one tracking issue"
    And it has skill "ci-health", the global task's documentation, and is not relaxable
    And its lane is "CI" with role "build-pipeline", and it has no calledElement
    And it records global task "GT_Track" of type "bpmn:GlobalUserTask" with its source file and name
    And its inputs are the caller's own label value
    And "Call_Log" is a "bpmn:ServiceTask" keeping its own name "Log it here", with skill "render-logging" and no inputs
    And the model has no child processes

  @test:scripts/tests/global-tasks.test.ts::a_call_activity_naming_a_global_task_runs_as_that_task::the_engine_enables_and_completes_it_as_a_single_step,_never_a_sub-process
  Scenario: The engine enables and completes a global task call as a single step
    Given a process calling "GT_Track" with label "ci-health" and then "GT_Log"
    When an instance is started
    Then the only enabled step is "Call_Track", with skill "ci-health", global task "GT_Track", inputs label "ci-health" and no calledElement
    And after completing "Call_Track" and "Call_Log" the instance is "completed"

  @test:scripts/tests/global-tasks.test.ts::a_call_activity_naming_a_global_task_runs_as_that_task::the_call's_own_extensions_are_added_after_the_global_task's,_its_documentation_after_the_global_task's
  Scenario: The call's own skill and documentation follow the global task's
    Given a call to "GT_Track" that adds its own documentation and skill "opening-brief"
    When the process is loaded
    Then "Call_Track" has skills "ci-health" then "opening-brief"
    And its documentation is the global task's, a blank line, then the call's own

  @test:scripts/tests/global-tasks.test.ts::a_call_activity_naming_a_global_task_runs_as_that_task::a_declared_input_the_call_gives_no_value_refuses_the_load
  Scenario: A call that gives a declared input no value refuses the load
    Given a call to "GT_Track" that gives "label" no value
    When the process is loaded
    Then loading fails saying it declares input(s) label and gives none of them a value

  @test:scripts/tests/global-tasks.test.ts::a_call_activity_naming_a_global_task_runs_as_that_task::a_process_of_the_same_id_wins_over_a_global_task;_an_id_neither_defines_stays_opaque
  Scenario: A process with the same id as a global task wins
    # Gap: the case of an id that neither a process nor a global task defines is not checked
    Given a separate file defining a process with id "GT_Log" alongside the global task of that id
    When the calling process is loaded
    Then "Call_Log" keeps calledElement "GT_Log" and has no global task
    And its child process is "GT_Log"

  @test:scripts/tests/global-tasks.test.ts::the_shared_file_holds_no_process,_and_says_so::isGlobalTasksFile_and_holdsProcess_tell_it_apart_from_a_diagram
  Scenario: The shared file is told apart from a process diagram
    Given the shared global-tasks file, a caller process diagram and an empty definitions document
    When isGlobalTasksFile and holdsProcess read them
    Then the shared file is a global-tasks file that holds no process
    And the caller diagram is not a global-tasks file and holds a process
    And the empty document is not a global-tasks file

  @test:scripts/tests/global-tasks.test.ts::the_shared_file_holds_no_process,_and_says_so::loading_it_as_a_process_is_refused_with_its_own_error,_not_as_a_broken_diagram
  Scenario: Loading the shared file as a process fails with its own error
    Given the shared global-tasks file alone
    When it is loaded as a process model
    Then loading fails with a GlobalTasksFile error
    And that error is also an UnsupportedBpmn error

  @test:scripts/tests/global-tasks.test.ts::the_tools_that_read_diagrams_read_the_shared_file_too::loadGlobalTasks_lists_each_global_task_with_its_kind,_the_type_it_runs_as,_its_skill_and_its_inputs
  Scenario: loadGlobalTasks lists each global task's kind, run-as type, skills and inputs
    Given the shared global-tasks file
    When loadGlobalTasks reads it
    Then "GT_Track" is a "bpmn:GlobalUserTask" running as "bpmn:UserTask" with skill "ci-health" and input "label"
    And "GT_Log" is a "bpmn:GlobalScriptTask" running as "bpmn:ServiceTask" with skill "render-logging" and no inputs
    And "GT_Track" carries its name and documentation

  @test:scripts/tests/global-tasks.test.ts::the_tools_that_read_diagrams_read_the_shared_file_too::bpmn-translate_extracts_and_injects_a_global_task's_name;_never_a_dataInput's
  Scenario: bpmn-translate extracts and injects global task names but not dataInput names
    Given the shared global-tasks file
    When its translatable strings are extracted
    Then they include "Open or EDIT the one tracking issue" and "Append retained" but not "label"
    And injecting "Ajouter retained" for "Append retained" renames the "GT_Log" global script task

  @test:scripts/tests/global-tasks.test.ts::the_tools_that_read_diagrams_read_the_shared_file_too::global-task-shared_reports_a_global_task_fewer_than_two_processes_call
  Scenario: global-task-shared reports a global task fewer than two processes call
    Given the shared file and two processes that each call both global tasks
    When the global-task-shared findings are computed over both processes
    Then there are none
    And over one process both "GT_Track" and "GT_Log" are reported, the first as "called only by P_A"
    And over no process the first finding says "called by no process"

  @test:scripts/tests/global-tasks.test.ts::the_tools_that_read_diagrams_read_the_shared_file_too::a_process's_checklist_names_the_shared_step_and_the_values_its_call_gives
  Scenario: A process checklist names the shared step and its input values
    Given a process calling "GT_Track" with label "ci-health" and then "GT_Log"
    When its checklist is rendered
    Then it lists shared step "GT_Track" with label = ci-health, and shared step "GT_Log"
    And it tells the reader to record "Call_Track" with workflow_complete

  @test:scripts/tests/global-tasks.test.ts::a_process_may_take_inputs,_as_a_global_task_does::each_call_binds_the_shared_process's_input,_and_the_step_inside_reads_the_caller's_value
  Scenario: Each call binds a shared process's input and the step inside reads the caller's value
    Given a shared process "P_Watch" declaring input "label" that passes it on to its call to "GT_Track"
    And two watches calling it with labels "ci-health" and "repo-health"
    When each watch is loaded
    Then its "Call_Watch" has the caller's label as input
    And its child process declares input "label"
    And the child's "Call_Track" reads the caller's label

  @test:scripts/tests/global-tasks.test.ts::a_process_may_take_inputs,_as_a_global_task_does::loaded_on_its_own,_the_shared_process_names_the_input_it_passes_on
  Scenario: Loaded on its own, a shared process names the input it passes on
    Given the shared process "P_Watch"
    When it is loaded alone
    Then its inputs are "label"
    And its "Call_Track" input label is the placeholder "{label}"

  @test:scripts/tests/global-tasks.test.ts::a_process_may_take_inputs,_as_a_global_task_does::a_call_that_gives_a_declared_process_input_no_value_refuses_the_load
  Scenario: A call that gives a shared process's input no value refuses the load
    Given a watch that calls "P_Watch" without giving "label" a value
    When the watch is loaded
    Then loading fails saying it calls process P_Watch, which declares input(s) label, and gives none of them a value

  @test:scripts/tests/global-tasks.test.ts::a_process_may_take_inputs,_as_a_global_task_does::passing_on_an_input_the_process_does_not_declare_refuses_the_load
  Scenario: Passing on an input the process does not declare refuses the load
    Given the shared process altered so its call passes on "In_CT" instead of its declared input
    When it is loaded
    Then loading fails saying it passes on In_CT, which is not an input this process declares

  @test:scripts/tests/global-tasks.test.ts::a_checklist_names_the_values_a_call_gives_a_shared_process
  Scenario: A checklist names the values a call gives a shared process
    Given a watch calling "P_Watch" with label "ci-health"
    When its checklist is rendered
    Then it lists a subprocess "P_Watch" with label = ci-health

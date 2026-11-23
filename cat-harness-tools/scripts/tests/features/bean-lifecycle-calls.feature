# scripts/check-bean-lifecycle-calls.ts checks that claim, resolve and archive happen only in
# Process_BeanOpen and Process_BeanClose, and that a process working a bean calls both; the
# real bean-lifecycle.bpmn is also walked through the engine. Each Scenario names the test that executes it.
Feature: Bean lifecycle calls OPEN and CLOSE

  @test:scripts/tests/bean-lifecycle-calls.test.ts::check:bean-calls::a_process_that_calls_both,_with_notes_in_between,_is_clean
  Scenario: A process that calls OPEN and CLOSE with notes in between is clean
    Given the Process_BeanOpen and Process_BeanClose diagrams
    And a process calling OPEN, then a step taking a note, then CLOSE
    When the bean call findings are computed
    Then there are none

  @test:scripts/tests/bean-lifecycle-calls.test.ts::check:bean-calls::a_claim,_resolve_or_archive_outside_OPEN_and_CLOSE_is_refused_—_on_a_step_or_through_a_global_task
  Scenario: A claim, resolve or archive outside OPEN and CLOSE is refused, on a step or through a global task
    Given a process between OPEN and CLOSE with a step that does a claim, a resolve or an archive
    When the bean call findings are computed
    Then each gives exactly one "op-outside-lifecycle" finding
    And when the claim comes through global task "GT_X", the finding's detail names "GT_X"

  @test:scripts/tests/bean-lifecycle-calls.test.ts::check:bean-calls::OPEN_without_CLOSE,_and_CLOSE_without_OPEN,_are_each_refused
  Scenario: OPEN without CLOSE, and CLOSE without OPEN, are each refused
    Given one process that calls only OPEN and another that calls only CLOSE
    When the bean call findings are computed
    Then they are "Process_OpenOnly:unpaired-call" and "Process_CloseOnly:unpaired-call"

  @test:scripts/tests/bean-lifecycle-calls.test.ts::check:bean-calls::an_entry_process_naming_a_bean_must_call_both;_a_called_one_runs_on_its_caller's_bean
  Scenario: An entry process naming a bean must call both, while a called one runs on its caller's bean
    Given a process with a step naming bean "abcd" and no OPEN or CLOSE
    When the bean call findings are computed
    Then it gives one "names-bean-without-open-close" finding
    And when a caller process calls it between OPEN and CLOSE there are no findings

  @test:scripts/tests/bean-lifecycle-calls.test.ts::check:bean-calls::a_note-only_entry_process_is_reported,_not_failed
  Scenario: A note-only entry process is reported, not failed
    Given a process whose only step takes a note
    When the bean call findings are computed
    Then there are none
    And the note-takers are exactly "Process_Notes"

  @test:scripts/tests/bean-lifecycle-calls.test.ts::Process_BeanLifecycle_runs_OPEN_→_work_→_CLOSE_through_the_engine::claimed,_worked_and_done:_resolve_sees_only_archive_left,_and_the_instance_completes_on_archive
  Scenario: A claimed, worked and done bean completes on archive after resolve sees only archive left
    Given the harness bean-lifecycle.bpmn, whose children are Process_BeanClose and Process_BeanOpen
    When an instance on bean "abcd" creates, claims, works and closes it as done through Close_Complete
    Then only archive steps are left
    And the only enabled node is "Close_Archive"
    And completing Close_Archive completes the instance

  @test:scripts/tests/bean-lifecycle-calls.test.ts::Process_BeanLifecycle_runs_OPEN_→_work_→_CLOSE_through_the_engine::someone_else's_bean:_OPEN_ends_not-yours_and_the_caller_stops_without_CLOSE
  Scenario: Someone else's bean ends OPEN as not-yours and the caller stops without CLOSE
    Given the harness bean-lifecycle.bpmn
    When an instance finds the bean exists and is someone else's, leaves it alone and takes "not yours"
    Then the instance is completed
    And no Call_BeanClose child was started

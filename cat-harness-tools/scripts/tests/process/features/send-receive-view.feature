# Send and receive tasks walk as tasks. A boundary timer is refused by a run
# load, and a view load lists it on notRun instead, dropping the flows that
# touch it.
Feature: Send and receive tasks are steps; a boundary timer is read past only by a view load

  @test:scripts/tests/process/send-receive-view.test.ts::send_and_receive_tasks::load_as_activities_in_a_run_load
  Scenario: Send and receive tasks load as activities
    Given a process start → sendTask "Send" → receiveTask "Recv" → end, with no boundary event
    When it is loaded for running
    Then "Send" and "Recv" are activities
    And notRun is undefined

  @test:scripts/tests/process/send-receive-view.test.ts::a_boundary_timer::is_still_refused_by_a_run_load
  Scenario: A boundary timer is refused by a run load
    Given the same process with a timer boundary event "B" on "Recv" leading to end "E2"
    When it is loaded for running
    Then loading rejects with an error naming bpmn:BoundaryEvent

  @test:scripts/tests/process/send-receive-view.test.ts::a_boundary_timer::is_listed,_not_refused,_by_a_view_load
  Scenario: A boundary timer is listed on notRun by a view load
    Given the same process with the timer boundary event "B" on "Recv"
    When it is loaded with view set
    Then notRun is exactly one entry: id "B", type bpmn:BoundaryEvent, name "7 days passed", attached to "Recv"
    And the flow "F4" from it is not in the model, while its end node "E2" is
    And "Recv" has only "F3" outgoing

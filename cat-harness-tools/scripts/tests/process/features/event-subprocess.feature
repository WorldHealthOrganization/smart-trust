# An event subprocess (triggeredByEvent) loads: its steps are the process's
# own, and they take the container's lane.
Feature: An event subprocess loads as part of its process

  @test:scripts/tests/process/event-subprocess.test.ts::event_subprocess::its_steps_load_as_the_process's_own,_in_the_container's_lane
  Scenario: An event subprocess's steps load as the process's own, in its lane
    Given a process with lane "Commenter" holding a main path and an event subprocess "Sub" with start "WS" and task "W"
    When the process model is loaded
    Then node "W" is named "Record the withdrawal" and is in lane "Commenter"
    And node "WS" has kind "start"
    And there is no node "Sub"
    And main-path task "T" is in lane "Commenter"

# Non-interrupting boundary events: an optional side path that starts while
# its activity holds a token and never takes that token away. Interrupting
# boundary events, and boundary events with an incoming flow, are refused at
# load.
Feature: A non-interrupting boundary event is an optional side path; other boundary events are refused

  @test:scripts/tests/process/boundary-event.test.ts::a_non-interrupting_boundary_event::loads_as_a_boundary_node_on_its_activity,_and_is_reachable_through_it
  Scenario: A non-interrupting boundary event loads on its activity and is reachable
    Given a diagram whose "Review" task carries a non-interrupting boundary event "OptIn" leading to a "Note" task
    When the diagram is loaded
    Then the node "OptIn" has kind "boundary" and is attached to "Review"
    And reachability reports neither "OptIn" nor "Note" as unreachable

  @test:scripts/tests/process/boundary-event.test.ts::a_non-interrupting_boundary_event::is_offered,_marked_optional,_only_while_its_activity_holds_a_token
  Scenario: The boundary event is offered as optional while its activity holds a token
    # Gap: the title says "only while"; the body checks only that it is offered at start, not that it stops being offered once "Review" is done
    Given the diagram with the non-interrupting boundary event "OptIn" on "Review"
    When an instance is started and its enabled steps are listed
    Then the enabled steps are exactly "Review" then "OptIn"
    And "OptIn" is an activity marked optional on "Review"

  @test:scripts/tests/process/boundary-event.test.ts::a_non-interrupting_boundary_event::skipping_it_is_the_default:_the_main_path_finishes_without_it
  Scenario: Skipping the boundary event lets the main path finish
    Given the diagram with the non-interrupting boundary event "OptIn" on "Review"
    When an instance is started and "Review" is completed without taking "OptIn"
    Then the instance holds no tokens
    And its status is "completed"

  @test:scripts/tests/process/boundary-event.test.ts::a_non-interrupting_boundary_event::taking_it_starts_the_side_path_and_leaves_the_activity's_token_alone
  Scenario: Taking the boundary event starts the side path and keeps the activity's token
    Given the diagram with the non-interrupting boundary event "OptIn" on "Review"
    When an instance is started and "OptIn" is completed
    Then the instance holds tokens on "Note" and "Review"
    When "Review" is completed
    Then only "Note" holds a token
    When "Note" is completed
    Then the instance's status is "completed"

  @test:scripts/tests/process/boundary-event.test.ts::a_non-interrupting_boundary_event::the_checklist_lists_it_right_after_its_step,_as_optional
  Scenario: The checklist lists the boundary event after its step, as optional
    # Gap: the title says "right after"; the body checks only that the optional section comes somewhere after the "Review" step, not immediately after it
    Given the diagram with the non-interrupting boundary event "OptIn" on "Review"
    When its checklist is generated
    Then the checklist has a "### 1. `Review`" section
    And a "### Optional, while" section appears after it
    And the checklist names node "OptIn" and says "skipping it is the default"

  @test:scripts/tests/process/boundary-event.test.ts::a_non-interrupting_boundary_event::cannot_be_taken_once_its_activity_no_longer_holds_a_token
  Scenario: The boundary event cannot be taken once its activity is done
    Given an instance of the diagram in which "Review" has been completed
    When "OptIn" is completed
    Then completing it throws

  @test:scripts/tests/process/boundary-event.test.ts::other_boundary_events_are_refused,_not_walked_wrongly::an_interrupting_one
  Scenario: An interrupting boundary event is refused at load
    Given the diagram with the boundary event's cancelActivity="false" removed
    When the diagram is loaded
    Then loading rejects with UnsupportedBpmn
    And the error message mentions "interrupting"

  @test:scripts/tests/process/boundary-event.test.ts::other_boundary_events_are_refused,_not_walked_wrongly::one_with_an_incoming_flow
  Scenario: A boundary event with an incoming flow is refused at load
    Given the diagram with a sequence flow from the start event into the boundary event
    When the diagram is loaded
    Then loading rejects with an error mentioning "incoming sequence flow"

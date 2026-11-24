# node-reachable and node-has-exit: a node nothing can run, and a node where
# control arrives and stops. A node that leads into a start event gates it and
# is not unreachable. Each Scenario names the test that executes it.
Feature: Every process node is reachable and has an exit

  @test:scripts/tests/reachability.test.ts::unreachable_—_nothing_can_run_it::a_node_no_flow_arrives_at_is_reported
  Scenario: A node no flow arrives at is unreachable
    Given a process S to A to E, and a task "Stranded" with no flows
    Then "Stranded" alone is unreachable
    And there are no pre-start gates

  @test:scripts/tests/reachability.test.ts::unreachable_—_nothing_can_run_it::a_stranded_LOOP_is_reported,_and_does_not_recurse_forever
  Scenario: A stranded loop is reported without recursing forever
    Given a process S to E, and tasks X and Y flowing into each other
    Then X and Y are unreachable

  @test:scripts/tests/reachability.test.ts::unreachable_—_nothing_can_run_it::everything_on_the_happy_path_passes
  Scenario: The happy path passes
    Given a process S to A to E
    Then nothing is unreachable and nothing lacks an exit

  @test:scripts/tests/reachability.test.ts::a_pre-start_gate_is_NOT_unreachable::a_node_that_flows_INTO_a_start_event_gates_it,_and_passes
  Scenario: A node flowing into a start event is a gate, not unreachable
    Given a task "Gate" flowing into start S, then S to E
    Then nothing is unreachable
    And "Gate" is a pre-start gate

  @test:scripts/tests/reachability.test.ts::a_pre-start_gate_is_NOT_unreachable::a_gate_TWO_steps_before_the_start_event_still_counts
  Scenario: A gate two steps before the start event still counts
    Given "Gate" to "Prep" to start S to E
    Then nothing is unreachable
    And "Gate" and "Prep" are pre-start gates

  @test:scripts/tests/reachability.test.ts::no_exit_—_control_arrives_and_stops::a_task_with_no_outgoing_flow_is_reported
  Scenario: A task with no outgoing flow has no exit
    Given a process S to A, where A has no outgoing flow
    Then "A" alone has no exit

  @test:scripts/tests/reachability.test.ts::no_exit_—_control_arrives_and_stops::an_END_event_with_no_outgoing_flow_is_NOT_reported_—_that_is_what_it_is
  Scenario: An end event without an outgoing flow is not reported
    Given a process S to E
    Then nothing lacks an exit

  @test:scripts/tests/reachability.test.ts::no_exit_—_control_arrives_and_stops::a_node_can_be_BOTH_unreachable_and_without_an_exit
  Scenario: A node can be both unreachable and without an exit
    Given a process S to E and a task "Island" with no flows
    Then "Island" is unreachable and has no exit

  @test:scripts/tests/reachability.test.ts::the_real_corpus::every_diagram_is_clean,_and_feature-staging's_gate_is_the_reason_the_rule_exists
  Scenario: Every real diagram is clean and the corpus has a pre-start gate
    Given the harness's process diagrams, more than 20
    Then none has an unreachable node or a node with no exit
    And together they have at least one pre-start gate

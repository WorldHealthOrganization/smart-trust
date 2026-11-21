# How the process-model loader (src/workflow/process-model.ts) reads the
# <cat-harness.processes:fulfilment/> and <cat-harness.processes:no-call/> extension
# elements, refusing a reasonless exemption at load time. Each Scenario names the test that executes it.
Feature: Actor-kind fulfilment and no-call declarations on a process step

  @test:scripts/tests/activity-fulfilment.test.ts::<cat-harness.processes:fulfilment/>::a_declaration_with_kinds_and_a_reason_is_read_onto_the_node
  Scenario: A fulfilment declaration with kinds and a reason is read onto the node
    Given a one-activity diagram whose task declares fulfilment kinds "person agent" with a reason
    When the diagram is loaded
    Then the task node's fulfilment has kinds "person" and "agent"
    And it carries the stated reason

  @test:scripts/tests/activity-fulfilment.test.ts::<cat-harness.processes:fulfilment/>::one_kind_parses_the_same_way_as_several
  Scenario: A single fulfilment kind parses as a one-element list
    Given a task declaring fulfilment kinds "system" with a reason
    When the diagram is loaded
    Then the node's fulfilment kinds are the list ["system"]

  @test:scripts/tests/activity-fulfilment.test.ts::<cat-harness.processes:fulfilment/>::no_declaration_leaves_the_node_undefined_—_the_derived_answer_applies
  Scenario: A step with no fulfilment declaration leaves the node's fulfilment undefined
    Given a service task with no extension elements
    When the diagram is loaded
    Then the node's fulfilment is undefined

  @test:scripts/tests/activity-fulfilment.test.ts::<cat-harness.processes:fulfilment/>::a_reasonless_exemption_does_not_load
  Scenario: A fulfilment declaration without a reason does not load
    Given a task declaring fulfilment kinds "person" with no reason attribute
    When the diagram is loaded
    Then loading fails with "carries no reason"
    And a reason of only whitespace fails the same way

  @test:scripts/tests/activity-fulfilment.test.ts::<cat-harness.processes:fulfilment/>::an_unknown_actor_kind_does_not_load
  Scenario: A fulfilment declaration naming an unknown actor kind does not load
    Given a task declaring fulfilment kinds "robot" with a reason
    When the diagram is loaded
    Then loading fails with "unknown actor kind"

  @test:scripts/tests/activity-fulfilment.test.ts::<cat-harness.processes:fulfilment/>::a_declaration_naming_no_kinds_does_not_load
  Scenario: A fulfilment declaration naming no kinds does not load
    Given a task declaring fulfilment with a reason but no kinds attribute
    When the diagram is loaded
    Then loading fails with "names no kinds"

  @test:scripts/tests/activity-fulfilment.test.ts::<cat-harness.processes:no-call_reason>::a_stated_reason_is_carried_on_the_node
  Scenario: A no-call declaration's reason is carried on the node
    Given a task declaring no-call with reason "one check out of a larger review."
    When the diagram is loaded
    Then the node's no-call reason is that string

  @test:scripts/tests/activity-fulfilment.test.ts::<cat-harness.processes:no-call_reason>::a_reasonless_declaration_does_not_load
  Scenario: A no-call declaration without a reason does not load
    Given a task declaring no-call with no reason attribute
    When the diagram is loaded
    Then loading fails with "no-call/> carries no reason"
    And a reason of only whitespace fails with "carries no reason"

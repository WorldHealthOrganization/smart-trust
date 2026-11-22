# An unknown attribute on <cat-harness.processes:bean> in a BPMN diagram is refused by
# src/workflow/process-model.ts loadProcessModel, while a bare bean marker still means abstention.
# Each Scenario names the test that executes it.
Feature: Unknown bean attributes are refused

  @test:scripts/tests/bean-attr-refused.test.ts::an_unknown_attribute_is_refused::`action="create"`_—_the_exact_attribute_that_did_nothing_for_weeks
  Scenario: A bean marker carrying action="create" is refused
    Given a one-task diagram whose task carries <cat-harness.processes:bean action="create"/>
    When the process model is loaded
    Then loading fails with an error saying cat-harness.processes:bean carries "action"

  @test:scripts/tests/bean-attr-refused.test.ts::an_unknown_attribute_is_refused::the_message_says_what_to_write_instead,_both_ways
  Scenario: The refusal tells the author to drop the attribute if abstention was meant
    # Gap: only the abstention half of the advice is asserted, not the alternative op
    Given a one-task diagram whose task carries <cat-harness.processes:bean actoin="claim"/>
    When the process model is loaded
    Then loading fails with an error saying "drop the attribute entirely if abstention is what you meant"

  @test:scripts/tests/bean-attr-refused.test.ts::an_unknown_attribute_is_refused::it_is_refused_even_alongside_a_VALID_op
  Scenario: A stray attribute is refused even next to a valid op
    Given a one-task diagram whose task carries <cat-harness.processes:bean op="claim" action="create"/>
    When the process model is loaded
    Then loading fails with an error saying cat-harness.processes:bean carries "action"

  @test:scripts/tests/bean-attr-refused.test.ts::what_the_guard_must_not_break::a_bare_`<cat-harness.processes:bean/>`_still_loads,_and_still_means_abstention
  Scenario: A bare bean marker still loads and means abstention
    Given a one-task diagram whose task carries a bare <cat-harness.processes:bean/>
    When the process model is loaded
    Then node "Task_B" touches the work plan
    And node "Task_B" has no work plan op

  @test:scripts/tests/bean-attr-refused.test.ts::what_the_guard_must_not_break::a_valid_op_still_loads
  Scenario: A bean marker with a valid op still loads
    Given a one-task diagram whose task carries <cat-harness.processes:bean op="claim"/>
    When the process model is loaded
    Then node "Task_B" has work plan op "claim"

  @test:scripts/tests/bean-attr-refused.test.ts::what_the_guard_must_not_break::an_unknown_op_VALUE_is_still_refused_by_its_own_check
  Scenario: An unknown op value is refused by its own check
    Given a one-task diagram whose task carries <cat-harness.processes:bean op="reopen"/>
    When the process model is loaded
    Then loading fails with an error saying op="reopen" is not implemented

  @test:scripts/tests/bean-attr-refused.test.ts::the_real_corpus::every_diagram_in_this_repository_still_loads
  Scenario: Every process diagram in the repository still loads
    Given the process diagrams among the harness's workflow files
    Then there are more than 10 of them
    And each one loads as a process model without error

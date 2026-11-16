# src/workflow/work-plan-store.ts puts the beans themselves, read through the work-plan store's get
# and positions, into an enabled step's context, and describes them one line each.
# Each Scenario names the test that executes it.
Feature: An enabled step carries its beans in context

  @test:scripts/tests/sdlc/work-plan-store-bean-context.test.ts::beansInContext::a_bean_the_store_holds_comes_with_its_fields_and_where_it_is
  Scenario: A held bean comes with its fields and its process position
    Given a store holding "fx-aaaa" titled "Do the work", in-progress, tagged "area:store", in the running instance "ccr--a" at "Task_Review"
    When the beans in context are read for "fx-aaaa"
    Then it is found with its title, status, tags and body
    And its positions are process "code-change-review", instance "ccr--a", nodes "Task_Review", status "running"

  @test:scripts/tests/sdlc/work-plan-store-bean-context.test.ts::beansInContext::a_bean_the_store_does_not_hold_is_said_to_be_missing,_not_dropped
  Scenario: A bean the store does not hold is reported as not found
    When the beans in context are read for "fx-gone"
    Then the result is one entry with id "fx-gone" and found false

  @test:scripts/tests/sdlc/work-plan-store-bean-context.test.ts::beansInContext::instances_that_cannot_be_read_make_the_position_UNKNOWN,_never_empty
  Scenario: Unreadable instances make the position unknown
    Given a store whose positions call throws "the workflows graph is not mounted"
    When the beans in context are read for "fx-aaaa"
    Then the bean has no positions
    And its positions-unknown reason is "the workflows graph is not mounted"

  @test:scripts/tests/sdlc/work-plan-store-bean-context.test.ts::withBeans::each_enabled_step's_context_carries_its_beans;_a_step_with_no_context_is_left_alone
  Scenario: Each enabled step's context gets its carried beans
    Given a position whose "Task_Review" step carries "fx-aaaa" and "fx-gone" and whose "Gateway_X" step has no context
    When the beans are added to it
    Then "Task_Review"'s context holds "fx-aaaa" found and "fx-gone" not found
    And "Gateway_X" is unchanged
    And the input position is not mutated

  @test:scripts/tests/sdlc/work-plan-store-bean-context.test.ts::describeBeans::one_line_per_bean:_title,_status,_and_the_running_process_it_is_at
  Scenario: Each bean is described with its title, status and process position
    Given the beans in context for "fx-aaaa" and "fx-gone"
    When they are described
    Then the text says "fx-aaaa — Do the work (in-progress); code-change-review at Task_Review"
    And it says "fx-gone — not in the work plan"

  @test:scripts/tests/sdlc/work-plan-store-bean-context.test.ts::describeBeans::nothing_carried,_nothing_printed
  Scenario: No beans describe as an empty string
    When an empty list of beans is described
    Then the text is empty

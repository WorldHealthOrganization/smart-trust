# The todo graph is declared, present, and read. Both tests are skipped when
# the published todo index is not built. Each Scenario names the test that
# executes it.
Feature: Published process hierarchy of the todo board

  Background:
    Given the published todo index has been built

  @test:scripts/tests/todos.test.ts::the_published_process_hierarchy::real_call_edges_are_present_—_a_silent_regex_failure_would_flatten_the_board
  Scenario: Real call edges are present
    Then Process_Lifecycle calls Process_Publication, Process_Publication calls Process_Editing, and Process_Review calls Process_CodeReview
    And more than 5 processes call another

  @test:scripts/tests/todos.test.ts::the_published_process_hierarchy::every_process_a_todo_names_exists_in_the_hierarchy
  Scenario: Every process a todo names is in the hierarchy
    # Gap: with no todo tagged with a process the loop asserts nothing.
    Then every process tag of every todo item is a key of the hierarchy

# schemas/process/convention.ts and the process model scope coding conventions to where a
# diagram binds them (process, lane or activity), and keep each convention a declared KG node.
# Each Scenario names the test that executes it.
Feature: Conventions apply only where they are bound

  @test:scripts/tests/conventions.test.ts::absent_binding_means_NONE,_not_all::a_diagram_that_binds_nothing_gives_every_step_zero_conventions
  Scenario: A diagram that binds nothing gives every activity zero conventions
    Given the process model of voice-review.bpmn
    When its activities are read
    Then there is at least one activity
    And no activity carries any convention

  @test:scripts/tests/conventions.test.ts::absent_binding_means_NONE,_not_all::a_lane-scoped_convention_does_NOT_reach_another_lane
  Scenario: A lane-scoped convention does not reach an activity in another lane
    Given the process model of code-change-review.bpmn
    When an activity in a lane other than "Authoring agent" is read
    Then such an activity exists
    And its conventions include the process-scoped "comment-why-not-what"
    And its conventions do not include the lane-scoped "no-clean-run-over-an-empty-set"

  @test:scripts/tests/conventions.test.ts::the_union_along_the_scope_chain::process,_then_lane,_then_activity_—_in_that_order,_de-duplicated
  Scenario: Conventions in force are listed process first, then lane, then activity
    # Gap: no ref repeats across scopes here, so de-duplication is not exercised by this test
    Given "a" bound on the process, "b" on the lane and "c" on the activity
    When the conventions in force are computed
    Then the list is "a" with scope process, "b" with scope lane, "c" with scope activity, in that order

  @test:scripts/tests/conventions.test.ts::the_union_along_the_scope_chain::a_ref_bound_twice_keeps_its_BROADEST_scope,_and_appears_once
  Scenario: A convention bound twice appears once, at its broadest scope
    Given "a" bound on both the process and the activity
    When the conventions in force are computed
    Then the list holds "a" once, with scope process

  @test:scripts/tests/conventions.test.ts::the_union_along_the_scope_chain::nothing_bound_anywhere_is_an_empty_list,_not_a_throw
  Scenario: Nothing bound anywhere gives an empty list
    Given no bindings at any scope
    When the conventions in force are computed
    Then the result is an empty list

  @test:scripts/tests/conventions.test.ts::a_convention_is_a_declared_KG_node::the_group_exists_and_holds_some_—_otherwise_everything_below_is_vacuous
  Scenario: The conventions group exists and holds conventions
    Given the repository's conventions directory
    Then the directory exists
    And it holds at least one .json file

  @test:scripts/tests/conventions.test.ts::a_convention_is_a_declared_KG_node::every_one_parses,_and_carries_a_statement_a_reader_can_act_on
  Scenario: Every convention parses and has a non-empty statement
    Given each .json file in the conventions directory
    When it is parsed with the convention schema
    Then it parses successfully
    And its statement is non-empty

  @test:scripts/tests/conventions.test.ts::a_convention_is_a_declared_KG_node::a_convention_with_no_statement_is_REFUSED
  Scenario: A convention with no statement is refused
    Given a convention with an id and a title but no statement
    When it is parsed with the convention schema
    Then the parse fails

  @test:scripts/tests/conventions.test.ts::every_bound_ref_resolves_to_a_convention_that_exists::no_diagram_names_a_convention_nobody_wrote
  Scenario: Every convention a diagram binds names a convention file that exists
    Given every process diagram in the harness's workflows
    When each node's bound conventions are collected
    Then no bound ref is missing from the conventions directory
    And at least one convention is bound somewhere in the corpus

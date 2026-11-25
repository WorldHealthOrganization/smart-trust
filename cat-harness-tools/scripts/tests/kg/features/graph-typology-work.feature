# The graph-typology registry's recordsWork flag (schemas/kg/cat-harness.ts) decides whether a
# checkout is ACTIVE or STATIC, and scripts/check-graph-typology-work.ts reports which state kinds
# have not decided it. Each Scenario names the test that executes it.
Feature: Whether a repository records work

  @test:scripts/tests/kg/graph-typology-work.test.ts::recordsWork_is_narrower_than_holds:_state::an_ingestion_queue_is_live_state_and_is_NOT_work
  Scenario: An ingestion queue is live state and does not record work
    Given the default graph-typology registry
    When the "uploads" kind is read
    Then it holds "state"
    And its recordsWork is false

  @test:scripts/tests/kg/graph-typology-work.test.ts::recordsWork_is_narrower_than_holds:_state::beans_and_todos_both_record_work,_and_are_still_different_things
  Scenario: Beans and todos both record work
    # Gap: that beans and todos are different kinds is not asserted beyond their separate registry entries
    Given the default graph-typology registry
    Then the "beans" kind records work
    And the "todos" kind records work

  @test:scripts/tests/kg/graph-typology-work.test.ts::recordsWork_is_narrower_than_holds:_state::a_BPMN_instance_mid-flight_records_work
  Scenario: A BPMN instance mid-flight records work
    Given the default graph-typology registry
    Then the "workflow-state" kind records work

  @test:scripts/tests/kg/graph-typology-work.test.ts::recordsWork_is_narrower_than_holds:_state::every_state_kind_has_decided_—_no_kind_ships_undecided
  Scenario: Every state kind has decided whether it records work
    Given the default graph-typology registry
    When the undecided work kinds are listed
    Then the list is empty

  @test:scripts/tests/kg/graph-typology-work.test.ts::recordsWork_is_narrower_than_holds:_state::content_and_context_kinds_are_not_asked
  Scenario: Content and context kinds are not asked whether they record work
    Given the default graph-typology registry
    Then the "cat-harness" kind leaves recordsWork undefined
    And the "memory" kind leaves recordsWork undefined

  @test:scripts/tests/kg/graph-typology-work.test.ts::the_verdict_is_asked_of_the_REPOSITORY,_not_one_instance::a_work-plan_graph_anywhere_in_the_checkout_makes_it_active
  Scenario: A work-plan graph anywhere in the checkout makes it active
    Given a temporary repository whose instance "layer" declares a "beans/" directory of kind "beans"
    When the repository is asked whether it is active
    Then it is active
    And its work plan is the "layer" instance with kinds ["beans"]

  @test:scripts/tests/kg/graph-typology-work.test.ts::the_verdict_is_asked_of_the_REPOSITORY,_not_one_instance::an_instance_with_only_non-work_state_is_static
  Scenario: An instance with only non-work state is static
    Given a temporary repository whose instance "layer" declares only an "uploads/" directory of kind "uploads"
    When the repository is asked whether it is active
    Then it is not active

  @test:scripts/tests/kg/graph-typology-work.test.ts::the_verdict_is_asked_of_the_REPOSITORY,_not_one_instance::this_repository_is_ACTIVE,_on_the_checkout's_beans_and_todos
  Scenario: This checkout is active on the work plan cat-harness hosts
    # Gap: that the plan is made of beans and todos is not asserted, only that cat-harness hosts it
    Given the real checkout root four directories above the test
    When it is asked whether it is active
    Then it is active
    And the checkout root has no declaration of its own
    And the work plan's instances include "cat-harness"

  @test:scripts/tests/kg/graph-typology-work.test.ts::the_gate_reports_what_it_examined::prints_the_count_even_when_nothing_is_wrong
  Scenario: The gate prints the count even when nothing is wrong
    Given no undecided kinds and 11 state kinds
    When the report is formatted
    Then it contains "11 kind(s) hold"

  @test:scripts/tests/kg/graph-typology-work.test.ts::the_gate_reports_what_it_examined::no_state_kinds_at_all_is_NOT_a_pass
  Scenario: No state kinds at all is not a pass
    Given no undecided kinds and 0 state kinds
    When the report is formatted
    Then it contains "NOTHING WAS EXAMINED"

  @test:scripts/tests/kg/graph-typology-work.test.ts::the_gate_reports_what_it_examined::an_undecided_kind_is_named_with_the_question_it_has_to_answer
  Scenario: An undecided kind is reported with the question it has to answer
    # Gap: that the report names "mystery" is not asserted
    Given the undecided kind "mystery" among 5 state kinds
    When the report is formatted
    Then it contains "partway through"

  @test:scripts/tests/kg/graph-typology-work.test.ts::could_not_determine_is_a_THIRD_state,_never_STATIC::an_unreadable_declaration_yields_undefined,_not_false
  Scenario: An unreadable declaration yields undefined, not static
    Given a temporary repository whose instance "broken" has a declaration that is not valid JSON
    When the repository is asked whether it is active
    Then the answer is undefined
    And the work plan lists 1 unreadable declaration

  @test:scripts/tests/kg/graph-typology-work.test.ts::could_not_determine_is_a_THIRD_state,_never_STATIC::a_real_work_plan_outranks_an_unreadable_sibling
  Scenario: A real work plan outranks an unreadable sibling
    Given a temporary repository with an instance "ok" declaring a "beans" directory
    And a sibling instance "broken" whose declaration is not valid JSON
    When the repository is asked whether it is active
    Then it is active

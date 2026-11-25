# The store tools' typed results agree with the interfaces their scripts
# print under --json; the type checker holds the agreement, and these cases
# parse real-shaped values. Each Scenario names the test that executes it.
Feature: Store tool result schemas

  @test:scripts/tests/store-tool-results.test.ts::the_store_tools'_results::are_published_as_shared_tool_types
  Scenario: The results are shared tool types
    Then BeanClaimCheck, DrainQueue, OpenWorkLookup, SessionSweep, BeanQueryRows and HarnessStates are all tool types

  @test:scripts/tests/store-tool-results.test.ts::the_store_tools'_results::a_claim_check_parses,_and_an_unknown_state_is_refused
  Scenario: A claim check parses and an unknown state is refused
    Then a skip-open-pr claim check parses unchanged
    And the same with state "maybe" is refused

  @test:scripts/tests/store-tool-results.test.ts::the_store_tools'_results::a_drain_queue_parses
  Scenario: A drain queue parses
    Then a queue with sources, owners, exclusions and disagreements parses unchanged

  @test:scripts/tests/store-tool-results.test.ts::the_store_tools'_results::a_session_sweep_parses
  Scenario: A session sweep parses
    Then a sweep with its counts parses unchanged

  @test:scripts/tests/store-tool-results.test.ts::the_store_tools'_results::bean_query_rows_parse,_and_a_non-string_value_is_refused
  Scenario: Query rows parse and a non-string value is refused
    Then rows of string fields parse unchanged
    And a row with a numeric id is refused

  @test:scripts/tests/store-tool-results.test.ts::the_store_tools'_results::harness_states_parse,_and_an_unknown_step_state_is_refused
  Scenario: Harness states parse and an unknown step state is refused
    Then a harness state with initialization steps and health badges parses unchanged
    And the same with a step state "maybe" is refused

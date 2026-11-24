# The signing route: the API row is unique, and everything the table cannot
# name goes to a person. Each Scenario names the test that executes it.
Feature: Signing route decision

  @test:scripts/tests/signing-route.test.ts::the_signing_route_table::it_offers_exactly_the_two_routes_the_diagram_draws
  Scenario: The table offers exactly two routes
    Then the signing-route table's possible outcomes are "api" and "human"

  @test:scripts/tests/signing-route.test.ts::the_signing_route_table::the_API_is_reached_only_from_internet_or_egress-restricted_reach_with_an_endpoint_configured
  Scenario: The API is reached only with permitting reach and a configured endpoint
    When every reach value, including unknown, is evaluated with the endpoint configured and not
    Then the API outcome comes from exactly egress-restricted with configured and internet with configured

  @test:scripts/tests/signing-route.test.ts::the_signing_route_table::both_facts_are_load-bearing_—_neither_alone_decides
  Scenario: Neither fact alone decides the API route
    Then internet reach without a configured endpoint routes to "human"
    And air-gapped reach with a configured endpoint routes to "human"

  @test:scripts/tests/signing-route.test.ts::the_signing_route_table::unknown_reach_goes_to_the_human_even_with_an_endpoint_configured
  Scenario: Unknown reach goes to the human
    Then unknown reach with a configured endpoint routes to "human"

  @test:scripts/tests/signing-route.test.ts::the_signing_route_table::a_reach_value_the_table_does_not_name_still_routes_to_a_person
  Scenario: An unnamed reach value goes to the human
    Then reach "satellite-uplink" with a configured endpoint routes to "human"

  @test:scripts/tests/signing-route.test.ts::the_signing_route_table::every_combination_is_decided_—_no_run_reaches_the_gateway_with_no_answer
  Scenario: Every combination is decided
    When every reach value is evaluated with the endpoint configured and not
    Then each outcome is "api" or "human"

  @test:scripts/tests/signing-route.test.ts::the_table_and_effectiveReach_agree_about_the_undeclared_case::an_undeclared_actor_in_a_connected_deployment_does_not_reach_the_API
  Scenario: An undeclared actor in a connected deployment goes to the human
    When the effective reach of an internet deployment with an undeclared actor is computed
    Then it is unknown
    And with a configured endpoint it routes to "human"

  @test:scripts/tests/signing-route.test.ts::the_table_and_effectiveReach_agree_about_the_undeclared_case::a_declared_air-gapped_actor_in_a_connected_deployment_takes_the_human_route
  Scenario: A declared air-gapped actor goes to the human
    When the effective reach of an internet deployment with an air-gapped actor is evaluated with a configured endpoint
    Then it routes to "human"

  @test:scripts/tests/signing-route.test.ts::the_diagram_the_table_backs::the_gateway's_branches_are_the_table's_outcomes
  Scenario: The signing diagram's gateway is backed by the table
    # Gap: asserts only the gateway's decisionRef; that branches match outcomes is left to loadProcessModel not throwing.
    When qa-report-signing.bpmn is loaded
    Then Gateway_SigningRoute's decision reference names signing-route.dmn#Decision_SigningRoute

  @test:scripts/tests/signing-route.test.ts::the_diagram_the_table_backs::the_human_lane_is_a_userTask_—_a_system_actor_cannot_fill_it
  Scenario: Only the API task can be filled by a system actor
    When qa-report-signing.bpmn is loaded
    Then Task_HumanSign's fulfilment kinds exclude "system"
    And Task_ApiSign's include "system"

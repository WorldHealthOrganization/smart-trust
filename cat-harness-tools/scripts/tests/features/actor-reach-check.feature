# check:actor-reach (scripts/check-actor-reach.ts) compares each actor's declared
# network reach with its deployment's topology, and reports undeclared reach as unknown.
# Each Scenario names the test that executes it.
Feature: Actor network reach check

  @test:scripts/tests/actor-reach-check.test.ts::buildReport::an_actor_claiming_more_than_its_deployment_grants_is_a_conflict
  Scenario: An actor claiming more reach than its deployment grants is a conflict
    Given an air-gapped deployment with a system actor "signer" claiming reach "internet"
    When the reach report is built
    Then the conflicts are exactly "signer"

  @test:scripts/tests/actor-reach-check.test.ts::buildReport::an_air-gapped_actor_inside_a_connected_deployment_is_reported,_not_flagged
  Scenario: An air-gapped actor inside a connected deployment is reported, not flagged
    Given an internet deployment with a system actor "isolated" declaring reach "air-gapped"
    When the reach report is built
    Then there are no conflicts
    And "isolated" is listed as declared, with reach and effective reach "air-gapped"

  @test:scripts/tests/actor-reach-check.test.ts::buildReport::an_undeclared_actor_is_`unknown`,_not_the_deployment's_value
  Scenario: An actor declaring no reach is unknown, not the deployment's value
    Given an internet deployment with a system actor "quiet" declaring no reach
    When the reach report is built
    Then "quiet" is listed as undeclared with effective reach "unknown"
    And nothing is listed as declared

  @test:scripts/tests/actor-reach-check.test.ts::buildReport::...except_under_an_air-gapped_deployment,_which_admits_one_value
  Scenario: An undeclared actor under an air-gapped deployment takes air-gapped
    Given an air-gapped deployment with a system actor "quiet" declaring no reach
    When the reach report is built
    Then "quiet" is listed as undeclared with effective reach "air-gapped"

  @test:scripts/tests/actor-reach-check.test.ts::buildReport::a_deployment_that_declares_nothing_leaves_every_actor_unknown
  Scenario: A deployment that declares no network leaves every actor unknown
    Given a deployment with no topology and actors "a" and "b" declaring no reach
    When the reach report is built
    Then the report's deployment is undefined
    And both actors' effective reach is "unknown"

  @test:scripts/tests/actor-reach-check.test.ts::buildReport::an_unreadable_reach_value_throws_rather_than_being_coerced
  Scenario: An unreadable reach value throws rather than being coerced
    Given an internet deployment with an actor declaring reach "air gapped"
    When the reach report is built
    Then it throws "not a network reach"

  @test:scripts/tests/actor-reach-check.test.ts::buildReport::a_missing_registry_yields_no_actors_rather_than_throwing
  Scenario: A missing actor registry yields no actors rather than throwing
    Given a layer declaration and an actor directory that does not exist
    When the reach report is built
    Then its actor list is empty

  @test:scripts/tests/actor-reach-check.test.ts::this_repository's_own_registry::is_consistent,_and_the_check_examines_something
  Scenario: This repository's own actor registry is consistent and non-empty
    Given the actor registry resolved from this repository's declared scenarios graph
    When the reach report is built
    Then the registry location is defined
    And it holds at least one actor
    And there are no conflicts
    And every actor is listed as either declared or undeclared

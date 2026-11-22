# The actor-capabilities-resolve check (scripts/lib/actor-capabilities.ts) reads
# declared capabilities over the layers the actors came from, on a throwaway checkout.
# Each Scenario names the test that executes it.
Feature: Actor capabilities resolve over the actors' layers

  @test:scripts/tests/actor-capabilities.test.ts::actor-capabilities-resolve_—_capabilities_over_the_actors'_layers::on_the_checkout_run,_a_higher_instance's_actor_claiming_that_instance's_own_capability_resolves
  Scenario: On a checkout run a higher instance's actor resolves a capability its own instance declares
    Given a checkout where cat-harness declares "git-read" and actor "admin"
    And instance "sci" declares capability "lean-toolchain" and actor "lean-mcp" claiming it and "git-read"
    And a sibling instance declares capability "sibling-only"
    When the platform's checkout actors and checkout-scope capabilities are read
    Then the actors are "admin" and "lean-mcp"
    And the capabilities include "lean-toolchain"
    And no actor capability is unresolved

  @test:scripts/tests/actor-capabilities.test.ts::actor-capabilities-resolve_—_capabilities_over_the_actors'_layers::the_platform's_registry_alone_does_not_hold_it:_the_defect,_reported_as_a_finding
  Scenario: Reading only the platform's own capability registry reports the higher layer's capability as unresolved
    Given the same checkout
    When the checkout actors are read but capabilities are read at "own" scope
    Then the capabilities are only "git-read"
    And there is one finding, on "lean-mcp"
    And its detail says it claims capability "lean-toolchain"

  @test:scripts/tests/actor-capabilities.test.ts::actor-capabilities-resolve_—_capabilities_over_the_actors'_layers::on_an_--instance_run,_the_instance's_own_capability_resolves;_a_sibling's_is_not_read
  Scenario: On an instance run the instance's own capability resolves and a sibling's is not read
    Given the same checkout
    When the actors and capabilities needed by instance "sci" are read
    Then the capabilities are exactly "git-read" and "lean-toolchain"
    And no actor capability is unresolved

  @test:scripts/tests/actor-capabilities.test.ts::actor-capabilities-resolve_—_capabilities_over_the_actors'_layers::a_capability_no_layer_declares_is_still_a_finding
  Scenario: A capability no layer declares is still a finding
    Given the same checkout plus an actor "lean-atlas" in "sci" claiming capability "nowhere"
    When the checkout actors and capabilities are resolved
    Then the only finding is "lean-atlas" claiming "nowhere"

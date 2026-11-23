# The example deployment descriptions in scenarios/deployments/, read by
# schemas/process/deployment-description.ts: each parses, places only declared actors and
# names no refused topology pair. Each Scenario names the test that executes it.
Feature: Example deployment descriptions

  @test:schemas/deployment-examples.test.ts::the_example_deployment_descriptions::the_six_#363_scenarios_are_all_there
  Scenario: The six example deployments are all present
    Given the deployment descriptions read from scenarios/deployments/
    Then their ids sorted are "developer", "private-github", "self-sovereign", "sovereign-cloud", "test-swarm" and "today"

  @test:schemas/deployment-examples.test.ts::the_example_deployment_descriptions::every_one_is_well_formed_against_the_declared_actors
  Scenario: Every example deployment is well formed against the declared actors
    Given the deployment descriptions and the actors read from scenarios/actors
    When deployment problems are computed
    Then there are none

  @test:schemas/deployment-examples.test.ts::the_example_deployment_descriptions::%s:_no_refused_topology_pair
  Scenario: No example deployment has a refused topology pair
    Given each example deployment, one row per deployment id
    When topology conflicts are computed from its topology and publication host
    Then there are none

  @test:schemas/deployment-examples.test.ts::the_example_deployment_descriptions::today_places_one_actor_twice:_cloud_sessions_and_the_owner's_workstation
  Scenario: Today places the claude actor on two hosts
    Given the "today" deployment
    When the hosts of its "claude" placements are listed
    Then they are "claude-code" then "antigravity"

  @test:schemas/deployment-examples.test.ts::the_example_deployment_descriptions::only_self-sovereign_may_hold_credentials
  Scenario: Only the self-sovereign deployment may hold credentials
    Given the example deployments
    When those with liveData "may-hold-credentials" are listed
    Then the list is exactly "self-sovereign"

  @test:schemas/deployment-examples.test.ts::the_example_deployment_descriptions::the_API_signer_cannot_be_placed_in_the_air-gapped_example
  Scenario: The attestation service cannot be placed in the self-sovereign deployment
    Given the "self-sovereign" deployment with an added "attestation-service" placement
    When deployment problems are computed against the actors
    Then the only problem kind is "exceeds-deployment"

  @test:schemas/deployment-examples.test.ts::the_example_deployment_descriptions::the_swarm's_undeclared_reach_stays_unknown
  Scenario: The test swarm's undeclared placement reach stays unknown
    Given the "test-swarm" deployment
    When the reach of each of its placements is computed
    Then every placement's reach is "unknown"

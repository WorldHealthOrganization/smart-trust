# Specifies schemas/process/deployment-description.ts (bean 23a3): the
# deployment description schema, deploymentProblems (placements that misplace
# an actor), placementReach (a placement's reach, never inherited from a
# connected deployment) and readDeployments (a folder of descriptions).
Feature: A deployment description places actors, and the checks find a placement that misplaces one

  Background:
    Given "today's deployment": id "today", on GitHub over "internet" with a hosted model, published to GitHub Pages, holding artefacts only as live data
    And it places "claude" twice (claude-code and antigravity), "ci-pipeline" on GitHub Actions with a publish-site credential named "GITHUB_TOKEN", and "owner" locally
    And the actors "claude", "owner", "ci-pipeline", and "attestation-service" whose own reach is "internet"

  @test:schemas/process/deployment-description.test.ts::the_schema::today's_deployment_parses,_with_one_actor_placed_twice
  Scenario: Today's deployment parses, with one actor placed twice
    When today's deployment is parsed with the deployment description schema
    Then it is accepted

  @test:schemas/process/deployment-description.test.ts::the_schema::a_field_nobody_declared_is_refused,_not_ignored
  Scenario: An undeclared field is refused
    Given today's deployment with an extra field "region"
    When it is parsed
    Then it is refused

  @test:schemas/process/deployment-description.test.ts::the_schema::liveData_is_required:_a_deployment_says_whether_it_may_hold_credentials
  Scenario: A deployment without liveData is refused
    Given today's deployment with liveData removed
    When it is parsed
    Then it is refused

  @test:schemas/process/deployment-description.test.ts::the_schema::a_credential_action_outside_the_closed_list_is_refused
  Scenario: A credential action outside the closed list is refused
    Given today's deployment with the ci-pipeline credential keyed "push-everything"
    When it is parsed
    Then it is refused

  @test:schemas/process/deployment-description.test.ts::the_schema::a_credential_VALUE_is_refused_on_its_shape
  Scenario: A credential value shaped like a secret is refused
    Given today's deployment with the publish-site credential set to "ghp_abc/def="
    When it is parsed
    Then it is refused

  @test:schemas/process/deployment-description.test.ts::the_schema::jurisdiction_is_four_optional_fields
  Scenario: A jurisdiction is four optional fields, and an audience outside its list is refused
    Given today's deployment as "sovereign-cloud" with a jurisdiction of publication base, audience "authenticated" and residency "in-country"
    When it is parsed
    Then it is accepted
    And a jurisdiction of all four fields, publication base, audience, retention and residency, is accepted
    And a jurisdiction of any one of the four alone is accepted
    And an empty jurisdiction, and no jurisdiction at all, are accepted
    And a jurisdiction of the four plus a fifth field "currency" is refused
    And the same with audience "everyone" is refused

  @test:schemas/process/deployment-description.test.ts::deploymentProblems::a_well-formed_description_has_none
  Scenario: A well-formed description has no problems
    When the problems of today's deployment are found
    Then there are none

  @test:schemas/process/deployment-description.test.ts::deploymentProblems::a_placement_never_declares_an_actor
  Scenario: A placement of an undeclared actor is a problem
    Given today's deployment with a placement of "sovereign-bot"
    When its problems are found
    Then the only problem is "unknown-actor" for "sovereign-bot"

  @test:schemas/process/deployment-description.test.ts::deploymentProblems::a_placement_may_not_contradict_reach_the_actor_fixes
  Scenario: A placement may not contradict the reach its actor fixes
    Given today's deployment with "attestation-service" placed "air-gapped"
    When its problems are found
    Then the only problem is "contradicts-actor"

  @test:schemas/process/deployment-description.test.ts::deploymentProblems::a_placement_reaches_no_further_than_its_deployment
  Scenario: A placement reaches no further than its deployment
    Given today's deployment made "egress-restricted", with only "claude" placed on "internet"
    When its problems are found
    Then the only problem is "exceeds-deployment"

  @test:schemas/process/deployment-description.test.ts::deploymentProblems::an_air-gapped_participant_in_a_connected_deployment_is_the_normal_case
  Scenario: An air-gapped participant in a connected deployment is no problem
    Given today's deployment with only "owner" placed "air-gapped"
    When its problems are found
    Then there are none

  @test:schemas/process/deployment-description.test.ts::deploymentProblems::the_actor's_own_reach_counts_against_the_deployment_too
  Scenario: The actor's own reach counts against the deployment
    Given today's deployment made "air-gapped" with an open-weight local model, with only "attestation-service" placed and no placement reach
    When its problems are found
    Then the only problem is "exceeds-deployment"

  @test:schemas/process/deployment-description.test.ts::deploymentProblems::ids_are_unique_and_match_the_file_name
  Scenario: Ids are unique and match the file name
    Given two copies of today's deployment, at deployments/today.json and deployments/other.json
    When their problems are found
    Then they are "id-not-filename" then "duplicate-id"

  @test:schemas/process/deployment-description.test.ts::placementReach_is_never_inherited::an_undeclared_placement_in_a_connected_deployment_is_unknown
  Scenario: An undeclared placement in a connected deployment has unknown reach
    When the reach of a "claude" placement with no reach is read in today's deployment
    Then it is the unknown reach

  @test:schemas/process/deployment-description.test.ts::placementReach_is_never_inherited::the_actor's_own_fact_is_used_when_the_placement_says_nothing
  Scenario: The actor's own reach is used when the placement says nothing
    When the reach of an "attestation-service" placement with no reach is read with that actor's facts
    Then it is "internet"

  @test:schemas/process/deployment-description.test.ts::placementReach_is_never_inherited::an_air-gapped_deployment_determines_every_placement
  Scenario: An air-gapped deployment determines every placement
    Given today's deployment with its network "air-gapped"
    When the reach of a "claude" placement with no reach is read
    Then it is "air-gapped"

  @test:schemas/process/deployment-description.test.ts::readDeployments::reads_a_folder,_and_names_the_file_that_does_not_parse
  Scenario: A folder of descriptions is read, and a file that does not parse is named
    Given a temporary folder holding today.json
    When the folder is read
    Then the ids read are "today", with no problems
    And after adding broken.json with liveData "everything", reading throws naming broken.json as not a deployment description

  @test:schemas/process/deployment-description.test.ts::readDeployments::an_absent_folder_is_no_descriptions
  Scenario: An absent folder holds no descriptions
    When a folder that does not exist is read
    Then no descriptions are returned

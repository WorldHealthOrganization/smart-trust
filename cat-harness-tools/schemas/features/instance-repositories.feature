# schemas/kg/instance-repositories.ts maps each instance to its owner/repo repository, and the layer
# declaration schema constrains repository and livesAt. Each Scenario names the test that executes it.
Feature: Instance repositories

  @test:schemas/instance-repositories.test.ts::instance_references_are_owner/repo_and_resolve_(bean_6rmv,_phase_2)::there_are_references_to_check
  Scenario: A composed checkout has instance references to check
    # Skipped: when the checkout stands alone and composes no other layers
    Given the voice and layer declarations committed in a composed checkout's corpus
    When every "instance" field in them is collected
    Then more than 100 references are found

  @test:schemas/instance-repositories.test.ts::instance_references_are_owner/repo_and_resolve_(bean_6rmv,_phase_2)::every_one_resolves_through_the_derived_map,_by_owner/repo,_or_says_where_it_is_held
  Scenario: Every instance reference resolves by owner/repo or says where it is held
    # Skipped: when the checkout stands alone and composes no other layers
    Given the instance references collected from a composed checkout's declarations
    And the repository map derived by instanceRepositories
    When the references that are neither in the map nor carry a url are listed
    Then that list is empty

  @test:schemas/instance-repositories.test.ts::instance_repositories_—_the_schema_and_the_refusals::repository_must_be_owner/name;_livesAt_path_may_not_climb
  Scenario: A repository must be owner/name and a livesAt path may not climb
    Given a minimal layer declaration
    Then a repository of "x" is refused
    And a livesAt path of "../x" is refused
    And repository "a/x" with livesAt repository "a/b" and path "x" parses

  @test:schemas/instance-repositories.test.ts::instance_repositories_—_the_schema_and_the_refusals::two_instances_claiming_one_repository_is_refused
  Scenario: Two instances claiming one repository are refused
    Given two instance declarations "one" and "two" both naming repository "o/same"
    When instanceRepositories reads their directory
    Then it throws saying "o/same is declared by both"

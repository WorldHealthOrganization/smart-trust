# Specifies placement PR1 against the live checkout: the content-type skill
# packages sit in the instances that own them, and the role edges naming
# their skills come from those instances.
Feature: Content-type skill packages are held by their owners, and role edges point down

  @test:test/coordinator/placement-pr1-content-up.test.ts::placement_PR1:_content-type_packages_are_held_by_their_owner::each_moved_package_sits_in_a_concern_group_of_its_owning_instance
  Scenario: Each moved package sits in a concern group of its owning instance
    Given the nine moved packages and the instance-relative directory each should be in
    When each owner's skills directory is scanned for packages
    Then each package is found at its expected directory
    And each sits in a concern group

  @test:test/coordinator/placement-pr1-content-up.test.ts::placement_PR1:_content-type_packages_are_held_by_their_owner::the_harness's_own_skills_directory_holds_none_of_them
  Scenario: cat-harness's own skills directory holds none of the moved packages
    Given cat-harness's skills directory
    When its packages are listed
    Then none of the moved packages is among them

  @test:test/coordinator/placement-pr1-content-up.test.ts::placement_PR1:_content-type_packages_are_held_by_their_owner::the_harness_alone_knows_none_of_their_skills;_the_checkout_knows_all_of_them
  Scenario: cat-harness alone knows none of the sampled skills, and the checkout knows them all
    Given one sampled skill from each moved package
    When the known skills of cat-harness are read in instance scope and in checkout scope
    Then none is known in instance scope
    And all are known in checkout scope

  @test:test/coordinator/placement-pr1-content-up.test.ts::placement_PR1:_role_edges_point_down::cat-harness/scenarios/roles.json_names_no_skill_a_moved_package_holds
  Scenario: cat-harness's roles.json names no skill a moved package holds
    Given the skills listed by the moved packages' manifests
    When cat-harness/scenarios/roles.json is read
    Then the manifests list more than 60 skills
    And no role in cat-harness's roles.json names one of them

  @test:test/coordinator/placement-pr1-content-up.test.ts::placement_PR1:_role_edges_point_down::the_checkout's_role_graph_still_carries_each_edge,_through_the_owner's_extension
  Scenario: The checkout's role graph still carries each edge, added by the owning instance's extension
    Given the role graph of the checkout
    When the skills of sample roles are read
    Then lean-authoring-agent has formalizer
    And reviewer has document-intake
    And build-pipeline has fhir-validation
    And business-analyst has l2-dak-authoring
    And qc-reviewer has quality-control
    Given the harness's own role graph, overlaid with the checkout's extensions
    Then the harness's own graph declares no lean-authoring-agent role, because its owning instance declares that role
    And for build-pipeline → fhir-validation and qc-reviewer → quality-control the harness's own graph lacks the edge
    And the only extension recorded as adding it is the one of the instance that holds the skill's package

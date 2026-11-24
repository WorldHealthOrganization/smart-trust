# Specifies instanceRepositories, locationMismatch, resolveInstance and
# repositoryNamespaces (schemas/kg/instance-repositories.ts) over the
# checkout's staged instances.
Feature: Every instance in the checkout declares its repository, home and namespace

  @test:test/coordinator/instance-repositories-checkout.test.ts::instance_repositories_—_this_checkout_(bean_6rmv)::every_instance_declares_the_repository_it_is
  Scenario: Every instance declares its repository
    Given the instance repositories of the checkout
    When the undeclared ones are collected
    Then there are none
    And there is more than one entry

  @test:test/coordinator/instance-repositories-checkout.test.ts::instance_repositories_—_this_checkout_(bean_6rmv)::livesAt_matches_where_each_instance_actually_sits
  Scenario: livesAt matches where each instance sits
    Given the instance repositories of the checkout
    When each entry's location is compared with its livesAt
    Then there is no mismatch

  @test:test/coordinator/instance-repositories-checkout.test.ts::instance_repositories_—_this_checkout_(bean_6rmv)::every_livesAt_names_the_instance's_OWN_repository_as_its_home
  Scenario: Every livesAt names the instance's own repository
    Given the instance repositories of the checkout
    When the entries are read
    Then no entry sits at the checkout root
    And at least one entry declares livesAt
    And every livesAt names that entry's own repository

  @test:test/coordinator/instance-repositories-checkout.test.ts::instance_repositories_—_this_checkout_(bean_6rmv)::a_reference_resolves_by_owner/repo_and,_transitionally,_by_name
  Scenario: A reference resolves by owner/repo and by name
    Given the entry for cat-harness
    When it is resolved by its repository and by the name "cat-harness"
    Then resolving by repository gives its root
    And resolving by name gives its repository
    And "nobody/nothing" resolves to nothing

  @test:test/coordinator/instance-repositories-checkout.test.ts::the_owner/repo_→_namespace_map_is_derived_and_agrees_with_the_list_(bean_6rmv,_phase_3)::every_declared_instance_has_a_namespace
  Scenario: Every declared instance has a namespace
    Given the checkout's repository namespaces
    When they are counted
    Then there are as many as instance repository entries

  @test:test/coordinator/instance-repositories-checkout.test.ts::the_owner/repo_→_namespace_map_is_derived_and_agrees_with_the_list_(bean_6rmv,_phase_3)::own-namespaces_%s_is_what_%s's_declaration_derives
  Scenario: Each listed own namespace is what its repository's declaration derives
    Given the listed codes cat-bootstrap for litlfred/bootstrap and cat-harness for litlfred/cat-harness, one test per pair
    When the namespace derived for the repository is read
    Then it is the own namespace of the code

  @test:test/coordinator/instance-repositories-checkout.test.ts::the_owner/repo_→_namespace_map_is_derived_and_agrees_with_the_list_(bean_6rmv,_phase_3)::the_content_layer's_namespace_is_what_its_own_declaration_derives
  Scenario: The content layer's namespace is what its own declaration derives
    Given the content-layer instance
    When the namespace derived for its repository is read
    Then the instance is defined
    And the namespace is the content layer's own namespace

# schemas/kg/cat-harness and schemas/kg/harness-config decide which directory an instance's sibling
# layers are looked up in, resolve `needs` names into the overlay, and report names that resolve to nothing.
# Each Scenario names the test that executes it.
Feature: Sibling scope and `needs` resolution for harness instances

  @test:schemas/overlay-resolution.test.ts::siblingScopeFor_—_which_directory_a_sibling_is_looked_up_in::an_instance_root_that_CONTAINS_other_instances_is_its_own_scope
  Scenario: An instance root that contains other instances is its own sibling scope
    Given a temporary tree with an "alpha" instance and a "container" instance declared at the tree root
    When the sibling scope of the tree root is found
    Then it is the tree root itself
    And the repo root for the tree root is not the tree root

  @test:schemas/overlay-resolution.test.ts::siblingScopeFor_—_which_directory_a_sibling_is_looked_up_in::the_ROOT_instance_of_a_checkout_never_looks_outside_it_(owner,_2026-10-11,_bean_68k7)
  Scenario: The root instance of a checkout never looks outside it
    Given a temporary tree holding "stray" and "repo" instances, where "repo" has its own ".git"
    When the sibling scope of "repo" is found
    Then it is "repo" itself
    And once "repo"'s ".git" is removed its sibling scope is the tree root

  @test:schemas/overlay-resolution.test.ts::siblingScopeFor_—_which_directory_a_sibling_is_looked_up_in::a_declared_SUBMODULE_with_its_own_`.git`_is_still_nested_—_it_looks_in_its_parent
  Scenario: A declared submodule with its own .git still looks in its parent
    Given a temporary tree with a ".git", a ".gitmodules" declaring submodule "sub", and "sub" with its own ".git"
    When the sibling scope of "sub" is found
    Then it is the tree root

  @test:schemas/overlay-resolution.test.ts::siblingScopeFor_—_which_directory_a_sibling_is_looked_up_in::a_LEAF_instance_resolves_siblings_one_level_up,_as_`repoRootFor`_assumes
  Scenario: A leaf instance resolves siblings one level up
    Given a temporary tree with "alpha" and "beta" instances
    When the sibling scope of "alpha" is found
    Then it is the tree root

  @test:schemas/overlay-resolution.test.ts::siblingScopeFor_—_which_directory_a_sibling_is_looked_up_in::the_two_agree_for_every_nested_instance_—_this_does_not_replace_`repoRootFor`
  Scenario: Sibling scope agrees with the repo root for a nested instance
    # Gap: the title claims agreement for every nested instance; one leaf is checked.
    Given a temporary tree with an "alpha" instance
    When the sibling scope and the repo root of "alpha" are found
    Then they are the same directory

  @test:schemas/overlay-resolution.test.ts::dependenciesFromNeeds_resolves_siblings_of_a_ROOT-declared_instance::a_`needs`_name_resolves_from_an_instance_declared_at_the_containing_root
  Scenario: A needs name resolves from an instance declared at the containing root
    Given a temporary tree with a "base" instance and a "top" instance declared at the tree root that needs "base"
    When the dependencies are derived from the root's needs
    Then nothing is unresolved
    And the dependencies are "base"

  @test:schemas/overlay-resolution.test.ts::dependenciesFromNeeds_resolves_siblings_of_a_ROOT-declared_instance::and_the_overlay_it_feeds_reaches_that_dependency's_skills
  Scenario: The overlay of a root-declared instance reaches its dependency's skills
    Given a "base" instance declaring a "skills/" directory that exists, and a root-declared "top" that needs "base"
    When the skill directories for the tree root are resolved
    Then they include "base/skills"

  @test:schemas/overlay-resolution.test.ts::an_unresolvable_`needs`_name_is_REPORTED,_never_dropped::a_name_matching_no_instance_becomes_a_`missing`_problem
  Scenario: A needs name matching no instance becomes a missing problem
    Given a "top" instance that needs "base" and "nowhere", where only "base" exists
    When the instance graph of "top" is resolved
    Then there is exactly one "missing" problem, naming "nowhere"
    And the resolved order is "base"

  @test:schemas/overlay-resolution.test.ts::an_unresolvable_`needs`_name_is_REPORTED,_never_dropped::a_fully_resolvable_tree_raises_nothing_—_falsified_in_both_directions
  Scenario: A fully resolvable tree raises no problems
    Given a "top" instance that needs "base", which exists
    When the instance graph of "top" is resolved
    Then there are no problems

  @test:schemas/overlay-resolution.test.ts::an_unresolvable_`needs`_name_is_REPORTED,_never_dropped::a_name_the_CONFIG_already_authors_is_not_reported_as_missing
  Scenario: A needs name the config already authors is not reported as missing
    Given a "top" instance that needs "elsewhere", and a "top.config.json" authoring dependency "elsewhere" at "../base"
    When the instance graph of "top" is resolved
    Then there are no "missing" problems

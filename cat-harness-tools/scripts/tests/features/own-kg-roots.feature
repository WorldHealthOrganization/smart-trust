# ownKgRoots in scripts/known-skills.ts lists the declared knowledge-graph roots a layer's audit
# may write sidecars for: those its declaration names (plus the skills/ default), never another
# instance's or the layer root itself. Each Scenario names the test that executes it.
Feature: A layer's own knowledge-graph roots

  @test:scripts/tests/own-kg-roots.test.ts::the_walk_follows_the_DECLARATION,_not_the_literal_`skills/`::a_declared_topical_directory_is_reachable
  Scenario: A declared topical directory is a root
    Given a layer declaring "skills" and "methodologies/crdm" as cat-harness graphs
    When its own knowledge-graph roots are listed
    Then they include "methodologies/crdm"

  @test:scripts/tests/own-kg-roots.test.ts::the_walk_follows_the_DECLARATION,_not_the_literal_`skills/`::THE_OTHER_DIRECTION:_undeclaring_it_removes_it,_though_it_is_still_on_disk
  Scenario: An undeclared directory on disk is not a root
    Given a layer declaring only "skills"
    And a "methodologies/crdm" directory exists on disk undeclared
    When its own knowledge-graph roots are listed
    Then they do not include "methodologies/crdm"

  @test:scripts/tests/own-kg-roots.test.ts::the_walk_follows_the_DECLARATION,_not_the_literal_`skills/`::`skills/`_is_a_DEFAULT,_so_it_survives_being_undeclared
  Scenario: skills/ is a default root even when undeclared
    Given a layer declaring only "methodologies/raci"
    And a "skills" directory exists on disk
    When its own knowledge-graph roots are listed
    Then they are exactly "methodologies/raci" and "skills"

  @test:scripts/tests/own-kg-roots.test.ts::the_walk_follows_the_DECLARATION,_not_the_literal_`skills/`::and_a_root_is_never_listed_twice,_however_many_ways_it_arrives
  Scenario: A root declared and also defaulted is listed once
    Given a layer declaring "skills" explicitly
    When its own knowledge-graph roots are listed
    Then they are exactly one "skills"

  @test:scripts/tests/own-kg-roots.test.ts::another_instance's_roots_are_excluded_—_not_this_audit's_to_write::a_repository-scoped_sibling_directory_is_dropped
  Scenario: A repository-scoped sibling directory is dropped
    Given a layer declaring "skills" and a repository-scoped sibling "other/skills" outside the layer
    When its own knowledge-graph roots are listed
    Then they are exactly "skills"
    And no root's path relative to the layer starts with ".."

  @test:scripts/tests/own-kg-roots.test.ts::another_instance's_roots_are_excluded_—_not_this_audit's_to_write::THE_REASON_IT_MATTERS:_every_kept_root_mirrors_INSIDE_the_results_tree
  Scenario: Every kept root mirrors inside the results tree
    Given a layer declaring "skills" and "src/skills" and a repository-scoped sibling "other/skills"
    When its own knowledge-graph roots are listed
    Then each root, mirrored under "test/results/kg-qa", stays inside that tree

  @test:scripts/tests/own-kg-roots.test.ts::another_instance's_roots_are_excluded_—_not_this_audit's_to_write::the_instance_root_itself_is_not_a_root_of_its_own_graph
  Scenario: The layer root itself is not a root of its own graph, even when declared
    Given a layer declaring "skills/" and its own root "./" as cat-harness graphs
    And the declared roots include the layer root itself
    When its own knowledge-graph roots are listed
    Then the layer root is not among them
    And they are exactly "skills"

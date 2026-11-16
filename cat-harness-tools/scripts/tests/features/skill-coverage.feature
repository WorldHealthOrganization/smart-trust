# Every skill this layer can resolve is a graph node and a published page;
# the invariant is asserted, not a count. Each Scenario names the test that
# executes it.
Feature: Skill coverage

  @test:scripts/tests/skill-coverage.test.ts::skill_coverage::every_skill_package_on_disk_is_discovered,_not_listed
  Scenario: Every skill package on disk is discovered
    When the skill directories under skills/ are discovered
    Then they equal the packages on disk holding a skill .md
    And there is at least one

  @test:scripts/tests/skill-coverage.test.ts::skill_coverage::every_resolvable_skill_is_a_node_in_the_exported_graph
  Scenario: Every resolvable skill is a node of the exported graph
    Given the exported graph
    Then the only known skill excluded from publishing is fsh-guts
    And every published skill of this layer is a Skill node
    And every Skill node is a known published skill

  @test:scripts/tests/skill-coverage.test.ts::skill_coverage::every_skill_in_a_`skills/`_package_has_a_published_reference_page
  Scenario: Every skill in a skills/ package has a published page
    Given the skill reference pages have been built
    Then every skill .md in every package has a page of the same name

  @test:scripts/tests/skill-coverage.test.ts::skill_coverage::a_skill_named_by_a_BPMN_diagram_resolves_and_is_published
  Scenario: A skill named by a diagram resolves and is published
    Given the skill reference pages have been built
    When skill refs are read from every BPMN and DMN under processes/
    Then there is at least one ref
    And none dangles and each has a published page, plain or local-prefixed

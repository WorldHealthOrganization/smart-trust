# `sweepFamilies` in `scripts/check-kind-validators.ts` reads a directory declared
# from within as its own kind's, while a deeper directory of another kind keeps its
# nodes. Each Scenario names the test that executes it.
Feature: Kind validators and nested directories

  @test:scripts/tests/kind-validators-nested-dirs.test.ts::check:kind-validators_reads_a_from-within_directory_as_its_own_kind's::the_workflow_instance_under_beans/workflows/_is_a_workflow-state_node
  Scenario: A workflow instance under beans/workflows/ is a workflow-state node
    Given an instance declaring "beans/" as beans
    And "beans/beans.json" declaring "workflows" as workflow-state
    And one workflow instance node in "beans/workflows/"
    When the families are swept
    Then workflow-state counts 1 node
    And beans also counts 1 node

  @test:scripts/tests/kind-validators-nested-dirs.test.ts::a_deeper_directory_of_another_kind_still_takes_its_nodes_(folio-assistant#2529)::the_enclosing_directory's_kind_does_not_read_it
  Scenario: The enclosing directory's kind does not read a deeper directory of another kind
    Given an instance declaring "beans/" as beans and "beans/marks" as sweep-marks
    And one sweep mark node in "beans/marks"
    When the families are swept
    Then sweep-marks counts 1 node
    And beans counts 0 nodes

  @test:scripts/tests/kind-validators-nested-dirs.test.ts::a_family_declared_with_{}_in_nodeSchemas_is_routed_as_unvalidated,_not_unmapped::both_figure-data_families_route_to_library_as_unvalidated_with_zero_unmapped
  Scenario: Families declared with an empty schema route to library as unvalidated
    Given a library entry holding one "diig-phases-figure/v1" and one "smart-guidelines-approach-figure/v1" figure-data node
    And a registry whose library kind declares both families with an empty schema
    When the families are swept with that registry
    Then library has no unmapped family
    And each family counts 1 node, 0 checked, 0 parsed, state "unvalidated"

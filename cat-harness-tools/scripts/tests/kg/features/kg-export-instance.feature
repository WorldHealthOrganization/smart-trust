# What scripts/tests/kg/kg-export-instance.test.ts covers: collectInstanceNodes in scripts/kg-export.ts exports a layer
# other than this one through the same generic code path, and names what it did not look for.
# Each Scenario names the test that executes it.
Feature: The exporter serves a layer that is not this one

  @test:scripts/tests/kg/kg-export-instance.test.ts::a_minimal_instance_exports_through_the_same_code_path::bootstrap_contributes_its_declared_skills
  Scenario: Bootstrap contributes its declared skills
    Given the bootstrap layer
    When its nodes are collected
    Then there is at least one Skill node

  @test:scripts/tests/kg/kg-export-instance.test.ts::a_minimal_instance_exports_through_the_same_code_path::and_its_declaration,_without_borrowing_this_repository's
  Scenario: Bootstrap exports its own declaration, smaller than the root's
    Given the bootstrap layer and the root layer
    When each one's nodes are collected
    Then bootstrap has at least one Subgraph node
    And the root has more Subgraph nodes than bootstrap

  @test:scripts/tests/kg/kg-export-instance.test.ts::a_minimal_instance_exports_through_the_same_code_path::the_root_instance_still_exports_everything_it_did
  Scenario: The root layer still exports every kind it did
    Given the root layer
    When its nodes are collected
    Then Skill, Process, SequenceFlow, Role and ProcessNode nodes are each present

  @test:scripts/tests/kg/kg-export-instance.test.ts::what_was_not_looked_for_is_not_reported_as_clean::instance-bound_collectors_are_named_as_omitted,_not_silently_skipped
  Scenario: Instance-bound collectors are named as omitted
    Given the bootstrap layer
    When its nodes are collected
    Then the omitted collectors are exactly "packages" and "registry"

  @test:scripts/tests/kg/kg-export-instance.test.ts::what_was_not_looked_for_is_not_reported_as_clean::a_layer's_own_schema_modules_are_Schema_nodes_in_its_export
  Scenario: A layer's own schema modules are Schema nodes in its export
    Given a temporary layer declaring "schemas/" with record.ts tagged "@graphNode schema" and helper.ts tagged "@graphNode none"
    When its nodes are collected
    Then the only Schema node is "record" from "schemas/record.ts" with summary "A record."

  @test:scripts/tests/kg/kg-export-instance.test.ts::what_was_not_looked_for_is_not_reported_as_clean::a_declared_directory_holding_no_diagrams_is_a_NOTE,_not_a_crash_and_not_a_problem
  Scenario: A declared directory holding no diagrams is a note, not a problem
    Given a temporary layer declaring an existing "skills/" holding one skill and no diagram
    When its nodes are collected
    Then exactly one note says no directory containing .bpmn files was found
    And there are no problems

  @test:scripts/tests/kg/kg-export-instance.test.ts::what_was_not_looked_for_is_not_reported_as_clean::an_instance_with_no_declaration_at_all_does_not_throw
  Scenario: A layer with no declaration does not throw
    Given an empty temporary directory
    When its nodes are collected
    Then GraphTypology nodes still come back
    And there are no Skill nodes

  @test:scripts/tests/kg/kg-export-instance.test.ts::what_was_not_looked_for_is_not_reported_as_clean::a_declared-but-ABSENT_directory_is_reported
  Scenario: A declared but absent directory is reported
    Given a temporary layer declaring "skills/" which does not exist
    When its nodes are collected
    Then exactly one problem says the declared knowledge-graph directory is absent

  @test:scripts/tests/kg/kg-export-instance.test.ts::the_scope_table_says_what_it_means::every_collector_is_classified_exactly_once
  Scenario: Every collector is classified exactly once
    Given the collector scope table
    When its generic, universal and instance-bound lists are joined
    Then no collector appears twice

  @test:scripts/tests/kg/kg-export-instance.test.ts::the_scope_table_says_what_it_means::`tools`_is_generic:_discovery_reads_each_instance's_declared_graph
  Scenario: The tools collector is generic
    Given the collector scope table
    When it is read
    Then "tools" is generic and not instance-bound

  @test:scripts/tests/kg/kg-export-instance.test.ts::the_scope_table_says_what_it_means::`schemas`_is_generic:_`collectSchemas`_reads_the_exported_layer's_declared_graph
  Scenario: The schemas collector is generic
    Given the collector scope table
    When it is read
    Then "schemas" is generic and not instance-bound

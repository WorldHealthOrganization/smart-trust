# What scripts/tests/kg/instance-graph-isolation.test.ts covers: collectInstanceNodes in scripts/kg-export.ts
# collects only the nodes a layer declares, so one layer's graph never carries another's process.
# Each Scenario names the test that executes it.
Feature: A layer's graph carries only its own declared nodes

  @test:scripts/tests/kg/instance-graph-isolation.test.ts::a_second_instance_in_the_tree_stays_out_of_the_first's_graph::the_root_instance's_nodes_include_none_of_bootstrap's_process
  Scenario: The root instance's nodes include none of bootstrap's process
    Given the root harness instance
    When its nodes are collected
    Then no node id contains "Process_InitializeHarness"

  @test:scripts/tests/kg/instance-graph-isolation.test.ts::a_second_instance_in_the_tree_stays_out_of_the_first's_graph::and_bootstrap's_own_graph_DOES_carry_it
  Scenario: Bootstrap's own graph does carry its process
    Given the bootstrap instance
    When its nodes are collected
    Then some node id contains "Process_InitializeHarness"

  @test:scripts/tests/kg/instance-graph-isolation.test.ts::a_second_instance_in_the_tree_stays_out_of_the_first's_graph::the_root_instance_keeps_every_process_it_declares
  Scenario: The root instance keeps the processes it declares
    Given the root harness instance
    When its nodes are collected
    Then more than 10 nodes have a type ending in "Process"

  @test:scripts/tests/kg/instance-graph-isolation.test.ts::discovery_reads_the_declaration_rather_than_the_tree::an_undeclared_directory_holding_a_.bpmn_is_NOT_collected
  Scenario: An undeclared directory holding a .bpmn is not collected
    Given a temporary layer declaring only "skills/" and holding "stray/x.bpmn"
    When its nodes are collected
    Then no Process node is collected
    And a note mentions "bpmn"
    And no problem mentions "bpmn"

  @test:scripts/tests/kg/instance-graph-isolation.test.ts::discovery_reads_the_declaration_rather_than_the_tree::a_DECLARED_directory_holding_a_.bpmn_directly_is_collected
  Scenario: A declared directory holding a .bpmn directly is looked in
    # Gap: only checks no "no directory containing" problem is raised, not that a Process node is collected
    Given a temporary layer declaring "wf/" which holds "x.bpmn" at its root
    When its nodes are collected
    Then no problem says "no directory containing"

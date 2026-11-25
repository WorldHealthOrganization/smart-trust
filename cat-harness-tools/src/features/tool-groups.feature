# src/tool-groups.ts derives the server's tool groups from the harness's Tool nodes and registers each
# group's in-process module, found in the declaring layer or its one implementer. Each Scenario names the test that executes it.
Feature: Tool groups are derived from Tool nodes

  @test:src/tool-groups.test.ts::tool_groups_derived_from_Tool_nodes_(zmdo)::one_group_per_module,_and_only_for_nodes_served_in-process_over_MCP
  Scenario: There is one group per module, and only for nodes served in-process over MCP
    Given the harness's Tool nodes
    When the tool groups are derived from them
    Then no module has two groups
    And the groups' modules are exactly the in-process modules of the nodes that declare an MCP tool

  @test:src/tool-groups.test.ts::tool_groups_derived_from_Tool_nodes_(zmdo)::each_module_registers_exactly_the_MCP_names_its_Tool_nodes_declare
  Scenario: Each module registers exactly the MCP names its Tool nodes declare
    Given each tool group derived from the harness's Tool nodes
    When the group is registered on a server that records names
    Then the group is reported as "registered"
    And the names registered are exactly the MCP tool names the nodes for that module declare

  @test:src/tool-groups.test.ts::tool_groups_derived_from_Tool_nodes_(zmdo)::a_module_with_no_register…_export_is_reported_as_failed,_not_guessed
  Scenario: A module with no register export is reported as failed, not guessed
    Given a group whose module is "src/no-content-adapter.ts"
    When the group is registered
    Then its state is "failed"
    And the detail says it "exports no register"

  @test:src/tool-groups.test.ts::this_layer's_own_Tool_nodes_are_served_from_this_layer::it_declares_bpmn-engine,_and_no_in-process_module_climbs_out_of_the_layer
  Scenario: This layer declares bpmn-engine, and no in-process module climbs out of the layer
    Given the Tool nodes this layer declares
    Then one of them has the id "bpmn-engine"
    And no node's in-process module starts with "../" or "/"

  @test:src/tool-groups.test.ts::this_layer's_own_Tool_nodes_are_served_from_this_layer::each_group_registers_exactly_the_names_its_nodes_declare,_a_family_by_prefix
  Scenario: Each of this layer's groups registers exactly the names its nodes declare, a family by prefix
    Given the tool groups derived from this layer's Tool nodes for "cat-harness-tools"
    Then there is at least one group
    And when each is registered on a server that records names it is reported as "registered"
    And every registered name is a declared name or falls under a declared family ending in "*"
    And every exactly declared name is registered
    And every declared family has at least one registered name

  @test:src/tool-groups.test.ts::a_declared_module_resolves_through_the_implementing_instance_(70lx)::a_module_the_declarer_no_longer_holds_is_loaded_from_the_implementer
  Scenario: A module the declarer no longer holds is loaded from the implementer
    Given a checkout where "base" declares the module "src/tools/x.ts" and "impl" needs "base"
    And only "impl" holds the module, registering "from_impl"
    When the group is registered from "base"
    Then it is reported as "registered"
    And the only name registered is "from_impl"

  @test:src/tool-groups.test.ts::a_declared_module_resolves_through_the_implementing_instance_(70lx)::the_declarer's_own_copy_wins,_so_a_batch_that_has_not_moved_yet_is_unchanged
  Scenario: The declarer's own copy wins, so a batch that has not moved yet is unchanged
    Given a checkout where both "base" and its implementer "impl" hold the module "src/tools/x.ts"
    When the group is registered from "base"
    Then the only name registered is "from_base"

  @test:src/tool-groups.test.ts::a_declared_module_resolves_through_the_implementing_instance_(70lx)::two_implementers_holding_it_is_a_FAILURE_naming_both,_never_the_first_by_order
  Scenario: Two implementers holding the module is a failure naming both, never the first by order
    Given a checkout where "impl" and "twin" both need "base" and both hold the module "src/tools/x.ts"
    When the group is registered from "base"
    Then its state is "failed"
    And the detail names both "impl" and "twin"
    And no name is registered

  @test:src/tool-groups.test.ts::a_declared_module_resolves_through_the_implementing_instance_(70lx)::held_by_nobody_is_still_ABSENT,_reported,_not_failed
  Scenario: A module held by nobody is absent, reported, not failed
    Given a checkout where no layer holds the module "src/tools/x.ts"
    When the group is registered from "base"
    Then its state is "absent"

# The asset-role table in schemas/kg/cat-harness.ts says which layer each asset role holds and how it
# is delivered; scripts/check-asset-roles.ts gates the declarations against it. Each Scenario names the test that executes it.
Feature: Asset roles, their layer and their delivery

  @test:scripts/tests/asset-roles.test.ts::the_layer_both_required_roles_hold::`instance-readme`_and_`agent-instructions`_declare_`context`
  Scenario: The instance README and agent instructions roles hold the context layer
    When the layer of "instance-readme" and of "agent-instructions" is read
    Then both are "context"

  @test:scripts/tests/asset-roles.test.ts::the_layer_both_required_roles_hold::so_no_running_process_may_write_either
  Scenario: No running process may write either required role
    When each required asset role is asked whether a process may write it
    Then each answer is false

  @test:scripts/tests/asset-roles.test.ts::the_layer_both_required_roles_hold::an_ungoverned_role_is_`undefined`,_not_`false`_—_the_third_state
  Scenario: An ungoverned role answers undefined rather than false
    Given the role "bootstrap-initialization", which this layer does not govern
    When its layer, its process writability and its purpose are read
    Then each is undefined

  @test:scripts/tests/asset-roles.test.ts::the_layer_both_required_roles_hold::assets_and_graphs_share_ONE_rule_about_what_`context`_permits
  Scenario: Assets and graphs share one rule for what a layer permits
    Then the "context" layer is not writable and the "state" layer is
    And whether a process may write the memory graph equals whether the memory graph's layer is writable
    And for each required asset role, whether a process may write it equals whether its layer is writable

  @test:scripts/tests/asset-roles.test.ts::the_layer_both_required_roles_hold::both_required_roles_hold_the_same_layer_agent_memory_does
  Scenario: Both required roles hold the same layer as agent memory
    When the layer of each required asset role is read
    Then each equals the layer of the memory graph

  @test:scripts/tests/asset-roles.test.ts::the_delivery_path_—_read_as_a_file,_with_no_injection_budget::both_required_roles_declare_`file`
  Scenario: Both required roles are delivered as files
    When the delivery of each required asset role is read
    Then each is "file"

  @test:scripts/tests/asset-roles.test.ts::the_delivery_path_—_read_as_a_file,_with_no_injection_budget::this_checkout's_longest_declared_`AGENTS.md`_is_far_past_the_injection_budget
  Scenario: The longest declared agent instructions file is past the injection budget
    Given every instance declared in this checkout
    When the longest file declared in the agent instructions role is found
    Then there is one
    And it is longer than 200 lines
    And the agent instructions role is delivered as a file

  @test:scripts/tests/asset-roles.test.ts::the_delivery_path_—_read_as_a_file,_with_no_injection_budget::and_so_is_the_longest_declared_README
  Scenario: The longest declared README is past the injection budget
    Given every instance declared in this checkout
    When the longest file declared in the instance README role is found
    Then there is one
    And it is longer than 200 lines

  @test:scripts/tests/asset-roles.test.ts::one_table,_and_the_keys_an_asset_may_not_restate::every_governed_role_decides_all_three_fields
  Scenario: Every governed role decides its purpose, layer and delivery
    When each role in the asset-role table is read
    Then its purpose is a non-empty string
    And its layer is one of "content", "context", "state" or "derived"
    And its delivery is "file" or "injected"

  @test:scripts/tests/asset-roles.test.ts::one_table,_and_the_keys_an_asset_may_not_restate::the_forbidden_keys_are_exactly_the_role's_own_fields
  Scenario: The keys an asset may not restate are exactly a role's own fields
    When the role-owned asset keys are read
    Then sorted they equal the sorted field names of the instance README role's definition

  @test:scripts/tests/asset-roles.test.ts::one_table,_and_the_keys_an_asset_may_not_restate::a_stray_key_on_an_asset_is_reported,_with_the_instance_and_the_asset
  Scenario: A stray role key on an asset is reported with the instance and the asset
    Given a declaration "probe" whose readme asset restates "layer" and whose agents asset does not
    When stray asset role keys are found under that root
    Then the only finding is the root, asset "readme" and key "layer"

  @test:scripts/tests/asset-roles.test.ts::one_table,_and_the_keys_an_asset_may_not_restate::the_report_names_the_asset,_because_'some_instance'_is_not_actionable
  Scenario: The report names the instance, the asset and the stray key
    Given a stray finding for "/x/who-iris", asset "readme", key "purpose"
    When the report is formatted
    Then it contains "/x/who-iris", "readme" and "purpose"

  @test:scripts/tests/asset-roles.test.ts::one_table,_and_the_keys_an_asset_may_not_restate::zero_declarations_read_is_NOT_a_pass
  Scenario: Reading zero declarations is not a pass
    Given a result with no findings and zero instances read
    Then it is not clean
    And its report contains "NOTHING WAS EXAMINED"

  @test:scripts/tests/asset-roles.test.ts::one_table,_and_the_keys_an_asset_may_not_restate::the_counts_print_even_when_everything_passes
  Scenario: The counts print even when everything passes
    Given a result with no findings and 12 instances read
    When the report is formatted
    Then it contains "12 declaration(s) read" and "0 stray key(s)"

  @test:scripts/tests/asset-roles.test.ts::one_table,_and_the_keys_an_asset_may_not_restate::an_unparseable_declaration_yields_no_stray_finding_and_no_crash
  Scenario: An unparseable declaration yields no stray finding and no crash
    Given a declaration "broken" whose body is not JSON
    When stray asset role keys are found under that root
    Then there are none

  @test:scripts/tests/asset-roles.test.ts::one_table,_and_the_keys_an_asset_may_not_restate::an_instance_with_no_declaration_at_all_yields_nothing
  Scenario: A directory with no declaration yields nothing
    Given a directory holding only an empty subdirectory
    When stray asset role keys are found under it
    Then there are none

  @test:scripts/tests/asset-roles.test.ts::this_repository_passes_its_own_gate::no_ungoverned_role,_nothing_writable,_no_stray_key
  Scenario: This repository passes its own asset-role gate
    When the asset-role report is collected for this repository
    Then there are no ungoverned roles, no writable roles and no stray keys
    And at least one declaration was read
    And the report is clean

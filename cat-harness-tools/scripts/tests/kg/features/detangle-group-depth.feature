# skills/kg/graph-management/group-depth.ts derives the group depth of a graph directory from
# where its nodes sit, replacing the hardcoded depths of kg-detangle's SCAN table.
# Each Scenario names the test that executes it.
Feature: Group depth is derived from where the nodes sit

  @test:scripts/tests/kg/detangle-group-depth.test.ts::the_rule:_nodes_nested_below_outnumber_nodes_directly_present::nodes_in_subdirectories_name_groups_one_level_DOWN
  Scenario: Nodes in subdirectories name groups one level down
    Given the directory "a/b" whose nodes are "p/one.md", "p/two.md" and "q/three.md"
    When its group depth is derived
    Then it is 3

  @test:scripts/tests/kg/detangle-group-depth.test.ts::the_rule:_nodes_nested_below_outnumber_nodes_directly_present::nodes_directly_present_name_the_directory_ITSELF
  Scenario: Nodes directly present name the directory itself
    Given the directory "a/b" whose nodes are "one.md", "two.md" and "three.md"
    When its group depth is derived
    Then it is 2

  @test:scripts/tests/kg/detangle-group-depth.test.ts::the_rule:_nodes_nested_below_outnumber_nodes_directly_present::majority,_not_presence_—_a_PARTIAL_carve_does_not_flip_it
  Scenario: The majority of nodes decides the depth, not mere presence
    Given the directory "a/b" with 3 nodes under "t/" and 4 directly present
    When its group depth is derived
    Then it is 2
    And with 4 nodes under "t/" and 1 directly present it is 3

  @test:scripts/tests/kg/detangle-group-depth.test.ts::the_rule:_nodes_nested_below_outnumber_nodes_directly_present::an_empty_corpus_is_the_directory_itself,_not_a_throw
  Scenario: An empty corpus is the directory itself
    Given the directory "a/b" with no nodes
    When its group depth is derived
    Then it is 2

  @test:scripts/tests/kg/detangle-group-depth.test.ts::the_rule:_nodes_nested_below_outnumber_nodes_directly_present::depth_follows_the_path's_own_length,_so_it_is_not_a_constant
  Scenario: Depth follows the length of the directory's own path
    Given a single node directly present in each directory
    Then the depth of "x" is 1
    And the depth of "a/b/c/d" is 4

  @test:scripts/tests/kg/detangle-group-depth.test.ts::it_reproduces_what_the_hardcoded_table_asserted::%s_—_%d_here_/_%d_nested_->_%d
  Scenario: The derived depth reproduces each entry of the hardcoded table
    Given a directory with a number of nodes directly present and a number nested under "sub/"
    When its group depth is derived
    Then it equals the depth the table asserted
    And the rows are "cat-harness/skills" 1 here / 364 nested -> 3, "cat-harness/processes" 69 / 9 -> 2, "cat-harness/schemas" 182 / 54 -> 2 and "bootstrap/skills" 9 / 0 -> 2

  @test:scripts/tests/kg/detangle-group-depth.test.ts::it_reproduces_what_the_hardcoded_table_asserted::the_two_`skills`_directories_DISAGREE,_so_no_kind-based_rule_passes
  Scenario: The two skills directories get different depths
    Given "cat-harness/skills" holding a manifest and two nodes under "p/"
    And "bootstrap/skills" holding three nodes directly
    When the group depth of each is derived
    Then the two depths differ

  @test:scripts/tests/kg/detangle-group-depth.test.ts::importing_the_rule_must_not_run_the_tool::it_imports_nothing_but_node:path,_so_it_has_no_side_effect_to_run
  Scenario: The group-depth module imports nothing but node:path
    # Gap: asserted on source text; importing the module is not run
    Given the source of "group-depth.ts" with its comments stripped
    When its static import specifiers are listed
    Then the only one is "node:path"

  @test:scripts/tests/kg/detangle-group-depth.test.ts::importing_the_rule_must_not_run_the_tool::and_no_dynamic_form,_which_the_static_import_list_cannot_see
  Scenario: The group-depth module has no dynamic import or require
    Given the source of "group-depth.ts" with its comments stripped
    Then it contains no "require(" call
    And it contains no dynamic "import(" call

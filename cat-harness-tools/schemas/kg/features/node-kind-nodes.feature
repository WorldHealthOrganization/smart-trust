# Specifies schemas/kg/node-kind-nodes.ts (issue #2195, bean ujiv):
# nodesOfKind, which finds a kind's nodes in its typologies' directories by
# the $schema tags the kind accepts.
Feature: A kind's nodes are the files in its typologies' directories whose $schema it accepts

  @test:schemas/kg/node-kind-nodes.test.ts::nodesOfKind::a_kind's_page_includes_its_subclasses'_nodes,_each_filed_under_the_kind_it_IS
  Scenario: A kind's nodes include its subclasses' nodes, each under its own kind
    Given an instance alpha whose items/ directory holds a todo/1.0.0 Markdown node a and a sub-todo/1.1.0 node deep/b
    And an index where sub-todo 1.2.0 is a subclass of todo 1.0.0
    When the nodes of "todo" are listed
    Then they are a filed under todo and deep/b filed under sub-todo, in that order

  @test:schemas/kg/node-kind-nodes.test.ts::nodesOfKind::an_earlier_minor_is_accepted;_another_major,_no_tag_and_a_plain_README_are_not_nodes
  Scenario: An earlier minor is a node; another major, no tag and a README are not
    Given items/ also holds c tagged todo/2.0.0, d with no $schema, and a README.md
    And the kind sub-todo is at 1.2.0 while deep/b is tagged sub-todo/1.1.0
    When the nodes of "todo" are listed
    Then deep/b is among them, filed under sub-todo with its sub-todo/1.1.0 tag
    And none of c, d or README is among them

  @test:schemas/kg/node-kind-nodes.test.ts::nodesOfKind::a_subclass's_own_page_does_not_include_its_parent's_nodes
  Scenario: A subclass's nodes do not include its parent's
    When the nodes of "sub-todo" are listed
    Then they are items/deep/b only

  @test:schemas/kg/node-kind-nodes.test.ts::nodesOfKind::each_node_is_held_by_the_instance_that_declares_the_directory,_at_a_path_without_its_extension
  Scenario: A node is held by the declaring instance, at a path without its extension
    When the nodes of "todo" are listed
    Then the first is held by alpha at the path items/a, from the file items/a.md

  @test:schemas/kg/node-kind-nodes.test.ts::nodesOfKind::Markdown_front_matter_is_read_as_YAML,_so_nested_lists_of_objects_survive
  Scenario: Markdown front matter is read as YAML
    Given node a's front matter lists refs as a list of objects
    When the nodes of "todo" are listed
    Then node a's refs are [{ kind: bean, id: b1 }]

  @test:schemas/kg/node-kind-nodes.test.ts::nodesOfKind:_name_rules,_repository_scope,_off-checkout_content::a_repository-scoped_directory's_node_is_addressed_from_the_repository,_not_with_../
  Scenario: A repository-scoped directory's node is addressed from the repository
    Given an instance beta declaring a repository-scoped directory shared/ holding a todo node s
    And a directory branched/ mounted from a branch holding a todo node
    When the nodes of "todo" are listed
    Then the only node is held by beta at the path shared/s

  @test:schemas/kg/node-kind-nodes.test.ts::nodesOfKind:_name_rules,_repository_scope,_off-checkout_content::content_mounted_from_a_branch_is_not_read:_a_committed_page_cannot_keep_up_with_its_tip
  Scenario: Content mounted from a branch is not read
    When the nodes of "todo" are listed
    Then the node "mounted" in beta/branched/ is not among them

  @test:schemas/kg/node-kind-nodes.test.ts::nodesOfKind:_name_rules,_repository_scope,_off-checkout_content::an_instance_declaration_is_a_node_by_its_name_rule,_and_only_when_tagged
  Scenario: An instance declaration is a node only when tagged
    Given beta/beta.json tagged cat-harness-declaration/1.0.0 and gamma/gamma.json with no $schema
    And the kind cat-harness-declaration found by the instance-declaration rule
    When its nodes are listed
    Then the only node is held by beta at the path beta, from the file beta/beta.json

# Specifies the published todos.jsonld against the declared todos Subgraph
# node (declaredSubgraphNode, subgraphPublicationFindings). Skipped where the
# site is not built.
Feature: The published todo graph sits under its declared Subgraph node

  @test:test/coordinator/todo-graph-repo-root.test.ts::what_is_published::its_container_is_the_declared_todos_Subgraph_node,_and_every_todo_is_a_member_of_it
  Scenario: The published todo graph follows the subgraph pattern and names its content source
    Given the published todos.jsonld and the declared "todos" Subgraph node
    When the document is checked against the node's IRI
    Then the node is declared
    And there are no publication findings
    And the document's contentSource equals the node's

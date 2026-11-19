# Specifies schemas/sdlc/todo-graph.ts: the todo graph declares its own
# directories, and refuses what must not be accepted quietly.
Feature: The todo graph's declared layout

  @test:schemas/sdlc/todo-graph.test.ts::the_default_layout::it_parses,_and_names_both_node_kinds
  Scenario: The default layout parses and names both node kinds
    Given the default todo graph
    When it is parsed
    Then the todo-items node is at "items"
    And the todo-feedback node is at "feedback"

  @test:schemas/sdlc/todo-graph.test.ts::the_default_layout::both_kinds_are_in_the_SHARED_registry,_not_a_private_enum
  Scenario: Both node kinds are in the shared graph-typology registry
    Given the todo node kinds
    When each is looked up in the default graph typologies
    Then each is present

  @test:schemas/sdlc/todo-graph.test.ts::the_default_layout::the_file_and_root_names_are_declared,_not_scattered_literals
  Scenario: The file and root names are declared constants
    Given the todo graph module's exported names
    Then the todo graph file is "todos.json"
    And the default todo graph root is "todos"

  @test:schemas/sdlc/todo-graph.test.ts::what_it_refuses::an_unknown_graph_typology_is_rejected,_not_accepted_and_ignored
  Scenario: An unknown graph typology is rejected
    Given a todo graph whose directory claims the typology "no-such-kind"
    When it is parsed
    Then it throws "unknown graph typology"

  @test:schemas/sdlc/todo-graph.test.ts::what_it_refuses::a_duplicate_node_id_is_rejected
  Scenario: A duplicate node id is rejected
    Given a todo graph with two directories of id "items"
    When it is parsed
    Then it throws "duplicate node id"

  @test:schemas/sdlc/todo-graph.test.ts::what_it_refuses::an_absolute_path_is_rejected
  Scenario: An absolute path is rejected
    Given a todo graph directory at "/etc"
    When it is parsed
    Then it throws "escapes the graph root"

  @test:schemas/sdlc/todo-graph.test.ts::what_it_refuses::a_path_escaping_the_root_is_rejected
  Scenario: A path escaping the root is rejected
    Given a todo graph directory at "../elsewhere"
    When it is parsed
    Then it throws "escapes the graph root"

  @test:schemas/sdlc/todo-graph.test.ts::what_it_refuses::an_empty_directory_list_is_rejected
  Scenario: An empty directory list is rejected
    Given a todo graph with no directories
    When it is parsed
    Then it throws

  @test:schemas/sdlc/todo-graph.test.ts::what_it_deliberately_allows::two_feedback_stores_—_unlike_the_bean_graph's_workflow-state
  Scenario: Two feedback stores are allowed
    Given a todo graph with two todo-feedback directories, "feedback/a" and "feedback/b"
    When it is parsed
    Then it has two directories

  @test:schemas/sdlc/todo-graph.test.ts::what_it_deliberately_allows::one_directory_may_hold_both_kinds_—_it_is_a_place_to_look
  Scenario: One directory may hold both node kinds
    Given a todo graph with one directory claiming both todo-items and todo-feedback
    When it is parsed
    Then the todo-items node and the todo-feedback node are the same directory

  @test:schemas/sdlc/todo-graph.test.ts::what_it_deliberately_allows::but_the_graph_ROOT_itself_is_not_a_node_of_the_graph
  Scenario: The graph root itself is not a node
    Given a todo graph directory at "."
    When it is parsed
    Then it throws "escapes the graph root"

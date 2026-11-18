# Specifies the checkout's todos/ and beans/ graphs as declared, the
# published process hierarchy (assets/todos/index.json, built by
# gen-docs-pages.ts when absent) against the real BPMN parser, and readTodos.
Feature: The todo graph is declared and present, the process hierarchy is true, and todos read cleanly

  @test:test/coordinator/todos-repo-root.test.ts::the_declaration_and_the_directory_agree::cat-harness_declares_the_checkout's_`todos`_graph,_repository-scoped
  Scenario: cat-harness declares the repository-scoped todos graph
    Given the checkout root and the cat-harness declaration
    When the directory declaring the "todos" typology is found
    Then the checkout root declares no instance
    And the todos directory's path is "todos/" with scope "repository"

  @test:test/coordinator/todos-repo-root.test.ts::the_declaration_and_the_directory_agree::the_declared_directory_EXISTS_—_declare_only_what_exists
  Scenario: The todos directory and its graph file exist
    Given the declared todos root
    When it is looked up
    Then it exists
    And its graph file exists

  @test:test/coordinator/todos-repo-root.test.ts::the_declaration_and_the_directory_agree::its_own_declaration_parses,_and_names_every_node
  Scenario: The todo graph declares boards, feedback, items and positions
    Given the todo graph file
    When it is parsed
    Then its directories are exactly boards, feedback, items and positions

  @test:test/coordinator/todos-repo-root.test.ts::the_declaration_and_the_directory_agree::every_declared_node_directory_is_on_disk
  Scenario: Every declared todo directory is on disk
    Given the todo directories
    When each is looked up
    Then every one exists

  @test:test/coordinator/todos-repo-root.test.ts::the_declaration_and_the_directory_agree::the_BEAN_graph's_declared_directories_are_on_disk_too
  Scenario: The bean graph's in-checkout directories are on disk, and the others are branches
    Given the bean graph file at the checkout root
    When its directories are split by whether their content is in the checkout
    Then more than one is in the checkout
    And each of those exists under beans/
    And each of the others resolves to a "branch" source

  @test:test/coordinator/todos-repo-root.test.ts::the_published_process_hierarchy::no_PHANTOM_edge_—_the_real_parser_is_the_oracle_for_the_generator's_regex
  Scenario: The published process hierarchy has exactly the calls the real parser reads
    Given every diagram of the checkout loaded with the real process parser
    When the published process hierarchy is read
    Then it equals each process id mapped to the sorted processes it calls

  @test:test/coordinator/todos-repo-root.test.ts::the_published_process_hierarchy::the_key_order_is_the_diagrams'_sorted_FILENAMES,_not_the_directory's_own_order
  Scenario: The hierarchy's keys follow the diagrams' order
    Given every diagram of the checkout loaded with the real process parser
    When the published hierarchy's keys are read
    Then there are more than 5 diagrams
    And the keys are their process ids in the parser's diagram order

  @test:test/coordinator/todos-repo-root.test.ts::reading::there_are_todos_to_read_—_otherwise_this_proves_nothing
  Scenario: There are todos to read
    Given the todos
    When they are read
    Then there is at least one

  @test:test/coordinator/todos-repo-root.test.ts::reading::every_todo_validates;_a_malformed_one_throws_rather_than_being_skipped
  Scenario: Every todo validates
    Given the todos
    When they are read
    Then every one has $schema "todo/1.0.0"

  @test:test/coordinator/todos-repo-root.test.ts::reading::ids_are_unique
  Scenario: Todo ids are unique
    Given the todos
    When their ids are collected
    Then no id occurs twice

  @test:test/coordinator/todos-repo-root.test.ts::reading::an_identity_is_provider-qualified,_and_survives_the_front_matter
  Scenario: Every identity is provider-qualified
    Given the todos that name an identity
    When their identities are read
    Then there is at least one such todo
    And every identity's provider is "github" and its id is not empty

  @test:test/coordinator/todos-repo-root.test.ts::reading::a_`-_kind:_x`_list_DOES_parse_as_a_mapping
  Scenario: References and artefacts parse as mappings
    Given every todo's references and artefacts
    When they are read
    Then there is at least one
    And each has a non-empty kind and id

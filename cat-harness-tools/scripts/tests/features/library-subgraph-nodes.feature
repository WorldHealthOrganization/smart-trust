# Library entries as subgraph members (cat-harness#180): one pointer node per
# entry file with one type, and an entry whose types will not expand reported
# once. Each Scenario names the test that executes it.
Feature: Library entries as subgraph nodes

  @test:scripts/tests/library-subgraph-nodes.test.ts::libraryEntryNodes::one_pointer_per_entry_file:_absolute_@id,_ONE_expanded_@type_(the_first_named),_title_and_path
  Scenario: One pointer per entry file with an absolute id, one expanded type, title and path
    Given a library entry with a manifest and a block, a .jsonld data file with no context, and a directory with no manifest
    When the library entry nodes are read with no network
    Then there are exactly two nodes, the block and the manifest
    And each has its absolute @id, the first named @type expanded, its path and its title

  @test:scripts/tests/library-subgraph-nodes.test.ts::libraryEntryNodes::an_entry_whose_types_do_not_expand_is_one_problem_naming_the_count,_not_a_silent_drop
  Scenario: An entry whose types do not expand is one problem naming the count
    Given an entry whose context redefines a protected term in both its files
    When the library entry nodes are read
    Then there is one problem saying the entry left out 2 files because their @type does not expand

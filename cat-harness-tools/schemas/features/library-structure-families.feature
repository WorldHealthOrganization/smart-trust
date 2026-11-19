# schemas/kg/kind-validator.ts routes a library's structure.json to the family its format names
# (pdf, notebook or text structure), though the node tags itself `_schema` rather than `$schema`.
# Each Scenario names the test that executes it.
Feature: Library structure files route to their format's schema family

  @test:schemas/library-structure-families.test.ts::library_structure_families::each_format_resolves_to_a_runnable_schema
  Scenario: Each structure format resolves to a runnable schema
    Given the harness root
    When the node schemas for the "library" kind are resolved
    Then "pdf-structure/v1", "notebook-structure/v1" and "text-structure/v1" are each in state "resolved"

  @test:schemas/library-structure-families.test.ts::library_structure_families::a_node_is_routed_by_`$schema`,_or_by_`_schema`_when_it_has_none
  Scenario: A node's family tag is its `$schema`, or its `_schema` when it has none
    When the family tag of a node with both "$schema" "a/v1" and "_schema" "b/v1" is read
    Then it is "a/v1"
    And a text-structure node tagged only by "_schema" reads "text-structure/v1"
    And an empty object and an empty array have no family tag

  @test:schemas/library-structure-families.test.ts::library_structure_families::the_body_keeps_the_`_schema`_tag_it_was_routed_by,_and_drops_the_annotations
  Scenario: The family body keeps the routing `_schema` tag and drops other annotations
    Given a text-structure node with a "_schema" tag and a "_comment" annotation
    When its family body is taken
    Then it equals the node with annotations stripped plus "_schema" "text-structure/v1"
    And a node with "$schema" keeps only "$schema", dropping "_schema" and "_note"
    And a node with no tag drops "_note" and keeps its other fields

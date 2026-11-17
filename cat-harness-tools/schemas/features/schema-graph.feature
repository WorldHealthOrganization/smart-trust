# readSchemaGraph in scripts/schema-graph.ts reads a layer's schemas directory into declarations, modules and edges, tested on fixture shapes and on this layer's real corpus.
# Each Scenario names the test that executes it.
Feature: Reading the schema graph

  @test:schemas/schema-graph.test.ts::readSchemaGraph::a_missing_schemas_directory_reads_as_null,_not_as_an_empty_graph
  Scenario: A layer with no schemas directory reads as null
    Given a throwaway directory with no "schemas" directory
    When its schema graph is read
    Then the result is null

  @test:schemas/schema-graph.test.ts::readSchemaGraph::z.object_fields,_optionality_and_arrays
  Scenario: A z.object declaration carries its doc, fields, optionality and arrays
    Given a schema "ASchema" documented "A thing." with a required string "id" and an optional string array "tags"
    When the schema graph is read
    Then "ASchema" is a zod object with the doc "A thing."
    And its fields are "id" and "tags"
    And "tags" is optional and an array, while "id" is not optional

  @test:schemas/schema-graph.test.ts::readSchemaGraph::`z`_is_external,_never_an_unresolved_reference
  Scenario: The "z" import counts as external, not unresolved
    Given a schema built with "z" imported from "zod"
    When the schema graph is read
    Then "z" is not among the declaration's unresolved names
    And it is among its external names

  @test:schemas/schema-graph.test.ts::readSchemaGraph::.extend()_is_an_object_with_a_generalisation_edge,_not_undetermined
  Scenario: A schema built by .extend() is an object with an extends edge to its base
    Given "SubSchema" defined as "BaseSchema.extend" with an optional "extra" field, importing "BaseSchema" from another module
    When the schema graph is read
    Then "SubSchema" is a zod object extending "BaseSchema"
    And its only field is "extra"
    And it has an "extends" edge ending at "schemas/base.ts#BaseSchema"

  @test:schemas/schema-graph.test.ts::readSchemaGraph::a_cross-module_field_reference_becomes_a_resolved_edge
  Scenario: A field referring to a schema in another module becomes a resolved edge
    Given "RootSchema" with a field "leaf" of "LeafSchema" and a field "many" that is an array of "LeafSchema"
    When the schema graph is read
    Then "RootSchema" has one reference, ending at "schemas/leaf.ts#LeafSchema"
    And its edge via "many" is an array edge
    And its edge via "leaf" is not

  @test:schemas/schema-graph.test.ts::readSchemaGraph::a_declared_concern_group_is_read,_and_an_import_through_an_old-path_shim_still_resolves
  Scenario: A declared concern group is read and an import through an old-path re-export still resolves
    Given a "schemas.json" declaring the group "kg", with "LeafSchema" moved into "kg/leaf.ts" and a re-export left at "leaf.ts"
    And "RootSchema" importing "LeafSchema" through the old path, and "kg/mid.ts" referring to both
    When the schema graph is read
    Then "LeafSchema" is declared once, in "schemas/kg/leaf.ts"
    And "RootSchema" refers to it with nothing unresolved
    And "MidSchema" refers to "LeafSchema" and "RootSchema" with nothing unresolved

  @test:schemas/schema-graph.test.ts::readSchemaGraph::an_unrecognised_expression_is_undetermined_and_says_what_it_saw
  Scenario: An unrecognised expression is undetermined and carries a note
    Given "OddSchema" defined as a bare object literal of Zod fields
    When the schema graph is read
    Then "OddSchema" is undetermined
    And it carries a note

  @test:schemas/schema-graph.test.ts::readSchemaGraph::an_interface's_base_goes_to_extendsNames,_not_to_values
  Scenario: An interface's base class is recorded as what it extends, not as values
    Given an interface "Sub" extending "Base" with an optional field "b"
    When the schema graph is read
    Then "Sub" is an interface extending "Base"
    And it has no values
    And its first field is optional
    And it has an "extends" edge

  @test:schemas/schema-graph.test.ts::readSchemaGraph::a_self-reference_through_z.lazy_is_a_box,_not_an_edge
  Scenario: A self-reference through z.lazy makes no edge to itself
    # Gap: checks only that there is no self-edge, not how the self-reference is shown
    Given "NodeSchema" defined through z.lazy with an optional child of itself
    When the schema graph is read
    Then there is no edge from "NodeSchema" to itself

  @test:schemas/schema-graph.test.ts::readSchemaGraph::the_module's_@graphNode_declaration_is_carried_through
  Scenario: Each module's @graphNode declaration is carried through
    Given a module tagged "@graphNode schema", one with no tag, and one tagged "@graphNode none — a barrel"
    When the schema graph is read
    Then their graph nodes are "schema", "undeclared" and "none"
    And the excused module's reason is "a barrel"

  @test:schemas/schema-graph.test.ts::readSchemaGraph::the_reading_is_stable_—_two_reads_of_one_directory_agree_exactly
  Scenario: Two reads of one directory agree exactly and a forward reference resolves
    Given "b.ts" referring to "ASchema" in "a.ts"
    When the schema graph is read twice
    Then both reads serialize identically
    And an edge ends at "schemas/a.ts#ASchema"

  @test:schemas/schema-graph.test.ts::the_real_schema_graph::reads,_and_is_not_empty
  Scenario: This layer's schema graph reads with more than 50 modules, 300 declarations and 100 edges
    Given this layer's real schemas directory
    When its schema graph is read
    Then it is not null
    And it has more than 50 modules, more than 300 declarations and more than 100 edges

  @test:schemas/schema-graph.test.ts::the_real_schema_graph::the_corpus_is_mostly_classified_—_undetermined_is_a_handful,_not_a_third
  Scenario: Fewer than 2 percent of this layer's declarations are undetermined
    Given this layer's real schema graph
    Then undetermined declarations are under 2 percent of all declarations

  @test:schemas/schema-graph.test.ts::the_real_schema_graph::every_edge_lands_on_a_declaration_that_exists
  Scenario: Every edge in this layer's schema graph joins declarations that exist
    Given this layer's real schema graph
    Then no edge starts or ends at an id that is not a declaration

  @test:schemas/schema-graph.test.ts::the_real_schema_graph::`z`_is_external_everywhere,_and_nowhere_unresolved
  Scenario: No declaration in this layer's schema graph has "z" unresolved
    # Gap: does not check that "z" is recorded as external
    Given this layer's real schema graph
    Then no declaration lists "z" among its unresolved names

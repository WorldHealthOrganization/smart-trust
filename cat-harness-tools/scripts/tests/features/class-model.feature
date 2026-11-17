# One class model, three sources (bean cat-tools-4xq6): scripts/schema-graph.ts reads JSON Schema,
# scripts/fhir-logical-model.ts reads FHIR StructureDefinitions, scripts/type-links.ts links types
# to their definitions, and scripts/class-diagram.ts draws every source the same way.
# Each Scenario names the test that executes it.
Feature: One class model drawn the same way from Zod, JSON Schema and FHIR logical models

  @test:scripts/tests/class-model.test.ts::cardinality::reads_min..max_from_optionality,_lists_and_stated_bounds
  Scenario: A field's cardinality is read from optionality, lists and stated bounds
    Given fields that are required, optional, plain lists, non-empty lists and bounded lists
    When their cardinality is read
    Then they read "1..1", "0..1", "0..*", "1..*", "2..*" and "1..20"

  @test:scripts/tests/class-model.test.ts::cardinality::says_?..?_when_the_source_states_no_cardinality,_never_a_guess
  Scenario: An unstated cardinality is shown as unknown
    Given a field whose source states no cardinality
    Then it reads "?..?"

  @test:scripts/tests/class-model.test.ts::JSON_Schema_reader::gives_array_fields_their_cardinality_from_required,_minItems_and_maxItems
  Scenario: JSON Schema arrays take cardinality from required, minItems and maxItems
    Given a JSON Schema with a required array of minItems 1 and an optional array of maxItems 5
    When it is read
    Then the fields read "1..*" and "0..5", and the root carries its $id as canonical

  @test:scripts/tests/class-model.test.ts::JSON_Schema_reader::makes_an_inline_object_a_nested_class_joined_by_an_edge
  Scenario: An inline object property becomes a nested class
    Given a property "layout" that is an inline object with properties
    When the schema is read
    Then a class "UserStory.layout" exists, joined to "UserStory" by an edge through "layout"

  @test:scripts/tests/class-model.test.ts::JSON_Schema_reader::reads_allOf_as_a_parent_plus_own_fields,_and_oneOf_as_member_edges
  Scenario: allOf gives a parent and own fields; oneOf gives member edges
    Given a definition built by allOf of a $ref and inline properties, and one that is a oneOf of $refs
    When the schema is read
    Then the first extends the referenced base and owns the inline fields
    And the second has one member edge per alternative

  @test:scripts/tests/class-model.test.ts::JSON_Schema_reader::states_a_schema_with_no_shape_keyword_as_undetermined,_never_an_empty_class
  Scenario: A schema with no shape keyword is undetermined
    Given a definition with only a description
    Then it is an undetermined declaration whose note says it could not be determined

  @test:scripts/tests/class-model.test.ts::JSON_Schema_reader::states_unparseable_JSON_as_undetermined
  Scenario: Unparseable JSON is undetermined
    Given a schema file that is not valid JSON
    Then its one declaration is undetermined and says so

  @test:scripts/tests/class-model.test.ts::FHIR_logical-model_reader::reads_only_StructureDefinitions_that_define_a_class,_never_a_profile
  Scenario: Only StructureDefinitions that define a class are read
    Given a logical model, a resource specialisation, a profile and a source descriptor
    Then the first two are read and the profile and the descriptor are not

  @test:scripts/tests/class-model.test.ts::FHIR_logical-model_reader::reads_elements_as_fields_with_min..max,_a_backbone_as_a_nested_class,_a_contentReference_as_an_edge_to_it
  Scenario: A logical model's elements become fields, backbones nested classes
    Given a logical model with typed elements, a backbone, a contentReference and an element with no cardinality
    When it is read
    Then the fields carry min..max, the backbone is "GenericPersona.roles", the contentReference is an edge back to it
    And FHIR core types are external and link to their canonical definition

  @test:scripts/tests/class-model.test.ts::FHIR_logical-model_reader::resolves_a_type,_a_Reference_target_and_a_base_by_canonical_across_models
  Scenario: Types, Reference targets and bases resolve by canonical URL
    Given three logical models that name each other by canonical URL
    When they are read together
    Then a type is a field edge, a Reference target an id-ref edge, a baseDefinition an extends edge, and nothing is unresolved

  @test:scripts/tests/class-model.test.ts::FHIR_logical-model_reader::states_a_model_with_no_elements_as_undetermined
  Scenario: A logical model with no elements is undetermined
    Given a StructureDefinition with neither differential nor snapshot
    Then it is one undetermined declaration that says why

  @test:scripts/tests/class-model.test.ts::type_links::links_each_source's_built-in_types_to_their_specification
  Scenario: Built-in types link to their specification
    Then a FHIR primitive links to the HL7 datatypes page, a FHIR complex type to its canonical
    And a JSON Schema type to the JSON Schema reference, a date-time format to XML Schema, a Zod scalar to the Zod API

  @test:scripts/tests/class-model.test.ts::UML_types::shows_a_Zod_field's_type_as_UML_does,_the_same_words_as_JSON_Schema_and_FHIR
  Scenario: A Zod field's diagram type is its UML type
    Given Zod field expressions with optionality, bounds, defaults and regexes
    Then the diagram shows "string", "string[]", "SkillNameSchema[]" and "enum[]"
    And a JSON Schema type is shown as written

  @test:scripts/tests/class-model.test.ts::one_renderer,_one_look::draws_the_same_shape_from_Zod_and_JSON_Schema_identically,_but_for_the_source_label
  Scenario: The same shape from two sources draws identically
    Given a Person with contact points written in Zod and in JSON Schema
    When both are drawn
    Then the drawings are identical but for the source label

  @test:scripts/tests/class-model.test.ts::one_renderer,_one_look::puts_the_source_label_upper_right,_writes_name_:_Type_[min..max],_and_labels_the_edge_with_its_field
  Scenario: The box layout
    When a class is drawn
    Then its source label is upper right, each row reads "name : Type [min..max]", and each edge is labelled with its field and cardinality

  @test:scripts/tests/class-model.test.ts::one_renderer,_one_look::links_every_box_to_its_class_and_every_built-in_type_to_its_definition
  Scenario: Boxes and types are links
    When a class is drawn with a link for each class
    Then the box links to its class and a built-in type links to its definition

  @test:scripts/tests/class-model.test.ts::one_renderer,_one_look::gives_every_diagram_its_own_marker_ids,_so_a_page_with_several_repeats_none
  Scenario: Several diagrams on one page repeat no id
    Given three diagrams drawn for one page, two of them of the same classes
    Then no SVG id appears twice, and each marker reference points at a marker of its own diagram
    And a caller-given prefix names the markers

  @test:scripts/tests/class-model.test.ts::one_renderer,_one_look::draws_an_undetermined_declaration_dashed_with_its_reason,_never_as_an_empty_box
  Scenario: An undetermined declaration is drawn dashed with its reason
    Given a schema file that is not valid JSON
    When it is drawn
    Then the box is dashed and shows the reason

  @test:scripts/tests/class-model.test.ts::skill_and_Tool_pages_draw_their_contracts::draws_the_skill_as_a_«skill»_box_pointing_at_each_contract's_root_class
  Scenario: A skill's contracts are one diagram with the skill pointing at each root class
    Given a skill with an input and an output JSON Schema contract
    When its contract diagram is drawn
    Then a «skill» box links to the skill's page and points at each contract's root class through "input" and "output"
    And nested contract classes are drawn, and the diagram is one line of HTML

  @test:scripts/tests/class-model.test.ts::skill_and_Tool_pages_draw_their_contracts::puts_a_skill's_contract_diagram_and_an_MCP_tool's_input_diagram_on_the_Tool_page
  Scenario: A Tool page draws its skills' contracts and its MCP input
    Given a Tool that satisfies a skill with contracts and serves an MCP tool
    When its page is written
    Then it carries the diagram stylesheet once and two diagrams
    And the MCP diagram's «tool» box links to the layer's MCP tool list

  @test:scripts/tests/class-model.test.ts::class_model_QA_report::records_undetermined_declarations,_unresolved_references_and_unknown_cardinalities_as_kg-qa/v1_findings
  Scenario: The class model QA report records what the readers could not determine
    Given an unparseable JSON Schema and two FHIR logical models, one naming a base the reading does not hold
    When the class model QA report is made
    Then it is a kg-qa/v1 report on the graph "schema-class-model"
    And the undetermined schema, the unresolved base and the field with no cardinality are findings

  @test:scripts/tests/class-model.test.ts::class_model_QA_report::reports_an_unread_source_as_unknown,_never_a_pass,_and_counts_what_each_reader_drew
  Scenario: An unread source is unknown, and each reader's output is counted
    Given an artefact index that is built at publish and absent
    When the class model QA report is made
    Then "class-model-sources-read" is unknown
    And "class-model-sources-drawn" lists the fhir and json-schema readers

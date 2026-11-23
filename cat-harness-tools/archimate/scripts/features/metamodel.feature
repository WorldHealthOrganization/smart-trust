# Specifies the ArchiMate metamodel in use (archimate/schemas/metamodel.ts):
# the ArchiMate 3.2 relationship table, its importer from Archi's XML
# (import-archi-relationships.ts), the patterns a model uses, their DOT and
# Mermaid drawings, and the plain-text report (archimate-metamodel.ts).
Feature: The metamodel a model uses is checked against ArchiMate's relationship table

  @test:archimate/scripts/metamodel.test.ts::the_relationship_table::is_ArchiMate_3.2_as_Archi_holds_it,_with_its_source_and_licence
  Scenario: The table is ArchiMate 3.2 with its source licence
    When the relationship table is loaded
    Then its ArchiMate version is "3.2", its source licence is "MIT", and key "r" is "RealizationRelationship"

  @test:archimate/scripts/metamodel.test.ts::the_relationship_table::is_checked_by_its_own_schema,_the_validator_of_its_$schema_family
  Scenario: The table passes its own schema, the one its $schema family's validator names
    Given the relationship table, whose $schema is "archimate-relationship-table/v1"
    When it is checked by the relationship-table schema
    Then it passes
    And the table with key "r" renamed "Realization" fails
    And the table with $schema "archimate-relationship-table/v2" fails
    And cat-harness's validator node "archimate-relationship-table" validates kind "schemas", family the table's $schema, with the schema "cat-harness-tools:archimate/schemas/metamodel.ts#RelationshipTableSchema"

  @test:archimate/scripts/metamodel.test.ts::the_relationship_table::allows,_refuses,_and_does_not_guess
  Scenario: A relationship is allowed, refused, or unknown
    When it is asked whether an application service serves an application component, by "Serving" and by "ServingRelationship"
    Then both are allowed
    And a data object serving a goal is refused
    And an unknown source type gets no answer

  @test:archimate/scripts/metamodel.test.ts::the_relationship_table::is_written_by_the_importer_from_Archi's_XML,_one_row_per_source_type
  Scenario: The importer writes the table from Archi's XML, one row per source type
    Given Archi's relationship keys "o" (association) and "v" (serving), and relationships A→B "ov" and B→A "o"
    When they are imported
    Then the allowed table is A: {B: "ov"} and B: {A: "o"}
    And its JSON reads back equal, with the row of A written on one line
    And an unknown key letter "q" throws naming it

  @test:archimate/scripts/metamodel.test.ts::the_metamodel_in_use::names_placeholders_by_their_own_type,_never_a_default-named_grouping
  Scenario: A placeholder is an element named after its own type, never a grouping
    Given a model with a registry, a service, a data object, a goal "Trusted records", placeholders "Goal" and "Application Component (MS)" joined by a specialization, and a grouping named "Grouping"
    Then a goal named "Goal" and an application component named "application component (MS)" are placeholders
    And a goal named "Trusted records" and a grouping named "Grouping" are not
    And the metamodel's placeholders are "id-p1" and "id-p2", with the specialization "id-r4" as their relationship

  @test:archimate/scripts/metamodel.test.ts::the_metamodel_in_use::counts_types_and_patterns_without_the_placeholders,_and_checks_each_pattern
  Scenario: Types and patterns are counted without placeholders, and each pattern is checked
    Given the same model
    Then one application component and one goal are counted
    And the patterns are access to a data object, serving of the component, aggregation by the grouping (each once and allowed), and a data object serving a goal (once, not allowed)
    And one pattern is not allowed

  @test:archimate/scripts/metamodel.test.ts::the_metamodel_in_use::draws_the_same_result_as_DOT_and_Mermaid,_a_refused_pattern_in_red
  Scenario: The metamodel is drawn as DOT, a refused pattern in red, and as Mermaid
    Given the same model's metamodel
    When it is drawn as DOT
    Then the data object to goal edge is labelled "✗ serves ×1" and a red colour is used
    And the service to component edge carries its label, categories, layers and a vee arrowhead
    When it is drawn as Mermaid
    Then it is a class diagram with "ApplicationComponent ..> DataObject : accesses ×1"
    And the DOT lines are exactly access of the data object, serving of the component, and "✗ serves ×1" from the data object to the goal
    And each DOT line is a Mermaid line with the same source, target and label
    And the red colour is on the data object to goal line only

  @test:archimate/scripts/metamodel.test.ts::the_metamodel_in_use::keeps_the_picture_readable:_one_line_per_pair,_self-relationships_in_the_box,_no_associations_or_groupings
  Scenario: The drawing has one line per pair, self-relationships in the box, and no associations or groupings
    Given a dense metamodel: capability influences and realises goal, goal aggregates goal, capability associated with goal, and a grouping aggregating goal
    When it is drawn as DOT
    Then there is one capability-to-goal line, labelled "influences ×21" and "realises ×2", with both categories and both layers
    And goal carries "(to itself: aggregates ×13)" and a motivation layer class
    And there is no association and no grouping, unless associations are asked for, which shows "associated with ×4"
    And links are added only when asked, to the type and the pair
    And filtered to "structural" it shows only the realisation and the self-aggregation, and filtered to "dynamic" it has no capability box
    And the drawn categories and their subsets are "structural" and "dependency"
    And the SVG of one of two categories is "metamodel.dependency.svg", and of both is "metamodel.svg"

  @test:archimate/scripts/metamodel.test.ts::the_metamodel_in_use::reports_in_plain_text,_the_refusal_first
  Scenario: The plain-text report names the refusal first, then the placeholders
    Given the same model's metamodel
    When it is reported
    Then the text contains "✗ 1 relationship(s) in 1 pattern(s) ArchiMate does not allow", "Data Object serves Goal ×1: id-r3" and "2 placeholder element(s)"
    And its first line is the heading "1.0.0 (Tiny): …"
    And the second and third lines are the refusal and its pattern "Data Object serves Goal ×1: id-r3"
    And the placeholders follow on the fourth line

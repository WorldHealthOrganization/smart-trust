# scripts/lib/schema-page.ts renders a Schema node's page as documentation: its module's docblock
# prose and a fields table per public *Schema export.
# Each Scenario names the test that executes it.
Feature: A Schema node's page reads as documentation

  @test:scripts/tests/kg/schema-page.test.ts::schema_page::the_docblock's_prose_keeps_everything_but_its_tags
  Scenario: The docblock's prose drops its tags
    Given a module docblock opening "Qualified Dublin Core, as a graph node." and tagged @module and @graphNode
    When its prose is read
    Then the prose starts with "Qualified Dublin Core, as a graph node."
    And it contains neither "@module" nor "@graphNode"

  @test:scripts/tests/kg/schema-page.test.ts::schema_page::prose_renders_headings,_lists,_code_and_links,_escaped
  Scenario: Prose renders headings, lists, code and links, escaped
    Given the docblock prose followed by "A <script> tag."
    When the prose is rendered to HTML
    Then it contains "<h4>Why</h4>"
    And it contains the list "repeated", "language-tagged" as ul/li items
    And "element.qualifier" and the linked "DcFieldSchema" are rendered as code
    And the text reads "A &lt;script&gt; tag."

  @test:scripts/tests/kg/schema-page.test.ts::schema_page::fields_are_flattened_through_arrays_of_objects,_with_required_and_descriptions
  Scenario: Fields are flattened through arrays of objects
    Given a Record schema with an id, an array of fields each holding an element and an array of values, and an enum kind
    When its field rows are read
    Then the rows are id, fields, fields[].element, fields[].values, fields[].values[].value, fields[].values[].language and kind, in that order
    And arrays of objects are typed "array of object" and the enum is typed '"a" | "b"'
    And every row is required except fields[].values[].language
    And fields[].values[].value has the description "The literal."

  @test:scripts/tests/kg/schema-page.test.ts::schema_page::a_type_label_reads_unions_once
  Scenario: A type label reads a union once
    Then a union of two arrays is labelled "array"
    And a const "folio-dublin-core/v1" is labelled '= "folio-dublin-core/v1"'

  @test:scripts/tests/kg/schema-page.test.ts::schema_page::details_join_a_node's_module_prose_and_its_exports'_renderings,_with_a_link_only_when_given
  Scenario: Details join a node's module prose with its own exports' renderings
    # Gap: an export with no href is not rendered, so "a link only when given" is checked only where a link is given
    Given a Schema node for module "dc.ts"
    And a RecordSchema export of "dc.ts" with an href, and an OtherSchema export of "other.ts"
    When the page details are built and the section rendered
    Then the node's exports are exactly "RecordSchema"
    And the HTML contains "<h2>Description</h2>"
    And it links "JSON Schema" to "zod/dc/RecordSchema.schema.json"
    And it contains the field "fields[].values[].value" as code

  @test:scripts/tests/kg/schema-page.test.ts::schema_page::a_module_with_no_exports_shows_its_description_and_no_schemas_heading
  Scenario: A module with no exports shows its description and no schemas heading
    Given details with prose "A mint rule." and no exports
    When the section is rendered
    Then it contains "<p>A mint rule.</p>"
    And it does not contain "<h2>Schemas</h2>"
